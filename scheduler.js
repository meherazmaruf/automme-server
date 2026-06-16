import cron from 'node-cron';
import { AgentOrchestrator } from './agents/orchestrator.js';
import { getNextPendingTopic, getConfig } from './supabase.js';

const DEFAULT_TOPICS = [
  'AI workflow automation for small businesses',
  'Business process automation strategies',
  'AI-powered marketing automation for agencies',
  'AI customer service automation best practices',
  'Intelligent document processing for enterprises',
  'AI data analytics for business growth',
  'AI sales automation and lead generation',
  'AI content creation and management',
  'AI automation for ecommerce operations',
  'AI HR and recruiting automation',
];

let cronTask = null;

function getCronExpression(days) {
  const d = parseInt(days) || 7;
  return `0 9 */${Math.max(1, Math.min(30, d))} * *`;
}

export async function runScheduledGeneration() {
  console.log('[Scheduler] Starting scheduled blog generation...');

  const enabled = await getConfig('ai_agent_enabled');
  if (enabled === 'false') {
    console.log('[Scheduler] AI Agent is disabled. Skipping generation.');
    return { success: false, error: 'AI Agent is disabled', disabled: true };
  }

  const tavilyApiKey = process.env.TAVILY_API_KEY;

  if (!tavilyApiKey) {
    console.error('[Scheduler] Missing TAVILY_API_KEY. Check .env file.');
    return { success: false, error: 'Missing TAVILY_API_KEY' };
  }

  const userTopic = await getNextPendingTopic();

  let topic;
  let topicId = null;

  if (userTopic) {
    topic = userTopic.topic;
    topicId = userTopic.id;
    console.log(`[Scheduler] Using user-provided topic: "${topic}"`);
  } else {
    const periodDays = parseInt(await getConfig('schedule_days')) || 7;
    const cycleNumber = Math.floor(Date.now() / (periodDays * 24 * 60 * 60 * 1000));
    const topicIndex = cycleNumber % DEFAULT_TOPICS.length;
    topic = DEFAULT_TOPICS[topicIndex];
    console.log(`[Scheduler] No user topics. Using default: "${topic}"`);
  }

  const periodDays = parseInt(await getConfig('schedule_days')) || 7;
  const cycleNumber = Math.floor(Date.now() / (periodDays * 24 * 60 * 60 * 1000));
  const section = cycleNumber % 2 === 0 ? 'automme' : 'marufai';

  const orchestrator = new AgentOrchestrator({ tavilyApiKey });
  const result = await orchestrator.generateBlogPost(topic, section, topicId);

  return result;
}

export async function restartScheduler() {
  if (cronTask) {
    cronTask.stop();
    console.log('[Scheduler] Previous cron stopped.');
  }

  const daysStr = await getConfig('schedule_days');
  const days = parseInt(daysStr) || 7;
  const expression = getCronExpression(days);

  cronTask = cron.schedule(expression, async () => {
    console.log(`[Scheduler] Cron triggered (every ${days} days) - starting generation...`);
    const result = await runScheduledGeneration();
    console.log('[Scheduler] Result:', result.success ? 'Success' : 'Failed', result.error || '');
  });

  console.log(`[Scheduler] Cron registered: every ${days} days at 9:00 AM (${expression})`);
  console.log('[Scheduler] Priority: User topics → Default list');
}

export function startScheduler() {
  console.log('[Scheduler] Initializing scheduling...');
  restartScheduler();
}
