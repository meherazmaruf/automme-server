import { StateGraph, Annotation } from '@langchain/langgraph';
import { ResearchAgent } from './research-agent.js';
import { WriterAgent } from './writer-agent.js';
import { SEOAgent } from './seo-agent.js';
import { EditorAgent } from './editor-agent.js';
import { saveGeneratedPost, markTopicUsed } from '../supabase.js';

const AgentState = Annotation.Root({
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
  }

  async generateBlogPost(topic, section = 'automme', topicId = null) {
    this.topicId = topicId;
    console.log(`\n========== LANGGRAPH BLOG GENERATION ==========`);
    console.log(`Topic: "${topic}" | Section: ${section}\n`);

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
      return {
        success: true,
        post: finalState.savedPost,
        log: finalState.logs,
      };
    } catch (error) {
      console.error(`[Orchestrator] Fatal: ${error.message}`);
      return { success: false, error: error.message, log: [] };
    }
  }

  async researchExisting(state) {
    console.log('[LangGraph] Node: research_existing');
    console.log('[Orchestrator] Starting LangGraph pipeline...');

    const existingContent = await this.researchAgent.researchExistingContent(state.section);
    return { ...state, existingContent };
  }

  async researchWeb(state) {
    console.log('[LangGraph] Node: research_web');
    console.log(`[Research Agent] Researching: ${state.topic}`);

    const researchData = await this.researchAgent.research(state.topic);
    return { ...state, researchData };
  }

  async seoAnalyze(state) {
    console.log('[LangGraph] Node: seo_analyze');
    console.log('[SEO Agent] Analyzing SEO + sources...');

    const seoData = await this.seoAgent.analyzeSourcesAndOptimize(state.topic, state.researchData, state.existingContent);
    return { ...state, seoData };
  }

  async writeContent(state) {
    console.log('[LangGraph] Node: write_content');
    console.log('[Writer Agent] Writing blog post...');

    const writtenPost = await this.writerAgent.write(
      state.topic,
      state.researchData,
      state.seoData,
      state.existingContent
    );
    return { ...state, writtenPost };
  }

  async editContent(state) {
    console.log('[LangGraph] Node: edit_content');
    console.log('[Editor Agent] Editing and polishing...');

    const editedPost = await this.editorAgent.reviewAndPolish(
      state.writtenPost.content,
      state.topic,
      state.seoData,
      state.researchData
    );
    return { ...state, editedPost };
  }

  async savePost(state) {
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
