# N8N Heartbeat Dashboard - Implementation Plan

## Overview

Create a secure, terminal-free dashboard page dedicated to n8n workflow visualization using 21st century UI components.

**Security Guarantee**: This page contains NO terminals, NO command inputs, NO agent interactions - purely read-only workflow status visualization.

---

## Phase 1: API Enhancement

### 1.1 Extend n8n Health API (`src/app/api/n8n/health/route.ts`)

Add detailed workflow data for dashboard visualization:

```typescript
// Enhanced response type
interface N8nDashboardData {
  status: 'healthy' | 'degraded' | 'error';
  connected: boolean;
  version?: string;
  workflows: {
    total: number;
    active: number;
    inactive: number;
    items: WorkflowSummary[];  // NEW: Individual workflow details
  };
  executions: {
    total24h: number;
    success: number;
    failed: number;
    running: number;
  };
  lastChecked: string;
}

interface WorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  lastExecution?: {
    status: 'success' | 'error' | 'running' | 'waiting';
    timestamp: string;
  };
  category?: string;  // Derived from workflow name prefix (WF-S, WF-I, etc.)
}
```

### 1.2 New API Route: `/api/n8n/workflows`

Dedicated endpoint for workflow list with execution stats:

```typescript
// GET /api/n8n/workflows
// Returns paginated workflow list with last execution status
```

---

## Phase 2: Page Structure

### 2.1 Create Page: `src/app/n8n-dashboard/page.tsx`

**Layout Structure**:
```
┌────────────────────────────────────────────────────────────────┐
│  HEADER: N8N Control Center   [Status Indicator] [Last Update] │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │  CONNECTION STATUS  │  │   EXECUTION STATS   │              │
│  │  (BentoItem)        │  │   (BentoItem)       │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            WORKFLOW INTEGRATIONS GRID                     │  │
│  │            (IntegrationsGrid with workflow tiles)         │  │
│  │            - Each workflow = one tile                     │  │
│  │            - Status dots: active/paused/error             │  │
│  │            - Orbital connection lines                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            REALTIME EXECUTION CHART                       │  │
│  │            (RealtimeChart adapted for executions)         │  │
│  │            - Executions per minute                        │  │
│  │            - Success/failure ratio                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            RECENT EXECUTIONS LIST                         │  │
│  │            (BentoItem table)                              │  │
│  │            - Last 10 executions                           │  │
│  │            - Status, workflow name, timestamp, duration   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Phase 3: Components

### 3.1 WorkflowGrid Component

Adapts `IntegrationsGrid` for workflows:

```typescript
// src/components/N8nDashboard/WorkflowGrid.tsx

interface Workflow {
  id: string;
  name: string;
  active: boolean;
  status: 'active' | 'paused' | 'error' | 'idle';
  lastExecution?: string;
  category: 'system' | 'integration' | 'automation' | 'manual';
}

// Maps to IntegrationsGrid format
// Uses category icons: Settings, Plug, Zap, Play
```

### 3.2 ExecutionChart Component

Adapts `RealtimeChart` for execution visualization:

```typescript
// src/components/N8nDashboard/ExecutionChart.tsx

// Shows executions over time with success/failure split
// Green for success, red for failure
// Live updates via polling
```

### 3.3 ConnectionStatus Component

Enhanced version of existing `N8nHeartbeat`:

```typescript
// src/components/N8nDashboard/ConnectionStatus.tsx

// Large format status card
// Animated connection ring
// Version display
// Last check timestamp
```

### 3.4 ExecutionStats Component

Stats cards using `BentoItem`:

```typescript
// src/components/N8nDashboard/ExecutionStats.tsx

// Grid of 4 stats:
// - Total Executions (24h)
// - Success Rate (%)
// - Active Workflows
// - Average Duration
```

### 3.5 RecentExecutions Component

Table of recent executions:

```typescript
// src/components/N8nDashboard/RecentExecutions.tsx

// Columns: Workflow | Status | Started | Duration
// Color-coded status badges
// Hover for details
```

---

## Phase 4: Styling

### 4.1 Create CSS Module: `src/app/n8n-dashboard/page.module.css`

- Follows existing cyber-industrial theme
- Uses CSS variables from `globals.css`
- BentoItem corner brackets
- Glassmorphism effects
- Animated status indicators

---

## Phase 5: Data Flow

### 5.1 Custom Hook: `useN8nDashboard`

```typescript
// src/hooks/useN8nDashboard.ts

