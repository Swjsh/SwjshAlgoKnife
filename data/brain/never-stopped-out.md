# Never Stopped Out Strategy

---
tags: #strategy #futures #advanced
status: ✅ Active
markets: Futures
---

## Overview

**Never Stopped Out** is an advanced ORB variant that uses wider ranges, higher timeframe bias, and time-based exits instead of fixed stops.

**Core Concept**: Avoid premature stop-outs by using time exits instead of price stops.

**File**: `src/lib/engine/strategies/neverStoppedOut.ts`

---

## Why "Never Stopped Out"?

Traditional stops get hunted:
1. Market makers know where stops cluster
2. Volatility spikes hit stops then reverse
3. Tight stops increase loss frequency

**Solution**: Use time-based exits and wider invalidation levels.

---

## How It Works

### 1. Extended Opening Range (60 min)

Unlike standard ORB (15 min), use 60-minute range:

```typescript
const openingRange = {
  high: Math.max(...first60MinBars.map(b => b.high)),
  low: Math.min(...first60MinBars.map(b => b.low)),
  midpoint: (rangeHigh + rangeLow) / 2
};
```

### 2. Higher Timeframe Bias

Only trade in direction of 4H trend:

```typescript
const h4Trend = determineTrend(h4Bars);

// Long only if 4H bullish
// Short only if 4H bearish
if (signal.action === 'buy' && h4Trend !== 'bullish') {
  return null;  // Skip
}
```

### 3. Wide Range Detection

Skip days with unusually wide ranges:

```typescript
const rangeSize = openingRange.high - openingRange.low;
const avgRange = calculateATR(dailyBars, 14);

if (rangeSize > avgRange * 1.5) {
  return null;  // Range too wide, skip day
}
```

### 4. Time-Based Exit (No Fixed Stop)

```typescript
// Exit after 4 hours regardless of P&L
const entryTime = new Date(trade.entry_time);
const now = new Date();
const hoursHeld = (now - entryTime) / (1000 * 60 * 60);

if (hoursHeld >= 4) {
  closePosition();
}
```

---

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `rangeMinutes` | 60 | Opening range duration |
| `htfTimeframe` | '4H' | Higher timeframe for bias |
| `maxHoldHours` | 4 | Time-based exit |
| `wideRangeMultiplier` | 1.5 | Skip if range > 1.5x ATR |
| `pyramidLevels` | 3 | Max position adds |

---

## Implementation

```typescript
// src/lib/engine/strategies/neverStoppedOut.ts

export class NeverStoppedOutStrategy implements BaseStrategy {
  name = 'Never Stopped Out';
  description = 'Advanced ORB with time exits and HTF bias';
  category = 'FUTURES';

  private params = {
    rangeMinutes: 60,
    htfTimeframe: '4H',
    maxHoldHours: 4,
    wideRangeMultiplier: 1.5,
    pyramidLevels: 3
  };

  private openingRange: Range | null = null;
  private currentPyramid = 0;
  private entryTime: Date | null = null;

  async onCandle(bar: Bar): Promise<Signal | null> {
    // Build opening range
    if (!this.openingRange && this.isWithinOpeningRange(bar)) {
      this.updateRange(bar);
      return null;
    }

    // Check for time-based exit
    if (this.entryTime && this.shouldTimeExit()) {
      return {
        symbol: bar.symbol,
        action: 'close',
        price: bar.close,
        reason: 'Time-based exit after 4 hours'
      };
    }

    // Get higher timeframe bias
    const htfTrend = await this.getHTFTrend(bar.symbol);

    // Check for breakout
    if (this.openingRange) {
      // Wide range filter
      if (this.isWideRange()) {
        return null;
      }

      // Bullish breakout (only if 4H bullish)
      if (bar.close > this.openingRange.high && htfTrend === 'bullish') {
        if (this.currentPyramid < this.params.pyramidLevels) {
          this.currentPyramid++;
          this.entryTime = new Date();

          return {
            symbol: bar.symbol,
            action: 'buy',
            price: bar.close,
            // No stopLoss! Time-based exit instead
            reason: `NSO breakout above ${this.openingRange.high}, HTF bullish, pyramid ${this.currentPyramid}`
          };
        }
      }

      // Bearish breakdown (only if 4H bearish)
      if (bar.close < this.openingRange.low && htfTrend === 'bearish') {
        if (this.currentPyramid < this.params.pyramidLevels) {
          this.currentPyramid++;
          this.entryTime = new Date();

          return {
            symbol: bar.symbol,
            action: 'sell',
            price: bar.close,
            reason: `NSO breakdown below ${this.openingRange.low}, HTF bearish, pyramid ${this.currentPyramid}`
          };
        }
      }
    }

    return null;
  }

  private shouldTimeExit(): boolean {
    if (!this.entryTime) return false;
    const hours = (Date.now() - this.entryTime.getTime()) / (1000 * 60 * 60);
    return hours >= this.params.maxHoldHours;
  }

  private async getHTFTrend(symbol: string): Promise<'bullish' | 'bearish' | 'neutral'> {
    const h4Bars = await this.getBars(symbol, '4H', 50);
    const sma20 = this.calculateSMA(h4Bars.map(b => b.close), 20);
    const sma50 = this.calculateSMA(h4Bars.map(b => b.close), 50);

    if (sma20 > sma50) return 'bullish';
    if (sma20 < sma50) return 'bearish';
    return 'neutral';
  }

  private isWideRange(): boolean {
    const rangeSize = this.openingRange.high - this.openingRange.low;
    const atr = this.calculateATR(14);
    return rangeSize > atr * this.params.wideRangeMultiplier;
  }
}
```

