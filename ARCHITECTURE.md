# Architecture Overview
This document serves as a critical, living template designed to equip agents with a rapid and comprehensive understanding of the Swjsh Algo-Knife codebase's architecture, enabling efficient navigation and effective contribution from day one. Update this document as the codebase evolves.

---

## 1. Project Structure
This section provides a high-level overview of the project's directory and file structure, categorized by architectural layer or major functional area.

```
SwjshAlgoKnife/
├── src/                    # Main application source code
│   ├── app/                # Next.js App Router pages and API routes
│   │   ├── api/            # Backend API endpoints (webhooks, agents, signals)
│   │   │   ├── agents/     # Agent management endpoints
│   │   │   ├── journal/    # Trade journal API
│   │   │   ├── signals/    # Signal processing
│   │   │   └── webhook/    # TradingView webhook receiver
│   │   ├── agents/         # Agent management pages
│   │   ├── dashboard/      # Main dashboard view
│   │   ├── journal/        # Trade journaling page
│   │   ├── login/          # Authentication page
│   │   ├── logs/           # System logs viewer
│   │   ├── research/       # Research tools page
│   │   ├── scanner/        # Market scanner page
│   │   ├── settings/       # User settings page
│   │   └── strategies/     # Strategy management page
│   ├── components/         # Reusable React UI components
│   │   ├── Agents/         # Agent-related components
│   │   ├── Dashboard/      # Dashboard widgets (Charts, Signals, etc.)
│   │   ├── Header/         # Navigation header
│   │   ├── Journal/        # Journal entry components
│   │   ├── Landing/        # Hero/landing page components
│   │   ├── Layout/         # Layout wrappers (Sidebar, Header)
│   │   ├── Navigation/     # Conditional navigation logic
│   │   ├── SaaSLanding/    # SaaS-style landing page
│   │   └── UI/             # Core UI primitives (GlassPanel, etc.)
│   ├── context/            # React Context providers
│   │   ├── AgentContext    # Agent state management
│   │   ├── AuthContext     # Firebase authentication state
│   │   └── StrategyContext # Active strategy state
│   ├── lib/                # Core libraries and utilities
│   │   ├── engine/         # Trading engine core
│   │   │   ├── executor    # Trade execution logic
│   │   │   ├── manager     # Agent lifecycle management
│   │   │   ├── risk/       # Risk engine (limits, correlation, kill switch)
│   │   │   ├── simulator   # Friction simulator (slippage, latency)
│   │   │   ├── strategies/ # Strategy implementations
│   │   │   └── local_runner/ # Node.js agent runner
│   │   ├── scanner/        # Market scanning utilities
│   │   ├── hooks/          # Custom React hooks
│   │   ├── firebase.ts     # Firebase client/admin initialization
│   │   ├── db.ts           # SQLite database connection (better-sqlite3)
│   │   └── utils/          # General utility functions
│   ├── middleware/         # Auth middleware for protected routes
│   └── types/              # TypeScript type definitions
├── public/                 # Static assets (images, icons)
├── docs/                   # Project documentation
│   ├── PRODUCT_SPEC.md     # Product specification
│   ├── TESTING.md          # Testing guide
│   ├── SECURITY_AUDIT.md   # Security considerations
│   ├── agents/             # Agent-specific documentation
│   └── strategies/         # Strategy documentation
├── scripts/                # Automation and deployment scripts
├── tests/                  # Unit and integration tests
├── testsprite_tests/       # Automated UI/E2E tests
├── data/                   # Local data files and JSON stores
├── backups/                # Database and config backups
├── maintenance/            # Maintenance scripts and utilities
├── theories/               # Trading theory documentation
├── journal.db              # SQLite trade journal database
├── firebase.json           # Firebase configuration
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── tailwind.config.js      # TailwindCSS configuration
├── vitest.config.ts        # Vitest test configuration
└── ARCHITECTURE.md         # This document
```

---

## 2. High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL SOURCES                                │
│    [TradingView]    [Yahoo Finance]    [Binance API]    [Finnhub API]       │
└────────┬──────────────────┬──────────────────┬────────────────┬─────────────┘
         │ Webhooks         │ FX Data          │ Crypto Data    │ Live Data
         ▼                  ▼                  ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NEXT.JS APPLICATION                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         API Routes (/api)                              │  │
