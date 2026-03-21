# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⚡ QUICK START FOR EVERY SESSION

**Step 1**: Read `🎯 Master Tracker.md` → "Claude Session Handoff" section
**Step 2**: Check "What Claude Should Work On Next" for current priority
**Step 3**: If user doesn't specify work, suggest the Priority 1 task
**Step 4**: At session end, update Master Tracker and Daily Log

**Master Tracker Location**: `C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\🎯 Master Tracker.md`

---

## 🧠 Obsidian Knowledge Base (IMPORTANT - READ FIRST)

**This project has a comprehensive Obsidian "second brain"** that contains detailed documentation, architecture diagrams, roadmaps, agent profiles, and troubleshooting guides.

**Location**: `C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\`

### When to Read the Obsidian Brain

**ALWAYS check the Obsidian vault BEFORE answering questions about:**
- System architecture or how components connect
- Agent status, configuration, or troubleshooting
- Roadmap, current sprint, or what's being worked on
- Trading strategies and their parameters
- Database schema or API endpoints
- Deployment or environment setup
- Known issues and their fixes

### 🚨 START OF EVERY SESSION - READ MASTER TRACKER

**At the beginning of every new conversation**, Claude should:
1. **Read `🎯 Master Tracker.md`** - Check "Today's Focus" and "Active Projects"
2. **Identify the top priority** - What's the next uncompleted task?
3. **Check for blockers** - Anything preventing progress?
4. **Resume where we left off** - Continue the highest priority in-progress work

**If the user doesn't specify what to work on**, Claude should:
- Suggest the top priority from Master Tracker
- Explain briefly what the task involves
- Ask for confirmation before starting

### Key Pages to Reference

| Question Type | Read This File |
|---------------|----------------|
| **"What should we work on?"** | **`🎯 Master Tracker.md`** ⬅️ CHECK THIS FIRST |
| "What's the current status?" | `📊 Dashboard.md` |
| "How does X work?" | `System Architecture.md` |
| "What are we working on?" | `🎯 Master Tracker.md` → "Active Projects" |
| "What's due this week?" | `🎯 Master Tracker.md` → "This Week" |
| "How do agents work?" | `Agent System.md` |
| "Tell me about Pivot Pete" | `Pivot Pete.md` (and other agent files) |
| "What strategies exist?" | `Strategies Overview.md` |
| "Something is broken" | `Troubleshooting.md` |
| "What depends on what?" | `Connection Map.md` |
| "How do I control via API?" | `LLM Control API.md` |

### Updating the Brain

**When you make significant changes to the codebase:**
1. Update `🎯 Master Tracker.md` → Mark tasks complete, update progress %
2. Update `📅 Daily Log.md` → Add entry for work completed
3. Update `📊 Dashboard.md` status table if component status changes
4. Update `Roadmap.md` checkboxes for completed milestones

### End of Session Handoff

**Before ending a productive session**, Claude should:
1. **Update Master Tracker** → Mark completed tasks, update "In Progress" items
2. **Update Daily Log** → Log what was accomplished
3. **Set "Next Up"** → Clearly state what the next session should tackle
4. **Commit if appropriate** → `git commit` with descriptive message

### Quick Access Commands

```powershell
# Read the dashboard status
cat "C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\📊 Dashboard.md"

# Check current sprint
cat "C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\Current Sprint.md"

# Search across all docs
grep -r "keyword" "C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\"
```

---

## Project Overview

**SwjshAK (Swjsh Army Knife)** is an algorithmic trading platform focused on live market scanning, strategy execution, and trade journaling across multiple asset classes (Forex, Crypto, Options, Futures). The platform features autonomous trading agents with real-time monitoring and performance tracking.

**Design Philosophy**: "Cyber-Industrial" dark mode aesthetic with glassmorphism, electric cyan primary (`#06b6d4`), and neon purple accents (`#a855f7`).

## 🎮 Halo Crew — Discord Agent System

**The trading agents use Halo-themed personas** that communicate via Discord. Each persona has its own Discord bot (separate identity, avatar, name) but is powered by a single Claude session.

