# Implementation Plan: Halo Agents ECC Tools Integration Test via Jira Workflow

**Generated**: 2026-03-22
**Status**: READY FOR EXECUTION
**Scope**: End-to-end system validation with KPI benchmarking (10 iterations)

---

## Executive Summary

This plan tests ALL 6 Halo agents (Chief, Ops, Hunter, Arbiter, Cortana, Scout) using their assigned ECC tools through the Jira workflow system. The test proves end-to-end system integration and establishes KPI baselines, then runs 10 iterations to measure improvement.

---

## Phase 1: Test Infrastructure Setup

### 1.1 Create Jira Test Tickets (Bootstrap)

Create one test ticket per Halo agent in their respective Jira projects:

| Halo Agent | Jira Project | Ticket Title | ECC Skill to Test |
|------------|--------------|--------------|-------------------|
| **Chief** | MGMT | [TEST] ECC Integration Validation - Chief | `/harness-audit`, `planner` |
| **Ops** | PULSE | [TEST] ECC Integration Validation - Ops | `/tdd`, `build-error-resolver`, `/verify` |
| **Hunter** | INFRA | [TEST] ECC Integration Validation - Hunter | `/security-review`, `database-reviewer` |
| **Arbiter** | GRADE | [TEST] ECC Integration Validation - Arbiter | `/code-review`, `build-error-resolver` |
| **Cortana** | LEARN | [TEST] ECC Integration Validation - Cortana | `/code-review`, `python-reviewer`, `typescript-reviewer` |
| **Scout** | BACK | [TEST] ECC Integration Validation - Scout | `architect`, `planner` |

### 1.2 KPI Tracking Schema

Create `data/ecc-benchmark/` directory with:

```
data/ecc-benchmark/
├── config.json           # Test configuration
├── baseline/
│   └── run-0.json        # Pre-test baseline
├── iterations/
│   ├── run-1.json
│   ├── run-2.json
│   └── ... (run-10.json)
└── summary.json          # Aggregate results
```

### 1.3 KPI Metrics to Track

| Metric ID | Metric Name | Measurement Method | Target |
|-----------|-------------|-------------------|--------|
| `M1` | Ticket Pickup Time | Time from "To Do" to "In Progress" | < 5 min |
| `M2` | ECC Skill Invocation Success | % of skills that execute without error | 100% |
| `M3` | Jira Comment Quality | Comment contains ECC output (Y/N) | 100% |
| `M4` | Ticket Resolution Time | Time from "In Progress" to "Done" | Baseline |
| `M5` | ECC Finding Count | # of findings per skill invocation | Track |
| `M6` | Auto-fix Success Rate | % of auto-fixable issues resolved | Track |
| `M7` | Agent Communication | Did agent notify Chief? (Y/N) | 100% |
| `M8` | Cross-Agent Coordination | Did agents reference each other? | Track |
| `M9` | Brain Memory Update | Did agent update `data/brain/*.md`? | 100% |
| `M10` | End-to-End Duration | Total test cycle time | Track |

---

## Phase 2: Test Execution Workflow

### 2.1 Single Iteration Flow

