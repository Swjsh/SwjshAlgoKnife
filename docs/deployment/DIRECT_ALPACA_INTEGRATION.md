# Bitcoin Bob - Direct Alpaca Integration

## Overview

Bitcoin Bob agent now supports **direct Alpaca REST API execution** for real paper trading, eliminating the webhook round-trip through the Next.js executor.

**Execution Paths:**
1. **Direct Alpaca (NEW)**: Bitcoin Bob → AlpacaExecutor → Alpaca REST API → Orders filled
2. **Webhook Fallback**: Bitcoin Bob → Next.js Webhook → TradeExecutor → Alpaca → Orders filled

## Files Modified/Created

### 1. `/scripts/alpaca_executor.py` (NEW)
**Purpose**: Direct REST API client for Alpaca crypto trading

**Key Features:**
- Market order submission (BUY/SELL for BTC/USD, ETH/USD, SOL/USD)
- Position management (get positions, close positions)
- Account info queries (balance, buying power, cash)
- Position sizing algorithms (notional % or stop-loss based)
- Order status checking
- Price fetching from Alpaca's data API
- Proper error handling and logging

**Example Usage:**
```python
from alpaca_executor import AlpacaExecutor

executor = AlpacaExecutor()

# Get account info
account = executor.get_account_info()
print(f"Cash: ${account['cash']:,.2f}")

# Calculate position size (1% risk)
qty = executor.calculate_position_size_from_sl(
    entry_price=72800,
    stop_loss=72000,
    account_balance=account['cash'],
    risk_pct=1.0
)

# Submit market order
order = executor.submit_market_order(
    symbol="BTC/USD",
    qty=qty,
    side="buy",
    time_in_force="gtc"  # Good til cancelled for crypto
)

# Close position
executor.close_position("BTC/USD")
```

**Environment Variables Required:**
```env
APCA_API_KEY_ID=PK33J2RV4PNIY6TCOLUG3WYGRX
APCA_API_SECRET_KEY=FxbJshSbhJ8Rn7KPENssS4eWsLpxCyYeyxavxywV9Bbs
APCA_API_BASE_URL=https://paper-api.alpaca.markets  # Paper, or https://api.alpaca.markets for live
```

### 2. `/scripts/bitcoin_bob_engine.py` (MODIFIED)
**Changes:**
- Added `USE_DIRECT_ALPACA = True` config flag (line ~31)
- Added `alpaca_executor` global instance initialization (line ~50)
- Added `execute_on_alpaca()` function for direct execution
- Modified `fire_signal()` to use direct Alpaca if enabled, webhook fallback if disabled
- Updated docstring to reflect dual execution modes

**Execution Flow (Direct Mode):**
1. Bob scans for S/R zones
2. Zone triggered → `fire_signal()` called
3. `fire_signal()` routes to `execute_on_alpaca()` (if `USE_DIRECT_ALPACA=True`)
4. `execute_on_alpaca()` uses AlpacaExecutor to:
   - Calculate position size (1% risk)
   - Submit market order directly to Alpaca
   - Log trade to terminal and agent_utils
5. Open trades tracked locally in `active_trades` list
6. Exit signals: `execute_on_alpaca()` closes position via Alpaca API

### 3. `/scripts/run_bitcoin_bob.py` (MODIFIED)
**Changes:**
- Added imports for `USE_DIRECT_ALPACA` and `alpaca_executor`
- Added execution mode detection in `main()`
- Prints account info if Alpaca connected
- Shows which mode is active in startup logs

## Configuration

### Enable Direct Alpaca
Edit `/scripts/bitcoin_bob_engine.py` line ~31:
```python
USE_DIRECT_ALPACA = True  # Use Alpaca REST API directly
```

### Switch to Webhook Fallback
Edit `/scripts/bitcoin_bob_engine.py` line ~31:
```python
USE_DIRECT_ALPACA = False  # Use Next.js webhook executor
```

## Testing

### Test Alpaca Executor Independently
```bash
python3 /sessions/trusting-cool-turing/mnt/SwjshAlgoKnife/scripts/alpaca_executor.py
```

**Expected Output:**
```
======================================================================
ALPACA EXECUTOR - DIRECT INTEGRATION TEST
======================================================================

1. Testing connection...
[AlpacaExecutor] ✅ Alpaca connected!
  Account: PA3BP5DZARV2
  Cash: $100,094.85
  Buying Power: $199,526.62
  Portfolio Value: $100,980.15
  Status: ACTIVE

2. Getting account info...
3. Checking open positions...
4. Testing position size calculation...
5. Testing SL-based position sizing...
```

### Test Bitcoin Bob with Direct Alpaca
```bash
cd /sessions/trusting-cool-turing/mnt/SwjshAlgoKnife
python3 scripts/run_bitcoin_bob.py
```

**Expected Output (first few lines):**
```
[Bitcoin Bob] 🔗 EXECUTION MODE: Direct Alpaca REST API
[Bitcoin Bob] Account: PA3BP5DZARV2 | Cash: $100,094.85
[Bitcoin Bob] Starting Crypto S/D Zone Trader...
[Bitcoin Bob] Pairs: BTC-USD, ETH-USD, SOL-USD
[Bitcoin Bob] Max positions: 2
```

## Order Submission Details

### Market Orders
All orders submitted as **market orders** for immediate execution:
- **Symbol Format**: `BTC/USD`, `ETH/USD`, `SOL/USD`
- **Side**: `buy` or `sell`
- **Time in Force**: `gtc` (Good til Cancelled) for crypto
- **Type**: `market` (immediate execution at market price)

