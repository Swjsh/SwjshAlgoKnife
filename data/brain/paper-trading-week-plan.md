# Paper Trading Week Plan

---
tags: #testing #validation #planning
status: 📋 Planned (Wave 1 Focus)
last_updated: 2026-03-15
---

## ⚠️ REVISED PLAN: Wave 1 Focus (March 24-28)

**Original Plan**: Deploy all 5 agents simultaneously for paper trading week

**Revised Plan**: Staggered rollout based on backtest validation

### Wave 1 (March 24-28): Proven Profitable Agents
- ✅ **SPX Sniper** - +4.59% return, 42.3% WR (READY)
- 🔧 **Boba Trades** - +0.73% return (pending optimization)
- 🔧 **Sterling FX** - 0 trades (pending threshold fix)

### Wave 2 (April): Requires Further Tuning
- ❌ **Pivot Pete** - -28.63% return (deferred to April)
- 🎯 **Bitcoin Bob** - -4.07% return (breakthrough, but needs final tuning)

**Strategic Decision**: Focus on deploying 1-3 profitable agents rather than 5 unvalidated agents.

---

## Overview

A structured one-week paper trading validation period to test Wave 1 agents before live deployment.

**Purpose**:
- Validate strategy logic in live market conditions
- Test execution and slippage
- Verify agent stability and uptime
- Measure actual vs expected performance
- Identify edge cases and bugs

---

## Schedule

### Day 1 (Monday): Infrastructure Check

**Goal**: Ensure all systems operational

**Tasks**:
- [ ] Start all agents via `START_SWJSH.ps1`
- [ ] Verify all agents showing in dashboard
- [ ] Confirm data feeds working (Alpaca, OANDA)
- [ ] Test webhook ingestion (TradingView)
- [ ] Verify database recording trades
- [ ] Check kill switch functionality

**Acceptance Criteria**:
- All 5 agents status = "active" or "idle"
- Dashboard loads without errors
- Test trade recorded in database

---

### Day 2 (Tuesday): SPX Sniper Focus

**Goal**: Validate the ONLY profitable agent (Wave 1 core)

**Agents Active**: SPX Sniper only

**Monitor**:
- [ ] 0DTE signal generation
- [ ] Options chain data quality
- [ ] Order execution via Alpaca
- [ ] Position tracking accuracy
- [ ] Greek calculations
- [ ] Mandatory close before 15:45
- [ ] End-of-day P&L reconciliation

**Expected**:
- 2-5 trades during session
- Win rate: ~42% (backtest baseline)
- Positive return matching +4.59% backtest trend

**Log**:
```
| Time | Event | Result |
|------|-------|--------|
| 10:00 | Directional signal | ✓/✗ |
| 10:01 | Order filled | ✓/✗ |
| 15:44 | All closed | ✓/✗ |
| ... | ... | ... |
```

---

### Day 3 (Wednesday): Add Boba Trades (If Optimized)

**Goal**: Validate second options agent if optimization complete

**Agents Active**: SPX Sniper + Boba Trades (if ready)

**Monitor**:
- [ ] Support/resistance zone detection
- [ ] Multi-touch zone validation
- [ ] Credit spread execution
- [ ] Risk/reward targeting
- [ ] Concurrent position management

**Expected**:
- Boba: 3-5 trades
- Win rate: >40% (optimization target)
- Proper zone identification

**Note**: Only activate if Boba optimization backtest shows >40% WR, >5% return

---

### Day 4 (Thursday): Add Sterling FX (If Fixed)

**Goal**: Validate forex agent if threshold fix successful

**Agents Active**: SPX Sniper + Boba (if ready) + Sterling FX (if ready)

**Monitor**:
- [ ] VWAP deviation detection
- [ ] Three Ducks alignment
- [ ] Session detection (London/NY)
- [ ] Order execution via OANDA
- [ ] Cross-pair correlation

**Expected**:
- Sterling FX: 2-4 trades (threshold 0.4%)
- Win rate: ~50%
- Proper session filtering

**Note**: Only activate if Sterling backtest shows >20 trades with threshold 0.4%

---

### Day 5 (Friday): Wave 1 Full Fleet

**Goal**: All Wave 1 agents running simultaneously

**Agents Active**: SPX Sniper + (Boba/Sterling if validated)

**Monitor**:
- [ ] System resource usage (CPU, memory)
- [ ] Agent Runner stability
- [ ] Dashboard performance
- [ ] Concurrent position management
- [ ] Kill switch responsiveness
- [ ] P&L aggregation