**Architecture:** Claude Code Channels (inbound) + Multi-bot Discord REST API (outbound)

| Persona | Bot | Role | Primary Channels |
|---------|-----|------|-----------------|
| **Chief** | Master Chief | Ops commander, briefings, decisions | #chief-announcements, #daily-standup |
| **Arbiter** | The Arbiter | Risk auditor, kill-switch, verification | #pulse-alerts, #grade-reviews |
| **Cortana** | Cortana | Trade grading, pattern analysis | #grade-reviews, #learn-patterns |
| **Scout** | Scout | Forex specialist (FXAlexG 5-Box) | #chief-announcements, #back-ideas |
| **Ops** | Ops | Crypto + Futures (zones + pivots) | #pulse-alerts, #infra-tasks |
| **Hunter** | Hunter | Options (SPY/QQQ + SPX 0DTE) | #infra-tasks, #infra-log |

### Key Files
- **Persona definitions:** `src/lib/discord/personas.ts`
- **Multi-bot sender:** `src/lib/discord/halo-bots.ts`
- **Notification system:** `src/lib/notifications/discord.ts`
- **Full personality/strategy docs:** `halo-crew/HALO_SOULS.md`
- **Cron job configs:** `halo-crew/cron-jobs-halo.json`
- **Bot setup/health check:** `scripts/halo-bot-setup.ts`
- **Env template:** `.env.halo-bots`

### Sending as a Persona
```typescript
import { sendEmbedAsPersona, sendAsPersona } from '@/lib/discord';

// Send a message as Cortana
await sendEmbedAsPersona('cortana', CHANNELS.GRADE_REVIEWS, {
    title: '🏆 Trade Grade: A',
    description: 'Clean entry, perfect R:R.',
});

// Auto-route by symbol
import { sendForSymbol } from '@/lib/discord';
await sendForSymbol('BTCUSD', channelId, embed); // → Ops
await sendForSymbol('GBPUSD', channelId, embed); // → Scout
await sendForSymbol('SPY',    channelId, embed); // → Hunter
```

### HW Discord Server
- **Server ID:** `1484377910503543068`
- **Bot tokens:** Stored in `.env.local` as `DISCORD_BOT_TOKEN_{CHIEF|ARBITER|SCOUT|CORTANA|OPS|HUNTER}`

---

## Jira Autonomous Agent System

The project now has a fully autonomous Jira agent system that self-learns, self-improves, and self-heals 24/7.

### Quick Start
```powershell
# Start the autonomous agent system
.\START_JIRA_AGENTS.ps1

# Or check status
python scripts/jira_agent_loop.py status
```

### In Claude Code Sessions
```
/jira-pickup SCRUM          # Pick up next issue
/orchestrate feature "..."   # Implement the feature
/learn                       # Extract patterns
python scripts/jira_complete.py <ISSUE_KEY> --pr <PR_URL> --learn
```

### 7 Jira Projects

| Key | Purpose | Agent Mode | Halo Persona |
|-----|---------|------------|--------------|
| SCRUM | Core development | AUTO | Ops |
| INFRA | Tech debt & automation | AUTO | Chief |
| PULSE | Health monitoring | AUTO | Arbiter |
| BACK | Research & ideas | AUTO | Scout |
| LEARN | Pattern aggregation (brain) | MANUAL | Cortana |
| GRADE | Trade grading | MANUAL | Cortana |
| MGMT | Cross-project sync | MANUAL | Chief |

### Key Files

| File | Purpose |
|------|---------|
| `scripts/jira_client.py` | Jira REST API client |
| `scripts/jira_agent_loop.py` | Autonomous loop runner |
| `scripts/jira_complete.py` | Issue completion handler |
| `data/jira-agents.json` | Agent configurations |
| `.claude/plan/jira-agent-loop.json` | Loop config with self-healing |
| `~/.claude/commands/jira-pickup.md` | Issue pickup command |

### Self-Learning System

After completing work:
1. `/learn` extracts patterns into instincts
2. Instincts saved to `~/.claude/homunculus/projects/{PROJECT}/instincts/`
3. LEARN project aggregates all instincts
4. Weekly `/evolve` generates reusable skills
5. Skills shared across all agents