```
┌─────────────────────────────────────────────────────────────┐
│  ITERATION START (Triggered by: python jira_agent_loop.py) │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: JIRA PICKUP                                        │
│  - Agent reads assigned ticket from "To Do" column          │
│  - Transitions to "In Progress"                             │
│  - Posts comment: "Agent picking up issue..."               │
│  - KPI: M1 (Ticket Pickup Time)                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: ECC SKILL INVOCATION                               │
│  - Agent invokes assigned ECC skill(s)                      │
│  - Chief: /harness-audit                                    │
│  - Ops: /tdd, /verify                                       │
│  - Hunter: /security-review                                 │
│  - Arbiter: /code-review                                    │
│  - Cortana: /python-review, /typescript-review              │
│  - Scout: /plan, architect agent                            │
│  - KPI: M2 (ECC Invocation Success)                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: ECC OUTPUT PROCESSING                              │
│  - Agent captures ECC tool output                           │
│  - Counts findings (CRITICAL/HIGH/MEDIUM/LOW)               │
│  - Identifies auto-fixable issues                           │
│  - KPI: M5 (Finding Count), M6 (Auto-fix Rate)              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: JIRA COMMENT UPDATE                                │
│  - Agent posts ECC results to Jira ticket                   │
│  - Format: Markdown with findings summary                   │
│  - Include: Skill used, findings, recommendations           │
│  - KPI: M3 (Comment Quality)                                │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: CROSS-AGENT COORDINATION                           │
│  - If findings affect other agents, @mention them           │
│  - Chief: Coordinates all agent outputs                     │
│  - Create linked tickets if needed                          │
│  - KPI: M7 (Agent Communication), M8 (Cross-Agent)          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 6: BRAIN MEMORY UPDATE                                │
│  - Agent updates relevant data/brain/*.md file              │
│  - Chief: coordination-memory.md                            │
│  - Ops: incident-memory.md                                  │
│  - Hunter: code-evolution.md                                │
│  - Arbiter: quality-memory.md                               │
│  - Cortana: pattern-memory.md                               │
│  - Scout: backlog-memory.md                                 │
│  - KPI: M9 (Brain Memory Update)                            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 7: TICKET RESOLUTION                                  │
│  - Agent transitions ticket to "Done"                       │
│  - Posts final summary comment                              │
│  - Records iteration metrics to JSON                        │
│  - KPI: M4 (Resolution Time), M10 (E2E Duration)            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  ITERATION COMPLETE                                         │
│  - Save results to data/ecc-benchmark/iterations/run-N.json │
│  - If N < 10: Create new tickets, loop to ITERATION START   │
│  - If N = 10: Generate summary report                       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Parallel Agent Execution

For each iteration, all 6 agents run in parallel:

```bash
# Launch all agents simultaneously
python scripts/jira_agent_loop.py start MGMT &  # Chief
python scripts/jira_agent_loop.py start PULSE & # Ops
python scripts/jira_agent_loop.py start INFRA & # Hunter
python scripts/jira_agent_loop.py start GRADE & # Arbiter
python scripts/jira_agent_loop.py start LEARN & # Cortana
python scripts/jira_agent_loop.py start BACK &  # Scout
wait
```

---

## Phase 3: KPI Benchmarking System

### 3.1 Baseline Measurement (Run 0)

Before first iteration, capture baseline metrics:

```json
// data/ecc-benchmark/baseline/run-0.json
{
  "timestamp": "2026-03-22T...",
  "iteration": 0,
  "agents": {
    "chief": {
      "skills_available": ["harness-audit", "planner"],
      "jira_connection": true,
      "brain_files_exist": true
    },
    // ... other agents
  },
  "system_metrics": {
    "jira_api_latency_ms": 250,
    "ecc_skill_load_time_ms": 500,
    "agent_spawn_time_ms": 2000
  }
}
```

### 3.2 Iteration Metrics (Run 1-10)

Each iteration records:

```json
// data/ecc-benchmark/iterations/run-N.json
{
  "timestamp": "2026-03-22T...",
  "iteration": 1,
  "agents": {
    "chief": {
      "ticket_key": "MGMT-XX",
      "pickup_time_ms": 3000,
      "ecc_skills_invoked": ["harness-audit"],
      "ecc_success": true,
      "findings": { "critical": 0, "high": 2, "medium": 5, "low": 3 },
      "jira_comment_posted": true,
      "cross_agent_mentions": ["hunter", "ops"],
      "brain_updated": true,
      "resolution_time_ms": 45000
    },
    // ... other agents
  },
  "aggregate": {
    "total_duration_ms": 60000,
    "total_findings": 30,
    "success_rate": 100,
    "cross_agent_coordination_score": 85
  }
}
```

### 3.3 Improvement Tracking

After each iteration, calculate delta from baseline:

| Metric | Run 1 | Run 2 | Run 3 | ... | Run 10 | Trend |
|--------|-------|-------|-------|-----|--------|-------|
| M1 (Pickup Time) | 5s | 4.5s | 4s | ... | 3s | -40% |
| M2 (ECC Success) | 100% | 100% | 100% | ... | 100% | Stable |
| M4 (Resolution Time) | 60s | 55s | 50s | ... | 40s | -33% |
| M5 (Finding Count) | 30 | 28 | 25 | ... | 20 | -33% |

---

## Phase 4: Agent-Specific Test Cases

### 4.1 Chief (MGMT) Test

**Ticket**: [TEST] ECC Integration - Morning Briefing with /harness-audit

**Steps**:
1. Run `/harness-audit` to get baseline quality score
2. Compile mock status from all agents
3. Generate CEO briefing format
4. Post results to Jira with ECC score
5. Update `data/brain/coordination-memory.md`

**Success Criteria**:
- [ ] `/harness-audit` executes without error
- [ ] Output includes quality score (0-100)
- [ ] Briefing format matches CHIEF_SOUL.md template
- [ ] Memory file updated with timestamp

### 4.2 Ops (PULSE) Test

**Ticket**: [TEST] ECC Integration - Build Validation with /verify

**Steps**:
1. Run `/verify` command (build + lint + test)
2. If failures: invoke `build-error-resolver` agent
3. Run `/tdd` to check test coverage
4. Post results to Jira
5. Update `data/brain/incident-memory.md`

**Success Criteria**:
- [ ] `/verify` executes all checks
- [ ] Test coverage reported
- [ ] Any failures documented
- [ ] Escalation path followed if needed

### 4.3 Hunter (INFRA) Test

**Ticket**: [TEST] ECC Integration - Security Audit with /security-review

**Steps**:
1. Run `/security-review` on `scripts/*.py`
2. Run `/security-review` on `src/app/api/**/*.ts`
3. Invoke `database-reviewer` on Prisma schema
4. Compile findings
5. Update `data/brain/code-evolution.md`

**Success Criteria**:
- [ ] Security scan covers all target files
- [ ] Findings categorized (CRITICAL/HIGH/MEDIUM/LOW)
- [ ] No false negatives on known test vectors
- [ ] Database schema reviewed

### 4.4 Arbiter (GRADE) Test

**Ticket**: [TEST] ECC Integration - Code Quality Review with /code-review

**Steps**:
1. Run `/code-review` on recent changes
2. Generate trade-style grade (A-F)
3. If build issues: invoke `build-error-resolver`
4. Post quality report to Jira
5. Update `data/brain/quality-memory.md`

**Success Criteria**:
- [ ] Code review generates structured output
- [ ] Grade assigned with justification
- [ ] Improvement recommendations included
- [ ] Quality trends tracked

### 4.5 Cortana (LEARN) Test

**Ticket**: [TEST] ECC Integration - Pattern Analysis with /python-review

**Steps**:
1. Run `/python-review` on `scripts/*_engine.py`
2. Run `/typescript-review` on `src/**/*.ts`
3. Run `/code-review` for patterns
4. Identify potential patterns
5. Update `data/brain/pattern-memory.md`

**Success Criteria**:
- [ ] Python and TypeScript files analyzed
- [ ] Patterns identified (if any)
- [ ] Findings linked to LEARN methodology
- [ ] Statistical rigor maintained

### 4.6 Scout (BACK) Test

**Ticket**: [TEST] ECC Integration - Architecture Review with /plan

**Steps**:
1. Invoke `architect` agent on system design
2. Run `/plan` for a mock feature
3. Generate backlog recommendations
4. Post architectural notes to Jira
5. Update `data/brain/backlog-memory.md`

**Success Criteria**:
- [ ] Architecture assessment complete
- [ ] Implementation plan generated
- [ ] Trade-offs documented
- [ ] Backlog priorities clear

---

## Phase 5: 10-Iteration Execution Script

### 5.1 Main Test Runner

Create `scripts/ecc_benchmark_runner.py`:

```python
#!/usr/bin/env python3
"""
ECC Benchmark Runner - 10 Iteration Test Suite
Validates Halo agents + ECC tools + Jira workflow end-to-end
"""

