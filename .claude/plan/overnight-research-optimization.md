# Implementation Plan: Overnight Research System Optimization

## Task Type
- [x] Backend (→ API, database, prompt generation)
- [x] Frontend (→ UI monitoring, status visualization)
- [x] Fullstack (→ Complete system deep dive and optimization)

---

## Executive Summary

This plan provides a comprehensive optimization strategy for the overnight research system across **5 key dimensions**:
1. **Prompt Engineering** — Maximize agent effectiveness per session
2. **Session Management** — Improve reliability, recovery, and handoff
3. **KPI & Metrics** — Define success criteria and track progress
4. **Output Integration** — Ensure work products flow into the codebase
5. **Monitoring & Observability** — Real-time visibility into agent performance

---

## Current System Analysis

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     OVERNIGHT RESEARCH SYSTEM                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────────────┐    ┌─────────────────┐   │
│  │ UI Component │───▶│ /api/research/       │───▶│ generate_       │   │
│  │ AutoResearch │    │      overnight       │    │ overnight_      │   │
│  │ Control.tsx  │    │      route.ts        │    │ prompts.ts      │   │
│  └──────────────┘    └──────────────────────┘    └─────────────────┘   │
│         │                      │                          │             │
│         │                      │                          │             │
│         ▼                      ▼                          ▼             │
│  ┌──────────────┐    ┌──────────────────────┐    ┌─────────────────┐   │
│  │ Status       │    │ SQLite Database      │    │ .claude/        │   │
│  │ Monitoring   │◀───│ overnight_sessions   │    │ overnight/      │   │
│  │ (5s poll)    │    │ table                │    │ terminal_N_     │   │
│  └──────────────┘    └──────────────────────┘    │ prompt.md       │   │
│                                                   └─────────────────┘   │
│                                                           │             │
│                                                           ▼             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     TERMINAL SPAWNING                             │  │
│  │  cmd.exe /c start → .bat file → npx tsx agent-proxy.ts          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                │                                        │
│         ┌──────────────────────┼──────────────────────┐                │
│         ▼                      ▼                      ▼                │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐     │
│  │ Terminal 1-4 │    │ Terminal 5-8     │    │ STOP Signal      │     │
│  │ GROUP 1:     │    │ GROUP 2:         │    │ .claude/overnight│     │
│  │ Internal     │    │ Security/Ops     │    │ /STOP            │     │
│  └──────────────┘    └──────────────────┘    └──────────────────┘     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Current State Assessment

| Component | Status | Issues Found |
|-----------|--------|--------------|
| API Route | ✅ Functional | Rate limiting works, actions implemented |
| Prompt Generator | ✅ Functional | Eval score integration works |
| Database Schema | ✅ Complete | session_group column added |
| UI Component | ✅ Functional | Group 1/2/Both buttons work |
| Terminal Spawning | ⚠️ Untested | No `scripts/agent-proxy.ts` found |
| Output Integration | ❌ Missing | No morning report script exists |
| Brain File Updates | ⚠️ Stale | performance-memory.md outdated |
| Eval Harness | ❌ Missing | `skills/project-improvement/` empty |

---

## Identified Gaps & Optimization Opportunities

### GAP-001: Missing Agent Proxy Script
**Impact**: Critical - Terminals cannot start Claude sessions
**Current**: API references `scripts/agent-proxy.ts` but file doesn't exist
**Fix Required**: Create agent-proxy.ts or adjust spawning mechanism

### GAP-002: No Eval Harness
**Impact**: High - Cannot measure improvement deltas
**Current**: Prompts reference `skills/project-improvement/gameplan-eval.ts` which doesn't exist
**Fix Required**: Create eval harness or integrate existing metrics

### GAP-003: No Morning Report Generator
**Impact**: Medium - Cannot summarize overnight work
**Current**: API calls `scripts/generate_morning_report.ts` which doesn't exist
**Fix Required**: Create morning report aggregator

### GAP-004: Prompt Effectiveness Unknown
**Impact**: High - No measurement of agent success rates
**Current**: Prompts are detailed but no validation of task completion
**Fix Required**: Add structured output validation

### GAP-005: No Result Aggregation
**Impact**: Medium - Agent outputs scattered, not consolidated
**Current**: Each terminal writes to separate files, no merge
**Fix Required**: Create aggregation pipeline

---

## Implementation Steps

### Phase 1: Foundation Fixes (CRITICAL)