### Jira URL
https://swjshalgoknife.atlassian.net/

---

## 🔄 Autonomous Improvement System (Jira-Connected)

The system autonomously improves itself via 6 Jira-connected agents, one per project. Each agent runs an eval→identify→fix→ticket→learn cycle every 2 minutes.

### Architecture

```
agent_runner.ts spawns → run_improvement_agents.py
  ├── InfraAgent  (INFRA project) — tech debt, code quality, deps
  ├── PulseAgent  (PULSE project) — heartbeat, monitoring, alerting
  ├── LearnAgent  (LEARN project) — brain freshness, learning loops
  ├── GradeAgent  (GRADE project) — trade grading pipeline
  ├── BackAgent   (BACK project)  — backlog, new features
  └── MgmtAgent   (MGMT project)  — cross-agent coordination
```

### Key Files
- `scripts/jira_client.py` — Jira REST API client (encrypted creds from `~/.swjsh/`)
- `scripts/pr_utils.py` — PR creation with auto Jira link formatting
- `scripts/improvement_agent_base.py` — Base class with eval→ticket→fix→close cycle
- `scripts/run_improvement_agents.py` — 6 threaded agents, one per Jira project
- `scripts/wire_n8n_jira.py` — Wire n8n credentials (Jira + Discord webhooks)
- `.github/PULL_REQUEST_TEMPLATE.md` — Standard PR template with Jira placeholder
- `skills/project-improvement/surgeon/eval_harness.ts` — Immutable scoring engine
- `skills/project-improvement/surgeon/learnings.md` — Cumulative knowledge base
- `skills/project-improvement/war-room/surgeon_queue.md` — Queued improvement plans
- `skills/project-improvement/gameplan-eval.ts` — Master autonomy plan scorecard

### Eval Constraints (4 immutable gates)
1. **DATA_FLOW** — Is data flowing smart and actionable?
2. **HEARTBEAT** — Is monitoring/alerting working via Discord?
3. **AGENT_LEARNING** — Are agents autonomously learning?
4. **EFFICIENCY** — Are we cost efficient and self-improving?

### Running the Improvement System
```bash
# Standalone test
python scripts/run_improvement_agents.py

# Via agent_runner (auto-managed with restart)
# Spawned automatically when agent_runner.ts starts

# Wire n8n credentials (one-time setup)
python scripts/wire_n8n_jira.py --api-key YOUR_N8N_API_KEY --activate
```

### Jira Instance
- **URL**: https://swjshalgoknife.atlassian.net
- **Projects**: MGMT, INFRA, PULSE, LEARN, GRADE, BACK
- **Credentials**: Encrypted at `~/.swjsh/` (AES-256 via `jira_creds.py`)

---

## Starting the System

**ONE command to start everything** — the system runs autonomously after launch:

```powershell
# Local Windows — starts Dashboard + Agent Runner via PM2
./START_SWJSH.ps1

# Docker / GCP — starts Dashboard + Agent Runner via supervisord
docker compose up -d
```

The Agent Runner (`scripts/agent_runner.ts`) is the master orchestrator. It spawns and manages ALL trading agents (Python + TypeScript) as child processes with auto-restart. **Do NOT run individual Python agents separately** — that causes duplicate agent instances.

### LLM Control API

After startup, control the system from any LLM chat via HTTP:

```bash
# Full system status
GET  http://localhost:3000/api/control

# Send commands
POST http://localhost:3000/api/control
  { "command": "summary" }                          # Daily P&L report
  { "command": "pause", "agentId": "boba" }         # Pause an agent
  { "command": "resume", "agentId": "boba" }        # Resume
  { "command": "killswitch" }                       # Emergency halt all
  { "command": "killswitch_reset" }                 # Resume after halt
```

### Development Commands
```bash
npm run dev          # Next.js dev server (localhost:3000)
npm run build        # Production build
npm start            # Production server (dashboard only)
npx tsx scripts/agent_runner.ts  # Agent runner (dev, standalone)
```

## Architecture

