# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SwjshAK (Swjsh Army Knife)** is an algorithmic trading platform focused on live market scanning, strategy execution, and trade journaling across multiple asset classes (Forex, Crypto, Options, Futures). The platform features autonomous trading agents with real-time monitoring and performance tracking.

**Design Philosophy**: "Cyber-Industrial" dark mode aesthetic with glassmorphism, electric cyan primary (`#06b6d4`), and neon purple accents (`#a855f7`).

## Key Commands

### Development
```bash
# Start the Next.js dashboard (opens to http://localhost:3000/agents)
npm run dev

# Build production bundle
npm run build

# Start production server
npm start
```

### Standalone Scripts
```bash
# Initialize/reset the SQLite database
npx tsx scripts/init-db.ts

# Start autonomous trading agents (TypeScript + Python)
npx tsx scripts/agent_runner.ts

# Run specific Python agents
python scripts/run_pivot_pete.py     # Futures agent
python scripts/run_boba.py           # Options agent
python scripts/run_spx_sniper.py     # SPX Options agent
```

### PowerShell Shortcuts (Windows)
```powershell
# Start trading bot system
./START_BOT.ps1

# Start dashboard and open browser
./START_DASHBOARD.ps1
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
