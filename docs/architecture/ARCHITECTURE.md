# Architecture Overview

This document is a living map of the Swjsh Algo‑Knife codebase. It should stay accurate to what's in the repo **today** so new work can start fast and safely.

**Last Updated:** 2026-03-15

---

## 1. Project Structure (Current)

```
SwjshAlgoKnife/
├── src/                          # Main application source
│   ├── app/                      # Next.js App Router pages + API routes
│   │   ├── api/                  # 31 backend endpoints (see Section 3)
│   │   │   ├── accounts/         # Agent account management
│   │   │   ├── agent-status/     # Agent status read/write
│   │   │   ├── agents/           # Agent CRUD + chat interface
│   │   │   ├── auth/             # Session/auth endpoints
│   │   │   ├── brokers/          # Broker config, verify, health
│   │   │   ├── connections/      # Active connection listing
│   │   │   ├── health/           # System health check
│   │   │   ├── intel/            # Intelligence system queries + streams
│   │   │   ├── journal/          # Trade journal CRUD
│   │   │   ├── killswitch/       # Emergency halt
│   │   │   ├── me/               # Current user profile
│   │   │   ├── onboarding/       # Onboarding + legal acceptance
│   │   │   ├── prices/           # Real-time price feed
│   │   │   ├── reset/            # State reset
│   │   │   ├── signals/          # Signal ingestion + history
│   │   │   ├── trades/           # Trade CRUD
│   │   │   └── webhook/          # TradingView webhook receiver
│   │   ├── agent/                # Agent detail view (dynamic route)
│   │   ├── agents/               # Agent management UI
│   │   ├── coffeeroom/           # Agent lounge & Professor's desk
│   │   ├── dashboard/            # Main trading dashboard
│   │   ├── journal/              # Trade journal UI
│   │   ├── lab/                  # Experiments / strategy sandbox
│   │   ├── login/                # Authentication
│   │   ├── logs/                 # System logs UI
│   │   ├── research/             # Research tools
│   │   ├── scanner/              # Market scanner
│   │   ├── settings/             # User settings
│   │   └── strategies/           # Strategy management UI
│   ├── agents/                   # TypeScript agent runners
│   │   └── futures-agent.ts      # Pivot Pete local runner
│   ├── components/               # Reusable React components
│   │   ├── Agents/               # Agent widgets + terminal
│   │   ├── Dashboard/            # TradingChart, ActiveSignals, StrategyPanel
│   │   ├── Journal/              # TradeList, EntryForm, AnalyticsHeader
│   │   ├── Landing/              # Marketing / onboarding views
│   │   └── UI/                   # GlassPanel, LogoIcon, ThemeToggle
│   ├── context/                  # React Context providers
│   │   ├── AgentContext.tsx       # Agent state
│   │   ├── AuthContext.tsx        # Clerk authentication
│   │   └── StrategyContext.tsx    # Strategy configuration
│   ├── lib/                      # Core libraries
│   │   ├── broker/               # Broker API clients
│   │   │   ├── alpaca.ts         # Alpaca Markets client
│   │   │   └── oanda.ts          # OANDA Forex client
│   │   ├── data-providers/       # Market data sources
│   │   │   └── alpaca.ts         # Alpaca data feeds
│   │   ├── engine/               # Trading engine core
│   │   │   ├── local_runner/     # Strategy eval loop + grading
│   │   │   │   ├── MarketData.ts
│   │   │   │   ├── StrategyLoop.ts
│   │   │   │   ├── TheProfessor.ts
│   │   │   │   ├── TheAuditor.ts
│   │   │   │   └── YahooFinance.ts
│   │   │   ├── risk/             # Advanced risk subsystem
│   │   │   │   ├── RiskEngine.ts
│   │   │   │   ├── KillSwitch.ts
│   │   │   │   ├── RegimeDetector.ts
│   │   │   │   └── FrictionSimulator.ts
│   │   │   ├── strategies/       # 11 strategy implementations
│   │   │   ├── executor.ts       # Trade execution + broker routing
│   │   │   ├── manager.ts        # Strategy registry + engine orchestration
│   │   │   ├── paper-trading.ts  # Paper trading engine
│   │   │   ├── risk.ts           # Position sizing helpers
│   │   │   ├── simulator.ts      # Synthetic tick generation
│   │   │   └── types.ts          # Candle, Signal, Trade, BaseStrategy
│   │   ├── intel/                # Intelligence system
│   │   │   ├── adapter.ts        # Intel ↔ strategy bridge (30s cache)
│   │   │   ├── bus.ts            # Central intel event bus + scoring
│   │   │   ├── regime.ts         # Market regime classifier
│   │   │   ├── types.ts          # IntelSignal, IntelScore interfaces
│   │   │   ├── orderflow/        # CVD + absorption analysis
│   │   │   ├── sentiment/        # News + Fear & Greed index
│   │   │   ├── onchain/          # Etherscan whale tracking
│   │   │   ├── whale/            # Exchange inflow/outflow detection
│   │   │   ├── econ/             # Economic calendar
│   │   │   └── free/             # Zero-cost data aggregation
│   │   ├── firebase/             # Firebase helpers
│   │   ├── hooks/                # Custom React hooks
│   │   ├── notifications/
│   │   │   └── discord.ts        # Discord webhook alert routing
│   │   ├── scanner/
│   │   │   └── engine.ts         # Breakout/consolidation scanner
│   │   ├── utils/                # Misc helpers
│   │   ├── accounts.ts           # Multi-tenant capital allocation
│   │   ├── agentManager.ts       # Agent lifecycle management
│   │   ├── auth.ts               # Clerk auth utilities
│   │   ├── db.ts                 # Prisma init + SQLite fallback
│   │   ├── encryption.ts         # AES-256-GCM credential encryption
│   │   ├── firebase-admin.ts
│   │   ├── firebase-client.ts
│   │   ├── prisma.ts             # Prisma singleton
│   │   └── tradeExecutor.ts      # Signal-to-trade pipeline
│   └── middleware/               # Auth middleware (Clerk)
├── scripts/                      # Autonomous agents + utilities
│   ├── agent_runner.ts           # Master TypeScript orchestrator (26KB)
│   ├── overseer_agent.ts         # Overseer for all agents
│   ├── btc_live_engine.ts        # Live BTC trading engine
│   ├── backtest.ts               # Strategy backtesting framework
│   ├── forex-scanner.ts          # Pre-market forex opportunity scanner
│   ├── run_pivot_pete.py         # Futures agent entry point
│   ├── run_boba.py               # Options agent entry point
│   ├── run_spx_sniper.py         # SPX 0DTE agent entry point
│   ├── pivot_pete_engine.py      # ES futures engine (32KB)
│   ├── boba_trades_engine.py     # SPY options engine (17KB)
│   ├── spx_sniper_engine.py      # SPX 0DTE engine (16KB)
│   ├── bitcoin_bob_engine.py     # BTC/ETH crypto engine (16KB)
│   ├── sterling_fx_engine.py     # Forex engine (17KB)
│   ├── the_professor.py          # Trade grading engine
│   ├── the_auditor.py            # Audit / fact-check engine
│   ├── agent_utils.py            # Shared Python utilities
│   ├── agent_personas.py         # Agent personality definitions
│   ├── trade_analyzer.py         # Historical trade analytics (14KB)
│   ├── market_context.py         # Macro context determination
│   ├── run_sentiment.ts          # Sentiment intel service runner
│   ├── run_onchain.ts            # On-chain intel service runner
│   ├── run_whale_tracker.ts      # Whale tracking service runner
│   ├── run_orderflow.ts          # Order flow service runner
│   ├── init-db.ts                # Database initialization
│   ├── init-accounts.ts          # Account setup
│   ├── reset-db.ts               # Database reset
│   ├── daily-report.ts           # Daily summary generation
│   └── parse_webull.ts           # CSV import helper
├── prisma/                       # Database ORM
│   ├── schema.prisma             # 20-table schema (PostgreSQL)
│   └── migrations/               # Schema migration history
├── tests/                        # Unit/integration tests (Vitest)
├── testsprite_tests/             # UI/E2E tests
├── data/                         # Live agent state (JSON)
│   ├── agents_db.json            # Authoritative agent state
│   ├── crypto_agent_status.json
│   ├── forex_agent_status.json
│   ├── spx_agent_status.json
│   ├── futures_agent_status.json
│   ├── agent_logs.json
│   └── wallet_watchlist.json
├── logs/                         # Runtime + backtest logs
│   └── _backtests/               # Historical backtest results
├── docs/                         # Product docs + reality checks
├── theories/                     # Trading theory notes
├── journal.db                    # SQLite fallback / local journal DB
├── Dockerfile                    # Multi-stage production container
├── DEPLOY.md                     # Deployment guide
├── DEPLOY_GCP.md                 # GCP-specific instructions
├── DEPLOY_ORACLE.md              # Oracle Cloud instructions
├── START_BOT.ps1                 # PowerShell: start all agents
├── START_DASHBOARD.ps1           # PowerShell: start Next.js dev server
├── pivot_pete_start.ps1          # PowerShell: start Pivot Pete only
└── ARCHITECTURE.md               # This file
```

