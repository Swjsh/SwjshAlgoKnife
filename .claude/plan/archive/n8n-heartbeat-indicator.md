# Implementation Plan: n8n Heartbeat Indicator

## Task Summary

Add an n8n heartbeat status indicator to the Activity Feed header bar, positioned to the left of the "Sync" button. The indicator will show real-time n8n instance connectivity and workflow health using a 21st.dev-inspired animated logo.

---

## Technical Analysis

### Current State

**n8n Infrastructure**:
- n8n is deployed on Contabo VPS at `209.145.55.101:5678`
- Currently running v2.37.4 with 27 workflows (19 active, 8 inactive)
- Connected via n8n-mcp in Claude Desktop config
- **No existing n8n health endpoint in SwjshAK API** - only `/api/health` for intel services

**Activity Feed Header Layout** (`src/app/activity-feed/page.tsx:218-257`):
```
topBar: [Title] [ActivityStats] [Sync Button] [Clock]
```
The Sync button is at line 244-252, clock at 253-257.

**Existing UI Patterns**:
- `PulseIndicator` component provides animated status dots
- `GlowingEffect` component from 21st.dev provides animated border effects
- Consistent style: cyan/purple gradients, glassmorphic panels, JetBrains Mono font

### n8n Health Data Available

From `mcp__n8n__n8n_health_check`:
- `connected: true/false` - API connectivity
- `version: "2.37.4"` - n8n version
- Workflow metadata: active count, total count, last updated

From `mcp__n8n__n8n_list_workflows`:
- Individual workflow status (active/inactive)
- Node counts per workflow
- Last updated timestamps

---

## Implementation Steps

### Step 1: Create API Route for n8n Health

**File**: `src/app/api/n8n/health/route.ts`

```typescript
// GET /api/n8n/health
// Returns n8n connectivity status and workflow summary
export async function GET() {
  try {
    const response = await fetch(`${N8N_API_URL}/workflows`, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json({
        status: 'error',
        connected: false,
        message: 'n8n API unreachable'
      });
    }

    const data = await response.json();
    const workflows = data.data || [];
    const activeCount = workflows.filter(w => w.active).length;

    return NextResponse.json({
      status: 'healthy',
      connected: true,
      version: '2.37.4', // Could fetch from /health endpoint
      workflows: {
        total: workflows.length,
        active: activeCount,
        inactive: workflows.length - activeCount
      },
      lastChecked: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      connected: false,
      message: error.message
    });
  }
}
```

**Environment Variables** (already configured for n8n-mcp):
```
N8N_API_URL=http://209.145.55.101:5678/api/v1
N8N_API_KEY=<existing key>
```

---

### Step 2: Create N8nHeartbeat Component

**File**: `src/components/ActivityFeed/N8nHeartbeat.tsx`

**Design**:
- Animated n8n logo (orange hexagon with "n8n" text or simplified icon)
- Three status states: connected (green pulse), degraded (amber), disconnected (red)
- Tooltip showing workflow stats on hover
- Inspired by 21st.dev Logos3 animation pattern

**Component Structure**:
```tsx
'use client';

import { useState, useEffect } from 'react';
import styles from './N8nHeartbeat.module.css';

interface N8nHealthData {
  status: 'healthy' | 'degraded' | 'error';
  connected: boolean;
  workflows?: {
    total: number;
    active: number;
    inactive: number;
  };
  lastChecked?: string;
}

export function N8nHeartbeat() {
  const [health, setHealth] = useState<N8nHealthData | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/n8n/health');
        const data = await res.json();
        setHealth(data);
      } catch {
        setHealth({ status: 'error', connected: false });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const statusColor = health?.connected ? '#ff6d5a' : '#ef4444'; // n8n orange or red
  const statusLabel = health?.connected
    ? `${health.workflows?.active}/${health.workflows?.total} workflows`
    : 'Disconnected';

  return (
    <div
      className={styles.container}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animated n8n Logo */}
      <div className={styles.logoWrapper}>
        <div className={styles.pulseRing} style={{ backgroundColor: statusColor }} />
        <svg className={styles.logo} viewBox="0 0 24 24" fill={statusColor}>
          {/* Simplified n8n hexagon icon */}
          <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
          <text x="12" y="14" fontSize="6" fill="white" textAnchor="middle">n8n</text>
        </svg>
      </div>

      {/* Tooltip on hover */}
      {isHovered && (
        <div className={styles.tooltip}>
          <div className={styles.tooltipTitle}>n8n Automation</div>
          <div className={styles.tooltipRow}>
            <span>Status:</span>
            <span style={{ color: statusColor }}>{health?.status || 'checking...'}</span>
          </div>
          <div className={styles.tooltipRow}>
            <span>Workflows:</span>
            <span>{statusLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### Step 3: Create CSS Module for N8nHeartbeat

**File**: `src/components/ActivityFeed/N8nHeartbeat.module.css`

```css
.container {
  position: relative;
  display: flex;
  align-items: center;
  padding: 4px 10px;
  background: linear-gradient(135deg, rgba(255, 109, 90, 0.08), rgba(255, 109, 90, 0.04));
  border: 1px solid rgba(255, 109, 90, 0.2);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.25s ease;
  flex-shrink: 0;
}

