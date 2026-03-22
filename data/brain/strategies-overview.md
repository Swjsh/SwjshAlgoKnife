# Strategies Overview

---
tags: #strategies #trading
status: 📘 Reference
---

## Active Strategies

SwjshAK implements **12 trading strategies** across multiple asset classes.

| Strategy | Markets | Type | Status |
|----------|---------|------|--------|
| [[ORB]] | Futures, Stocks | Breakout | ✅ Active |
| [[Never Stopped Out]] | Futures | Advanced ORB | ✅ Active |
| [[VWAP Reversion]] | All | Mean Reversion | ✅ Active |
| [[Support Resistance]] | All | Zone Trading | ✅ Active |
| [[Bollinger Breakout]] | All | Volatility | ✅ Active |
| [[Three Ducks]] | Forex | Trend Following | ✅ Active |
| [[Grid Trading]] | Crypto | Range Bound | ✅ Active |
| [[EMA Crossover ADX]] | Futures | Trend Following | ✅ Active |
| [[Liquidity Scalper]] | Futures | Scalping | ✅ Active |
| [[RSI Mean Reversion]] | Crypto | Mean Reversion | ✅ Active |
| [[Set and Forget]] | Forex | Swing Trading | ✅ Active |
| [[Pivot Strategy]] | Futures | Level Trading | ✅ Active |

---

## Strategy Base Class

**Location**: `src/lib/engine/types.ts`

All strategies extend this interface:

```typescript
interface BaseStrategy {
  name: string;
  description: string;
  category: 'OPTIONS' | 'CRYPTO' | 'FOREX' | 'FUTURES';

  // Candle-based evaluation (1m, 5m, 15m, etc.)
  onCandle(bar: Bar): Signal | null;

  // Tick-based evaluation (real-time price updates)
  onTick(tick: Tick): Signal | null;
}

interface Signal {
  symbol: string;
  action: 'buy' | 'sell' | 'close';
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  size?: number;
  reason: string;  // Why this signal was generated
}
```

---

## 1. Opening Range Breakout (ORB)

**File**: `src/lib/engine/strategies/orb.ts`

**Markets**: Futures (ES, NQ, YM), Stocks

**Logic**:
1. Identify first 15 minutes of trading session
2. Mark high and low of opening range
3. Enter long on breakout above high (with volume confirmation)
4. Enter short on breakdown below low
5. Stop-loss: Opposite side of range
6. Target: 2x range size

**Parameters**:
- `openingRangeMinutes`: 15 (default)
- `volumeThreshold`: 1.5x average
- `riskRewardRatio`: 2.0

**Best For**:
- High volatility markets
- Session opens with clear direction
- Trending days

**Avoid**:
- Low volume days
- Choppy/range-bound markets
- FOMC/news events (unless adapted)

---

## 2. Never Stopped Out

**File**: `src/lib/engine/strategies/neverStoppedOut.ts`

**Markets**: Futures

**Logic**:
Advanced ORB variant with:
1. Wider range detection (30-60 minutes)
2. Higher timeframe bias confirmation (1H, 4H)
3. No fixed stop-loss (uses time-based exits instead)
4. Pyramiding on continued momentum

**Parameters**:
- `rangeMinutes`: 60
- `htfTimeframe`: '1H'
- `pyramidLevels`: 3
- `maxHoldTime`: 240 minutes

**Best For**:
- Strong trending days
- Established higher timeframe bias
- Experienced traders (complex logic)

**Risk**: No hard stop can lead to large drawdowns

---

## 3. VWAP Reversion

**File**: `src/lib/engine/strategies/vwapReversion.ts`

**Markets**: All (Stocks, Futures, Crypto, Forex)

**Logic**:
1. Calculate VWAP (volume-weighted average price)
2. Detect price deviation from VWAP (e.g., 0.5%)
3. Enter mean reversion trade expecting return to VWAP
4. Stop-loss: 2x deviation on opposite side
5. Target: VWAP or slight overshoot

**Parameters**:
- `deviationThreshold`: 0.005 (0.5%)
- `stopLossMultiplier`: 2.0
- `targetOvershoot`: 0.002 (0.2% past VWAP)

**Best For**:
- Range-bound markets
- High liquidity instruments
- Intraday trading

**Avoid**:
- Strong trending days (VWAP becomes irrelevant)
- Low volume instruments

---

## 4. Support/Resistance

**File**: `src/lib/engine/strategies/suppRes.ts`

**Markets**: All

**Logic**:
1. Identify key support/resistance zones (swing highs/lows)
2. Wait for price to approach zone
3. Look for rejection signals (pin bar, engulfing candle)
4. Enter in direction of rejection
5. Stop-loss: Beyond zone (20-30 pips)
6. Target: Next S/R zone

**Parameters**:
- `zoneThickness`: 0.003 (0.3% price range)
- `rejectionCandleMinWick`: 0.6 (60% of candle is wick)
- `minTouches`: 2 (zone must be tested twice to be valid)

**Best For**:
- All market conditions
- Swing trading
- Clear chart structure

**Avoid**:
- Freshly broken zones (wait for retest)
- News-driven spikes

---

## 5. Bollinger Band Breakout

**File**: `src/lib/engine/strategies/bbBreakout.ts`

**Markets**: All (especially Crypto, Stocks)

**Logic**:
1. Calculate Bollinger Bands (20-period SMA ± 2 std dev)
2. Detect "squeeze" (low volatility, bands narrowing)
3. Enter on breakout of upper/lower band with volume
4. Stop-loss: Middle band (SMA)
5. Target: Projected band expansion

**Parameters**:
- `period`: 20
- `stdDev`: 2.0
- `squeezeThreshold`: 0.02 (band width < 2% of price)
- `breakoutVolumeMultiplier`: 1.5x

