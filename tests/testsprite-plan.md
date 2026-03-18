# TestSprite Test Plan - Agent Ecosystem Implementation

## Test Objectives

Validate the complete implementation of:
1. Persistent active trades in agents_db.json
2. Multi-pair Yahoo Finance polling (5 pairs)
3. Unified Audit Loop (The Watcher)
4. Strategy loop handling multiple tickers

## Test Suites

### Suite 1: Persistent Trades Storage

**Test 1.1: Active Trade Persistence**
- **Setup**: Start agent runner, create active trade for EURUSD
- **Action**: Restart agent runner process
- **Expected**: Active trade persists in agents_db.json, trade not lost
- **Validation**: Check `fx.active_trades` array contains the trade after restart

**Test 1.2: Multiple Active Trades**
- **Setup**: Create 3 active trades across different pairs
- **Action**: Monitor agents_db.json
- **Expected**: All 3 trades appear in `active_trades` array
- **Validation**: Verify trade count and ticker names

**Test 1.3: Trade Closure and Migration**
- **Setup**: Create active trade, simulate TP hit
- **Action**: Close trade
- **Expected**: Trade moves from `active_trades` to `closed_trades`
- **Validation**: Active count decreases, closed count increases

### Suite 2: Multi-Pair Yahoo Finance Polling

**Test 2.1: All Pairs Polling**
- **Setup**: Start YahooFinance poller
- **Action**: Wait for first polling cycle (10 seconds)
- **Expected**: Receive price updates for all 5 pairs
- **Validation**: Verify tickers: EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD

**Test 2.2: Sequential Polling Delay**
- **Setup**: Monitor fetch requests
- **Action**: Measure time between requests
- **Expected**: ~200ms delay between each pair request
- **Validation**: Verify rate limiting protection working

**Test 2.3: Price Normalization**
- **Setup**: Poll Yahoo Finance
- **Action**: Check emitted price events
- **Expected**: Ticker format is normalized (e.g., 'EURUSD' not 'EURUSD=X')
- **Validation**: Verify ticker field in price events

**Test 2.4: Error Handling**
- **Setup**: Simulate network error for one pair
- **Action**: Continue polling
- **Expected**: Other pairs continue working, error logged
- **Validation**: System resilience maintained

### Suite 3: Unified Audit Loop (The Watcher)

**Test 3.1: FX Trade Grading**
- **Setup**: Close a trade in fx agent
- **Action**: Wait 30 seconds for Watcher cycle
- **Expected**: Trade appears in `professor.reviews` with grade
- **Validation**: Review exists with correct agent name and trade details

**Test 3.2: Python Agent Trade Grading**
- **Setup**: Manually add closed trade to `boba.closed_trades`
- **Action**: Wait for Watcher sync
- **Expected**: Boba trade gets graded by Professor
- **Validation**: Review created for Boba agent

**Test 3.3: Avoid Duplicate Grading**
- **Setup**: Trade already graded (review exists)
- **Action**: Watcher runs again
- **Expected**: No duplicate review created
- **Validation**: Review count stays same

**Test 3.4: Multi-Agent Coverage**
- **Setup**: Add closed trades to fx, crypto, futures, boba, spx
- **Action**: Wait for Watcher cycle
- **Expected**: ALL agents' trades get graded
- **Validation**: Reviews exist for all 5 agents

**Test 3.5: Auditor Invocation**
- **Setup**: Close trade, wait for grading
- **Action**: Check audit reports
- **Expected**: TheAuditor fact-checks each Professor review
- **Validation**: `professor.audits` contains audit report

### Suite 4: Strategy Loop Multi-Ticker Support

**Test 4.1: Simultaneous Zone Tracking**
- **Setup**: Send price ticks for EURUSD and GBPUSD
- **Action**: Monitor zone creation
- **Expected**: Zones tracked separately per ticker
- **Validation**: No cross-talk between pairs

**Test 4.2: Zone Fill Execution**
- **Setup**: Create zone for EURUSD at 1.0850
- **Action**: Send tick with price 1.0850
- **Expected**: ENTRY signal generated for EURUSD only
- **Validation**: Other pairs' zones unaffected

