# Project File Structure

**Project:** SwjshAK (Swjsh Army Knife)
**Type:** Autonomous Trading Platform (Next.js + TypeScript + Python)
**Root:** `/sessions/trusting-cool-turing/mnt/SwjshAlgoKnife/`

---

## Directory Map

```
SwjshAlgoKnife/
├── src/                           # Frontend + Backend source code
├── scripts/                        # Standalone agents, utilities, deployments
├── docs/                          # Documentation (this file)
├── data/                          # Runtime data, agent state, configs
├── deploy/                        # Deployment scripts
├── tests/                         # Test suites
├── openclaw-setup/                # OpenClaw gateway configuration
├── public/                        # Static assets (images, logos)
├── logs/                          # Application logs
├── .next/                         # Next.js build cache
├── node_modules/                  # npm dependencies
├── package.json                   # npm dependencies config
├── tsconfig.json                  # TypeScript config
├── next.config.ts                 # Next.js configuration
├── docker-compose.yml             # Docker orchestration
├── Dockerfile                     # Container image
├── supervisord.conf               # Process supervisor config
├── ecosystem.config.js            # PM2 config
└── journal.db                     # SQLite database (trades, signals, journal)
```

---

## Core Directories

### `/src` — Source Code (Frontend + Backend API)

**Next.js 15 app router structure with API routes + React components**

