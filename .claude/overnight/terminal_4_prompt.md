# AutoResearch Session: BRAIN_UPDATER
# Terminal: 4
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
git checkout -b autoresearch/brain_updater/overnight-2026-03-22

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


# BRAIN_UPDATER Program

> AutoResearch-style autonomous loop for brain file freshness optimization.
> Follows [Karpathy's autoresearch](https://github.com/karpathy/autoresearch) methodology.

---

## Setup

Work with the user to complete these steps before starting the experiment loop:

1. **Agree on a run tag** (e.g., `brain-mar22`)
2. **Create the branch**: `git checkout -b autoresearch/<tag>`
3. **Read all in-scope files**:
   - `data/brain/*.md` (all brain files)
   - `data/brain/doc-freshness.json` (current freshness state)
   - `CLAUDE.md` (project instructions)
   - `C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\*.md` (Obsidian source)
4. **Initialize results.tsv**:
   ```bash
   echo "timestamp\texperiment\tfile_updated\tbefore_hours\tafter_hours\tbrain_freshness_pct\tstatus" > .claude/overnight/brain_results.tsv
   ```
5. **Record baseline**:
   ```bash
   npx tsx skills/project-improvement/surgeon/eval_harness.ts --json > .claude/overnight/brain_baseline.json
   ```
6. **Confirm readiness**: Say "BRAIN_UPDATER ready" and begin the loop.

---

## What You CAN Do

You may modify these files — they are the only files you edit:

- `data/brain/*.md` — Update any brain file with fresh information
- `data/brain/daily-log.md` — Add daily entries
- `data/brain/master-tracker.md` — Update progress, checkboxes, percentages
- `data/brain/performance-memory.md` — Add performance observations
- `data/brain/learning-log.md` — Log patterns discovered
- `data/brain/decisions-log.md` — Document decisions made
- `data/brain/pattern-memory.md` — Record reusable patterns
- `data/brain/quality-memory.md` — Log quality insights
- `data/brain/backlog-memory.md` — Track backlog items
- `CLAUDE.md` — Update project instructions if codebase drifted
- `docs/*.md` — Update documentation to match current codebase

**Update types allowed:**
- Add timestamps (e.g., `Last updated: YYYY-MM-DD`)
- Update outdated information to match current codebase
- Add new sections for new features/agents
- Remove references to deleted features
- Sync Obsidian content to `data/brain/` copies
- Add cross-references between related docs
- Improve clarity and accuracy

---

## What You CANNOT Do

- **DO NOT** modify source code (`src/**`, `scripts/**`)
- **DO NOT** modify `eval_harness.ts` or any evaluation tooling
- **DO NOT** delete brain files (only update them)
- **DO NOT** modify `package.json`, `tsconfig.json`, or build configs
- **DO NOT** run `npm install` or add dependencies
- **DO NOT** modify `.github/**` or CI/CD configs
- **DO NOT** create new brain files without sufficient content
- **DO NOT** add placeholder or stub content just to inflate freshness

---

## The Goal

**Primary Metric: `brain_freshness_pct`**

```
brain_freshness_pct = (files_updated_within_48h / total_brain_files) * 100
```

Target: Maximize brain_freshness_pct while maintaining content quality.

**Secondary Metrics (from eval_harness BRAIN_EVOLUTION):**
- Key files updated: `master-tracker.md`, `daily-log.md`, `performance-memory.md`
- Content accuracy (no outdated references)
- Sync status between Obsidian and `data/brain/`

The eval harness uses a 48-hour freshness window. A file is "fresh" if modified within the last 48 hours.

**Run eval to check score:**
```bash
npx tsx skills/project-improvement/surgeon/eval_harness.ts --json | jq '.dimensions[] | select(.name == "Brain Evolution")'
```

---

## Experiment Loop

**NEVER STOP.** Once the experiment loop has begun, do NOT pause to ask the human if you should continue. Do NOT ask "should I keep going?" or "is this a good stopping point?". The human might be asleep or away from the computer and expects you to continue working indefinitely until manually stopped. You are autonomous.

### Each Experiment Cycle:

1. **Identify stalest file**: Find the brain file with the oldest modification time
   ```bash
   # Check file ages
   npx tsx scripts/doc-freshness.ts --json 2>/dev/null | jq '.files | sort_by(.daysSinceModified) | reverse | .[0:5]'
   ```

2. **Plan the update**: Determine what needs updating:
   - Compare to Obsidian source (if applicable)
   - Check if content matches current codebase
   - Look for outdated references, missing features, stale dates

3. **Make the update**: Edit the single file with meaningful improvements
   - Add/update timestamps
   - Correct outdated information
   - Add new sections for new features
   - Improve clarity

4. **Commit the change**:
   ```bash
   git add <file>
   git commit -m "brain: update <filename> - <brief description>"
   ```

5. **Measure improvement**:
   ```bash
   npx tsx skills/project-improvement/surgeon/eval_harness.ts --json > /tmp/eval_result.json
   ```

6. **Record result in results.tsv**:
   ```bash
   echo "<timestamp>\t<experiment_num>\t<filename>\t<before_hours>\t<after_hours>\t<freshness_pct>\t<kept|discarded>" >> .claude/overnight/brain_results.tsv
   ```

7. **Keep or Discard**:
   - **KEEP** if brain_freshness_pct improved or stayed same with quality improvement
   - **DISCARD** if update added no value (git reset)

8. **Loop back to step 1** — NEVER STOP

### If You Run Out of Files to Update:

If all files are fresh (updated within 48h), do NOT stop. Instead:
- Re-read stale files and add MORE content
- Cross-reference files to add links
- Check accuracy against current codebase
- Add performance observations from recent sessions
- Document patterns discovered
- Sync any Obsidian changes to `data/brain/`

If you truly run out of ideas, think harder:
- Re-read CLAUDE.md for new angles
- Check git log for recent changes not yet documented
- Review agent outputs for learnings to capture
- Look for TODO comments in code to document

**The loop runs until the human interrupts you, period.**

---

## Simplicity Criterion

Prioritize meaningful updates over cosmetic changes.

**Worth it:**
- Fixing an outdated API reference
- Adding documentation for a new feature
- Correcting inaccurate information
- Syncing Obsidian source to repo copy

**NOT worth it:**
- Changing a single date just to trigger freshness
- Adding empty sections
- Reformatting without content improvement
- Adding "Last updated" without substantive changes

A file update that adds no real value is worse than leaving the file stale — it pollutes the git history and creates false confidence in freshness.

---

## Output Format

Each experiment produces:

1. **Git commit** with format: `brain: update <filename> - <description>`

2. **results.tsv row**:
   ```
   timestamp    experiment    file_updated    before_hours    after_hours    brain_freshness_pct    status
   2026-03-22T10:30:00Z    1    daily-log.md    72    0    45.2    kept
   2026-03-22T10:35:00Z    2    master-tracker.md    48    0    47.1    kept
   ```

3. **Periodic summary** (every 10 experiments):
   ```
   === BRAIN_UPDATER Progress ===
   Experiments: 10
   Files updated: 8
   Discarded: 2
   brain_freshness_pct: 45.2% -> 62.3%
   BRAIN_EVOLUTION score: 8/15 -> 12/15
   ```

---

## Exit Conditions

Stop execution and save progress when ANY of these occur:

1. **Time limit reached**: 4 hours elapsed since session start
2. **Context limit approaching**: If you receive a context length warning
3. **Consecutive failures**: 3 failures in a row on the same operation
4. **Manual stop**: File `.claude/overnight/STOP` exists

Before exiting, always:
- Save final results to `.claude/overnight/brain_results.tsv`
- Commit any working changes with message prefix `brain:`
- Log summary to `.claude/overnight/brain_update_summary.md`

---

## Heartbeat Protocol (Every 30 minutes)

Write status to enable dashboard monitoring:

**File: `.claude/overnight/terminal_4_status.json`**
```json
{
  "status": "running",
  "role": "BRAIN_UPDATER",
  "terminal": 4,
  "group": "group1",
  "sessionId": "brain-<tag>",
  "lastActivity": "<ISO-8601>",
  "launchedAt": "<ISO-8601>",
  "currentPhase": "EXECUTE",
  "experiment": 15,
  "filesUpdated": 12,
  "brain_freshness_pct": 67.4,
  "tasksCompleted": 12,
  "tasksFailed": 3
}
```

**File: `.claude/overnight/terminal_4_heartbeat.jsonl`** (append)
```json
{"timestamp":"<ISO-8601>","experiment":15,"freshness_pct":67.4,"file":"daily-log.md","status":"kept"}
```

---

## Quick Reference Commands

```bash
# Check current freshness
npx tsx scripts/doc-freshness.ts --summary

# Run full eval
npx tsx skills/project-improvement/surgeon/eval_harness.ts --json

# Get BRAIN_EVOLUTION score only
npx tsx skills/project-improvement/surgeon/eval_harness.ts --json | jq '.dimensions[] | select(.name == "Brain Evolution")'

# Find stalest files
npx tsx scripts/doc-freshness.ts --json 2>/dev/null | jq '.files | sort_by(.daysSinceModified) | reverse | .[0:10]'

# Check for stop signal
test -f .claude/overnight/STOP && echo "STOP requested" || echo "Continue"

# Record experiment result
echo "<timestamp>\t<exp>\t<file>\t<before>\t<after>\t<pct>\t<status>" >> .claude/overnight/brain_results.tsv
```

---

*This program follows Andrej Karpathy's [autoresearch methodology](https://github.com/karpathy/autoresearch). The agent operates autonomously, making incremental improvements, committing each change, and never stopping until manually interrupted.*


---


## Heartbeat Protocol

Write status every 30 minutes to enable dashboard monitoring.

### Status File (overwrite each time)
Path: `.claude/overnight/terminal_4_status.json`
```json
{
  "status": "running",
  "role": "BRAIN_UPDATER",
  "terminal": 4,
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
Path: `.claude/overnight/terminal_4_heartbeat.jsonl`
```json
{"timestamp":"ISO-8601","experiment":"desc","metric":0.0,"status":"keep|discard|crash"}
```


## Command Queue Polling (Every 5 minutes)

Check for incoming commands from the Research Lab dashboard:

### Step 1: Check Command Queue
```bash
cat .claude/overnight/commands/terminal_4_queue.json 2>/dev/null || echo '{"commands":[]}'
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
