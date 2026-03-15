# Strategy Reference — Chief's Playbook

> Chief reads this to understand what each agent's strategy does and when to adjust parameters.

---

## Sterling — FX Set & Forget (5-Box FXAlexG Method)

**Pairs:** GBP/USD, EUR/USD, GBP/JPY, EUR/JPY
**Timeframes:** Daily → H4 → H1 → 15M → 5M (5-box confirmation)
**Entry:** Limit orders at identified supply/demand zones. Never market orders.
**R:R:** Minimum 1:3
**Window:** London open (3 AM ET) + NY overlap (8:30 AM–noon ET)
**Exit:** Set & forget. TP/SL placed at entry. No manual intervention.

**When to adjust:**
- If 3+ losses in 48h → Check if zones are too tight. Consider widening entry zone by 5-10 pips.
- If win rate < 40% over 20 trades → Review zone quality. May need to filter for fresh zones only.
- High-impact news days (NFP, FOMC, BOE) → Consider skipping or reducing position size 50%.

---

## Bitcoin Bob — Impulse Zone Trading

**Pairs:** BTC/USD, ETH/USD
**Timeframes:** 1H impulse identification → 15M entry refinement
**Entry:** Pullback to 50% of impulse zone that moved 2.5x ATR
**R:R:** Minimum 1:2
**Window:** 24/7 (crypto never sleeps)

**When to adjust:**
- BTC volatility compression (ATR dropping) → Widen zone criteria or sit out
- Major crypto events (halving, ETF decisions, regulatory) → Reduce position size 50%
- If correlation with equities is high → Watch for overnight gap risk on BTC

---

## Pivot Pete — Daily Pivot Level Trading

**Instruments:** ES (E-mini S&P 500)
**Timeframes:** Daily pivots (PP, R1-R3, S1-S3) + VWAP
**Entry:** Bounce off pivot level with confirmation (volume + price action)
**R:R:** Minimum 1:2
**Window:** RTH only (9:30 AM–4 PM ET)

**When to adjust:**
- VIX > 25 → Widen stops by 20%. VIX > 35 → Stand down.
- FOMC days → No trades until 30 min after announcement
- Trending day (3+ pivots broken in one direction) → Stop counter-trend entries

---

## Boba — Options S&D Zone Trading

**Instruments:** SPY options (calls/puts)
**Timeframes:** 15M supply/demand zones
**Entry:** Zone touch with volume confirmation
**Window:** 9:30–11:00 AM ET ONLY. ONE trade per day maximum.
**Exit:** Scale out: 25% at +15%, 50% at +20-25%, 25% runner

**When to adjust:**
- FOMC/CPI days → NO TRADES (sit out entirely)
- If SPY gap > 1% → Wait 15 min before first entry
- If VIX > 30 → Reduce position size 50%

---

## SPX Sniper — 0DTE Scalping

**Instruments:** SPX 0DTE options
**Timeframes:** 5M chart (VWAP + EMA9 + RSI)
**Entry:** After 10:30 AM gate. VWAP cross + EMA9 confirmation + RSI not extreme
**Window:** 10:30 AM–3:30 PM ET. 45 min max hold per trade.
**Max trades:** 2 per day

**When to adjust:**
- 0DTE theta decay accelerates after 2 PM → Tighter stops after 2 PM
- If first trade is a loss → Reduce size 50% on second trade
- Expiration Friday → Extra caution, reduce position size

---

## Global Strategy Rules (Chief enforces)

1. **No averaging down** — Never add to a losing position
2. **No revenge trading** — After a loss, wait minimum 15 minutes
3. **No trading against the regime** — If RegimeDetector says HIGH_VOL, only Overseer-approved trades
4. **News blackout** — 15 min before and after high-impact news, no new entries
5. **Correlation check** — If 2 positions in same correlation group, no 3rd entry
