# Bollinger Band Breakout

---
tags: #strategy #volatility #breakout
status: ✅ Active
markets: All (Crypto, Stocks, Forex)
---

## Overview

**Bollinger Band Breakout** trades volatility expansion after periods of compression (squeezes).

**Core Concept**: Low volatility leads to high volatility. Trade the expansion.

**File**: `src/lib/engine/strategies/bbBreakout.ts`

---

## Bollinger Bands Explained

**Components**:
- **Middle Band**: 20-period Simple Moving Average
- **Upper Band**: Middle + (2 × Standard Deviation)
- **Lower Band**: Middle - (2 × Standard Deviation)

```typescript
function calculateBollingerBands(prices: number[], period = 20, stdDev = 2) {
  const sma = calculateSMA(prices, period);
  const std = calculateStdDev(prices, period);

  return {
    middle: sma,
    upper: sma + (std * stdDev),
    lower: sma - (std * stdDev),
    width: ((sma + (std * stdDev)) - (sma - (std * stdDev))) / sma
  };
}
```

---

## The Squeeze

**What is a Squeeze?**

When Bollinger Bands narrow significantly, volatility is compressing:
- Bands width < 2% of price = squeeze
- Often precedes explosive moves
- Direction unknown until breakout

**Visual**:
```
        Normal                    Squeeze

    ════════════════          ═══════════════
       ╱        ╲                ────────────
      ╱   SMA    ╲              ═══════════════
     ═════════════               Price coiling
```

---

## How It Works

### 1. Detect Squeeze

```typescript
const bandWidth = (bb.upper - bb.lower) / bb.middle;
const avgWidth = calculateAverageWidth(20);

const isSqueeze = bandWidth < avgWidth * 0.5;  // Width < 50% of average
```

### 2. Wait for Expansion

```typescript
const expanding = currentWidth > previousWidth * 1.1;  // Width increased 10%+
```

### 3. Enter on Breakout

```typescript
if (expanding && bar.close > bb.upper) {
  // Bullish breakout
  return { action: 'buy', ... };
}

if (expanding && bar.close < bb.lower) {
  // Bearish breakout
  return { action: 'sell', ... };
}
```

---

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `period` | 20 | SMA lookback period |
| `stdDev` | 2.0 | Standard deviation multiplier |
| `squeezeThreshold` | 0.02 | Max band width for squeeze (2%) |
| `volumeMultiplier` | 1.5 | Required volume spike |

---

## Implementation

```typescript
// src/lib/engine/strategies/bbBreakout.ts

export class BollingerBreakoutStrategy implements BaseStrategy {
  name = 'Bollinger Breakout';
  description = 'Trade volatility expansion after squeeze';
  category = 'ALL';

  private params = {
    period: 20,
    stdDev: 2.0,
    squeezeThreshold: 0.02,
    volumeMultiplier: 1.5
  };

  private inSqueeze = false;

  onCandle(bar: Bar, history: Bar[]): Signal | null {
    if (history.length < this.params.period) return null;

    // Calculate Bollinger Bands
    const closes = history.map(b => b.close);
    const bb = this.calculateBands(closes);

    // Calculate band width
    const width = (bb.upper - bb.lower) / bb.middle;

    // Check for squeeze
    if (width < this.params.squeezeThreshold) {
      this.inSqueeze = true;
      return null;  // Wait for expansion
    }

    // If we were in squeeze and now breaking out
    if (this.inSqueeze) {
      const avgVolume = this.calculateAvgVolume(history);

      // Bullish breakout
      if (bar.close > bb.upper && bar.volume > avgVolume * this.params.volumeMultiplier) {
        this.inSqueeze = false;
        return {
          symbol: bar.symbol,
          action: 'buy',
          price: bar.close,
          stopLoss: bb.middle,  // Stop at middle band
          takeProfit: bar.close + (bar.close - bb.middle) * 2,  // 2:1 target
          reason: `BB breakout above ${bb.upper.toFixed(2)} after squeeze`
        };
      }

      // Bearish breakdown
      if (bar.close < bb.lower && bar.volume > avgVolume * this.params.volumeMultiplier) {
        this.inSqueeze = false;
        return {
          symbol: bar.symbol,
          action: 'sell',
          price: bar.close,
          stopLoss: bb.middle,
          takeProfit: bar.close - (bb.middle - bar.close) * 2,
          reason: `BB breakdown below ${bb.lower.toFixed(2)} after squeeze`
        };
      }
    }

    return null;
  }

  private calculateBands(prices: number[]): BollingerBands {
    const recent = prices.slice(-this.params.period);
    const sma = recent.reduce((a, b) => a + b, 0) / recent.length;

    const squaredDiffs = recent.map(p => Math.pow(p - sma, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / recent.length;
    const stdDev = Math.sqrt(variance);

    return {
      middle: sma,
      upper: sma + (stdDev * this.params.stdDev),
      lower: sma - (stdDev * this.params.stdDev)
    };
  }
}
```

