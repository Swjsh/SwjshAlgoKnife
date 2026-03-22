# Research Agent Audit & Accomplishment Tracking Plan

**Date**: 2026-03-22
**Question**: How are we auditing the research agents and what they are accomplishing?
**Status**: ANALYSIS COMPLETE

---

## Executive Summary

The system currently has **comprehensive infrastructure** for auditing research agents, but there are **gaps in actual accomplishment tracking**. The infrastructure exists to *monitor* agents, but less emphasis on *measuring what they achieved*.

---

## Current Audit Infrastructure (What EXISTS)

### 1. Real-Time Agent Monitoring

| Component | Location | What It Tracks |
|-----------|----------|----------------|
| **Heartbeat System** | `data/heartbeat-status.json` | Last seen, status (alive/stale/dead), nudge count, waiting detection |
| **Activity Bridge** | `scripts/activity-bridge.ts` | WebSocket streaming of agent logs, auto-nudge after 60s stuck |
| **Agent Registry** | `data/agent-registry.json` | Session IDs, startup times, current working directory |
| **Health Status** | `data/health_status.json` | Service status, resource usage, incidents |

### 2. Overnight Research Session Tracking

| Component | Location | What It Tracks |
|-----------|----------|----------------|
| **Session Database** | SQLite `overnight_sessions` table | Duration, eval scores before/after, terminals launched |
| **Status API** | `/api/research/status?terminal=N` | 3-tier detection (status file → heartbeat → log mtime) |
| **Logs API** | `/api/research/logs?terminal=N` | Incremental log fetching with offset |
| **Command Queue** | `.claude/overnight/commands/terminal_N_queue.json` | Pending commands, execution status |

### 3. Output File System

Each research agent writes to:
- `.claude/overnight/terminal_N_results.json` - Structured accomplishment data
- `.claude/overnight/terminal_N_summary.md` - Human-readable summary
- `.claude/overnight/terminal_N_heartbeat.jsonl` - Continuous JSONL logs
- `.claude/overnight/terminal_N_status.json` - Current status

### 4. Morning Report Generator

**File**: `scripts/generate_morning_report.ts` (721 lines)

**Aggregates**:
- Session metadata (start/end, duration, terminals)
- Eval scores before/after (delta calculation)
- Terminal results (accomplishments, failures, metrics)
- Git commits with `overnight:` prefix
- Improver-specific actions

**Outputs**:
- `data/morning-reports/YYYY-MM-DD.md` - Human-readable report
- `data/morning-reports/YYYY-MM-DD.json` - Structured summary

---

## The 8 Research Agents (What They're Supposed To Do)

### Group 1: Internal Improvement (Terminals 1-4)

| # | Agent | Focus | KPI |
|---|-------|-------|-----|
| 1 | **IMPROVER** | Code quality, improvement cycles | Eval score delta |
| 2 | **BACKTESTER** | Strategy validation, KPI checks | Win rate, Sharpe |
| 3 | **RESEARCHER** | External patterns, Context7 | Patterns discovered |
| 4 | **BRAIN_UPDATER** | Knowledge currency, docs | Docs updated |

### Group 2: Security & Ops (Terminals 5-8)

| # | Agent | Focus | KPI |
|---|-------|-------|-----|
| 5 | **SECURITY_AUDITOR** | Dependency audit, secrets | Vulnerabilities found |
| 6 | **INTEGRATION_TESTER** | API contracts, E2E tests | Test pass rate |
| 7 | **INTEL_AGGREGATOR** | Oracle data, confidence scoring | Intel entries |
| 8 | **DEVOPS_OPTIMIZER** | CI/CD, Docker, monitoring | Build time delta |

---

## GAPS IN CURRENT SYSTEM

### GAP-1: No Centralized Accomplishment Dashboard

**Problem**: Accomplishments are scattered across multiple files:
- Agent logs (streaming, not persisted)
- Terminal result files (per-agent, not aggregated)
- Morning reports (daily, but must be triggered)
- Git commits (require parsing)

**Impact**: No single view to answer "What did the agents accomplish today?"

### GAP-2: Eval Scores Not Consistently Tracked

**Problem**: The `eval_score_before` and `eval_score_after` fields exist in the database schema but:
- Only IMPROVER agent actually calculates these
- Other agents don't report quantifiable progress metrics
- No automated baseline scoring before sessions

**Evidence**: In `heartbeat-status.json`, agents like Arbiter show:
```json
"lastPrompt": "Shall I proceed to fix the remaining instances..."
```
This shows the agent *asked* what to do, not *reported* what it accomplished.

### GAP-3: Morning Report Generator Requires Manual Trigger

**Problem**: The morning report must be triggered via:
- API: `POST /api/research/overnight { action: 'morning-report' }`
- CLI: `npx tsx scripts/generate_morning_report.ts`

**Impact**: Without explicit trigger, no aggregation happens.

### GAP-4: No Cross-Session Accomplishment Tracking

