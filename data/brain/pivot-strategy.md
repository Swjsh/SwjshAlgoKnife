# Pivot Strategy

---
tags: #strategy #pivots #multi-timeframe
status: Active
file: `src/lib/engine/strategies/pivot.ts`
category: FUTURES
---

## Overview

**Multi-Timeframe Pivot Rejection** — TypeScript implementation of the Pivot Pete strategy. Trades rejections at daily, weekly, and monthly pivot levels.

> **Note**: This is the TypeScript strategy engine. For the Python agent that uses this strategy, see [[Pivot Pete]].

## Logic

1. Compute pivot levels from prior period OHLC (daily/weekly/monthly)
2. On each candle, check if price is near any pivot level
3. Look for **rejection** — wick touches pivot, closes back away
4. Enter with confluence (multiple pivot levels aligned)

## Pivot Calculation (Floor Pivots)

```
P  = (High + Low + Close) / 3
R1 = 2 * P - Low
S1 = 2 * P - High
R2 = P + (High - Low)
S2 = P - (High - Low)
R3 = High + 2 * (P - Low)
S3 = Low - 2 * (High - P)
```

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `tolerancePct` | 0.08% | Distance from pivot to trigger |
| `minConfluence` | 1 | Minimum overlapping pivots |
| `riskPct` | 0.3% | Stop loss % |
| `rr` | 2 | Risk:Reward ratio |
| `symbol` | ES | Trading symbol |

## Pivot Timeframes

- **Daily pivots** — Computed from previous day's OHLC
- **Weekly pivots** — Computed from previous week's OHLC
- **Monthly pivots** — Computed from previous month's OHLC

Higher timeframe pivots are stronger levels.

## Signal Generation

**Bullish Signal**:
- Candle low wicks to/below pivot level
- Candle closes above open (green)
- Confluence count ≥ `minConfluence`

**Bearish Signal**:
- Candle high wicks to/above pivot level
- Candle closes below open (red)
- Confluence count ≥ `minConfluence`

## Best Used On

- **Timeframes**: 5m candles (intraday)
- **Markets**: ES, NQ, YM futures (or ETF proxies like SPY)
- **Sessions**: Regular trading hours

## Related

- [[Pivot Pete]] - Python agent using this strategy
- [[Support Resistance]] - Similar level-based approach
- [[Strategies Overview]]
