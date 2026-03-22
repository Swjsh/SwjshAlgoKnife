# Research Agent Audit System — AutoResearch Iteration Plan

**Date**: 2026-03-22
**Goal**: Achieve 95%+ in ALL 6 audit categories through up to 10 iterations
**Pattern**: Karpathy AutoResearch Convention (prepare → eval → mutate → verify)
**Blocking Deployment**: System CANNOT deploy until ALL categories ≥ 95%

---

## Executive Summary

This plan applies the AutoResearch pattern to systematically improve the research agent audit system from its current 45% overall maturity to 95%+ across all dimensions. Each iteration follows the prepare → eval → mutate → verify cycle, with clear acceptance criteria and rollback triggers.

---

## BASELINE SCORING (Iteration 0)

### Current Scores (Pre-Improvement)

| Category | Current Score | Target | Gap | Priority |
|----------|---------------|--------|-----|----------|
| **Agent Health Monitoring** | 90% (9/10) | 95% | -5% | LOW |
| **Session Tracking** | 70% (7/10) | 95% | -25% | MEDIUM |
| **Structured Output** | 50% (5/10) | 95% | -45% | HIGH |
| **Accomplishment Aggregation** | 30% (3/10) | 95% | -65% | CRITICAL |
| **Cross-Session Trends** | 10% (1/10) | 95% | -85% | CRITICAL |
| **Unified Agent View** | 20% (2/10) | 95% | -75% | CRITICAL |

**COMPOSITE SCORE**: 45% (270/600 points)
**REQUIRED**: 95% (570/600 points)
**GAP TO CLOSE**: +300 points

---

## EVALUATION HARNESS DEFINITION

### KPI Rubric for Each Category (0-100 scale)

#### 1. Agent Health Monitoring (Weight: 15%)

| Score | Criteria |
|-------|----------|
| 0-20% | No heartbeat tracking |
| 21-40% | Manual heartbeat only |
| 41-60% | Auto heartbeat with basic status (alive/dead) |
| 61-80% | 3-tier status (alive/stale/dead) + stuck detection |
| 81-95% | + Auto-nudge + waiting detection + nudge history |
| 96-100% | + Predictive health (ML-based anomaly detection) |

**Current**: 90% (missing predictive)
**Blocking Issues**: None

#### 2. Session Tracking (Weight: 15%)

| Score | Criteria |
|-------|----------|
| 0-20% | No session tracking |
| 21-40% | Manual session logs only |
| 41-60% | SQLite session table with basic fields |
| 61-80% | + Duration, terminals launched, start/end times |
| 81-95% | + Eval scores before/after, notes, group tracking |
| 96-100% | + Auto session summaries, trend visualization |

**Current**: 70% (missing auto-summaries)
**Blocking Issues**:
- [ ] Auto-generate session summary on stop
- [ ] Store eval scores consistently
- [ ] Add trend visualization

#### 3. Structured Output (Weight: 20%)

| Score | Criteria |
|-------|----------|
| 0-20% | Raw text logs only |
| 21-40% | Some JSON output, inconsistent format |
| 41-60% | Standard JSON schema, some agents comply |
| 61-80% | All agents write standardized results.json |
| 81-95% | + Semantic action parsing (bug_fix, pr_merged, etc.) |
| 96-100% | + Auto-validation, schema enforcement |

**Current**: 50% (schema defined but not all agents comply)
**Blocking Issues**:
- [ ] Enforce results.json writing in all 8 agent prompts
- [ ] Add accomplishment parser (regex → semantic actions)
- [ ] Create JSON schema validator

#### 4. Accomplishment Aggregation (Weight: 20%)

| Score | Criteria |
|-------|----------|
| 0-20% | No aggregation |
| 21-40% | Manual morning report trigger |
| 41-60% | Auto-trigger morning report on session end |
| 61-80% | + Accomplishments SQLite table |
| 81-95% | + Dashboard widget showing today's accomplishments |
| 96-100% | + Real-time accomplishment streaming to Activity Feed |

**Current**: 30% (manual trigger only)
**Blocking Issues**:
- [ ] Create `accomplishments` SQLite table
- [ ] Auto-trigger morning report on session stop
- [ ] Parse terminal results into accomplishments
- [ ] Add dashboard widget

#### 5. Cross-Session Trends (Weight: 15%)

