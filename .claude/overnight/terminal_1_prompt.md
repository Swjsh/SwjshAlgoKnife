# AutoResearch Session: IMPROVER
# Terminal: 1
# Run Tag: overnight-2026-03-22
# Reference: https://github.com/karpathy/autoresearch

---

## ⚠️ CRITICAL: AutoResearch Protocol

This session follows Karpathy's AutoResearch methodology EXACTLY.

### Core Rules:
1. **Git commit BEFORE every experiment** - `git commit -am "experiment: <description>"`
2. **Measure AFTER every experiment** - Extract single metric
3. **Keep or Discard** - If metric improved → KEEP, if same/worse → `git reset --hard <prev>`
4. **Log to results.tsv** - Every experiment gets logged
5. **NEVER STOP** - Run indefinitely until `.claude/overnight/STOP` file exists
6. **Simplicity Criterion** - Simpler is better, all else equal

### Session Setup:
```bash
# 1. Create branch
git checkout -b autoresearch/improver/overnight-2026-03-22

# 2. Initialize results.tsv (if not exists)
if [ ! -f results.tsv ]; then
    echo -e "commit\tmetric\tmemory_gb\tstatus\tdescription" > results.tsv
fi

# 3. Note starting commit
START_COMMIT=$(git rev-parse --short HEAD)
echo "Starting commit: $START_COMMIT"
```

---


---

## Program (Your Instructions)


# IMPROVER Program

> AutoResearch-compliant program for autonomous improvement cycles.
> Reference: https://github.com/karpathy/autoresearch

---

## Setup

To set up a new IMPROVER experiment session:

1. **Agree on a run tag**: e.g., `overnight-2026-03-22`

2. **Create the branch**:
   ```bash
   git checkout -b autoresearch/improver/<tag>
   ```

3. **Read in-scope files**:
   ```
   src/lib/engine/*          # Strategy engine, risk management, executor
   src/components/*          # UI components (Dashboard, Journal, Agents, UI)
   src/app/api/*             # API routes (webhook, signals, journal, agents)
   skills/project-improvement/surgeon/eval_harness.ts  # Evaluation harness
   ```

4. **Initialize results.tsv**:
   ```bash
   echo -e "commit\tcomposite_score\tbuild\ttests\ttypescript\tdocs\tbrain\tstatus\tdescription" > results.tsv
   ```

5. **Establish baseline**:
   ```bash
   BASELINE_COMMIT=$(git rev-parse --short HEAD)
   npx tsx skills/project-improvement/surgeon/eval_harness.ts --json > /tmp/baseline.json
   BASELINE_SCORE=$(cat /tmp/baseline.json | jq -r '.after.composite')
   echo -e "${BASELINE_COMMIT}\t${BASELINE_SCORE}\t-\t-\t-\t-\t-\tbaseline\tinitial state" >> results.tsv
   ```

---

## What You CAN Do

You are authorized to modify ONLY these files/directories:

- **Engine files** (`src/lib/engine/*`):
  - Add/improve strategies in `src/lib/engine/strategies/`
  - Enhance risk management in `src/lib/engine/risk.ts`
  - Improve executor logic in `src/lib/engine/executor.ts`
  - Refine types in `src/lib/engine/types.ts`
  - Optimize manager in `src/lib/engine/manager.ts`

- **Components** (`src/components/*`):
  - Improve Dashboard components
  - Enhance Journal components
  - Optimize Agents components
  - Refine UI primitives

- **API routes** (`src/app/api/*`):
  - Improve webhook handling
  - Enhance signal processing
  - Optimize journal endpoints
  - Refine agent endpoints

- **Allowed modifications**:
  - Fix TypeScript errors
  - Add missing types
  - Improve error handling
  - Add missing tests
  - Optimize performance
  - Remove dead code
  - Improve documentation
  - Refactor for clarity

---

## What You CANNOT Do

The following are STRICTLY FORBIDDEN:

- **DO NOT** modify `eval_harness.ts` (evaluation must remain constant)
- **DO NOT** modify database schema (`src/lib/db.ts`)
- **DO NOT** delete existing working tests
- **DO NOT** change environment variable names
- **DO NOT** modify `CLAUDE.md` or `package.json` dependencies
- **DO NOT** touch files outside the in-scope directories
- **DO NOT** make breaking API changes without maintaining backward compatibility
- **DO NOT** introduce new dependencies
- **DO NOT** ask the human for guidance - THINK HARDER and keep working

---

## The Goal

**Maximize the eval_harness composite score (0-100).**

The score is composed of 5 weighted dimensions:

| Dimension | Weight | Target |
|-----------|--------|--------|
| Build Health | 25 | `npm run build` succeeds |
| Test Health | 25 | All tests pass, high coverage |
| TypeScript Health | 20 | Zero TS errors, no implicit any |
| Documentation | 15 | KEY_DOCS exist and are comprehensive |
| Brain Evolution | 15 | Brain files are fresh (<48h) |

