# Support & Resistance Strategy

---
tags: #strategy #zones #reversal
status: ✅ Active
markets: All
---

## Overview

**Support/Resistance** is a zone-based reversal strategy that trades rejections from key price levels.

**Core Concept**: Price respects historical levels where buyers/sellers previously showed interest.

**File**: `src/lib/engine/strategies/suppRes.ts`

---

## Key Concepts

### Support
Price level where **buying interest** emerges, preventing further decline.

### Resistance
Price level where **selling pressure** emerges, preventing further rise.

### Zones vs Lines
Use **zones** (price ranges) rather than exact lines - price rarely stops at exact levels.

---

## How It Works

### 1. Identify Key Levels

Find levels with multiple touches:
- Previous swing highs/lows
- Daily/weekly open/close
- Round numbers (psychological)
- Previous day high/low

### 2. Wait for Approach

Price must approach the zone:
- Within 0.3% of level
- Slowing momentum (smaller candles)
- Volume declining on approach

### 3. Confirm Rejection

Look for reversal signals:
- Pin bar (long wick into zone)
- Engulfing candle
- Double/triple touch without break

### 4. Enter Trade

- Enter on confirmation candle close
- Stop beyond the zone
- Target next S/R level

---

## Visual Example

```
         ┌─────────────────────┐
         │   RESISTANCE ZONE   │  ← Previous highs cluster here
5860 ────┼─────────────────────┼────
         │                     │
              ┌──┐
             ╱│  │╲   ← Rejection candle (pin bar)
        ────╱ │  │ ╲────
           │  └──┘  │
           │        │
           │   🔴 SHORT @ 5855
           │   🛑 STOP: 5865 (above zone)
           │   🎯 TARGET: 5820 (next support)
           │
5820 ──────┼────────────────────────
           │   SUPPORT ZONE
           └────────────────────────
```

---

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `zoneThickness` | 0.3% | How thick the zone is (% of price) |
| `minTouches` | 2 | Minimum historical touches to be valid |
| `rejectionWickRatio` | 0.6 | Pin bar wick must be 60% of candle |
| `stopBeyondZone` | 0.2% | Stop placed this far beyond zone |
| `targetNextLevel` | true | Use next S/R as target |

---

## Implementation

```typescript
// src/lib/engine/strategies/suppRes.ts

export class SupportResistanceStrategy implements BaseStrategy {
  name = 'Support/Resistance';
  description = 'Trade reversals at key price zones';
  category = 'ALL';

  private params = {
    zoneThickness: 0.003,  // 0.3%
    minTouches: 2,
    rejectionWickRatio: 0.6,
    lookbackBars: 200
  };

  async onCandle(bar: Bar): Promise<Signal | null> {
    // Get historical data
    const history = await this.getHistory(bar.symbol, this.params.lookbackBars);

    // Find key levels
    const levels = this.findKeyLevels(history);

    // Check if price is near a level
    for (const level of levels) {
      const distance = Math.abs(bar.close - level.price) / level.price;

      if (distance < this.params.zoneThickness) {
        // Check for rejection signal
        const rejection = this.checkRejection(bar, level);

        if (rejection) {
          return this.createSignal(bar, level, rejection);
        }
      }
    }

    return null;
  }

  private findKeyLevels(bars: Bar[]): Level[] {
    const levels: Level[] = [];

    // Find swing highs
    for (let i = 2; i < bars.length - 2; i++) {
      if (bars[i].high > bars[i-1].high &&
          bars[i].high > bars[i-2].high &&
          bars[i].high > bars[i+1].high &&
          bars[i].high > bars[i+2].high) {
        levels.push({
          price: bars[i].high,
          type: 'resistance',
          touches: this.countTouches(bars, bars[i].high)
        });
      }

      // Find swing lows
      if (bars[i].low < bars[i-1].low &&
          bars[i].low < bars[i-2].low &&
          bars[i].low < bars[i+1].low &&
          bars[i].low < bars[i+2].low) {
        levels.push({
          price: bars[i].low,
          type: 'support',
          touches: this.countTouches(bars, bars[i].low)
        });
      }
    }

    // Filter by minimum touches and merge nearby levels
    return this.mergeAndFilter(levels);
  }

  private checkRejection(bar: Bar, level: Level): string | null {
    const bodySize = Math.abs(bar.close - bar.open);
    const totalRange = bar.high - bar.low;

    if (totalRange === 0) return null;

    // Check for pin bar at resistance
    if (level.type === 'resistance') {
      const upperWick = bar.high - Math.max(bar.open, bar.close);
      if (upperWick / totalRange > this.params.rejectionWickRatio) {
        return 'pin_bar_rejection';
      }
    }

    // Check for pin bar at support
    if (level.type === 'support') {
      const lowerWick = Math.min(bar.open, bar.close) - bar.low;
      if (lowerWick / totalRange > this.params.rejectionWickRatio) {
        return 'pin_bar_rejection';
      }
    }

    return null;
  }

  private createSignal(bar: Bar, level: Level, rejectionType: string): Signal {
    const nextLevel = this.findNextLevel(level);

    if (level.type === 'resistance') {
      return {
        symbol: bar.symbol,
        action: 'sell',
        price: bar.close,
        stopLoss: level.price * (1 + this.params.zoneThickness * 2),
        takeProfit: nextLevel?.price || bar.close * 0.99,
        reason: `${rejectionType} at resistance ${level.price}`
      };
    } else {
      return {
        symbol: bar.symbol,
        action: 'buy',
        price: bar.close,
        stopLoss: level.price * (1 - this.params.zoneThickness * 2),
        takeProfit: nextLevel?.price || bar.close * 1.01,
        reason: `${rejectionType} at support ${level.price}`
      };
    }
  }
}
```

