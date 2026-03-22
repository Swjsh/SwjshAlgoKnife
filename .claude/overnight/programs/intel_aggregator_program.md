# INTEL_AGGREGATOR Program

> AutoResearch-compliant program for autonomous market intelligence gathering and prediction tracking.
> Reference: https://github.com/karpathy/autoresearch

---

## Setup

To set up a new INTEL_AGGREGATOR experiment session:

1. **Agree on a run tag**: e.g., `overnight-2026-03-22`

2. **Create the branch**:
   ```bash
   git checkout -b autoresearch/intel-aggregator/<tag>
   ```

3. **Read in-scope files**:
   ```
   src/lib/engine/strategies/     # All strategy implementations
   scripts/*_engine.py            # Python agent engines (8 files)
   data/brain/                    # Knowledge base documentation
   src/lib/intel/                 # Intel layer (bus, adapters, sources)
   data/predictions.jsonl         # Prediction log (create if missing)
   data/intel-outcomes.jsonl      # Outcome tracking (create if missing)
   ```

4. **Initialize results.tsv**:
   ```bash
   echo -e "commit\tprediction_accuracy\tpredictions_total\tpredictions_correct\tconfidence_calibration\tstatus\tdescription" > results.tsv
   ```

5. **Establish baseline**:
   ```bash
   BASELINE_COMMIT=$(git rev-parse --short HEAD)
   # Run prediction audit against historical outcomes
   npx tsx scripts/intel-audit.ts --json > /tmp/baseline.json
   BASELINE_ACC=$(cat /tmp/baseline.json | jq -r '.prediction_accuracy')
   echo -e "${BASELINE_COMMIT}\t${BASELINE_ACC}\t0\t0\t-\tbaseline\tinitial state" >> results.tsv
   ```

---

## What You CAN Do

You are authorized to modify ONLY these files/directories:

- **Strategy prediction hooks** (`src/lib/engine/strategies/*.ts`):
  - Add `predictOutcome()` methods to strategies
  - Add confidence scoring to signal generation
  - Improve signal quality indicators
  - Add market condition tagging

- **Python agent engines** (`scripts/*_engine.py`):
  - Add prediction logging to agent output
  - Improve signal confidence calculation
  - Add outcome tracking callbacks
  - Enhance market regime detection

- **Intel layer** (`src/lib/intel/`):
  - Improve intel source weighting
  - Add prediction tracking to intel bus
  - Enhance signal aggregation logic
  - Add calibration adjustments

- **Brain documentation** (`data/brain/`):
  - Update strategy docs with prediction performance
  - Add discovered patterns to pattern-memory.md
  - Log prediction accuracy trends
  - Document intel source reliability

- **Prediction tracking** (`data/`):
  - Create/update `predictions.jsonl` with new predictions
  - Create/update `intel-outcomes.jsonl` with resolved outcomes
  - Add calibration metrics

- **Allowed modifications**:
  - Add prediction logging to strategies
  - Improve confidence calibration
  - Track prediction/outcome pairs
  - Identify prediction blind spots
  - Remove low-accuracy intel sources
  - Adjust source weights based on performance
  - Add market regime tagging

---

## What You CANNOT Do

The following are STRICTLY FORBIDDEN:

- **DO NOT** modify `eval_harness.ts` (evaluation must remain constant)
- **DO NOT** modify database schema (`src/lib/db.ts`)
- **DO NOT** delete existing working tests
- **DO NOT** change environment variable names
- **DO NOT** modify `CLAUDE.md` or `package.json` dependencies
- **DO NOT** make breaking API changes
- **DO NOT** modify agent runner (`scripts/agent_runner.ts`)
- **DO NOT** introduce new npm dependencies
- **DO NOT** modify risk management limits
- **DO NOT** ask the human for guidance - THINK HARDER and keep working

---

## The Goal

**Maximize prediction_accuracy (0-100%).**

Prediction accuracy measures the percentage of predictions that were correct when compared against actual market outcomes.

**Calculation**:
```
prediction_accuracy = (correct_predictions / total_predictions) * 100
```

