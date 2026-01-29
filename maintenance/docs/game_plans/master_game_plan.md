# Master Game Plan: Operation "Paper FX" & The Command Center

**Objective**: Launch live paper trading for 5 Forex pairs today, unify the Agent Ecosystem features (Professor/Auditor), and transform the UI into an Agent Command Center.

**Philosophy**: The User is the Commander. The Agents are the Heroes. The Backend is the Engine.

---

## 🏗 Phase 1: Backend Core (The Engine) - ✅ COMPLETE
*Goal: Get Agents trading 5 FX pairs and reporting correctly to the Professor.*

### 1.1 Multi-Pair "Real-Time-Ish" Data (Forex)
*   **Problem**: Currently single-threaded, EURUSD only.
*   **Solution**: Upgrade `YahooFinance.ts` and `MarketData.ts`.
*   **Action Items**:
    *   [x] Modify `YahooFinance.ts` to accept an array: `['EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'AUDUSD=X', 'USDCAD=X']`.
    *   [x] Optimize polling: Cycle through pairs every 2 seconds (10s total cycle) to avoid rate limits while keeping data "fresh".
    *   [x] Update `MarketData.ts` to emit standardized ticks for all 5 pairs.

### 1.2 Persistent "Memory"
*   **Problem**: Restarting the runner wipes active trades.
*   **Solution**: Move state to `agents_db.json`.
*   **Action Items**:
    *   [x] Remove in-memory `activeTrades` array from `agent_runner.ts`.
    *   [x] Read/Write active trades directly to `db[agentId].active_trades` (New Field).
    *   [x] On startup, load active trades back into the `StrategyLoop`.

### 1.3 The Unified Audit Loop (Fixing the Blind Spot)
*   **Problem**: Python agents (Boba, SPX) trade in secret. Professor doesn't see them.
*   **Solution**: A "Watcher" loop in the main runner.
*   **Action Items**:
    *   [x] Create `checkForUngradedTrades()` function in `agent_runner.ts`.
    *   [x] Logic: Scan `db.boba.closed_trades`, `db.spx.closed_trades`, etc.
    *   [x] If a trade ID is NOT in `db.professor.reviews`, trigger `TheProfessor.gradeTrade()`.
    *   [x] Trigger `TheAuditor.auditReview()` immediately after.
    *   [x] **Result**: 100% of trades, regardless of source, get graded.

---

## 📡 Phase 2: Data Architecture (The Nervous System) - ✅ COMPLETE
*Goal: Ensure the UI sees everything the backend does in real-time.*

### 2.1 AgentContext API
*   **Problem**: UI components fetch data haphazardly.
*   **Solution**: A unified React Context.
*   **Action Items**:
    *   [x] Create `src/context/AgentContext.tsx`.
    *   [x] Fetch `agents_db.json` every 5 seconds (SWR or polling).
    *   [x] **Exports**:
        *   `agents`: All agent data.
        *   `activeTrades`: Flat list of all live trades across all agents.
        *   `systemStatus`: Aggregated health check (e.g., "All Systems Functional").
        *   `totalPnL`: Computed daily PnL sum.

### 2.2 SquadStatusWidget Data Hook
*   **Action Items**:
    *   [x] Create hook `useSquadStatus()` that consumes `AgentContext`.
    *   [x] Returns: `{ activeCount, totalRisk, topPerformer }` for the header widget.

---

## 🖥 Phase 3: UI Overhaul (The Command Center)
*Goal: Visualize the "Heroes" at work.*

### 3.1 The Dashboard (Command Deck)
*   **Action Items**:
    *   [ ] **Header**: Implement `SquadStatusWidget` (Active Agents, PnL, System Status).
    *   [ ] **Main View**: Convert "Trading Chart" to "Tactical Map".
        *   Overlay active "Zones" (Supply/Demand) from all agents.
        *   Show "Sniper Scopes" (price levels being watched).
    *   [ ] **Removal**: Hide manual `OrderPanel` (Commanders don't day-trade).

### 3.2 The Agents Page (The Barracks)
*   **Action Items**:
    *   [ ] **Live Feed**: Add a "Terminal" view showing the unified log (FX, Boba, Professor updates mixed together).
    *   [ ] **Performance Cards**: Add "Last Grade" badge to agent cards (e.g., "Last Trade: A-").

---

## ✅ Success Metrics (Definition of Done)

### Functional
1.  **Multi-Pair FX**: System logs show ticks for EUR, GBP, JPY, AUD, CAD.
2.  **Persistence**: Kill terminal -> Restart -> Active trades reappear.
3.  **Audit Coverage**: Perform a Boba backtest -> Wait 10s -> See 100% of trades graded in `agents_db.json`.
4.  **Paper Trading**: System executes at least 5 trades in a 6-hour session without crashing.

### Visual
1.  **Dashboard**: Header shows correct "Total PnL" summing FX + Crypto + Options.
2.  **Feedback**: Professor's critiques appear in the UI log within 30s of a trade closing.

---

## 🚀 Execution Order
1.  **Backend Core** (Files: `YahooFinance.ts`, `agent_runner.ts`)
2.  **Audit Loop** (Files: `agent_runner.ts`, `TheProfessor.ts`)
3.  **AgentContext** (Files: `AgentContext.tsx`)
4.  **UI Components** (Files: `page.tsx`, new widgets)

*Ready to execute Phase 1.*