---

## Rejection Patterns

### Pin Bar (Hammer/Shooting Star)

```
Bullish Pin Bar (at support):    Bearish Pin Bar (at resistance):

       │                                ┌─┐
      ┌┴┐                              ─┤ ├─
    ──┤ ├──                              │
       │                                 │
       │                                 │
       │
```

**Requirements**:
- Wick > 60% of total range
- Small body
- Wick points into the zone

### Engulfing Candle

```
Bullish Engulfing:              Bearish Engulfing:

    ┌─┐                              ┌───┐
    │ │ ┌───┐                    ┌─┐ │   │
    │ │ │   │                    │ │ │   │
    └─┘ │   │                    └─┘ │   │
        └───┘                        └───┘
```

**Requirements**:
- Second candle completely engulfs first
- Occurs at S/R zone
- Strong close in reversal direction

---

## Level Identification Methods

### Swing Points

```typescript
// Find local maxima/minima
function findSwings(bars: Bar[], leftBars: number, rightBars: number) {
  // A swing high is higher than N bars on each side
  // A swing low is lower than N bars on each side
}
```

### Previous Day High/Low

```typescript
const prevDayHigh = previousDayBars.reduce((max, b) => Math.max(max, b.high), 0);
const prevDayLow = previousDayBars.reduce((min, b) => Math.min(min, b.low), Infinity);
```

### Round Numbers

```typescript
// For ES futures
const roundLevels = [5800, 5825, 5850, 5875, 5900];  // 25-point intervals
```

### Volume Profile (Advanced)

```typescript
// Find high volume nodes (HVN) and low volume nodes (LVN)
const volumeProfile = calculateVolumeProfile(bars);
const hvnLevels = volumeProfile.filter(v => v.volume > avgVolume * 1.5);
```

---

## Best Conditions

### When S/R Works Well

- **Ranging markets** - Price bounces between levels
- **First touch of level** - More reliable than multiple touches
- **Confluence** - Multiple reasons for level (round number + swing high)
- **Clean rejection** - Strong reversal candle

### When S/R Fails

- **Strong trends** - Levels get broken through
- **News events** - Volatility ignores levels
- **Overused levels** - Everyone sees it, stops get hunted
- **Small timeframe levels** - Less significant

---

## Level Strength

| Factor | Strength |
|--------|----------|
| Multiple touches (2-3) | Strong |
| Higher timeframe level | Stronger |
| Round number | Adds strength |
| Volume spike at level | Confirms |
| Recent level (< 20 bars) | More relevant |
| Old level (> 100 bars) | May be forgotten |

---

## Position Management

### Initial Stop

```typescript
// Place stop beyond the zone
const stopDistance = zoneThickness * 2;  // 0.6% beyond
const stop = level.type === 'support'
  ? level.price * (1 - stopDistance)
  : level.price * (1 + stopDistance);
```

### Target Selection

```typescript
// Option 1: Next S/R level
const target = findNextLevel(currentLevel);

// Option 2: Fixed R:R
const target = entry + (stopDistance * 2);

// Option 3: Measured move
const target = entry + previousSwingSize;
```

### Trail Stop

```typescript
// Move stop to breakeven at 1R
if (pnl >= risk) {
  stop = entryPrice;
}

// Trail with recent swing
if (pnl >= 2 * risk) {
  stop = recentSwingLow;  // For long
}
```

---

## Multi-Timeframe Approach

### Higher Timeframe Levels

```typescript
// D1 levels are stronger than H1 levels
const d1Levels = findLevels(dailyBars);
const h1Levels = findLevels(hourlyBars);

// Only trade H1 setups that align with D1 levels
const confluenceLevels = h1Levels.filter(h1 =>
  d1Levels.some(d1 => Math.abs(h1.price - d1.price) / d1.price < 0.002)
);
```

---

## Related Pages

- [[Strategies Overview]] - All strategies
- [[Sterling FX]] - Uses S/R for forex
- [[ORB]] - Uses opening range as S/R
- [[Risk Management]] - Position sizing
- [[Universal Backtest]] - Testing framework
