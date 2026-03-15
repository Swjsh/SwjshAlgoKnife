# System Architecture — How Everything Connects

> Chief reads this when diagnosing issues or understanding data flow.
> Updated when infrastructure changes.

---

## Stack

- **Frontend:** Next.js 15 App Router (port 3000)
- **Database:** SQLite (better-sqlite3) — journal.db
- **Agents:** Hybrid TypeScript + Python (managed by agent_runner.ts)
- **AI Orchestrator:** OpenClaw Gateway (port 3001) — Chief (Sonnet 4.6) + 8 sub-agents
- **Monitoring:** Watchdog (Python daemon, zero LLM cost)
- **Messaging:** Discord (3 channels via OpenClaw bot)
- **Brokers:** OANDA Practice (FX), Alpaca Paper (equities/crypto)
- **Design:** Cyber-Industrial dark mode, electric cyan (#06b6d4), neon purple (#a855f7)

---

## Process Architecture (GCP)

```
supervisord
├── nextjs (priority=1)     — Dashboard + API routes + Control API (port 3000)
├── runner (priority=10)    — Agent Runner: spawns all Python agents as child processes
├── watchdog (priority=15)  — Python monitoring daemon, 18 checks, wakes Chief on critical
└── openclaw (priority=20)  — Chief + 8 agents + Discord + 13 cron jobs (port 3001)
```

All auto-restart. OpenClaw starts last because it depends on the other 3.

---

## Data Flow

```
Market Signals (3 sources):
  1. TradingView Alert → POST /api/webhook/tradingview (requires X-Webhook-Secret)
  2. Python agent scans → yfinance/broker API → agent status files
  3. Manual signal → POST /api/signals

Signal Processing:
  Signal → TradeExecutor.processSignal()
    → FX symbol? → OANDA placeMarketOrder()
    → Equity/crypto? → Alpaca submitOrder()
    → Write to journal.db trades table (PENDING → OPEN)
    → Discord notification via webhook

Trade Lifecycle:
  PENDING → OPEN → WIN/LOSS
    → On close: TheProfessor.gradeTrade() → grade to agents_db.json
    → TheAuditor.auditReview() → verify with yfinance data
    → Professor writes feedback to agent memory file
    → Chief reads grades at EOD, updates brain

Agent Status Updates:
  Python agents → stdout: AGENT_STATUS_UPDATE:{json}
    → agent_runner.ts parses → writes to agents_db.json
    → Dashboard reads agents_db.json → real-time UI
    → Watchdog reads agents_db.json → health monitoring
```

---

## Port Map

| Port | Service | Access |
|------|---------|--------|
| 3000 | Next.js Dashboard + API | localhost (internal) |
| 3001 | OpenClaw Gateway | localhost (loopback only) |

---

## Database Schema (journal.db)

```sql
trades(
  id INTEGER PRIMARY KEY,
  symbol TEXT, direction TEXT,           -- LONG/SHORT
  entry_price REAL, exit_price REAL, stop_loss REAL,
  pnl REAL, strategy TEXT,
  status TEXT,                           -- PENDING/OPEN/WIN/LOSS
  entry_date TEXT, exit_date TEXT,       -- ISO 8601
  notes TEXT
)

signals(
  id INTEGER PRIMARY KEY,
  symbol TEXT, action TEXT,              -- BUY/SELL
  price REAL, strategy TEXT,
  timestamp TEXT, processed INTEGER      -- 0/1
)

journal_entries(id, date, mood, notes, tags)
settings(key TEXT PRIMARY KEY, value TEXT)
```

---

## File Map (Critical Paths)

| File | Purpose | Who Reads | Who Writes |
|------|---------|-----------|------------|
| data/agents_db.json | All agent runtime state | Dashboard, Watchdog, Chief, Control API | Agent Runner |
| journal.db | Trade history, signals, journal | Professor, Chief, Overseer, Watchdog | Trade Executor, agents |
| .env.local | API credentials | All services | Jack only |
| data/brain/ | The Brain (13+ files) | Chief, all agents | Chief, Professor, Evolution Engine |
| data/logs/ | All service logs | Debugging | supervisord, all processes |
| data/control_commands.json | Queued control commands | Agent Runner | Control API |

---

## API Reference

### Control API (localhost:3000/api/control)
```
GET  /api/control              — Full system status snapshot
POST /api/control
  {"command":"status"}         — Same as GET
  {"command":"summary"}        — Human-readable P&L report
  {"command":"pause","agentId":"sterling","reason":"..."}
  {"command":"resume","agentId":"sterling","reason":"..."}
  {"command":"restart","agentId":"sterling","reason":"..."}
  {"command":"killswitch","reason":"..."}
  {"command":"killswitch_reset","reason":"..."}
```
Auth: Optional X-Control-Key header (if CONTROL_API_KEY env set)

### Webhook (localhost:3000/api/webhook/tradingview)
```
POST /api/webhook/tradingview
  Header: X-Webhook-Secret: {WEBHOOK_SECRET}
  Body: {"symbol":"EURUSD","action":"BUY","price":1.0842,"strategy":"ThreeDucks"}
```

### Broker APIs
- OANDA Practice: https://api-fxpractice.oanda.com/v3/
- Alpaca Paper: https://paper-api.alpaca.markets/v2/

---

## Discord Channel Map

| Channel | ID | Owner | Purpose |
|---------|-----|-------|---------|
| #chief-main | 1465522015095099549 | Chief | Command center. Morning briefs, EOD reports, risk alerts, Professor grades. |
| #forex | 1467174412615942186 | Sterling | FX zone alerts, session open/close, GBP/USD updates. |
| #crypto | 1467174512377200640 | Bitcoin Bob | BTC/ETH zone alerts only. Silence = no setup. |

Guild ID: 340322473276997632