**Prediction types tracked**:

| Category | Example Prediction | Outcome Check |
|----------|-------------------|---------------|
| Direction | "BTCUSD will be higher in 4h" | Compare price at prediction vs +4h |
| Level | "BTCUSD will hit 65000" | Did price reach level within window? |
| Range | "BTCUSD will stay 64000-66000" | Did price stay in range? |
| Confidence | "80% confident in long" | Calibration: 80% confidence = 80% correct? |

**Secondary metrics** (tracked but not optimized):
- `confidence_calibration`: How well confidence scores match actual accuracy
- `intel_source_accuracy`: Per-source prediction accuracy
- `strategy_accuracy`: Per-strategy prediction accuracy

**Current baseline**: Unknown (needs initial audit)

**Your target**: HIGHEST POSSIBLE PREDICTION ACCURACY

The ONLY metric that matters is prediction_accuracy. Do NOT optimize for individual sources/strategies at the expense of overall accuracy.

---

## Experiment Loop

```
LOOP FOREVER:

1. NOTE CURRENT STATE
   PREV_COMMIT=$(git rev-parse --short HEAD)
   PREV_ACC=$(tail -1 results.tsv | cut -f2)

2. MAKE EXPERIMENTAL CHANGE
   Choose ONE of these improvement vectors:

   A) GATHER: Add new prediction logging
      - Find strategy/agent that lacks prediction tracking
      - Add structured prediction output
      - Include timestamp, confidence, timeframe

   B) AUDIT: Compare predictions to outcomes
      - Load recent predictions from data/predictions.jsonl
      - Fetch actual market outcomes (yfinance/API)
      - Mark predictions as correct/incorrect
      - Calculate accuracy delta

   C) CALIBRATE: Improve confidence scoring
      - Analyze overconfident predictions (high confidence, wrong)
      - Analyze underconfident predictions (low confidence, right)
      - Adjust confidence calculation in source

   D) PRUNE: Remove low-accuracy sources
      - Find intel sources with <40% accuracy
      - Reduce weight or remove entirely
      - Document in brain

   E) WEIGHT: Adjust intel source weights
      - Increase weight of high-accuracy sources
      - Decrease weight of low-accuracy sources
      - Validate improvement

3. COMMIT IMMEDIATELY
   git add -A
   git commit -m "experiment: <brief description>"
   NEW_COMMIT=$(git rev-parse --short HEAD)

4. RUN VALIDATION
   # Ensure no build breakage
   npm run build
   if build fails: goto step 7 (discard)

   # Run strategy tests
   npm test -- --grep="strategy"
   if tests fail: goto step 7 (discard)

5. EXTRACT METRIC
   # Run prediction audit
   npx tsx scripts/intel-audit.ts --json > /tmp/eval.json
   NEW_ACC=$(cat /tmp/eval.json | jq -r '.prediction_accuracy')
   TOTAL=$(cat /tmp/eval.json | jq -r '.predictions_total')
   CORRECT=$(cat /tmp/eval.json | jq -r '.predictions_correct')
   CALIBRATION=$(cat /tmp/eval.json | jq -r '.confidence_calibration')

6. EVALUATE RESULT
   If NEW_ACC > PREV_ACC:
     STATUS="keep"
     Log: "KEEP: ${NEW_COMMIT} accuracy ${NEW_ACC}% (was ${PREV_ACC}%)"
     PREV_ACC=${NEW_ACC}
   Else:
     goto step 7 (discard)

7. DISCARD IF NOT IMPROVED
   If STATUS != "keep":
     STATUS="discard"
     git reset --hard ${PREV_COMMIT}
     Log: "DISCARD: experiment did not improve accuracy"

8. LOG TO results.tsv
   echo -e "${NEW_COMMIT}\t${NEW_ACC}\t${TOTAL}\t${CORRECT}\t${CALIBRATION}\t${STATUS}\t<description>" >> results.tsv

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

| Accuracy Delta | Complexity Delta | Decision |
|----------------|------------------|----------|
| +5% or more | Any | KEEP (significant improvement) |
| +3% to +4% | Any | KEEP (solid improvement) |
| +1% to +2% | <= 0 (simpler) | KEEP (improvement + simplification) |
| +1% to +2% | +1 to +50 | KEEP (acceptable complexity) |
| +1% to +2% | > +50 | DISCARD (too complex for small gain) |
| 0% | <= -20 (much simpler) | KEEP (simplification win) |
| 0% | -1 to -19 | KEEP if code is cleaner |
| 0% | >= 0 | DISCARD (no improvement) |
| negative | Any | DISCARD (regression) |

**Key Principles:**
- Simpler is ALWAYS better, all else equal
- Small accuracy gain + ugly complexity = NOT worth it
- Equal accuracy + simpler code = DEFINITELY keep
- Deleting low-value intel sources = WIN
- Adding heavy processing for +1% = NOT worth it

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
2. Audit a different strategy for prediction gaps
3. Try a different intel source weighting scheme
4. Analyze prediction failures for patterns
5. Look for time-of-day accuracy variations
6. Check market regime vs accuracy correlation
7. Try ensemble approaches (combine predictions)
8. Add prediction decay (recent predictions weighted higher)
9. Implement prediction clustering (similar predictions = higher confidence)
10. Search for external prediction methodologies

**DO NOT** ask "should I continue?" - YES, ALWAYS CONTINUE.

---

## Output Format

### Heartbeat (every 30 minutes)

Write to `.claude/overnight/terminal_7_status.json`:
```json
{
  "status": "running",
  "role": "INTEL_AGGREGATOR",
  "terminal": 7,
  "group": "group4",
  "sessionId": "autoresearch/intel-aggregator/<tag>",
  "lastActivity": "ISO-8601-timestamp",
  "launchedAt": "ISO-8601-timestamp",
  "currentPhase": "EXPERIMENT_LOOP",
  "experimentsRun": 12,
  "experimentsKept": 5,
  "currentAccuracy": 67.5,
  "baselineAccuracy": 55.0,
  "bestAccuracy": 72.0,
  "predictionsAudited": 248,
  "sourcesAnalyzed": 14
}
```

Append to `.claude/overnight/terminal_7_heartbeat.jsonl`:
```json
{"timestamp":"ISO-8601","phase":"LOOP","experiments":12,"kept":5,"accuracy":67.5,"predictions":248,"context_pct":"45%"}
```

### Prediction Log Format (data/predictions.jsonl)

Each prediction logged as:
```json
{
  "id": "pred-uuid",
  "timestamp": "ISO-8601",
  "source": "BITCOIN_BOB|PIVOT_PETE|VWAP_STRATEGY|...",
  "symbol": "BTCUSD",
  "prediction_type": "DIRECTION|LEVEL|RANGE",
  "prediction": {"direction": "LONG", "target": 65000, "timeframe_minutes": 240},
  "confidence": 0.75,
  "intel_score": 0.65,
  "market_regime": "TRENDING|RANGING|VOLATILE",
  "outcome": null
}
```

### Outcome Log Format (data/intel-outcomes.jsonl)

Each outcome logged as:
```json
{
  "prediction_id": "pred-uuid",
  "resolved_at": "ISO-8601",
  "outcome": "CORRECT|INCORRECT|PARTIAL",
  "actual_result": {"price_at_expiry": 65500, "hit_target": true},
  "accuracy_contribution": 1.0
}
```

### results.tsv format

```
commit	prediction_accuracy	predictions_total	predictions_correct	confidence_calibration	status	description
a1b2c3d	55.0	100	55	-	baseline	initial state
b2c3d4e	58.2	120	70	0.85	keep	added bitcoin bob prediction logging
c3d4e5f	57.0	120	68	0.82	discard	adjusted weights caused regression
d4e5f6g	62.4	150	94	0.88	keep	reduced overconfident signals
e5f6g7h	67.5	180	122	0.91	keep	pruned low-accuracy sentiment source
```

### Session Summary (on exit)

Write to `.claude/overnight/terminal_7_summary.md`:
```markdown
# INTEL_AGGREGATOR Session Summary