| Score | Criteria |
|-------|----------|
| 0-20% | No historical data |
| 21-40% | Morning reports stored but not queryable |
| 41-60% | Weekly aggregation available |
| 61-80% | Agent performance comparison across sessions |
| 81-95% | + Trend charts (week-over-week, eval score deltas) |
| 96-100% | + Anomaly detection, regression alerts |

**Current**: 10% (morning reports exist but not queryable)
**Blocking Issues**:
- [ ] Create `trend_metrics` SQLite table
- [ ] Weekly aggregation script
- [ ] Agent comparison query
- [ ] Trend visualization component

#### 6. Unified Agent View (Weight: 15%)

| Score | Criteria |
|-------|----------|
| 0-20% | Research agents and HALO agents tracked separately |
| 21-40% | Some data sharing between systems |
| 41-60% | Unified status endpoint combining both |
| 61-80% | Single dashboard showing all agents |
| 81-95% | + Cross-system accomplishment aggregation |
| 96-100% | + Unified Jira integration for all agents |

**Current**: 20% (separate systems)
**Blocking Issues**:
- [ ] Create unified `/api/agents/all` endpoint
- [ ] Merge heartbeat systems
- [ ] Single dashboard page
- [ ] Cross-system accomplishment rollup

---

## ITERATION PLAN (Up to 10 Iterations)

### Iteration 1: Foundation — Structured Output Enforcement

**Focus**: Category 3 (Structured Output) — Jump from 50% → 80%
**Target**: +30 points composite

#### Tasks
1. **Update all 8 agent prompts** to enforce `terminal_N_results.json` output
2. **Create results schema validator** (`scripts/validate_results.ts`)
3. **Add semantic action parser** (regex patterns for bug_fix, pr_merged, etc.)
4. **Test with one agent** before rolling out to all

#### Acceptance Criteria
- [ ] All 8 prompts have `RESULTS_OUTPUT_SECTION`
- [ ] Schema validator passes for sample results
- [ ] Parser extracts 5+ action types

#### Expected Scores After
| Category | Before | After | Δ |
|----------|--------|-------|---|
| Structured Output | 50% | 80% | +30% |
| **Composite** | 45% | 51% | +6% |

---

### Iteration 2: Auto-Aggregation Pipeline

**Focus**: Category 4 (Accomplishment Aggregation) — Jump from 30% → 70%
**Target**: +40 points composite

#### Tasks
1. **Create `accomplishments` table** in SQLite
2. **Add auto-trigger** to morning report on session stop
3. **Implement accomplishment extractor** from terminal results
4. **Wire morning report to populate table**

#### Acceptance Criteria
- [ ] Table created with schema: id, session_id, agent_id, action_type, description, timestamp
- [ ] Session stop triggers report generation
- [ ] ≥10 accomplishments extracted from test session

#### Expected Scores After
| Category | Before | After | Δ |
|----------|--------|-------|---|
| Accomplishment Aggregation | 30% | 70% | +40% |
| **Composite** | 51% | 59% | +8% |

---

### Iteration 3: Session Tracking Completion

**Focus**: Category 2 (Session Tracking) — Jump from 70% → 90%
**Target**: +20 points composite

#### Tasks
1. **Add auto-session-summary** on session end
2. **Ensure eval_score_before/after** populated for all sessions
3. **Create session detail view** in dashboard

#### Acceptance Criteria
- [ ] Session summary auto-generated and saved
- [ ] Eval scores present for 100% of sessions
- [ ] Session detail page shows timeline + results

#### Expected Scores After
| Category | Before | After | Δ |
|----------|--------|-------|---|
| Session Tracking | 70% | 90% | +20% |
| **Composite** | 59% | 64% | +5% |

---

### Iteration 4: Cross-Session Trend Infrastructure

**Focus**: Category 5 (Cross-Session Trends) — Jump from 10% → 60%
**Target**: +50 points composite

#### Tasks
1. **Create `trend_metrics` table**
2. **Add weekly aggregation script** (`scripts/aggregate_weekly.ts`)
3. **Agent performance comparison query**
4. **Simple trend data endpoint** (`/api/agents/trends`)

#### Acceptance Criteria
- [ ] Trend table stores weekly rollups
- [ ] Query returns agent comparison data
- [ ] Endpoint returns JSON with trend data

#### Expected Scores After
| Category | Before | After | Δ |
|----------|--------|-------|---|
| Cross-Session Trends | 10% | 60% | +50% |
| **Composite** | 64% | 74% | +10% |

---