```
src/
├── app/                           # Next.js App Router (routes + API)
│   ├── dashboard/                 # Dashboard page
│   ├── journal/                   # Journal + trade history
│   ├── agents/                    # Agent control panel
│   ├── strategies/                # Strategy configuration
│   ├── intel/                     # Intelligence system (market intel)
│   ├── brain/                     # Chief AI interface
│   ├── connections/               # Broker connection management
│   ├── logs/                      # System logs viewer
│   ├── settings/                  # User settings
│   ├── lab/                       # Strategy lab / sandbox
│   ├── command-center/            # Control center (alias for dashboard)
│   ├── api/                       # HTTP API routes
│   │   ├── agents/                # Agent status, chat endpoints
│   │   │   ├── route.ts           # GET agents list
│   │   │   ├── chat/              # Agent chat interface
│   │   │   ├── stream/            # Real-time streaming
│   │   │   └── agents_db.json     # Agent state persistence
│   │   ├── control/               # LLM Control API (summary, pause, resume, killswitch)
│   │   ├── webhook/               # Webhook receivers
│   │   │   └── tradingview/       # TradingView alert handler
│   │   ├── journal/               # Trade journal CRUD
│   │   ├── trades/                # Trade management
│   │   ├── signals/               # Signal submission
│   │   ├── health/                # System health check
│   │   ├── killswitch/            # Emergency halt API
│   │   ├── intel/                 # Intelligence stream endpoints
│   │   │   ├── calendar/          # Economic calendar
│   │   │   ├── score/             # Market scoring
│   │   │   ├── preflight/         # Pre-trade intel gate
│   │   │   ├── stream/            # Real-time intel updates
│   │   │   └── free-feeds/        # Free data feeds
│   │   ├── brokers/               # Broker connection management
│   │   └── auth/                  # Authentication endpoints
│   ├── legal/                     # Terms, Privacy policy
│   └── layout.tsx                 # Root layout
│
├── components/                    # React components
│   ├── Layout/                    # App chrome (Sidebar, Header)
│   ├── Dashboard/                 # Dashboard widgets (Chart, Signals, Panel)
│   ├── Journal/                   # Trade journal components
│   ├── Agents/                    # Agent control UI
│   ├── Intelligence/              # Intel display components
│   ├── Header/                    # Top navigation
│   ├── Navigation/                # Navigation menus
│   ├── KillSwitch/                # Emergency halt UI
│   ├── Onboarding/                # Setup flow
│   ├── Landing/                   # Landing page
│   ├── SaaSLanding/               # Premium landing
│   ├── UI/                        # Reusable UI components (GlassPanel, Button, etc.)
│   └── Auth/                      # Login/signup components
│
├── lib/                           # Shared utilities & core logic
│   ├── engine/                    # Trading engine (strategies, risk, execution)
│   │   ├── manager.ts             # Strategy registry & initialization
│   │   ├── types.ts               # BaseStrategy interface, Signal types
│   │   ├── executor.ts            # Trade execution interface
│   │   ├── local_runner/          # TypeScript core engine components
│   │   │   ├── MarketData.ts      # Market data provider (yfinance, Binance)
│   │   │   ├── StrategyLoop.ts    # Main processing loop
│   │   │   ├── TheProfessor.ts    # Trade grader (A-F)
│   │   │   └── TheAuditor.ts      # Verification agent
│   │   ├── strategies/            # Strategy implementations
│   │   │   ├── ORB.ts             # Opening Range Breakout
│   │   │   ├── NeverStoppedOut.ts # Advanced ORB
│   │   │   ├── VWAP.ts            # VWAP Reversion
│   │   │   ├── GridTrading.ts     # Range-bound grid
│   │   │   ├── BollingerBreakout.ts
│   │   │   ├── ThreeDucks.ts      # Forex trend
│   │   │   └── SupportResistance.ts
│   │   ├── risk/                  # Risk management
│   │   │   ├── RiskEngine.ts      # Position sizing, concurrency limits
│   │   │   ├── FrictionSimulator.ts # Slippage modeling
│   │   │   ├── RegimeDetector.ts  # Market regime classification
│   │   │   └── KillSwitch.ts      # Emergency halt logic
│   │   └── scanner/               # Market opportunity scanner
│   │
│   ├── intel/                     # Intelligence system (market data, macro, sentiment)
│   │   ├── econ/                  # Economic calendar integration
│   │   ├── sentiment/             # Social media sentiment analysis
│   │   ├── onchain/               # On-chain metrics (blockchain data)
│   │   ├── orderflow/             # Order flow analysis
│   │   ├── whale/                 # Whale flow detection
│   │   ├── free/                  # Free data feeds (news, market data)
│   │   ├── bus.ts                 # Event bus for intel updates
│   │   └── service.ts             # Coordinator
│   │
│   ├── broker/                    # Broker API integrations
│   │   ├── alpaca.ts              # Alpaca options/equities
│   │   ├── ibkr.ts                # Interactive Brokers
│   │   ├── futures.ts             # Futures broker
│   │   └── base.ts                # Abstract broker interface
│   │
│   ├── data-providers/            # Data sources
│   │   ├── yfinance.ts            # Yahoo Finance
│   │   ├── binance.ts             # Binance crypto
│   │   ├── finnhub.ts             # Finnhub live data
│   │   └── iex.ts                 # IEX Cloud
│   │
│   ├── db.ts                      # SQLite database schema & helpers
│   ├── notifications/             # Discord, Slack webhooks
│   ├── scanner/                   # Opportunity scanner engine
│   ├── api/                       # Shared API utilities
│   ├── firebase/                  # Firebase Auth/Firestore config
│   ├── utils/                     # Helper functions
│   └── hooks/                     # React hooks (useAgentStatus, etc.)
│
├── context/                       # React Context providers
│   ├── AuthContext.tsx            # User authentication
│   ├── AgentContext.tsx           # Agent state
│   └── StrategyContext.tsx        # Strategy selection
│
├── hooks/                         # Custom React hooks
├── types/                         # TypeScript type definitions
├── middleware.ts                  # Next.js middleware (auth guards)
├── app/globals.css                # Global CSS + design system variables
└── app/layout.tsx                 # Root layout
```

**Frontend Stack:**
- **Framework:** Next.js 15 (App Router)
- **Styling:** Vanilla CSS Modules with HSL variables (no Tailwind)
- **Charts:** lightweight-charts (TradingView open-source)
- **Icons:** Lucide React
- **Animations:** Framer Motion (landing, components)
- **Canvas:** Particle effects (particle.js for landing)

**Backend Stack:**
- **Database:** SQLite (better-sqlite3)
- **Auth:** Firebase Authentication
- **Webhooks:** TradingView alert receiver
- **Session Management:** NextAuth or Firebase
- **API Pattern:** Next.js API Routes (REST + streaming)