### Frontend (Next.js 15 App Router)
- **Styling**: Vanilla CSS Modules with HSL variable system (see `src/app/globals.css`)
- **State**: No global state library - relies on React Context for real-time data feeds
- **Charts**: `lightweight-charts` (TradingView open-source) for canvas-based rendering

**Component Structure**:
```
src/components/
  Layout/         # Sidebar, Header (app-wide chrome)
  Dashboard/      # TradingChart, ActiveSignals, StrategyPanel
  Journal/        # TradeList, EntryForm, AnalyticsHeader
  Agents/         # AgentTerminal (autonomous agent UI)
  UI/             # GlassPanel, LogoIcon, ThemeToggle
```

### Backend Architecture

**Database**: SQLite (`better-sqlite3`) with 4 core tables:
- `trades`: Entry/exit records with PnL tracking
- `signals`: Incoming webhook alerts from TradingView or strategies
- `journal_entries`: Daily notes and mood logs
- `settings`: Key-value configuration store

**API Routes** (Next.js):
- `/api/webhook/tradingview` - Receives TradingView alerts (requires `X-Webhook-Secret` header matching `WEBHOOK_SECRET` env var)
- `/api/signals` - Manual signal submission
- `/api/journal` - CRUD for trades and journal entries
- `/api/agents/*` - Agent status and chat endpoints

**Autonomous Agent System**: Hybrid TypeScript + Python architecture
- `scripts/agent_runner.ts` - Main orchestrator spawning Python subprocesses
- `src/lib/engine/local_runner/` - TypeScript core engine (MarketData, StrategyLoop, TheProfessor, TheAuditor)
- `scripts/*_engine.py` - Python market-specific agents (Pivot Pete for futures, Boba for options, SPX Sniper)
- Communication: Python agents output `AGENT_STATUS_UPDATE:{json}` to stdout, parsed by TypeScript runner
- Agent state stored in `src/app/api/agents/agents_db.json`

### Strategy System

**Base Class**: All strategies extend `BaseStrategy` (`src/lib/engine/types.ts`)

**Market Categories**: `OPTIONS`, `CRYPTO`, `FOREX`, `FUTURES`

**Implemented Strategies** (`src/lib/engine/strategies/`):
- **ORB (Opening Range Breakout)**: Futures/ES - Tracks first 15m of session
- **NeverStoppedOut**: Advanced ORB variant with wide-range detection and HTF bias
- **Support/Resistance**: Multi-market zone-based reversals
- **VWAP Reversion**: Mean reversion from institutional anchors
- **Bollinger Band Breakout**: Squeeze detection and volatility expansion
- **Three Ducks**: Forex trend-following (4H/1H/5M alignment)
- **Grid Trading**: Range-bound profit stacking

**Strategy Manager**: `src/lib/engine/manager.ts` - Central registry with category filtering

**Adding New Strategies**:
1. Create file in `src/lib/engine/strategies/`
2. Extend `BaseStrategy`, implement `onCandle()` and `onTick()`
3. Register in `EngineManager` constructor with appropriate `category`

### Risk Management

`src/lib/engine/risk.ts` - Position sizing based on account balance and risk-per-trade percentage

`src/lib/engine/executor.ts` - Signal processing and trade execution interface

## Environment Variables

Required for production webhook authentication:
```
WEBHOOK_SECRET=your_secret_here
ACCOUNT_BALANCE=10000
RISK_PER_TRADE=1
```

## Data Flow

1. **Market Data** → TradingView alerts → `/api/webhook/tradingview` → SQLite `signals` table
2. **Strategy Evaluation** → `StrategyLoop.processTick()` → Signal generation → `agents_db.json` state update
3. **Trade Execution** → TradeExecutor → `trades` table → Performance tracking
4. **Review System** → TheProfessor grades closed trades → TheAuditor fact-checks → `agents_db.json` reviews/audits arrays

## Key Files to Know

- `src/lib/db.ts` - Database initialization and schema
- `src/lib/engine/manager.ts` - Strategy registry
- `scripts/agent_runner.ts` - Multi-agent orchestration
- `src/app/agents/page.tsx` - Real-time agent dashboard
- `src/lib/scanner/engine.ts` - Pre-market opportunity scanner

