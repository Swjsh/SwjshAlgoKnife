# TOOLS.md — Data & Integration Points (GCP)

Project: /home/jackw/SwjshAlgoKnife

## Key Files
- /home/jackw/SwjshAlgoKnife/data/agents_db.json — agent runtime state
- /home/jackw/SwjshAlgoKnife/journal.db — SQLite: trades, signals, journal_entries
- /home/jackw/SwjshAlgoKnife/.env.local — API credentials (never log values)
- /home/jackw/SwjshAlgoKnife/data/brain/ — The Brain (master-tracker, strategies, decisions, daily-log)

## Control API (PRIMARY ACTION TOOL)
GET  http://localhost:3000/api/control — system status snapshot
POST http://localhost:3000/api/control — execute commands:
  {"command":"pause","agentId":"<id>","reason":"..."}
  {"command":"resume","agentId":"<id>","reason":"..."}
  {"command":"killswitch","reason":"..."}
  {"command":"summary"}

## SQLite Schema (journal.db)
  trades(id, symbol, direction, entry_price, exit_price, stop_loss, pnl, strategy, status, entry_date, exit_date, notes)
  signals(id, symbol, action, price, strategy, timestamp, processed)

## Brokers
- Alpaca Paper: https://paper-api.alpaca.markets/v2/ | keys: APCA_API_KEY_ID, APCA_API_SECRET_KEY
- OANDA Practice: https://api-fxpractice.oanda.com/v3/ | token: OANDA_API_TOKEN

## Webhook
POST http://localhost:3000/api/webhook/tradingview
  Header: X-Webhook-Secret: {WEBHOOK_SECRET}
  Body: {"symbol":"EURUSD","action":"BUY","price":1.0842,"strategy":"ThreeDucks"}
