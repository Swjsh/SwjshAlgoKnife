# Research Lab + AutoResearch Integration Review

## Overview

This plan reviews the alignment between the AutoResearch foundation (Karpathy methodology) and the new Research Lab Command Center integration.

---

## Components Reviewed

### AutoResearch Foundation (Just Completed)
- **8 program.md files** at `.claude/overnight/programs/`
- **generate_overnight_prompts.ts** - Updated to use program.md format
- **results.tsv** - Experiment logging (untracked)
- **NEVER STOP protocol** - Replaces EXIT_CONDITIONS
- **Git-per-experiment workflow** - Commit before each change

### Research Lab Integration (Your New Work)
- **src/app/research/page.tsx** - Research Ledger (strategy documentation)
- **src/app/command-center/page.tsx** - Trading agent dashboard (separate page)
- **src/components/ResearchLab/** - Terminal grid + AutoResearchControl
- **src/hooks/useResearchAgents.ts** - 8 agent definitions + status polling
- **src/app/api/research/overnight/route.ts** - Agent spawning API

---

## Gap Analysis: AutoResearch Alignment

### 1. CRITICAL GAPS

| Gap | Current State | Required for AutoResearch |
|-----|---------------|---------------------------|
| **Branch creation** | Not automated | Agent should create `autoresearch/<role>/<run-tag>` branch on launch |
| **results.tsv initialization** | Not automated | Should initialize with header row on session start |
| **Metric extraction** | Status file only | Should extract single metric to results.tsv after each experiment |
| **Keep/Discard loop** | Not implemented | Git reset on metric regression |

### 2. Partial Alignment

| Feature | Current Implementation | AutoResearch Standard |
|---------|------------------------|----------------------|
| **Heartbeat** | `terminal_N_status.json` written by API | Matches - agents write status JSON |
| **STOP signal** | `.claude/overnight/STOP` file | Matches - NEVER STOP until file exists |
| **Prompt injection** | `--system-prompt` flag with prompt file | Works but should include program.md content |
| **Session tracking** | SQLite `overnight_sessions` table | Good - adds persistence beyond results.tsv |

### 3. Well-Aligned Features

| Feature | Implementation |
|---------|---------------|
| 8 agent definitions | `useResearchAgents.ts` - matches program.md |
| Terminal spawning | Windows Terminal with tabs |
| Group 1/2 separation | Terminals 1-4 vs 5-8 |
| Flexible agent selection | `launch-specific` action |

---

## Implementation Plan

### Phase 1: AutoResearch Protocol Integration (API Side)

**File: `src/app/api/research/overnight/route.ts`**

Add to `spawnSingleTerminal()` function:

```typescript
// After creating cmdPath, before spawning:

// 1. Create AutoResearch branch for this agent
const branchName = `autoresearch/${role.toLowerCase()}/${sessionId}`;
exec(`git checkout -b ${branchName} 2>/dev/null || git checkout ${branchName}`, { cwd: ROOT });

// 2. Initialize results.tsv if not exists
const resultsTsv = path.join(ROOT, 'results.tsv');
if (!await fileExists(resultsTsv)) {
  await fs.writeFile(resultsTsv, 'commit\tmetric\tmemory_gb\tstatus\tdescription\n', 'utf-8');
}
```

### Phase 2: Enhanced Status File Format

Update status file to include AutoResearch metrics:

```typescript
// In spawnSingleTerminal():
await fs.writeFile(statusFile, JSON.stringify({
  status: 'launching',
  role,
  terminal: terminalNum,
  group,
  sessionId,
  launchedAt: new Date().toISOString(),
  // AutoResearch additions:
  autoresearch: {
    branch: `autoresearch/${role.toLowerCase()}/${sessionId}`,
    experimentsRun: 0,
    experimentsKept: 0,
    experimentsDiscarded: 0,
    currentMetric: null,
    bestMetric: null,
  },
}, null, 2), 'utf-8');
```

### Phase 3: Agent Prompt Enhancement

Update `.cmd` launcher content to include AutoResearch initialization:

```batch
echo Initializing AutoResearch protocol...
echo.
git checkout -b autoresearch/%ROLE%/%SESSION_ID% 2>nul || git checkout autoresearch/%ROLE%/%SESSION_ID%
if not exist results.tsv (
  echo commit	metric	memory_gb	status	description > results.tsv
)
echo.
claude --dangerously-skip-permissions --system-prompt "${promptFile}" ...
```

### Phase 4: Results Collection on Stop

Update `handleStop()` to aggregate results:

```typescript
// In handleStop(), after writing STOP signal:

// Collect results from all results.tsv files across branches
const branches = await execAsync('git branch -l "autoresearch/*"', { cwd: ROOT });
let totalExperiments = 0;
let experimentsKept = 0;

for (const branch of branches.stdout.split('\n').filter(Boolean)) {
  // Read results.tsv from each branch
  // Count keep vs discard
}

// Include in response
return NextResponse.json({
  success: true,
  message: 'Stop signal sent.',
  autoresearchStats: {
    totalExperiments,
    experimentsKept,
    experimentsBranches: branches.stdout.split('\n').filter(Boolean).length,
  },
  ...
});
```

### Phase 5: Morning Report Enhancement

Update `scripts/generate_morning_report.ts` to include:
- results.tsv parsing from all `autoresearch/*` branches
- Experiment count per agent
- Keep/discard ratio
- Best metrics achieved

---

## Validation Checklist

After implementation, verify:

- [x] Agent launch creates `autoresearch/<role>/<session-id>` branch
- [x] results.tsv is initialized with header on first experiment
- [x] Status file includes `autoresearch` metrics object
- [x] Stop action aggregates experiment results
- [ ] Morning report includes AutoResearch stats (pending generate_morning_report.ts update)
- [ ] UI displays experiment counts in terminal headers (pending ResearchTerminalGrid.tsx update)

## Implementation Status: COMPLETE (Phase 1-4)

**Implemented 2026-03-22:**

### API Changes (`src/app/api/research/overnight/route.ts`)
- Added AUTORESEARCH_METRICS_FILE constant
- `spawnTerminals()` now creates AutoResearch branches and initializes results.tsv
- `spawnSingleTerminal()` now creates AutoResearch branches and initializes results.tsv
- Status files now include `autoresearch` metrics object
- CMD launchers now include AutoResearch initialization in batch script
- `handleStop()` now aggregates experiment results from results.tsv
- Response includes `autoresearchStats` with totalExperiments, kept, discarded, branches

### Hook Changes (`src/hooks/useResearchAgents.ts`)
- Added `AutoResearchMetrics` interface
- Extended `ResearchAgentState` with optional `autoresearch` field
- Status fetching now parses and stores AutoResearch metrics

### CHIEF Soul Updates (`Library/agent-souls/CHIEF_SOUL.md`)
- Added "Research Lab Monitoring" workflow with 6 steps
- Added data sources: autoresearch-metrics.json, terminal status files, results.tsv
- Added health scoring algorithm (0-100 scale)
- Added Jira ticket templates for [RESEARCH] and [DEVOPS]
- Added new ticket types: Research, DevOps, Research-Growth
- Updated Files I Read/Write sections

### New API Endpoint (`src/app/api/research/metrics/route.ts`)
- GET: Returns AutoResearch metrics with health score calculation
- POST: Creates Jira tickets based on metrics analysis
- Calculates health score (GREEN/YELLOW/RED)
- Creates INFRA-[RESEARCH] session tickets
- Creates INFRA-[DEVOPS] tickets for issues
- Saves health state to data/research-lab-health.json

---

## Files to Modify

1. **`src/app/api/research/overnight/route.ts`**
   - Add branch creation to `spawnSingleTerminal()`
   - Add results.tsv initialization
   - Update status file format
   - Enhance `handleStop()` with results aggregation

2. **`src/hooks/useResearchAgents.ts`**
   - Add `autoresearch` metrics to `ResearchAgentState` type
   - Parse metrics from status files

3. **`src/components/ResearchLab/ResearchTerminalGrid.tsx`**
   - Display experiment counts in terminal headers
   - Show keep/discard ratio

4. **`scripts/generate_morning_report.ts`**
   - Add results.tsv parsing
   - Include experiment stats in report

---

## Non-Breaking Changes (UI Only)

The Research Ledger page (`src/app/research/page.tsx`) is currently showing strategy documentation, which is fine. The "Command" toggle you mentioned should switch to showing the Research Lab terminal view.

**Current state**: The research page shows VWAP/Squeeze/Three Ducks strategy cards.

**Expected**: A toggle between:
- "Ledger" view → Strategy documentation (current)
- "Agents" view → ResearchTerminalGrid (8 terminals)
- "Command" view → AutoResearchControl (launcher + audit dashboard)

---

## SESSION_ID (for /ccg:execute use)

- CODEX_SESSION: N/A (Claude-only analysis)
- GEMINI_SESSION: N/A (Claude-only analysis)

---

*Plan created: 2026-03-22*
*Based on: AutoResearch alignment audit + Research Lab component review*