---

## Best Conditions

### When BB Breakout Works

- **After consolidation** - Longer squeeze = bigger move
- **With volume** - Confirms institutional participation
- **News catalyst** - Earnings, economic data
- **Trending markets** - Breakouts more likely to follow through

### When BB Breakout Fails

- **Choppy markets** - False breakouts common
- **Low volume breakout** - Likely to fail
- **Overextended** - Price already far from bands
- **Counter-trend** - Breaking out against major trend

---

## Volume Confirmation

Critical for reducing false signals:

```typescript
// Only enter if volume confirms
const avgVolume = history.slice(-20).reduce((sum, b) => sum + b.volume, 0) / 20;

if (bar.volume < avgVolume * 1.5) {
  return null;  // Skip low-volume breakout
}
```

---

## Stop Loss Placement

### Method 1: Middle Band

```typescript
const stop = bb.middle;  // Most common
```

### Method 2: Opposite Band

```typescript
// More aggressive
const stop = bb.lower;  // For long breakout
```

### Method 3: ATR-Based

```typescript
const atr = calculateATR(history, 14);
const stop = bar.close - (atr * 2);
```

---

## Target Strategies

### Fixed R:R

```typescript
const risk = entry - stopLoss;
const target = entry + (risk * 2);  // 2:1
```

### Band Projection

```typescript
// Target = 2x band width from entry
const bandWidth = bb.upper - bb.lower;
const target = entry + (bandWidth * 2);
```

### Trail with Middle Band

```typescript
// Exit when price touches middle band
if (position.side === 'long' && bar.close < bb.middle) {
  closePosition();
}
```

---

## Squeeze Detection Methods

### Band Width

```typescript
const squeeze = (bb.upper - bb.lower) / bb.middle < 0.02;
```

### Keltner Channel (TTM Squeeze)

```typescript
// Squeeze = BB inside Keltner
const kc = calculateKeltner(history);
const squeeze = bb.lower > kc.lower && bb.upper < kc.upper;
```

### Historical Percentile

```typescript
// Squeeze = band width in bottom 10% of last 100 bars
const widths = last100Bars.map(b => b.bbWidth);
const percentile = calculatePercentile(currentWidth, widths);
const squeeze = percentile < 10;
```

---

## Performance Expectations

| Metric | Typical Value |
|--------|---------------|
| Win Rate | 35-45% |
| Avg Win | 2-3x risk |
| Avg Loss | 1x risk |
| Profit Factor | 1.2-1.8 |
| Best Markets | Crypto, Stocks |

---

## Agent Usage

- [[Bitcoin Bob]] - Crypto momentum
- [[Boba Trades]] - Pre-earnings plays

---

## Backtesting

```bash
python scripts/universal_backtest.py \
  --strategy BollingerBreakout \
  --symbol BTC \
  --start 2025-01-01 \
  --end 2026-03-01
```

---

## Related Pages

- [[Strategies Overview]] - All strategies
- [[VWAP Reversion]] - Opposite approach (mean reversion)
- [[ORB]] - Alternative breakout strategy
- [[Risk Management]] - Position sizing