#### Step 1.1: Create Agent Proxy Script
**Files**: `scripts/agent-proxy.ts`
**Deliverable**: Working terminal spawner that launches Claude with prompt

```typescript
// Pseudo-code structure
interface AgentProxyOptions {
  agent: string;           // overnight-improver, overnight-security-auditor, etc.
  wsUrl: string;           // ws://localhost:3001
  promptFile: string;      // Path to terminal_N_prompt.md
  initMessage: string;     // Role initialization message
  interactive: boolean;    // Keep terminal open
}

async function main() {
  // 1. Parse CLI arguments
  // 2. Read prompt file
  // 3. Connect to WebSocket (if wsUrl provided)
  // 4. Spawn Claude with prompt via stdin or --prompt flag
  // 5. Stream output to console and optionally to WS
  // 6. Handle exit signals and cleanup
}
```

#### Step 1.2: Create Eval Harness Stub
**Files**: `skills/project-improvement/gameplan-eval.ts`
**Deliverable**: Baseline scoring system

```typescript
// Pseudo-code
interface EvalResult {
  timestamp: string;
  composite: number;         // 0-100 overall score
  subScores: {
    codeQuality: number;     // Lint, type coverage, complexity
    testCoverage: number;    // Unit/integration test %
    documentation: number;   // README, CLAUDE.md currency
    brainFiles: number;      // Brain file freshness
    ciHealth: number;        // Build status, workflow passes
  };
}

// Calculate composite from sub-scores with weights
// Output JSON for machine parsing
```

#### Step 1.3: Create Morning Report Generator
**Files**: `scripts/generate_morning_report.ts`
**Deliverable**: Aggregation of overnight session outputs

```typescript
// Pseudo-code
async function generateMorningReport() {
  // 1. Read all terminal_N_results.json files
  // 2. Read all terminal_N_summary.md files
  // 3. Get session info from database
  // 4. Aggregate findings by category
  // 5. Calculate improvement metrics
  // 6. Generate markdown report
  // 7. Save to data/morning-reports/YYYY-MM-DD.md
}
```

---

### Phase 2: Prompt Optimization

#### Step 2.1: Add Structured Output Requirements
**Files**: `scripts/generate_overnight_prompts.ts`
**Changes**:

Each prompt should enforce JSON output format:

```markdown
## Required Output Format

Every 30 minutes, write progress to `.claude/overnight/terminal_N_progress.json`:
{
  "timestamp": "ISO-8601",
  "phase": "ASSESS|EXECUTE|VERIFY",
  "tasks_attempted": 5,
  "tasks_succeeded": 4,
  "tasks_failed": 1,
  "current_task": "description",
  "blockers": ["blocker1", "blocker2"],
  "commits_made": 2,
  "files_modified": ["path1", "path2"]
}

At session end, write final results to `.claude/overnight/terminal_N_results.json`:
{
  "session_id": "overnight-YYYY-MM-DD-HHMMSS",
  "terminal": N,
  "role": "ROLE_NAME",
  "started": "ISO-8601",
  "ended": "ISO-8601",
  "summary": "brief summary",
  "tasks": [
    { "name": "task", "status": "success|failed|skipped", "details": "..." }
  ],
  "metrics": {
    "score_before": 50,
    "score_after": 55,
    "commits": 3,
    "tests_added": 5,
    "files_changed": 12
  },
  "recommendations": ["rec1", "rec2"]
}
```

#### Step 2.2: Add Context Budget Awareness
**Rationale**: Prevent agents from hitting context limits mid-task

Add to each prompt:
```markdown
## Context Management

- Monitor your context usage (aim to stay under 80%)
- Prioritize tasks in order listed
- If approaching limit, save progress and exit gracefully
- Use `/compact` if available to free context
- Skip lower-priority tasks rather than crash mid-execution
```

#### Step 2.3: Add Coordination Protocol
**Rationale**: Prevent duplicate work across agents

Add to each prompt:
```markdown
## Coordination

Check `.claude/overnight/CLAIMED.json` before starting major tasks:
{
  "claimed": {
    "task_id": { "terminal": N, "started": "ISO-8601" }
  }
}

Before working on a shared resource:
1. Read CLAIMED.json
2. If not claimed, add your claim
3. Work on the task
4. Remove claim when done
```

---

### Phase 3: KPI Definition & Tracking

#### Step 3.1: Define Success Metrics

