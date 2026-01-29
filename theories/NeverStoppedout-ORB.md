# NeverStoppedout ORB Strategy (Zero Red Days Method)
**Source**: r/Daytrading - "Finished 2025 with no red days since Nov 7"  
**Trader**: NeverStoppedout  
**Asset**: Strictly MNQ (Micro Nasdaq-100 Futures)  
**Timeframe**: 15-minute Opening Range (9:30 AM - 9:45 AM EST)

---

## 📊 Strategy Overview

The strategy is 99% based on the **15-minute Opening Range Breakout (ORB)** with three core variations:

1. **Standard ORB** - Breakout/Retest trades
2. **Inverse ORB** - Range trading when conditions favor mean reversion
3. **ES/NQ Divergence** - Intermarket correlation plays

---

## 🎯 The Three Setups

### Setup 1: Standard ORB (Breakout/Retest)

**When to Use**: Market shows clear momentum direction

**Entry Rules**:
- Wait for 9:30-9:45 AM EST candle to close
- Mark the HIGH and LOW of this 15-min candle
- LONG: Price breaks above ORB High → Enter on breakout or retest
- SHORT: Price breaks below ORB Low → Enter on breakout or retest

**Exit Rules**:
- Take Profit: 1:1 RR based on range size (if range is 100 pts, TP is 100 pts)
- Stop Loss: Opposite side of the range

---

### Setup 2: Inverse ORB (Range Trading)

**When to Use**: Three specific conditions (from OP's comment):

> *"What makes me play inverse ORB is usually 3 elements:"*

**Condition 1: Wide ORB Range**
```
IF 15min ORB is way too wide (e.g., 500 pts on NQ)
THEN probability of 1:1 breakout is LOW
PLAY the ORB High & Low AS A RANGE instead
```

**Condition 2: Daily Bias Supports the Trade**
```
IF Higher TF (Daily/4H) shows CLEAR UPTREND
AND Price is holding HTF EMAs as support
THEN LONG the lower side of the ORB

IF Higher TF shows CLEAR DOWNTREND
AND Price is rejecting HTF EMAs as resistance
THEN SHORT the upper side of the ORB
```

**Exit for Inverse ORB**:
- First TP: Opposite side of ORB (High if longing Low)
- If price then breaks out normally, keep a runner
- Use "normal ORB rules" (breakout/retest) for continuation

---

### Setup 3: ES & NQ Divergence

**The Setup**:
- Have ES (S&P 500) and NQ (Nasdaq) on second monitor
- Mark ORB High/Low on BOTH instruments

**The Signal**:
```
IF both ES and NQ are OUTSIDE their respective ORBs
AND one breaks BACK INSIDE its ORB
THEN Short/Long the LAGGING index

REASONING: Place bet that the lagging index will also return inside its ORB

CONTINUATION: If price returns to ORB, look for opportunities to play 
              the High or Low of the ORB again
```

---

## ⚙️ Execution Rules

### Risk Management
| Parameter | Rule |
|-----------|------|
| SL/TP | Set IMMEDIATELY upon entry (non-negotiable) |
| Risk:Reward | Minimum 1:1 (ORB range = target) |
| Max Contracts | Not specified, but implies conservative sizing |

### Platform Lockout (Forced Discipline)
```
AFTER each trade (win OR loss):
  → Platform locks for 15 minutes minimum
  → Prevents revenge trading
  → Prevents over-trading
```

### The "Walk Away" Rule
```
AFTER entering a trade:
  → Walk away from PC for 3-10 minutes
  → Prevents premature exits from anxiety
  → Let the trade hit SL or TP without interference
```

---

## 📈 Daily Bias Framework

Before any trades, identify:
1. **High TF Structure** (Daily/4H): Uptrend, Downtrend, or Range?
2. **EMA Alignment**: Is price above or below key EMAs on HTF?
3. **This Determines Inverse ORB Direction**:
   - Uptrend = Bias to LONG the ORB Low
   - Downtrend = Bias to SHORT the ORB High

---

## 🧠 Psychology Rules

1. **Single Asset Focus**: ONLY trade MNQ. Ignore Gold, Silver, other assets.
2. **No Revenge Trading**: Platform lockout enforces this mechanically.
3. **Detach from Screens**: Walk away rule prevents emotional interference.
4. **Trust the Levels**: ORB High/Low are the ONLY levels that matter.

---

## 📹 Verification

- **Proof**: OP provided screen recording of results: https://imgur.com/a/XneW1eu
- **YouTube**: Channel "NeverStoppedout" with full breakdowns
- **Track Record**: Zero red days Nov 7 → Dec 31 (54+ consecutive green days)

---

## 🔧 Implementation for Swjsh Algo Knife

### Scanner Integration
We can add an "ORB Setup Scanner" that:
1. Calculates 15-min ORB range at 9:45 AM
2. Flags "Inverse ORB" if range > 400 pts
3. Monitors ES/NQ divergence for correlation plays

### Alert Logic
```typescript
// Pseudo-code for Inverse ORB Alert
IF (orbRangeSize > 400) {
  alertType = 'INVERSE_ORB';
  if (dailyBias === 'BULLISH') {
    alert('LONG the ORB Low on retest');
  } else if (dailyBias === 'BEARISH') {
    alert('SHORT the ORB High on retest');
  }
}

// ES/NQ Divergence
IF (ES.insideORB && NQ.outsideORB) {
  alert('NQ lagging - potential short to ORB');
}
```

---

## 📋 Checklist for Live Testing

- [ ] Set up MNQ chart with 15-min timeframe
- [ ] Mark ORB High/Low at exactly 9:45 AM EST
- [ ] Check Daily bias (HTF EMAs, structure)
- [ ] Determine if Standard or Inverse ORB applies
- [ ] Set SL/TP IMMEDIATELY upon entry
- [ ] Walk away for 3-10 minutes
- [ ] Enable 15-min lockout after each trade

---

## 📸 Visual Reference

![Strategy Explanation from OP](file:///C:/Users/jackw/.gemini/antigravity/brain/e6bffe32-a56e-497a-870b-694eca8052d1/strategy_explanation_comment_1767202100502.png)

![User Screenshot of Inverse ORB Rules](file:///C:/Users/jackw/.gemini/antigravity/brain/e6bffe32-a56e-497a-870b-694eca8052d1/uploaded_image_1767202040737.png)

---

*Strategy documented for Swjsh Algo Knife implementation. This is a proven method with 54+ consecutive green days.*
