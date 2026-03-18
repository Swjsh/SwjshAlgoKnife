# Product Roadmap

---
tags: #roadmap #planning
status: 🎯 Active
last_updated: 2026-03-15
---

> **⚠️ NOTE**: This is the **long-term strategic roadmap**. For daily/weekly/monthly planning, see:
> - [[🎯 Master Tracker]] - **YOUR SINGLE SOURCE OF TRUTH** for what's next
> - [[📅 Daily Log]] - Daily accountability and progress tracking
> - [[Current Sprint]] - Active sprint details

---

## Current Sprint: Backtest Harness & Pivot Pete

**Goal**: Build universal backtesting framework and stabilize Pivot Pete futures agent

### In Progress
- [ ] Universal backtest harness (`scripts/universal_backtest.py`)
- [ ] Pivot Pete real-data provider integration (Alpaca)
- [ ] Environment variable cleanup (consolidate duplicate vars)
- [ ] Historical data fetching for futures (ES, NQ, YM)

### Completed This Sprint
- [x] Fixed Pivot Pete startup issues (commit a334d20)
- [x] Added cron status snapshot script
- [x] Migrated to existing OANDA env vars
- [x] Updated architecture documentation

---

## Phase 1: Foundation ✅ COMPLETE

### Infrastructure
- [x] Next.js dashboard with dark mode
- [x] SQLite database schema
- [x] Agent Runner orchestrator
- [x] PM2/supervisord setup
- [x] Docker deployment
- [x] TradingView webhook integration

### Core Features
- [x] Real-time agent monitoring
- [x] Trade journal with PnL tracking
- [x] Strategy engine architecture
- [x] Risk management (position sizing)
- [x] Kill switch emergency halt

---

## Phase 2: Agent Development 🔧 IN PROGRESS

### Agents (Python)
- [x] Pivot Pete (Futures) - **In Development**
- [x] Boba Trades (Options) - **Needs Review**
- [x] Bitcoin Bob (Crypto) - **Needs Review**
- [x] SPX Sniper (Options) - **Needs Review**
- [x] Sterling FX (Forex) - **Needs Review**

### Testing & Validation
- [ ] **Universal backtest harness** ⬅️ Current focus
- [ ] Historical performance validation
- [ ] Paper trading week (see [[Paper Trading Week Plan]])
- [ ] Agent audit report
- [ ] Broker error recovery testing

---

## Phase 3: Strategy Expansion 📋 PLANNED

### New Strategies
- [ ] Market structure breaks
- [ ] Smart money concepts (SMC)
- [ ] Order flow imbalance
- [ ] Multi-timeframe confluence
- [ ] Fibonacci retracements

### Strategy Improvements
- [ ] Backtesting for all existing strategies
- [ ] Parameter optimization
- [ ] Win rate tracking
- [ ] Drawdown monitoring

---

## Phase 4: Intelligence Layer 📋 PLANNED

### On-Chain Analysis
- [ ] Whale tracker (large wallet movements)
- [ ] Smart money flows
- [ ] Exchange inflow/outflow

### Sentiment Analysis
- [ ] Twitter/X sentiment scraping
- [ ] News aggregation
- [ ] Fear & Greed Index integration

### Order Flow
- [ ] Level 2 data integration
- [ ] Time & Sales analysis
- [ ] Imbalance detection

**Files exist but not integrated**:
- `scripts/onchain/`
- `scripts/sentiment/`
- `scripts/run_whale_tracker.ts`
- `scripts/run_sentiment.ts`
- `scripts/run_orderflow.ts`

---

## Phase 5: Multi-User Platform 🔮 FUTURE

### Authentication & Accounts
- [x] Auth system implemented (Firebase)
- [x] User profiles (`src/app/profile/`)
- [x] Account management (`src/app/accounts/`)
- [ ] Multi-tenant database
- [ ] User-specific agent instances
- [ ] Billing/subscription system

### UI Enhancements
- [ ] Mobile responsive design
- [ ] Portfolio allocation charts
- [ ] Advanced analytics dashboard
- [ ] Custom strategy builder (visual)

---

## Phase 6: Advanced Features 🔮 FUTURE

### Broker Integrations
- [x] OANDA (Forex) ✅
- [x] Alpaca (Stocks/Options/Crypto) ✅
- [ ] Interactive Brokers
- [ ] TD Ameritrade
- [ ] Coinbase Advanced Trade

### Copy Trading
- [ ] Master/slave account linking
- [ ] Proportional position sizing
- [ ] Real-time trade mirroring

### Portfolio Management
- [ ] Multi-agent orchestration
- [ ] Capital allocation across agents
- [ ] Correlation analysis
- [ ] Risk-adjusted returns (Sharpe ratio)

---

## Technical Debt & Refactoring

### High Priority
- [ ] **Environment variable consolidation** (duplicate broker keys)
- [ ] Agent health monitoring improvements
- [ ] Database migration system (Prisma schema exists but not used)
- [ ] TypeScript strict mode fixes

### Medium Priority
- [ ] Component CSS cleanup (some files have excessive styles)
- [ ] API error handling standardization
- [ ] Test coverage (currently minimal)
- [ ] Logging standardization

### Low Priority
- [ ] Remove unused files (old breakroom page, old images)
- [ ] Code splitting optimization
- [ ] Bundle size reduction

---

## Known Issues & Blockers

### Critical
1. **Multiple agent instances** - Users running Python agents directly causes duplicates
   - **Fix**: Documentation + clearer startup instructions

### Important
2. **Broker error recovery** - See [[Broker Error Recovery Fix]]
3. **Environment variable chaos** - Multiple duplicate keys
4. **Agent status persistence** - `agents_db.json` can get stale

### Minor
5. **CSS inconsistencies** - Some dark mode values hardcoded
6. **Mobile UI** - Not optimized for small screens

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-15 | Build universal backtest harness | Need historical validation before live trading |
| 2026-03-10 | Migrate Pivot Pete to Alpaca data | OANDA futures data insufficient |
| 2026-03-05 | Use PM2 for local orchestration | Simpler than Docker for dev |
| 2026-03-01 | Hybrid TS/Python architecture | Leverage Python ML libs + TS frontend |

---

## Related Pages

- [[Current Sprint]]
- [[Paper Trading Week Plan]]
- [[Technical Debt]]
- [[Agent Audit]]
- [[Architecture Decisions]]
