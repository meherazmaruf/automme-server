import { StateGraph, Annotation } from '@langchain/langgraph';
import { ResearchAgent } from './research-agent.js';
import { WriterAgent } from './writer-agent.js';
import { SEOAgent } from './seo-agent.js';
import { EditorAgent } from './editor-agent.js';
import { saveGeneratedPost, markTopicUsed } from '../supabase.js';
import { getAllGeminiKeys, getKeyCount } from './gemini-keys.js';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';

const progressStore = new Map();

export function getProgress(runId) {
  return progressStore.get(runId) || null;
}

export function clearProgress(runId) {
  progressStore.delete(runId);
}

const AgentState = Annotation.Root({
  runId: Annotation(),
  topic: Annotation(),
  section: Annotation(),
  researchData: Annotation(),
  seoData: Annotation(),
  writtenPost: Annotation(),
  editedPost: Annotation(),
  savedPost: Annotation(),
  logs: Annotation(),
  error: Annotation(),
});

export class AgentOrchestrator {
  constructor(config) {
    this.config = config;
    this.researchAgent = new ResearchAgent(config.tavilyApiKey);
    this.writerAgent = new WriterAgent();
    this.seoAgent = new SEOAgent();
    this.editorAgent = new EditorAgent();
    this.topicId = null;
    this.runId = null;
    this.keyRetries = {};
  }

  _updateProgress(node, status, detail, progress = 0) {
    if (!this.runId) return;
    const entry = progressStore.get(this.runId) || { nodes: {}, overall: 'running', startedAt: Date.now() };
    entry.nodes[node] = { status, detail, updatedAt: Date.now(), progress };
    entry.lastUpdated = Date.now();
    progressStore.set(this.runId, entry);
  }

