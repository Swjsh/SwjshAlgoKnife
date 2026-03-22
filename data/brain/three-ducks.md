# Three Ducks Strategy

---
tags: #strategy #forex #trend
status: ✅ Active
markets: Forex
---

## Overview

**Three Ducks** is a multi-timeframe trend alignment strategy that confirms trend across three timeframes before entry.

**Core Concept**: "Get your ducks in a row" - align 4H, 1H, and 5M trends before trading.

**File**: `src/lib/engine/strategies/threeDucks.ts`

---

## The Three Ducks

| Duck | Timeframe | Purpose |
|------|-----------|---------|
| 🦆 **First Duck** | 4H | Overall trend direction |
| 🦆 **Second Duck** | 1H | Confirms 4H bias |
| 🦆 **Third Duck** | 5M | Entry timing |

**All three must align** for a valid signal.

---

## How It Works

### Step 1: First Duck (4H Chart)

Check if price is above or below 60-period SMA on 4H chart.

```
4H Chart:
├── Price > SMA(60) → Bullish bias
└── Price < SMA(60) → Bearish bias
```

### Step 2: Second Duck (1H Chart)

Same check on 1H chart - must align with 4H.

```
1H Chart:
├── Price > SMA(60) AND 4H bullish → Continue
├── Price < SMA(60) AND 4H bearish → Continue
└── Misalignment → No trade
```

### Step 3: Third Duck (5M Chart)

Wait for 5M to align, then enter on candle close.

```
5M Chart:
├── Price crosses above SMA(60) → LONG entry
└── Price crosses below SMA(60) → SHORT entry
```

---

## Visual Example

```
📊 4H Chart (First Duck)
────────────────────────────────
                    Current Price: 1.2680
        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~  ← Price
   SMA(60): 1.2650 ________________
        ✅ Price > SMA = BULLISH

📊 1H Chart (Second Duck)
────────────────────────────────
                  Current Price: 1.2680
      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~  ← Price
   SMA(60): 1.2665 ________________
        ✅ Price > SMA = CONFIRMS 4H

📊 5M Chart (Third Duck)
────────────────────────────────
                       ____ Price crosses above SMA
                      /
   SMA(60) ___________
           ✅ ENTRY SIGNAL: BUY

🟢 LONG GBP/USD @ 1.2680
🛑 STOP: Below 5M swing low (1.2655)
🎯 TARGET: 2-3x risk
```

---

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `htfPeriod` | 60 | 4H SMA period |
| `mtfPeriod` | 60 | 1H SMA period |
| `ltfPeriod` | 60 | 5M SMA period |
| `riskRewardRatio` | 2.5 | Target multiplier |
| `usePriceClose` | true | Use close vs current price |

---

## Implementation

```typescript
// src/lib/engine/strategies/threeDucks.ts

export class ThreeDucksStrategy implements BaseStrategy {
  name = 'Three Ducks';
  description = 'Multi-timeframe trend alignment (4H/1H/5M)';
  category = 'FOREX';

  private params = {
    period: 60,
    riskRewardRatio: 2.5
  };

  async evaluate(symbol: string): Promise<Signal | null> {
    // First Duck: 4H trend
    const h4Data = await this.getBars(symbol, '4H', 100);
    const h4Sma = this.calculateSMA(h4Data, this.params.period);
    const h4Price = h4Data[h4Data.length - 1].close;
    const h4Bullish = h4Price > h4Sma;

    // Second Duck: 1H trend (must align with 4H)
    const h1Data = await this.getBars(symbol, '1H', 100);
    const h1Sma = this.calculateSMA(h1Data, this.params.period);
    const h1Price = h1Data[h1Data.length - 1].close;
    const h1Bullish = h1Price > h1Sma;

    // Check alignment
    if (h4Bullish !== h1Bullish) {
      return null;  // Timeframes don't align
    }

    // Third Duck: 5M entry
    const m5Data = await this.getBars(symbol, '5M', 100);
    const m5Sma = this.calculateSMA(m5Data, this.params.period);
    const m5Price = m5Data[m5Data.length - 1].close;
    const m5PrevPrice = m5Data[m5Data.length - 2].close;

    // Check for crossover
    const crossedAbove = m5PrevPrice <= m5Sma && m5Price > m5Sma;
    const crossedBelow = m5PrevPrice >= m5Sma && m5Price < m5Sma;

    if (h4Bullish && h1Bullish && crossedAbove) {
      const recentLow = Math.min(...m5Data.slice(-10).map(b => b.low));
      const stopDistance = m5Price - recentLow;

      return {
        symbol,
        action: 'buy',
        price: m5Price,
        stopLoss: recentLow,
        takeProfit: m5Price + (stopDistance * this.params.riskRewardRatio),
        reason: 'Three Ducks aligned bullish - 5M crossed above SMA'
      };
    }

    if (!h4Bullish && !h1Bullish && crossedBelow) {
      const recentHigh = Math.max(...m5Data.slice(-10).map(b => b.high));
      const stopDistance = recentHigh - m5Price;

      return {
        symbol,
        action: 'sell',
        price: m5Price,
        stopLoss: recentHigh,
        takeProfit: m5Price - (stopDistance * this.params.riskRewardRatio),
        reason: 'Three Ducks aligned bearish - 5M crossed below SMA'
      };
    }

    return null;
  }

  private calculateSMA(bars: Bar[], period: number): number {
    const recent = bars.slice(-period);
    return recent.reduce((sum, b) => sum + b.close, 0) / period;
  }
}
```