interface UseN8nDashboardReturn {
  connection: N8nHealthData;
  workflows: Workflow[];
  executions: Execution[];
  stats: ExecutionStats;
  isLoading: boolean;
  lastUpdate: Date;
  refresh: () => void;
}

// Polls /api/n8n/health every 30 seconds
// Polls /api/n8n/workflows every 60 seconds
// Polls /api/n8n/executions every 10 seconds (recent only)
```

---

## Files to Create

1. `src/app/n8n-dashboard/page.tsx` - Main page component
2. `src/app/n8n-dashboard/page.module.css` - Page styles
3. `src/app/api/n8n/workflows/route.ts` - Workflows API
4. `src/app/api/n8n/executions/route.ts` - Executions API
5. `src/components/N8nDashboard/WorkflowGrid.tsx` - Workflow visualization
6. `src/components/N8nDashboard/WorkflowGrid.module.css`
7. `src/components/N8nDashboard/ExecutionChart.tsx` - Real-time chart
8. `src/components/N8nDashboard/ExecutionChart.module.css`
9. `src/components/N8nDashboard/ConnectionStatus.tsx` - Connection card
10. `src/components/N8nDashboard/ConnectionStatus.module.css`
11. `src/components/N8nDashboard/ExecutionStats.tsx` - Stats grid
12. `src/components/N8nDashboard/ExecutionStats.module.css`
13. `src/components/N8nDashboard/RecentExecutions.tsx` - Executions table
14. `src/components/N8nDashboard/RecentExecutions.module.css`
15. `src/components/N8nDashboard/index.ts` - Barrel export
16. `src/hooks/useN8nDashboard.ts` - Data fetching hook

---

## Security Checklist

- [x] No terminal/command components imported
- [x] No agent interaction handlers
- [x] No WebSocket connections to agent system
- [x] Read-only API endpoints (no POST/PUT/DELETE to n8n)
- [x] No user input fields that execute code
- [x] Safe for public exposure via Tailscale tunnel

---

## Navigation Integration

Add to sidebar in `src/components/Layout/Sidebar.tsx`:

```typescript
{
  href: '/n8n-dashboard',
  label: 'n8n Dashboard',
  icon: Workflow,  // from lucide-react
}
```

---

## Estimated Work

- API Routes: 2 files
- Page + Styles: 2 files
- Components: 10 files (5 components + 5 CSS modules)
- Hooks: 1 file
- Navigation update: 1 file edit

**Total**: 15 new files, 1 edit

---

## Handoff Prompt for Fresh Claude (Contabo Server)

After implementing this page, provide this handoff to the server Claude:

```
# SwjshAlgoKnife Project Context

## What This Project Is
SwjshAlgoKnife is an algorithmic trading platform with:
- Next.js 15 frontend (localhost:3000)
- Multiple autonomous trading agents managed via PM2
- n8n workflow automation (external server: 209.145.55.101:5678)
- SQLite database for trades and signals
- Obsidian knowledge base integration

## Your Task
You are running on a Contabo VPS (209.145.55.101) and need to:
1. Install Tailscale for secure mesh networking
2. Connect to the Windows workstation via Tailscale
3. Update n8n workflows to use Tailscale IPs instead of localhost

## Why Tailscale
The n8n server cannot reach localhost:3000 because it's on a different machine.
Tailscale creates a private mesh VPN where both machines get stable IPs.

## Steps
1. Install Tailscale: `curl -fsSL https://tailscale.com/install.sh | sh`
2. Authenticate: `sudo tailscale up`
3. Note your Tailscale IP (100.x.x.x)
4. Have Jack run Tailscale on Windows and note his IP
5. Update n8n workflows: replace localhost:3000 with Jack's Tailscale IP

## n8n Credentials
- API URL: http://209.145.55.101:5678/api/v1
- API Key: Set in environment variable N8N_API_KEY

## Workflows to Update (Priority)
- WF-S02: Self-Healing Incident Response (currently deactivated)
- Any workflow with localhost:3000 webhooks

## Success Criteria
- Both machines visible in Tailscale admin (tailscale status)
- Ping works between Tailscale IPs
- n8n can reach SwjshAlgoKnife API via Tailscale IP
- WF-S02 reactivated and passing health checks
```

---

This plan creates a secure, visually stunning n8n dashboard without any terminal exposure.
