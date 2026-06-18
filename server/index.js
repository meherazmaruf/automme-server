import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { AgentOrchestrator, getProgress } from './agents/orchestrator.js';
import { supabase, getConfig, setConfig, getTopics, addTopic, deleteTopic, getNextPendingTopic } from './supabase.js';
import { startScheduler, runScheduledGeneration, restartScheduler } from './scheduler.js';
import { getGeminiKey } from './agents/gemini-keys.js';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Generate ─────────────────────────────────────────────────

const IDEA_TOPICS = [
  'small business automation', 'AI customer support', 'marketing automation',
  'sales pipeline automation', 'HR automation tools', 'ecommerce automation',
  'real estate automation', 'healthcare automation', 'accounting automation',
  'social media automation', 'email marketing automation', 'lead generation automation',
  'workflow automation', 'document processing automation', 'data analytics automation',
  'inventory management automation', 'CRM automation', 'ERP automation',
  'cybersecurity automation', 'compliance automation',
];

async function generateIdea(existingTopic) {
  try {
    const llm = new ChatGoogleGenerativeAI({
      apiKey: getGeminiKey(),
      modelName: 'gemini-2.0-flash',
      temperature: 0.9,
    });
    const prompt = PromptTemplate.fromTemplate(`Suggest ONE unique blog topic idea about AI business automation.

Pick a specific niche or industry. Be creative and specific. Return only the topic title, nothing else.

Previous/current topic to avoid: "{existingTopic}"
Do NOT repeat that. Suggest something different.`);
    const chain = RunnableSequence.from([prompt, llm, new StringOutputParser()]);
    const result = await chain.invoke({ existingTopic });
    return result.replace(/["""]/g, '').trim();
  } catch {
    return IDEA_TOPICS[Math.floor(Math.random() * IDEA_TOPICS.length)];
  }
}

app.post('/api/generate', async (req, res) => {
  try {
    const { topic, section = 'automme' } = req.body;
    const tavilyApiKey = process.env.TAVILY_API_KEY || '';

    let finalTopic = topic;
    let topicId = null;

    if (!finalTopic) {
      const pending = await getNextPendingTopic();
      if (pending) {
        finalTopic = pending.topic;
        topicId = pending.id;
        console.log(`[Server] Using user topic: "${finalTopic}"`);
      } else {
        finalTopic = await generateIdea('');
        console.log(`[Server] Generated idea: "${finalTopic}"`);
      }
    }

    const orchestrator = new AgentOrchestrator({ tavilyApiKey });
    const result = await orchestrator.generateBlogPost(finalTopic, section, topicId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/progress/:runId', (req, res) => {
  const progress = getProgress(req.params.runId);
  if (!progress) return res.json({ error: 'No progress found' });
  res.json(progress);
});

// ─── Topics ────────────────────────────────────────────────────

app.get('/api/topics', async (req, res) => {
  try {
    const topics = await getTopics();
    res.json(topics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/topics', async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: 'Topic is required' });
    }
    const saved = await addTopic(topic);
    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/topics/:id', async (req, res) => {
  try {
    await deleteTopic(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Config ────────────────────────────────────────────────────

app.get('/api/config', async (req, res) => {
  try {
    const { data, error } = await supabase.from('ai_config').select('*');
    if (error) throw error;
    const config = {};
    for (const item of data || []) config[item.key] = item.value;
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Key is required' });
    await setConfig(key, value);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── AI-Generated Posts ────────────────────────────────────────

app.get('/api/posts/ai', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('author', 'Maruf AI')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── AI Agent ON/OFF ──────────────────────────────────────────

app.get('/api/agent/status', async (req, res) => {
  try {
    const enabled = await getConfig('ai_agent_enabled');
    res.json({ enabled: enabled !== 'false' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/agent/toggle', async (req, res) => {
  try {
    const { enabled } = req.body;
    await setConfig('ai_agent_enabled', enabled ? 'true' : 'false');
    console.log(`[Server] AI Agent ${enabled ? 'ENABLED' : 'DISABLED'}`);
    res.json({ success: true, enabled });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Schedule ──────────────────────────────────────────────────

app.post('/api/schedule/trigger', async (req, res) => {
  try {
    const result = await runScheduledGeneration();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/schedule', async (req, res) => {
  try {
    const days = await getConfig('schedule_days');
    res.json({ days: parseInt(days) || 7 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/schedule', async (req, res) => {
  try {
    const { days } = req.body;
    const d = parseInt(days);
    if (!d || d < 1 || d > 30) {
      return res.status(400).json({ error: 'Days must be between 1 and 30' });
    }
    await setConfig('schedule_days', String(d));
    restartScheduler();
    res.json({ success: true, days: d });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Start ────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Automme AI Agent Server`);
  console.log(`  Server running on http://localhost:${PORT}`);
  console.log(`  Endpoints:`);
  console.log(`    POST /api/generate         - Generate blog post`);
  console.log(`    GET  /api/topics           - List user topics`);
  console.log(`    POST /api/topics           - Add a topic`);
  console.log(`    DELETE /api/topics/:id     - Remove topic`);
  console.log(`    GET  /api/config           - Get config`);
  console.log(`    POST /api/config           - Update config`);
  console.log(`    GET  /api/posts/ai         - AI-generated posts`);
  console.log(`    POST /api/schedule/trigger - Force run`);
  console.log(`    GET  /api/agent/status     - AI Agent ON/OFF status`);
  console.log(`    POST /api/agent/toggle     - Toggle AI Agent`);
  console.log(`========================================\n`);

  startScheduler();

  if (process.env.RUN_ON_START === 'true') {
    console.log('[Startup] Running initial generation...');
    runScheduledGeneration();
  }
});
