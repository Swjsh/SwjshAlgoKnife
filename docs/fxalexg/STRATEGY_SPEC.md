# FXALEXG "Set and Forget" Strategy Specification

**Source:** FXALEXG Free Course (5 Parts) - YouTube  
**Style:** Swing Trading, Forex (adaptable to other markets)  
**Timeframes:** Weekly → Daily → 4H → 30m/1H (entries)  
**Typical Hold Time:** 1-7 days  
**Target R:R:** 1:3 to 1:6

---

## Core Philosophy

> "We only buy at weekly or daily areas of interest. Anything from the 4-hour down is JUST for entries."

This is a **top-down analysis** strategy using:
- Pure price action (no indicators)
- Market structure (Higher Highs/Lows, Lower Highs/Lows)
- Supply/Demand zones (Areas of Interest)
- Multi-timeframe confluence

---

## The 5-Box System

### Box 1: Weekly Analysis
**Question:** Where are we on the weekly timeframe?

1. Identify market structure: Bullish (HH/HL) or Bearish (LH/LL)
2. Determine position (1, 2, or 3):
   - **1** = At a higher high (not buying)
   - **2** = On the way to AOI (not buying yet)
   - **3** = At area of interest (ready to look for entries)
3. Check for confluence (select ONE if applicable):
   - [ ] Rejecting structure point
   - [ ] Rejecting EMA (e.g., 200 EMA)
   - [ ] Rejecting area of interest
   - [ ] Rejecting round psychological level
   - [ ] Weekly rejection candlestick (doji, hammer, etc.)

### Box 2: Daily Analysis
**Question:** Where are we on the daily timeframe?

1. Identify market structure: Bullish or Bearish
2. Check for confluence (select ALL that apply):
   - [ ] Daily rejection candle
   - [ ] Rejecting round psychological level
   - [ ] Rejecting daily area of interest
   - [ ] Rejecting EMA
   - [ ] Rejecting structure point

### Box 3: 4H Entry Setup
**Question:** Are we at a valid entry point?

**For LONGS:**
- Need 4H higher low OR potential higher low
- At shift of structure
- With bullish engulfing pattern
- At support / last resistance

**For SHORTS:**
- Need 4H lower high OR potential lower high
- At shift of structure
- With bearish engulfing pattern
- At resistance / last support

### Box 4: Monitor Lower Timeframes
**Question:** Is the structure shifting?

After identifying potential HL/LH on 4H:
- Monitor 15m, 30m, or 1H for **shift of structure**
- Structure shift = LH→HH (for longs) or HL→LL (for shorts)
- Pick whichever timeframe looks cleanest

### Box 5: Entry Confirmation
**Question:** Is there a valid entry signal?

Once structure shifts on 15m/30m/1H:
- Look for engulfing pattern on 1H, 2H, or 4H
- Higher timeframe = stronger confirmation
- Valid patterns: Bullish/Bearish Engulfing, Morning/Evening Star, Pin Bar, Doji

---

## Entry Rules

### Long Entry Checklist:
1. ✅ Weekly is bullish AND at position 3 (AOI)
2. ✅ Daily has confluence (rejection candle, AOI, psych level, etc.)
3. ✅ 4H is forming higher low
4. ✅ 15m/30m/1H structure shifted bullish
5. ✅ 1H/2H/4H bullish engulfing pattern formed
6. **→ ENTER LONG**

### Short Entry Checklist:
1. ✅ Weekly is bearish AND at position 3 (AOI)
2. ✅ Daily has confluence
3. ✅ 4H is forming lower high
4. ✅ 15m/30m/1H structure shifted bearish
5. ✅ 1H/2H/4H bearish engulfing pattern formed
6. **→ ENTER SHORT**

---

## Stop Loss Placement

Place stop loss at a point where **if hit, you are completely wrong**.

- Location: Bottom (longs) or Top (shorts) of the shift of structure on 15m/30m/1H
- Add **5-7 pips** breathing room
- If stopped out: Wait for structure to shift again, repeat process

---

## Take Profit Placement

**Rule:** TP is based on WHERE you entered from.

| Entry Level | Take Profit Location |
|-------------|---------------------|
| Weekly AOI | Weekly structure point (higher high) |
| Daily AOI | Daily structure point (higher high) |