---

### `/scripts` — Standalone Agents & Utilities

**Python agents (executed as subprocesses by agent_runner.ts) + TS utilities + deployment scripts**

```
scripts/
├── agent_runner.ts                # MASTER ORCHESTRATOR
│                                  # Spawns all trading agents as child processes
│                                  # Manages MarketData, StrategyLoop, Professor, Auditor
│                                  # Auto-restarts crashed agents with exponential backoff
│                                  # Serves LLM Control API on :3000
│
├── watchdog.py                    # PRODUCTION MONITOR (24/7)
│                                  # 18 checks across 4 tiers
│                                  # Posts Discord alerts, wakes Chief on critical issues
│
├── TRADING AGENTS (Python)
│   ├── boba_options_engine.py      # Options specialist (institutional flow)
│   ├── boba_trades_engine.py       # Options trade executor
│   ├── bitcoin_bob_engine.py       # Crypto specialist (BTC, ETH)
│   ├── pivot-pete-backtest.ts      # Pivot Pete (Futures/ES)
│   └── (others: SPX Sniper, etc.)
│
├── UTILITIES
│   ├── data_feeds.py               # Market data collection (yfinance, Binance, etc.)
│   ├── options_utils.py            # Greeks calculation, option chain parsing
│   ├── agent_utils.py              # Shared agent helpers (logging, state mgmt)
│   ├── deploy_fleet.py             # Multi-agent deployment script
│   ├── backtest.ts                 # Backtesting engine
│   ├── backtest_report.py          # Backtest analysis & reporting
│   ├── daily-intel-report.ts       # End-of-day intel summary
│   ├── check_connections.ts        # Broker connection health check
│   └── parse_webull.ts             # Import WebBull trade history
│
├── DEPLOYMENT
│   ├── ecosystem.config.js         # PM2 configuration (local Windows/Linux)
│   ├── supervisord.conf            # Supervisord configuration (Docker/GCP)
│   ├── deploy-gcp.sh               # GCP deployment automation
│   ├── deploy-to-gcp.sh            # Bash deployment wrapper
│   ├── deployment_setup.sh         # Initial server setup
│   └── setup_oracle.sh             # Oracle Cloud Free Tier setup
│
├── DATA & CONFIG
│   ├── agent_personas.json         # Agent character profiles
│   ├── agent_personas.py           # Python version of personas
│   ├── backtest_config.py          # Backtest parameters
│   ├── requirements_*.txt          # Python dependencies per agent
│   └── onchain/                    # On-chain data scripts
│
└── MONITORING & LOGS
    ├── agent_logs.json             # Structured agent logs
    └── (logs/ directory has run logs)
```

**Key Agent Communication:**
- Agents output `AGENT_STATUS_UPDATE:{json}` to stdout
- agent_runner.ts parses these updates and persists state to `agents_db.json`
- Discord/OpenClaw integration via watchdog.py and Chief API

**Python Dependencies:**
```
yfinance              # Market data
pandas                # Data manipulation
requests              # HTTP client
numpy                 # Numerical computing
py-alpaca-trade-api   # Alpaca broker
python-binance        # Binance API
```

---

### `/data` — Runtime State & Configuration

**Persistent data, agent state, and config files**

```
data/
├── agents_db.json                 # CRITICAL: Agent state file
│                                  # Structure:
│                                  # {
│                                  #   "fx": { status, active_trades, performance, ... },
│                                  #   "crypto": { ... },
│                                  #   "futures": { ... },
│                                  #   "boba": { ... },
│                                  #   "spx": { ... },
│                                  #   "professor": { reviews: [...] },
│                                  #   "auditor": { audits: [...] }
│                                  # }
│
├── fx_agent_status.json           # Sterling FX agent health file
├── crypto_agent_status.json       # Bitcoin Bob health file
├── futures_agent_status.json      # Pivot Pete health file
├── spx_agent_status.json          # SPX Sniper health file
│
├── configs/                       # Agent-specific configurations
│   ├── pivot_pete_config.json     # Futures parameters
│   ├── boba_config.json           # Options parameters
│   └── ...
│
├── backtests/                     # Backtest results & reports
│   ├── 2026-03-15_orb_backtest.json
│   └── 2026-03-15_backtest_report.html
│
├── brain/                         # Chief AI knowledge base
│   ├── self-healing.md            # Known issues + fixes
│   ├── decisions-log.md           # Chief's decisions & rationale
│   └── known-patterns.md          # Market patterns & triggers
│
├── agent_logs.json                # Structured agent activity logs
├── wallet_watchlist.json          # Crypto wallet monitoring
├── parsed_trades.json             # Historical trade records
│
└── _backtests/                    # Legacy backtest results
    └── (archive)
```

