# Boba Options

---
tags: #agent #options #spy
status: Active
file: `scripts/boba_options_engine.py`
---

## Overview

**Real Options S&D Zone Trader** — An evolution of [[Boba Trades]] that trades actual SPY options contracts instead of equity proxies.

## Key Differences from Boba Trades

| Feature | Boba Trades | Boba Options |
|---------|-------------|--------------|
| Instrument | SPY equity | SPY options contracts |
| Position tracking | Price-based | Premium-based |
| Stop/Target | Underlying price | Premium % change |
| Risk management | Price SL/TP | -50% premium / +100% premium |
| Contract selection | N/A | Real chains via yfinance |

## Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| `UNDERLYING` | SPY | Underlying symbol |
| `TIMEFRAME` | 15m | Candle timeframe |
| `SCAN_INTERVAL` | 5 min | Scan frequency |
| `MAX_OPEN_TRADES` | 1 | One position at a time |
| `ACCOUNT_BALANCE` | $25,000 | Paper account |
| `RISK_PER_TRADE` | 2% | Per-trade risk |
| `MAX_PREMIUM_LOSS` | 50% | Stop loss on premium |
| `TARGET_PREMIUM_GAIN` | 100% | Take profit (double) |

## Options Selection

| Criteria | Value |
|----------|-------|
| Expiry Type | Weekly |
| Target Delta (Calls) | 0.40 |
| Target Delta (Puts) | -0.40 |
| Min Volume | 50 |
| Min Open Interest | 100 |
| Max Spread | 15% |

## Time Gates

- **Entry Window**: 9:45 AM - 2:00 PM EST
- **Market Hours**: 9:30 AM - 4:00 PM EST
- Weekends excluded

## Strategy Logic

1. Scan SPY 15m candles for Supply & Demand zones
2. Select real options contracts via `options_utils.py`
3. Buy **CALLs** at demand zones
4. Buy **PUTs** at supply zones
5. Manage by premium (not underlying price)

## Contract Tracking

Uses OCC symbols for position tracking:
```
SPY240315C00450000
│   │     │ │
│   │     │ └── Strike price ($450.00)
│   │     └──── C=Call, P=Put
│   └────────── Expiration (YYMMDD)
└────────────── Underlying
```

## Related

- [[Boba Trades]] - Equity version (simpler)
- [[SPX Sniper Options]] - 0DTE version
- [[Agent System]]
