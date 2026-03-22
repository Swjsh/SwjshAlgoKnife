# Risk Management

---
tags: #risk #trading #core
status: 📘 Reference
---

## Overview

Risk management is the system that protects capital by:
- Sizing positions appropriately
- Limiting daily losses
- Providing emergency stop mechanisms
- Detecting dangerous market conditions

**Key Files**:
- `src/lib/engine/risk.ts` - Position sizing
- `src/lib/engine/risk/KillSwitch.ts` - Emergency halt
- `src/lib/engine/risk/RiskEngine.ts` - Comprehensive risk checks
- `src/lib/engine/risk/RegimeDetector.ts` - Market condition analysis

---

## Position Sizing

**File**: `src/lib/engine/risk.ts`

### Fixed Percentage Risk

The primary method: risk a fixed percentage of account on each trade.

```typescript
function calculatePositionSize(
  accountBalance: number,
  riskPercentage: number,  // e.g., 1 = 1%
  entryPrice: number,
  stopLossPrice: number
): number {
  // Amount willing to risk
  const riskAmount = accountBalance * (riskPercentage / 100);

  // Risk per unit (share/contract)
  const riskPerUnit = Math.abs(entryPrice - stopLossPrice);

  // Position size
  const size = Math.floor(riskAmount / riskPerUnit);

  return size;
}
```

### Example Calculation

```
Account Balance: $10,000
Risk Per Trade: 1% ($100)
Entry Price: $5,850 (ES futures)
Stop Loss: $5,840 (10 points away)

Risk Per Contract: $10 × $50/point = $500
Position Size: $100 / $500 = 0.2 contracts

Result: Cannot take this trade (size < 1 contract)
        OR adjust stop to 2 points: $100 / $100 = 1 contract
```

---

### Kelly Criterion (Advanced)

Optimal position sizing based on win rate and payoff ratio:

```typescript
function kellySize(
  winRate: number,      // Historical win rate (0-1)
  avgWin: number,       // Average winning trade $
  avgLoss: number,      // Average losing trade $
  accountBalance: number
): number {
  const payoffRatio = avgWin / Math.abs(avgLoss);
  const kelly = winRate - ((1 - winRate) / payoffRatio);

  // Use fractional Kelly (25-50%) for safety
  const fractionalKelly = kelly * 0.25;

  return accountBalance * Math.max(0, fractionalKelly);
}
```

---

## Kill Switch

**File**: `src/lib/engine/risk/KillSwitch.ts`

Emergency mechanism to halt all trading immediately.

### Triggers

1. **Manual Activation** - Via UI or [[LLM Control API]]
2. **Daily Loss Threshold** - Auto-triggers at configurable loss limit
3. **Consecutive Losses** - Too many losing trades in a row
4. **Volatility Spike** - Abnormal market conditions detected

### Implementation

```typescript
class KillSwitch {
  private isActive: boolean = false;

  async check(): Promise<boolean> {
    // Check if manually activated
    const setting = await db.get('kill_switch_active');
    if (setting === 'true') {
      this.isActive = true;
      return true;
    }

    // Check daily loss threshold
    const dailyPnL = await this.getDailyPnL();
    const maxLoss = await this.getSetting('max_daily_loss_pct');
    const balance = await this.getAccountBalance();

    if (dailyPnL < -(balance * maxLoss / 100)) {
      await this.activate('Daily loss limit exceeded');
      return true;
    }

    // Check consecutive losses
    const recentTrades = await this.getRecentTrades(10);
    const consecutiveLosses = this.countConsecutiveLosses(recentTrades);

    if (consecutiveLosses >= 5) {
      await this.activate('5 consecutive losing trades');
      return true;
    }

    return false;
  }

  async activate(reason: string): Promise<void> {
    this.isActive = true;
    await db.set('kill_switch_active', 'true');
    await db.set('kill_switch_reason', reason);
    await db.set('kill_switch_time', new Date().toISOString());

    // Notify all agents
    await this.broadcastHalt();

    // Log event
    console.error(`[KILL SWITCH] Activated: ${reason}`);
  }

  async reset(): Promise<void> {
    this.isActive = false;
    await db.set('kill_switch_active', 'false');
    console.log('[KILL SWITCH] Deactivated');
  }
}
```

