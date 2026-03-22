# Implementation Plan: HALO Agent Command Controls on Agents Page

## Summary
Add AutoResearchControl-style deployment/command features to the Agents page HALO Agent Crew section. Users should be able to select, deploy, and monitor HALO agents directly from the `/agents` page with terminal views.

## Task Type
- [x] Frontend (→ UI/UX focus)
- [ ] Backend (existing APIs sufficient)
- [ ] Fullstack

## Current State

### Research Lab `/research` (Command Tab)
- `AutoResearchControl` component provides:
  - 8-agent selection grid with emoji, name, terminal number
  - Quick select buttons: Group 1, Group 2, All 8, Clear
  - Launch/Stop controls
  - Status display (running count, elapsed time)

### Agents Page `/agents` (HALO Agent Crew Section)
- `HaloControlPanel` component provides:
  - 6 HALO agents displayed as cards
  - Launch All / Stop All buttons
  - Individual Restart/Stop per agent
  - Status indicators (online/dead/idle)
  - No terminal view - just status cards

## What User Wants
"Take everything from command tab on research lab and add it to the agents page on each one of their terminals like in the headers... we should be able to deploy them and see terminal all from one page"

## Technical Solution

### 1. Create Unified HALO Terminal Control Component
Create a new `HaloTerminalControl` component that combines:
- Terminal-style display (like Activity Feed's AgentTerminal)
- Per-terminal header controls (Play/Pause/Stop)
- Shared control bar with quick selects

### 2. Component Structure

```
HaloControlPanel (enhanced)
├── ControlBar (new)
│   ├── Quick Select: [Chief] [Scout] [Hunter] ... (toggleable)
│   ├── Presets: [All] [Group 1] [Group 2] [Clear]
│   └── Actions: [Launch Selected] [Stop All]
│
├── TerminalGrid
│   └── AgentTerminalCard (per agent)
│       ├── Header
│       │   ├── Emoji + Name
│       │   ├── Status dot
│       │   └── Mini controls: [▶ Start] [⏹ Stop]
│       ├── TerminalContent (scrollable logs)
│       └── CommandInput
│
└── StatusFooter
    ├── Online: 4
    ├── Dead: 2
    └── Uptime: 2h 15m
```

### 3. UI Design

#### Control Bar (Top)
```
┌─────────────────────────────────────────────────────────────────────┐
│  HALO COMMAND CENTER                                                │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │ GROUP 1│GROUP 2│ALL│CLEAR│   │LAUNCH (3)│STOP ALL│
│  │🎖️   │ │⚖️   │ │⚙️   │ │🎯   │ │🧠   │ │🔍   │   └────────────────────────────┘   └──────────────────┘
│  │Chief│ │Arb  │ │Ops  │ │Hunt │ │Cort │ │Scout│
│  └──●──┘ └─────┘ └─────┘ └──●──┘ └─────┘ └──●──┘  ← Selected = cyan border + dot
└─────────────────────────────────────────────────────────────────────┘
```

#### Terminal Cards (2-column grid)
```
┌────────────────────────────────────┐ ┌────────────────────────────────────┐
│ 🎖️ CHIEF          ● ONLINE   [▶][⏹]│ │ ⚖️ ARBITER        ○ OFFLINE  [▶][⏹]│
├────────────────────────────────────┤ ├────────────────────────────────────┤
│ 10:42:15 > Checking Jira queue...  │ │ Awaiting transmissions...          │
│ 10:42:18 > Found 3 tickets in TODO │ │                                    │
│ 10:42:20 > Starting INFRA-28...    │ │                                    │
│ > █                                │ │                                    │
└────────────────────────────────────┘ └────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Create HaloAgentSelector Component
New file: `src/components/Agents/HaloAgentSelector.tsx`
- Toggleable agent buttons (6 HALO agents)
- Quick select presets (All, Group 1, Group 2, Clear)
- Selected state tracking

### Step 2: Create HaloTerminalCard Component
New file: `src/components/Agents/HaloTerminalCard.tsx`
- Compact terminal view (header + logs + input)
- Mini controls in header: Start/Stop buttons
- Status indicator (dot color based on heartbeat)
- Reuse log parsing from AgentTerminal

### Step 3: Enhance HaloControlPanel
Modify: `src/components/Agents/HaloControlPanel.tsx`
- Add HaloAgentSelector at top
- Replace current agent cards with HaloTerminalCard grid
- Add Launch Selected / Stop All actions
- Connect to existing `/api/agents/halo` endpoints

### Step 4: Add Styles
New file: `src/components/Agents/HaloAgentSelector.module.css`
Modify: `src/components/Agents/HaloControlPanel.module.css`
- Match AutoResearchControl styling (cyber-industrial theme)
- Compact terminal card styles
- Selection state animations

### Step 5: Wire Up WebSocket/Polling
- Reuse heartbeat data from existing HaloControlPanel fetch
- Poll `/api/agents/halo` for status updates (already 15s interval)
- For live logs: either poll a logs endpoint or connect to activity-bridge WebSocket

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `src/components/Agents/HaloAgentSelector.tsx` | Create | Agent toggle buttons + presets |
| `src/components/Agents/HaloAgentSelector.module.css` | Create | Selector styles |
| `src/components/Agents/HaloTerminalCard.tsx` | Create | Compact terminal card |
| `src/components/Agents/HaloTerminalCard.module.css` | Create | Terminal card styles |
| `src/components/Agents/HaloControlPanel.tsx` | Modify | Integrate new components |
| `src/components/Agents/HaloControlPanel.module.css` | Modify | Layout updates |

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Performance with 6 terminals updating | Use virtualization if needed; limit log history to 100 lines per terminal |
| WebSocket complexity | Start with polling-only; add WebSocket later if needed |
| Style conflicts with existing components | Use CSS modules with unique class names |

## API Dependencies
All endpoints already exist:
- `GET /api/agents/halo` - Fetch all agent status
- `POST /api/agents/halo` - Perform actions (restart, stop, restart-all, stop-all)

No backend changes required.

## SESSION_ID
- CODEX_SESSION: N/A (frontend-only)
- GEMINI_SESSION: N/A (frontend-only)
