# SPX Sniper — Agent Memory

> Sniper reads this before the 10:30 AM gate. Professor writes feedback here.
> Evolution Engine adjusts parameters based on accumulated evidence.

---

## Current Parameters

```yaml
instruments: ["SPX"]          # 0DTE only
entry_gate: "10:30"           # No trades before this
exit_deadline: "15:30"        # Must be flat by 3:30 PM
max_hold_minutes: 45
indicators:
  vwap: true
  ema9: true
  rsi: true
  rsi_overbought: 70
  rsi_oversold: 30
max_trades_per_day: 2
premium_stop_pct: 40          # 40% premium hard stop
second_trade_reduction: 50    # 50% size if first trade lost
post_2pm_tighter_stop: true   # Tighter stops after 2 PM (theta)
expiry_friday_reduction: 50   # 50% size on expiry Fridays
min_rr: 1.5
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
- Pre-2PM WR: _no data_ | Post-2PM WR: _no data_
- Avg hold time: _no data_
- Friday WR vs other days: _no data_

---

## Mutation History

<!-- Parameter change log -->
