# Architecture Overview
This document is a living map of the Swjsh Algo‑Knife codebase. It should stay accurate to what’s in the repo **today** so new work can start fast and safely.

---

## 1. Project Structure (Current)

```
SwjshAlgoKnife/
├── src/                     # Main application source
│   ├── app/                 # Next.js App Router pages + API routes
│   │   ├── api/             # Backend endpoints
│   │   │   ├── agent-status # Agent status read/write endpoints
│   │   │   ├── agents       # Agent CRUD + metadata
│   │   │   ├── journal      # Trade journal API
│   │   │   ├── killswitch   # Emergency stop/kill routes
│   │   │   ├── signals      # Signal ingestion + history
│   │   │   └── webhook      # TradingView webhook receiver
│   │   ├── agent/           # Agent detail view
│   │   ├── agents/          # Agent management UI
│   │   ├── breakroom/       # UI playground / misc
│   │   ├── dashboard/       # Main dashboard
│   │   ├── journal/         # Trade journal UI
│   │   ├── lab/             # Experiments / sandbox UI
│   │   ├── login/           # Auth
│   │   ├── logs/            # System logs UI
│   │   ├── research/        # Research tools
│   │   ├── scanner/         # Market scanner
│   │   ├── settings/        # User settings
│   │   └── strategies/      # Strategy management UI
│   ├── agents/              # Agent runners (TS)
│   │   └── futures-agent.ts # Pivot Pete runner (paper)
│   ├── components/          # Reusable React components
│   │   ├── Agents/          # Agent widgets
│   │   ├── Dashboard/       # Dashboard widgets
│   │   ├── Journal/         # Journal UI
│   │   ├── Landing/         # Landing / marketing
│   │   └── UI/              # UI primitives
│   ├── context/             # React context
│   ├── lib/                 # Core libraries
│   │   ├── broker/          # Broker integrations (ex: Oanda)
│   │   ├── data-providers/  # Market data sources (ex: Alpaca)
│   │   ├── engine/          # Trading engine core
│   │   │   ├── local_runner # Local runner / loops
│   │   │   ├── risk/        # Risk helpers
│   │   │   ├── strategies/  # Strategy implementations
│   │   │   ├── executor.ts  # Trade execution + accounting
│   │   │   ├── manager.ts   # Engine orchestration
│   │   │   ├── paper-trading.ts # Paper trading engine
│   │   │   ├── risk.ts      # Risk manager
│   │   │   ├── simulator.ts # Market simulation helpers
│   │   │   └── types.ts     # Engine types
│   │   ├── firebase/        # Firebase helpers
│   │   ├── hooks/           # Custom hooks
│   │   ├── scanner/         # Scanning utilities
│   │   └── utils/           # Misc helpers
│   └── middleware/          # Auth middleware
├── scripts/                 # Backtests, runners, utilities
├── tests/                   # Unit/integration tests
├── testsprite_tests/        # UI/E2E tests
├── data/                    # Local status JSON + artifacts
├── logs/                    # Local log files
├── docs/                    # Product docs
├── theories/                # Trading theory notes
├── journal.db               # SQLite journal DB
└── ARCHITECTURE.md          # This file
```

---

## 2. High‑Level System Diagram (Current)

```
┌────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SOURCES                       │
│   [TradingView Webhooks]   [Alpaca Market Data]   [Oanda]       │
└───────────┬──────────────────────┬────────────────────┬────────┘
            │                      │                    │
            ▼                      ▼                    ▼
┌────────────────────────────────────────────────────────────────┐
│                      NEXT.JS APPLICATION                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                         API ROUTES                         │  │
│  │  /api/webhook → /api/signals → /api/agents → /api/journal  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                               │                                 │
│                               ▼                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 TRADING ENGINE (src/lib/engine)            │  │
│  │  manager → executor → risk → paper‑trading → simulator     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                               │                                 │
│                               ▼                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                AGENTS / RUNNERS (src/agents)               │  │
│  │                 futures-agent.ts (Pivot Pete)              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                               │                                 │
│                               ▼                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   FRONTEND (React/Next.js)                 │  │
│  │ Dashboard • Strategies • Agents • Journal • Logs           │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
            │                                │
            ▼                                ▼
┌───────────────────────┐          ┌──────────────────────────┐
│ SQLite (journal.db)   │          │ data/*.json + logs/*.log  │
│ local persistence     │          │ local status + artifacts  │
└───────────────────────┘          └──────────────────────────┘
```

---

## 3. Core Components

### 3.1 Frontend
**Name:** Swjsh Algo‑Knife Web App

**Description:** Trading terminal UI for monitoring agents, strategy configs, and trade journaling.

**Tech:** Next.js (App Router), React, TypeScript, CSS Modules, Tailwind utilities.

---

### 3.2 Backend (Next.js API Routes)
Handles TradingView webhooks, signals, agent state, and journal data.

**Key endpoints:**
- `POST /api/webhook/tradingview`
- `GET/POST /api/signals`
- `GET/POST /api/agents`
- `GET/POST /api/journal`
- `GET/POST /api/agent-status`
- `POST /api/killswitch`

---

### 3.3 Trading Engine (`src/lib/engine`)
**Purpose:** Strategy execution, paper trading, and risk validation.

**Key files:**
- `manager.ts` — Orchestrates strategies + loops
- `executor.ts` — Executes trades + updates account state
- `paper-trading.ts` — Paper trading engine + stats
- `risk.ts` — Risk validation helpers
- `simulator.ts` — Market simulation support
- `types.ts` — Candle, Signal, Trade, etc.

**Strategies (`src/lib/engine/strategies`):**
- `pivot.ts` (Pivot Pete)
- `orb.ts`, `neverStoppedOut.ts`
- `suppRes.ts`, `vwapReversion.ts`, `bbBreakout.ts`
- `gridTrading.ts`, `threeDucks.ts`, `setAndForget.ts`

---

### 3.4 Agents (`src/agents`)
- `futures-agent.ts` — Pivot Pete runner (paper trading loop)

---

## 4. Data Stores

### 4.1 SQLite (local)
- `journal.db` — trade journal + settings

### 4.2 Local JSON + Logs
- `data/*.json` — agent status + backtest artifacts
- `logs/*.log` — runtime/backtest logs

---

## 5. External Integrations (Current)

| Service | Purpose | Integration |
|---|---|---|
| **TradingView** | Signal ingestion | Webhook (`/api/webhook/tradingview`) |
| **Alpaca** | Market data (ETF proxy for futures) | `src/lib/data-providers/alpaca.ts` |
| **Oanda** | Broker integration (FX) | `src/lib/broker/oanda.ts` |

---

## 6. Scripts & Backtests
- `scripts/pivot-pete-backtest.ts` — TS backtest runner (Alpaca or synthetic)
- Other runners/utilities live under `scripts/`

---

## 7. Deployment & Ops
- Local development (primary)
- Vercel is listed as target for Next.js UI/API

---

## 8. Security Notes
- Secrets stored in `.env.local`
- Webhook auth/signature validation is a TODO (not enforced everywhere)

---

## 9. Roadmap Notes (Practical)
- Replace ETF proxy with true futures data feed when available
- Tighten backtest realism (slippage, commissions)
- Standardize agent status schema + health checks

---

## 10. Project Identification
**Project:** Swjsh Algo‑Knife (AK)
**Primary Contact:** Jack W.
**Last Update:** 2026‑02‑22