│  │   [webhook/tradingview] → [signals] → [agents] → [journal]            │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│                                    ▼                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      TRADING ENGINE (src/lib/engine)                   │  │
│  │  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌───────────────┐            │  │
│  │  │ Manager │──│Executor │──│   Risk   │──│RegimeDetector │            │  │
│  │  │         │  │         │  │  Engine  │  │               │            │  │
│  │  └─────────┘  └─────────┘  └──────────┘  └───────────────┘            │  │
│  │       │            │                                                   │  │
│  │       ▼            ▼                                                   │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │  │
│  │  │         AUTONOMOUS AGENTS (The Squad)                            │ │  │
│  │  │  [Pivot Pete] [Boba] [SPX Sniper] [Professor] [Auditor]         │ │  │
│  │  └──────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│  ┌─────────────────────────────────┴─────────────────────────────────────┐  │
│  │                         FRONTEND (React/Next.js)                       │  │
│  │   [Landing] → [Login] → [Dashboard] → [Strategies] → [Journal]        │  │
│  │                                                                        │  │
│  │   Context Providers: [AuthContext] [StrategyContext] [AgentContext]   │  │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
         │                                          │
         ▼                                          ▼
┌─────────────────────┐                   ┌─────────────────────┐
│   Firebase (Auth)   │                   │ SQLite (journal.db) │
│   + Firestore       │                   │ Local Persistence   │
└─────────────────────┘                   └─────────────────────┘
```

---

## 3. Core Components

### 3.1. Frontend

**Name:** Swjsh Algo-Knife Web App

**Description:** A premium trading terminal interface featuring a SaaS-style design with glassmorphism effects, particle animations, and dark/light theming. Users authenticate, view market data, manage autonomous trading agents, and review trade journals.

**Technologies:**
- Next.js 16.1.1 (App Router)
- React 19.2.3
- TypeScript 5.x
- Framer Motion (animations)
- Vanilla CSS Modules (styling)
- TailwindCSS 4.x (utility support)
- Lucide React (icons)
- Lightweight Charts (trading charts)

**Deployment:** Vercel (planned), with Oracle Cloud Free Tier as backend option

---

### 3.2. Backend Services

#### 3.2.1. Next.js API Routes

**Name:** Internal API Layer

**Description:** Handles webhook ingestion from TradingView, manages agent state, processes signals, and serves journal data. All routes are under `/api/`.

**Technologies:** Next.js API Routes (Node.js runtime)

**Key Endpoints:**
- `POST /api/webhook/tradingview` - Receives trading signals
- `GET/POST /api/agents` - Agent CRUD operations
- `GET/POST /api/journal` - Trade journal entries
- `GET /api/signals` - Signal data retrieval
- `GET /api/agent-status` - Agent health monitoring

**Deployment:** Vercel Serverless Functions

---

#### 3.2.2. Trading Engine

**Name:** Algo-Knife Trading Engine

**Description:** Core execution engine that manages autonomous trading agents, validates signals against risk parameters, and simulates market friction.

**Technologies:** TypeScript, Node.js

**Key Modules:**
- `manager.ts` - `EngineManager` class. Manages strategy lifecycle, simulation loop (development), and signal event bus.
- `executor.ts` - `TradeExecutor` class. Handles trade entry/exit, P/L calculation, SQLite recording, and **Firebase Cloud Sync**.
- `risk.ts` - `RiskManager`. Calculates position sizing and validates trades against account limits.
- `simulator.ts` - `MarketSimulator`. Generates ticks for local testing.

**Implemented Strategies (in `manager.ts`):**
1. **ORB 15m** - Opening Range Breakout (Futures)
2. **NeverStoppedOut ORB** - Advanced ORB with wide range threshold (Futures)
3. **S&R Rejection** - Support & Resistance zone trading (Crypto/Forex)
4. **VWAP Reversion** - Mean reversion to Volume Weighted Average Price (Crypto)
5. **BB Squeeze** - Bollinger Band volatility breakout (Crypto/Forex)
6. **Grid Trading** - Automated grid execution (Crypto/Forex)
7. **Three Ducks** - Moving average trend following (Forex)

---

#### 3.2.3. Autonomous Agent Squad

**Name:** The Squad

**Description:** A collection of specialized trading agents with distinct responsibilities.

| Agent | Role |
|-------|------|
| **Pivot Pete** | Forex price action & supply/demand specialist |
| **Boba** | Institutional flow & liquidity analyzer |
| **SPX Sniper** | 0DTE options high-frequency execution |
| **The Professor** | Post-trade analysis & grading (A-F) |
| **The Auditor** | Verification agent for data integrity |

---

## 4. Data Stores

### 4.1. SQLite (Local)

**Name:** Trade Journal Database

**Type:** SQLite (via `better-sqlite3`)

**Purpose:** Stores trade history, signals, journal entries, and settings for local persistence.

**Key Tables:**
- `trades` - Trade records (symbol, direction, PnL, status)
- `signals` - Incoming signal log
- `journal_entries` - Daily journal with PnL, mood, notes
- `settings` - Key-value configuration store

**File:** `journal.db` (project root)

---

### 4.2. Firebase Firestore

**Name:** Cloud Configuration Store

**Type:** Firebase Firestore + Realtime Database

**Purpose:** User authentication, agent configurations, and **real-time trade syncing**.
- **Auth:** Handles user identity via Google/Email.
- **Realtime Database:** The `TradeExecutor` optionally syncs open/closed trades to `/trades/{id}` for remote monitoring if `NEXT_PUBLIC_FIREBASE_API_KEY` is present.

---

## 5. External Integrations / APIs

| Service | Purpose | Integration Method |
|---------|---------|-------------------|
| **Firebase Auth** | User authentication (Google, Email/PW) | Firebase SDK |
| **TradingView** | Trading signal reception | Webhook (POST) |
| **Yahoo Finance** | Forex market data | REST API |
| **Binance API** | Cryptocurrency market data | REST API |
| **Finnhub** | Real-time stock/index data | REST API + WebSocket |

---

## 6. Deployment & Infrastructure

**Cloud Provider:** Vercel (primary), Oracle Cloud Free Tier (planned backend)

**Key Services Used:**
- Vercel Serverless Functions (API Routes)
- Firebase Authentication
- Firebase Realtime Database / Firestore
- SQLite (local development)

**CI/CD Pipeline:** Vercel Git Integration (auto-deploy on push)

**Monitoring & Logging:**
- Vercel Analytics
- Console logging (development)
- Custom `/logs` page in dashboard

---

## 7. Security Considerations

**Authentication:**
- Firebase Authentication (OAuth2 via Google, Email/Password)
- JWT tokens for session management

**Authorization:**
- Route-level middleware (`src/middleware/authMiddleware.ts`)
- Protected routes require valid Firebase session

**Data Encryption:**
- TLS in transit (HTTPS enforced)
- Firebase handles encryption at rest

**Key Security Practices:**
- Environment variables for all secrets (`.env.local`)
- No client-side exposure of admin credentials
- Webhook signature validation (planned)

---

## 8. Development & Testing Environment

**Local Setup Instructions:**
```bash
# Clone the repository
git clone <repository-url>
cd SwjshAlgoKnife

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Firebase credentials