.container:hover {
  background: linear-gradient(135deg, rgba(255, 109, 90, 0.15), rgba(255, 109, 90, 0.08));
  border-color: rgba(255, 109, 90, 0.4);
  box-shadow: 0 0 12px rgba(255, 109, 90, 0.2);
}

.logoWrapper {
  position: relative;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pulseRing {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 4px;
  opacity: 0.3;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.logo {
  width: 16px;
  height: 16px;
  z-index: 1;
  filter: drop-shadow(0 0 4px currentColor);
}

.tooltip {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(17, 17, 22, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px 14px;
  min-width: 160px;
  z-index: 1000;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.tooltipTitle {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  color: #ff6d5a;
  margin-bottom: 8px;
  letter-spacing: 0.05em;
}

.tooltipRow {
  display: flex;
  justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 4px;
}

.tooltipRow:last-child {
  margin-bottom: 0;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.4);
    opacity: 0;
  }
}

/* Disconnected state */
.container[data-status="error"] {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.04));
  border-color: rgba(239, 68, 68, 0.3);
}

.container[data-status="error"] .pulseRing {
  animation: none;
}
```

---

### Step 4: Integrate into Activity Feed Header

**File**: `src/app/activity-feed/page.tsx`

**Changes**:

1. **Import component** (after existing imports, ~line 14):
```tsx
import { N8nHeartbeat } from '@/components/ActivityFeed/N8nHeartbeat';
```

2. **Add to topBar** (before Sync button, ~line 244):
```tsx
{/* topBar JSX */}
<div className={styles.topBar}>
    <h1 className={styles.title}>...</h1>
    <ActivityStats ... />

    {/* NEW: n8n Heartbeat Indicator */}
    <N8nHeartbeat />

    {/* Existing Sync Button */}
    <button className={`${styles.masterRefresh} ...`}>
        <RefreshCw size={14} />
        <span className={styles.refreshLabel}>Sync</span>
    </button>

    <div className={styles.clockSection}>...</div>
</div>
```

---

### Step 5: Add Environment Variables

**File**: `.env.local` (if not already present)

```
N8N_API_URL=http://209.145.55.101:5678/api/v1
N8N_API_KEY=<your-api-key>
```

These should already exist from the n8n-mcp configuration.

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `src/app/api/n8n/health/route.ts` | Create | API endpoint for n8n health polling |
| `src/components/ActivityFeed/N8nHeartbeat.tsx` | Create | Animated heartbeat component |
| `src/components/ActivityFeed/N8nHeartbeat.module.css` | Create | Component styles |
| `src/app/activity-feed/page.tsx` | Modify | Import and add N8nHeartbeat to topBar |

---

## Visual Design

**Colors**:
- n8n brand orange: `#ff6d5a`
- Connected glow: `rgba(255, 109, 90, 0.2)`
- Error red: `#ef4444`

**Animation**:
- 21st.dev-inspired pulse effect on the logo container
- Smooth scale + opacity animation (2s cycle)
- Drop shadow glow matching status color

**Layout**:
- Position: between ActivityStats and Sync button
- Size: compact (similar to Sync button height)
- Hover: tooltip with workflow stats

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| n8n API timeouts blocking UI | Use AbortSignal with 5s timeout; show cached data |
| Excessive API calls | Poll every 30s, not on every render |
| CORS issues from browser | API route proxies request server-side |
| n8n credentials exposed | Keep in env vars, server-side only |

---

## Testing Checklist

- [ ] Indicator shows green pulse when n8n is connected
- [ ] Indicator shows red static when n8n is unreachable
- [ ] Tooltip displays correct workflow counts
- [ ] No layout shift when indicator loads
- [ ] Responsive on smaller screens (topBar wraps gracefully)
- [ ] Works in both dark and light themes

---

## SESSION_ID

- CODEX_SESSION: N/A (single-model planning)
- GEMINI_SESSION: N/A (single-model planning)

---

**Plan generated and saved to `.claude/plan/n8n-heartbeat-indicator.md`**

**Please review the plan above. You can:**
- **Modify plan**: Tell me what needs adjustment, I'll update the plan
- **Execute plan**: Copy the following command to a new session

```
/ccg:execute .claude/plan/n8n-heartbeat-indicator.md
```