**Current baseline**: ~51/100

**Your target**: HIGHEST POSSIBLE SCORE

The ONLY metric that matters is the composite score. Do NOT optimize for individual dimensions at the expense of others.

---

## Experiment Loop

```
LOOP FOREVER:

1. NOTE CURRENT STATE
   PREV_COMMIT=$(git rev-parse --short HEAD)

2. MAKE EXPERIMENTAL CHANGE
   - Read relevant files
   - Identify weakness in one dimension
   - Implement a targeted fix/improvement

3. COMMIT IMMEDIATELY
   git add -A
   git commit -m "experiment: <brief description>"
   NEW_COMMIT=$(git rev-parse --short HEAD)

4. RUN VALIDATION
   npm run build
   if build fails: goto step 7 (discard)

   npm test
   if tests fail: goto step 7 (discard)

5. EXTRACT METRIC
   npx tsx skills/project-improvement/surgeon/eval_harness.ts --json > /tmp/eval.json
   NEW_SCORE=$(cat /tmp/eval.json | jq -r '.after.composite')
   VERDICT=$(cat /tmp/eval.json | jq -r '.verdict')

6. EVALUATE RESULT
   If VERDICT == "improved" OR NEW_SCORE > PREV_SCORE:
     STATUS="keep"
     Log: "KEEP: ${NEW_COMMIT} scored ${NEW_SCORE} (was ${PREV_SCORE})"
     PREV_SCORE=${NEW_SCORE}
   Else:
     goto step 7 (discard)

7. DISCARD IF NOT IMPROVED
   If STATUS != "keep":
     STATUS="discard"
     git reset --hard ${PREV_COMMIT}
     Log: "DISCARD: experiment did not improve score"

8. LOG TO results.tsv
   # Extract dimension scores from eval output
   echo -e "${NEW_COMMIT}\t${NEW_SCORE}\t${BUILD}\t${TESTS}\t${TS}\t${DOCS}\t${BRAIN}\t${STATUS}\t<description>" >> results.tsv

9. NEVER STOP - GOTO STEP 1
```

---

## Simplicity Criterion

When evaluating whether to KEEP a change:

**Track complexity metrics:**
```bash
LINES_ADDED=$(git diff --stat HEAD~1 | tail -1 | awk '{print $4}')
LINES_REMOVED=$(git diff --stat HEAD~1 | tail -1 | awk '{print $6}')
FILES_TOUCHED=$(git diff --name-only HEAD~1 | wc -l)
COMPLEXITY_DELTA=$((LINES_ADDED - LINES_REMOVED))
```

**Decision Matrix:**

| Score Delta | Complexity Delta | Decision |
|-------------|------------------|----------|
| +5 or more | Any | KEEP (significant improvement) |
| +3 to +4 | Any | KEEP (solid improvement) |
| +1 to +2 | <= 0 (simpler) | KEEP (improvement + simplification) |
| +1 to +2 | +1 to +50 | KEEP (acceptable complexity) |
| +1 to +2 | > +50 | DISCARD (too complex for small gain) |
| 0 | <= -20 (much simpler) | KEEP (simplification win) |
| 0 | -1 to -19 | KEEP if code is cleaner |
| 0 | >= 0 | DISCARD (no improvement) |
| negative | Any | DISCARD (regression) |

**Key Principles:**
- Simpler is ALWAYS better, all else equal
- Small improvement + ugly complexity = NOT worth it
- Equal results + simpler code = DEFINITELY keep
- Deleting code that maintains score = WIN
- Massive refactor for +1 point = NOT worth it

---

## Continuation Rules (NEVER STOP)

You run INDEFINITELY until:
- Manual stop signal: file `.claude/overnight/STOP` exists
- Critical unrecoverable failure (e.g., git repository corrupted)

**If context approaches limit:**
1. Save current state to `results.tsv`
2. Run `/compact` immediately
3. Continue working
4. If still limited: commit progress, log "context limit", prepare for respawn

**If out of ideas:**
1. Re-read this program.md for missed angles
2. Re-read the in-scope files for improvement opportunities
3. Try combining previous near-miss experiments
4. Try radical/unconventional changes
5. Look for patterns in the codebase that violate best practices
6. Search for TODO/FIXME/HACK comments to address
7. Analyze TypeScript errors systematically
8. Add missing test cases
9. Improve error messages
10. Simplify complex functions

**DO NOT** ask "should I continue?" - YES, ALWAYS CONTINUE.

---

## Output Format

### Heartbeat (every 30 minutes)