**Key Files:**
- **agents_db.json:** Single source of truth for all agent state (read by Watchdog, updated by agent_runner)
- **brain/:** Chief's knowledge base (referenced during self-healing)
- **backtests/:** Historical performance data for strategy validation

---

### `/docs` — Documentation

```
docs/
├── MONITORING.md                  # THIS: Watchdog & alert system
├── FILE_STRUCTURE.md              # THIS: Project directory layout
├── PRODUCT_SPEC.md                # Product requirements & vision
├── ARCHITECTURE.md                # System architecture deep dive
├── AUTONOMOUS-LOOP.md             # Agent loop design
├── IMPLEMENTATION_SUMMARY.md      # Implementation checklist
├── DEPLOYMENT_GUIDE.md            # How to deploy
├── TESTING_GUIDE.md               # Test procedures
├── SECURITY_AUDIT.md              # Security review
├── agent-strategy-map.md          # Agent-to-strategy mapping
│
├── agents/                        # Agent profiles
│   ├── pivot-pete.md              # Futures specialist
│   ├── boba.md                    # Options specialist
│   ├── bitcoin-bob.md             # Crypto specialist
│   └── ...
│
├── strategies/                    # Strategy documentation
│   ├── ORB.md                     # Opening Range Breakout
│   ├── VWAP-Reversion.md          # VWAP mean reversion
│   └── ...
│
└── analysis/                      # Research & analysis notes
    ├── pivot-points.txt           # Trading reference
    └── (various analysis docs)
```

---

### `/deploy` — Deployment Scripts & Config

```
deploy/
├── gcp_startup.sh                 # GCP VM startup script
├── docker-env                     # Docker environment config
├── kubernetes/                    # K8s manifests (future)
└── terraform/                     # IaC for GCP (future)
```

---

### `/tests` — Test Suites

```
tests/
├── strategies.test.ts             # Strategy unit tests
├── risk.test.ts                   # RiskEngine tests
├── integration.test.ts            # End-to-end tests
└── backtest.test.ts               # Backtest validation

testsprite_tests/                  # Legacy test framework results
```

---

### `/openclaw-setup` — OpenClaw Gateway Configuration

**Chief AI system configuration (OpenClaw = anthropic gateway)**

```
openclaw-setup/
├── openclaw.json                  # Gateway config
│                                  # - Model definition
│                                  # - Anthropic API key
│                                  # - Gateway mode (local/cloud)
│
├── cron/
│   └── jobs.json                  # Cron job definitions
│
└── logs/                          # Gateway logs
```

---

## Database Schema (`journal.db`)

**SQLite database — 4 core tables**

