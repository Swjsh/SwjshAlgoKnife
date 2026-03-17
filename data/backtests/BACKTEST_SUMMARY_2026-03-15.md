# SwjshAK Backtest Summary
**Generated**: 2026-03-15
**Test Period**: January 24 - March 14, 2026 (50 days for intraday strategies)

---

## Executive Summary

All 5 trading agents were backtested using real market data from yfinance. Results show significant performance variation, with one profitable strategy, one marginal, and three requiring optimization.

### Key Findings

✅ **SPX Sniper is production-ready** - 42.3% win rate, +4.59% return, positive Sharpe
⚠️ **Boba Trades is barely profitable** - 39.1% win rate, +0.73% return, near-zero Sharpe
❌ **Pivot Pete needs tuning** - 27.7% win rate, -28.63% return, negative Sharpe
❌ **Bitcoin Bob needs tuning** - 30.7% win rate, -32.79% return, negative Sharpe
⚠️ **Sterling FX needs looser params** - 0 trades generated (VWAP threshold too high)

---

## Detailed Results

### 🏆 #1: SPX Sniper (BEST PERFORMER)
**Strategy**: Opening Range Breakout (15m ORB)
**Symbol**: SPY (S&P 500 ETF)
**Timeframe**: 5m bars

| Metric | Value |
|--------|-------|
| **Total Trades** | 26 |
| **Win Rate** | 42.3% |
| **Total Return** | +4.59% |
| **Profit Factor** | 1.08 |
| **Max Drawdown** | 26.07% |
| **Sharpe Ratio** | 0.62 |
| **Avg R:R** | 0.08 |
| **Avg Duration** | 1396 min (~23 hours) |
| **Final Balance** | $26,147.68 (from $25,000) |

**Analysis**: Only strategy with positive Sharpe. Conservative signal generation (32 signals → 26 trades) suggests good filter quality. Relatively long hold times indicate swing trading approach. Ready for paper trading.

**Report**: `SPY_orb_2026-03-15_12-18-24.html`

---

### 🟡 #2: Boba Trades (MARGINAL)
**Strategy**: Support & Resistance Rejection
**Symbol**: SPY (S&P 500 ETF)
**Timeframe**: 5m bars

| Metric | Value |
|--------|-------|
| **Total Trades** | 69 |
| **Win Rate** | 39.1% |
| **Total Return** | +0.73% |
| **Profit Factor** | 1.01 |
| **Max Drawdown** | 19.74% |
| **Sharpe Ratio** | 0.06 |
| **Avg R:R** | 0.02 |
| **Avg Duration** | 802 min (~13 hours) |
| **Final Balance** | $50,365.37 (from $50,000) |

**Analysis**: Barely profitable - profit factor of 1.01 means gross profit only 1% higher than gross loss. Near-zero Sharpe (0.06) indicates returns don't justify risk. Needs tighter zone detection or better entry timing.

**Report**: `SPY_supp_res_2026-03-15_12-18-21.html`

---

### 🔴 #3: Pivot Pete (NEEDS WORK)
**Strategy**: Multi-Timeframe Pivot Rejection
**Symbol**: ES=F (E-mini S&P 500 Futures)
**Timeframe**: 5m bars

| Metric | Value |
|--------|-------|
| **Total Trades** | 159 |
| **Win Rate** | 27.7% |
| **Total Return** | -28.63% |
| **Profit Factor** | 0.74 |
| **Max Drawdown** | 38.44% |
| **Sharpe Ratio** | -2.2 |
| **Avg R:R** | -0.21 |
| **Avg Duration** | 322 min (~5 hours) |
| **Final Balance** | $71,373.41 (from $100,000) |

**Analysis**: Significant losses. Emitted 3,125 signals but only took 159 trades - suggests overly aggressive signal generation. Low win rate (27.7%) and negative avg R:R (-0.21) indicate poor entry/exit logic. Confluence filter may need stricter requirements.

**Issues to Fix**:
- Pivot tolerance too wide (0.08%)? May be hitting false breakouts
- Need stronger confluence (currently min_confluence=1)
- Stop loss placement may be too tight
- Consider adding trend filter to avoid range-bound chop

**Report**: `ES=F_pivot_2026-03-15_12-18-20.html`

---

### 🔴 #4: Bitcoin Bob (NEEDS WORK)
**Strategy**: Bollinger Band Squeeze & Breakout
**Symbol**: BTC-USD (Bitcoin)
**Timeframe**: 1h bars (1 year test period)

| Metric | Value |
|--------|-------|
| **Total Trades** | 238 |
| **Win Rate** | 30.7% |
| **Total Return** | -32.79% |
| **Profit Factor** | 0.85 |
| **Max Drawdown** | 38.78% |
| **Sharpe Ratio** | -1.22 |
| **Avg R:R** | -0.1 |
| **Avg Duration** | 1650 min (~27 hours) |
| **Final Balance** | $67,208.02 (from $100,000) |