import json
import time
from datetime import datetime
from pathlib import Path

ITERATIONS = 10
BENCHMARK_DIR = Path("data/ecc-benchmark")
AGENTS = ["chief", "ops", "hunter", "arbiter", "cortana", "scout"]
JIRA_PROJECTS = {
    "chief": "MGMT",
    "ops": "PULSE",
    "hunter": "INFRA",
    "arbiter": "GRADE",
    "cortana": "LEARN",
    "scout": "BACK"
}

def run_iteration(iteration_num: int) -> dict:
    """Execute single iteration for all agents"""
    results = {
        "timestamp": datetime.now().isoformat(),
        "iteration": iteration_num,
        "agents": {},
        "aggregate": {}
    }

    for agent in AGENTS:
        # 1. Create Jira ticket
        # 2. Agent picks up and processes
        # 3. ECC skill invoked
        # 4. Results captured
        # 5. Ticket resolved
        results["agents"][agent] = run_agent_test(agent, iteration_num)

    # Calculate aggregates
    results["aggregate"] = calculate_aggregates(results["agents"])

    return results

def save_iteration(iteration_num: int, results: dict):
    """Save iteration results to JSON"""
    filepath = BENCHMARK_DIR / "iterations" / f"run-{iteration_num}.json"
    filepath.parent.mkdir(parents=True, exist_ok=True)
    filepath.write_text(json.dumps(results, indent=2))

