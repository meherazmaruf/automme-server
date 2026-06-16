import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getGeminiKey } from './gemini-keys.js';

export class WriterAgent {
  constructor() {
    this.name = 'Writer Agent';
    this.llm = new ChatGoogleGenerativeAI({
      apiKey: getGeminiKey(),
      modelName: 'gemini-2.0-flash',
      temperature: 0.5,
      maxOutputTokens: 8192,
    });
  }

  async write(topic, researchData, seoData, existingContent) {
    console.log('[Writer Agent] Writing blog post...');

    const prompt = PromptTemplate.fromTemplate(`
You are a senior content writer for Automme — a business AI automation blog. Write an authoritative, SEO-optimized blog post that ranks on Google.

TOPIC: {topic}

--- RESEARCH DATA (use these for facts, stats, and examples) ---
{researchInsights}

--- STATISTICS (include at least 3 in the post) ---
{statistics}

--- FAQS FROM RESEARCH (answer these in the post) ---
{faqs}

--- COMPETITOR DOMAINS (differentiate from these) ---
{competitors}

--- SEO TARGETS ---
Focus Keyword: {focusKeyword}
Target Keywords: {targetKeywords}
LSI Keywords: {lsiKeywords}
Search Intent: {searchIntent}
Optimized Title Suggestion: {optimizedTitle}
Meta Description: {metaDescription}

--- EXISTING POSTS (link to these internally where relevant) ---
{existingTitles}

--- OUTBOUND SOURCES (reference these) ---
{outboundSources}

--- CONTENT REQUIREMENTS ---
1. **Word count**: 2000-3000 words
2. **Hook**: Start with a compelling stat, question, or pain point
3. **Structure**: Use H2 and H3 naturally — don't force them
4. **Keyword placement**: 
   - Focus keyword in H1, first 100 words, one H2, and naturally throughout
   - Use LSI keywords as semantic variations
   - Don't keyword stuff — write for humans
5. **Statistics**: Include at least 3 data points from research with source context
6. **Real examples**: Use case studies or scenarios from research
7. **Internal links**: Link to existing posts where relevant (use actual titles)
8. **Outbound links**: Cite authoritative sources from research
9. **FAQ section**: Add a "Frequently Asked Questions" H2 section with 3-5 Q&As (use FAQ schema format)
10. **Key Takeaways**: Bullet-point summary section before conclusion
11. **CTA**: End with a compelling call-to-action (book a call, download resource, etc.)
12. **Tone**: Professional yet conversational. Write as a knowledgeable consultant.
13. **Formatting**: Clean HTML with <h2>, <h3>, <p>, <ul>, <blockquote>, <strong> tags
14. **Avoid**: Fluff, generic advice, over-promising, jargon without explanation

Return JSON:
{{
  "title": "Click-optimized blog title (use power words, numbers if possible)",
  "excerpt": "2-3 sentences summarizing the post (max 160 chars)",
  "content": "Full HTML content of the post (2000-3000 words)",
  "category": "Best category from: AI Systems, Operations AI, AI News, Marketing & Content, Scaling Strategy, Case Study, Other",
  "tags": ["focusKeyword", "lsiKeyword1", "lsiKeyword2", "topic", "related-term"],
  "imagePrompt": "Detailed image generation prompt for the featured image (describe scene, style, colors, mood)"
}}
`);

    const chain = RunnableSequence.from([
      prompt,
      this.llm,
      new StringOutputParser(),
    ]);

    const statsText = researchData.statistics?.length > 0
      ? researchData.statistics.map(s => `- ${s}`).join('\n')
      : 'No statistics found in research.';

    const faqsText = researchData.faqs?.length > 0
      ? researchData.faqs.map(f => `- ${f}`).join('\n')
      : 'None found.';

    const competitorsText = researchData.competitors?.length > 0
      ? researchData.competitors.map(c => `- ${c.domain}: ${c.title}`).join('\n')
      : 'None found.';

    const existingTitlesText = existingContent?.recentTitles?.length > 0
      ? existingContent.recentTitles.map(t => `- "${t.title}" (${t.category})`).join('\n')
      : 'No existing posts.';

    const result = await chain.invoke({
      topic,
      researchInsights: researchData.combinedInsights?.substring(0, 6000) || '',
      statistics: statsText,
      faqs: faqsText,
      competitors: competitorsText,
      focusKeyword: seoData.focusKeyword || topic,
      targetKeywords: seoData.targetKeywords?.join(', ') || topic,
      lsiKeywords: seoData.lsiKeywords?.join(', ') || topic,
      searchIntent: seoData.searchIntent || 'informational',
      optimizedTitle: seoData.optimizedTitle || topic,
      metaDescription: seoData.metaDescription || '',
      existingTitles: existingTitlesText,
      outboundSources: seoData.outboundSources?.join('\n') || '',
    });

    try {
      const cleaned = result
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      return {
        title: parsed.title || topic,
        excerpt: parsed.excerpt || result.substring(0, 160).replace(/<[^>]*>/g, ''),
        content: parsed.content || result,
        category: parsed.category || 'AI & Automation',
        tags: Array.isArray(parsed.tags) ? parsed.tags : [topic, 'AI', 'Automation'],
        imagePrompt: parsed.imagePrompt || '',
      };
    } catch {
      console.warn('[Writer Agent] JSON parse failed, returning raw content');
      return {
        title: seoData.optimizedTitle || topic,
        excerpt: result.substring(0, 160).replace(/<[^>]*>/g, ''),
        content: result,
        category: 'AI & Automation',
        tags: [topic, 'AI', 'Automation', seoData.focusKeyword || topic].filter(Boolean),
        imagePrompt: '',
      };
    }
  }
}