### Dashboard Integration

When kill switch is active:
- Red warning banner appears on all pages
- Agent cards show "HALTED" status
- New trade attempts are blocked
- Reset button available in Settings

---

## Daily Loss Limits

### Configuration

```env
MAX_DAILY_LOSS_PCT=3        # Stop trading after 3% daily loss
MAX_DAILY_LOSS_ABSOLUTE=500 # Or after $500 loss (whichever first)
```

### Enforcement

```typescript
async function canTrade(): Promise<{ allowed: boolean; reason?: string }> {
  const dailyPnL = await getDailyPnL();
  const balance = await getAccountBalance();

  const maxPctLoss = parseFloat(process.env.MAX_DAILY_LOSS_PCT || '3');
  const maxAbsLoss = parseFloat(process.env.MAX_DAILY_LOSS_ABSOLUTE || '500');

  const pctLoss = (dailyPnL / balance) * 100;

  if (pctLoss <= -maxPctLoss) {
    return { allowed: false, reason: `Daily loss limit reached (${pctLoss.toFixed(1)}%)` };
  }

  if (dailyPnL <= -maxAbsLoss) {
    return { allowed: false, reason: `Daily loss limit reached ($${Math.abs(dailyPnL)})` };
  }

  return { allowed: true };
}
```

---

## Maximum Position Limits

### Per-Symbol Limits

```typescript
const POSITION_LIMITS = {
  'ES': { maxContracts: 5, maxNotional: 50000 },
  'NQ': { maxContracts: 3, maxNotional: 100000 },
  'BTC': { maxUnits: 1.0, maxNotional: 70000 },
  'SPY': { maxShares: 500, maxNotional: 250000 },
};

function checkPositionLimit(symbol: string, requestedSize: number, price: number): boolean {
  const limits = POSITION_LIMITS[symbol];
  if (!limits) return true; // No limit defined

  const currentPosition = getPosition(symbol);
  const newTotal = (currentPosition?.size || 0) + requestedSize;
  const notional = newTotal * price;

  if (limits.maxContracts && newTotal > limits.maxContracts) {
    return false;
  }

  if (limits.maxNotional && notional > limits.maxNotional) {
    return false;
  }

  return true;
}
```

### Portfolio-Wide Limits

```typescript
const PORTFOLIO_LIMITS = {
  maxTotalPositions: 10,       // No more than 10 open positions
  maxTotalNotional: 500000,    // $500k total exposure
  maxSinglePosition: 0.20,     // No position > 20% of portfolio
  maxCorrelatedExposure: 0.50, // No more than 50% in correlated assets
};
```

---

## Regime Detection

**File**: `src/lib/engine/risk/RegimeDetector.ts`

Identifies market conditions that may require adjusted risk:

### Market Regimes

| Regime | Characteristics | Risk Adjustment |
|--------|----------------|-----------------|
| **Trending** | Strong directional moves, low chop | Normal sizing |
| **Range-bound** | Price oscillating between levels | Reduce size, tighter stops |
| **High Volatility** | VIX > 25, large candles | Reduce size 50% |
| **Low Volatility** | VIX < 12, compression | Normal or increase |
| **News Event** | FOMC, earnings, etc. | Close positions or avoid |

### Implementation

