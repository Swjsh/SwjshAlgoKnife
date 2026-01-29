# SwjshAlgoKnife - Development Plan

## Current State (Jan 27, 2026)
- Next.js 16 app with SQLite (better-sqlite3), Firebase auth, TradingView webhooks
- **Build is broken**: TypeScript error in `AgentChartView.tsx` (`vwap` not in `IndicatorState` type)
- Dev server runs but spams `SELECT * FROM trades` + `SELECT * FROM signals` every few seconds (likely a polling loop or re-render issue on dashboard)
- Only 2 git commits total — almost no version history safety net
- Massive codebase for the maturity level — lots of components, many likely half-wired

## The Problem
Too many features attempted at once, no incremental milestones. Things break in cascading ways because nothing is fully stabilized before moving on.

---

## Plan: Phases

### Phase 0: Stabilize (DO THIS FIRST)
**Goal:** App builds, runs, and doesn't spam logs. Clean baseline to build from.

- [ ] Fix TypeScript build error (add `vwap` to `IndicatorState` type)
- [ ] Audit and fix any other TS errors that surface
- [ ] Fix the polling/re-render issue causing log spam (likely dashboard fetching `/api/agents` on a tight interval or missing dependency array)
- [ ] Verify all API routes return valid responses (not 500s)
- [ ] `git commit` a clean, building baseline
- [ ] Set up proper `.gitignore` (ensure `journal.db`, `.env.local` excluded)

### Phase 1: Core Data Layer
**Goal:** Solid foundation — DB schema, types, and API routes that actually work.

- [ ] Audit SQLite schema vs TypeScript types — make them match exactly
- [ ] Add missing types (IndicatorState, Agent, Signal, etc.) to `types/index.ts`
- [ ] Ensure `initDB()` is called reliably on app start
- [ ] Write basic tests for DB operations (insert trade, query trades, insert signal)
- [ ] Clean up `agents_db.json` vs SQLite split — decide: one source of truth or clear separation
- [ ] `git commit` after each sub-task

### Phase 2: Dashboard That Works
**Goal:** Open the app, see real data, no crashes.

- [ ] Dashboard page loads without errors
- [ ] Agent cards show correct data from API
- [ ] Signals table displays recent signals
- [ ] Chart renders (even with dummy data if no live feed yet)
- [ ] Kill switch button works (toggles state, persists)
- [ ] `git commit`

### Phase 3: One Agent, End-to-End
**Goal:** ONE agent (The Professor — FX/ORB) runs a full simulated trade loop.

#### 3A: Webhook Intake
- [ ] TradingView webhook endpoint receives a POST, validates payload, writes to `signals` table
- [ ] Test with a curl/Postman request — confirm signal appears in DB
- [ ] `git commit`

#### 3B: Signal → Strategy Evaluation
- [ ] The Professor agent reads new signals from DB
- [ ] ORB 15m strategy evaluates the signal (entry conditions met? yes/no)
- [ ] If yes, outputs a trade intent (symbol, direction, entry price, stop, target)
- [ ] `git commit`

#### 3C: Simulated Execution
- [ ] Trade intent → simulated fill (no broker, just write to `trades` table with status OPEN)
- [ ] Friction simulator adds realistic slippage/latency
- [ ] `git commit`

#### 3D: Trade Lifecycle
- [ ] Monitor open trades — check exit conditions on new signals/data
- [ ] Close trade → update `trades` row (exit_price, pnl, status WIN/LOSS/BE)
- [ ] Write journal entry for the day
- [ ] `git commit`

#### 3E: Verify the Loop
- [ ] Send test webhook → signal created → strategy evaluates → trade opens → trade closes → P&L recorded
- [ ] Dashboard shows the trade in the agent's card
- [ ] `git commit`

### Phase 4: Journal & Analytics
**Goal:** See your trade history and performance.

- [ ] Journal page shows trades from DB
- [ ] Add/edit trade entries manually
- [ ] Basic stats: win rate, total P&L, trade count
- [ ] Daily P&L tracking in journal_entries table
- [ ] `git commit`

### Phase 5: Multi-Agent & Strategies
**Goal:** Multiple agents running different strategies simultaneously.

- [ ] Add second strategy (e.g., BB Breakout for crypto)
- [ ] Agent management: start/stop/configure per agent
- [ ] Per-agent performance tracking
- [ ] Agent sidebar shows live status
- [ ] `git commit`

### Phase 6: Live Trading Prep
**Goal:** Ready to connect to a real broker.

- [ ] OANDA broker integration (already have `lib/broker/oanda.ts`)
- [ ] Paper trading mode with real market data
- [ ] Proper error handling and recovery
- [ ] Alerting (trade notifications)
- [ ] Final risk engine review

---

## Rules Going Forward
1. **One phase at a time.** Don't start Phase N+1 until Phase N builds and works.
2. **Commit after every meaningful change.** Small commits > big bangs.
3. **Test before moving on.** At minimum: does it build? Does the page load? Does the API return data?
4. **Fix bugs before features.** If something breaks, stop and fix it.
5. **Types first.** Define the TypeScript types before writing the implementation.

---

## Status (Jan 28, 2026)

### ✅ Phase 0: Stabilize — DONE
### ✅ Phase 1: Core Data Layer — DONE  
### ✅ Phase 2: Dashboard That Works — DONE (verified API + UI renders)
### 🔄 Phase 3: One Agent, End-to-End
- ✅ 3A: Webhook intake works (signal → DB)
- ✅ 3B: Signal → executor processes it (BUY/SELL/EXIT)
- ✅ 3C: Simulated execution works (trade opens in DB)
- ✅ 3D: Trade lifecycle works (EXIT closes trade, calculates P&L)
- ⬜ 3E: Verify on dashboard + clean up old sim data

### What's actually broken / needs work:
1. **26K+ garbage trades** from old simulator spam — need DB cleanup
2. **Position sizing** is wrong for FX (92 lots on $10K account)
3. **Risk engine** needs FX-specific params (pip value, lot sizing)
4. **No strategy evaluation** — webhook goes straight to executor, no ORB logic
5. **The Professor agent** isn't wired up — it's just a persona, no code runs for FX/ORB
