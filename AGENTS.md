# Automme Website — Agentic Coding Guide

## Build / Run / Test Commands

```bash
# Server (AI Agents backend)
cd server && npm install && npm start   # Start Express server on :3001
cd server && npm run dev                # Start with --watch (auto-reload)
cd server && node run-generate.js       # CLI: generate one blog post
cd server && node run-generate.js "topic" "section"
cd server && npm run schedule           # Run scheduler manually

# Root
npm run ai-server    # = node server/index.js
npm run ai-generate  # = node server/run-generate.js

# No testing framework exists. Package.json test: echo "no test specified"
```

## Project Structure

```
/                       — Static website (40+ industry HTML pages, vanilla JS)
├── admin.html           — Admin SPA (Supabase Auth, article editor, AI dashboard)
├── blog.html / post.html — Blog listing + single post view
├── index.html           — Landing page
├── css/style.css        — Single stylesheet (CSS custom properties, dark theme)
├── docs/                — SEO/marketing skill files for AI agents
├── images/              — Static assets
└── server/              — Express + LangGraph AI Agent backend (ES Modules)
    ├── index.js         — Entry: Express API (14 endpoints)
    ├── agents/          — LangGraph multi-agent pipeline
    │   ├── orchestrator.js   — State machine (Research → SEO → Write → Edit → Save)
    │   ├── research-agent.js — Tavily web search + Gemini fallback
    │   ├── seo-agent.js      — Gemini-based keyword/SERP analysis (temp 0.3)
    │   ├── writer-agent.js   — Gemini blog writer (temp 0.5, 8192 tokens)
    │   ├── editor-agent.js   — Gemini editor/polisher (temp 0.2, 8192 tokens)
    │   └── gemini-keys.js    — Key rotation across GEMINI_API_KEY, _KEY1, _KEY2
    ├── supabase.js      — Supabase client + DB helpers (posts, topics, config)
    ├── scheduler.js     — Cron-based scheduled generation (node-cron)
    └── render.yaml      — Render.com deployment config
```

## Module System

- **Server** (`server/`): ES Modules (`"type": "module"`). Always use `.js` extension on local imports: `import './agents/file.js'`
- **Root**: CommonJS (`"type": "commonjs"`). Root has no runtime JS — only npm script wrappers.
- **Frontend**: Vanilla JS via `<script>` tags in HTML files. No bundlers, no frameworks.

## Code Style Guidelines

### Naming
- **Files**: kebab-case (`research-agent.js`, `editor-agent.js`)
- **Classes**: PascalCase (`AgentOrchestrator`, `ResearchAgent`)
- **Functions/vars**: camelCase (`getGeminiKey`, `finalTopic`, `tavilyApiKey`)
- **Constants/Env**: UPPER_SNAKE_CASE (`SUPABASE_URL`, `GEMINI_API_KEY`)
- **DB columns**: snake_case (`created_at`, `image_url`, `seo_score`)
- **Private methods**: underscore prefix (`_parseResult`, `updateProgress`)

### Imports — Order
1. Side-effect imports (`import 'dotenv/config'`)
2. Standard library / third-party (`express`, `cors`, `@langchain/...`)
3. Local modules (`'./agents/orchestrator.js'`, `'../supabase.js'`)

### Formatting
- No linter or formatter configured. Follow existing style:
  - 2-space indentation
  - Semicolons required
  - Single quotes for strings
  - Template literals with `${}` for interpolation
  - `const` / `let` only (no `var`)
  - Arrow functions for anonymous callbacks
  - `async/await` everywhere (no `.then()`)
  - Spread for state updates: `return { ...state, newField }`

### Error Handling
- Every route/agent method: try/catch with fallback data (never crash the pipeline)
- Supabase calls: `if (error) throw error` or `if (error) return null`
- LLM JSON parsing: wrap in try/catch, clean ```json markers first
- Express endpoints: return `res.status(500).json({ error: err.message })`
- Frontend: try/catch with user-facing toast messages, AbortSignal.timeout on fetches

### Agent Architecture (LangGraph Pipeline)
1. `research_existing` — Scan Supabase for existing posts (avoid overlap, find categories)
2. `research_web` — Tavily search (5 queries), fallback: Gemini generates research
3. `seo_analyze` — Gemini extracts keywords, titles, meta, intent, FAQ ideas
4. `write_content` — Gemini writes 2000-3000 word HTML blog post
5. `edit_content` — Gemini fact-checks, polishes, scores readability/SEO
6. `save_post` — Insert into Supabase `posts` table, mark topic as used

Each agent has an inline fallback in the orchestrator if the LLM call fails.

### Supabase Schema
- `posts` — Blog posts (title, content, slug, status, section, author, seo fields)
- `ai_topics` — User-provided topics (topic, status: pending|used, created_at)
- `ai_config` — Key-value config (ai_agent_enabled, schedule_days)
- RLS disabled on `ai_topics` and `ai_config` (anon key access from admin UI)

### Key Constraints
- Supabase anon key embedded in admin.html — do NOT commit `.env` files
- Gemini API supports rotation across 3 keys — add `GEMINI_API_KEY`, `GEMINI_API_KEY1`, `GEMINI_API_KEY2`
- Admin auth is Supabase email/password — public sign-up disabled, accounts created manually
- Server URL in admin dashboard defaults to `localhost:3001` — update via UI or change fallback in `admin.html:947`
