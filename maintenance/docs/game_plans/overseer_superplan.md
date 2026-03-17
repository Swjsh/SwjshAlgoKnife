# The Overseer SuperPlan: Full System Survival Overhaul

**Version**: 2.0 (Comprehensive)
**Date**: 2026-01-01
**Priority**: MAXIMUM - All trading must be halted until implementation complete.

---

## 📋 Table of Contents
1.  [Executive Summary](#executive-summary)
2.  [Gap Analysis (Extended)](#gap-analysis-extended)
3.  [Implementation Phases](#implementation-phases)
4.  [Overseer Agent Integration](#overseer-agent-integration)
5.  [Documentation Requirements](#documentation-requirements)
6.  [Verification Criteria](#verification-criteria)

---

## Executive Summary

The current system violates **ALL FOUR** levels of The Overseer's Survival Hierarchy. This SuperPlan provides a detailed remediation path to bring the system into compliance before any real capital is risked.

**Key Deliverables:**
1.  `RiskEngine.ts` - Gatekeeper for all trade signals
2.  `FrictionSimulator.ts` - Injects realistic slippage, fees, latency
3.  `RegimeDetector.ts` - Volatility-based market state classifier
4.  `KillSwitch.ts` - Emergency halt system
5.  `reality_check.md` - Living failure log document

---

## Gap Analysis (Extended)

### Previously Identified Gaps
| Gap | Overseer Requirement | Status |
|-----|---------------------|--------|
| No Risk Engine | Level 1: Survival | ❌ MISSING |
| No Friction Model | Level 2: Friction Reality | ❌ MISSING |
| No Regime Detection | Level 3: Market Awareness | ❌ MISSING |
| No Kill Switch | Operational Mandate #2 | ❌ MISSING |

### **NEW** Additional Gaps (Deep Dive)
| Gap | Overseer Requirement | Status |
|-----|---------------------|--------|
| No API Disconnect Handling | Level 2: "Network jitter and API failures are features" | ❌ MISSING |
| No `reality_check.md` Logging | Implementation Requirement | ❌ MISSING |
| No News Event Calendar | Kill Switch Protocol: "Force Cash during high-volatility news" | ❌ MISSING |
| No Curve-Fitting Detection | Smoke & Mirrors Test: "Is this curve-fitted to the past?" | ❌ MISSING |
| No Position Correlation Check | Level 1: Prevents Long EURUSD + Long GBPUSD | ❌ MISSING |
| No Hard Stop Enforcement | Level 1: "Hard stops are non-negotiable" | ⚠️ PARTIAL (SL exists but not independent) |
| No Max Concurrent Trades Limit | Level 1: Exposure control | ❌ MISSING |

---

## Implementation Phases

### Phase 0: Foundation (Immediate - 30 mins)
Create the file structure and stub all modules.

**Files to Create:**
- `src/lib/engine/risk/RiskEngine.ts`
- `src/lib/engine/risk/FrictionSimulator.ts`
- `src/lib/engine/risk/RegimeDetector.ts`
- `src/lib/engine/risk/KillSwitch.ts`
- `docs/reality_check.md`

---

### Phase 1: Risk Engine (CRITICAL - 1 hour)

**File**: `src/lib/engine/risk/RiskEngine.ts`

**Interface:**
```typescript
interface RiskConfig {
    maxDailyLossPct: number;      // e.g., 2% = 0.02
    maxRiskPerTradePct: number;   // e.g., 1% = 0.01
    maxConcurrentTrades: number;  // e.g., 3
    maxCorrelatedExposure: number; // e.g., 2 (max 2 trades on correlated pairs)
}

class RiskEngine {
    static canOpenTrade(agentId: string, proposedTrade: Trade): { allowed: boolean, reason: string };
    static calculatePositionSize(balance: number, stopLossPips: number): number;
    static checkCorrelation(activeTrades: Trade[], proposedPair: string): boolean;
    static getDailyPnL(agentId: string): number;
}
```

**Logic:**
1.  `canOpenTrade`:
    - Check if agent is KILLED (Kill Switch).
    - Check if Daily Loss exceeds `maxDailyLossPct`.
    - Check if concurrent trades exceed `maxConcurrentTrades`.
    - Check if correlated exposure exceeds limit.
2.  `calculatePositionSize`:
    - Use Kelly Criterion or fixed 1% Risk formula.
    - Return lot size, not dollar amount.
3.  `checkCorrelation`:
    - Define correlation groups: `['EURUSD', 'GBPUSD']`, `['USDJPY', 'USDCAD']`.
    - If 2 trades already open in same group, deny.

---

### Phase 2: Friction Simulator (CRITICAL - 45 mins)

**File**: `src/lib/engine/risk/FrictionSimulator.ts`

**Interface:**
```typescript
interface FrictionConfig {
    avgSlippagePips: number;      // e.g., 0.3
    maxSlippagePips: number;      // e.g., 2.0
    commissionPerLot: number;     // e.g., $7.00
    spreadPips: number;           // e.g., 1.2 for EUR/USD
    latencyMs: number;            // e.g., 50-200ms
}

class FrictionSimulator {
    static applySlippage(idealPrice: number, side: 'LONG' | 'SHORT'): number;
    static calculateNetPnL(grossPnL: number, lotSize: number): number;
    static simulateLatency(): Promise<void>;
}
```

**Logic:**
1.  `applySlippage`:
    - Add random `0 to maxSlippagePips` against the trade direction.
    - Long → Entry slips UP, Short → Entry slips DOWN.
2.  `calculateNetPnL`:
    - `netPnL = grossPnL - (commissionPerLot * lotSize) - (spreadPips * pipValue * lotSize)`.
3.  `simulateLatency`:
    - `await new Promise(r => setTimeout(r, random(50, 200)))`.
    - Call this BEFORE executing any trade.

---

### Phase 3: Regime Detector (HIGH - 30 mins)

**File**: `src/lib/engine/risk/RegimeDetector.ts`

**Interface:**
```typescript
type MarketRegime = 'TRENDING' | 'RANGING' | 'VOLATILE' | 'DEAD' | 'UNKNOWN';

class RegimeDetector {
    static classifyRegime(ticker: string, recentPrices: number[]): MarketRegime;
    static shouldTradeInRegime(regime: MarketRegime, strategyType: string): boolean;
}
```

**Logic:**
1.  `classifyRegime`:
    - Calculate ATR (Average True Range) over last 20 data points.
    - Calculate RSI or ADX.
    - If ATR < threshold && RSI ~50 → `DEAD`.
    - If ATR > threshold && trend clear → `TRENDING`.
    - If ATR > threshold && no trend → `VOLATILE`.
2.  `shouldTradeInRegime`:
    - Impulse strategies should NOT trade in `DEAD` or `RANGING`.
    - Mean-reversion should NOT trade in `TRENDING`.
    - Return `false` if mismatch.

---

### Phase 4: Kill Switch (CRITICAL - 20 mins)

**File**: `src/lib/engine/risk/KillSwitch.ts`

**Interface:**
```typescript
interface KillSwitchState {
    isActive: boolean;
    triggeredAt: string | null;
    reason: string | null;
}

class KillSwitch {
    static trigger(agentId: string, reason: string): void;
    static isTriggered(agentId: string): boolean;
    static reset(agentId: string): void;
    static getState(): KillSwitchState;
}
```

**Logic:**
1.  `trigger`:
    - Set `db[agentId].status = 'KILLED'`.
    - Log reason to `db[agentId].killSwitchLog`.
    - Force-close all `active_trades` for that agent at market.
2.  Integration:
    - Check `RiskEngine.canOpenTrade` → it calls `KillSwitch.isTriggered` internally.
    - In `agent_runner.ts`, check Kill Switch BEFORE processing any signal.

---

### Phase 5: Integration into `agent_runner.ts` (1 hour)

**Modifications:**

1.  **Before Zone Entry**:
    ```typescript
    if (!RiskEngine.canOpenTrade('fx', proposedTrade)) {
        console.log('🛡️ [RISK] Trade DENIED:', reason);
        return;
    }
    ```

2.  **On Signal Price**:
    ```typescript
    const slippedEntry = FrictionSimulator.applySlippage(signal.price, signal.side);
    ```

3.  **On Trade Close**:
    ```typescript
    const netPnL = FrictionSimulator.calculateNetPnL(grossPnL, lotSize);
    ```

4.  **Daily Reset Loop**:
    ```typescript
    // At midnight EST, reset daily PnL trackers
    ```

---

## Overseer Agent Integration

The Overseer is no longer just a philosophical document. It becomes an active agent.

**File**: `scripts/overseer_agent.ts`

**Responsibilities:**
1.  **Continuous Audit**: Runs every 60 seconds.
2.  **Checks**:
    - Daily PnL across all agents → Trigger Kill Switch if limit hit.
    - Open trade count → Warn if approaching max.
    - Friction logging → Ensure all trades have fee deductions logged.
    - Regime mismatch → Flag if agent traded in wrong regime.
3.  **Output**:
    - Writes to `db.overseer.audit_log`.
    - Emits warnings to terminal: `⚠️ [OVERSEER] Boba is trading in DEAD market regime!`
4.  **Authority**:
    - CAN call `KillSwitch.trigger()` on any agent.
    - CAN pause all trading system-wide with `GLOBAL_HALT`.

---

## Documentation Requirements

### 1. `reality_check.md` (Living Document)

**Location**: `docs/reality_check.md`

**Purpose**: Log every trade failure cause.

**Template:**
```markdown
# Reality Check Log

## Trade Failure Analysis

| Date | Agent | Ticker | Expected PnL | Actual PnL | Gap | Cause |
|------|-------|--------|--------------|------------|-----|-------|
| 2026-01-01 | Sterling | EURUSD | +$45 | +$32 | -$13 | Slippage + Commission |
```

**Automation**: `agent_runner.ts` should append to this file on every trade close.

---

### 2. `risk_parameters.md` (Config Doc)

**Location**: `docs/risk_parameters.md`

**Purpose**: Central source of truth for all risk settings.

**Contents:**
- Max Daily Loss %
- Max Risk Per Trade %
- Max Concurrent Trades
- Correlation Groups
- Friction Assumptions (Spread, Commission, Slippage)

---

## Verification Criteria

The system is compliant when:

| Criterion | Test Method | Pass Condition |
|-----------|-------------|----------------|
| Risk Engine Blocks | Create trade while at max exposure | Trade DENIED |
| Kill Switch Triggers | Set daily PnL to -3% | Agent status = KILLED |
| Friction Applied | Close a trade | Net PnL < Gross PnL |
| Regime Detection | Feed flat prices | Regime = DEAD, no signals |
| Reality Check Logged | Close any trade | Entry in `reality_check.md` |
| Overseer Audit Runs | Wait 60 seconds | Audit log updated |

---

> **The Overseer's Final Word:**
> "I don't care if you have the best entry in the world. If you can't survive a string of losses, you're just another gambler with a fancy dashboard."
