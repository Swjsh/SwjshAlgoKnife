# Liquidity Scalper

---
tags: #strategy #scalping #institutional
status: Active
file: `src/lib/engine/strategies/liquidityScalper.ts`
category: FUTURES
---

## Overview

**Institutional Level Ping-Pong** — Scalps between liquidity pools where banks place large orders. Catches stop hunts and trades the reversal.

## Concept

Banks and institutions place large orders at key levels creating "liquidity pools." Price repeatedly sweeps these pools (stop hunts) then reverses hard.

## Logic

1. Builds dynamic support/resistance zones from swing highs/lows
2. Identifies **liquidity pools** (clusters of equal highs/lows where retail stops pile up)
3. Waits for a **liquidity sweep** (price briefly pierces the zone)
4. Enters on the **rejection candle** back inside the range
5. Targets the **opposite liquidity pool** (ping-pong)

## Why It Works

- **60-70%+ win rate** on ES/MNQ intraday when combined with session timing
- Institutional order flow creates predictable sweep → reversal patterns
- Tight stops (just beyond the sweep wick) give excellent R:R
- Works beautifully during London/NY overlap and first 2hrs of NY session

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `lookback` | 60 | Bars to analyze for swings |
| `swingStrength` | 3 | Bars on each side for swing detection |
| `zoneTolerance` | 0.04% | Zone clustering tolerance |
| `minPoolTouches` | 2 | Minimum touches to form pool |
| `cooldownCandles` | 5 | Bars between signals |
| `riskPct` | 0.3% | Stop loss % |
| `rrRatio` | 2 | Risk:Reward ratio |

## Best Used On

- **Timeframes**: 1-5 minute candles
- **Markets**: ES, MNQ, NQ futures
- **Sessions**: London/NY overlap, first 2hrs of NY session

## Signal Examples

**Bullish Setup**:
- Candle wicks below support pool (sweep)
- Closes back above the zone (rejection)
- Bullish candle body (green)
- Target: Nearest resistance pool

**Bearish Setup**:
- Candle wicks above resistance pool (sweep)
- Closes back below the zone (rejection)
- Bearish candle body (red)
- Target: Nearest support pool

## Related

- [[Support Resistance]] - Similar zone-based approach
- [[Strategies Overview]]
