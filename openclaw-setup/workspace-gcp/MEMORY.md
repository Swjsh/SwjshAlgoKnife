# MEMORY.md — Long-term Memory (GCP)

## Setup — 2026-03-15
- SwjshAlgoKnife deployed to GCP (e2-small, us-east4)
- Services: Next.js dashboard, Agent Runner, OpenClaw Gateway, Watchdog
- 8 agents configured: Chief, Sterling, Bitcoin Bob, Pivot Pete, Boba, SPX Sniper, Professor, Overseer
- Brain system active: data/brain/ with master-tracker, strategies, decisions-log, daily-log
- Autonomous decision loop: every 30 min during market hours
- Watchdog: 18 checks across 4 tiers, wakes Chief only for critical issues
- Trading mode: PAPER only
- Account: $10,000 paper | Risk: 1% per trade | Max daily loss: $1,000

## Architecture
- Watchdog (Python) monitors everything at zero LLM cost
- Chief (Sonnet via OpenClaw) makes AI decisions when needed
- Trading agents (Python) execute strategies via agent_runner.ts
- Control API (localhost:3000/api/control) for programmatic commands
- Brain (data/brain/*.md) provides context and receives feedback

## Risk Rules
- Kill switch: 3 consecutive losses on any agent OR daily loss > $1,000
- Kill switch requires manual override (Jack or explicit command)
- Chief can pause agents and reduce risk autonomously
- Chief CANNOT increase risk or resume after kill switch

## Known Issues
- npx tsx has IPC pipe issues in some environments — node -r dotenv/config fallback
- /api/agents response shape is { agents, system } not agents directly
- TradingView webhook requires price field + X-Webhook-Secret header