**Problem**: Each overnight session is independent. There's no:
- Cumulative accomplishment ledger
- Week-over-week progress tracking
- Agent performance comparison across sessions

### GAP-5: Activity Feed Shows Logs, Not Accomplishments

**Problem**: The Activity Feed shows real-time logs (lines of text), not structured accomplishments like:
- "Fixed 3 bugs"
- "Merged PR #42"
- "Updated 5 documentation pages"

**Evidence**: `src/hooks/useActivityFeed.ts` processes raw log lines, not semantic actions.

### GAP-6: Research Agents vs HALO Agents Are Separate Systems

**Problem**: Two different agent systems with different tracking:

| Aspect | Research Agents (8) | HALO Agents (6) |
|--------|---------------------|-----------------|
| Location | `.claude/overnight/` | `data/heartbeat-status.json` |
| Tracking | Session-based | Continuous heartbeat |
| Reports | Morning report | None |
| Jira Integration | None | Full (tickets, loops) |

**Impact**: No unified view of "what did all agents accomplish today?"

---

## WHAT'S ACTUALLY BEING AUDITED TODAY

Based on the exploration:

### ✅ Well-Tracked

1. **Agent Vitality**: Are agents alive/stale/dead?
2. **Stuck Detection**: Are agents waiting for input?
3. **Session Duration**: How long did overnight sessions run?
4. **Raw Logs**: What did agents print to stdout?
5. **Nudge Counts**: How many times did we auto-nudge stuck agents?

### ⚠️ Partially Tracked

1. **Eval Scores**: Schema exists but only IMPROVER uses it
2. **Terminal Results**: File format defined but agents may not consistently write it
3. **Git Commits**: Parsed in morning report but requires `overnight:` prefix

### ❌ Not Tracked

1. **Structured Accomplishments**: "Fixed bug X", "Merged PR Y"
2. **Cross-Session Progress**: Week-over-week improvement
3. **Agent Efficiency**: Time spent vs. value delivered
4. **Pattern Confirmation**: Did RESEARCHER hypotheses get validated?
5. **Backtest Improvements**: Did BACKTESTER actually improve agent performance?

---

## RECOMMENDATIONS

### Option A: Minimal Fix (1-2 days)

1. **Add Auto-Morning-Report**: Trigger morning report generation automatically when overnight sessions end
2. **Dashboard Widget**: Add "Today's Accomplishments" widget that parses morning report JSON
3. **Standardize Result Files**: Ensure all 8 agents write consistent `terminal_N_results.json`

### Option B: Comprehensive Accomplishment Tracking (1 week)

1. **Create `accomplishments` SQLite Table**:
   ```sql
   CREATE TABLE accomplishments (
     id INTEGER PRIMARY KEY,
     session_id TEXT,
     agent_id TEXT,
     timestamp DATETIME,
     action_type TEXT,  -- 'bug_fix', 'pr_merged', 'doc_updated', etc.
     description TEXT,
     quantified_value REAL,  -- e.g., eval score delta, test pass delta
     jira_ticket TEXT,
     git_commit TEXT
   );
   ```

2. **Accomplishment Parser**: Parse agent output for semantic actions:
   - "Fixed" → bug_fix
   - "Merged PR" → pr_merged
   - "Updated" → doc_updated
   - "Discovered pattern" → pattern_found

3. **Unified Dashboard**: Single view showing all agent accomplishments

4. **Weekly Retrospective Generator**: Auto-generate weekly progress reports

### Option C: KPI-Driven Audit System (2 weeks)

1. **Define Agent KPIs**:
   - IMPROVER: Eval score delta per session
   - BACKTESTER: Agent win rate improvement
   - RESEARCHER: Patterns confirmed / hypotheses tested
   - SECURITY_AUDITOR: CVEs found, secrets detected

2. **Pre/Post Session Scoring**: Run eval harness before AND after each session

3. **Trend Dashboard**: Show KPI trends over time

4. **Alert on Regression**: Notify if agent performance degrades

---

## CURRENT STATUS SUMMARY

| Dimension | Status | Score |
|-----------|--------|-------|
| **Agent Health Monitoring** | EXCELLENT | 9/10 |
| **Session Tracking** | GOOD | 7/10 |
| **Structured Output** | PARTIAL | 5/10 |
| **Accomplishment Aggregation** | WEAK | 3/10 |
| **Cross-Session Trends** | MISSING | 1/10 |
| **Unified Agent View** | MISSING | 2/10 |

**Overall Audit Maturity**: 45% (Infrastructure exists, but accomplishment tracking is weak)

---

## NEXT STEPS

1. **Decide on approach** (A/B/C above)
2. **If Option A**: Implement auto-morning-report + dashboard widget (1-2 days)
3. **If Option B/C**: Create detailed implementation plan with tickets

---

*Analysis completed: 2026-03-22*
*Files examined: 15+ across scripts, hooks, API routes, and data files*