**Stress Tests**:
- [ ] Trigger 5 signals simultaneously
- [ ] Activate/reset kill switch
- [ ] Restart Agent Runner mid-session

---

### Weekend: Analysis & Adjustments

**Tasks**:
- [ ] Compile all trade data
- [ ] Calculate actual vs expected metrics
- [ ] Identify failed/missed signals
- [ ] Document bugs and edge cases
- [ ] Create fix list for next sprint
- [ ] Decision: Ready for live? / More testing?

---

## Metrics to Track

### Per Agent (Wave 1)

#### SPX Sniper (MUST VALIDATE)
| Metric | Backtest | Target | Actual |
|--------|----------|--------|--------|
| Trades executed | N/A | 8-20 | |
| Win rate | 42.3% | 40-50% | |
| Return | +4.59% | Positive | |
| Max drawdown | N/A | < 5% | |
| Uptime | N/A | 100% | |
| Crashes | N/A | 0 | |

#### Boba Trades (If Optimized)
| Metric | Backtest | Target | Actual |
|--------|----------|--------|--------|
| Trades executed | N/A | 5-15 | |
| Win rate | 39.1% → 45%+ | > 40% | |
| Return | +0.73% → 5%+ | Positive | |
| Uptime | N/A | 100% | |

#### Sterling FX (If Fixed)
| Metric | Backtest | Target | Actual |
|--------|----------|--------|--------|
| Trades executed | 0 → 20+ | > 20 | |
| Win rate | N/A → 50%+ | > 45% | |
| Return | N/A → 10%+ | Positive | |
| Uptime | N/A | 100% | |

### System-Wide (Wave 1)

| Metric | Target | Actual |
|--------|--------|--------|
| Total trades | 15-40 | |
| Total P&L | +$200-400 | |
| Data feed uptime | 100% | |
| Order fill rate | 100% | |
| Dashboard uptime | 100% | |
| Kill switch response | < 1s | |

---

## Daily Checklist

### Morning (Pre-Market)

- [ ] All agents running (`pm2 list`)
- [ ] Dashboard accessible (localhost:3000)
- [ ] Data feeds connected
- [ ] No overnight errors in logs
- [ ] Account balances correct (paper accounts)

### During Session

- [ ] Monitor dashboard every 30 min
- [ ] Log any unusual behavior
- [ ] Note missed/failed trades
- [ ] Check P&L tracking accuracy

### End of Day

- [ ] Record final P&L per agent
- [ ] Compare to expected (backtest)
- [ ] Export trade logs
- [ ] Document any issues
- [ ] Push updates to Obsidian brain

---

## Known Risks

### Technical
- Agent crash during market hours
- Data feed disconnection
- Order rejection from broker
- Database locking issues

### Market
- Low volatility (few signals)
- High volatility (whipsaws)
- News events (unpredictable moves)
- Gap opens

### Mitigation
- Monitor closely throughout
- Have manual intervention ready
- Kill switch accessible
- Paper trading = no real loss

---

## Decision Criteria

### Ready for Live

- [ ] All agents stable (no crashes)
- [ ] Win rate within 10% of backtest
- [ ] Order execution reliable
- [ ] P&L tracking accurate
- [ ] Kill switch proven working
- [ ] No critical bugs found

### Needs More Testing

- Agent crashes during session
- Win rate significantly below backtest
- Order execution issues
- P&L tracking errors
- Critical bugs discovered

### Not Ready

- Multiple agent failures
- Consistent losses
- System instability
- Data feed issues
- Major strategy flaws

---

## Post-Paper Trading

### If Approved

1. Update agents to use live broker URLs
2. Set conservative position sizes (50% of planned)
3. Week 1 live: Monitor every trade
4. Gradually increase size over weeks 2-4

### If More Testing Needed

1. Document all issues found
2. Create fix tasks in [[Current Sprint]]
3. Fix and retest
4. Schedule Paper Trading Week 2

---

## Resources

### Monitoring
- Dashboard: http://localhost:3000
- PM2: `pm2 monit`
- Logs: `pm2 logs`

### Documentation
- [[Agent System]] - How agents work
- [[Troubleshooting]] - Common issues
- [[Risk Management]] - Position sizing
- [[Kill Switch]] - Emergency procedures

### Contacts
- Broker support (if order issues)
- Data provider status pages

---

## Related Pages

- [[Current Sprint]] - Active development
- [[Roadmap]] - Overall timeline
- [[Troubleshooting]] - Issue resolution
- [[Universal Backtest]] - Expected performance
- [[Deployment]] - Moving to production
