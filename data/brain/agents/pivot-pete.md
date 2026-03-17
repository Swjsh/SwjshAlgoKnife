# Pivot Pete — Agent Memory

> Pete reads this before RTH. Professor writes feedback here.
> Evolution Engine adjusts parameters based on accumulated evidence.

---

## Current Parameters

```yaml
instruments: ["ES"]           # E-mini S&P only for now
pivot_type: "classic"         # PP=(H+L+C)/3
vwap_confluence_required: true
min_rr: 2.0
session_start: "09:30"        # RTH only
session_end: "16:00"
vix_pause_threshold: 25       # Widen stops above VIX 25
vix_standdown_threshold: 35   # No trades above VIX 35
fomc_blackout_minutes: 30     # Before and after FOMC
pivot_bounce_confirmation: "volume" # Require volume confirmation
max_trades_per_day: 3
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
- Pivot bounce WR: _no data_ | VWAP confluence WR: _no data_
- Best time of day: _no data_

---

## Mutation History

<!-- Parameter change log -->
