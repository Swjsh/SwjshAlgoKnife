# AutoResearch Session: BACKTESTER
# Terminal: 2
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
git checkout -b autoresearch/backtester/overnight-2026-03-22

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


# BACKTESTER Program

> Autonomous strategy optimization using Karpathy's autoresearch methodology.
> This file programs the agent. The agent modifies strategy code.

---

## Setup

Before beginning the experiment loop:

1. **Create branch and tag**
   ```bash
   TAG="bt$(date +%m%d)"
   git checkout -b autoresearch/$TAG
   ```

2. **Read core files** — understand the codebase before modifying:
   - `scripts/universal_backtest.py` — backtesting engine (DO NOT MODIFY)
   - `scripts/backtest_config.py` — agent configurations (DO NOT MODIFY)
   - `src/lib/engine/strategies/*.ts` — TypeScript strategies (CAN MODIFY)
   - `scripts/*_engine.py` — Python agent engines (CAN MODIFY)

3. **Initialize results.tsv**
   ```bash
   echo -e "commit\tsharpe\twin_rate\tpf\tmax_dd\tstatus\tdescription" > .claude/overnight/results.tsv
   ```

4. **Run baseline** — establish starting metrics:
   ```bash
   python scripts/run_backtest_agent.py compare --from 2025-06-01 --to 2026-03-15 > baseline.log 2>&1
   ```

5. **Extract baseline Sharpe** from each strategy's output and record:
   ```
   <commit>  <avg_sharpe>  <avg_win_rate>  <avg_pf>  <max_dd>  baseline  "Initial strategies unchanged"
   ```

---

## What You CAN Do

Modify these files — everything inside is fair game:

### Strategy Parameters (Primary Focus)
- `scripts/backtest_config.py` → `AGENT_CONFIGS` dict:
  - `tolerance_pct`, `min_confluence`, `risk_pct`, `rr`
  - `threshold_pct`, `squeeze_threshold`, `period`
  - `lookback`, `zone_tolerance_pct`, `min_touches`
  - `session_start_hour`, `session_start_min`, `orb_duration`

### Python Strategy Logic
- `scripts/universal_backtest.py` lines 179-560 (strategy classes):
  - `PivotStrategy.on_candle()` — pivot detection logic
  - `ORBStrategy.on_candle()` — opening range breakout logic
  - `BBSqueezeStrategy.on_candle()` — squeeze/breakout detection
  - `VWAPStrategy.on_candle()` — mean reversion logic
  - `SuppResStrategy.on_candle()` — support/resistance logic

### TypeScript Strategies
- `src/lib/engine/strategies/vwapReversion.ts`
- `src/lib/engine/strategies/bbBreakout.ts`
- `src/lib/engine/strategies/orb.ts`
- `src/lib/engine/strategies/pivot.ts`
- `src/lib/engine/strategies/suppRes.ts`
- `src/lib/engine/strategies/threeDucks.ts`

### Allowed Modifications
- Adjust indicator periods (SMA, BB, etc.)
- Tune entry/exit thresholds
- Modify risk:reward ratios
- Add/remove confluence filters
- Adjust position sizing logic
- Change timeframe aggregation windows
- Add new technical indicators
- Implement trailing stops
- Add time-of-day filters

---

## What You CANNOT Do

**DO NOT modify these files:**

- `scripts/universal_backtest.py` lines 1-160 (data loading, CLI)
- `scripts/universal_backtest.py` lines 566-953 (PaperTrader, runner, output)
- `scripts/backtest_report.py` — report generation
- `scripts/run_backtest_agent.py` — agent runner wrapper
- `src/lib/engine/types.ts` — type definitions
- `src/lib/engine/manager.ts` — strategy registry
- Any files in `src/app/` — dashboard UI
- Any files in `data/` — output data

