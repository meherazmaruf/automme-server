import 'dotenv/config';
import { AgentOrchestrator } from './agents/orchestrator.js';

const topic = process.argv[2] || 'AI automation for business growth';
const section = process.argv[3] || 'automme';

const tavilyApiKey = process.env.TAVILY_API_KEY;

if (!tavilyApiKey) {
  console.error('Error: Missing TAVILY_API_KEY.');
  console.error('Create a .env file based on .env.example with:');
  console.error('  TAVILY_API_KEY=tvly-...');
  process.exit(1);
}

const orchestrator = new AgentOrchestrator({ tavilyApiKey });

const result = await orchestrator.generateBlogPost(topic, section);

if (result.success) {
  console.log(`\nBlog post generated successfully!`);
  console.log(`Title: ${result.post.title}`);
  console.log(`View in admin dashboard.`);
  process.exit(0);
} else {
  console.error(`\nGeneration failed: ${result.error}`);
  process.exit(1);
}