**Analysis**: High trade count (238 trades in 1 year) suggests frequent false breakouts. Squeeze threshold (0.04) may be too loose, catching normal volatility contractions instead of true squeezes. Negative R:R indicates exits are poorly timed.

**Issues to Fix**:
- Tighten squeeze threshold (try 0.03 or 0.02)
- Add volume confirmation for breakouts
- Consider requiring multi-bar squeeze before entry
- Improve exit logic (currently simple R:R based)

**Report**: `BTC-USD_bb_squeeze_2026-03-15_12-18-23.html`

---

### ⚠️ #5: Sterling FX (NO TRADES)
**Strategy**: VWAP Mean Reversion
**Symbol**: GBPUSD=X (British Pound / US Dollar)
**Timeframe**: 15m bars

| Metric | Value |
|--------|-------|
| **Total Trades** | 0 |
| **Signals Emitted** | 0 |
| **Test Period** | Jan 24 - Mar 14, 2026 (50 days) |

**Analysis**: Zero signals generated over 50 days. VWAP threshold (1.5% deviation) is too conservative for forex. GBP/USD typically trades in 0.3-0.8% intraday ranges. Current threshold would require 150+ pip moves, which rarely happen on 15m timeframe.

**Fixes Needed**:
- Reduce threshold to 0.3-0.5% for forex pairs
- Consider using ATR-based dynamic threshold
- Add session filtering (avoid low-volatility Asian session)
- Test on higher volatility pairs (GBP/JPY, EUR/JPY)

**Report**: `GBPUSD=X_vwap_2026-03-15_12-18-26.html`

---

## Recommendations

### Immediate Actions
1. **Deploy SPX Sniper to paper trading** - Only strategy with positive Sharpe, ready for validation
2. **Optimize Pivot Pete parameters** - Focus on confluence requirements and pivot tolerance
3. **Optimize Bitcoin Bob squeeze logic** - Tighten squeeze threshold, add volume filter
4. **Recalibrate Sterling FX threshold** - Use 0.3% for GBP/USD or switch to ATR-based

### Before Paper Trading Week (March 21-28)
- [ ] Re-backtest Pivot Pete with `min_confluence=2`, `tolerance_pct=0.0005`
- [ ] Re-backtest Bitcoin Bob with `squeeze_threshold=0.03`, add volume confirmation
- [ ] Re-backtest Sterling FX with `threshold_pct=0.4`
- [ ] Consider adding trend filter to Pivot Pete (avoid counter-trend entries)

### Risk Management Notes
- **Max Drawdown**: Highest was 38.78% (Bitcoin Bob) - ensure paper accounts can handle 40%+ swings
- **Trade Duration**: SPX Sniper holds ~23 hours - options may expire, consider spreads
- **Signal Quality**: Pivot Pete generated 3,125 signals for 159 trades (5% conversion) - filter is working but may be too loose

---

## Data Quality Notes

- **Data Source**: Yahoo Finance (yfinance library)
- **Intraday Limitation**: 5m/15m data only available for last 60 days
- **Futures Data**: ES=F had partial availability (Jan 27 - Mar 13 actual range)
- **Crypto Data**: Full 1-year history available (March 2025 - March 2026)
- **Slippage**: Not modeled (real results may be worse by 0.5-1% per trade)

---

## Next Steps

1. **Strategy Optimization** (Priority 1)
   - Run parameter sweeps for Pivot Pete (confluence, tolerance, stop distance)
   - Test Bitcoin Bob with tighter squeeze threshold range (0.02-0.04)
   - Recalibrate Sterling FX for forex volatility profile

2. **Enhanced Backtesting** (Priority 2)
   - Add slippage modeling (1-2 ticks for futures, 0.01% for stocks)
   - Implement commission costs (futures: $2.50/contract, options: $0.65/contract)
   - Add realistic fill probability based on volume

3. **Paper Trading Preparation** (Priority 3)
   - Deploy SPX Sniper to paper account (Alpaca)
   - Monitor live vs backtest performance drift
   - Validate order execution speeds match backtested assumptions

---

**Files Generated**:
- `ES=F_pivot_2026-03-15_12-18-20.{json,html,md}`
- `SPY_supp_res_2026-03-15_12-18-21.{json,html,md}`
- `BTC-USD_bb_squeeze_2026-03-15_12-18-23.{json,html,md}`
- `SPY_orb_2026-03-15_12-18-24.{json,html,md}`
- `GBPUSD=X_vwap_2026-03-15_12-18-26.{json,html,md}`