def main():
    print(f"ECC Benchmark Runner - {ITERATIONS} Iterations")
    print("=" * 60)

    # Baseline (Run 0)
    baseline = capture_baseline()
    save_baseline(baseline)

    # Iterations 1-10
    for i in range(1, ITERATIONS + 1):
        print(f"\nIteration {i}/{ITERATIONS}")
        results = run_iteration(i)
        save_iteration(i, results)
        compare_to_baseline(results, baseline)

        if i < ITERATIONS:
            print("Creating new test tickets for next iteration...")
            create_test_tickets()

    # Final summary
    generate_summary_report()
    print("\nBenchmark complete! See data/ecc-benchmark/summary.json")

if __name__ == "__main__":
    main()
```

### 5.2 PowerShell Wrapper

Create `Run-ECC-Benchmark.ps1`:

```powershell
# Run-ECC-Benchmark.ps1
# Full 10-iteration ECC benchmark test

Write-Host "Starting ECC Benchmark Test (10 iterations)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Ensure dependencies
python --version
if ($LASTEXITCODE -ne 0) {
    Write-Error "Python not found"
    exit 1
}

# Create benchmark directory
$benchmarkDir = "data/ecc-benchmark"
if (-not (Test-Path $benchmarkDir)) {
    New-Item -ItemType Directory -Path $benchmarkDir -Force
    New-Item -ItemType Directory -Path "$benchmarkDir/baseline" -Force
    New-Item -ItemType Directory -Path "$benchmarkDir/iterations" -Force
}

# Run benchmark
python scripts/ecc_benchmark_runner.py

# Generate HTML report
python scripts/generate_benchmark_report.py

