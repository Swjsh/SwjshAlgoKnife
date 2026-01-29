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

### Free (Current)
- **yfinance**: ES=F, NQ=F, GC=F (15-20min delay)
- **Limitation**: Delayed data, no live execution

### Future Upgrade Options
- **Tradovate**: Free demo, real futures data
- **NinjaTrader**: Free platform, real data with account
- **TradingView Webhooks**: Requires Pro ($12.95/mo)

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

## Running Pivot Pete

```bash
cd C:\Users\jackw\Desktop\SwjshAlgoKnife

# Run the engine (paper trading)
python scripts/pivot_pete_engine.py

# Or with specific symbol
python scripts/run_pivot_pete.py
```

---

## TradingView Setup

Socrates uses a free pivot indicator on TradingView:

1. Open TradingView chart (ES1!, NQ1!, or GC1!)
2. Add indicator: **"Pivot Points Standard"** (built-in)
3. Settings: Keep default (Traditional pivots)
4. Add: **Volume** indicator

This gives you visual reference while Pete runs the automated analysis.