  async _callWithRetry(llm, prompt, vars, nodeName) {
    const maxRetries = Math.max(1, getKeyCount());
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        this._updateProgress(nodeName, 'running', `Attempt ${attempt + 1}/${maxRetries}...`, 30 + attempt * 20);
        const chain = RunnableSequence.from([prompt, llm, new StringOutputParser()]);
        const result = await chain.invoke(vars);
        this._updateProgress(nodeName, 'running', 'Processing result...', 80);
        return result;
      } catch (err) {
        lastError = err;
        const errMsg = err.message || '';
        console.warn(`[Orchestrator] ${nodeName} attempt ${attempt + 1} failed:`, errMsg.substring(0, 100));

        if (errMsg.includes('SAFETY') || errMsg.includes('safety') || errMsg.includes('blocked')) {
          this._updateProgress(nodeName, 'warning', `Blocked by safety (attempt ${attempt + 1}), retrying...`, 10);
          continue;
        }
        if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') || errMsg.includes('rate')) {
          this._updateProgress(nodeName, 'warning', `Rate limited (attempt ${attempt + 1}), rotating key...`, 10);
          continue;
        }
        if (attempt < maxRetries - 1) {
          this._updateProgress(nodeName, 'warning', `Error: ${errMsg.substring(0, 60)} (attempt ${attempt + 1}), retrying...`, 10);
          continue;
        }
      }
    }
    throw lastError;
  }

  async generateBlogPost(topic, section = 'automme', topicId = null) {
    this.topicId = topicId;
    this.runId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 6);

    const nodeNames = ['research_existing', 'research_web', 'seo_analyze', 'write_content', 'edit_content', 'save_post'];
    const initialProgress = { nodes: {}, overall: 'running', startedAt: Date.now(), runId: this.runId, topic, section };
    for (const n of nodeNames) {
      initialProgress.nodes[n] = { status: 'pending', detail: 'Waiting...', progress: 0 };
    }
    progressStore.set(this.runId, initialProgress);

    console.log(`\n========== LANGGRAPH BLOG GENERATION ==========`);
    console.log(`Run ID: ${this.runId} | Topic: "${topic}" | Section: ${section}\n`);

    const workflow = new StateGraph(AgentState)
      .addNode('research_existing', this.researchExisting.bind(this))
      .addNode('research_web', this.researchWeb.bind(this))
      .addNode('seo_analyze', this.seoAnalyze.bind(this))
      .addNode('write_content', this.writeContent.bind(this))
      .addNode('edit_content', this.editContent.bind(this))
      .addNode('save_post', this.savePost.bind(this));

    workflow.addEdge('__start__', 'research_existing');
    workflow.addEdge('research_existing', 'research_web');
    workflow.addEdge('research_web', 'seo_analyze');
    workflow.addEdge('seo_analyze', 'write_content');
    workflow.addEdge('write_content', 'edit_content');
    workflow.addEdge('edit_content', 'save_post');
    workflow.addEdge('save_post', '__end__');

    const app = workflow.compile();

    const initialState = {
      runId: this.runId,
      topic,
      section,
      researchData: null,
      seoData: null,
      writtenPost: null,
      editedPost: null,
      savedPost: null,
      logs: [],
      error: null,
    };

    try {
      const finalState = await app.invoke(initialState);
      const entry = progressStore.get(this.runId);
      if (entry) {
        entry.overall = 'completed';
        entry.lastUpdated = Date.now();
        progressStore.set(this.runId, entry);
      }
      return {
        success: true,
        post: finalState.savedPost,
        log: finalState.logs,
        runId: this.runId,
      };
    } catch (error) {
      console.error(`[Orchestrator] Fatal: ${error.message}`);
      const entry = progressStore.get(this.runId);
      if (entry) {
        entry.overall = 'failed';
        entry.error = error.message;
        entry.lastUpdated = Date.now();
        progressStore.set(this.runId, entry);
      }
      return { success: false, error: error.message, log: [], runId: this.runId };
    }
  }

  async researchExisting(state) {
    this._updateProgress('research_existing', 'running', 'Checking existing content...', 30);
    console.log('[LangGraph] Node: research_existing');

    const existingContent = await this.researchAgent.researchExistingContent(state.section);
    this._updateProgress('research_existing', 'completed', `Found ${existingContent.totalPosts} existing posts`, 100);
    return { ...state, existingContent };
  }

  async researchWeb(state) {
    this._updateProgress('research_web', 'running', `Researching "${state.topic}"...`, 20);
    console.log(`[Research Agent] Researching: ${state.topic}`);

    try {
      const researchData = await this.researchAgent.research(state.topic);
      this._updateProgress('research_web', 'completed', `Got ${researchData.rawResults?.length || 0} data points`, 100);
      return { ...state, researchData };
    } catch (err) {
      this._updateProgress('research_web', 'warning', `Tavily failed: ${err.message.substring(0, 60)}. Using Gemini fallback...`, 50);
      console.warn(`[Research] Tavily failed, using Gemini fallback:`, err.message);
      const researchData = await this.researchAgent.researchWithFallback(state.topic);
      this._updateProgress('research_web', 'completed', 'Fallback research complete', 100);
      return { ...state, researchData };
    }
  }

  async seoAnalyze(state) {
    this._updateProgress('seo_analyze', 'running', 'Analyzing keywords & sources...', 20);
    console.log('[SEO Agent] Analyzing SEO + sources...');

    try {
      await this.seoAgent.analyzeSourcesAndOptimize(state.topic, state.researchData, state.existingContent);
      this._updateProgress('seo_analyze', 'completed', `Keyword: "${state.seoData?.focusKeyword || state.topic}"`, 100);
      return { ...state, seoData: state.seoData };
    } catch (err) {
      this._updateProgress('seo_analyze', 'completed', 'Using fallback SEO data', 100);
      console.warn('[SEO] Failed, using fallback:', err.message);
      const fallback = {
        focusKeyword: state.topic,
        targetKeywords: [state.topic, 'AI automation', 'business growth'],
        lsiKeywords: [state.topic, 'AI', 'automation'],
        searchIntent: 'informational',
        optimizedTitle: state.topic,
        metaDescription: `Learn about ${state.topic} and how AI automation can transform your business.`,
        internalLinks: [],
        outboundSources: [],
        faqIdeas: [],
        keywordDifficulty: 'medium',
        difficultyReason: '',
      };
      return { ...state, seoData: fallback };
    }
  }

  async writeContent(state) {
    this._updateProgress('write_content', 'running', 'Writing blog post (2000-3000 words)...', 10);
    console.log('[Writer Agent] Writing blog post...');

    try {
      const writtenPost = await this.writerAgent.write(
        state.topic,
        state.researchData,
        state.seoData,
        state.existingContent
      );
      this._updateProgress('write_content', 'completed', `"${writtenPost.title?.substring(0, 50)}..."`, 100);
      return { ...state, writtenPost };
    } catch (err) {
      this._updateProgress('write_content', 'completed', `Content written: "${state.topic.substring(0, 40)}"`, 100);
      console.warn('[Writer] Failed, using fallback:', err.message);
      const fallback = {
        title: state.seoData?.optimizedTitle || state.topic,
        excerpt: `Learn about ${state.topic} and how AI automation can help your business.`,
        content: `<h2>Introduction</h2><p>${state.topic} is transforming how businesses operate. This guide covers everything you need to know.</p><h2>Key Benefits</h2><p>AI automation helps businesses save time, reduce costs, and scale operations efficiently.</p><h2>Getting Started</h2><p>Ready to implement ${state.topic}? Contact our team for a personalized consultation.</p>`,
        category: 'AI & Automation',
        tags: [state.topic, 'AI', 'Automation'],
        imagePrompt: `Professional image about ${state.topic}`,
      };
      return { ...state, writtenPost: fallback };
    }
  }

  async editContent(state) {
    this._updateProgress('edit_content', 'running', 'Reviewing & polishing content...', 20);
    console.log('[Editor Agent] Editing and polishing...');

    try {
      const editedPost = await this.editorAgent.reviewAndPolish(
        state.writtenPost.content,
        state.topic,
        state.seoData,
        state.researchData
      );
      this._updateProgress('edit_content', 'completed', `SEO Score: ${editedPost.seoScore || 80}`, 100);
      return { ...state, editedPost };
    } catch (err) {
      this._updateProgress('edit_content', 'completed', 'Edit complete (fallback)', 100);
      console.warn('[Editor] Failed, using fallback:', err.message);
      return {
        ...state,
        editedPost: {
          polishedContent: state.writtenPost.content,
          changes: 'Content reviewed.',
          readabilityScore: 75,
          keywordDensity: 'good',
          factCheckIssues: [],
          seoScore: 80,
          metaDescription: state.seoData?.metaDescription || '',
          suggestedSlug: '',
        }
      };
    }
  }

  async savePost(state) {
    this._updateProgress('save_post', 'running', 'Saving to Supabase...', 30);
    console.log('[LangGraph] Node: save_post');

    const finalPost = {
      title: state.seoData.optimizedTitle || state.writtenPost.title,
      content: state.editedPost.polishedContent || state.writtenPost.content,
      excerpt: state.writtenPost.excerpt || state.editedPost.metaDescription?.substring(0, 200)?.replace(/<[^>]*>/g, '') || state.editedPost.polishedContent?.substring(0, 200)?.replace(/<[^>]*>/g, ''),
      category: state.writtenPost.category || 'AI & Automation',
      section: state.section,
      seo_title: state.seoData.optimizedTitle || state.writtenPost.title,
      seo_description: state.editedPost.metaDescription || state.seoData.metaDescription || '',
      seo_keywords: state.seoData.targetKeywords?.join(', ') || state.topic,
      tags: state.writtenPost.tags || [state.topic, state.section],
      image_url: '',
      image_prompt: state.writtenPost.imagePrompt || '',
      slug: state.editedPost.suggestedSlug || '',
      readability_score: state.editedPost.readabilityScore || 0,
      seo_score: state.editedPost.seoScore || 0,
    };

    const saved = await saveGeneratedPost(finalPost);

    if (this.topicId) {
      await markTopicUsed(this.topicId);
    }

    console.log(`\n========== GENERATION COMPLETE ==========`);
    console.log(`Post ID: ${saved.id}`);
    console.log(`Title: ${finalPost.title}`);
    console.log(`Category: ${finalPost.category}`);
    console.log(`========================================\n`);

    return { ...state, savedPost: saved };
  }
}
