# Swjsh Algo Knife - Trading History Analysis (2021-2023)

> [!IMPORTANT]
> **Persistence Notice**: This file is the source of truth for all AI agents working on the Swjsh Algo Knife. All strategy development must reference these historical findings.

## 📊 High-Level Performance Summary
- **Total Trades**: 2,150
- **Overall Win Rate**: 41.21%
- **Total Realized P/L**: $-33,562.00
- **Avg Win**: $105.12 | **Avg Loss**: -$101.60
- **Profit Factor**: 0.74
- **Avg Hold Time**: 10.6 hours (638 mins)

## 🛑 Critical Execution Flaws (The "Red" Zone)
The data shows two primary "leaks" in the current manual trading style:

1. **Market Open Over-Trading**:
   - **9:00 AM - 11:00 AM**: Total loss of **-$28,795**.
   - This period accounts for nearly **90% of total losses**.
   - **Action**: Automated bot should potentially have a "No-Trade" or "Strict Filter" window during the first 90 minutes of market open.

2. **Hold Time Bloat**:
   - Average hold time of 10+ hours for options (likely 0DTEs) suggests "holding for hope" instead of cutting losses.
   - **Action**: Implement time-based exits (e.g., exit if price targets aren't hit within 15-30 mins).

## ✅ Profitable Patterns (The "Gold" Rules)
1. **Midday Stabilizer**:
   - **12:00 PM - 1:00 PM** is the only consistently profitable hour ($522 P/L).
   - Analysis: Market volatility settles, trends are clearer.

2. **Ticker Selection**:
   - **Top Profitable Underlyings**: GOOGL ($836), BIDU ($614), BABA ($436), HD ($327).
   - **Observation**: Performance on large-cap tech is significantly better than on broad SPX/SPY scalp attempts.

## 🤖 Algo Knife - Proposed Rules
Based on the data, the automated engine should prioritize:
- **Rule 1**: No entries before 10:30 AM EST.
- **Rule 2**: Maximum hold time of 60 minutes for scalps.
- **Rule 3**: Priority execution on GOOGL/TSLA/NVDA over SPX.
- **Rule 4**: Hard trailing stop after +15% profit to prevent winners turning into losers.

---
*Created by Antigravity on 2025-12-31*
