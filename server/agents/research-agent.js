export class ResearchAgent {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.name = 'Research Agent';
  }

  async research(topic) {
    console.log(`[Research Agent] Researching: ${topic}`);

    const queries = [
      `${topic} 2025 2026 statistics data`,
      `${topic} case studies success stories`,
      `${topic} trends forecast`,
      `${topic} best practices strategies tips`,
      `${topic} challenges solutions how to`,
    ];

    const allResults = [];

    for (const query of queries) {
      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            query,
            search_depth: 'advanced',
            max_results: 5,
            include_answer: true,
          })
        });

        if (!response.ok) {
          console.warn(`[Research Agent] Tavily API error: ${response.status}`);
          continue;
        }

        const data = await response.json();
        allResults.push({
          query,
          answer: data.answer || '',
          results: (data.results || []).map(r => ({
            title: r.title,
            url: r.url,
            content: r.content,
            score: r.score || 0.5,
          })),
        });
      } catch (err) {
        console.error(`[Research Agent] Query failed: ${query}`, err.message);
      }
    }

    const combinedInsights = allResults.map(r =>
      `Query: "${r.query}"\nSummary: ${r.answer}\nSources:\n${
        r.results.map(s => `- [${s.score?.toFixed(2)}] ${s.title} (${s.url}): ${s.content.substring(0, 500)}`).join('\n')
      }`
    ).join('\n\n---\n\n');

    return {
      topic,
      combinedInsights,
      rawResults: allResults,
      statistics: this._extractStatistics(allResults),
      faqs: this._extractFAQs(allResults),
      competitors: this._extractCompetitors(allResults),
      suggestedAngle: this._extractAngle(allResults),
    };
  }

  _extractStatistics(results) {
    const stats = [];
    for (const r of results) {
      if (r.answer) {
        const matches = r.answer.match(/\d+[%,\s]/g);
        if (matches) {
          const sentences = r.answer.split(/\.\s+/);
          for (const s of sentences) {
            if (/\d+/.test(s) && s.length < 200) stats.push(s.trim());
          }
        }
      }
      for (const s of r.results) {
        const matches = s.content.match(/[^.]*\d+[%][^.]*\./g);
        if (matches) {
          for (const m of matches) stats.push(m.trim());
        }
      }
    }
    return [...new Set(stats)].slice(0, 10);
  }

  _extractFAQs(results) {
    const faqs = [];
    for (const r of results) {
      if (r.answer) {
        const qs = r.answer.match(/[^.]*\?/g);
        if (qs) faqs.push(...qs);
      }
    }
    return [...new Set(faqs)].slice(0, 8);
  }

  _extractCompetitors(results) {
    const seen = new Set();
    const competitors = [];
    for (const r of results) {
      for (const s of r.results) {
        const domain = s.url ? new URL(s.url).hostname.replace('www.', '') : '';
        if (domain && !seen.has(domain) && !domain.includes('google') && !domain.includes('youtube')) {
          seen.add(domain);
          competitors.push({ domain, title: s.title, url: s.url });
        }
      }
    }
    return competitors.slice(0, 6);
  }

  _extractAngle(results) {
    const votes = {};
    for (const r of results) {
      if (r.answer) {
        const firstSentence = r.answer.split('.')[0];
        if (firstSentence) {
          const key = firstSentence.substring(0, 100);
          votes[key] = (votes[key] || 0) + 1;
        }
      }
    }
    const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
    return best ? best[0] : `Comprehensive guide on ${results[0]?.query || topic}`;
  }

  async researchWithFallback(topic) {
    console.log(`[Research Agent] Using Gemini fallback for: ${topic}`);

    const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
    const { PromptTemplate } = await import('@langchain/core/prompts');
    const { RunnableSequence } = await import('@langchain/core/runnables');
    const { StringOutputParser } = await import('@langchain/core/output_parsers');
    const { getGeminiKey } = await import('./gemini-keys.js');

    const llm = new ChatGoogleGenerativeAI({
      apiKey: getGeminiKey(),
      modelName: 'gemini-2.0-flash',
      temperature: 0.5,
    });

    const prompt = PromptTemplate.fromTemplate(`
You are a research analyst. Research the following topic and provide structured insights.

TOPIC: {topic}

Provide a comprehensive research report covering:
1. Key statistics and data points about {topic}
2. Current trends and forecasts
3. Best practices and strategies
4. Common challenges and solutions
5. Case studies and success stories
6. Frequently asked questions

Return in JSON:
{{
  "summary": "detailed research summary (500+ words)",
  "statistics": ["stat 1", "stat 2", "stat 3", ...],
  "trends": ["trend 1", "trend 2", ...],
  "bestPractices": ["practice 1", "practice 2", ...],
  "challenges": ["challenge 1", "challenge 2", ...],
  "faqs": ["Question 1?", "Question 2?", ...],
  "competitors": ["competitor domain 1", "competitor domain 2", ...]
}}
`);

    const chain = RunnableSequence.from([prompt, llm, new StringOutputParser()]);
    const result = await chain.invoke({ topic });

    try {
      const cleaned = result.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        topic,
        combinedInsights: `${parsed.summary}\n\nStatistics:\n${(parsed.statistics || []).join('\n')}\n\nTrends:\n${(parsed.trends || []).join('\n')}\n\nBest Practices:\n${(parsed.bestPractices || []).join('\n')}`,
        rawResults: [{ query: topic, answer: parsed.summary, results: [] }],
        statistics: parsed.statistics || [],
        faqs: parsed.faqs || [],
        competitors: (parsed.competitors || []).map(d => ({ domain: d, title: d, url: `https://${d}` })),
        suggestedAngle: parsed.summary?.split('.')[0] || `Guide on ${topic}`,
      };
    } catch {
      return {
        topic,
        combinedInsights: result,
        rawResults: [{ query: topic, answer: result.substring(0, 500), results: [] }],
        statistics: [],
        faqs: [],
        competitors: [],
        suggestedAngle: `Guide on ${topic}`,
      };
    }
  }

  async researchExistingContent(section = 'automme') {
    console.log(`[Research Agent] Analyzing existing content for ${section}`);

    const { supabase } = await import('../supabase.js');
    const { data: posts } = await supabase
      .from('posts')
      .select('id, title, slug, category, created_at')
      .eq('section', section)
      .order('created_at', { ascending: false })
      .limit(50);

    const categories = {};
    const recentTitles = [];
    for (const p of posts || []) {
      categories[p.category] = (categories[p.category] || 0) + 1;
      recentTitles.push({ title: p.title, id: p.id, slug: p.slug, category: p.category });
    }

    const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'AI & Automation';

    const categoryKeywords = {
      'AI Systems': ['AI workflow', 'machine learning', 'intelligent automation'],
      'Operations AI': ['process automation', 'operational efficiency', 'workflow optimization'],
      'AI News': ['AI industry', 'automation trends', 'tech news'],
      'Marketing & Content': ['content marketing', 'AI writing', 'SEO automation'],
      'Scaling Strategy': ['business growth', 'scale operations', 'AI scaling'],
    };

    return {
      totalPosts: posts?.length || 0,
      topCategory,
      categoryDistribution: categories,
      recentTitles: recentTitles.slice(0, 10),
      categoryKeywords: categoryKeywords[topCategory] || ['AI', 'automation', 'business'],
    };
  }
}
