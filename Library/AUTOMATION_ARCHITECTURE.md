# SwjshAK Automation Architecture

**Created**: 2026-03-19
**Purpose**: Single comprehensive document explaining how all automation pieces connect
**Audience**: Jack (and future Claude sessions)

---

## Executive Summary

You have **5 automation tools** that work together:

| Tool | What It Is | What It Does | Your Knowledge |
|------|------------|--------------|----------------|
| **n8n** | Visual workflow automation (like Zapier) | Connects services, triggers actions, schedules tasks | None (Claude handles it) |
| **OpenClaw** | AI agent orchestration (Claude wrapper) | Runs autonomous AI agents on schedules or triggers | Moderate |
| **Discord** | Communication hub | Receives alerts, sends commands, human interface | Familiar |
| **Jira** | Project/task tracking | Tracks tickets, sprints, learnings, incidents | Some knowledge |
| **SwjshAK** | Your trading system | Executes trades, manages agents, stores data | Expert |

**The key insight**: n8n is the **glue** that connects everything. OpenClaw is the **brain** that thinks. Discord is the **interface** you interact with. Jira is the **memory** for long-term tracking.

---

## How It All Connects

```
                                    ┌─────────────────────────────────────────────────┐
                                    │                   YOU (Jack)                     │
                                    │                                                  │
                                    │  "Hey, why did we lose on BTC yesterday?"       │
                                    │  "Pause Sterling FX"                            │
                                    │  "What's today's P&L?"                          │
                                    └─────────────────────────┬───────────────────────┘
                                                              │
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    DISCORD                                               │
│                                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   #chief     │    │   #alerts    │    │   #trades    │    │   #system    │          │
│  │  (commands)  │    │  (warnings)  │    │  (execution) │    │  (health)    │          │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘          │
│         │                   │                   │                   │                   │
│         └───────────────────┴───────────────────┴───────────────────┘                   │
│                                         │                                                │
│                              Discord Webhooks (outbound)                                 │
│                              Discord Bot (inbound commands)                             │
└─────────────────────────────────────────┬───────────────────────────────────────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ▼                     ▼                     ▼
┌───────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────────┐
│         n8n               │  │       OPENCLAW            │  │        JIRA               │
│   (Workflow Engine)       │  │   (AI Agent Brain)        │  │   (Task Memory)           │
│                           │  │                           │  │                           │
│ • Schedules tasks         │◄─┤ • Chief (decisions)       │  │ • MGMT (coordination)     │
│ • Connects APIs           │  │ • Arbiter (grading)       │  │ • LEARN (patterns)        │
│ • Transforms data         │──┤ • Developer (code)        │  │ • GRADE (trade reviews)   │
│ • Routes signals          │  │ • Overseer (monitoring)   │  │ • PULSE (incidents)       │
│ • Sends alerts            │  │ • Trading Agents          │  │ • INFRA (improvements)    │
│                           │  │                           │  │ • BACK (backlog)          │
└───────────┬───────────────┘  └───────────┬───────────────┘  └───────────┬───────────────┘
            │                              │                              │
            └──────────────────────────────┼──────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    SWJSHAK                                               │
│                              (Your Trading System)                                       │
│                                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐                  │
│  │   Trading APIs   │    │   Local Backend  │    │    Databases     │                  │
│  │                  │    │                  │    │                  │                  │
│  │ • Alpaca         │    │ • /api/control   │    │ • journal.db     │                  │
│  │ • OANDA          │    │ • /api/trades    │    │ • agents_db.json │                  │
│  │ • Binance        │    │ • /api/signals   │    │ • settings       │                  │
│  │ • TradingView    │    │ • /api/agents    │    │                  │                  │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘                  │
│                                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐                  │
│  │                      TRADING AGENTS (Python)                     │                  │
│  │  • Bitcoin Bob    • Sterling FX    • Pivot Pete                  │                  │
│  │  • Boba Trades    • SPX Sniper                                   │                  │
│  └──────────────────────────────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Deep Dives

### 1. n8n — The Workflow Engine

**What it is**: n8n is like Zapier or IFTTT, but self-hosted and more powerful. It's a visual tool for creating "workflows" — automated sequences of actions triggered by events.

**Why you need it**:
- Connects services that don't natively talk to each other
- Runs tasks on schedules (cron jobs with a UI)
- Transforms data between formats
- Handles errors and retries automatically

**You don't touch n8n directly**. Claude builds workflows via the n8n MCP (Model Context Protocol). You describe what you want, Claude creates the workflow JSON and deploys it.

**Example workflow**:
```
Trigger: Every day at 4:30 PM ET
  │
  ├─► GET /api/trades (today's trades)
  │
  ├─► Calculate P&L, win rate, best/worst trade
  │
  ├─► POST to Discord #chief (formatted embed)
  │
  └─► Update Master Tracker (brain file)
```

**Current status**: n8n is installed on Contabo VPS, wiped clean, ready for workflows.

---

### 2. OpenClaw — The AI Brain

**What it is**: OpenClaw is a framework for running persistent Claude AI agents. Each agent has:
- A SOUL.md file (personality, rules, goals)
- Cron jobs (scheduled wake-ups)
- Webhooks (external triggers)
- Memory (files they can read/write)

**Your agents**:

| Agent | Purpose | Triggers |
|-------|---------|----------|
| **Chief** | High-level decisions, routing | 30-min cron, Discord commands |
| **Arbiter** | Grades trades, provides feedback | Trade closed event |
| **Hunter** | Autonomous code improvements | GitHub issues, daily cron |
| **Ops** | Risk monitoring, safety checks | Continuous |
| **Trading Agents** | Market analysis, signal generation | Market hours cron |

**Key concept**: OpenClaw agents are **autonomous**. Once configured, they wake up on schedule, do their work, and go back to sleep. You interact via Discord.

**Current status**: OpenClaw runs on Contabo, has existing agents configured.

---

### 3. Discord — The Human Interface

**What it is**: Your communication hub. All alerts, commands, and status updates flow through Discord.

**Discord has two connection types**:

#### A. Webhooks (Outbound — n8n/OpenClaw → Discord)

**What they are**: URLs that accept POST requests and create messages.

**You already have webhooks for**:
- #chief channel
- #alerts channel
- #trades channel (probably)

**How to get a webhook URL**:
1. Discord Server Settings → Integrations → Webhooks
2. Create webhook for each channel
3. Copy URL (looks like: `https://discord.com/api/webhooks/12345/abcdef...`)
4. Store in n8n credentials

**n8n uses webhooks to**:
- Send trade alerts
- Post daily reports
- Notify about errors
- Deliver agent messages

#### B. Bot (Inbound — Discord → n8n/OpenClaw)

**What it is**: A bot that listens for messages and triggers actions.

**Use cases**:
- `@Chief pause Sterling` → Calls /api/control to pause agent
- `@Chief what's P&L?` → Queries database, responds with stats
- `@Chief approve PR #123` → Triggers GitHub merge

**Current status**: Webhook credentials exist in n8n. Bot may need setup for inbound commands.

---

### 4. Jira — The Task Memory

**What it is**: Project management for tracking work items, incidents, and learnings.

**Your Jira projects**:

| Project | Key | Purpose | Used By |
|---------|-----|---------|---------|
| **Management Hub** | MGMT | Cross-project coordination, team syncs | Chief, all agents |
| **OpenClaw Learning** | LEARN | Patterns, lessons, insights from trades | Arbiter, learning workflows |
| **Trade Grading** | GRADE | Arbiter's trade reviews | Arbiter |
| **System Heartbeat** | PULSE | Incidents, outages, health issues | Ops, health workflows |
| **Infrastructure** | INFRA | Tech improvements, automation tasks | Developer |
| **Product Backlog** | BACK | Ideas, future features | You, Chief |

**How Jira integrates**:

```
Trade closes with -$500 loss
        │
        ▼
n8n: Trigger Arbiter grading workflow
        │
        ▼
OpenClaw: Arbiter grades trade as "F"
        │
        ├─► n8n: Create GRADE ticket "Review trade #123: F grade, stop loss too tight"
        │
        └─► n8n: Create LEARN ticket "HYPOTHESIS: Wide stops improve win rate"
```

**Current status**: 6 projects created, 32 labels registered, ready for workflows.

---

### 5. SwjshAK — Your Trading System

**What it is**: The core trading platform you built.

**Key endpoints n8n will call**:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/control` | System status, kill switch state |
| `POST /api/control` | Send commands (pause, resume, killswitch) |
| `GET /api/agents` | List agent statuses |
| `GET /api/trades` | Query trade history |
| `POST /api/webhook/tradingview` | Receive TradingView signals |

**Key files n8n/OpenClaw will read/write**:
- `journal.db` — Trade history
- `agents_db.json` — Agent states
- `data/brain/*.md` — Agent memory files
- Obsidian vault files — Master Tracker, Daily Log

---

## Data Flow Examples

### Example 1: Daily End-of-Day Report

```
┌─────────────────────────────────────────────────────────────────────┐
│  4:30 PM ET — n8n cron triggers WF-007: EOD Report                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  n8n: GET http://localhost:3000/api/trades?date=today               │
│       GET http://localhost:3000/api/control                         │
│       GET http://localhost:3000/api/agents                          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  n8n: Calculate metrics                                              │
│       • Total P&L: +$127.50                                         │
│       • Trades: 5 (3W/2L)                                           │
│       • Win Rate: 60%                                               │
│       • Best: SPX Sniper +$89                                       │
│       • Worst: Sterling FX -$42                                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │  Discord    │ │  Brain      │ │  Jira       │
            │  #chief     │ │  Daily Log  │ │  (if needed)│
            │  embed      │ │  update     │ │             │
            └─────────────┘ └─────────────┘ └─────────────┘
```

### Example 2: Trade Closed → Arbiter Grading → Learning

```
┌─────────────────────────────────────────────────────────────────────┐
│  Bitcoin Bob closes trade: BTC-USD LONG, -$180 loss                 │
│  Reason: Stop loss hit                                              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SwjshAK: POST internal webhook to n8n (trade closed event)         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  n8n: WF-021 Trade Grading Pipeline                                  │
│       Prepare context: entry/exit prices, duration, market conds    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  n8n: POST http://localhost:3001/hooks/agent                         │
│       { "agentId": "professor",                                      │
│         "message": "Grade trade #456: BTC-USD LONG, -$180..." }     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  OpenClaw Arbiter: Analyzes trade                                    │
│       "Grade: D. Stop loss was too tight for BTC volatility.        │
│        ATR was 2.1%, stop was at 0.8%. Recommendation: Use          │
│        1.5x ATR for crypto stops."                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┬───────────────┐
                    ▼               ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │  Discord    │ │  journal.db │ │  Jira GRADE │ │  Jira LEARN │
            │  #trades    │ │  grade: D   │ │  "Review    │ │  "PATTERN:  │
            │  feedback   │ │             │ │  trade #456"│ │  ATR stops" │
            └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

### Example 3: You Send Discord Command

```
┌─────────────────────────────────────────────────────────────────────┐
│  You in Discord #chief: "@Chief pause Sterling"                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Discord Bot: Detects @Chief mention, parses command                 │
│  (OR: n8n webhook receives message via Discord integration)         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  n8n: WF-046 Natural Language Command Handler                        │
│       Parse intent: "pause agent" + "Sterling"                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  n8n: POST http://localhost:3000/api/control                         │
│       { "command": "pause", "agentId": "sterling_fx" }              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SwjshAK: Pauses Sterling FX agent                                   │
│  Returns: { "success": true, "status": "paused" }                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  n8n: POST to Discord webhook                                        │
│       "✅ Sterling FX paused. Use 'resume Sterling' to restart."    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## What's Built vs What's Planned

### Built (Ready to Use)

| Component | Status | Location |
|-----------|--------|----------|
| n8n server | ✅ Running | Contabo VPS, port 5678 |
| n8n-mcp (Claude control) | ✅ Configured | Claude Code settings |
| Jira projects | ✅ Created | swjshalgoknife.atlassian.net |
| Jira credentials | ✅ Encrypted | ~/.swjsh/ |
| Discord webhooks | ✅ Exist | n8n credentials store |
| OpenClaw agents | ✅ Configured | Contabo VPS |
| SwjshAK APIs | ✅ Working | localhost:3000 |

### Planned (Documented, Not Built)

| Component | Document | Workflows |
|-----------|----------|-----------|
| 47 n8n workflows | N8N_ULTIMATE_AUTOMATION_PLAN.md | WF-001 to WF-047 |
| Workflow improvements | N8N_SUGGESTED_IMPROVEMENTS.md | 48 enhancements |
| Advanced workflow ideas | Library/n8n_Advanced_Workflow_Ideas.md | 11 concepts |
| OpenClaw webhooks | OPENCLAW_WEBHOOK_SPRINT_PLAN.md | Developer agent, crons |

---

## Implementation Phases

### Phase 0: Foundation (Current)
- [x] n8n installed and accessible
- [x] n8n-mcp configured for Claude
- [x] Jira projects created
- [x] Discord webhooks exist
- [x] Documentation complete

### Phase 1: Core Workflows (Week 1)
Build the essential 12 workflows:
1. **Health monitoring** — System heartbeat, agent status
2. **Daily reports** — Morning briefing, EOD summary
3. **Brain sync** — Master Tracker updates, Daily Log entries

### Phase 2: Trading Workflows (Week 2)
Build signal and trade lifecycle:
1. **Signal routing** — TradingView → agents
2. **Trade monitoring** — Position tracking, P&L
3. **Arbiter grading** — Trade evaluation pipeline

### Phase 3: Intelligence (Week 3)
Build intel collectors:
1. **Free data feeds** — Fear/Greed, VIX, funding rates
2. **Intel aggregation** — Confluence scoring
3. **Calendar parsing** — Economic events

### Phase 4: Self-Healing (Week 4)
Build reliability:
1. **Error handling** — Centralized recovery
2. **Failover** — Broker switching, data feed backup
3. **Learning loops** — Pattern detection

### Phase 5: Advanced (Week 5+)
Build sophisticated automation:
1. **Claude API integration** — AI-powered analysis
2. **GitHub automation** — Developer agent workflows
3. **Jira ticket automation** — Auto-triage, escalation

---

## How to Request Automation

When you want something automated, tell Claude:

**Good requests**:
- "When a trade closes, have Arbiter grade it and post to Discord"
- "Every morning at 8 AM, send me a briefing of yesterday's P&L and today's calendar"
- "If any agent is stale for 10 minutes, restart it and alert me"
- "Track VIX every 5 minutes and warn me when it goes above 25"

**What Claude does**:
1. Designs the workflow (triggers, steps, outputs)
2. Creates n8n workflow JSON
3. Deploys to your n8n instance
4. Tests the workflow
5. Reports back with webhook URLs or confirmation

**You never need to**:
- Log into n8n UI
- Write workflow JSON
- Debug n8n errors
- Manage credentials manually

---

## Discord Webhook Setup (If Needed)

If you need to create additional Discord webhooks:

### Step 1: Create Webhook in Discord
1. Open Discord server
2. Right-click channel (e.g., #alerts) → Edit Channel
3. Integrations → Webhooks → New Webhook
4. Name it (e.g., "n8n Alerts")
5. Copy webhook URL

### Step 2: Add to n8n Credentials
1. Tell Claude: "Add this Discord webhook to n8n credentials: [URL]"
2. Claude will store it securely in n8n's credential store
3. Workflows can reference it by name

### Step 3: Use in Workflows
Claude will use the credential in workflow definitions:
```yaml
- node: Discord
  credentials: "Discord #alerts Webhook"
  parameters:
    message: "Alert text here"
```

---

## Quick Reference: Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| n8n UI | http://[CONTABO_IP]:5678 | Workflow management (Claude uses API) |
| n8n API | http://[CONTABO_IP]:5678/api/v1 | Claude's n8n-mcp connects here |
| SwjshAK Dashboard | http://localhost:3000 | Your trading dashboard |
| SwjshAK API | http://localhost:3000/api/* | Internal API endpoints |
| OpenClaw Gateway | http://localhost:3001 | Agent webhook endpoints |
| Jira | https://swjshalgoknife.atlassian.net | Project management |

---

## Troubleshooting

### "n8n workflow not running"
1. Check n8n is up: `docker ps | grep n8n`
2. Check workflow is active (not paused)
3. Check trigger conditions (cron timing, webhook URL)
4. Check n8n logs: `docker logs n8n --tail 100`

### "Discord not receiving messages"
1. Verify webhook URL is correct
2. Test webhook: `curl -X POST [WEBHOOK_URL] -H "Content-Type: application/json" -d '{"content":"test"}'`
3. Check Discord channel permissions

### "OpenClaw agent not responding"
1. Check OpenClaw is running: `docker ps | grep openclaw`
2. Check agent is enabled in config
3. Check cron schedule is correct
4. Check Discord for agent messages

### "Jira tickets not creating"
1. Verify API token is valid
2. Check project key exists
3. Check required fields are provided
4. Test: `python scripts/jira_setup.py status`

---

## Document Index

### Library (Reusable Guides)
| Document | Location | Purpose |
|----------|----------|---------|
| **This file** | Library/AUTOMATION_ARCHITECTURE.md | Master integration guide |
| n8n Setup | Library/n8n_Setup.md | Installation, config, troubleshooting |
| Jira Onboarding | Library/Jira_Onboarding.md | Project creation, credentials |
| Advanced Workflow Ideas | Library/n8n_Advanced_Workflow_Ideas.md | Complex workflow concepts |

### Planning Documents (Project Root)
| Document | Location | Purpose |
|----------|----------|---------|
| Ultimate Automation Plan | N8N_ULTIMATE_AUTOMATION_PLAN.md | 47 workflow specifications (the big plan) |
| Suggested Improvements | N8N_SUGGESTED_IMPROVEMENTS.md | 48 enhancements to the plan |
| OpenClaw Webhook Plan | OPENCLAW_WEBHOOK_SPRINT_PLAN.md | Webhook config, Developer agent |
| Claude n8n Control | CLAUDE_N8N_CONTROL_PLAN.md | How Claude manages n8n |

### What Each Plan Covers

**N8N_ULTIMATE_AUTOMATION_PLAN.md** (47 workflows, 5 phases):
- Phase 1: Health monitoring, daily operations, brain sync
- Phase 2: Signal processing, trade lifecycle, risk management
- Phase 3: Intelligence layer (free APIs for sentiment, VIX, etc.)
- Phase 4: Self-healing, learning, pattern detection
- Phase 5: Advanced (GitHub, Claude API, backups)

**N8N_SUGGESTED_IMPROVEMENTS.md** (48 enhancements):
- Consolidate health checks (reduce executions by 40%)
- Add missing workflows (SSL monitoring, n8n self-health)
- Security (webhook auth, IP whitelisting)
- Performance (caching, batching, market hours filtering)
- Options flow intel (GEX, put/call ratios for SPX)

**OPENCLAW_WEBHOOK_SPRINT_PLAN.md**:
- How to enable webhooks in OpenClaw
- Developer agent SOUL.md template
- Daily sprint worker cron jobs
- GitHub integration for autonomous PRs

**CLAUDE_N8N_CONTROL_PLAN.md**:
- How Claude builds n8n workflows
- n8n-mcp and n8n-skills plugins
- Example workflow creation flow
- Maintenance Claude handles

---

## Summary

**The automation stack**:
```
YOU ──► Discord ──► n8n ──► {SwjshAK, OpenClaw, Jira}
                     │
                     └──► Claude (via n8n-mcp) builds & manages workflows
```

**What each tool does**:
- **n8n**: Runs workflows (schedules, triggers, data transformation)
- **OpenClaw**: Runs AI agents (thinking, reasoning, code writing)
- **Discord**: Human interface (alerts to you, commands from you)
- **Jira**: Persistent memory (tickets, sprints, learnings)
- **SwjshAK**: Trading execution (agents, trades, signals)

**Your role**: Describe what you want automated. Claude builds it.

---

*Created by Claude Opus 4.5 — 2026-03-19*