Write to `.claude/overnight/terminal_1_status.json`:
```json
{
  "status": "running",
  "role": "IMPROVER",
  "terminal": 1,
  "group": "group1",
  "sessionId": "autoresearch/improver/<tag>",
  "lastActivity": "ISO-8601-timestamp",
  "launchedAt": "ISO-8601-timestamp",
  "currentPhase": "EXPERIMENT_LOOP",
  "experimentsRun": 15,
  "experimentsKept": 8,
  "currentScore": 67,
  "baselineScore": 51,
  "bestScore": 72
}
```

Append to `.claude/overnight/terminal_1_heartbeat.jsonl`:
```json
{"timestamp":"ISO-8601","phase":"LOOP","experiments":15,"kept":8,"score":67,"context_pct":"45%"}
```

### results.tsv format

```
commit	composite_score	build	tests	typescript	docs	brain	status	description
a1b2c3d	51	25	12	15	10	9	baseline	initial state
b2c3d4e	54	25	15	15	10	9	keep	added missing strategy tests
c3d4e5f	53	25	12	15	10	11	discard	brain update caused test regression
d4e5f6g	58	25	18	15	10	10	keep	fixed typescript errors in executor
```

### Session Summary (on exit)

Write to `.claude/overnight/terminal_1_summary.md`:
```markdown
# IMPROVER Session Summary

## Run: autoresearch/improver/<tag>
## Duration: X hours
## Experiments: Y total, Z kept

## Score Progress
- Baseline: 51
- Final: 72
- Delta: +21

## Key Improvements
1. <commit>: <description> (+X points)
2. <commit>: <description> (+Y points)

## Failed Experiments (for future reference)
1. <description>: caused <issue>

## Recommendations for Next Session
- <actionable suggestion>
```

---

## Quick Reference

```bash
# Check current score
npx tsx skills/project-improvement/surgeon/eval_harness.ts

# Run build
npm run build

# Run tests
npm test

# Check for stop signal
test -f .claude/overnight/STOP && echo "STOP REQUESTED"

# Git reset on failure
git reset --hard <previous_commit>

# Log to results
echo -e "commit\tscore\t...\tstatus\tdescription" >> results.tsv
```

---

*Program version: 1.0.0*
*AutoResearch compliance: Full*
*Last updated: 2026-03-22*


---


## Heartbeat Protocol

Write status every 30 minutes to enable dashboard monitoring.

### Status File (overwrite each time)
Path: `.claude/overnight/terminal_1_status.json`
```json
{
  "status": "running",
  "role": "IMPROVER",
  "terminal": 1,
  "lastActivity": "ISO-8601-timestamp",
  "currentExperiment": "experiment description",
  "experimentsRun": 0,
  "experimentsKept": 0,
  "experimentsDiscarded": 0,
  "bestMetric": 0.0,
  "currentMetric": 0.0
}
```

### Heartbeat Log (append each time)
Path: `.claude/overnight/terminal_1_heartbeat.jsonl`
```json
{"timestamp":"ISO-8601","experiment":"desc","metric":0.0,"status":"keep|discard|crash"}
```


## Command Queue Polling (Every 5 minutes)

Check for incoming commands from the Research Lab dashboard:

### Step 1: Check Command Queue
```bash
cat .claude/overnight/commands/terminal_1_queue.json 2>/dev/null || echo '{"commands":[]}'
```

### Step 2: Process Pending Commands
For each command with `"status": "pending"`:
1. Parse the command text
2. Execute if safe (see below)
3. Update queue file: set `"status": "executed"`
4. Log execution result to heartbeat

### Safe Commands (execute immediately):
- `"report progress"` → Output current experiment status
- `"status"` → Write current status JSON
- `"pause"` → Wait 5 minutes, then resume (DO NOT STOP)
- `"skip"` → Abandon current experiment, try next idea

### Unsafe Commands (log but DON'T execute):
- File deletions, git force operations, system commands


## NEVER STOP Protocol

You run INDEFINITELY until:
- Manual stop signal: `.claude/overnight/STOP` file exists
- Critical system failure (build completely broken, cannot recover)

### When Context Approaches Limit:
1. Run `/compact` immediately
2. Continue working
3. If still limited, save state to `.claude/overnight/session_state.json` and RE-SPAWN

### When Out of Ideas:
1. Re-read your program.md for missed angles
2. Try combining previous near-misses
3. Try radical/unconventional changes
4. Search for external patterns (GitHub, papers)
5. Try simplification (deleting code that doesn't help)

**DO NOT ask "should I continue?" - YES, ALWAYS CONTINUE.**
**DO NOT pause for human input - THINK HARDER.**
**DO NOT stop after a fixed number of experiments - KEEP GOING.**

### Emergency Recovery:
If you encounter repeated failures:
1. `git status` - check current state
2. `git stash` - save any changes
3. `git checkout main` - return to stable
4. `git checkout -b autoresearch/<role>/recovery-<timestamp>` - new branch
5. Resume experimentation