## Python Dependencies

Agents require specific packages (see `scripts/requirements_*.txt` for agent-specific deps):
- `yfinance` - Market data fetching
- `pandas` - Data manipulation
- `requests` - API calls

## Development Notes

- Database is auto-initialized on first run via `initDB()` in `src/lib/db.ts`
- Simulation loop in `EngineManager.start()` is disabled by default to prevent noise during live testing
- Agent processes auto-restart after 30s if they crash (see `agent_runner.ts`)
- All timestamps use ISO 8601 format
- PnL calculations assume BTC positions are in dollars, FX positions use standard lot sizing (100k units)

## Design System Variables

Core colors defined in `src/app/globals.css`:
```css
--background: 222 47% 11%;           /* Deep gunmetal */
--brand-primary: 188 95% 43%;        /* Electric cyan */
--accent-neon: 271 77% 62%;          /* Neon purple */
```

Glassmorphic surfaces: `backdrop-filter: blur(12px)` with translucent backgrounds

---

## ⚠️ Web Research Guardrails (READ BEFORE ANY CONFIG WORK)

**Jack has granted unrestricted URL browsing. Do NOT abuse this trust.**

These rules apply any time I use web search or WebFetch to research configuration schemas, API formats, library options, or deployment steps — especially for third-party tools like OpenClaw, PM2, Docker, broker APIs, etc.

### Source Hierarchy — Always Prefer in This Order

1. **Official source code** (GitHub repo `*.ts`/`*.js` schema/validation files) — ground truth
2. **Official docs** (`docs.[tool].ai`, `[tool].io/docs`) — read the actual page, not a search summary
3. **Official GitHub README** or `*.example` config files in the repo
4. **Verified GitHub issues** where maintainers (not users) confirm correct behavior
5. **Community posts, DeepWiki, third-party guides** — treat as HINTS ONLY, always verify

**Never apply a config change based solely on an AI-summarized search snippet.** Search result summaries can hallucinate field names, invent required properties, or describe outdated versions.

### Mandatory Verification Steps for Config Changes

Before writing any config file based on web research:

1. **Find the actual schema validator** — search the tool's GitHub for Zod/Joi/Yup schema files (e.g. `grep -r "z.object" src/`) and read the field definitions directly
2. **Find a `.example` config** in the official repo — copy its structure, don't invent it
3. **Cross-reference 2+ sources** before adding any field marked as "required" by a search result
4. **Validate JSON before deploying** — run `python3 -m json.tool config.json` or equivalent
5. **If docs are blocked by egress proxy** — say so clearly, ask Jack to check the docs himself before proceeding, rather than guessing from search summaries

### OpenClaw-Specific Trusted Sources

- Schema: `https://github.com/openclaw/openclaw` → search for Zod validation in `src/`
- Config examples: `https://github.com/openclaw/openclaw` → look for `openclaw.json.example`
- Bindings format confirmed working (March 2026): `type: "acp"`, `match.peer.kind: "channel"`, `match.peer.id: "<snowflake>"`
- Anthropic provider confirmed working (March 2026): requires `baseUrl`, `apiKey`, and `models[]` array with model objects (`id`, `name`, `api`, `contextWindow`, `maxTokens`) — `inputTypes` is NOT a valid field, do not include it
- Gateway confirmed working (March 2026): requires `"mode": "local"` — without it the gateway refuses to start with "Gateway start blocked: set gateway.mode=local (current: unset)"
- Cron jobs confirmed in separate file: `~/.openclaw/cron/jobs.json` (NOT inside `openclaw.json`)

### Red Flags — Stop and Verify With Jack

- A search result says a field is "required" but no source code or example file confirms it
- The official docs domain is blocked by egress proxy and the only info comes from search summaries
- A config produces validation errors even after applying web-researched fixes
- I'm on the 3rd+ iteration of the same config section without finding an authoritative source

### What to Say Instead of Guessing

If I can't find authoritative confirmation:
> "I can see the field exists in community examples but I can't verify it against the actual schema validator. I'd recommend checking [exact URL] yourself before we deploy this."
