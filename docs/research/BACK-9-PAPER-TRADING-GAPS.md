# BACK-9: Paper Trading Activation - Gap Analysis

**Research Date**: 2026-03-21
**Agent**: Scout
**Status**: Research Complete
**Recommendation**: **PROCEED** - All gaps are fixable

---

## Executive Summary

SPX Sniper is paper-ready with the webhook → TradeExecutor → Alpaca pipeline.
Boba needs direct Alpaca integration (currently webhook-only).

**Top 3 Missing Capabilities:**
1. Position State Synchronization with Broker
2. Fill Confirmation and Order Status Tracking
3. Broker Health Check Before Trade Execution

---

## Current State Analysis

### SPX Sniper (`scripts/spx_sniper_engine.py`)

| Capability | Status | Notes |
|------------|--------|-------|
| Market Data | ✅ Working | yfinance 5m SPY candles |
| Signal Generation | ✅ Working | VWAP cross + EMA9 + RSI filter |
| Time Gates | ✅ Working | 10:30-15:50 EST |
| Webhook Execution | ✅ Working | POST to localhost:3000/api/webhook |
| SL/TP in Payload | ✅ Working | Sent with each signal |
| State Persistence | ✅ Partial | `save_agent_state()` saves active trades |
| Position Sync | ❌ Missing | No broker position verification |
| Fill Confirmation | ❌ Missing | Fire-and-forget webhook |
| Health Check | ❌ Missing | No pre-trade Alpaca validation |

**Execution Path**: SPX Sniper → webhook → TradeExecutor (TS) → Alpaca API

### Boba (`scripts/boba_trades_engine.py`)

| Capability | Status | Notes |
|------------|--------|-------|
| Market Data | ✅ Working | yfinance 15m SPY candles |
| Zone Detection | ✅ Working | S&D impulse candle detection |
| Time Gates | ✅ Working | 9:30-11:00 EST entry window |
| Webhook Execution | ✅ Working | Same webhook as SPX Sniper |
| SL/TP in Payload | ✅ Working | -1.5% SL, +3% TP |
| State Persistence | ❌ Missing | No `save_agent_state()` call |
| Position Sync | ❌ Missing | No broker position verification |
| Fill Confirmation | ❌ Missing | Fire-and-forget webhook |
| Health Check | ❌ Missing | No pre-trade Alpaca validation |
| Direct Alpaca | ❌ Missing | Unlike Bitcoin Bob, no direct execution option |

**Execution Path**: Boba → webhook → TradeExecutor (TS) → Alpaca API

### Bitcoin Bob (Reference Implementation)

Bitcoin Bob has **direct Alpaca integration** via `alpaca_executor.py`:
- `USE_DIRECT_ALPACA = True` bypasses webhook entirely
- Direct REST API calls to Alpaca
- Account balance check before trade
- Position management built-in

---

## Gap #1: Position State Synchronization

### Problem
Both agents track trades locally (`active_trades` list) but never verify against actual broker positions. This causes:
- **Orphaned positions** after agent restart
- **Duplicate orders** if agent thinks position doesn't exist
- **Phantom trades** tracked locally but rejected by broker

### Current Code (SPX Sniper line 243-248)
```python
saved = load_agent_state('spx_sniper')
active_trades = saved.get('active_trades', [])
```

### Impact
- After restart, agent may open new position while old position is still open on Alpaca
- Could exceed max position limits
- Risk management bypassed

### Solution
Add position sync at agent startup and before each trade:
```python
# Sync with Alpaca on startup
from alpaca_executor import AlpacaExecutor
executor = AlpacaExecutor()
actual_positions = executor.get_positions()
# Compare with active_trades, reconcile
```

**Effort**: 2 story points (SCRUM ticket required)

---

## Gap #2: Fill Confirmation Loop

### Problem
Agents fire webhook and assume order filled. No confirmation of:
- Order accepted by Alpaca
- Order actually filled (not rejected)
- Fill price vs expected price (slippage)

### Current Code (SPX Sniper line 107-120)
```python
resp = requests.post(WEBHOOK_URL, json=payload, headers=headers, timeout=10)
if resp.status_code == 200:
    print(f"[SPX Sniper] Signal sent: {action}")
    return True  # <-- Assumes filled, but only confirms webhook received!
```