**Important:**
- Place TP at candle **bodies**, not wicks (safer)
- One entry, one TP (no scaling)
- Don't scale in (violates "only buy at weekly/daily AOI" rule)

---

## Session Rules

**Trade during:**
- ✅ London session
- ✅ New York session
- ✅ 2-3 hours pre-London
- ✅ 2-3 hours pre-New York

**Avoid:**
- ❌ Sydney session
- ❌ Tokyo session

---

## Risk Management

- **Risk per trade:** 1-2% of account
- **Max trades per week:** ~2
- **Style:** Set and forget (don't micromanage)
- **Hold time:** Expect to hold 1-7 days

---

## Market Structure Rules

### Bullish Structure
```
     HH ←── New high confirms bullish
    /
   /
  HL ←── Higher low
 /
HH ←── Previous high (now support)
```

**Confirmation:** Body close above previous high = bullish confirmation

### Bearish Structure
```
LL ←── Previous low (now resistance)
 \
  LH ←── Lower high
   \
    \
     LL ←── New low confirms bearish
```

**Confirmation:** Body close below previous low = bearish confirmation

---

## Candlestick Patterns (Entry Signals)

### Bullish Patterns:
- **Bullish Engulfing:** Green candle completely engulfs previous red candle
- **Morning Star:** Red candle → Small body → Large green candle
- **Hammer/Pin Bar:** Long lower wick, small body at top
- **Bullish Doji:** Indecision at support (combined with other confluence)

### Bearish Patterns:
- **Bearish Engulfing:** Red candle completely engulfs previous green candle
- **Evening Star:** Green candle → Small body → Large red candle
- **Shooting Star:** Long upper wick, small body at bottom
- **Bearish Doji:** Indecision at resistance (combined with other confluence)

---

## Area of Interest (AOI) Identification

An AOI is a zone where price previously:
1. Made a significant reversal
2. Had strong rejection (long wicks)
3. Acted as support → now resistance (or vice versa)
4. Consolidated before a breakout

**Quality AOI characteristics:**
- Strong move away from the zone
- Clean, clear zone (not choppy)
- Recent relevance (not ancient history)
- First touch = highest probability

---

## Implementation Notes for Bot

### Data Requirements:
- OHLC data for: Weekly, Daily, 4H, 1H, 30m, 15m
- At least 50-100 candles per timeframe for structure analysis

### Key Functions Needed:
1. `identifyMarketStructure(candles)` → bullish/bearish/neutral
2. `findAOIs(candles)` → array of price zones
3. `detectStructureShift(candles)` → boolean + timestamp
4. `detectCandlePattern(candles)` → pattern type
5. `checkConfluence(weekly, daily)` → confluence score

### Signal Generation Flow:
```
1. Weekly scan: Is structure bullish/bearish? At AOI? (position 3)
2. Daily scan: Has confluence? (rejection, psych level, AOI)
3. 4H scan: Is HL/LH forming?
4. 30m/1H monitor: Has structure shifted?
5. 1H/2H/4H check: Is there an engulfing pattern?
6. → GENERATE SIGNAL with SL/TP levels
```

### Paper Trading Checklist:
- [ ] Backtest on historical data (min 6 months)
- [ ] Forward test on demo account (min 1 month)
- [ ] Track win rate, average R:R, max drawdown
- [ ] Only go live after proving profitability

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────┐
│           SET AND FORGET - QUICK GUIDE              │
├─────────────────────────────────────────────────────┤
│ 1. WEEKLY: Bullish/Bearish? At AOI? (position 3)    │
│ 2. DAILY:  Confluence? (rejection, AOI, psych)      │
│ 3. 4H:     HL forming (longs) / LH forming (shorts) │
│ 4. 30m/1H: Structure shift confirmed?               │
│ 5. 1H-4H:  Engulfing pattern? → ENTER               │
├─────────────────────────────────────────────────────┤
│ SL: Below/above shift of structure + 5-7 pips      │
│ TP: Weekly or Daily structure point (bodies)        │
│ Risk: 1-2% per trade | Sessions: London/NY only     │
└─────────────────────────────────────────────────────┘
```

---

*Document generated from FXALEXG Free Course transcript analysis*
*Last updated: 2026-01-26*
