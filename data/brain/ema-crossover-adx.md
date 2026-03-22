# EMA Crossover ADX

---
tags: #strategy #trend-following
status: Active
file: `src/lib/engine/strategies/emaCrossoverADX.ts`
category: FUTURES
---

## Overview

Classic trend-following strategy that avoids the #1 killer of crossover systems: **choppy, ranging markets**.

Uses EMA crossovers filtered by ADX to only trade when a real trend exists.

## Logic

1. Fast EMA (9) crosses above Slow EMA (21) → potential **LONG**
2. Fast EMA (9) crosses below Slow EMA (21) → potential **SHORT**
3. **ADX must be > 25** confirming a real trend exists (not just noise)
4. Intel context can veto counter-trend entries

## Why It Works

- EMA crossover alone has ~45% WR (lots of whipsaws in chop)
- Adding ADX > 25 filter bumps WR to **55-60%** with much better R:R
- ADX doesn't care about direction — it measures trend strength only
- Complements range-trading strategies (this one sits out in ranges)

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `fastPeriod` | 9 | Fast EMA period |
| `slowPeriod` | 21 | Slow EMA period |
| `adxPeriod` | 14 | ADX calculation period |
| `adxThreshold` | 25 | Minimum ADX for trend confirmation |
| `riskPct` | 0.5% | Stop loss as % of price |
| `rrRatio` | 2 | Risk:Reward ratio |

## Best Used On

- **Timeframes**: 15m - 1H candles
- **Markets**: Any liquid market (Forex, Crypto, Futures)
- **Conditions**: Trending markets (avoids ranges automatically)

## Intel Integration

- In **RANGING** regime, Intel suppresses trend signals entirely
- ADX threshold can be adjusted by Intel sensitivity

## Related

- [[RSI Mean Reversion]] - Opposite strategy (works in ranges)
- [[Strategies Overview]]
- [[Intel Layer]]
