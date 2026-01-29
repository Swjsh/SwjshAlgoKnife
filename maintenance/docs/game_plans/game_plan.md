# Game Plan: The Rise of the Machines
**Vision**: Shift "Swjsh Algo Knife" from a manual trading terminal to an **Agent Command Center**. The Trading Bots are the heroes; the User is the Commander.

## 1. Core Philosophy
- **User Role**: Supervisor / Commander. No manual execution.
- **Agent Role**: The Heroes. They scan, execute, manage, and report.
- **Aesthetic**: High-tech, "God Mode", detailed visibility into Agent logic.

## 2. Dashboard Overhaul (The Command Deck)
The current Dashboard is too manual-focused. We will transform it into a High-Level Status Screen.
- **[REMOVE] OrderPanel**: Manual buy/sell/short buttons are distractions. Hide them or move to a "Debug/Override" modal.
- **[NEW] Squad Status Ticker**: A prominent header showing:
    - active Agents (e.g., "Pivot Pete: LONG ES", "Swjsh FX: SCANNING").
    - Total System PnL (Today).
    - Active Risks/Exposure.
- **[MODIFY] Trading Chart**: 
    - Keep the chart but make Agent Signals the stars. 
    - Visualize "Zones" actively being watched by agents (e.g., "Pivot Pete Watching 4450").

## 3. Agents Page (The Barracks - **HIGHLIGHT**)
This is the heart of the app. It currently lists agents and has chat. We will supercharge it.
- **"What are they doing?" (Real-time)**:
    - Enhanced "Live Tactical Signals" table.
    - Visual "Thinking" indicators (e.g., "Analyzing volume...", "Waiting for candle close...").
- **"What have they done?" (History)**:
    - A dedicated "Session Log" for each agent on their card/page. 
    - "Last 5 Trades" mini-card.
- **"What are they going to do?" (Planning)**:
    - Display "Watchlist" or "Hunting Grounds" per agent. 
    - Show specific levels/triggers they are waiting for.

## 4. Other Sections
- **Scanner -> "Opportunity Radar"**:
    - Instead of user scanning, show what opportunities the **Agents** have found.
    - "Pivot Pete found a Breakout on SPY".
- **Journal -> "Mission Logs"**:
    - Ensure it's auto-filled by Bots. 
    - Add "Professor's Grade" to each entry visible here.
- **Research -> "The Lab"**:
    - Keep as is, but maybe link strategies to specific agents (e.g., "Pivot Pete uses VWAP Hypothesis").

## 5. Implementation Steps
1.  **Dashboard Cleanup**: Remove `OrderPanel`. Create `SquadStatusWidget`.
2.  **Agents Page Upgrade**: Expand the `pending_orders` logic to include "Watchlist" and "History".
3.  **Global Connectivity**: Ensure `AgentContext` feeds data to all pages (Ticker on Dashboard needs Agent data).

---
*Created for the Commander.*

---
**REVIEW STATUS: ✅ REVIEWED**

**Improvements Needed:**
1. Add Professor/Auditor integration steps
2. Include data flow architecture details
3. Merge with Forex/Paper Trading roadmap
4. Add acceptance criteria and file references

**Next Steps:**
1. Complete backend agent integration first
2. Then proceed with UI overhaul
3. Break Section 5 into granular file-specific tasks

- done