---

## Pyramiding (Adding to Winners)

Unlike standard strategies, NSO allows adding to winning positions:

```typescript
// Original position at 5855
// Price moves to 5875 (20 points in our favor)
// Add second position at 5875

// Average entry: (5855 + 5875) / 2 = 5865
// Max positions: 3 pyramids
```

**Rules**:
- Only add if position is profitable
- Each add is same size (no martingale)
- Max 3 pyramid levels

---

## Time Exit Logic

### Why Time-Based?

1. **Avoids stop hunting** - No price level to target
2. **Accepts market noise** - Temporary spikes don't exit
3. **Forces discipline** - Can't hold forever hoping

### Exit Times

```typescript
// Exit after 4 hours
if (hoursHeld >= 4) closePosition();

// OR exit at session end (4 PM ET)
if (hour >= 16) closePosition();

// OR exit before overnight (5 PM ET for futures)
if (hour >= 17) closePosition();
```

---

## Emergency Exit

Despite "never stopped out", have emergency levels:

```typescript
// Catastrophic loss protection
if (unrealizedPnL < -accountBalance * 0.05) {
  // More than 5% account loss
  emergencyClose();
}
```

---

## Best Conditions

### When NSO Works

- **Strong trend days** - 4H bias continues
- **Moderate volatility** - Range not too wide
- **Clean breakout** - Breaks and doesn't look back
- **Volume confirmation** - Institutional commitment

### When NSO Fails

- **Choppy days** - Breaks both directions
- **News events** - Unpredictable volatility
- **Extremely wide ranges** - Too much risk
- **Counter-trend breakouts** - Goes against 4H

---

## Risk Considerations

### Pros
- No premature stop-outs
- Catches bigger moves
- Pyramiding increases winners

### Cons
- Can have large drawdowns intraday
- Requires strong psychology
- Not for small accounts

### Position Sizing

Because no stop, use smaller size:

```typescript
// Instead of 1% risk per trade
// Use 0.5% account per position
const positionValue = accountBalance * 0.005;
```

---

## Performance Expectations

| Metric | Value |
|--------|-------|
| Win Rate | 40-50% |
| Avg Win | 3-5x risk |
| Avg Loss | Variable (time-based) |
| Profit Factor | 1.5-2.5 |
| Best Days | Strong trend days |
| Worst Days | Choppy/reversal days |

---

## Agent Usage

[[Pivot Pete]] uses NSO as advanced mode:

```python
# In pivot_pete_engine.py
if advanced_mode:
    strategy = NeverStoppedOutStrategy()
else:
    strategy = ORBStrategy()
```

---

## Comparison: ORB vs NSO

| Feature | ORB | Never Stopped Out |
|---------|-----|-------------------|
| Range Duration | 15 min | 60 min |
| HTF Filter | Optional | Required |
| Stop Loss | Fixed | None (time exit) |
| Pyramiding | No | Yes (up to 3) |
| Exit Type | Target/Stop | Time-based |
| Risk Level | Moderate | Higher |
| Reward Potential | 2:1 | 3-5:1 |

---

## Related Pages

- [[ORB]] - Base strategy
- [[Pivot Pete]] - Agent using NSO
- [[Strategies Overview]] - All strategies
- [[Risk Management]] - Position sizing