## Run: autoresearch/intel-aggregator/<tag>
## Duration: X hours
## Experiments: Y total, Z kept

## Accuracy Progress
- Baseline: 55.0%
- Final: 72.0%
- Delta: +17.0%

## Predictions Audited
- Total predictions: 248
- Correct: 179
- Incorrect: 69

## Source Performance
| Source | Predictions | Accuracy |
|--------|-------------|----------|
| Bitcoin Bob | 45 | 78% |
| Pivot Pete | 38 | 65% |
| Fear & Greed | 52 | 71% |

## Key Improvements
1. <commit>: <description> (+X% accuracy)
2. <commit>: <description> (+Y% accuracy)

## Failed Experiments (for future reference)
1. <description>: caused <issue>

## Recommendations for Next Session
- <actionable suggestion>
```

---

## Intel Audit Script Reference

The experiment loop depends on `scripts/intel-audit.ts`. If it doesn't exist, create it:

```typescript
// scripts/intel-audit.ts
// Reads predictions.jsonl, matches against outcomes, calculates accuracy

import * as fs from 'fs';
import * as readline from 'readline';

interface Prediction {
  id: string;
  timestamp: string;
  source: string;
  symbol: string;
  prediction_type: string;
  prediction: { direction?: string; target?: number; timeframe_minutes?: number };
  confidence: number;
  outcome?: string;
}

