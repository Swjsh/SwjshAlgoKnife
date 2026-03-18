# Paper Trading Week — Action Plan

**Goal:** Every agent paper trading on real data by end of week (March 21, 2026).

**Date Created:** 2026-03-15

---

## Step 0: Preflight (Today, Sunday)

```bash
python scripts/preflight_check.py
```

Fix every FAIL before proceeding. The most critical items:

1. **OANDA practice account** — Sign up at [practice.oanda.com](https://practice.oanda.com) if you don't have one. Free, takes 2 minutes. Get your API token from Account Settings → API.
2. **Alpaca paper account** — Sign up at [app.alpaca.markets](https://app.alpaca.markets). Enable paper trading. Get API keys.
3. **`.env.local`** must have all keys populated (see the preflight output for what's missing).
4. **Start the dashboard**: `npm run dev` — agents need the webhook endpoint running.

---

## Step 1: Backtest Every Strategy (Monday)

Run the universal backtester on real data for each agent's target asset. This tells you which strategies actually produce signals and what their performance looks like BEFORE you risk paper money.

```bash
# Pivot Pete — ES futures (via real ES=F data, not SPY proxy!)
python scripts/universal_backtest.py --symbol ES=F --strategy pivot --from 2025-06-01 --to 2026-03-14 --tf 5m

# Bitcoin Bob — BTC
python scripts/universal_backtest.py --symbol BTC-USD --strategy bb_squeeze --from 2025-06-01 --to 2026-03-14 --tf 1h

# Sterling — Forex
python scripts/universal_backtest.py --symbol EURUSD=X --strategy supp_res --from 2025-06-01 --to 2026-03-14 --tf 15m
python scripts/universal_backtest.py --symbol GBPUSD=X --strategy supp_res --from 2025-06-01 --to 2026-03-14 --tf 15m

# Boba — SPY (equity proxy until options logic built)
python scripts/universal_backtest.py --symbol SPY --strategy supp_res --from 2025-06-01 --to 2026-03-14 --tf 5m

# SPX Sniper — SPX via SPY proxy
python scripts/universal_backtest.py --symbol SPY --strategy orb --from 2025-06-01 --to 2026-03-14 --tf 5m

# Run ALL strategies on SPY to compare
python scripts/universal_backtest.py --symbol SPY --strategy all --from 2025-06-01 --to 2026-03-14 --tf 1d
```

Review the JSON reports in `data/backtests/`. Kill any strategy that shows negative expectancy.

---

## Step 2: Start the 3 Ready Agents (Tuesday)

These 3 agents can paper trade TODAY with minimal changes:

### Agent 1: Bitcoin Bob (Crypto via Alpaca)
```bash
# Verify Alpaca crypto paper is enabled
python -c "import requests; r=requests.get('https://paper-api.alpaca.markets/v2/account', headers={'APCA-API-KEY-ID':'YOUR_KEY','APCA-API-SECRET-KEY':'YOUR_SECRET'}); print(r.json()['crypto_status'])"

# Start the agent
python scripts/run_pivot_pete.py  # (or bitcoin_bob_engine directly)
```

**What to watch:** Check `data/crypto_agent_status.json` updates every 30s. Verify webhook signals are hitting `/api/webhook/tradingview` in your Next.js logs.

### Agent 2: Sterling FX (Forex via OANDA Practice)
```bash
python scripts/sterling_fx_engine.py
```

**What to watch:** `data/forex_agent_status.json`. Verify OANDA practice account shows open positions.

### Agent 3: Pivot Pete (Futures via OANDA CFD)
```bash
python scripts/run_pivot_pete.py
```

**What to watch:** `data/futures_agent_status.json`. This uses US500_USD (CFD proxy for ES). Good enough for paper trading validation.

### Or start all 3 at once:
```bash
npx tsx scripts/agent_runner.ts
```

---

## Step 3: Build Real Options Logic (Wednesday-Thursday)

This is the hard part. Boba and SPX Sniper currently trade SPY equity as a proxy. Here's what needs to change:

### 3a. Options Data Source
yfinance provides options chains:
```python
import yfinance as yf
spy = yf.Ticker("SPY")
# Get available expiration dates
print(spy.options)
# Get specific chain
chain = spy.option_chain("2026-03-20")
calls = chain.calls  # strike, lastPrice, bid, ask, volume, openInterest, impliedVolatility
puts = chain.puts
```

### 3b. Strike Selection Logic (NEW FILE NEEDED)
Create `scripts/options_utils.py`:
- **ATM strike**: closest to current price
- **OTM by delta**: select strike by target delta (e.g., 0.30 delta call)
- **Spread width**: for credit/debit spreads
- **Expiration selection**: 0DTE, weekly, monthly
- **IV rank filter**: only trade when IV is in a favorable range

### 3c. Update Boba Engine
In `boba_trades_engine.py`:
- Replace equity price tracking with options chain polling
- Add strike selection based on zone proximity
- Model premium decay (theta) in position sizing
- Set realistic SL/TP based on premium (not underlying price)

### 3d. Update SPX Sniper
In `spx_sniper_engine.py`:
- Switch from SPY equity to actual SPX options chain
- Add 0DTE-specific logic: wider stops early session, tighter after 2pm
- Model rapid theta decay for day-of-expiry positions
- Add max loss per day as hard kill switch

---

## Step 4: Wire the Professor (Friday)

The Professor grades trades but is never called. Fix this:

### In `agent_runner.ts`:
When a trade closes (detected via AGENT_STATUS_UPDATE), call TheProfessor.gradeTrade() and append the review to agents_db.json.

### In each Python engine:
After a trade exit, emit a TRADE_CLOSED event:
```python
print(f'AGENT_STATUS_UPDATE:{json.dumps({"event": "trade_closed", "trade": trade_data})}')
```

### In the orchestrator:
Parse TRADE_CLOSED events and feed them to the_professor.py for grading.

---

## Step 5: Connect PaperTradingEngine (Friday)

The TypeScript `PaperTradingEngine` in `src/lib/engine/paper-trading.ts` is fully built but orphaned. Options:

**Option A (Quick):** Keep using webhook flow. Agents → webhook → executor → broker. This already works.

**Option B (Better):** Route agent signals through PaperTradingEngine instead of real broker API during paper mode. Add a `PAPER_MODE=true` env var that makes TradeExecutor use PaperTradingEngine instead of Alpaca/OANDA.

---

## Daily Monitoring Checklist

Once agents are running, check these daily:

```
[ ] All agents showing "active" in agents_db.json
[ ] No agent has been restarted more than 3x in 24h
[ ] Daily PnL within acceptable range (no runaway losses)
[ ] Webhook endpoint responding (curl localhost:3000/api/health)
[ ] OANDA practice balance stable (no unexpected trades)
[ ] Alpaca paper account balance stable
[ ] Backtest results saved for any parameter changes
[ ] Professor grades on closed trades (if wired)
```

---

## Architecture Improvements (Post-Week)

Based on the code audit, these are the top issues to fix after paper trading is stable:

1. **Kill switch enforcement** — `KillSwitch.ts` exists but doesn't actually block trades. Make it gate the executor.
2. **Real-time data** — Replace yfinance polling (15min delay) with Alpaca WebSocket for equities/crypto and OANDA streaming for FX.
3. **Agent health monitoring** — Add heartbeat checks. If an agent hasn't emitted a status update in 5 minutes, alert via Discord.
4. **Trade feedback loop** — Closed trades should feed back into agent state so strategies can adapt (e.g., widen stops after 3 consecutive losses).
5. **Consolidate auth** — Firebase + Clerk is redundant. Pick one.
6. **Proper futures data** — Replace ETF proxies with actual futures feed when budget allows (Polygon.io or similar).
