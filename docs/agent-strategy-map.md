# AlgoKnife Agent-Strategy Map

> Last updated: 2026-02-14

## Trading Agents

| Agent | Name | Strategy | Market | Assets | Broker | Status |
|-------|------|----------|--------|--------|--------|--------|
| `fx` | Sterling | Set & Forget S&D (FXAlexG) | Forex | EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD | **OANDA Practice** ✅ | READY |
| `boba` | Boba | 15min S&D Zone Reversals | Options/Equities | SPY, QQQ | **Alpaca Paper** ✅ | READY |
| `crypto` | Bitcoin Bob | Volume Impulse & HODL Zones | Crypto | BTC, ETH, SOL | ❌ Unlinked | READY |
| `futures` | Pivot Pete | Multi-TF Pivot Point Rejections | Futures | ES, NQ, GC | ❌ Unlinked | READY |
| `spx` | SPX Sniper | 0DTE VWAP + Momentum | Options | SPX 0DTE | ❌ Unlinked | READY |
| `orb` | ORB Runner | Opening Range Breakout (NeverStoppedout) | Futures | MNQ | ❌ Unlinked | READY |

## Oversight Agents

| Agent | Name | Role | Trades? | Broker |
|-------|------|------|---------|--------|
| `professor` | The Professor | Trade Auditor & Grader (A+ to F) | No | Not needed |
| `auditor` | The Auditor | Fact-Checker & Validator | No | Not needed |

## Strategy Quick Reference

### Sterling — Set & Forget
- **Source:** FXAlexG 5-Box System
- **Method:** Weekly→Daily→4H top-down, limit orders at fresh S&D zones
- **RR:** 1:3 to 1:6 | **Risk:** 1-2% per trade
- **Sessions:** London & New York only
- **Doc:** `docs/strategies/sterling_fx.md`, `docs/fxalexg/STRATEGY_SPEC.md`

### Boba — 15min S&D Zone Reversals
- **Source:** Custom supply/demand reversal strategy
- **Method:** Mark 15m S&D zones, trade fresh zone reactions in first 90 min
- **RR:** 1:2+ | **Risk:** 10% max position, 15% stop loss
- **Scaling:** +15% close 25%, +25% close 50%, +30% let 25% run
- **Sessions:** NY Open 9:30-11:00 AM EST
- **Doc:** `docs/boba_strategy/STRATEGY_RULES.md`

### Bitcoin Bob — Volume Impulse & HODL Zones
- **Source:** Volume profile + historical S/R
- **Method:** POC detection, liquidation cascade breakouts, deep-discount entries
- **RR:** 1:2+ | **Risk:** 1-3% per trade
- **Sessions:** 24/7
- **Doc:** `docs/agents/crypto/profile.md`

### Pivot Pete — Pivot Point Rejections
- **Source:** Socrates Investments methodology
- **Method:** Monthly/Weekly/Daily pivots, volume-confirmed rejections, multi-pivot confluence
- **RR:** Next pivot level | **Risk:** 1-2%, max 4 trades/day
- **Hard Rule:** 2 consecutive losses = done for day
- **Sessions:** London & New York
- **Doc:** `docs/agents/pivot-pete.md`

### SPX Sniper — 0DTE VWAP + Momentum
- **Source:** VWAP anchoring + tick momentum
- **Method:** VWAP trend filter → momentum burst detection → 0DTE option entry
- **RR:** 1:2+ | **Risk:** Dynamic (high leverage, low duration)
- **Sessions:** NY Session 9:30 AM - 4:00 PM EST
- **Doc:** `docs/agents/spx/profile.md`

### ORB Runner — Opening Range Breakout
- **Source:** NeverStoppedout (54+ consecutive green days)
- **Method:** 15min ORB on MNQ. Standard breakout, Inverse ORB (wide range), ES/NQ divergence
- **RR:** 1:1+ (range = target) | **Discipline:** 15-min lockout, walk-away rule
- **Sessions:** 9:30-9:45 AM ORB mark, then trade
- **Doc:** `theories/NeverStoppedout-ORB.md`

## Broker Summary

| Broker | Type | Agents | Assets | Status |
|--------|------|--------|--------|--------|
| OANDA Practice | Demo | Sterling | Forex | ✅ Linked |
| Alpaca Paper | Paper | Boba | US Equities/ETFs | ✅ Linked |
| TBD Futures | — | Pivot Pete, ORB Runner | ES/NQ/MNQ/GC | ❌ Needed |
| TBD Options | — | SPX Sniper, (Boba) | SPX/SPY/QQQ options | ❌ Needed |
| TBD Crypto | — | Bitcoin Bob | BTC/ETH/SOL | ❌ Needed |

## What's Missing

1. **Futures broker** — Pivot Pete & ORB Runner are grounded. Tradovate offers free demo.
2. **Options broker** — SPX Sniper can't fire without 0DTE access. Boba also needs this for options legs.
3. **Crypto exchange** — Bitcoin Bob is analysis-only until an exchange API is connected.
4. **Live data feeds** — Futures agents currently rely on yfinance (15-20min delay).
