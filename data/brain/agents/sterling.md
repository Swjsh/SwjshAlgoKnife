# Sterling — Agent Memory

> This file IS Sterling's memory. Sterling reads it before every session.
> Professor writes feedback here after grading Sterling's trades.
> Evolution Engine adjusts parameters here based on accumulated evidence.

---

## Current Parameters (Evolution Engine adjusts these)

```yaml
# These values override defaults. Evolution Engine mutates them with evidence.
# Each change is logged in Mutation History below.
zone_width_pips: 15          # How wide the S&D entry zone is
min_rr: 3.0                  # Minimum reward:risk ratio
session_window_start: "03:00" # London open (ET)
session_window_end: "12:00"   # Noon ET cutoff
max_trades_per_day: 3
pairs: ["GBPUSD", "EURUSD", "GBPJPY", "EURJPY"]
news_blackout_minutes: 15    # Minutes before/after high-impact news
entry_type: "limit_only"     # Never market orders
stop_method: "zone_edge"     # SL at edge of zone
```

---

## Professor Feedback Queue

> Professor writes here after grading each Sterling trade.
> Sterling reads this at session start to adjust behavior.
> Format: [date] Trade #ID | Grade: X | Feedback: ... | Lesson: ...

<!-- Professor appends entries here -->

---

## Behavioral Patterns (What Sterling has learned about itself)

> Written by Evolution Engine based on Professor grades + trade outcomes.
> Sterling reads these as "rules I've learned from experience."

<!-- Example:
### London-only sessions outperform overlap
- Evidence: 12 London trades = 67% WR, 8 overlap trades = 25% WR
- Applied: Reduced overlap position size to 50%
- Status: ACTIVE
-->

---

## Performance Snapshot (updated EOD by Chief)

- Lifetime trades: 0 | Wins: 0 | Losses: 0 | Win Rate: 0%
- Total P&L: $0.00
- Current streak: 0 (neutral)
- Avg Professor grade: _no data_
- Most common feedback: _no data_
- London WR: _no data_ | Overlap WR: _no data_
- Best pair: _no data_ | Worst pair: _no data_

---

## Mutation History

> Every parameter change is logged here with evidence and rollback plan.

<!-- Format:
### [DATE] zone_width_pips: 15 → 20
- Trigger: 4 of 6 losses were stop-outs within 5 pips of zone edge
- Evidence: Trades #12, #14, #18, #22
- Professor feedback: "Entry was valid but stop too tight for current volatility"
- Rollback: Revert to 15 if next 10 trades show no improvement
-->
