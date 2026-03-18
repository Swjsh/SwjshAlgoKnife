# Boba — Agent Memory

> Boba reads this before the 9:30 AM window. Professor writes feedback here.
> Evolution Engine adjusts parameters based on accumulated evidence.

---

## Current Parameters

```yaml
instruments: ["SPY"]
zone_timeframe: "15m"         # 15-minute S&D zones
entry_trigger: "reversal_candle" # Must see reversal inside zone
session_start: "09:30"
session_end: "11:00"
max_trades_per_day: 1         # ONE trade only
hard_stop_pct: 15             # 15% premium stop
scale_out:
  - pct: 25, target: "+15%"
  - pct: 50, target: "+20-25%"
  - pct: 25, target: "runner"
fomc_blackout: true           # No trades on FOMC days
gap_wait_minutes: 15          # Wait 15 min if SPY gaps > 1%
vix_reduce_threshold: 30      # 50% size above VIX 30
min_rr: 1.5
cooldown_after_loss_minutes: 0 # No same-day retry (max 1 trade)
```

---

## Professor Feedback Queue

<!-- Professor appends entries here -->

---

## Behavioral Patterns

<!-- Evolution Engine writes learned patterns here -->

---

## Performance Snapshot

- Lifetime trades: 0 | Wins: 0 | Losses: 0 | Win Rate: 0%
- Total P&L: $0.00
- Current streak: 0
- Avg Professor grade: _no data_
- Avg hold time: _no data_
- Early stop-outs (< 5 min): 0
- Scale-out hit rates: _no data_

---

## Mutation History

<!-- Parameter change log -->