**DO NOT:**
- Install new packages
- Modify the evaluation harness
- Change the output format of backtest results
- Alter how Sharpe ratio is calculated
- Modify the PaperTrader simulation logic
- Touch git configuration or CI/CD

---

## The Goal

**Maximize Average Sharpe Ratio across all strategies.**

The single metric to optimize:

```
AVG_SHARPE = mean(sharpe_ratio for each strategy in [pivot, orb, bb_squeeze, vwap, supp_res])
```

Each experiment runs for ~5 minutes across 5 strategies on 6 months of data.

Secondary constraints (must stay within bounds):
- Max Drawdown < 25% (hard fail if exceeded)
- Win Rate between 25% and 85% (reject outliers)
- Trade Count > 10 per strategy (validation requirement)
- Profit Factor > 0.8 (avoid strategies that lose systematically)

---

## Simplicity Criterion

**Complexity must justify improvement.**

| Sharpe Improvement | Acceptable Complexity |
|--------------------|-----------------------|
| < 0.05             | REJECT unless code deletion |
| 0.05 - 0.10        | Single parameter change only |
| 0.10 - 0.20        | Up to 10 new lines of code |
| 0.20 - 0.50        | Up to 25 new lines of code |
| > 0.50             | Any reasonable change |

**Prefer:**
- Removing code that achieves same result
- Simplifying complex conditions
- Reducing parameter count
- Eliminating redundant indicators

**If two changes yield equal Sharpe:** keep the simpler one.

---

## Output Format

After each backtest run, extract these metrics from the JSON output:

```
sharpe_ratio     → Primary optimization target
win_rate         → Percentage of winning trades
profit_factor    → Gross profit / Gross loss
max_drawdown_pct → Largest peak-to-trough decline
total_trades     → Number of trades (validation)
return_pct       → Total return percentage
```

Parse from: `data/backtests/<symbol>_<strategy>_<timestamp>.json`

---

## Results.tsv Format

Tab-separated columns:

```
commit    sharpe   win_rate  pf     max_dd  status    description
-------   ------   --------  -----  ------  --------  -----------
a1b2c3d   1.42     52.3      1.85   12.4    keep      "Increased vwap threshold to 0.5%"
e4f5g6h   1.38     48.1      1.62   18.2    discard   "Added RSI filter - no improvement"
i7j8k9l   0.00     0.0       0.00   0.0     crash     "Division by zero in pivot calc"
```

Status values:
- `baseline` — Initial run before any changes
- `keep` — Sharpe improved, changes retained
- `discard` — Sharpe same or worse, git reset
- `crash` — Backtest failed, git reset

---

## The Experiment Loop

**NEVER STOP.** Once the loop begins, continue indefinitely until:
- Context window approaches limit
- `.claude/overnight/STOP` file exists
- 50+ experiments completed
- System resource exhaustion

### Loop Structure

```
WHILE true:

    1. HYPOTHESIZE
       - Identify a parameter or logic change likely to improve Sharpe
       - Consider: which strategy has lowest current Sharpe?
       - Consider: what parameter is most sensitive?
       - Consider: is there unnecessary complexity to remove?

    2. MODIFY
       - Make a single, focused change
       - Keep changes small and reversible
       - Document the hypothesis in commit message

    3. COMMIT
       git add -A
       git commit -m "exp: <brief description of change>"
       # MUST commit BEFORE running experiment
       # This enables clean git reset on failure

    4. RUN
       python scripts/run_backtest_agent.py compare \
           --from 2025-06-01 --to 2026-03-15 > exp.log 2>&1

    5. EVALUATE
       - Parse exp.log for each strategy's Sharpe
       - Calculate AVG_SHARPE
       - Check hard constraints (drawdown, win rate bounds)

    6. RECORD
       echo -e "<commit>\t<sharpe>\t<win_rate>\t<pf>\t<max_dd>\t<status>\t<desc>" \
           >> .claude/overnight/results.tsv

    7. DECIDE
       IF avg_sharpe > previous_best AND constraints_met:
           STATUS = "keep"
           previous_best = avg_sharpe
           # Advance: keep the commit
       ELSE:
           STATUS = "discard"
           git reset --hard HEAD~1
           # Revert: undo the commit

    8. CONTINUE
       # Do NOT pause
       # Do NOT ask human
       # Do NOT wait for confirmation
       # LOOP FOREVER
```