### Impact
- Orders rejected due to insufficient buying power go unnoticed
- Market closed rejections not detected
- No slippage tracking

### Solution: Two Options

**Option A: Polling (simpler)**
After webhook success, poll `/api/signals` endpoint for fill status.

**Option B: Direct Alpaca (recommended)**
Use `alpaca_executor.py` with order status polling:
```python
order = executor.submit_market_order(...)
# Poll for fill
while order['status'] == 'pending_new':
    time.sleep(1)
    order = executor.get_order(order['id'])
if order['status'] != 'filled':
    log_message('spx', f"Order REJECTED: {order['status']}")
```

**Effort**: 3 story points

---

## Gap #3: Broker Health Check

### Problem
No verification that:
- Alpaca API is reachable
- Market is actually open (via Alpaca clock, not local time)
- Account has sufficient buying power
- Account is not restricted

### Current Code (SPX Sniper line 79-82)
```python
def is_safe_time() -> bool:
    now = datetime.now(EST).time()
    return dtime(10, 30) <= now <= dtime(15, 50)  # Local check only
```

### Impact
- Trades attempted during market closure (early close days, holidays)
- Orders fail if account balance depleted by other agent
- Silent failures when API is down

### Solution
Add pre-trade health check:
```python
def pre_trade_check(executor: AlpacaExecutor) -> bool:
    # 1. API connectivity
    if not executor.test_connection():
        return False
    # 2. Market open via Alpaca
    # 3. Account balance check
    account = executor.get_account_info()
    if account['buying_power'] < MIN_BUYING_POWER:
        return False
    return True
```

**Effort**: 2 story points

---

## Additional Gaps (Lower Priority)

### Gap #4: Boba Missing State Persistence
Boba doesn't call `save_agent_state()`, so trades are lost on restart.
**Effort**: 1 story point

### Gap #5: Zone Persistence
Both agents lose identified zones on restart.
**Effort**: 1 story point

### Gap #6: No Direct Alpaca Option for SPX/Boba
Bitcoin Bob has `USE_DIRECT_ALPACA`, but SPX Sniper and Boba are webhook-only.
**Effort**: 3 story points each

---

## Recommendation: PROCEED

All gaps are fixable with existing infrastructure. The `alpaca_executor.py` module provides everything needed.

### Implementation Priority

| Priority | Gap | Effort | Blocker? |
|----------|-----|--------|----------|
| 1 | Position State Sync | 2 SP | Yes - prevents duplicates |
| 2 | Broker Health Check | 2 SP | Yes - prevents failed trades |
| 3 | Fill Confirmation | 3 SP | No - nice to have |
| 4 | Boba State Persistence | 1 SP | No - quick fix |

### SCRUM Tickets to File

1. **SCRUM-XX**: Add position sync to SPX Sniper and Boba
2. **SCRUM-XX**: Add pre-trade health check to Python agents
3. **SCRUM-XX**: Add direct Alpaca execution option to SPX Sniper

---

## Test Plan

After implementation:
1. [ ] Start SPX Sniper, verify Alpaca connection logged
2. [ ] Manually open position on Alpaca, restart agent, verify sync
3. [ ] Attempt trade with insufficient buying power, verify rejection logged
4. [ ] Run during market closed hours, verify no trade attempt
5. [ ] Generate signal, verify fill confirmation logged with price

---

## Files Changed/Reviewed

| File | Purpose |
|------|---------|
| `scripts/spx_sniper_engine.py` | SPX Sniper implementation |
| `scripts/boba_trades_engine.py` | Boba implementation |
| `scripts/alpaca_executor.py` | Direct Alpaca client (reference) |
| `scripts/bitcoin_bob_engine.py` | Bitcoin Bob with direct Alpaca |
| `src/lib/engine/executor.ts` | TradeExecutor TypeScript |
| `src/lib/broker/alpaca.ts` | Alpaca client TypeScript |
| `src/app/api/webhook/tradingview/route.ts` | Webhook endpoint |

---

**Completed**: 2026-03-21T18:45:00Z
**Agent**: Scout