### Iteration 5: Unified Agent View — Backend

**Focus**: Category 6 (Unified Agent View) — Jump from 20% → 60%
**Target**: +40 points composite

#### Tasks
1. **Create `/api/agents/unified`** combining HALO + Research
2. **Normalize agent data structures**
3. **Merge heartbeat tracking logic**

#### Acceptance Criteria
- [ ] Single endpoint returns all 14 agents (8 Research + 6 HALO)
- [ ] Consistent status fields across both types
- [ ] Heartbeat data unified

#### Expected Scores After
| Category | Before | After | Δ |
|----------|--------|-------|---|
| Unified Agent View | 20% | 60% | +40% |
| **Composite** | 74% | 82% | +8% |

---

### Iteration 6: Dashboard Integration

**Focus**: Categories 4 + 6 — Push both to 85%
**Target**: +25 points composite

#### Tasks
1. **Add "Today's Accomplishments" widget** to dashboard
2. **Create unified agent grid** showing all 14 agents
3. **Wire widgets to new endpoints**

#### Acceptance Criteria
- [ ] Accomplishment widget shows last 24h accomplishments
- [ ] Agent grid shows Research + HALO in single view
- [ ] Widgets refresh automatically

#### Expected Scores After
| Category | Before | After | Δ |
|----------|--------|-------|---|
| Accomplishment Aggregation | 70% | 85% | +15% |
| Unified Agent View | 60% | 85% | +25% |
| **Composite** | 82% | 88% | +6% |

---

### Iteration 7: Trend Visualization

**Focus**: Category 5 (Cross-Session Trends) — Push to 90%
**Target**: +15 points composite

#### Tasks
1. **Create TrendChart component** (week-over-week comparison)
2. **Add eval score delta visualization**
3. **Agent performance sparklines**

#### Acceptance Criteria
- [ ] Chart renders 4-week trend
- [ ] Eval score delta shown with color coding
- [ ] Each agent has sparkline in grid

#### Expected Scores After
| Category | Before | After | Δ |
|----------|--------|-------|---|
| Cross-Session Trends | 60% | 90% | +30% |
| **Composite** | 88% | 92% | +4% |

---

### Iteration 8: Polish & Edge Cases

**Focus**: Push all categories to 95%
**Target**: +15 points composite

#### Tasks
1. **Agent Health**: Add health prediction hints (not ML, just heuristics)
2. **Session Tracking**: Add session comparison view
3. **Structured Output**: Schema validation on write
4. **Accomplishment Aggregation**: Real-time streaming to Activity Feed
5. **Cross-Session Trends**: Add basic anomaly highlighting
6. **Unified Agent View**: Cross-system Jira rollup

#### Acceptance Criteria
- [ ] All categories ≥ 95%
- [ ] No console errors in dashboard
- [ ] All endpoints respond < 200ms

#### Expected Scores After
| Category | Before | After | Δ |
|----------|--------|-------|---|
| Agent Health Monitoring | 90% | 95% | +5% |
| Session Tracking | 90% | 95% | +5% |
| Structured Output | 80% | 95% | +15% |
| Accomplishment Aggregation | 85% | 95% | +10% |
| Cross-Session Trends | 90% | 95% | +5% |
| Unified Agent View | 85% | 95% | +10% |
| **COMPOSITE** | 92% | **95%** | +3% |

---

### Iteration 9: Verification & Testing

**Focus**: Prove 95%+ is stable
**Target**: Confirm scores, fix any regressions

#### Tasks
1. **Run full eval harness** 3 times
2. **Fix any flaky tests or measurements**
3. **Document edge cases found**

#### Acceptance Criteria
- [ ] 3 consecutive eval runs ≥ 95% composite
- [ ] No regressions in any category
- [ ] Edge cases documented

---

### Iteration 10: Documentation & Deployment Readiness

**Focus**: Ensure system is deployable
**Target**: Final verification

#### Tasks
1. **Update CLAUDE.md** with new endpoints
2. **Update Master Tracker** with completion
3. **Create deployment checklist**
4. **Tag release candidate**

#### Acceptance Criteria
- [ ] Documentation complete
- [ ] Master Tracker updated
- [ ] RC tagged in git
- [ ] **DEPLOYMENT GATE PASSED**: All categories ≥ 95%

---

## EVAL HARNESS SCRIPT

To be created at: `scripts/eval_research_audit.ts`

