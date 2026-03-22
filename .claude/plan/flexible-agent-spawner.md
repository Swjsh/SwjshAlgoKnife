# Implementation Plan: Flexible Agent Spawner UI

## Task Type
- [x] Frontend (→ UI changes for flexible agent selection)
- [x] Backend (→ API changes for single-agent spawning)
- [x] Fullstack (→ Parallel)

---

## Executive Summary

Replace the current "Group 1 / Group 2 / All 8" batch buttons with a flexible UI that lets the user select and spawn any combination of agents 1-8 individually. This enables:

1. **Testing with 1 agent first** - Spawn just Terminal 1 to verify the system works
2. **Selective launching** - Pick any subset (e.g., just 1, 3, 5)
3. **Iterative improvements** - Run benchmarks, log results, upgrade prompts in 3 iterations

---

## Technical Solution

### UI Design: Agent Selector Grid

Replace the 3-button approach with an 8-checkbox grid + "Launch Selected" button:

```
┌─────────────────────────────────────────────────────────────────────┐
│  [✓] 1-IMPROVER  [✓] 2-BACKTESTER  [✓] 3-RESEARCHER  [✓] 4-BRAIN   │
│  [ ] 5-SECURITY  [ ] 6-INTEGRATION [ ] 7-INTEL       [ ] 8-DEVOPS  │
│                                                                     │
│  ◉ 4 selected  │  [Select Group 1] [Select Group 2] [Select All]  │
│                                                                     │
│        [▶ LAUNCH SELECTED]        [ Running: 2 agents • 15m ]       │
└─────────────────────────────────────────────────────────────────────┘
```

### Backend Changes

Add new API action: `launch-specific` that accepts an array of terminal numbers.

```typescript
// POST /api/research/overnight
{
  "action": "launch-specific",
  "terminals": [1, 3, 5]  // Launch only these terminals
}
```

---

## Implementation Steps

### Step 1: Update API Route - Add `launch-specific` action
**File**: `src/app/api/research/overnight/route.ts`
**Operation**: Modify

Add new handler:
```typescript
async function handleLaunchSpecific(terminals: number[]): Promise<NextResponse> {
  // Validate terminals array (1-8)
  const validTerminals = terminals.filter(t => t >= 1 && t <= 8);
  if (validTerminals.length === 0) {
    return NextResponse.json({ success: false, error: 'No valid terminals specified' }, { status: 400 });
  }

  // Map terminal numbers to roles
  const ALL_ROLES = [...GROUP1_ROLES, ...GROUP2_ROLES]; // 8 roles indexed 0-7

  // Spawn only the selected terminals
  // ...existing spawn logic but for specific terminals...
}
```

### Step 2: Refactor `spawnTerminals` function for single-terminal spawning
**File**: `src/app/api/research/overnight/route.ts`
**Operation**: Modify

Change signature to accept specific terminal numbers instead of ranges:
```typescript
async function spawnTerminal(
  sessionId: string,
  terminalNum: number,  // 1-8
  role: string,
  wtWindowName: string,
  isFirstTerminal: boolean
): Promise<boolean>
```

### Step 3: Update AutoResearchControl UI
**File**: `src/components/ResearchLab/AutoResearchControl.tsx`
**Operation**: Rewrite

Replace batch buttons with:
- 8 checkbox toggles for individual agents
- "Select Group 1" / "Select Group 2" / "Select All" quick-select buttons
- "Launch Selected (N)" primary action button
- Count indicator showing how many are selected

Pseudo-code:
```tsx
const [selectedTerminals, setSelectedTerminals] = useState<Set<number>>(new Set());

const toggleTerminal = (t: number) => {
  const next = new Set(selectedTerminals);
  if (next.has(t)) next.delete(t);
  else next.add(t);
  setSelectedTerminals(next);
};

const selectGroup1 = () => setSelectedTerminals(new Set([1, 2, 3, 4]));
const selectGroup2 = () => setSelectedTerminals(new Set([5, 6, 7, 8]));
const selectAll = () => setSelectedTerminals(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
const clearAll = () => setSelectedTerminals(new Set());

const launchSelected = () => {
  fetch('/api/research/overnight', {
    method: 'POST',
    body: JSON.stringify({
      action: 'launch-specific',
      terminals: Array.from(selectedTerminals)
    })
  });
};
```

### Step 4: Update CSS for new grid layout
**File**: `src/components/ResearchLab/AutoResearchControl.module.css`
**Operation**: Modify

Add styles for:
- `.agentGrid` - 4-column grid for 8 agent toggles
- `.agentToggle` - Individual agent checkbox styling
- `.agentToggle[data-selected="true"]` - Selected state with glow
- `.quickSelectRow` - Row of quick-select buttons
- `.launchSelectedBtn` - Primary launch button (larger, gradient)

### Step 5: Update useResearchAgents to provide agent definitions
**File**: `src/hooks/useResearchAgents.ts`
**Operation**: No change needed (RESEARCH_AGENT_DEFINITIONS already exported)

### Step 6: Track session with flexible terminal set
**File**: `src/app/api/research/overnight/route.ts`
**Operation**: Modify `saveSession`

Update to store the actual terminals launched, not just group counts:
```typescript
// Add column: terminals_launched TEXT (JSON array like "[1,3,5]")
```

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `src/app/api/research/overnight/route.ts` | Modify | Add `launch-specific` action, refactor spawn logic |
| `src/components/ResearchLab/AutoResearchControl.tsx` | Rewrite | Replace batch buttons with checkbox grid |
| `src/components/ResearchLab/AutoResearchControl.module.css` | Modify | Add grid layout and toggle styles |

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Window Terminal (wt) race conditions when spawning many tabs rapidly | Keep 3s delay between spawns (existing behavior) |
| Database schema change may break existing sessions | Use migration pattern with DEFAULT for new column |
| UI complexity may confuse users | Include "Select All" and "Select Group" quick buttons |

---

## Benchmark Iteration Plan (After UI Complete)

Once flexible spawning works:

### Iteration 1: Baseline Measurement
1. Spawn Terminal 1 (IMPROVER) only
2. Let it run for 30 minutes
3. Capture: tasks completed, failures, heartbeat regularity
4. Log to `.claude/overnight/benchmark_iteration_1.json`

### Iteration 2: Prompt Enhancement
1. Analyze iteration 1 logs for bottlenecks
2. Update `generate_overnight_prompts.ts` with fixes
3. Re-run Terminal 1
4. Compare metrics to baseline

### Iteration 3: Multi-Agent Test
1. Run 2-3 agents together
2. Check for resource contention, timing issues
3. Refine spawn delays and heartbeat intervals

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: N/A (solo plan)
- GEMINI_SESSION: N/A (solo plan)

---

*Plan generated: 2026-03-22*
*Feature: flexible-agent-spawner*