**Test 4.3: Multiple Active Zones**
- **Setup**: Create zones for all 5 pairs
- **Action**: Send price updates
- **Expected**: Each zone monitored independently
- **Validation**: Correct zone triggered by correct ticker

### Suite 5: End-to-End Workflow

**Test 5.1: Complete Trade Lifecycle**
- **Steps**:
  1. Start agent runner
  2. YahooFinance polls EURUSD price
  3. StrategyLoop detects impulse, creates zone
  4. Zone gets filled, trade becomes active
  5. Trade persists in `active_trades`
  6. Price hits TP, trade closes
  7. Trade moves to `closed_trades`
  8. Watcher detects ungraded trade
  9. Professor grades trade
  10. Auditor fact-checks review
- **Expected**: Complete workflow executes without errors
- **Validation**: Verify each step's data in agents_db.json

**Test 5.2: Multi-Pair Concurrent Trading**
- **Setup**: Enable all 5 pairs
- **Action**: Simulate market conditions leading to 3 simultaneous trades
- **Expected**: All trades tracked independently
- **Validation**: Correct PnL calculation per pair

**Test 5.3: System Restart Recovery**
- **Setup**: Create 2 active trades
- **Action**: Kill and restart agent runner
- **Expected**: Both trades resume monitoring for TP/SL
- **Validation**: Trades not lost, monitoring continues

### Suite 6: Performance and Reliability

**Test 6.1: Watcher Performance**
- **Setup**: Add 100 closed trades across agents
- **Action**: Run Watcher sync
- **Expected**: All trades graded within reasonable time (<5s)
- **Validation**: No timeouts or memory issues

**Test 6.2: Database Write Integrity**
- **Setup**: Rapid trade closures (10 trades in 1 second)
- **Action**: Check agents_db.json
- **Expected**: All writes succeed, no corruption
- **Validation**: Valid JSON, all trades recorded

**Test 6.3: Concurrent Agent Operations**
- **Setup**: FX, Boba, and Pete all active
- **Action**: All agents close trades simultaneously
- **Expected**: No race conditions, all data saved
- **Validation**: agents_db.json integrity maintained

## Test Data

### Sample Trade (EURUSD)
```json
{
  "ticker": "EURUSD",
  "entry": 1.0850,
  "stop": 1.0830,
  "side": "LONG",
  "agentId": "fx",
  "startTime": 1735689600000
}
```

### Sample Closed Trade (GBPUSD)
```json
{
  "closed_at": "2026-01-01T10:30:00.000Z",
  "type": "DEMAND",
  "ticker": "GBPUSD",
  "entry": 1.2650,
  "exit": 1.2690,
  "pnl": 400,
  "status": "WIN"
}
```

## Expected Outcomes

### Success Criteria
- ✅ All persistence tests pass (trades survive restarts)
- ✅ All 5 forex pairs polling successfully
- ✅ Watcher grades 100% of trades from all agents
- ✅ No duplicate reviews created
- ✅ StrategyLoop handles multiple tickers without cross-talk
- ✅ End-to-end workflow completes successfully
- ✅ System remains stable under concurrent operations

### Performance Benchmarks
- YahooFinance polling cycle: <2 seconds for all 5 pairs
- Watcher sync cycle: <30 seconds
- Database write: <10ms per operation
- Trade grading: <100ms per trade

## Test Execution

Run tests with:
```bash
# Unit tests
npm test

# Manual verification
npx tsx scripts/agent_runner.ts

# Monitor logs for:
# - "Starting Multi-Pair Poller for EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD..."
# - "Audit Sync Loop Started (30s interval)"
# - "🔍 [WATCHER] Found ungraded trade..."
# - "🎓 [PROFESSOR] Graded fx: A"
```

## Bug Tracking

| Test ID | Status | Issue | Severity |
|---------|--------|-------|----------|
| - | - | - | - |

## Notes

- Yahoo Finance may have rate limits; tests should account for this
- Watcher has 30-second delay; factor into test timing
- agents_db.json writes are atomic but sequential
- Python agents output JSON via stdout; ensure proper parsing