**Best For**:
- Anticipating volatility expansion
- Earnings plays (stocks)
- Crypto breakouts

**Avoid**:
- Continued squeezes (wait for expansion)
- Fake breakouts (need volume confirmation)

---

## 6. Three Ducks

**File**: `src/lib/engine/strategies/threeDucks.ts`

**Markets**: Forex

**Logic**:
Multi-timeframe trend alignment:
1. **4H chart**: SMA(60) direction = overall trend
2. **1H chart**: SMA(60) must align with 4H
3. **5M chart**: SMA(60) must align with 1H
4. Enter on 5M candle close in trend direction
5. Stop-loss: Below/above recent swing
6. Target: 2-3x risk

**Parameters**:
- `htfPeriod`: 60
- `mtfPeriod`: 60
- `ltfPeriod`: 60
- `riskRewardRatio`: 2.5

**Best For**:
- Trending forex pairs (EUR/USD, GBP/USD)
- Daily session alignment
- High probability setups

**Avoid**:
- Range-bound markets
- Conflicting timeframe signals

---

## 7. Grid Trading

**File**: `src/lib/engine/strategies/gridTrading.ts`

**Markets**: Crypto

**Logic**:
1. Track price from last grid level
2. Price drops by grid size → BUY
3. Price rises by grid size → SELL
4. Reset grid level after each trade

**Parameters**:
- `gridSize`: 0.5% (price move to trigger)

**Best For**: Range-bound crypto markets

See: [[Grid Trading]] for full details

---

## Strategy Selection Guide

### By Market Condition

| Condition | Best Strategies |
|-----------|----------------|
| **Strong Trend** | Three Ducks, ORB, Never Stopped Out |
| **Range-Bound** | VWAP Reversion, Support/Resistance, Grid |
| **High Volatility** | Bollinger Breakout, ORB |
| **Low Volatility** | Grid, Support/Resistance |
| **Session Open** | ORB, Never Stopped Out |
| **Mid-Session** | VWAP Reversion, Support/Resistance |

---

### By Asset Class

| Asset | Recommended Strategies |
|-------|----------------------|
| **Futures (ES, NQ)** | ORB, Never Stopped Out, VWAP |
| **Forex** | Three Ducks, Support/Resistance |
| **Crypto** | Bollinger Breakout, Grid, VWAP |
| **Options** | Support/Resistance, VWAP (on underlying) |
| **Stocks** | ORB, Bollinger Breakout, Support/Resistance |

---

## Adding a New Strategy

### 1. Create Strategy File

```typescript
// src/lib/engine/strategies/myStrategy.ts

import { BaseStrategy, Bar, Tick, Signal } from '../types';

export class MyStrategy implements BaseStrategy {
  name = 'My Strategy';
  description = 'Description of what this strategy does';
  category = 'FUTURES';

  onCandle(bar: Bar): Signal | null {
    // Analyze bar and return signal if conditions met
    if (/* entry condition */) {
      return {
        symbol: bar.symbol,
        action: 'buy',
        price: bar.close,
        stopLoss: bar.close * 0.99,
        takeProfit: bar.close * 1.02,
        reason: 'Strategy entry condition met'
      };
    }

    return null;
  }

  onTick(tick: Tick): Signal | null {
    // Optional: real-time tick evaluation
    return null;
  }
}
```

---

### 2. Register in Strategy Manager

```typescript
// src/lib/engine/manager.ts

import { MyStrategy } from './strategies/myStrategy';

export class EngineManager {
  private strategies: BaseStrategy[] = [
    new ORBStrategy(),
    new VWAPReversion(),
    new MyStrategy(),  // Add here
    // ...
  ];
}
```

---

### 3. Backtest Before Live

```bash
# Use universal backtest harness
python scripts/universal_backtest.py \
  --strategy MyStrategy \
  --symbol ES \
  --start 2025-01-01 \
  --end 2026-03-01
```

---

## Performance Tracking

### Metrics (Per Strategy)

Track in database or `agents_db.json`:
- Total trades
- Win rate
- Average win/loss
- Profit factor
- Max drawdown
- Sharpe ratio

### Example Query

```sql
-- Strategy performance breakdown
SELECT
  strategy,
  COUNT(*) as trades,
  SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as win_rate,
  AVG(CASE WHEN pnl > 0 THEN pnl END) as avg_win,
  AVG(CASE WHEN pnl < 0 THEN pnl END) as avg_loss,
  SUM(pnl) as total_pnl
FROM trades
WHERE exit_time IS NOT NULL
GROUP BY strategy
ORDER BY total_pnl DESC;
```

---

## Related Pages

### Core Strategies
- [[ORB]] - Opening Range Breakout
- [[VWAP Reversion]] - Mean reversion to VWAP
- [[Support Resistance]] - Zone-based trading
- [[Bollinger Breakout]] - Volatility expansion
- [[Three Ducks]] - Multi-timeframe trend
- [[Never Stopped Out]] - Advanced ORB

### New Strategies (March 2026)
- [[EMA Crossover ADX]] - Trend following with ADX filter
- [[Liquidity Scalper]] - Institutional liquidity pools
- [[RSI Mean Reversion]] - RSI extremes with confirmation
- [[Grid Trading]] - Range-bound compounding
- [[Set and Forget]] - Multi-TF swing trading
- [[Pivot Strategy]] - Daily/weekly/monthly pivots

### Agent Variants
- [[Boba Options]] - Real SPY options trading
- [[SPX Sniper Options]] - 0DTE options scalping

### Infrastructure
- [[Agent System]] - How strategies are executed
- [[Risk Management]] - Position sizing
- [[Universal Backtest]] - Testing framework
- [[Intel Layer]] - Trade gating
