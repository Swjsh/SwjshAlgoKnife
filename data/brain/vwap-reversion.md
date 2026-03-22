# VWAP Reversion Strategy

---
tags: #strategy #meanreversion #intraday
status: ✅ Active
markets: All (Stocks, Futures, Crypto, Forex)
---

## Overview

**VWAP Reversion** is a mean reversion strategy that trades deviations from the Volume-Weighted Average Price.

**Core Concept**: VWAP represents "fair value" for institutional traders. Large deviations tend to revert.

**File**: `src/lib/engine/strategies/vwapReversion.ts`

---

## What is VWAP?

**Volume-Weighted Average Price** = cumulative (price × volume) / cumulative volume

```typescript
VWAP = Σ(Price × Volume) / Σ(Volume)
```

**Significance**:
- Institutional benchmark for execution quality
- "Did I buy below VWAP?" = good fill
- Price tends to oscillate around VWAP during ranging days

---

## How It Works

### 1. Calculate VWAP

Running calculation from session start:

```typescript
let cumulativeTPV = 0;  // Typical Price × Volume
let cumulativeVolume = 0;

for (const bar of sessionBars) {
  const typicalPrice = (bar.high + bar.low + bar.close) / 3;
  cumulativeTPV += typicalPrice * bar.volume;
  cumulativeVolume += bar.volume;
}

const vwap = cumulativeTPV / cumulativeVolume;
```

### 2. Detect Deviation

Measure how far price is from VWAP:

```typescript
const deviation = (currentPrice - vwap) / vwap;

// e.g., deviation = 0.005 means price is 0.5% above VWAP
```

### 3. Enter Reversion Trade

When deviation exceeds threshold:
- **Price > VWAP + threshold** → SHORT (expect reversion down)
- **Price < VWAP - threshold** → LONG (expect reversion up)

### 4. Target VWAP

Exit when price returns to VWAP (or overshoots slightly).

---

## Visual Example

```
Price
│
│     ╭─╮  ← Price spikes 0.5% above VWAP
│    ╱   ╲
│   ╱     ╲  🔴 SHORT entry here
│  ╱       ╲
│ ╱         ╲
├─────────────────── VWAP
│             ╲ ╱  ← Target: return to VWAP
│              ╳
│             ╱
│
```

---

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `deviationThreshold` | 0.005 | Minimum deviation to trigger (0.5%) |
| `stopLossMultiplier` | 2.0 | Stop at 2x deviation |
| `targetOvershoot` | 0.002 | Target 0.2% past VWAP |
| `minVolume` | 1.0x avg | Minimum volume filter |
| `sessionReset` | true | Reset VWAP each session |

---

## Implementation

```typescript
// src/lib/engine/strategies/vwapReversion.ts

export class VWAPReversionStrategy implements BaseStrategy {
  name = 'VWAP Reversion';
  description = 'Mean reversion to VWAP';
  category = 'ALL';

  private params = {
    deviationThreshold: 0.005,  // 0.5%
    stopLossMultiplier: 2.0,
    targetOvershoot: 0.002
  };

  private cumulativeTPV = 0;
  private cumulativeVolume = 0;
  private sessionStart: Date | null = null;

  onCandle(bar: Bar): Signal | null {
    // Reset VWAP on new session
    if (this.isNewSession(bar)) {
      this.resetSession();
    }

    // Update VWAP
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    this.cumulativeTPV += typicalPrice * bar.volume;
    this.cumulativeVolume += bar.volume;

    const vwap = this.cumulativeTPV / this.cumulativeVolume;

    // Calculate deviation
    const deviation = (bar.close - vwap) / vwap;
    const absDeviation = Math.abs(deviation);

    // Check for reversion opportunity
    if (absDeviation >= this.params.deviationThreshold) {
      if (deviation > 0) {
        // Price above VWAP - short for reversion
        return {
          symbol: bar.symbol,
          action: 'sell',
          price: bar.close,
          stopLoss: bar.close * (1 + absDeviation * this.params.stopLossMultiplier),
          takeProfit: vwap * (1 - this.params.targetOvershoot),
          reason: `VWAP reversion: ${(deviation * 100).toFixed(2)}% above VWAP`
        };
      } else {
        // Price below VWAP - long for reversion
        return {
          symbol: bar.symbol,
          action: 'buy',
          price: bar.close,
          stopLoss: bar.close * (1 - absDeviation * this.params.stopLossMultiplier),
          takeProfit: vwap * (1 + this.params.targetOvershoot),
          reason: `VWAP reversion: ${(Math.abs(deviation) * 100).toFixed(2)}% below VWAP`
        };
      }
    }

    return null;
  }

  private isNewSession(bar: Bar): boolean {
    const barTime = new Date(bar.timestamp);
    // For stocks: new session at 9:30 AM
    return barTime.getHours() === 9 && barTime.getMinutes() === 30;
  }

  private resetSession(): void {
    this.cumulativeTPV = 0;
    this.cumulativeVolume = 0;
  }
}
```

