# TOOLS.md — Available Tools & Data Sources for Chief

## File System

### Project Root
C:\Users\jackw\Desktop\SwjshAlgoKnife

### Critical Runtime Files

agents_db.json:
  C:\Users\jackw\Desktop\SwjshAlgoKnife\src\app\api\agents\agents_db.json
  Contains runtime state for all 8 agents. Read/write. CHECK THIS FIRST for agent status.

journal.db:
  C:\Users\jackw\Desktop\SwjshAlgoKnife\journal.db
  SQLite — trades, signals, journal_entries, settings tables.

.env.local (credentials — check presence only, NEVER log values):
  C:\Users\jackw\Desktop\SwjshAlgoKnife\.env.local
  Keys: WEBHOOK_SECRET, APCA_API_KEY_ID, APCA_API_SECRET_KEY, OANDA_API_TOKEN,
        OANDA_ACCOUNT_ID, DISCORD_CHIEF_WEBHOOK, NEXT_PUBLIC_FINNHUB_KEY

### Agent Status Files

Crypto zone scan output:
  C:\Users\jackw\Desktop\SwjshAlgoKnife\data\crypto_agent_status.json

Boba zone scan output:
  C:\Users\jackw\Desktop\SwjshAlgoKnife\data\boba_agent_status.json

### Agent Configuration Files
  C:\Users\jackw\Desktop\SwjshAlgoKnife\agents\[agentName]\CLAUDE.md

---

## Obsidian Vault — The Brain

Location: C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\

### Files Chief Reads Regularly

Master Tracker (START HERE every session):
  C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\🎯 Master Tracker.md
  Read: "Today's Focus", "Active Projects", "What Claude Should Work On Next"
  Write: Mark tasks complete after significant work. NEVER change priorities without Jack.

Dashboard:
  C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\📊 Dashboard.md
  Read: Component status table, system health
  Write: Update component status if health changes (e.g., agent goes from ACTIVE → HALTED)

Daily Log:
  C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\📅 Daily Log.md
  Read: What happened recently
  Write: Append entries after completing work. Format: "### YYYY-MM-DD\n- [what was done]"

### Files Chief Reads On Demand

System Architecture:
  C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\System Architecture.md

Agent System:
  C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\Agent System.md

Strategies Overview:
  C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\Strategies Overview.md

Troubleshooting:
  C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\Troubleshooting.md

Connection Map:
  C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\Connection Map.md

Roadmap:
  C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\Roadmap.md

LLM Control API:
  C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\LLM Control API.md

---

## SQLite Queries (journal.db)

### Today's trades
SELECT id, symbol, direction, ROUND(entry_price,5) as entry, ROUND(exit_price,5) as exit,
  ROUND(stop_loss,5) as stop, ROUND(pnl,2) as pnl, strategy, status, entry_date, exit_date
FROM trades WHERE date(entry_date) = date('now') ORDER BY entry_date;

### Today's P&L summary
SELECT COUNT(*) as trades, ROUND(SUM(pnl),2) as total_pnl,
  SUM(CASE WHEN status='WIN' THEN 1 ELSE 0 END) as wins,
  SUM(CASE WHEN status='LOSS' THEN 1 ELSE 0 END) as losses,
  COUNT(CASE WHEN status='OPEN' THEN 1 END) as open_positions
FROM trades WHERE date(entry_date) = date('now');

### Stale PENDING trades (should be zero)
SELECT id, symbol, strategy, entry_date FROM trades
WHERE status='PENDING' AND datetime(entry_date) < datetime('now','-30 minutes');

### Yesterday's summary
SELECT COUNT(*) as trades, ROUND(SUM(pnl),2) as total_pnl,
  SUM(CASE WHEN status='WIN' THEN 1 ELSE 0 END) as wins
FROM trades WHERE date(exit_date) = date('now','-1 day') AND status IN ('WIN','LOSS');

### Recent signals (last 2 hours)
SELECT symbol, action, price, strategy, timestamp FROM signals
WHERE datetime(timestamp) > datetime('now','-2 hours')
ORDER BY timestamp DESC LIMIT 10;

### Weekly per-strategy breakdown
SELECT strategy, COUNT(*) as trades, ROUND(SUM(pnl),2) as total_pnl,
  SUM(CASE WHEN status='WIN' THEN 1 ELSE 0 END) as wins
FROM trades WHERE status IN ('WIN','LOSS') AND entry_date >= datetime('now','-7 days')
GROUP BY strategy ORDER BY total_pnl DESC;

### Open positions from overnight (should be zero)
SELECT symbol, direction, strategy, ROUND(entry_price,5) as entry, entry_date
FROM trades WHERE status='OPEN' AND date(entry_date) < date('now');

### This week's total P&L
SELECT ROUND(SUM(pnl),2) as week_pnl, COUNT(*) as trades,
  SUM(CASE WHEN status='WIN' THEN 1 ELSE 0 END) as wins,
  SUM(CASE WHEN status='LOSS' THEN 1 ELSE 0 END) as losses
