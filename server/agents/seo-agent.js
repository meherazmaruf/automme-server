import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getGeminiKey } from './gemini-keys.js';

export class SEOAgent {
  constructor() {
    this.name = 'SEO Agent';
    this.llm = new ChatGoogleGenerativeAI({
      apiKey: getGeminiKey(),
      modelName: 'gemini-2.0-flash',
      temperature: 0.3,
    });
  }

  async analyzeSourcesAndOptimize(topic, researchData, existingContent) {
    console.log('[SEO Agent] Analyzing sources and optimizing...');

    const sourceSummary = researchData.rawResults?.flatMap(r =>
      r.results.map(s => `- [${s.score?.toFixed(2)}] ${s.title} (${s.url})`)
    ).join('\n') || 'No sources';

    const existingTitles = existingContent?.recentTitles?.map(t => `- ${t.title} (${t.category})`).join('\n') || 'None';
    const topCategory = existingContent?.topCategory || 'AI & Automation';
    const categoryKws = existingContent?.categoryKeywords?.join(', ') || 'AI, automation, business';

    const prompt = PromptTemplate.fromTemplate(`
You are an expert SEO strategist for a business automation blog called Automme.

TOPIC: {topic}

RESEARCH SOURCES (with relevance scores):
{sources}

RESEARCH SUMMARY:
{researchSummary}

EXISTING POSTS (for internal linking):
{existingTitles}

BLOG CATEGORY: {topCategory}
CATEGORY KEYWORDS: {categoryKws}

TASKS:
1. Identify the best **focus keyword** (high-intent, business automation niche)
2. Find 7-10 **long-tail keywords** (question-based + phrase-based, e.g. "how to automate X", "best AI tools for Y")
3. Find 5-7 **LSI keywords** (semantically related terms)
4. Classify **search intent**: informational, commercial, or transactional
5. Suggest a **click-optimized blog title** (use power words, numbers, brackets)
6. Write **meta description** (max 155 chars, include focus keyword naturally)
7. Suggest **3 internal links** to existing posts (use actual titles from list)
8. Suggest **outbound link opportunities** (top 3 authoritative sources from research)
9. Suggest **FAQ schema questions** (3-5 questions people search for)
10. Rate **keyword difficulty** (easy/medium/hard) and explain why

Return valid JSON only:
{{
  "focusKeyword": "primary keyword",
  "targetKeywords": ["long-tail kw1", "long-tail kw2", ...],
  "lsiKeywords": ["lsi1", "lsi2", ...],
  "searchIntent": "informational | commercial | transactional",
  "optimizedTitle": "SEO-optimized blog title with power words",
  "metaDescription": "meta description under 155 chars with keyword",
  "internalLinks": ["Existing post title 1", "Existing post title 2", "Existing post title 3"],
  "outboundSources": ["https://authoritative-source-1.com", ...],
  "faqIdeas": ["Question 1?", "Question 2?", ...],
  "keywordDifficulty": "easy | medium | hard",
  "difficultyReason": "brief explanation"
}}
`);

    const chain = RunnableSequence.from([
      prompt,
      this.llm,
      new StringOutputParser(),
    ]);

    const result = await chain.invoke({
      topic,
      sources: sourceSummary.substring(0, 4000),
      researchSummary: researchData.combinedInsights?.substring(0, 3000) || '',
      existingTitles: existingTitles.substring(0, 1000),
      topCategory: topCategory || 'AI & Automation',
      categoryKws: categoryKws || 'AI, automation',
    });

    return this._parseResult(result, topic);
  }

  _parseResult(raw, topic) {
    try {
      const cleaned = raw
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      return {
        focusKeyword: parsed.focusKeyword || topic,
        targetKeywords: Array.isArray(parsed.targetKeywords) ? parsed.targetKeywords : [topic, 'AI automation', 'business growth'],
        lsiKeywords: Array.isArray(parsed.lsiKeywords) ? parsed.lsiKeywords : [topic],
        searchIntent: parsed.searchIntent || 'informational',
        optimizedTitle: parsed.optimizedTitle || topic,
        metaDescription: parsed.metaDescription || `Learn about ${topic} and how AI automation can transform your business.`,
        internalLinks: Array.isArray(parsed.internalLinks) ? parsed.internalLinks : [],
        outboundSources: Array.isArray(parsed.outboundSources) ? parsed.outboundSources : [],
        faqIdeas: Array.isArray(parsed.faqIdeas) ? parsed.faqIdeas : [],
        keywordDifficulty: parsed.keywordDifficulty || 'medium',
        difficultyReason: parsed.difficultyReason || '',
      };
    } catch {
      console.warn('[SEO Agent] Failed to parse JSON, extracting from raw response');
      return {
        focusKeyword: topic,
        targetKeywords: [topic, 'AI automation', 'business automation', 'workflow automation'],
        lsiKeywords: [topic, 'AI', 'automation', 'business', 'technology'],
        searchIntent: 'informational',
        optimizedTitle: topic,
        metaDescription: `Learn about ${topic} and how AI automation can transform your business.`,
        internalLinks: [],
        outboundSources: [],
        faqIdeas: [],
        keywordDifficulty: 'medium',
        difficultyReason: '',
      };
    }
  }
}