| Metric | Target | Measurement | Weight |
|--------|--------|-------------|--------|
| **Session Completion** | 100% | Did terminal run full 180 min? | 20% |
| **Task Completion Rate** | >80% | Attempted vs completed tasks | 25% |
| **Eval Score Delta** | >+3 pts | Before vs after composite | 25% |
| **Commit Quality** | 0 reverts | How many commits needed rollback | 10% |
| **Build Health** | Always green | Did `npm run build` pass throughout | 10% |
| **Output Quality** | All files present | Required output files generated | 10% |

#### Step 3.2: Add Session Metrics Table
**Files**: `src/app/api/research/overnight/route.ts`
**New Table**: `overnight_metrics`

```sql
CREATE TABLE overnight_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  terminal INTEGER NOT NULL,
  role TEXT NOT NULL,
  tasks_attempted INTEGER DEFAULT 0,
  tasks_succeeded INTEGER DEFAULT 0,
  tasks_failed INTEGER DEFAULT 0,
  commits_made INTEGER DEFAULT 0,
  files_modified INTEGER DEFAULT 0,
  score_before INTEGER,
  score_after INTEGER,
  duration_minutes INTEGER,
  exit_reason TEXT,  -- 'completed', 'context_limit', 'stop_signal', 'error'
  FOREIGN KEY (session_id) REFERENCES overnight_sessions(session_id)
);
```

#### Step 3.3: Add Metrics Collection Endpoint
**New Route**: `POST /api/research/overnight/metrics`

```typescript
// Agents POST their metrics during/after session
interface MetricsPayload {
  session_id: string;
  terminal: number;
  role: string;
  tasks_attempted: number;
  tasks_succeeded: number;
  commits_made: number;
  files_modified: number;
  score_after?: number;
  exit_reason: string;
}
```

---

### Phase 4: Output Integration Pipeline

#### Step 4.1: Create Aggregation Script
**Files**: `scripts/aggregate_overnight_results.ts`

```typescript
// Pseudo-code
async function aggregateResults(sessionId: string) {
  // 1. Find all terminal_N_results.json files
  // 2. Parse and validate JSON
  // 3. Group by category:
  //    - Improvements made (IMPROVER)
  //    - Backtest results (BACKTESTER)
  //    - Research findings (RESEARCHER)
  //    - Brain updates (BRAIN_UPDATER)
  //    - Security issues (SECURITY_AUDITOR)
  //    - Test results (INTEGRATION_TESTER)
  //    - Intel digests (INTEL_AGGREGATOR)
  //    - DevOps recommendations (DEVOPS_OPTIMIZER)
  // 4. Generate consolidated summary
  // 5. Update session in database with final scores
  // 6. Trigger notifications if significant findings
}
```

#### Step 4.2: Auto-Apply Recommendations
**Files**: `scripts/apply_overnight_recommendations.ts`

```typescript
// Pseudo-code
async function applyRecommendations(sessionId: string) {
  // 1. Read aggregated results
  // 2. Filter for high-confidence, low-risk changes
  // 3. For each approved recommendation:
  //    a. Create branch: overnight-auto-{date}
  //    b. Apply change
  //    c. Run tests
  //    d. If tests pass, commit
  //    e. If tests fail, rollback and log
  // 4. Create PR with all changes
  // 5. Notify via Discord
}
```

---

### Phase 5: Monitoring & Observability

#### Step 5.1: Enhanced Status UI
**Files**: `src/components/ResearchLab/AutoResearchControl.tsx`
**New Features**:

- Real-time terminal status indicators (heartbeat detection)
- Per-terminal task progress bars
- Live log streaming from each terminal
- Context usage meters
- Eval score trend chart

#### Step 5.2: Discord Notifications
**Integration Points**:

| Event | Channel | Content |
|-------|---------|---------|
| Session Start | #overnight | "Overnight session started: {group} at {time}" |
| Session Complete | #overnight | "Session complete: +{delta} eval points, {commits} commits" |
| Critical Error | #alerts | "Terminal {N} failed: {error}" |
| High-Value Finding | #overnight | "SECURITY: Found {count} vulnerabilities" |

#### Step 5.3: Health Check Endpoint
**New Route**: `GET /api/research/overnight/health`

```json
{
  "healthy": true,
  "terminals": {
    "1": { "status": "running", "lastHeartbeat": "ISO-8601", "contextUsed": 65 },
    "2": { "status": "running", "lastHeartbeat": "ISO-8601", "contextUsed": 72 },
    ...
  },
  "metrics": {
    "tasksCompleted": 12,
    "commitsThisSession": 3,
    "currentEvalScore": 52
  }
}
```