# Run development server
npm run dev
```

**Testing Frameworks:**
- Vitest (unit testing)
- Testing Library (React component testing)
- TestSprite (automated E2E testing)

**Code Quality Tools:**
- TypeScript (strict mode)
- ESLint (via Next.js defaults)

---

## 9. Future Considerations / Roadmap

- [ ] Migrate backend to Oracle Cloud Free Tier for 24/7 agent execution
- [ ] Implement WebSocket connections for real-time data streaming
- [ ] Add broker API integration (Alpaca, Interactive Brokers)
- [ ] Multi-user portfolio management and permissions
- [ ] Mobile-responsive PWA optimization
- [ ] Enhanced RegimeDetector with ML classification

---

## 10. Project Identification

**Project Name:** Swjsh Algo-Knife (AK)

**Repository URL:** (Local Development)

**Primary Contact/Team:** Jack W.

**Date of Last Update:** 2026-01-01

---

## 11. Glossary / Acronyms

| Term | Definition |
|------|------------|
| **AK** | Algo-Knife - The product codename |
| **0DTE** | Zero Days To Expiration (same-day options) |
| **FX** | Foreign Exchange (currency trading) |
| **PnL** | Profit and Loss |
| **SPX** | S&P 500 Index |
| **The Squad** | Collective name for autonomous trading agents |
| **RiskEngine** | Module enforcing trade limits and risk rules |
| **RegimeDetector** | Market state classifier (Trending/Ranging/Volatile) |
| **KillSwitch** | Emergency halt mechanism for agents |
| **GlassPanel** | UI component with glassmorphism styling |