Write-Host "`nBenchmark complete!" -ForegroundColor Green
Write-Host "Results: $benchmarkDir/summary.json" -ForegroundColor Yellow
Write-Host "Report:  $benchmarkDir/report.html" -ForegroundColor Yellow
```

---

## Phase 6: Success Criteria & Validation

### 6.1 Pass/Fail Criteria

| Criteria | Required | Actual |
|----------|----------|--------|
| All 6 agents pick up tickets | 100% | TBD |
| All ECC skills execute without error | 100% | TBD |
| All Jira comments contain ECC output | 100% | TBD |
| All brain files updated | 100% | TBD |
| Improvement trend visible across iterations | Yes | TBD |
| No critical security issues unaddressed | 0 | TBD |
| Test completes within 2 hours | Yes | TBD |

### 6.2 Expected Improvements (Iteration 1 → 10)

| Metric | Expected Improvement |
|--------|---------------------|
| Ticket Resolution Time | -30% |
| Finding Count (indicates codebase improving) | -50% |
| Cross-Agent Coordination | +20% |
| Auto-fix Success Rate | +40% |
| ECC Skill Proficiency | +25% |

---

## Phase 7: Post-Test Analysis

### 7.1 Summary Report Contents

```json
// data/ecc-benchmark/summary.json
{
  "test_completed": "2026-03-22T...",
  "total_iterations": 10,
  "total_duration_ms": 7200000,
  "overall_success_rate": 98.5,
  "improvement_trend": {
    "resolution_time": "-32%",
    "finding_count": "-48%",
    "coordination_score": "+22%"
  },
  "agent_performance": {
    "chief": { "score": 95, "rank": 1 },
    "ops": { "score": 92, "rank": 3 },
    "hunter": { "score": 94, "rank": 2 },
    "arbiter": { "score": 91, "rank": 4 },
    "cortana": { "score": 89, "rank": 5 },
    "scout": { "score": 88, "rank": 6 }
  },
  "key_findings": [
    "Hunter's /security-review found 12 issues across 10 iterations",
    "Ops's /verify caught 3 build errors before merge",
    "Cross-agent coordination improved 22% from iteration 1 to 10"
  ],
  "recommendations": [
    "Increase Cortana's ECC skill usage",
    "Automate Hunter's security scan pre-commit",
    "Add more /tdd coverage to trading engines"
  ]
}
```

### 7.2 HTML Report

Generate visual report with charts showing:
- Iteration-over-iteration improvement
- Agent performance comparison
- KPI trend lines
- Finding distribution by category
- Time-to-resolution histogram

---

## Implementation Steps

### Step 1: Create Test Infrastructure (30 min)
- [ ] Create `data/ecc-benchmark/` directory structure
- [ ] Create `scripts/ecc_benchmark_runner.py`
- [ ] Create `Run-ECC-Benchmark.ps1`
- [ ] Verify Jira API connectivity

### Step 2: Create Test Tickets (15 min)
- [ ] Create 6 test tickets (one per agent/project)
- [ ] Assign to "To Do" status
- [ ] Add `ecc-benchmark` label

### Step 3: Run Baseline (Run 0) (10 min)
- [ ] Capture system baseline metrics
- [ ] Save to `data/ecc-benchmark/baseline/run-0.json`
- [ ] Verify all agents can connect

### Step 4: Execute 10 Iterations (60-90 min)
- [ ] Run iteration 1-10
- [ ] Monitor for errors
- [ ] Collect all metrics

### Step 5: Generate Reports (15 min)
- [ ] Generate `summary.json`
- [ ] Generate `report.html`
- [ ] Update Master Tracker with results

### Step 6: Analysis & Next Steps (15 min)
- [ ] Review improvement trends
- [ ] Identify top performers
- [ ] Document lessons learned
- [ ] Create follow-up tickets

---

## Key Files

| File | Purpose |
|------|---------|
| `scripts/ecc_benchmark_runner.py` | Main test orchestrator |
| `scripts/jira_agent_loop.py` | Agent loop controller |
| `scripts/jira_client.py` | Jira API client |
| `data/ecc-benchmark/config.json` | Test configuration |
| `data/ecc-benchmark/baseline/run-0.json` | Baseline metrics |
| `data/ecc-benchmark/iterations/run-N.json` | Iteration results |
| `data/ecc-benchmark/summary.json` | Aggregate summary |
| `Run-ECC-Benchmark.ps1` | PowerShell wrapper |

---

## SESSION_ID Handoff

For `/ccg:execute` continuation:
- CODEX_SESSION: (Not used - local execution)
- GEMINI_SESSION: (Not used - local execution)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Jira API rate limiting | Add delays between agent calls |
| ECC skill timeout | Set 5-minute timeout, retry once |
| Agent crash mid-iteration | Auto-restart via agent_runner.ts |
| Network issues | Retry with exponential backoff |
| Concurrent ticket access | Use Jira atomic transitions |

---

*This plan validates the complete Halo + ECC + Jira integration with measurable KPIs across 10 iterations.*