---

## Group-Specific Prompt Improvements

### Group 1: Internal Improvement

#### IMPROVER (Terminal 1)
**Current**: Generic improvement cycles
**Optimization**:
- Add surgeon queue integration (read from war-room/surgeon_queue.md)
- Prioritize by eval score impact
- Require test verification before commit
- Add rollback capability

#### BACKTESTER (Terminal 2)
**Current**: Run backtests on strategies
**Optimization**:
- Add look-ahead bias detection algorithms
- Require minimum 50 trades for statistical significance
- Add out-of-sample validation
- Generate strategy ranking table

#### RESEARCHER (Terminal 3)
**Current**: GitHub search for patterns
**Optimization**:
- Add structured research note format
- Require implementation difficulty estimate
- Link findings to specific project files
- Add "applicable confidence" score

#### BRAIN_UPDATER (Terminal 4)
**Current**: Update brain files
**Optimization**:
- Add freshness scoring for each file
- Require changelog entries
- Validate Master Tracker completeness
- Generate brain health dashboard

### Group 2: Security & Ops

#### SECURITY_AUDITOR (Terminal 5)
**Current**: Dependency audit
**Optimization**:
- Add OWASP Top 10 checklist
- Integrate with npm audit --fix
- Generate CVE report format
- Add credential rotation reminders

#### INTEGRATION_TESTER (Terminal 6)
**Current**: API contract tests
**Optimization**:
- Add contract validation schema
- Generate test coverage report
- Include performance benchmarks
- Add chaos engineering scenarios

#### INTEL_AGGREGATOR (Terminal 7)
**Current**: Oracle data processing
**Optimization**:
- Add source reliability evolution tracking
- Implement confidence decay properly
- Generate tradeable signal format
- Add backtesting of past predictions

#### DEVOPS_OPTIMIZER (Terminal 8)
**Current**: CI/CD analysis
**Optimization**:
- Add build time tracking
- Generate Docker layer analysis
- Include cost optimization suggestions
- Add monitoring coverage gaps

---

## Expected Outcomes

After implementing this plan:

1. **Higher Completion Rate**: Structured outputs ensure measurable progress
2. **Better Coordination**: Claim system prevents duplicate work
3. **Measurable ROI**: KPIs track actual improvement deltas
4. **Faster Integration**: Aggregation pipeline merges outputs
5. **Real-time Visibility**: Enhanced monitoring shows live progress
6. **Actionable Alerts**: Discord notifications for critical events

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Agent crashes | Add heartbeat monitoring + auto-restart |
| Context overflow | Add usage tracking + early exit triggers |
| Build breakage | Require test pass before commit |
| Duplicate work | Implement claim/release protocol |
| Stale data | Add freshness checks on brain files |

---

## SESSION_ID (for /ccg:execute use)

- CODEX_SESSION: N/A (single-model analysis)
- GEMINI_SESSION: N/A (single-model analysis)

---

## Files to Create/Modify

| File | Operation | Description |
|------|-----------|-------------|
| `scripts/agent-proxy.ts` | Create | Terminal spawner for Claude sessions |
| `skills/project-improvement/gameplan-eval.ts` | Create | Eval harness for scoring |
| `scripts/generate_morning_report.ts` | Create | Aggregates overnight outputs |
| `scripts/aggregate_overnight_results.ts` | Create | Consolidates terminal results |
| `scripts/generate_overnight_prompts.ts` | Modify | Add structured output requirements |
| `src/app/api/research/overnight/route.ts` | Modify | Add metrics table and endpoints |
| `src/components/ResearchLab/AutoResearchControl.tsx` | Modify | Enhanced monitoring UI |
| `src/lib/notifications/discord.ts` | Modify | Add overnight event notifications |

---

## Implementation Order

1. **CRITICAL**: Create `scripts/agent-proxy.ts` (blocks all terminal spawning)
2. **HIGH**: Create eval harness stub (required for score tracking)
3. **HIGH**: Add structured output format to prompts
4. **MEDIUM**: Create morning report generator
5. **MEDIUM**: Add metrics collection endpoint
6. **MEDIUM**: Enhance monitoring UI
7. **LOW**: Add Discord notifications
8. **LOW**: Create auto-apply script

---

*Plan generated: 2026-03-22*
*Target completion: Phase 1 within 1 session, full plan within 3 sessions*
