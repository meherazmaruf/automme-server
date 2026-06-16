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
