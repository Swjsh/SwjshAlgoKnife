# ORB - Opening Range Breakout

---
tags: #strategy #futures #breakout
status: ✅ Active
markets: Futures, Stocks
---

## Overview

**Opening Range Breakout (ORB)** is a momentum strategy that trades breakouts from the first N minutes of a trading session.

**Core Concept**: The opening range establishes early support/resistance. Breaking out suggests directional commitment.

**File**: `src/lib/engine/strategies/orb.ts`

---

## How It Works

### 1. Define Opening Range

During the first 15 minutes (configurable) of the session:
- Track the **highest high** → Range High
- Track the **lowest low** → Range Low

### 2. Wait for Breakout

After the opening range period:
- **Long signal**: Price closes above Range High
- **Short signal**: Price closes below Range Low

### 3. Execute Trade

- Enter in breakout direction
- Stop-loss on opposite side of range
- Target: 2x range size (configurable)

---

## Visual Example

```
Session Start
│
├── 9:30  ────────────────────
│         Open: 5850
│
│   OPENING RANGE (15 min)
│         High: 5855 ←── Range High
│         Low:  5840 ←── Range Low
│
├── 9:45  ────────────────────
│
│   WATCH FOR BREAKOUT
│
├── 10:15 ────────────────────
│         Close: 5858 ←── Breaks above Range High
│
│   🟢 LONG ENTRY: 5858
│   🛑 STOP LOSS: 5840 (Range Low)
│   🎯 TARGET: 5888 (2x range = 30 pts)
```

---

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `openingRangeMinutes` | 15 | Duration to establish range |
| `riskRewardRatio` | 2.0 | Target = RR × stop distance |
| `volumeThreshold` | 1.5 | Breakout needs 1.5x avg volume |
| `trailStop` | false | Whether to trail stop after entry |
| `sessionStart` | market-dependent | When range tracking begins |

---

## Implementation

```typescript
// src/lib/engine/strategies/orb.ts

export class ORBStrategy implements BaseStrategy {
  name = 'Opening Range Breakout';
  description = 'Trade breakouts from first 15 minutes of session';
  category = 'FUTURES';

  private openingRange: { high: number; low: number } | null = null;
  private rangeEstablished = false;
  private sessionBars: Bar[] = [];

  private params = {
    openingRangeMinutes: 15,
    riskRewardRatio: 2.0,
    volumeThreshold: 1.5
  };

  onCandle(bar: Bar): Signal | null {
    // Check if new session started
    if (this.isNewSession(bar)) {
      this.resetSession();
    }

    // During opening range period
    if (!this.rangeEstablished) {
      this.sessionBars.push(bar);

      if (this.sessionBars.length >= this.params.openingRangeMinutes) {
        this.openingRange = this.calculateRange(this.sessionBars);
        this.rangeEstablished = true;
        console.log(`[ORB] Range established: ${this.openingRange.low} - ${this.openingRange.high}`);
      }
      return null;
    }

    // After opening range - check for breakout
    if (this.openingRange) {
      const avgVolume = this.getAverageVolume();

      // Bullish breakout
      if (bar.close > this.openingRange.high && bar.volume > avgVolume * this.params.volumeThreshold) {
        const rangeSize = this.openingRange.high - this.openingRange.low;
        return {
          symbol: bar.symbol,
          action: 'buy',
          price: bar.close,
          stopLoss: this.openingRange.low,
          takeProfit: bar.close + (rangeSize * this.params.riskRewardRatio),
          reason: `ORB breakout above ${this.openingRange.high}`
        };
      }

      // Bearish breakdown
      if (bar.close < this.openingRange.low && bar.volume > avgVolume * this.params.volumeThreshold) {
        const rangeSize = this.openingRange.high - this.openingRange.low;
        return {
          symbol: bar.symbol,
          action: 'sell',
          price: bar.close,
          stopLoss: this.openingRange.high,
          takeProfit: bar.close - (rangeSize * this.params.riskRewardRatio),
          reason: `ORB breakdown below ${this.openingRange.low}`
        };
      }
    }

    return null;
  }

  private calculateRange(bars: Bar[]): { high: number; low: number } {
    return {
      high: Math.max(...bars.map(b => b.high)),
      low: Math.min(...bars.map(b => b.low))
    };
  }

  private isNewSession(bar: Bar): boolean {
    // Check if this is first bar of new session
    const hour = new Date(bar.timestamp).getHours();
    return hour === 9 && new Date(bar.timestamp).getMinutes() === 30;
  }

  private resetSession(): void {
    this.openingRange = null;
    this.rangeEstablished = false;
    this.sessionBars = [];
  }
}
```

