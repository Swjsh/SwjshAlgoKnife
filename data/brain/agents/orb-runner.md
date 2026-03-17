# ORB Runner — Agent Memory File

> This file is ORB Runner's persistent memory.
> Chief reads it when checking ORB Runner status.
> Professor writes feedback here after grading ORB trades.
> Evolution Engine may adjust parameters based on performance data.
> Created: 2026-03-15 (System Builder Run #2 — gap fill)

---

## Agent Identity

- **Name:** ORB Runner
- **ID in agents_db.json:** `orb`
- **Model:** Haiku (structured, pattern-based)
- **Strategy:** NeverStoppedout 15-min Opening Range Breakout
- **Market:** MNQ (Micro Nasdaq-100 Futures)
- **Runner:** scripts/run_orb_agent.ts

---

## Current Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| ORB timeframe | 15-min (9:30–9:45 AM ET) | Fixed |
| Wide range threshold | 400 pts | Triggers Inverse ORB |
| R:R target | 1:1 | TP = range size |
| Max trades per day | 2 | Conservative default |
| Lockout after trade | 15 min | Hard rule |
| Walk-away window | 3–10 min post-entry | SL/TP set immediately |
| Kill switch | 2 consecutive losses | Done for day |

---

## Active Setups

1. **Standard ORB** — Breakout or retest of 15-min ORB high/low
2. **Inverse ORB** — When range > 400 pts, fade the ORB as a range using HTF bias
3. **ES/NQ Divergence** — Intermarket pair trade when one index returns inside ORB

---

## Performance History

**Trades:** 0
**Wins:** 0
**Losses:** 0
**Win Rate:** 0% (no data)
**Total P&L:** $0.00
**Note:** Agent was ACTIVE in agents_db.json but no trades recorded in journal.db as of 2026-03-15. May be running in scan/analysis mode only, not submitting orders yet (broker shows unlinked — needs futures broker: Tradovate, NinjaTrader, or AMP Futures).

---

## Broker Status

- **Platform:** Unlinked (as of 2026-03-15)
- **Needs:** Futures broker with MNQ access (Tradovate, NinjaTrader, or AMP Futures)
- **Current mode:** Analysis/signal detection only — no live or paper order execution
- **Workaround:** Strategy detection running via yfinance delayed data

---

## Professor Feedback Queue

<!-- Professor writes here after grading ORB trades -->
<!-- Format: [DATE] Grade: X | Trade: [ID] | Lesson: [what to improve] -->
No trades graded yet.

---

## Behavioral Patterns

<!-- Observed over time — filled in as data accumulates -->
No patterns yet — awaiting first trades.

---

## Mutation History

<!-- Evolution Engine logs parameter changes here -->

### [2026-03-15] Initial parameters set
- Source: NeverStoppedout-ORB.md strategy spec (theories/)
- No performance data — defaults from strategy documentation
- Next review: 2026-03-22 (Evolution Engine Run #2) — no mutations expected until 10+ trades