```typescript
class RegimeDetector {
  async detect(symbol: string): Promise<MarketRegime> {
    const vix = await this.getVIX();
    const atr = await this.calculateATR(symbol, 14);
    const atrPercentile = await this.getATRPercentile(symbol, atr);

    // High volatility regime
    if (vix > 25 || atrPercentile > 90) {
      return {
        regime: 'high_volatility',
        riskMultiplier: 0.5,  // Half normal size
        message: 'High volatility detected - reducing position sizes'
      };
    }

    // Choppy/range-bound
    const adx = await this.calculateADX(symbol, 14);
    if (adx < 20) {
      return {
        regime: 'range_bound',
        riskMultiplier: 0.75,
        message: 'Choppy market - using tighter stops'
      };
    }

    // Trending
    if (adx > 40) {
      return {
        regime: 'trending',
        riskMultiplier: 1.0,
        message: 'Strong trend - normal sizing'
      };
    }

    return {
      regime: 'normal',
      riskMultiplier: 1.0,
      message: 'Normal market conditions'
    };
  }
}
```

---

## Risk Engine

**File**: `src/lib/engine/risk/RiskEngine.ts`

Combines all risk checks into a single validation pipeline:

```typescript
class RiskEngine {
  private killSwitch: KillSwitch;
  private regimeDetector: RegimeDetector;

  async validateTrade(signal: Signal): Promise<RiskValidation> {
    const checks: RiskCheck[] = [];

    // 1. Kill switch
    if (await this.killSwitch.isActive()) {
      return { approved: false, reason: 'Kill switch is active' };
    }

    // 2. Daily loss limit
    const dailyCheck = await this.checkDailyLoss();
    checks.push(dailyCheck);

    // 3. Position limits
    const positionCheck = await this.checkPositionLimits(signal);
    checks.push(positionCheck);

    // 4. Market regime
    const regime = await this.regimeDetector.detect(signal.symbol);
    checks.push({
      name: 'regime',
      passed: true,
      adjustment: regime.riskMultiplier
    });

    // 5. Correlation check
    const correlationCheck = await this.checkCorrelation(signal);
    checks.push(correlationCheck);

    // Aggregate results
    const failed = checks.filter(c => !c.passed);
    if (failed.length > 0) {
      return {
        approved: false,
        reason: failed.map(f => f.reason).join('; '),
        checks
      };
    }

    // Calculate adjusted size
    const baseSize = this.calculateBaseSize(signal);
    const adjustedSize = baseSize * regime.riskMultiplier;

    return {
      approved: true,
      adjustedSize: Math.floor(adjustedSize),
      regime: regime.regime,
      checks
    };
  }
}
```

---

## Risk Dashboard

Navigate to `/settings` → Risk Management section:

### Visible Metrics
- Current daily P&L and limit status
- Open position count vs limit
- Kill switch status
- Market regime indicator
- Risk per trade setting

### Configurable Settings
- Max daily loss percentage
- Max daily loss absolute
- Risk per trade percentage
- Max positions
- Auto kill switch thresholds

---

## Best Practices

### 1. Never Risk More Than 1-2% Per Trade
```
Account: $10,000
Max risk per trade: $100-200
```

### 2. Set Daily Loss Limits
```
Stop trading after losing 3% daily
Reset the next trading day
```

### 3. Reduce Size in Volatile Markets
```
VIX > 25: Half normal size
VIX > 35: Quarter size or flat
```

### 4. Use Correlated Position Limits
```
Don't be long ES, NQ, and SPY simultaneously
(They're all correlated to S&P 500)
```

### 5. Keep Kill Switch Accessible
```
Manual activation should be one click away
LLM command: { "command": "killswitch" }
```

---

## Emergency Procedures

### Market Flash Crash
1. Kill switch activates automatically (volatility spike)
2. Do NOT attempt to close positions immediately (spreads will be wide)
3. Wait for conditions to normalize
4. Review positions and exit systematically

### System Failure
1. Kill switch prevents new trades
2. Log into broker directly to manage positions
3. Close positions manually if needed
4. Do not restart agents until issue is resolved

### Account Drawdown
1. At -5% daily: Review all positions
2. At -10% daily: Close all positions, stop trading
3. At -20% total: Full strategy review before resuming

---

## Related Pages

- [[Kill Switch]] - Emergency halt details
- [[Trade Execution]] - How trades are placed
- [[Agent System]] - How agents use risk rules
- [[Troubleshooting]] - Risk-related issues
- [[LLM Control API]] - Remote kill switch activation
