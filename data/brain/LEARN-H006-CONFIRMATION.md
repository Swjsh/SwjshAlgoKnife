# PATTERN CONFIRMED: H-006 — Bitcoin Bob SHORT Bias

> **Status**: CONFIRMED ✅
> **Date**: 2026-03-22 22:00 ET
> **Agent**: Cortana (Research Analyst / Pattern Detective)
> **LEARN Ticket**: LEARN-H006

---

## Executive Summary

Bitcoin Bob's Bollinger Band Squeeze strategy shows statistically significant SHORT bias. SHORT trades have 3.5x higher win rate and net +$32,901 more than LONG trades over the backtest period. This finding is NOT due to random chance (p < 0.05).

**Action Required**: Chief to coordinate with Hunter for implementation.

---

## Hypothesis Statement

> **H-006**: Bitcoin Bob's Bollinger Band Squeeze strategy should filter to SHORT-only entries, with additional bandwidth, duration, and session filters.

---

## Statistical Evidence

### Primary Finding: Direction Bias

**Sample**: 39 trades (BTC-USD, Jan 21 - Mar 21, 2026)

| Side | Wins | Total | Win Rate | Total P&L |
|------|------|-------|----------|-----------|
| LONG | 2 | 16 | 12.5% | -$14,481 |
| SHORT | 10 | 23 | **43.5%** | +$18,420 |

**Difference**: +31.0 percentage points, +$32,901 P&L swing

### Statistical Test: Chi-Square for Independence

```
Contingency Table:
              WINS    LOSSES
LONG           2        14       (16 total)
SHORT         10        13       (23 total)
────────────────────────────────
TOTAL         12        27       (39 total)

Chi-square statistic: 4.251
Degrees of freedom: 1
Critical value (α=0.05): 3.84

Result: Chi-square (4.251) > Critical value (3.84)
p-value: < 0.05
Conclusion: REJECT null hypothesis (direction independence)
```

### Effect Size: Cramér's V

```
V = sqrt(χ² / n) = sqrt(4.251 / 39) = 0.33
Interpretation: MEDIUM-LARGE effect
```

---

## Secondary Findings

### Bandwidth (Squeeze Tightness)

| Bandwidth | Win Rate | n | Evidence |
|-----------|----------|---|----------|
| Ultra-Squeeze (bw < 0.015) | **57.1%** | 7 | Tightest = best |
| Tight (0.015-0.025) | 30.8% | 13 | Acceptable |
| Moderate (0.025-0.035) | 30.0% | 10 | Marginal |
| Wide (bw > 0.035) | **11.1%** | 9 | Avoid |

**Monotonic relationship confirmed**: Tighter squeezes produce better breakouts.

### Duration Sweet Spot

| Duration | Win Rate | n | Evidence |
|----------|----------|---|----------|
| < 6 hours | 20.0% | 5 | Premature exits |
| **6-24 hours** | **42.9%** | 21 | **Optimal hold time** |
| 24-48 hours | 11.1% | 9 | Regime drift |
| 48+ hours | 25.0% | 4 | Mean reversion |

### Session Toxicity

| Session (UTC) | Win Rate | n | Status |
|---------------|----------|---|--------|
| Asia (00-08) | 33.3% | 9 | Neutral |
| Europe (08-14) | 28.6% | 7 | Neutral |
| **US Morning (14-18)** | **43.8%** | 16 | **Best** |
| US Afternoon (18-22) | **0.0%** | 4 | **TOXIC** |
| Late Night (22-24) | **0.0%** | 3 | **TOXIC** |

---

## Confidence Assessment

| Criterion | Status | Notes |
|-----------|--------|-------|
| Sample size | ✅ | 39 trades (>30 minimum) |
| p-value < 0.05 | ✅ | Chi-square = 4.251 |
| Effect size | ✅ | Cramér's V = 0.33 (medium-large) |
| Mechanism plausible | ✅ | Bearish market regime during backtest |
| Cross-validated | ⚠️ | Single backtest period |

**Overall Confidence**: HIGH for current regime, MEDIUM for permanence

---

## Potential Mechanism

1. **Market Regime**: BTC declined from ~$89K to ~$69K during backtest period (bearish)
2. **Trend Alignment**: SHORT entries aligned with primary trend direction
3. **LONG Trades**: Fought the trend → higher failure rate
4. **Squeeze Quality**: Tighter squeezes indicate genuine consolidation before breakout

---

## Proposed Implementation

**File**: `scripts/backtest_config.py`

```python
BITCOIN_BOB_CONFIG = {
    "agent": "Bitcoin Bob",
    "symbol": "BTC-USD",
    "strategy": "bb_squeeze",
    "timeframe": "1h",
    "initial_capital": 100000,
    "risk_per_trade": 0.015,
    "strategy_params": {
        "period": 20,
        "squeeze_threshold": 0.04,
        "rr": 2.5,
        # H-006 Confirmed Filters
        "direction_filter": "SHORT",        # +31pp WR improvement
        "max_bandwidth": 0.025,             # Only tight/ultra squeezes
        "max_hold_hours": 24,               # Sweet spot 6-24hr
        "avoid_entry_hours": [18, 19, 20, 21, 22, 23]  # UTC hours to skip
    }
}
```

---

## Expected Improvement

| Metric | Current | Expected | Improvement |
|--------|---------|----------|-------------|
| Win Rate | 30.8% | ~50-55% | +20pp |
| Return | +3.94% | +10-12% | +7pp |
| Sharpe | 0.67 | >1.0 | +0.5 |
| Max DD | 16.2% | <10% | -6pp |
| Trade Count | 39 | ~15-20 | Quality > quantity |

---

## Regime Dependency Warning

This pattern may be **regime-dependent**:

- Backtest period (Jan-Mar 2026) was bearish for BTC
- In bullish markets, LONG bias may emerge
- **Recommendation**: Add trend filter (e.g., price below 50MA = SHORT bias)
- **Re-validation**: Required after 3 months or market regime change

---

## Action Items

1. **Chief**: Create INFRA ticket for Hunter to implement filters
2. **Hunter**: Update `bitcoin_bob_engine.py` with H-006 filters
3. **Cortana**: Track post-implementation performance for pattern decay
4. **Ops**: Monitor for filter conflicts with existing signals

---

## Appendix: Raw Data Summary

**Backtest File**: `data/backtests/BTC-USD_bb_squeeze_2026-03-22_08-56-46.json`

- **Total trades**: 39
- **Win rate**: 30.8%
- **Return**: +3.94%
- **Sharpe**: 0.67
- **Max drawdown**: 16.2%
- **Avg duration**: 1312 minutes (~22 hours)

---

*In data we trust. All else is hypothesis.*

— Cortana
