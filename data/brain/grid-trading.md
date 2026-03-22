# Grid Trading

---
tags: #strategy #ranging #passive
status: Active
file: `src/lib/engine/strategies/gridTrading.ts`
category: CRYPTO
---

## Overview

**Low-Risk Compounding** — Places stacked orders at fixed intervals for ranging markets. Buys dips, sells rips automatically.

## Logic

1. Track price from last grid level
2. Price drops by `gridSize` % → **BUY**
3. Price rises by `gridSize` % → **SELL**
4. Reset grid level after each trade
5. Repeat continuously

## Why It Works

- Capitalizes on natural market oscillation
- No prediction needed — just captures range movement
- Compounds small gains over time
- Works 24/7 in crypto markets
- Very low drawdown when market stays in range

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `gridSize` | 0.5% | Price move to trigger grid level |

## Best Used On

- **Timeframes**: Any (strategy is price-based, not time-based)
- **Markets**: Crypto (24/7 trading, frequent oscillation)
- **Conditions**: Ranging/consolidating markets

## Risk Considerations

- **Trending markets are dangerous** — continuous buys in a downtrend = heavy losses
- Works best with position limits and total exposure caps
- Consider pausing during high-volatility events (FOMC, etc.)

## Example

```
Grid size: 0.5%
Starting price: $100

Price drops to $99.50 (-0.5%) → BUY
Price rises to $100.00 (+0.5%) → SELL
Price drops to $99.50 (-0.5%) → BUY
...
```

## Related

- [[Strategies Overview]]
- [[Risk Management]]