FROM trades WHERE status IN ('WIN','LOSS') AND entry_date >= datetime('now','weekday 0','-7 days');

---

## Discord Integration

### One-way Webhook (app → Discord)
Used by: TradeExecutor, TheProfessor grading engine, Discord notification functions
Credential: DISCORD_CHIEF_WEBHOOK in .env.local
Format: POST JSON with { embeds: [{ title, color, description, fields, footer }] }

### Bot (two-way — openclaw handles this)
Used by: openclaw cron jobs and interactive chat
Credential: DISCORD_BOT_TOKEN in openclaw .env
Channels:
  #chief-main  1465522015095099549  — Chief's channel
  #forex       1467174412615942186  — Sterling's channel
  #crypto      1467174512377200640  — Bitcoin Bob's channel

---

## Broker APIs

### Alpaca Paper Trading (Equities, Crypto)
Base URL: https://paper-api.alpaca.markets/v2/
Auth headers: APCA-API-KEY-ID: {key} + APCA-API-SECRET-KEY: {secret}
Key endpoints:
  GET  /account                    → account balance, buying power, status
  GET  /positions                  → all open positions
  GET  /orders?status=all&limit=10 → recent orders
  POST /orders                     → submit new order

### OANDA Practice (Forex)
Base URL: https://api-fxpractice.oanda.com/v3/
Auth: Authorization: Bearer {OANDA_API_TOKEN}
Key endpoints:
  GET /accounts/{id}/summary       → account balance, margin, PnL
  GET /accounts/{id}/trades        → open FX trades
  GET /accounts/{id}/orders        → pending orders
  POST /accounts/{id}/orders       → place new order

### TradingView Webhook
Inbound: POST http://localhost:3000/api/webhook/tradingview
  Header: X-Webhook-Secret: {WEBHOOK_SECRET}
  Body: { "symbol": "EURUSD", "action": "BUY", "price": 1.0842, "strategy": "ThreeDucks" }
  If WEBHOOK_SECRET missing from .env.local → 401 Unauthorized (silent, no error thrown)

### Market Data (Free)
yfinance (Python):
  import yfinance as yf
  ticker = yf.Ticker("EURUSD=X")
  hist = ticker.history(period="1d", interval="5m")

Finnhub:
  GET https://finnhub.io/api/v1/quote?symbol={SYMBOL}&token={NEXT_PUBLIC_FINNHUB_KEY}

---

## Platform API Endpoints

Dashboard health: GET http://localhost:3000/api/agents
  Response: { agents: {...}, system: {...} }

LLM Control API: http://localhost:3000/api/control
  GET  → Full system status (agents, trades, signals)
  POST { "command": "summary" }              → Daily P&L report
  POST { "command": "pause", "agentId": X }  → Pause agent
  POST { "command": "resume", "agentId": X } → Resume agent
  POST { "command": "killswitch" }           → Emergency halt ALL
  POST { "command": "killswitch_reset" }     → Resume after halt

Manual signal: POST http://localhost:3000/api/signals
  Body: { "symbol": "SPY", "action": "BUY", "price": 562.40, "strategy": "Manual" }

Journal CRUD: GET/POST/PATCH http://localhost:3000/api/journal

---

## Shell Commands (run from project root)

Start dashboard:
  npm run dev

Initialize/reset database:
  npx tsx scripts/init-db.ts

Start all Python trading agents via orchestrator:
  npx tsx scripts/agent_runner.ts

Run individual Python agents (dev only — do NOT run while agent_runner is active):
  python scripts/run_pivot_pete.py
  python scripts/boba_trades_engine.py
  python scripts/run_spx_sniper.py
  python scripts/bitcoin_bob_engine.py
  python scripts/auditor_engine.py

Connection health check:
  npx tsx scripts/check_connections.ts

SQLite query:
  sqlite3 "C:\Users\jackw\Desktop\SwjshAlgoKnife\journal.db" "SELECT ..."

---

## Sub-Agent Spawning

### Cost-Aware Delegation Rules
Chief (Sonnet) is expensive. Sub-agents (Haiku) are cheap. ALWAYS delegate specialized work.

### Agent → Task Mapping
  spawn overseer → risk check, drawdown calculation, kill switch evaluation
  spawn professor → grade a specific trade or batch of trades
  spawn auditor → verify entry/exit prices against yfinance market data
  spawn sterling → FX zone assessment, OANDA position check
  spawn bitcoin-bob → crypto zone scan, BTC sentiment check
  spawn pivot-pete → futures pivot level analysis
  spawn boba → SPY/QQQ S&D zone status
  spawn spx-sniper → 0DTE setup check, VWAP alignment

### Delegation Format
When spawning, give the sub-agent a SPECIFIC task with context:
  "Grade today's closed trades. There were 3 trades — check journal.db WHERE date(exit_date) = date('now') AND status IN ('WIN','LOSS')."
  NOT: "Hey Professor, do your thing."
