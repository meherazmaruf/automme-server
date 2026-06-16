import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getGeminiKey } from './gemini-keys.js';

export class EditorAgent {
  constructor() {
    this.name = 'Editor Agent';
    this.llm = new ChatGoogleGenerativeAI({
      apiKey: getGeminiKey(),
      modelName: 'gemini-2.0-flash',
      temperature: 0.2,
      maxOutputTokens: 8192,
    });
  }

  async reviewAndPolish(rawContent, topic, seoData, researchData) {
    console.log('[Editor Agent] Reviewing and polishing content...');

    const focusKeyword = seoData?.focusKeyword || topic;
    const targetKws = seoData?.targetKeywords?.join(', ') || topic;
    const lsiKws = seoData?.lsiKeywords?.join(', ') || '';

    const prompt = PromptTemplate.fromTemplate(`
You are a senior content editor for Automme. Review, fact-check, and polish this blog post to meet publication quality.

TOPIC: {topic}
FOCUS KEYWORD: {focusKeyword}
TARGET KEYWORDS: {targetKws}
LSI KEYWORDS: {lsiKws}
META DESCRIPTION: {metaDescription}

--- RESEARCH DATA (for fact-checking) ---
{researchInsights}

--- POST CONTENT TO REVIEW ---
{content}

--- EDITORIAL CHECKLIST ---

**1. Fact-Checking**
- Cross-check all statistics and claims against the research data provided
- Flag any claims NOT supported by research
- Remove or qualify unsupported claims with "according to industry reports" or similar

**2. Keyword Optimization**
- Focus keyword should appear in: H1 (title), first 100 words, at least one H2, and 2-3 more times naturally
- LSI keywords should be used as semantic variations (don't repeat focus keyword too much)
- Target keywords should appear in H2s and body naturally
- Keyword density should feel natural (not stuffed)

**3. Readability & Structure**
- Sentences should average 15-20 words (vary length for rhythm)
- Paragraphs: 2-4 sentences max
- Transition words between sections (However, Moreover, For example, etc.)
- Active voice preferred over passive
- Reading level: Grade 8-10 (accessible to business owners)

**4. Intro-Content Alignment**
- Does the introduction promise something? (e.g. "In this post we'll cover X, Y, Z")
- Does the body deliver ALL promises from the intro?
- If not, add the missing content or adjust the intro

**5. Completeness Check**
- Are there any sections that feel incomplete or cut off?
- Is there a clear thread/argument throughout?
- Does it have: Hook → Problem → Solution → Evidence → FAQ → Takeaways → CTA?

**6. SEO & Meta**
- Generate or improve the meta description if needed (max 155 chars, include focus keyword)
- Suggest an optimized slug/URL

Return the COMPLETE polished content in JSON format:
{{
  "polishedContent": "FULL polished HTML content — return EVERYTHING, do not truncate",
  "changes": "Summary of key changes made (2-3 sentences)",
  "readabilityScore": 75,
  "keywordDensity": "good | too-low | too-high",
  "factCheckIssues": ["issue 1", "issue 2"],
  "seoScore": 85,
  "metaDescription": "optimized meta description under 155 chars",
  "suggestedSlug": "url-friendly-slug-for-this-post"
}}

IMPORTANT: Return the COMPLETE content in polishedContent. Do NOT truncate or use "..." — return every single word.
`);

    const chain = RunnableSequence.from([
      prompt,
      this.llm,
      new StringOutputParser(),
    ]);

    const result = await chain.invoke({
      topic,
      focusKeyword: focusKeyword || topic,
      targetKws,
      lsiKws,
      metaDescription: seoData?.metaDescription || '',
      researchInsights: researchData?.combinedInsights?.substring(0, 4000) || '',
      content: rawContent,
    });

    try {
      const cleaned = result
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      return {
        polishedContent: parsed.polishedContent || rawContent,
        changes: parsed.changes || 'Content reviewed and optimized for SEO.',
        readabilityScore: typeof parsed.readabilityScore === 'number' ? parsed.readabilityScore : 75,
        keywordDensity: parsed.keywordDensity || 'good',
        factCheckIssues: Array.isArray(parsed.factCheckIssues) ? parsed.factCheckIssues : [],
        seoScore: typeof parsed.seoScore === 'number' ? parsed.seoScore : 80,
        metaDescription: parsed.metaDescription || seoData?.metaDescription || '',
        suggestedSlug: parsed.suggestedSlug || '',
      };
    } catch {
      console.warn('[Editor Agent] JSON parse failed, using raw polished content');
      return {
        polishedContent: result,
        changes: 'Content reviewed and optimized.',
        readabilityScore: 75,
        keywordDensity: 'good',
        factCheckIssues: [],
        seoScore: 80,
        metaDescription: seoData?.metaDescription || '',
        suggestedSlug: '',
      };
    }
  }
}
