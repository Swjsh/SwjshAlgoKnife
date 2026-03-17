# Pivot Pete - Futures & Gold Agent

**Based on:** Socrates Investments Pivot Methodology  
**Video:** https://www.youtube.com/watch?v=K3Wh8K1mRY8  
**Assets:** ES (S&P 500 Futures), NQ (Nasdaq Futures), GC (Gold Futures)

---

## Strategy Overview

Wait for price to reach **key pivot levels**, then enter with **volume confirmation**.

### Key Levels to Watch
1. **Previous Day High/Low**
2. **Previous Week High/Low**
3. **Supply/Demand Zones** (areas of strong rejection)
4. **Pivot Points** (classic: PP, R1, R2, S1, S2)
5. **Session Closes** (London Close, NY Close)
6. **Round Numbers** (psychological levels)

### Timeframe Analysis
```
Weekly → Daily → 4H → 1H → 30m → 5m
         ↓               ↓
      Direction       Entries
```

- **Higher TF (Weekly/Daily/4H)**: Determine bias
- **Lower TF (1H/30m/5m)**: Entry timing

### Entry Rules
1. Price reaches a key pivot level
2. Volume spike confirms (1.5x+ average)
3. Candle shows rejection (wick, engulfing, etc.)
4. Direction aligns with higher TF bias

### Exit Rules
1. **Take Profit**: Next pivot level in direction of trade
2. **Stop Loss**: Beyond the pivot level that triggered entry
3. **Time Stop**: Close before major session close if uncertain

---

## Risk Management (STRICT)

| Rule | Value |
|------|-------|
| Daily Target | $25 - $5,000 |
| **Max Daily Loss** | **$4,000** |
| **2 Consecutive Losses** | **DONE FOR DAY** |
| Max Trades/Day | 4 |
| Risk per Trade | 1-2% |

### Hard Rules
- ❌ Never trade after 2 consecutive losses
- ❌ Never exceed daily loss limit
- ❌ Never trade without volume confirmation
- ✅ Base hits > home runs (consistency)
- ✅ If up $500 in 12 min, consider stopping

---

## Gold-Specific Correlations

When trading Gold (GC/XAUUSD):

| Correlation | Relationship |
|-------------|--------------|
| **DXY (Dollar Index)** | Inverse - Dollar up = Gold down |
| **Silver (SI)** | Positive - moves together |
| **Platinum (PL)** | Positive - moves together |
| **World News** | Major driver (geopolitical = gold up) |

### Gold Checklist Before Entry
- [ ] What's DXY doing?
- [ ] Any major news today?
- [ ] Are other metals confirming?

---

## Data Sources

### Current (TS runners)
- **Alpaca market data (stocks)** is used as an **ETF proxy** for index futures:
  - `ES` → `SPY`
  - `NQ` → `QQQ`
  - `YM` → `DIA`

This means the strategy is running on **ETF price action**, not true CME futures prints. It is good enough for development/backtests and paper-sim plumbing, but expect differences vs futures (session hours, gaps, microstructure).

### Future Upgrade Options (true futures feed)
- Add a futures data source (CME) and switch the data-provider layer:
  - Tradovate / NinjaTrader / other futures feed
  - TradingView webhooks (requires paid plan)

### Legacy (Python)
Some older Python scripts in `/scripts` reference **yfinance**. That path is **not used** by the TS Pivot Pete backtest/paper harness.

---

## Implementation Status

### ✅ Implemented
- Pivot point calculation (PP, R1, R2, S1, S2)
- Swing high/low detection
- Supply/demand zone identification
- Volume confirmation
- Risk management (2 consecutive losses rule)
- Position sizing

### 🔄 In Progress
- Multi-asset scanning (ES, NQ, GC)
- Correlation checking (DXY for gold)
- Session time awareness

### 📋 TODO
- London/NY close level tracking
- Previous day/week high-low levels
- Live broker integration
- Alert system

---

## Running Pivot Pete (TS)

```powershell
cd C:\Users\jackw\Desktop\SwjshAlgoKnife

# Backtest (Alpaca if creds exist; synthetic fallback otherwise)
npx tsx scripts/pivot-pete-backtest.ts --symbol ES --from 2026-01-01 --to 2026-02-01 --tf 5Min --source alpaca

# Paper-sim loop (requires Alpaca creds; no live trading)
npx tsx scripts/pivot-pete-paper.ts --symbol ES --iters 120 --pollSec 15
```

### Legacy (Python)
```powershell
# Older runner; not part of the TS Alpaca/ETF-proxy harness
python scripts/pivot_pete_engine.py
```

---

## TradingView Setup

Socrates uses a free pivot indicator on TradingView:

1. Open TradingView chart (ES1!, NQ1!, or GC1!)
2. Add indicator: **"Pivot Points Standard"** (built-in)
3. Settings: Keep default (Traditional pivots)
4. Add: **Volume** indicator

This gives you visual reference while Pete runs the automated analysis.
