# Low-Risk Compounding Strategies Research

> **Goal**: Verified, emotionless algo strategies for safe capital growth.

---

## 🏆 Tier 1: Verified High-Probability Systems

### 1. Multi-Strategy Diversification (YouTube Verified)
**Source**: Fractal Flow - 20yr Backtest

**Thesis**: No single strategy is "forever." Use a *portfolio* of 5-20 uncorrelated systems to smooth equity curves.

**Implementation**:
- Max 5% drawdown per strategy
- Disable any system that exceeds 10% OOS drawdown
- Rotate capital to highest-performing systems monthly

**Our Edge**: Swjsh Algo Knife already has 5 toggleable strategies—this validates our architecture.

---

### 2. Grid Trading (Forex - Reddit Verified)
**Source**: r/algotrading

**Thesis**: In ranging markets, place stacked buy/sell orders at fixed intervals. Each "bounce" captures small profits that compound.

**Metrics**:
- 15% annual return
- <10% drawdown
- Works on 8+ major FX pairs simultaneously

**Implementation**:
```
PARAMS: gridSize = 50 pips, levels = 10
IF price < lastGridLevel - gridSize: BUY, set SL/TP
IF price > lastGridLevel + gridSize: SELL, set SL/TP
```

---

### 3. Mean Reversion + VWAP (Already Implemented)
**Thesis**: Institutional traders push price back to the VWAP. Fade overextended moves.

**Metrics** (from YouTube):
- 62% win rate
- <10% max drawdown
- 2-5% monthly compounding potential

---

## 🛡️ Robustness Checklist (Before Going Live)

| Test | Pass Criteria |
|------|---------------|
| Out of Sample (OOS) | Profitable on unseen 50% of data |
| Monte Carlo | Survives 1000 random trade-order shuffles |
| Slippage Stress | Profitable with 2x normal spread |
| Multi-Market | Works on 2+ correlated assets |

---

## 📈 Compounding Math

| Monthly Return | 12-Month Growth | 3-Year Growth |
|----------------|-----------------|---------------|
| 2% | 26.8% | 113% |
| 3% | 42.6% | 228% |
| 5% | 79.6% | 580% |

> *No emotion. Just math.*