```sql
-- Trades table
CREATE TABLE trades (
  id INTEGER PRIMARY KEY,
  symbol TEXT,
  direction TEXT,                  -- LONG / SHORT
  entry_date DATETIME,
  exit_date DATETIME,
  entry_price REAL,
  exit_price REAL,
  quantity REAL,
  pnl REAL,                         -- Realized P&L
  status TEXT,                      -- WIN / LOSS / PENDING / OPEN
  strategy TEXT,                    -- Strategy name
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Signals table
CREATE TABLE signals (
  id INTEGER PRIMARY KEY,
  symbol TEXT,
  action TEXT,                      -- BUY / SELL / CLOSE
  price REAL,
  timestamp DATETIME,
  source TEXT,                      -- tradingview / manual / strategy
  confidence REAL,                  -- 0.0 - 1.0
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Journal entries table
CREATE TABLE journal_entries (
  id INTEGER PRIMARY KEY,
  date DATE,
  mood TEXT,                        -- Trader mood / market conditions
  notes TEXT,
  performance_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings table
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Intelligence preflight log table
CREATE TABLE intel_preflight_log (
  id INTEGER PRIMARY KEY,
  timestamp DATETIME,
  decision TEXT,                    -- GO / REDUCED / NO_GO
  reasoning TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Key Configuration Files

### Root Level Config

| File | Purpose |
|------|---------|
| `.env` | Environment variables (secrets) |
| `.env.local` | Local overrides |
| `.env.example` | Template for env vars |
| `package.json` | npm dependencies + scripts |
| `tsconfig.json` | TypeScript compiler options |
| `next.config.ts` | Next.js build & runtime config |
| `tailwind.config.js` | (Not used — vanilla CSS) |
| `docker-compose.yml` | Local Docker setup |
| `Dockerfile` | Container image definition |
| `supervisord.conf` | Process supervisor (GCP/Docker) |
| `ecosystem.config.js` | PM2 configuration (Windows) |
| `.gitignore` | Git exclusions |

### Environment Variables

```bash
# API Keys & Auth
NEXT_PUBLIC_FIREBASE_API_KEY=...
FIREBASE_PRIVATE_KEY=...
WEBHOOK_SECRET=...
OPENCLAW_GATEWAY_TOKEN=...
DISCORD_CHIEF_WEBHOOK=...

# Database & Data Paths
DATABASE_PATH=/path/to/journal.db
AGENTS_DB_PATH=/path/to/agents_db.json
DATA_DIR=/path/to/data

# Broker APIs
ALPACA_API_KEY=...
ALPACA_SECRET_KEY=...
BINANCE_API_KEY=...
BINANCE_SECRET_KEY=...
IBKR_ACCOUNT=...

# Trading Parameters
ACCOUNT_BALANCE=10000
RISK_PER_TRADE=1
MAX_CONCURRENT_TRADES=3

# Market Data
FINNHUB_API_KEY=...
IEX_CLOUD_TOKEN=...

# Deployment
NODE_ENV=production
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

---

## Component Hierarchy

### Frontend Page Structure
```
App Layout (src/app/layout.tsx)
├── Sidebar (src/components/Layout/Sidebar)
├── Header (src/components/Header)
└── Main Content
    ├── Dashboard (src/app/dashboard)
    │   ├── TradingChart (src/components/Dashboard/TradingChart)
    │   ├── ActiveSignals (src/components/Dashboard/ActiveSignals)
    │   └── StrategyPanel (src/components/Dashboard/StrategyPanel)
    │
    ├── Agents (src/app/agents)
    │   ├── AgentTerminal (src/components/Agents/AgentTerminal)
    │   ├── AgentChat (src/components/Agents/AgentChat)
    │   └── StatusMonitor (src/components/Agents/StatusMonitor)
    │
    ├── Journal (src/app/journal)
    │   ├── TradeList (src/components/Journal/TradeList)
    │   ├── TradeEntry (src/components/Journal/TradeEntry)
    │   └── AnalyticsHeader (src/components/Journal/AnalyticsHeader)
    │
    ├── Intelligence (src/app/intel)
    │   ├── EconCalendar (src/components/Intelligence/EconCalendar)
    │   ├── SentimentWidget (src/components/Intelligence/SentimentWidget)
    │   └── IntelStream (src/components/Intelligence/IntelStream)
    │
    ├── Strategies (src/app/strategies)
    │   └── StrategyConfig (src/components/Dashboard/StrategyPanel)
    │
    ├── Logs (src/app/logs)
    │   └── LogViewer (src/components/Logs/LogViewer)
    │
    └── Settings (src/app/settings)
        ├── BrokerSettings (src/components/Onboarding/BrokerConnect)
        └── RiskSettings (src/components/Onboarding/RiskConfig)
```

---

## Module Dependencies