```typescript
// Pseudo-implementation
interface AuditScore {
  agentHealthMonitoring: number;
  sessionTracking: number;
  structuredOutput: number;
  accomplishmentAggregation: number;
  crossSessionTrends: number;
  unifiedAgentView: number;
  composite: number;
}

function evaluateCategory(category: string): number {
  // Check specific criteria for each category
  // Return 0-100 score
}

function runEval(): AuditScore {
  return {
    agentHealthMonitoring: evaluateCategory('health'),
    sessionTracking: evaluateCategory('session'),
    structuredOutput: evaluateCategory('output'),
    accomplishmentAggregation: evaluateCategory('aggregation'),
    crossSessionTrends: evaluateCategory('trends'),
    unifiedAgentView: evaluateCategory('unified'),
    composite: calculateComposite()
  };
}

function checkDeploymentGate(scores: AuditScore): boolean {
  return Object.values(scores).every(s => s >= 95);
}
```

---

## ITERATION TRACKING TABLE

| Iteration | Focus | Composite Before | Composite After | Gate Passed? |
|-----------|-------|------------------|-----------------|--------------|
| 0 | Baseline | — | 45% | ❌ |
| 1 | Structured Output | 45% | 51% | ❌ |
| 2 | Auto-Aggregation | 51% | 59% | ❌ |
| 3 | Session Tracking | 59% | 64% | ❌ |
| 4 | Cross-Session Trends | 64% | 74% | ❌ |
| 5 | Unified Backend | 74% | 82% | ❌ |
| 6 | Dashboard | 82% | 88% | ❌ |
| 7 | Trend Viz | 88% | 92% | ❌ |
| 8 | Polish | 92% | 95% | ⏳ |
| 9 | Verification | 95% | 95%+ | ✅ |
| 10 | Documentation | 95%+ | 95%+ | ✅ |

---

## ROLLBACK TRIGGERS

If any iteration causes:
1. **Build failure** → Revert immediately
2. **Composite score drops >5%** → Investigate before proceeding
3. **Category regresses >10%** → Fix before next iteration
4. **Test suite fails** → No deployment until green

---

## SUCCESS CRITERIA (Deployment Gate)

**ALL of the following MUST be true:**

1. ✅ Agent Health Monitoring ≥ 95%
2. ✅ Session Tracking ≥ 95%
3. ✅ Structured Output ≥ 95%
4. ✅ Accomplishment Aggregation ≥ 95%
5. ✅ Cross-Session Trends ≥ 95%
6. ✅ Unified Agent View ≥ 95%
7. ✅ Composite Score ≥ 95%
8. ✅ Build passes
9. ✅ All tests pass
10. ✅ 3 consecutive eval runs stable

**CANNOT DEPLOY UNTIL ALL GREEN**

---

## FILES TO CREATE

| File | Purpose | Iteration |
|------|---------|-----------|
| `scripts/eval_research_audit.ts` | Eval harness for 6 categories | 0 (pre-work) |
| `src/lib/db-accomplishments.ts` | Accomplishments table operations | 2 |
| `scripts/aggregate_weekly.ts` | Weekly trend aggregation | 4 |
| `src/app/api/agents/unified/route.ts` | Unified agent endpoint | 5 |
| `src/components/Dashboard/AccomplishmentsWidget.tsx` | Dashboard widget | 6 |
| `src/components/Dashboard/TrendChart.tsx` | Trend visualization | 7 |

---

## ESTIMATED EFFORT

| Iteration | Effort | Cumulative |
|-----------|--------|------------|
| 1 | 2-3 hours | 3 hours |
| 2 | 3-4 hours | 7 hours |
| 3 | 2-3 hours | 10 hours |
| 4 | 3-4 hours | 14 hours |
| 5 | 3-4 hours | 18 hours |
| 6 | 3-4 hours | 22 hours |
| 7 | 2-3 hours | 25 hours |
| 8 | 3-4 hours | 29 hours |
| 9 | 1-2 hours | 31 hours |
| 10 | 1-2 hours | 33 hours |

**Total Estimated Effort**: 30-35 hours (4-5 days of focused work)

---

## NEXT STEP

**Before Iteration 1**: Create the eval harness script (`scripts/eval_research_audit.ts`) to establish automated scoring.

**Ready to proceed?**

---

*Plan created: 2026-03-22*
*Pattern: AutoResearch (prepare → eval → mutate → verify)*
*Blocking deployment until: 95%+ in ALL categories*
