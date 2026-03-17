# SwjshAK: Algorithmic Trading Platform

SwjshAK (Swjsh Army Knife) is a comprehensive algorithmic trading platform that combines real-time market scanning, autonomous trading agents, and intelligent trade execution across multiple asset classes. Built with a cyber-industrial dark-mode aesthetic, it delivers institutional-grade trading automation with human oversight and performance analysis.

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.9+ (for trading agents)
- SQLite (included via better-sqlite3)

### Installation & Launch

```bash
# Clone and install dependencies
npm install

# Set up environment (see Configuration section below)
cp .env.example .env.local

# Start the entire system (Windows)
./START_SWJSH.ps1

# OR start in development mode
npm run dev

# Dashboard available at: http://localhost:3000
```

For Docker deployments:
```bash
docker compose up -d
```

## Architecture Overview

SwjshAK employs a modular hybrid architecture combining TypeScript (orchestration and UI) with Python (market-specific agents):

- **Frontend**: Next.js 15 App Router with React, glassmorphic UI design, real-time WebSocket feeds
- **Backend**: Node.js API routes with SQLite data persistence
- **Database**: SQLite (`better-sqlite3`) with trade, signal, journal, and settings tables
- **Agent System**: TypeScript orchestrator (`agent_runner.ts`) spawning managed Python subprocesses
- **Core Engine**: StrategyLoop, MarketData, TheProfessor (trade review), TheAuditor (fact-checking)
- **Real-time Monitoring**: Agent terminal dashboard with live status updates

## Key Features

- **Five Autonomous Agents**: Specialized traders for different asset classes (futures, options, forex, crypto)
- **Strategy Backtesting**: Built-in historical analysis and simulation framework
- **Emergency Killswitch**: One-command system halt with graceful recovery
- **LLM Control API**: HTTP endpoints for programmatic system control from any chat interface
- **Trade Journaling**: Detailed entry/exit logging with performance metrics and mood tracking
- **Intelligence Pipeline**: Automated trade review (TheProfessor) and validation (TheAuditor)
- **Multi-Market Support**: Forex, Crypto, Options, Futures with shared strategy framework
- **Real-time Monitoring**: Live agent dashboard with execution status and P&L tracking

## Agents

Each agent specializes in specific market conditions and asset classes:

| Agent | Specialization | Market | Description |
|-------|----------------|--------|-------------|
| **SPX Sniper** | Precision index options | Options/SPX | High-probability mean-reversion setups on the S&P 500 index |
| **Boba Trades** | Short-dated option strategies | Options | Volatility-driven premium income and directional plays on options chains |
| **Sterling FX** | Institutional forex strategies | Forex | Multi-timeframe trend following with 4H/1H/5M alignment (Three Ducks) |
| **Pivot Pete** | Futures opening range breakouts | Futures/ES | Session-open volatility capture on ES with advanced range detection |
| **Bitcoin Bob** | Crypto momentum trading | Crypto | Algorithmic swing trading on BTC/ETH with technical pattern recognition |

## Core Strategies

- **ORB (Opening Range Breakout)**: Futures — Captures first 15-minute session volatility
- **NeverStoppedOut**: Advanced ORB variant with wide-range detection and higher-timeframe bias
- **Support/Resistance**: Multi-market zone-based mean reversions
- **VWAP Reversion**: Institutional volume-weighted anchor mean reversion
- **Bollinger Band Breakout**: Squeeze detection and volatility expansion trades
- **Three Ducks**: Forex trend-following with timeframe alignment (4H/1H/5M)
- **Grid Trading**: Range-bound profit stacking on sideways markets

## API Endpoints

Control and monitor the trading system via HTTP:

### Control & Status
- `GET /api/control` — Full system status and agent summary
- `POST /api/control` — Command execution (summary, pause, resume, killswitch, killswitch_reset)
- `GET /api/health` — System health check

### Signals & Execution
- `POST /api/webhook/tradingview` — Receive TradingView alerts (requires `X-Webhook-Secret` header)
- `POST /api/signals` — Manual signal submission
- `GET /api/signals` — Retrieve active signals

### Trading Journal
- `POST /api/journal` — Create trade entries
- `GET /api/journal` — Fetch trades and journal entries
- `PUT /api/journal/:id` — Update existing entry
- `DELETE /api/journal/:id` — Archive trade record

### Agents
- `GET /api/agents` — List all agents and their status
- `GET /api/agents/:agentId` — Individual agent details
- `POST /api/agents/:agentId/chat` — Send message to agent terminal

### Intelligence
- `GET /api/intel` — Pre-market opportunity scanner results
- `POST /api/intel/analyze` — Custom market analysis request

### Emergency Control
- `POST /api/killswitch` — Halt all trading immediately
- `POST /api/killswitch/reset` — Resume trading after killswitch

## Development Commands

```bash
npm run dev                      # Start Next.js dev server (localhost:3000)
npm run build                    # Production build
npm start                        # Production server (dashboard only)
npx tsx scripts/agent_runner.ts  # Standalone agent runner (development)
npm test                         # Run test suite
npm run test:ui                  # Interactive test UI
npm run test:coverage            # Coverage report
```

## Configuration

### Environment Setup

Copy the example configuration and customize:

```bash
cp .env.example .env.local
```

Required environment variables:

```env
# Webhook authentication (production)
WEBHOOK_SECRET=your_secret_here

# Trading account configuration
ACCOUNT_BALANCE=10000
RISK_PER_TRADE=1

# Database
DATABASE_URL=sqlite:./trading.db

# Optional: TradingView integration
TRADINGVIEW_API_KEY=your_key_here

# Optional: Broker APIs (depends on agent configuration)
BROKER_API_KEY=your_key_here
BROKER_API_SECRET=your_secret_here
```

See `.env.example` for complete configuration options.

## Project Structure

```
.
├── src/
│   ├── app/                      # Next.js 15 App Router
│   │   ├── api/                  # Route handlers (REST API)
│   │   ├── agents/               # Agent dashboard page
│   │   ├── journal/              # Trade journal interface
│   │   ├── scanner/              # Pre-market scanner UI
│   │   └── globals.css           # Design system (HSL variables)
│   ├── components/
│   │   ├── Layout/               # Sidebar, Header, Navigation
│   │   ├── Dashboard/            # TradingChart, ActiveSignals, StrategyPanel
│   │   ├── Journal/              # TradeList, EntryForm, Analytics
│   │   ├── Agents/               # AgentTerminal, StatusCards
│   │   └── UI/                   # GlassPanel, Buttons, Theming
│   └── lib/
│       ├── db.ts                 # SQLite initialization & schema
│       ├── engine/
│       │   ├── manager.ts        # Strategy registry & orchestration
│       │   ├── types.ts          # BaseStrategy interface
│       │   ├── risk.ts           # Position sizing calculator
│       │   ├── executor.ts       # Trade execution interface
│       │   ├── strategies/       # Individual strategy implementations
│       │   └── local_runner/     # Core engine (MarketData, StrategyLoop, TheProfessor, TheAuditor)
│       └── scanner/
│           └── engine.ts         # Pre-market opportunity detection
├── scripts/
│   ├── agent_runner.ts           # Multi-agent orchestrator (MAIN ENTRY POINT)
│   ├── *_engine.py               # Python agents (Pivot Pete, Boba, SPX Sniper, etc.)
│   └── requirements_*.txt        # Python dependencies per agent
├── START_SWJSH.ps1               # Windows launch script (PM2 orchestration)
├── docker-compose.yml            # Container orchestration
└── README.md                      # This file
```

## Database Schema

SQLite provides four core tables:

- **trades**: Entry/exit records with entry price, exit price, PnL, and timestamp
- **signals**: Incoming alerts from TradingView, strategies, or manual submission
- **journal_entries**: Daily trade reviews, performance notes, and trader mood logs
- **settings**: Key-value configuration store for runtime parameters

Auto-initialized on first run via `src/lib/db.ts`.

## System Operation

### Data Flow

1. **Market Input** → TradingView webhooks (or API) → `/api/webhook/tradingview` → SQLite `signals` table
2. **Strategy Evaluation** → `StrategyLoop.processTick()` → Signal generation → Agent execution decision
3. **Trade Execution** → TradeExecutor → `trades` table → Position tracking
4. **Review Pipeline** → TheProfessor (automated grading) → TheAuditor (fact-checking) → Performance insights

### Agent Lifecycle

- **Startup**: `agent_runner.ts` spawns Python subprocesses with environment inheritance
- **Status Updates**: Agents output `AGENT_STATUS_UPDATE:{json}` to stdout, parsed by orchestrator
- **State Storage**: Agent state persisted in `src/app/api/agents/agents_db.json`
- **Auto-Restart**: Crashed agents automatically restart within 30 seconds
- **Graceful Shutdown**: Killswitch signal propagates to all agents; they flush pending trades and exit

## Tech Stack

- **Runtime**: Node.js 18+, Python 3.9+
- **Frontend Framework**: Next.js 15 (App Router), React 19
- **UI/Charts**: TradingView Lightweight Charts, Framer Motion, Lucide icons
- **Styling**: Vanilla CSS Modules with HSL design system
- **Database**: SQLite 3 (better-sqlite3)
- **Testing**: Vitest with Testing Library
- **TypeScript**: Full type safety
- **State**: React Context (real-time data feeds, no external state library)
- **HTTP Client**: Fetch API, WebSockets for live feeds

## Performance Notes

- Database auto-initialized on first run with pre-optimized indexes
- Simulation loop disabled by default to prevent test data noise
- Agent processes isolated as child processes with independent memory
- All timestamps in ISO 8601 format for consistency
- PnL calculations: crypto in dollars, forex in standard lot units (100k)
- Real-time WebSocket feeds reduce polling overhead on dashboard

## Contributing

When adding new features:

1. **New Strategies**: Create file in `src/lib/engine/strategies/`, extend `BaseStrategy`, register in `EngineManager`
2. **New Agents**: Create Python script in `scripts/`, implement status output format, update `agent_runner.ts` spawn list
3. **API Routes**: Add handler to `src/app/api/`, follow existing error handling and auth patterns
4. **UI Components**: Place in `src/components/`, respect glassmorphism design system in `globals.css`
5. **Tests**: Colocate with components/functions as `.test.ts`

## Troubleshooting

For detailed troubleshooting, architecture diagrams, and known issues, see the Obsidian vault at:
```
C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\
```

Key reference documents:
- `System Architecture.md` — Component interactions
- `Agent System.md` — Agent configuration and status
- `Troubleshooting.md` — Common issues and fixes
- `LLM Control API.md` — API command reference

## License

Proprietary — SwjshAK Trading Platform