---

## Best Conditions

### When Three Ducks Works Well

- **Clear trending markets** - EUR/USD, GBP/USD in strong moves
- **Session overlaps** - London/NY (13:00-17:00 GMT)
- **After range breakouts** - Momentum carries through
- **Low news environment** - No conflicting catalysts

### When Three Ducks Fails

- **Range-bound markets** - SMAs get chopped through
- **News events** - Volatility causes whipsaws
- **Weekend gaps** - Can invalidate alignment
- **Asian session** - Low liquidity, false signals

---

## Forex Pairs

### Primary (Best Results)

- **GBP/USD** - Volatile, clear trends
- **EUR/USD** - Most liquid, smooth trends
- **USD/JPY** - Good during Asian/US overlap

### Secondary

- **AUD/USD** - Commodity-driven trends
- **EUR/GBP** - Cross pair, ranging often
- **GBP/JPY** - Very volatile, wider stops needed

---

## Session Filters

```typescript
// Only trade during active sessions
function isActiveSession(): boolean {
  const hour = new Date().getUTCHours();

  // London: 08:00-17:00 GMT
  // New York: 13:00-22:00 GMT
  // Overlap: 13:00-17:00 GMT (best)

  return hour >= 8 && hour <= 22;
}
```

---

## Stop Loss Placement

### Method 1: Recent Swing

```typescript
// Long: Stop below recent 5M swing low
const recentLows = m5Data.slice(-10).map(b => b.low);
const stopLoss = Math.min(...recentLows) - (spread * 2);

// Short: Stop above recent 5M swing high
const recentHighs = m5Data.slice(-10).map(b => b.high);
const stopLoss = Math.max(...recentHighs) + (spread * 2);
```

### Method 2: ATR-Based

```typescript
const atr = calculateATR(m5Data, 14);
const stopLoss = entryPrice - (atr * 2);  // For long
```

### Method 3: SMA-Based

```typescript
// Stop just beyond the 5M SMA
const stopLoss = m5Sma - (spread * 3);  // For long
```

---

## Take Profit Strategies

### Fixed Risk/Reward

```typescript
const target = entry + (stopDistance * 2.5);
```

### Next S/R Level

```typescript
const nextResistance = findNextResistance(h1Data);
const target = nextResistance;
```

### Trail with SMA

```typescript
// Exit when price crosses back below 5M SMA
if (position.side === 'long' && currentPrice < m5Sma) {
  closePosition();
}
```

---

## Position Management

### Scaling In

Add to winning positions when 1H pulls back to SMA:

```typescript
if (inPosition && h1Price touches h1Sma && trendStillValid) {
  addToPosition(originalSize * 0.5);
}
```

### Partial Profits

```typescript
// Take 50% at 1R, let rest run
if (pnlRatio >= 1.0 && !tookPartial) {
  closePartial(0.5);
  moveStopToBreakeven();
}
```

---

## Performance Expectations

### Historical (GBP/USD)

| Metric | Value |
|--------|-------|
| Win Rate | 50-60% |
| Avg Win | 2.5x risk |
| Avg Loss | 1x risk |
| Profit Factor | 1.8-2.5 |
| Best Pairs | GBP/USD, EUR/USD |
| Best Session | London/NY overlap |

---

## Agent Usage

### Sterling FX

[[Sterling FX]] uses Three Ducks as primary strategy.

### Configuration

```python
# In sterling_fx_engine.py
three_ducks_config = {
    'sma_period': 60,
    'risk_reward': 2.5,
    'session_filter': True,
    'pairs': ['GBP/USD', 'EUR/USD']
}
```

---

## Backtesting

```bash
python scripts/universal_backtest.py \
  --strategy ThreeDucks \
  --symbol GBPUSD \
  --start 2025-01-01 \
  --end 2026-03-01
```

---

## Related Pages

- [[Sterling FX]] - Agent using Three Ducks
- [[Strategies Overview]] - All strategies
- [[Support Resistance]] - Alternative forex strategy
- [[Universal Backtest]] - Testing framework