### Position Sizing
Trades are sized at **1% of account balance** as risk amount:
```python
risk_amount = account_cash * 0.01  # 1% of $100k = $1,000
qty = risk_amount / (entry_price - stop_loss)
```

For example, if:
- Account cash: $100,000
- Entry: $72,800
- Stop loss: $72,000
- Risk per unit: $800

Then: `qty = $1,000 / $800 = 1.25 BTC`

### Exit Signals
When TP or SL is hit, Bob fires an EXIT signal:
- Direct Alpaca: Calls `alpaca_executor.close_position(symbol)`
- Webhook: Sends EXIT action to webhook endpoint

## Alpaca Account Status (Current)

**Account**: PA3BP5DZARV2 (Paper Trading)
**Status**: ACTIVE
**Cash**: ~$100,094.85
**Buying Power**: ~$199,526.62 (2x margin)
**Portfolio Value**: ~$100,980.15

**Open Positions:**
- BTCUSD: 0.0122 BTC (avg entry: $70,723)

## Architecture Diagram

### Direct Alpaca Mode
```
Bitcoin Bob Engine
    ↓
fire_signal()
    ↓
execute_on_alpaca()
    ↓
AlpacaExecutor (REST Client)
    ↓
Alpaca REST API
    ↓
Order Filled & Trade Tracked Locally
```

### Webhook Fallback Mode
```
Bitcoin Bob Engine
    ↓
fire_signal()
    ↓
POST /api/webhook/tradingview
    ↓
TradeExecutor (Next.js)
    ↓
getAlpacaClient() (TypeScript)
    ↓
Alpaca REST API
    ↓
Order Filled & Trade Recorded in SQLite
```

## Key Differences: Direct vs Webhook

| Feature | Direct Alpaca | Webhook |
|---------|---------------|---------|
| **Latency** | Lower (no HTTP round-trip) | Higher (2 HTTP calls) |
| **Logging** | Agent utils only | SQLite + Discord + Cloud |
| **Multi-tenant** | Single account (env vars) | Multi-user support |
| **Fallback** | N/A | Runs webhook server |
| **Position Tracking** | In-memory list | SQLite database |
| **Best For** | Single-agent paper trading | Production multi-user |

## Monitoring & Logging

### Direct Alpaca Execution Logs
When Bob submits an order via direct Alpaca, you'll see:
```
[Bob] 📤 Submitting order: BUY 1.25 BTC/USD (TIF: gtc)
[Bob] ✅ Order PK33J2RV4PNIY: status=pending_new
[Bob] ✅ Direct Alpaca BUY: 1.2500 BTCUSD @ $72,800.00 | Order: <order_id>
```

### Trade Exit Logs
When TP/SL is hit:
```
[Bob] 🎯 TP hit: BTC-USD @ $85,000.00
[Bob] ✅ Direct Alpaca EXIT: BTCUSD @ $85,000.00
```

### Agent Status Updates
The `AGENT_STATUS_UPDATE` JSON (for agent_runner.ts dashboard) includes:
```json
{
  "last_updated": "2026-03-15T21:47:00.123456",
  "status": "ACTIVE",
  "active_pairs": 3,
  "total_zones_found": 18,
  "pending_orders": [ ... ],
  "closed_trades": [ ... ],
  "meta": { "name": "Bitcoin Bob", "type": "Crypto" }
}
```

## Troubleshooting

### AlpacaExecutor Import Error
**Symptom:** `ModuleNotFoundError: No module named 'alpaca_executor'`
**Fix:** Ensure `.env.local` is loaded before importing bitcoin_bob_engine:
```bash
# From project root:
python3 -c "from dotenv import load_dotenv; load_dotenv('.env.local'); from scripts.alpaca_executor import AlpacaExecutor"
```

### Alpaca Connection Error
**Symptom:** `Alpaca API error 401: Unauthorized`
**Fix:** Check environment variables:
```bash
grep APCA /sessions/trusting-cool-turing/mnt/SwjshAlgoKnife/.env.local
```

### Order Not Filling
**Symptom:** Order status stays `pending_new`
**Possible Causes:**
1. Market closed (crypto markets are 24/5, but API may have brief outages)
2. Insufficient buying power (check `get_account_info()['buying_power']`)
3. Invalid symbol format (must be `BTC/USD`, not `BTCUSD`)

### Position Doesn't Close
**Symptom:** `close_position()` returns None
**Fix:** Verify position exists:
```python
position = executor.get_position("BTC/USD")
if position:
    executor.close_position("BTC/USD")
else:
    print("No position to close")
```

## Future Enhancements

1. **Order State Machine**: Track pending → filled → TP → SL with state callbacks
2. **Partial Fills**: Handle partial fills when qty is adjusted mid-order
3. **Advanced Orders**: Limit orders, stop orders (not just market)
4. **Multi-broker**: Abstract executor to support OANDA, IB, etc.
5. **Cloud Sync**: Replicate trades to Firebase/SQLite for audit trail
6. **Performance Analytics**: Track execution speed, slippage, fill rates

## References

- **Alpaca API Docs**: https://docs.alpaca.markets/reference
- **Crypto Symbols**: BTC/USD, ETH/USD, SOL/USD (must include `/USD`)
- **Paper Account**: https://paper-api.alpaca.markets (base URL)
- **Live Account**: https://api.alpaca.markets (base URL)

---

**Last Updated**: 2026-03-15
**Integration Status**: ✅ Ready for Paper Trading
