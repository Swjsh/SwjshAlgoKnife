# Swjsh FX Strategy: "Set & Forget" (FX Alex G Style)

> [!NOTE]
> **Core Philosophy**: A mechanical, rule-based approach designed to remove emotion. Identify the setup, set the limit order, set the stop/target, and walk away.

## 1. Market Structure & Timeframes
The strategy relies on multi-timeframe concordance. At least two timeframes must align.

- **Higher Timeframe (HTF)**: Weekly / Daily / 4H
  - Determine the overall Trend (Uptrend = Higher Highs/Lows, Downtrend = Lower Highs/Lows).
  - **Rule**: Only trade in the direction of the HTF sequence.

- **Trading Timeframe**: 4H / 1H (sometimes 15m for refinement)
  - Identify the specific Supply or Demand zone responsible for the latest impulsive move (Break of Structure).

## 2. Zone Selection Criteria
The success of the strategy depends on the quality of the Supply/Demand zone.

- **Freshness**: The zone must be **untested**. If price has revisited it, the zone is invalid.
- **Impulsive Move**: The zone must have caused a violent move away, breaking structure or consuming liquidity.
- **Clarity**: The "base" or "candle" forming the zone should be clear (e.g., a distinct bearish candle before a huge rally for Demand).

## 3. Entry & Exit Rules

### Entry
- **Type**: Limit Order (No market execution).
- **Placement**:
  - **Buy Limit**: Top of the Demand Zone.
  - **Sell Limit**: Bottom of the Supply Zone.
  - *Optional*: Add a small buffer (spread + 1-2 pips) to ensure fill.

### Stop Loss (SL)
- **Placement**: Distal line of the zone (the far edge).
- **Buffer**: Add 2-5 pips breathing room outside the zone to account for spread/wicks.
- **Rule**: If price breaks the zone, the thesis is wrong. Get out.

### Take Profit (TP)
- **Target**: Minimum **1:3 Risk-to-Reward (RR)**.
- **Management**:
  - **Set and Forget**: Ideally, no management. Let it hit TP or SL.
  - **Breakeven (Optional)**: Move SL to Breakeven only after price makes a structural High/Low in your favor (e.g., after 1:1 or 1:1.5 extension).

## 4. Risk Management
- **Risk Per Trade**: 1-2% of Account Equity.
- **Max Open Trades**: 1-2 correlated pairs max.
- **News**: Avoid entries 30 mins before High Impact News (Red Folder).

## 5. Swjsh Bot Logic Checklist
To automate this, the Algo Knife must:
1. [ ] Analyze Daily/4H candles to determine Trend components (HH, HL, LH, LL).
2. [ ] Identify "Zone Candidates" (clusters of candles followed by large displacement).
3. [ ] Filter for "Freshness" (has Price.Low touched Zone.Top since creation?).
4. [ ] Place simulated pending orders.
5. [ ] Cancel orders if price moves too far away (e.g., forms a new structure) before filling.

---
*Based on FX Alex G "Set and Forget" Playlist & Strategy Principles*