---

## VWAP Bands

Add standard deviation bands for better entries:

```typescript
// Calculate standard deviation from VWAP
const squaredDeviations = bars.map(b => {
  const tp = (b.high + b.low + b.close) / 3;
  return Math.pow(tp - vwap, 2) * b.volume;
});

const variance = squaredDeviations.reduce((a, b) => a + b, 0) / cumulativeVolume;
const stdDev = Math.sqrt(variance);

// Bands
const upperBand1 = vwap + stdDev;
const upperBand2 = vwap + (2 * stdDev);
const lowerBand1 = vwap - stdDev;
const lowerBand2 = vwap - (2 * stdDev);
```

**Trading Bands**:
- Entry at 2σ deviation (more conservative)
- Exit at VWAP or 1σ on opposite side

---

## Best Conditions

### When VWAP Reversion Works

- **Range-bound days** - Price oscillates around VWAP
- **High volume** - Institutional activity anchors to VWAP
- **After initial move** - Morning spike reverts to VWAP
- **Midday lull** - 11:00-14:00 often range-bound

### When VWAP Reversion Fails

- **Strong trend days** - VWAP becomes resistance/support, not magnet
- **News events** - Momentum overpowers mean reversion
- **Low volume** - VWAP less meaningful
- **Gap days** - VWAP may be irrelevant after large gap

---

## Trend Filter

Avoid fighting strong trends:

```typescript
// Only trade reversion if not trending strongly
const ema20 = calculateEMA(bars, 20);
const ema50 = calculateEMA(bars, 50);

// If EMAs are far apart, skip VWAP reversion
const emaDiff = Math.abs(ema20 - ema50) / ema50;
if (emaDiff > 0.02) {  // EMAs > 2% apart
  return null;  // Too trendy for mean reversion
}
```

---

## Time Filters

### Best Times

```typescript
// VWAP reversion works best midday
const hour = new Date(bar.timestamp).getHours();

// Avoid first 30 min (volatile) and last 30 min (closing moves)
if (hour < 10 || hour >= 15.5) {
  return null;
}
```

### Avoid

- **First 30 minutes**: VWAP still forming, volatile
- **Last 30 minutes**: MOC orders cause moves
- **Around news**: Scheduled economic releases

---

## Position Sizing

```typescript
function calculateVWAPPositionSize(
  deviation: number,
  accountBalance: number,
  riskPercent: number
): number {
  // Higher deviation = smaller size (contrarian trade)
  const baseSize = (accountBalance * riskPercent) / (deviation * 2);

  // Cap at reasonable size
  return Math.min(baseSize, accountBalance * 0.1);
}
```

---

## Exit Strategies

### Primary: VWAP Touch

```typescript
if (position.side === 'long' && currentPrice >= vwap) {
  closePosition();
}
```

### Secondary: Time-Based

```typescript
// Close by 15:30 if target not hit
if (hour >= 15.5 && !targetHit) {
  closeAtMarket();
}
```

### Stop Loss

```typescript
// 2x deviation from entry
const stopDistance = entryDeviation * 2;
const stop = entry * (1 - stopDistance);  // For long
```

---

## Advanced: Anchored VWAP

Reset VWAP from significant events:

```typescript
// VWAP from earnings
const earningsVWAP = calculateVWAP(barsFromEarnings);

// VWAP from breakout
const breakoutVWAP = calculateVWAP(barsFromBreakout);

// VWAP from week start
const weeklyVWAP = calculateVWAP(weekBars);
```

---

## Performance Expectations

| Metric | Range-Bound Day | Trending Day |
|--------|-----------------|--------------|
| Win Rate | 65-75% | 30-40% |
| Avg Win | 0.3-0.5% | Variable |
| Avg Loss | 0.3-0.6% | Higher |
| Profit Factor | 1.5-2.5 | < 1.0 |

**Key Insight**: Regime detection is critical. Use VWAP reversion only on range days.

---

## Agent Usage

Multiple agents use VWAP reversion:

- [[Bitcoin Bob]] - Crypto mean reversion
- [[Pivot Pete]] - Futures intraday
- [[SPX Sniper]] - Options underlying

---

## Related Pages

- [[Strategies Overview]] - All strategies
- [[Support Resistance]] - Alternative reversal strategy
- [[Bollinger Breakout]] - Volatility-based (opposite approach)
- [[Risk Management]] - Position sizing
- [[Universal Backtest]] - Testing framework