---

## Best Conditions

### When ORB Works Well

- **Strong overnight gap** - Price opened significantly higher/lower
- **News catalyst** - Earnings, economic data
- **Trending market** - Strong daily/weekly trend
- **High volume open** - Institutional participation
- **Clean break** - Closes decisively above/below range

### When ORB Fails

- **Range-bound market** - Whipsaws between range extremes
- **Holiday/low volume** - Fake breakouts common
- **Major resistance/support nearby** - Breakout gets rejected
- **Late in week** - Friday afternoons often fade

---

## Entry Filters

### Volume Confirmation

```typescript
// Only enter if breakout has volume
if (bar.volume < averageVolume * 1.5) {
  return null;  // Skip low-volume breakout
}
```

### Time Filter

```typescript
// Best results during morning momentum
const hour = new Date(bar.timestamp).getHours();
if (hour >= 12) {
  // After noon, use smaller position size
  signal.size = signal.size * 0.5;
}
```

### Trend Alignment

```typescript
// Check higher timeframe trend
const dailyTrend = await getTrend('1D');
if (signal.action === 'buy' && dailyTrend === 'bearish') {
  return null;  // Don't go long against daily downtrend
}
```

---

## Exit Strategies

### Fixed Target
```
Target = Entry + (Range Size × Risk/Reward)
```

### Trail Stop
```typescript
// Move stop to breakeven at 1x risk
if (currentPnL >= rangeSize) {
  adjustStopLoss(entryPrice);
}

// Trail by ATR
const atr = calculateATR(14);
if (currentPnL > 0) {
  trailStop = currentPrice - (atr * 2);
}
```

### Time-Based
```typescript
// Close position by session end
if (hour >= 15 && minute >= 30) {
  closePosition();
}
```

---

## Risk Management

### Position Sizing

```typescript
const rangeSize = openingRange.high - openingRange.low;
const riskPerTrade = accountBalance * 0.01;  // 1% risk
const positionSize = riskPerTrade / rangeSize;
```

### Wide Range Days

```typescript
// If range > 1.5x ATR, reduce size or skip
const atr = calculateATR(14);
if (rangeSize > atr * 1.5) {
  positionSize = positionSize * 0.5;  // Half size
  // OR
  return null;  // Skip this day
}
```

---

## Session Times

| Market | Session Start | Opening Range Ends |
|--------|--------------|-------------------|
| ES/NQ/YM | 9:30 AM ET | 9:45 AM ET |
| Stocks | 9:30 AM ET | 9:45 AM ET |
| Forex | Session dependent | Variable |
| Crypto | 00:00 UTC (or continuous) | 00:15 UTC |

---

## Performance Expectations

### Historical Data (ES Futures)

| Metric | Value |
|--------|-------|
| Win Rate | 45-55% |
| Avg Win | 1.5-2x range |
| Avg Loss | 1x range |
| Profit Factor | 1.3-1.8 |
| Best Days | Trending/Gap days |
| Worst Days | Range-bound/Chop |

---

## Variations

### 30-Minute ORB

Wider range, fewer signals, higher conviction.

```typescript
params.openingRangeMinutes = 30;
```

### First 5-Minute ORB

Aggressive, more signals, higher noise.

```typescript
params.openingRangeMinutes = 5;
```

### ORB with Retest

Wait for breakout, then pullback to range before entry.

```typescript
if (previouslyBrokeAbove && bar.close > openingRange.high && bar.low <= openingRange.high) {
  // Retested the breakout level - enter now
  return signal;
}
```

See also: [[Never Stopped Out]] - Advanced ORB variant

---

## Agent Usage

### Pivot Pete

[[Pivot Pete]] uses ORB as primary strategy for ES, NQ, YM futures.

### Configuration

```python
# In pivot_pete_engine.py
orb_config = {
    'opening_range_minutes': 15,
    'risk_reward': 2.0,
    'volume_filter': True,
    'trend_alignment': True
}
```

---

## Backtesting Results

See [[Universal Backtest]] for running historical tests.

```bash
python scripts/universal_backtest.py \
  --strategy ORB \
  --symbol ES \
  --start 2025-01-01 \
  --end 2026-03-01
```

---

## Related Pages

- [[Never Stopped Out]] - Advanced ORB variant
- [[Pivot Pete]] - Agent using ORB
- [[Strategies Overview]] - All strategies
- [[Universal Backtest]] - Testing framework
- [[Trade Execution]] - Order execution
