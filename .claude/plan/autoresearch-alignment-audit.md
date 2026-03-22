# AutoResearch Alignment Audit

## Karpathy AutoResearch Methodology (Reference)

Source: https://github.com/karpathy/autoresearch

### Core Principles

1. **Three-File Architecture**
   - `prepare.py` (IMMUTABLE) - Data prep, evaluation, constants
   - `train.py` (AGENT-MODIFIED) - The ONLY file agents can edit
   - `program.md` (HUMAN-MODIFIED) - Agent instructions/skill

2. **Fixed Time Budget**
   - Each experiment runs exactly 5 minutes
   - Results are comparable regardless of agent changes
   - Enables ~12 experiments/hour, ~100 overnight

3. **Single Metric: `val_bpb`**
   - Validation bits-per-byte (lower = better)
   - Vocab-size-independent for fair comparison
   - Ground truth from fixed evaluation harness

4. **Experiment Loop Protocol**
   ```
   LOOP FOREVER:
   1. Look at git state (current branch/commit)
   2. Modify with experimental idea (hack the code directly)
   3. git commit
   4. Run experiment: uv run train.py > run.log 2>&1
   5. Read results: grep "^val_bpb:" run.log
   6. If improved → keep commit, advance branch
   7. If equal/worse → git reset back to start
   8. NEVER STOP (fully autonomous until manually interrupted)
   ```

5. **Results Logging**
   - TSV format with columns: commit, val_bpb, memory_gb, status, description
   - Status: keep | discard | crash
   - Results.tsv NOT committed to git (untracked)

6. **Simplicity Criterion**
   - Simpler is better, all else equal
   - Small improvement + ugly complexity = NOT worth it
   - Equal results + simpler code = DEFINITELY keep
   - Deleting code that gets same results = WIN

7. **NEVER STOP Rule**
   - Agent runs INDEFINITELY until manually stopped
   - NO pausing to ask human questions
   - If out of ideas → think harder, read papers, try radical changes
   - Human might be asleep → agent must keep working

---

## SwjshAK Research Lab Gap Analysis

### What We Have vs. AutoResearch

| AutoResearch Principle | SwjshAK Status | Gap |
|------------------------|----------------|-----|
| Fixed time budget | ❌ 4-hour session limit | Not per-experiment, per-session |
| Single metric | ❌ Multiple metrics (eval_harness 5 dimensions) | Need composite target |
| Experiment loop | ⚠️ Partial (heartbeat, phases) | Missing: git branch, keep/discard, results.tsv |
| git commit per experiment | ❌ Single commit at end | Need per-experiment commits |
| NEVER STOP | ⚠️ Partial (has exit conditions) | Still pauses for context limits |
| results.tsv logging | ❌ Missing | Need standardized TSV format |
| Simplicity criterion | ❌ Not enforced | No complexity vs. improvement tradeoff |

### Critical Gaps

1. **No Per-Experiment Git Commits**
   - AutoResearch: commit before EVERY experiment
   - SwjshAK: batch commit at session end
   - Fix: Add git commit after each change, git reset on failure

2. **No Keep/Discard Loop**
   - AutoResearch: measure → keep or reset → iterate
   - SwjshAK: execute → verify at end
   - Fix: Implement experiment loop with git reset on regression

3. **No results.tsv Standard**
   - AutoResearch: TSV with commit/metric/memory/status/description
   - SwjshAK: JSON logs, no standardized format
   - Fix: Add results.tsv logging per agent

4. **No NEVER STOP Autonomy**
   - AutoResearch: runs until manually killed
   - SwjshAK: stops on context limit, time limit, failures
   - Fix: More aggressive continuation, /compact usage

5. **No Simplicity Scoring**
   - AutoResearch: complexity cost vs improvement magnitude
   - SwjshAK: only measures if things work
   - Fix: Add complexity delta tracking (lines changed, files touched)

---

## Alignment Implementation Plan

### Phase 1: Git-Per-Experiment Protocol

Add to ALL agent prompts:

```markdown
## Git Experiment Protocol

Before EACH change:
1. Note current commit: `git rev-parse --short HEAD`
2. Make changes
3. Commit immediately: `git commit -am "experiment: <description>"`
4. Run validation
5. Check metric:
   - If improved → KEEP (advance branch)
   - If same/worse → DISCARD: `git reset --hard <previous_commit>`
6. Log to results.tsv
7. Repeat FOREVER
```

### Phase 2: results.tsv Standard

Create `results.tsv` file per session:

```
commit	metric	memory_gb	status	description
a1b2c3d	72.5	2.1	keep	baseline eval score
b2c3d4e	74.2	2.1	keep	added test for strategy
c3d4e5f	73.8	2.2	discard	refactored but slower
```

Metric varies by agent:
- IMPROVER: eval_harness composite
- BACKTESTER: average Sharpe ratio
- RESEARCHER: findings_actionability_score
- BRAIN_UPDATER: brain_freshness_pct
- SECURITY_AUDITOR: vulnerabilities_remediated
- INTEGRATION_TESTER: test_pass_rate
- INTEL_AGGREGATOR: prediction_accuracy
- DEVOPS_OPTIMIZER: build_time_reduction_pct

### Phase 3: NEVER STOP Enforcement

Replace exit conditions with continuation rules:

```markdown
## Continuation Rules (NEVER STOP)

You run INDEFINITELY until:
- Manual stop signal (.claude/overnight/STOP file exists)
- Critical system failure (build completely broken, cannot recover)

If context approaches limit:
1. Run /compact immediately
2. Continue working
3. If still limited, save state and RE-SPAWN yourself

If out of ideas:
1. Re-read program.md for missed angles
2. Try combining previous near-misses
3. Try radical/unconventional changes
4. Search for external patterns (GitHub, papers)

DO NOT ask "should I continue?" - YES, ALWAYS CONTINUE.
```

### Phase 4: Simplicity Criterion

Add to each agent's evaluation:

```markdown
## Simplicity Criterion

When evaluating changes:
- Track: lines_added, lines_removed, files_touched
- Calculate: complexity_delta = lines_added - lines_removed

Decision Matrix:
| Metric Improved | Complexity Delta | Decision |
|-----------------|------------------|----------|
| +3 or more | Any | KEEP |
| +1 to +2 | -10 or less | KEEP |
| +1 to +2 | +10 or more | DISCARD |
| 0 or negative | -20 or less | KEEP (simplification win) |
| 0 or negative | Other | DISCARD |
```

---

## Agent-Specific program.md Files

Each agent needs a `program.md` file following AutoResearch format.

### File Structure

```
.claude/overnight/programs/
├── improver_program.md
├── backtester_program.md
├── researcher_program.md
├── brain_updater_program.md
├── security_auditor_program.md
├── integration_tester_program.md
├── intel_aggregator_program.md
└── devops_optimizer_program.md
```

### program.md Template

```markdown
# {AGENT_NAME} Program

## Setup

To set up a new experiment session:
1. **Agree on a run tag**: e.g., `overnight-2026-03-22`
2. **Create the branch**: `git checkout -b autoresearch/{agent}/{tag}`
3. **Read in-scope files**: {agent-specific file list}
4. **Initialize results.tsv**: Create with header row
5. **Establish baseline**: Run evaluation, record in results.tsv

## What You CAN Do
{agent-specific allowed modifications}

## What You CANNOT Do
{agent-specific restrictions}

## The Goal
{single metric to optimize, e.g., "get the lowest X" or "get the highest Y"}

## Experiment Loop

LOOP FOREVER:
1. git state: note current commit
2. Make experimental change
3. git commit -am "experiment: {description}"
4. Run validation: {agent-specific validation command}
5. Extract metric: {agent-specific metric extraction}
6. If metric improved → KEEP
7. If metric same/worse → git reset --hard {previous}
8. Log to results.tsv
9. NEVER STOP

## Simplicity Criterion
{standard simplicity rules}

## Output Format
{agent-specific output format}
```

---

## Immediate Actions

1. ✅ Create 8 program.md files (one per agent)
2. ✅ Update generate_overnight_prompts.ts to use program.md format
3. ✅ Add results.tsv initialization and logging
4. ✅ Implement git-per-experiment protocol
5. ✅ Remove exit conditions except STOP file (NEVER STOP)
6. ✅ Add simplicity criterion to evaluation

---

## Implementation Completed

### Files Created

**Program Files** (`.claude/overnight/programs/`):
1. `improver_program.md` - Eval harness composite score optimization
2. `backtester_program.md` - Average Sharpe ratio optimization
3. `researcher_program.md` - Actionable findings discovery
4. `brain_updater_program.md` - Brain freshness percentage
5. `security_auditor_program.md` - Vulnerabilities remediated
6. `integration_tester_program.md` - Test pass rate
7. `intel_aggregator_program.md` - Prediction accuracy
8. `devops_optimizer_program.md` - Build time reduction

**Updated Scripts**:
- `scripts/generate_overnight_prompts.ts` - Now uses program.md files, follows AutoResearch methodology

### Key Changes

1. **Replaced EXIT_CONDITIONS with NEVER_STOP Protocol**
   - Agents run indefinitely until `.claude/overnight/STOP` file exists
   - Context limit handling via `/compact`
   - "DO NOT ask should I continue? - YES, ALWAYS CONTINUE"

2. **Added Git-Per-Experiment Protocol**
   - Each agent creates branch: `autoresearch/<role>/<run-tag>`
   - Commit before EVERY experiment
   - Git reset on failure/regression
   - results.tsv logging (untracked)

3. **Added Simplicity Criterion**
   - Each program.md includes complexity delta tracking
   - Decision matrix based on metric vs complexity tradeoff
   - Equal results + simpler code = KEEP

4. **Standardized results.tsv Format**
   - Common columns: commit, metric, memory_gb, status, description
   - Agent-specific metric columns as needed
   - Status: baseline | keep | discard | crash

### Validation

```bash
# Generate prompts (all verified ✓)
npx tsx scripts/generate_overnight_prompts.ts --dry-run

# Output:
Terminal 1 (improver):    Program: improver_program.md ✓
Terminal 2 (backtester):  Program: backtester_program.md ✓
Terminal 3 (researcher):  Program: researcher_program.md ✓
Terminal 4 (brain_updater): Program: brain_updater_program.md ✓
Terminal 5 (security_auditor): Program: security_auditor_program.md ✓
Terminal 6 (integration_tester): Program: integration_tester_program.md ✓
Terminal 7 (intel_aggregator): Program: intel_aggregator_program.md ✓
Terminal 8 (devops_optimizer): Program: devops_optimizer_program.md ✓
```

---

*Audit completed: 2026-03-22*
*Implementation completed: 2026-03-22*
*Based on: https://github.com/karpathy/autoresearch (main branch)*
