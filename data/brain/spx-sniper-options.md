# SPX Sniper Options

---
tags: #agent #options #0dte #scalping
status: Active
file: `scripts/spx_sniper_options_engine.py`
---

## Overview

**Real 0DTE Options Scalper** — An evolution of [[SPX Sniper]] that trades actual same-day expiration SPY options contracts.

## Key Differences from SPX Sniper

| Feature | SPX Sniper | SPX Sniper Options |
|---------|------------|-------------------|
| Instrument | SPY equity proxy | SPY 0DTE options |
| Position tracking | Price-based | Premium-based |
| Stop/Target | Price SL/TP | Premium % change |
| Daily limits | None | 3 trades, 2 losses max |
| Late session | Same rules | Tighter stops (theta) |

## The Gold Rules

1. **Time Gate**: No trades before 10:30 AM or after 2:30 PM EST
2. **Trend Following**: Trade with 9 EMA + VWAP alignment
3. **Pulse Check**: Momentum confirmation via RSI
4. **0DTE Only**: Same-day expiration contracts

## Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| `SPX_TICKER` | ^SPX | Price action source |
| `OPTIONS_UNDERLYING` | SPY | Options chain (more liquid) |
| `TIMEFRAME` | 5m | Candle timeframe |
| `SCAN_INTERVAL` | 5 min | Scan frequency |
| `MAX_DAILY_TRADES` | 3 | Max trades per day |
| `MAX_DAILY_LOSSES` | 2 | Stop after 2 losses |
| `RISK_PER_TRADE` | 1.5% | Tighter for 0DTE |

## Premium Risk Management

| Time | Premium Stop | Premium Target |
|------|--------------|----------------|
| Before 2:00 PM | -40% | +60% |
| After 2:00 PM | -25% | +60% |

Tighter stops after 2 PM due to **theta acceleration** on 0DTE contracts.

## Options Selection

| Criteria | Value |
|----------|-------|
| Expiry | Same day (0DTE) |
| Min Volume | 100 |
| Min Open Interest | 200 |
| Max Spread | 10% |

## Indicators

- **EMA 9** — Trend direction
- **VWAP** — Institutional anchor
- **RSI 14** — Momentum confirmation

## Entry Logic

**CALL Entry**:
- Price above EMA 9
- Price above VWAP
- RSI showing bullish momentum
- Within time gate (10:30 AM - 2:30 PM)

**PUT Entry**:
- Price below EMA 9
- Price below VWAP
- RSI showing bearish momentum
- Within time gate

## Daily Discipline

- After 2 losing trades → **DONE for the day**
- After 3 total trades → **DONE for the day**
- Prevents revenge trading and overtrading

## Related

- [[SPX Sniper]] - Equity version (simpler)
- [[Boba Options]] - Multi-day options
- [[Agent System]]