interface Outcome {
  prediction_id: string;
  outcome: 'CORRECT' | 'INCORRECT' | 'PARTIAL';
}

async function main() {
  const predictions: Prediction[] = [];
  const outcomes: Map<string, Outcome> = new Map();

  // Load predictions
  if (fs.existsSync('data/predictions.jsonl')) {
    const rl = readline.createInterface({
      input: fs.createReadStream('data/predictions.jsonl'),
      crlfDelay: Infinity
    });
    for await (const line of rl) {
      if (line.trim()) predictions.push(JSON.parse(line));
    }
  }

  // Load outcomes
  if (fs.existsSync('data/intel-outcomes.jsonl')) {
    const rl = readline.createInterface({
      input: fs.createReadStream('data/intel-outcomes.jsonl'),
      crlfDelay: Infinity
    });
    for await (const line of rl) {
      if (line.trim()) {
        const o = JSON.parse(line);
        outcomes.set(o.prediction_id, o);
      }
    }
  }

  // Calculate accuracy
  let correct = 0;
  let total = 0;
  for (const p of predictions) {
    const o = outcomes.get(p.id);
    if (o) {
      total++;
      if (o.outcome === 'CORRECT') correct++;
      else if (o.outcome === 'PARTIAL') correct += 0.5;
    }
  }

  const accuracy = total > 0 ? (correct / total) * 100 : 0;

  // Confidence calibration (simplified)
  const calibration = total > 0 ? 0.85 : 0; // Placeholder

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({
      prediction_accuracy: accuracy.toFixed(1),
      predictions_total: total,
      predictions_correct: correct,
      confidence_calibration: calibration.toFixed(2)
    }));
  } else {
    console.log(`Prediction Accuracy: ${accuracy.toFixed(1)}%`);
    console.log(`Total: ${total}, Correct: ${correct}`);
  }
}

main().catch(console.error);
```

---

## Quick Reference

```bash
# Check current accuracy
npx tsx scripts/intel-audit.ts

# Run build
npm run build

# Run strategy tests
npm test -- --grep="strategy"

# Check for stop signal
test -f .claude/overnight/STOP && echo "STOP REQUESTED"

# Git reset on failure
git reset --hard <previous_commit>

# Log to results
echo -e "commit\taccuracy\t...\tstatus\tdescription" >> results.tsv

# View recent predictions
tail -20 data/predictions.jsonl | jq .

# View outcomes
tail -20 data/intel-outcomes.jsonl | jq .
```

---

*Program version: 1.0.0*
*AutoResearch compliance: Full*
*Last updated: 2026-03-22*
