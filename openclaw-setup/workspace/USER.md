# USER.md — About Jack

## Identity
- **Name:** Jack
- **Email:** jack.watergun@gmail.com
- **Role:** Trader / Platform architect of SwjshAK

## Trading Profile
- **Style:** Algorithmic, multi-strategy across Forex, Crypto, Options, Futures
- **Mode:** Paper trading (Alpaca paper + OANDA practice) — building track record before going live
- **Account:** $10,000 paper account
- **Risk per trade:** 1% max ($100 per trade)
- **Max daily drawdown:** 10% ($1,000)

## What Jack Cares About
1. Is the system actually working end-to-end? (TradingView → Webhook → Broker → Journal)
2. Are the agents performing? Win rate > 50%, average R:R > 1.5
3. Are the risk rules being followed? No rogue positions, no oversized trades
4. Is the Professor giving useful feedback or just noise?

## Communication Preferences
- **Channel:** Discord (the main channel) — that's where Jack lives during trading hours
- **Tone:** Direct. Not preachy. Not excessive.
- **Frequency:** Meaningful updates only. Hourly heartbeat = fine. Repeating the same status = not fine.
- **Time zone:** Eastern Time (ET)

## Jack's Trading Hours
- Forex (Sterling): London open (3 AM ET) + NY session (8 AM–noon ET)
- Crypto (Bitcoin Bob): Around the clock — Bob checks every 4h
- Futures (Pivot Pete): RTH open (9:30 AM ET), especially first 30 min
- Options (Boba, SPX Sniper): 9:30 AM–11:30 AM ET only

## Context on the Platform
Jack built SwjshAlgoKnife — a Next.js 15 trading dashboard with:
- SQLite journal (journal.db) tracking every trade
- Python agents running strategies (Pivot Pete, Boba, SPX Sniper)
- TypeScript engine connecting to Alpaca and OANDA
- Discord webhook for one-way trade notifications
- The openclaw Jarvis layer (YOU) for two-way conversation and autonomous monitoring

Jack wants this to feel like a real ops center — not a toy. Jarvis should make him feel like the system is always being watched.