---

## 2. High‑Level System Diagram (Current)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            EXTERNAL SOURCES                              │
│  [TradingView Webhooks]  [Alpaca Markets]  [OANDA Forex]  [Finnhub FX]  │
│  [Etherscan On-Chain]    [Fear & Greed]    [Economic Calendar]           │
└──────┬──────────────────────┬───────────────────────┬────────────────────┘
       │                      │                       │
       ▼                      ▼                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS APPLICATION (App Router)                 │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                         API LAYER (31 routes)                       │  │
│  │  /webhook  /signals  /trades  /journal  /brokers  /intel  /agents  │  │
│  │  /accounts  /killswitch  /health  /prices  /me  /onboarding        │  │
│  └───────────────────────────────┬────────────────────────────────────┘  │
│                                  │                                       │
│         ┌────────────────────────┼──────────────────────┐               │
│         ▼                        ▼                       ▼               │
│  ┌─────────────┐   ┌─────────────────────────┐  ┌──────────────────┐   │
│  │ INTEL SYSTEM │   │   TRADING ENGINE         │  │  RISK SUBSYSTEM  │   │
│  │  bus.ts      │   │   manager.ts             │  │  KillSwitch.ts   │   │
│  │  adapter.ts  │──▶│   executor.ts            │  │  RiskEngine.ts   │   │
│  │  regime.ts   │   │   paper-trading.ts       │  │  RegimeDetect.ts │   │
│  │  orderflow/  │   │   StrategyLoop.ts        │  │  FrictionSim.ts  │   │
│  │  sentiment/  │   │   11 strategies          │  └──────────────────┘   │
│  │  onchain/    │   └─────────────┬────────────┘                         │
│  │  whale/      │                 │                                      │
│  │  econ/       │                 ▼                                      │
│  └─────────────┘   ┌─────────────────────────────┐                      │
│                    │   BROKER LAYER               │                      │
│                    │   alpaca.ts / oanda.ts        │                      │
│                    └─────────────────────────────┘                      │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                   REACT FRONTEND (Next.js)                          │  │
│  │  Dashboard • Strategies • Agents • Journal • Scanner • Settings    │  │
│  │  AuthContext (Clerk) • AgentContext • StrategyContext               │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
       │                        │                        │
       ▼                        ▼                        ▼
