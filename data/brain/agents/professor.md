# The Professor — Agent Memory

> The Professor is the grading engine. But the Professor also learns.
> This file tracks the Professor's own accuracy — are its grades predictive?
> If A-graded setups keep losing, the rubric needs adjustment.

---

## Current Grading Rubric

```yaml
# The Professor can adjust weights but NOT the grade scale
grade_scale:
  A:  "≥2R win with clean execution"
  A-: "≥1.5R win, minor execution issue"
  B+: "1-2R win, solid setup"
  B:  "1-1.5R win, acceptable execution"
  B-: "Structure loss with valid R:R (good trade, bad outcome)"
  C+: "<1R win (left money on table)"
  C:  "Standard loss, rules followed"
  C-: "Loss with execution errors"
  D:  "Rule violation that didn't cause loss (lucky)"
  F:  "<5 min stop-out, or rule violation that caused loss"

# Weight factors for grading (Evolution Engine can adjust these)
weights:
  rr_execution: 0.30          # Did the R:R match the plan?
  entry_quality: 0.25         # Was the entry at the right zone/level?
  exit_discipline: 0.20       # Set-and-forget or manual intervention?
  rule_compliance: 0.15       # Did the agent follow its rules?
  timing: 0.10                # Was the timing appropriate for the session?
```

---

## Rubric Calibration (Self-Learning)

> Track whether grades predict future performance.
> If they don't correlate, the rubric needs adjustment.

### Grade → Next Trade Outcome Correlation

| Grade | Followed by Win | Followed by Loss | Predictive? |
|-------|----------------|-----------------|-------------|
| A/A-  | _no data_ | _no data_ | _unknown_ |
| B+/B  | _no data_ | _no data_ | _unknown_ |
| B-/C+ | _no data_ | _no data_ | _unknown_ |
| C/C-  | _no data_ | _no data_ | _unknown_ |
| D/F   | _no data_ | _no data_ | _unknown_ |

**Calibration rule:** If A/B grades are followed by losses >40% of the time over 20+ trades, the rubric is rewarding the wrong things. Adjust weights.

**Calibration rule:** If D/F grades are followed by wins >40% of the time over 20+ trades, the rubric is penalizing the wrong things. Adjust weights.

---

## Common Feedback Patterns (What the Professor keeps saying)

> Evolution Engine reads this to detect systemic issues.
> If the same feedback appears 5+ times → it's a SYSTEM issue, not a trade issue.

| Feedback Theme | Count | Agents | Action Taken |
|---------------|-------|--------|-------------|
| _none yet_ | | | |

<!-- Examples:
| "Stop too tight for volatility" | 7 | Sterling, Pete | Widened zone_width by 5 pips |
| "Entry was valid but timing off" | 4 | Boba, Sniper | Under review |
| "Left money on table - exited too early" | 3 | Sterling | Reviewing scale-out rules |
-->

---

## Performance Snapshot

- Trades graded: 0
- Average grade: _no data_
- Grade distribution: _no data_
- Auditor agreement rate: _no data_ (how often Auditor says VERIFIED)
- Rubric mutations: 0

---

## Mutation History

<!-- Weight adjustment log -->