### Trading Engine Initialization
```
agent_runner.ts (main)
├── MarketData (loads EURUSD, ES, BTC via yfinance/Binance)
├── StrategyLoop (evaluates strategies each tick)
│   ├── EngineManager (registry of all strategies)
│   ├── RiskEngine (checks position limits)
│   ├── RegimeDetector (market regime classification)
│   └── FrictionSimulator (applies slippage)
├── TheProfessor (grades closed trades)
├── TheAuditor (fact-checks grades)
└── (Python agents spawned as subprocesses)
    ├── bitcoin_bob_engine.py
    ├── boba_options_engine.py
    └── pivot-pete-backtest.ts
```

### Intelligence System
```
IntelBridge (event bus)
├── EconCalendarService (economic data)
├── SentimentBridge (social sentiment)
├── OnChainBridge (blockchain metrics)
├── OrderFlowService (order flow data)
├── WhaleFlowService (large trade detection)
└── FreeFeeds (news, free data)
```

---

## Common File Patterns

### Strategy Implementation
```
src/lib/engine/strategies/MyStrategy.ts
├── export class MyStrategy extends BaseStrategy { }
├── constructor(symbol, timeframe, params)
├── onCandle(candle: Candle)              # Called on each candle
├── onTick(price: number, time: Date)     # Called on each price
├── generateSignal(): Signal | null
└── close()
```

### Python Agent Template
```
scripts/my_agent_engine.py
├── import sys, json, time
├── class MyAgent:
│   ├── __init__()
│   ├── run()                             # Main loop
│   └── post_status_update()              # Output JSON to stdout
├── if __name__ == "__main__":
│   └── agent = MyAgent(); agent.run()
```

---

## Logs & Output

### Log Locations
- **Application:** `logs/app.log` (Next.js)
- **Agent Runner:** stdout (JSON formatted)
- **Python Agents:** `logs/agent_*.log`
- **Watchdog:** stdout (structured with [WATCHDOG] prefix)
- **Discord:** #watchdog, #chief-main channels

### Log Format
```json
{
  "timestamp": "2026-03-15T16:30:00.123Z",
  "level": "info|warn|error",
  "agentId": "bitcoin-bob|pivot-pete|fx",
  "message": "Trade executed: BTC-USD LONG $100 @ 65000"
}
```

---

## Development Workflow

### Adding a New Strategy
1. Create `src/lib/engine/strategies/MyStrategy.ts`
2. Extend `BaseStrategy`
3. Implement `onCandle()` and `onTick()`
4. Register in `EngineManager` constructor
5. Add test in `tests/strategies.test.ts`

### Adding a New Agent
1. Create `scripts/my_agent_engine.py`
2. Implement `run()` and status update output
3. Update `agent_runner.ts` to spawn it
4. Add to `watchdog.py` TRADING_AGENTS registry
5. Define `data/configs/my_agent_config.json`

### Deploying to GCP
1. Run `scripts/deploy-gcp.sh`
2. Pushes via `PUSH_TO_GCP.ps1` (PowerShell)
3. Supervisord starts agent_runner + watchdog
4. Access dashboard at `http://<ip>:3000`

---

## Summary Table

| Component | Language | Purpose | Auto-restart |
|-----------|----------|---------|--------------|
| Frontend | TypeScript/React | Dashboard UI | N/A |
| API Routes | TypeScript | REST endpoints | PM2/supervisord |
| agent_runner.ts | TypeScript | Master orchestrator | PM2/supervisord |
| Trading Agents | Python | Market-specific logic | Via agent_runner |
| watchdog.py | Python | Monitoring & alerts | PM2/supervisord |
| journal.db | SQLite | Trade persistence | N/A |
| agents_db.json | JSON | Agent state | Written by agent_runner |

---

## Cross-References

- **Architecture details:** See `ARCHITECTURE.md`
- **Monitoring setup:** See `MONITORING.md`
- **Agent profiles:** See `docs/agents/`
- **Strategy design:** See `docs/strategies/`
- **Deployment:** See `DEPLOY.md`, `DEPLOY_GCP.md`