┌─────────────────┐   ┌──────────────────────┐  ┌─────────────────────┐
│ PostgreSQL       │   │ data/*.json           │  │ Discord Webhooks     │
│ (Prisma ORM)     │   │ Live agent state      │  │ Chief / Forex /      │
│ 20-table schema  │   │ agents_db.json etc.   │  │ Crypto alerts        │
└─────────────────┘   └──────────────────────┘  └─────────────────────┘
```

### Agent Subprocess Flow

```
agent_runner.ts (TypeScript Orchestrator)
    │
    ├── Spawns Python subprocesses via child_process
    │       ├── pivot_pete_engine.py  (ES Futures)
    │       ├── boba_trades_engine.py (SPY Options)
    │       ├── spx_sniper_engine.py  (SPX 0DTE)
    │       ├── bitcoin_bob_engine.py (Crypto)
    │       ├── sterling_fx_engine.py (Forex)
    │       └── the_professor.py / the_auditor.py
    │
    ├── Launches Intel services (TypeScript child threads)
    │       ├── run_orderflow.ts  → OrderFlowService (CVD)
    │       ├── run_sentiment.ts  → SentimentBridge
    │       ├── run_onchain.ts    → OnChainBridge
    │       └── run_whale_tracker.ts → WhaleFlowService
    │
    └── Reads AGENT_STATUS_UPDATE:{json} from stdout
        └── Writes to data/agents_db.json + API state
```

---

## 3. API Routes Reference

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/webhook/tradingview` | Receive TradingView alerts (`X-Webhook-Secret` auth) |
| `GET\|POST` | `/api/trades` | Trade CRUD |
| `GET\|POST` | `/api/signals` | Signal ingestion and history |
| `GET\|POST` | `/api/journal` | Trade journal entries |
| `GET\|POST` | `/api/agents` | List / manage all agents |
| `GET\|POST` | `/api/agents/chat` | Agent messaging interface |
| `GET` | `/api/agent-status` | Real-time agent status |
| `POST` | `/api/killswitch` | Emergency trading halt |
| `GET\|POST` | `/api/brokers` | Broker configuration CRUD |
| `POST` | `/api/brokers/[id]/verify` | Test broker connection |
| `GET` | `/api/brokers/[id]/health` | Broker health check |
| `POST` | `/api/brokers/test` | Test new broker credentials |
| `GET` | `/api/intel` | Central intel query |
| `GET\|POST` | `/api/intel/score` | Scoring and confidence metrics |
| `GET` | `/api/intel/stream` | Real-time intel feed |
| `GET` | `/api/intel/calendar` | Economic calendar events |
| `GET` | `/api/intel/history` | Historical intel decisions |
| `GET\|POST` | `/api/intel/feedback` | Trade outcome feedback |
| `GET` | `/api/intel/preflight` | Pre-trade intel check |
| `GET` | `/api/intel/free-feeds` | Fear & Greed, OI, Funding data |
| `GET\|POST` | `/api/accounts` | Agent account management |
| `GET\|POST` | `/api/me` | Current user profile |
| `GET` | `/api/auth/session` | Session data |
| `POST` | `/api/onboarding/complete` | Mark onboarding done |
| `POST` | `/api/onboarding/legal` | Legal document acceptance |
| `GET` | `/api/health` | System health check |
| `GET` | `/api/connections` | List active broker connections |
| `GET` | `/api/prices` | Real-time price data |
| `POST` | `/api/reset` | Reset trading state |

---

## 4. Trading Engine (`src/lib/engine/`)

### 4.1 Core Files

| File | Purpose |
|------|---------|
| `manager.ts` | `EngineManager` — strategy registry, manages 7 active strategies, injects Intel context, runs 3s simulation heartbeat |
| `executor.ts` | `TradeExecutor` — signal processing, broker routing (Alpaca/OANDA), AES-encrypted multi-tenant credential handling |
| `types.ts` | Core types: `Signal`, `Candle`, `Trade`, `StrategyConfig`, abstract `BaseStrategy`, `IntelStrategyContext` |
| `risk.ts` | `RiskManager` — position sizing (risk-based or fixed), asset-class detection (FX/Crypto/Futures) |
| `paper-trading.ts` | Mock execution engine with P&L tracking |
| `simulator.ts` | `MarketSimulator` — synthetic tick generation for offline testing |

### 4.2 Strategies (`src/lib/engine/strategies/`)

All strategies extend `BaseStrategy` and implement `onCandle()` and `onTick()`.

| File | Strategy | Markets | Description |
|------|----------|---------|-------------|
| `orb.ts` | Opening Range Breakout | Futures/ES | 15-minute session range breakout detection |
| `neverStoppedOut.ts` | Never Stopped Out | MNQ Futures | Zero Red Days ORB with Standard/Inverse/Divergence setups |
| `bbBreakout.ts` | Bollinger Band Breakout | Multi | Squeeze detection and volatility expansion |
| `vwapReversion.ts` | VWAP Reversion | Multi | Mean reversion from institutional VWAP anchors |
| `suppRes.ts` | Support/Resistance | Multi | Zone-based reversal detection |
| `threeDucks.ts` | Three Ducks | Forex | Trend-following via 4H/1H/5M alignment |
| `gridTrading.ts` | Grid Trading | Multi | Range-bound profit stacking |
| `setAndForget.ts` | Set & Forget | Multi | Long-term hold strategy |
| `pivot.ts` | Pivot Points | Futures | Daily/weekly/monthly pivot level tracking |

**Strategy → Intel Integration:**
Strategies receive `IntelStrategyContext` at evaluation time, which can:
- Adjust stop-loss, take-profit, and position size via multipliers
- Veto LONG or SHORT entries based on current market regime
- Fall back gracefully to default parameters if intel is unavailable

### 4.3 Local Runner (`src/lib/engine/local_runner/`)

| File | Purpose |
|------|---------|
| `MarketData.ts` | Price tick aggregation and candle generation |
| `StrategyLoop.ts` | Core 3-second strategy evaluation heartbeat |
| `TheProfessor.ts` | Grades closed trades A–F based on discipline, efficiency, and follow-through |
| `TheAuditor.ts` | Fact-checks Professor grades; detects anomalies and timestamp inconsistencies |
| `YahooFinance.ts` | Market data fetching utility |

### 4.4 Risk Subsystem (`src/lib/engine/risk/`)

| File | Purpose |
|------|---------|
| `RiskEngine.ts` | Trade tracking, P&L calculation, friction simulation |
| `KillSwitch.ts` | Emergency halt with cooldown and max daily loss tracking |
| `RegimeDetector.ts` | Market regime classification: `TRENDING`, `RANGING`, `HIGH_VOL` |
| `FrictionSimulator.ts` | Models slippage, commissions, and spread costs |

---

## 5. Autonomous Agents

Six named agents run as Python subprocesses launched by `scripts/agent_runner.ts`.

| Agent | Symbol | Asset Class | Engine | Entry Point |
|-------|--------|-------------|--------|-------------|
| **Pivot Pete** | ES | Futures | `pivot_pete_engine.py` | `run_pivot_pete.py` |
| **Boba** | SPY | Options | `boba_trades_engine.py` | `run_boba.py` |
| **SPX Sniper** | SPX | 0DTE Options | `spx_sniper_engine.py` | `run_spx_sniper.py` |
| **Bitcoin Bob** | BTC/ETH | Crypto | `bitcoin_bob_engine.py` | via `agent_runner.ts` |
| **Sterling** | EUR/GBP/JPY | Forex | `sterling_fx_engine.py` | via `agent_runner.ts` |
| **The Professor** | All | Auditor/Grader | `the_professor.py` | via `agent_runner.ts` |

**Communication Protocol:**
Python agents write `AGENT_STATUS_UPDATE:{json}` to stdout. `agent_runner.ts` parses these lines and merges state into `data/agents_db.json`. Agents auto-restart after 30 seconds if they crash.

**Agent Personas:**
Each agent has a defined personality in `scripts/agent_personas.json` — avatar, voice profile, and quips. Used by the chat interface.

---

## 6. Intelligence System (`src/lib/intel/`)

The intel system feeds real-time market context into all strategy evaluations.

```
IntelBus (bus.ts)
    │
    ├── OrderFlowService  → CVD, absorption analysis  (orderflow/)
    ├── SentimentBridge   → News + Fear & Greed Index (sentiment/)
    ├── OnChainBridge     → Etherscan whale movements  (onchain/)
    ├── WhaleFlowService  → Exchange inflow/outflow    (whale/)
    ├── EconCalendar      → Scheduled economic events  (econ/)
    └── FreeIntelService  → Funding rates, OI, social  (free/)
         │
         ▼
    IntelAdapter (adapter.ts) — 30-second result cache
         │
         ▼
    IntelStrategyContext injected into each strategy evaluation
```

**Regime Classification** (`regime.ts`): `BULLISH` | `BEARISH` | `RANGING` | `HIGH_VOL` | `CAPITULATION`

---

## 7. Data Layer

### 7.1 PostgreSQL via Prisma (`prisma/schema.prisma`)

20 tables across three domains:

**Authentication & Multi-Tenancy:**
- `User` — Clerk integration, onboarding steps, settings
- `BrokerConfig` — AES-256-GCM encrypted API credentials, connection status

**Trading Infrastructure:**
- `Bot` — User-owned bots with strategy config and risk parameters
- `Trade` — Full lifecycle: entry, exit, P&L, status
- `Signal` — Inbound signals with expiration and status tracking
- `JournalEntry` — Daily notes and mood logs
- `AgentAccount` — Capital per agent (master + sub-accounts)
- `AccountTransaction` — Ledger: deposits, withdrawals, P&L transfers

**Intelligence & Compliance:**
- `IntelSignal` — Time-boxed market intel records
- `AuditLog` — All user actions: `broker.connect`, `bot.start`, `trade.execute`
- `LegalAcceptance` — GDPR / liability waiver tracking
- `Setting` — Key-value config store

### 7.2 Local JSON State (`data/`)

| File | Contents |
|------|----------|
| `agents_db.json` | Authoritative agent state: status, trades, reviews, audits |
| `crypto_agent_status.json` | Bitcoin Bob snapshot |
| `forex_agent_status.json` | Sterling snapshot |
| `spx_agent_status.json` | SPX Sniper snapshot |
| `futures_agent_status.json` | Pivot Pete snapshot |
| `agent_logs.json` | Consolidated agent terminal output |
| `wallet_watchlist.json` | Crypto wallet addresses under surveillance |

### 7.3 SQLite Fallback (`journal.db`)

Used when `DATABASE_URL` is not set (local development without PostgreSQL).

---

## 8. External Integrations

| Service | Purpose | Integration Point |
|---------|---------|-------------------|
| **TradingView** | Signal ingestion | `POST /api/webhook/tradingview` (`X-Webhook-Secret` header) |
| **Alpaca Markets** | Equities/crypto execution + market data | `src/lib/broker/alpaca.ts`, `src/lib/data-providers/alpaca.ts` |
| **OANDA** | Forex execution (demo + live) | `src/lib/broker/oanda.ts` |
| **Finnhub** | Real-time FX quotes | `NEXT_PUBLIC_FINNHUB_KEY` env var |
| **Etherscan** | On-chain whale tracking | `src/lib/intel/onchain/bridge.ts` |
| **Clerk** | User authentication + session management | `src/lib/auth.ts`, `src/context/AuthContext.tsx` |
| **Firebase** | Realtime DB + supplemental auth | `src/lib/firebase-admin.ts`, `firebase-client.ts` |
| **Discord** | Trade alerts + agent notifications | `src/lib/notifications/discord.ts` (3 webhook channels) |

---

## 9. Security

### Authentication
- **Clerk** handles all user auth (JWT, session management, middleware)
- `src/middleware/` enforces auth on protected routes
- Firebase provides supplemental realtime capability

### Credential Encryption
- All broker API keys stored encrypted in PostgreSQL
- Algorithm: **AES-256-GCM** via `src/lib/encryption.ts`
- Key: 64-character hex stored in `ENCRYPTION_KEY` env var

### Webhook Validation
- TradingView webhooks require `X-Webhook-Secret` header matching `WEBHOOK_SECRET` env var
- Per-bot webhook keys supported for multi-tenant isolation

### Kill Switch
- `POST /api/killswitch` triggers `KillSwitch.ts`
- Implements cooldown period + max daily loss threshold
- All halts are recorded in `AuditLog`

---

## 10. Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...           # Neon/PostgreSQL connection string

# Authentication & Encryption
ENCRYPTION_KEY=<64-char hex>            # AES-256-GCM key for broker credentials
WEBHOOK_SECRET=<secret>                 # TradingView webhook auth

# Clerk (Authentication)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Brokers
APCA_API_KEY_ID=...                     # Alpaca key
APCA_API_SECRET_KEY=...                 # Alpaca secret
APCA_API_BASE_URL=https://paper-api.alpaca.markets
OANDA_API_TOKEN=...
OANDA_ACCOUNT_ID=...
OANDA_ENVIRONMENT=practice              # or 'live'
NEXT_PUBLIC_FINNHUB_KEY=...             # Real-time FX data

# Trading Parameters
ACCOUNT_BALANCE=10000
RISK_PER_TRADE=1                        # Percent risk per trade

# Notifications
DISCORD_CHIEF_WEBHOOK=...               # Master alert channel
DISCORD_FOREX_WEBHOOK=...
DISCORD_CRYPTO_WEBHOOK=...
```

---

## 11. Key Scripts & Utilities

### Development / Startup
```bash
npm run dev                          # Start Next.js dashboard (http://localhost:3000/agents)
npm run build && npm start           # Production server
npx tsx scripts/init-db.ts           # Initialize/reset the database
npx tsx scripts/agent_runner.ts      # Start all autonomous agents
```

### Individual Agent Runners
```bash
python scripts/run_pivot_pete.py     # ES Futures agent
python scripts/run_boba.py           # SPY Options agent
python scripts/run_spx_sniper.py     # SPX 0DTE agent
```

### Intel Service Runners
```bash
npx tsx scripts/run_orderflow.ts     # Order flow + CVD service
npx tsx scripts/run_sentiment.ts     # News + Fear & Greed sentiment
npx tsx scripts/run_onchain.ts       # Etherscan on-chain bridge
npx tsx scripts/run_whale_tracker.ts # Whale flow tracking
```

### Analysis & Reporting
```bash
npx tsx scripts/backtest.ts          # Run strategy backtests
npx tsx scripts/analyze_performance.ts   # Trade performance analytics
npx tsx scripts/daily-report.ts      # Generate daily summary
npx tsx scripts/check_connections.ts # Verify broker connections
```

### PowerShell Shortcuts (Windows)
```powershell
./START_BOT.ps1                      # Start all trading agents
./START_DASHBOARD.ps1                # Start dashboard + open browser
./pivot_pete_start.ps1               # Start Pivot Pete only
./pivot_pete_stop.ps1                # Stop Pivot Pete
```

---

## 12. Deployment

### Local Development
Primary workflow. Uses `.env.local` with paper-trading credentials.

### Docker
`Dockerfile` provides a multi-stage production container. Build and run:
```bash
docker build -t swjsh-ak .
docker run -p 3000:3000 --env-file .env swjsh-ak
```

### Cloud Targets
- **Vercel** — Next.js UI + API routes (see `DEPLOY.md`)
- **Google Cloud Platform** — Full stack deployment (see `DEPLOY_GCP.md`)
- **Oracle Cloud** — Alternative hosting (see `DEPLOY_ORACLE.md`)

---

## 13. Data Flow

```
1. Signal Ingestion
   TradingView alert → POST /api/webhook/tradingview → Signal saved to DB

2. Strategy Evaluation
   StrategyLoop.ts (3s heartbeat) → BaseStrategy.onCandle() → IntelAdapter.getContext()
   → adaptive parameters applied → Signal generated → agents_db.json updated

3. Trade Execution
   Signal → TradeExecutor.process() → RiskManager.validate() → KillSwitch.check()
   → BrokerClient.submitOrder() → Trade saved to DB → Discord alert sent

4. Agent Review
   Closed trade → TheProfessor.grade() → TheAuditor.verify()
   → Review + Audit appended to agents_db.json

5. Performance Tracking
   Trade data → /api/trades → AnalyticsHeader + Journal UI
   → Daily reports via scripts/daily-report.ts
```

---

## 14. Design System

Defined in `src/app/globals.css` — HSL CSS variable system:

```css
--background:      222 47% 11%;    /* Deep gunmetal */
--brand-primary:   188 95% 43%;    /* Electric cyan  (#06b6d4) */
--accent-neon:     271 77% 62%;    /* Neon purple    (#a855f7) */
```

Glassmorphic surfaces use `backdrop-filter: blur(12px)` with translucent backgrounds. Charts rendered via `lightweight-charts` (TradingView open-source, canvas-based).

---

## 15. Known Technical Notes

- Simulation loop in `EngineManager.start()` is disabled by default (prevents noise during live testing)
- Agent processes auto-restart 30 seconds after crash (see `agent_runner.ts`)
- All timestamps use ISO 8601 format
- PnL calculations assume BTC positions in USD; FX positions use standard lot sizing (100k units)
- `journal.db` SQLite is a fallback for local development when `DATABASE_URL` is not configured
- `data/parsed_trades.json` (~1.47 MB) holds historical trade data for analysis

---

## 16. Roadmap Notes

- Replace Alpaca ETF proxy with native futures data feed when available
- Tighten backtest realism: full slippage, commissions, and market-hours simulation
- Standardize agent status schema and add health-check polling
- Webhook signature verification needs to be enforced on all per-bot webhook paths
- Consolidate Firebase + Clerk into a single auth path

---

## Project Identification

**Project:** Swjsh Algo‑Knife (AK)
**Primary Contact:** Jack W.
**Last Updated:** 2026-03-15
