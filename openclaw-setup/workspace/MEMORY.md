# MEMORY.md — Chief Long-Term Memory

*This file persists across sessions. Important decisions, patterns, and platform evolution are recorded here. Chief updates this during EOD or when a significant event occurs.*

---

## Platform Setup History

### 2026-03-13 — Initial End-to-End Wiring
- SwjshAlgoKnife wired end-to-end: TradingView → Webhook → TradeExecutor → Alpaca/OANDA → journal.db → Discord
- Alpaca paper trading client: src/lib/broker/alpaca.ts
- OANDA practice client: src/lib/broker/oanda.ts
- Discord notification service: src/lib/notifications/discord.ts
- TheProfessor grading engine integrated into trade close flow
- All 8 agent CLAUDE.md files created in agents/ directory
- WEBHOOK_SECRET set in .env.local as: swjshak-tv-webhook-2026
- Trading mode: PAPER ONLY (Alpaca paper + OANDA practice)

### 2026-03-15 — OpenClaw Jarvis Layer Rebuilt
- openclaw.json rebuilt with native anthropic-messages format for Claude
- Auditor agent added (was missing from original config)
- All 8 agent SOUL.md files comprehensively upgraded with full platform context
- DEPLOY.ps1 installer created for one-command setup
- Chief workspace files (SOUL.md, AGENTS.md, TOOLS.md, USER.md, MEMORY.md) fully updated

### 2026-03-15 — Heartbeat + Cron Overhaul
- Built-in heartbeat added to openclaw.json: every 30m, isolatedSession + lightContext for token savings
- activeHours: 3 AM–5:30 PM ET (covers London open through US close)
- HEARTBEAT.md created: concise checklist (agents status, stale trades, overnight positions, risk flags)
- "heartbeat" cron job REMOVED — replaced by built-in heartbeat system
- cron-jobs.json rewritten to official schema: jobId field, delivery.mode announce with Discord targets, lightContext on routine jobs
- 11 cron jobs: morning-briefing, london-open, ny-overlap, market-open-check, midday-check, sterling-session-close, eod-professor-grade, eod-overseer-audit, bitcoin-bob-watch, sterling-forex-scan, weekly-review
- Bitcoin Bob + Sterling scans reply HEARTBEAT_OK when nothing notable (suppressed by gateway)
- Professor + Overseer EOD jobs run without lightContext (need full workspace for grading/risk)

### 2026-03-15 — Deep Integration & Cost Optimization
- Chief SOUL.md rewritten with: Obsidian vault integration, token cost rules, autonomy guardrails
- Obsidian Master Tracker path added to Chief's knowledge: C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\
- TOOLS.md expanded with Obsidian file paths, LLM Control API endpoints, Master Tracker read/write patterns
- Cost tier system implemented: Chief + Overseer on Sonnet, all other 7 agents on Haiku (~70% savings)
- AGENTS.md rebuilt with cost tier table and sub-agent spawning rules (when to delegate vs handle directly)
- Agent default model changed from Sonnet to Haiku in openclaw.json
- gateway.mode=local added to fix "Gateway start blocked" error
- Config schema issues resolved: baseUrl, models array, bindings type:acp format, inputTypes removed
- CLAUDE.md updated with Web Research Guardrails section for config safety

---

## Active Agent Roster

Sterling — FX agent, OANDA Practice, GBP/USD primary
Bitcoin Bob — Crypto SCAN_ONLY (needs Coinbase credentials for live orders)
Pivot Pete — Futures ES/NQ/GC, RTH only
Boba — Options SPY/QQQ, 9:30-11 AM ET only
SPX Sniper — 0DTE SPX, after 10:30 AM only
The Professor — EOD trade grader, 4:15 PM ET
The Auditor — Independent price verifier (runs after Professor)
The Overseer — Risk guardian, EOD 4:30 PM + intraday alerts

---

## Risk Parameters (Current)

Account: $10,000 paper
Risk per trade: 1% = $100 max
Max daily drawdown: 10% = $1,000
Kill switch: 3 consecutive losses per agent OR daily loss > $1,000
Paper trading — no live capital at risk

---

## Known Issues and Watch Points

- npx tsx has IPC pipe issues in restricted environments — use node -r dotenv/config as fallback
- Alpaca/OANDA API calls return 403 from VMs and sandboxed environments (IP restriction) — APIs work from Jack's local machine only
- /api/agents response shape is { agents, system } — frontend reads data.agents not data.agentId
- TradingView webhooks require the price field (not optional) and X-Webhook-Secret header
- Bitcoin Bob is SCAN_ONLY — Coinbase credentials needed before live crypto orders will execute
- WEBHOOK_SECRET must be set in .env.local or ALL TradingView signals will silently 401

---

## Credentials Status (presence only — never log values)

WEBHOOK_SECRET: present as of 2026-03-13
APCA_API_KEY_ID / APCA_API_SECRET_KEY: check .env.local
OANDA_API_TOKEN / OANDA_ACCOUNT_ID: check .env.local
DISCORD_CHIEF_WEBHOOK: used by app for one-way trade alerts

---

## Performance Notes

*Chief appends daily summaries below during EOD runs. Format: YYYY-MM-DD: [brief summary of trades and system status]*

<!-- Chief appends daily summaries below this line -->