---

## Experiment Ideas (Seed List)

Start with these hypotheses, then generate your own:

### Quick Wins (parameter tuning)
1. Increase vwap `threshold_pct` from 0.4 to 0.6 for forex
2. Reduce bb_squeeze `squeeze_threshold` from 0.04 to 0.03
3. Increase pivot `min_confluence` from 1 to 2
4. Adjust orb `rr` from 2.0 to 2.5
5. Reduce supp_res `lookback` from 50 to 30

### Medium Changes (logic adjustments)
6. Add ATR-based dynamic thresholds to VWAP
7. Implement time-of-day filter for ORB (skip first 5 min)
8. Add volume confirmation to BB squeeze breakout
9. Combine pivot levels with VWAP confluence
10. Add momentum filter (RSI > 50 for longs)

### Complexity Reduction (simplification)
11. Remove min_confluence requirement if trades are rare
12. Simplify pivot calculation to daily only (remove weekly/monthly)
13. Remove zone_type distinction in SuppRes
14. Use fixed risk instead of ATR-based for simpler position sizing

---

## Heartbeat Protocol

Every 30 minutes (or every 5 experiments), update status:

```json
// .claude/overnight/terminal_2_status.json
{
  "status": "running",
  "role": "BACKTESTER",
  "terminal": 2,
  "sessionId": "autoresearch-<date>",
  "lastActivity": "<ISO-8601>",
  "currentPhase": "EXECUTE",
  "experimentsCompleted": 15,
  "bestSharpe": 1.67,
  "currentSharpe": 1.52
}
```

---

## Exit Conditions

Stop and save progress when ANY occur:

1. **STOP file exists**: `test -f .claude/overnight/STOP`
2. **Context limit**: Approaching context window limit
3. **50 experiments**: Sufficient exploration completed
4. **3 consecutive crashes**: Something fundamentally broken
5. **Time limit**: 4 hours elapsed

### Before Exiting

1. Commit final state: `git add -A && git commit -m "autoresearch: final state"`
2. Save results summary to `terminal_2_summary.md`
3. Push branch: `git push -u origin autoresearch/$TAG`
4. Report best Sharpe achieved and key discoveries

---

## Remember

- **Commit BEFORE running each experiment** — enables clean revert
- **One change per experiment** — isolate variables
- **Sharpe is king** — everything else is secondary
- **Simplicity wins ties** — prefer elegant solutions
- **NEVER STOP** — do not pause to ask the human
- **LOOP FOREVER** — until exit conditions met

The goal is not to find the perfect strategy. The goal is to systematically explore the parameter space and discover what improves Sharpe ratio. Each experiment teaches something, whether it succeeds or fails.

**BEGIN THE LOOP.**


---


## Heartbeat Protocol

Write status every 30 minutes to enable dashboard monitoring.

### Status File (overwrite each time)
Path: `.claude/overnight/terminal_2_status.json`
```json
{
  "status": "running",
  "role": "BACKTESTER",
  "terminal": 2,
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
Path: `.claude/overnight/terminal_2_heartbeat.jsonl`
```json
{"timestamp":"ISO-8601","experiment":"desc","metric":0.0,"status":"keep|discard|crash"}
```


## Command Queue Polling (Every 5 minutes)

Check for incoming commands from the Research Lab dashboard:

### Step 1: Check Command Queue
```bash
cat .claude/overnight/commands/terminal_2_queue.json 2>/dev/null || echo '{"commands":[]}'
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
