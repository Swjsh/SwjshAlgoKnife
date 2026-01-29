# Mission "Command Center": Frontend Redesign Plan

**Objective**: Transform Swjsh Algo Knife from a generic "Trading Terminal" into an **Agent Command Center**.
**Philosophy**: You are the Commander. You do not trade. You monitor, configure, and authorize.

---

## 🚫 The Problem: Current State
*   **Dashboard (`/`)**: A manual trading interface. Huge Chart + `OrderPanel` (Buy/Sell buttons) dominate 80% of the screen. **Useless for a Commander.**
*   **Navigation**: "Strategies" and "Research" clutter the sidebar.
*   **Journal**: A manual diary requiring you to type entries. Detached from Agent activity.
*   **Agents**: Hidden behind a menu click. Finding "What is Boba doing?" takes too many clicks.

---

## 🏗 The Solution: New Architecture

### 1. New Dashboard: "The Squad Grid" (Home)
*   **Concept**: A high-level tactical overview of your fleet.
*   **Layout**: A dynamic grid of **Agent Status Cards**.
*   **Card Content (Per Agent)**:
    *   **Header**: Avatar + Name + Status Dot (Pulsing Green = Active).
    *   **Body**: Current Action (e.g., "Scanning EURUSD", "LONG SPY @ 4450", "Waiting for open").
    *   **Footer**: Day's PnL (Large Font) + Win Rate.
    *   **Action**: Click card → Deep Dive (Agent Detail).
*   **Global Widget**: `SquadStatusWidget` (Active Trades, Total Risk) stays at the top.

### 2. Streamlined Navigation
*   **Sidebar Items**:
    1.  **Command** (Home/Dashboard)
    2.  **Mission Logs** (Renamed from Journal)
    3.  **Arsenal** (Renamed from Strategies)
    4.  **Settings**
*   **The "Agents" Tab**: Removed. Agents are accessed directly from the **Command** grid.

### 3. Agent Detail View ("The Cockpit")
*   **Access**: Click an Agent Card on Home.
*   **Layout**:
    *   **Left Col (Identity)**: Avatar, "Bio/Persona" (from `The_Overseer.md`, etc.), Current Mode (Aggressive/Conservative).
    *   **Center (Live Feed)**: The "Chat" interface, but focused on log outputs/thoughts.
    *   **Right Col (Stats)**: "Last 5 Trades", "Active Zones", "Performance Graph".
    *   **Tabs**: "Configuration" (Strategy Toggles specific to this agent) | "History" (Filtered Journal).

### 4. Journal → "Mission Logs"
*   **Concept**: Automatic System of Record.
*   **Behavior**:
    *   Auto-populated by `agents_db.json`.
    *   **Professor's Grade** prominently displayed for every entry.
    *   **The Auditor's Stamp** (verified/flagged) next to the grade.
    *   Filter by Agent (e.g., "Show only Boba's failures").
*   **Manual Entry**: Still possible, but secondary ("Commander's Notes").

---

## 🎨 Aesthetic "Vibe Check"
*   **Less**: Generic candlestick charts, Buy/Sell buttons, empty forms.
*   **More**: Avatars, Status Indicators, System Logs, Performance Badges.
*   **Visual Language**:
    *   **Active**: Neon Green / Gold.
    *   **Idle**: Dimmed / Translucent.
    *   **Error/Risk**: Flashing Red.

---

## 📅 Implementation Roadmap

### Phase 1: The Squad Grid (Home)
1.  Create `components/Dashboard/AgentCard.tsx`.
2.  Replace `components/Dashboard/MarketOverview` & `OrderPanel` on `page.tsx` with a Grid Layout.
3.  Connect Cards to `AgentContext` data.

### Phase 2: Agent Detail Routes
1.  Create dynamic route `app/agent/[id]/page.tsx`.
2.  Move `app/agents/page.tsx` logic into this specifically focused view.
3.  Add "Configuration" tab to toggle strategies directly.

### Phase 3: Mission Logs
1.  Rename `app/journal` to `app/logs`.
2.  Rewrite `TradeList` to consume `AgentContext.closed_trades` instead of local state.
3.  Add Professor/Auditor columns to the table.

### Phase 4: Cleanup
1.  Delete `OrderPanel` (or move to a hidden "Manual Override" modal).
2.  Remove `Research` page.

- done
