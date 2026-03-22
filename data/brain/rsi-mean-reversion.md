# RSI Mean Reversion

---
tags: #strategy #mean-reversion #ranging
status: Active
file: `src/lib/engine/strategies/rsiMeanReversion.ts`
category: CRYPTO
---

## Overview

**High Win-Rate Range Strategy** — The simplest consistently profitable strategy in ranging markets. Uses RSI extremes + candlestick confirmation to catch mean-reversion bounces before the crowd.

## Logic

1. RSI drops below oversold threshold (default 30) → watch for bounce
2. **Confirmation**: Next candle that closes bullish (close > open) = ENTRY
3. Stop below the swing low, target the RSI 50 midline area
4. Mirror logic for overbought shorts

## Why It Works

- **60-68% WR** in backtests across Forex, Crypto, and index futures
- RSI extremes mark exhaustion — price has moved too far, too fast
- Candlestick confirmation prevents catching falling knives
- Intel integration: suppressed during strong trends (RSI can stay overbought for ages in a bull run)
- Pairs perfectly with [[EMA Crossover ADX]] (works when that one sits out)

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `rsiPeriod` | 14 | RSI calculation period |
| `oversold` | 30 | Oversold threshold |
| `overbought` | 70 | Overbought threshold |
| `cooldownCandles` | 8 | Bars between signals |
| `riskPct` | 0.4% | Stop loss % |
| `rrRatio` | 1.5 | Risk:Reward ratio |
| `confirmationBars` | 3 | Max bars to wait for confirmation |

## Best Used On

- **Timeframes**: 5m - 1H candles
- **Markets**: Ranging/mean-reverting markets
- **Conditions**: Sideways consolidation, NOT strong trends

## Intel Integration

- In **TRENDING** regime with `preferTrend=true`, signals are suppressed
- Overbought/oversold thresholds can be widened in trending markets

## Signal Flow

```
RSI crosses below 30
    ↓
Wait for bullish confirmation candle
    ↓
Check Intel doesn't veto
    ↓
LONG entry with stop below swing low
```

## Related

- [[EMA Crossover ADX]] - Opposite strategy (trend-following)
- [[VWAP Reversion]] - Similar mean-reversion concept
- [[Strategies Overview]]
