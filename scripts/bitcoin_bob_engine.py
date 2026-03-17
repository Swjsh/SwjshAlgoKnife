"""
Bitcoin Bob Agent - Crypto Supply & Demand Zone Trader
=======================================================
• Scans BTC, ETH, SOL for fresh Supply/Demand zones (every SCAN_INTERVAL_MIN minutes)
• Monitors prices every TICK_INTERVAL_SEC seconds
• Fires webhooks to the Next.js executor when price enters a zone
• Manages open trades: tracks stop-loss and take-profit, fires EXIT when hit
• Prints AGENT_STATUS_UPDATE:{json} so agent_runner.ts can track it on the dashboard
• 100% paper — uses Alpaca Paper via the webhook → executor → Alpaca chain
"""

import yfinance as yf
import pandas as pd
import numpy as np
import json
from utils.retry import retry, retry_on_empty
import time
import requests
from pathlib import Path
from datetime import datetime
from agent_utils import log_message, get_random_quip, save_agent_state, load_agent_state
from data_feeds import build_feed_for_agent, get_latest_price

# ── Config ────────────────────────────────────────────────────────────────────
WEBHOOK_URL       = "http://localhost:3000/api/webhook/tradingview"
WEBHOOK_SECRET    = os.getenv("WEBHOOK_SECRET", "changeme")
PAIRS             = ['BTC-USD', 'ETH-USD', 'SOL-USD']
TIMEFRAME         = '1h'
PERIOD            = '30d'
ATR_PERIOD        = 14
IMPULSE_MULT      = 2.5      # ATR multiplier for impulse candle detection
RISK_REWARD       = 2.5      # Take profit at R:R 2.5
SCAN_INTERVAL_MIN = 30       # Full S/R zone rescan every 30 minutes
TICK_INTERVAL_SEC = 60       # Price check every 60 seconds
MAX_OPEN_TRADES   = 2        # Don't open more than 2 crypto positions at once
STATUS_FILE       = Path(__file__).parent.parent / 'data' / 'crypto_agent_status.json'

# Alpaca symbol map (yfinance ticker → Alpaca format)
YF_TO_ALPACA = {'BTC-USD': 'BTC/USD', 'ETH-USD': 'ETH/USD', 'SOL-USD': 'SOL/USD'}
# Webhook symbol map (yfinance ticker → signal symbol)
YF_TO_SIGNAL = {'BTC-USD': 'BTCUSD', 'ETH-USD': 'ETHUSD', 'SOL-USD': 'SOLUSD'}

# ── ATR ───────────────────────────────────────────────────────────────────────
def calculate_atr(df, period=14):
    high_low   = df['High'] - df['Low']
    high_close = np.abs(df['High'] - df['Close'].shift())
    low_close  = np.abs(df['Low']  - df['Close'].shift())
    true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    return true_range.rolling(period).mean()

# ── Zone Detection ────────────────────────────────────────────────────────────
def find_zones(df, atr_series):
    zones = []
    for i in range(len(df) - 2, 20, -1):
        body_size = abs(df['Close'].iloc[i] - df['Open'].iloc[i])
        atr       = atr_series.iloc[i]
        if body_size < (atr * IMPULSE_MULT):
            continue

        is_bullish  = df['Close'].iloc[i] > df['Open'].iloc[i]
        base_high   = df['High'].iloc[i - 1]
        base_low    = df['Low'].iloc[i - 1]
        zone_type   = "DEMAND" if is_bullish else "SUPPLY"

        # Freshness check: zone must not have been touched since formation
        future = df.iloc[i + 1:]
        if zone_type == "DEMAND" and future['Low'].min() <= base_high:
            continue
        if zone_type == "SUPPLY" and future['High'].max() >= base_low:
            continue

        buf         = (base_high - base_low) * 0.2
        stop_loss   = round(base_low  - buf, 2) if zone_type == "DEMAND" else round(base_high + buf, 2)
        entry_price = round(base_high, 2)        if zone_type == "DEMAND" else round(base_low,  2)
        risk        = abs(entry_price - stop_loss)
        take_profit = round(entry_price + risk * RISK_REWARD, 2) if zone_type == "DEMAND" \
                      else round(entry_price - risk * RISK_REWARD, 2)

        zones.append({
            'created_at': df.index[i].strftime('%Y-%m-%d %H:%M'),
            'type':       zone_type,
            'top':        round(base_high, 2),
            'bottom':     round(base_low,  2),
            'entry':      entry_price,
            'stop_loss':  stop_loss,
            'take_profit': take_profit,
            'status':     'PENDING',
            'triggered':  False,
        })
    return zones

# ── Current Price ─────────────────────────────────────────────────────────────
@retry(max_retries=3, base_delay=2.0)
def get_current_price(ticker: str) -> float | None:
    """
    Get current price. Uses Binance WebSocket cache first (real-time, no auth),
    falls back to yfinance REST if cache is stale.
    """
    # Try real-time WebSocket cache first (BTC-USD, ETH-USD, SOL-USD)
    price = get_latest_price(ticker, max_cache_age=10.0)
    if price:
        return price
    # yfinance fallback
    t   = yf.Ticker(ticker)
    hist = t.history(period='1d', interval='5m')
    if not hist.empty:
        return float(hist['Close'].iloc[-1])
    return None

# ── Webhook Fire ──────────────────────────────────────────────────────────────
def fire_signal(ticker: str, action: str, price: float, stop_loss: float = None,
                take_profit: float = None, reason: str = "") -> bool:
    symbol = YF_TO_SIGNAL.get(ticker, ticker.replace('-', ''))
    payload = {
        "symbol":      symbol,
        "action":      action,        # BUY / SELL / EXIT
        "price":       price,
        "strategy":    "BitcoinBob_SR",
        "stopLoss":    stop_loss,
        "takeProfit":  take_profit,
        "notes":       reason or f"Bob: {action} {symbol} @ {price}",
    }
    headers = {
        "Content-Type":    "application/json",
        "X-Webhook-Secret": WEBHOOK_SECRET,
    }
    try:
        resp = requests.post(WEBHOOK_URL, json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            print(f"[Bob] ✅ Signal sent: {action} {symbol} @ ${price:.2f}")
            log_message('crypto', f"🔔 {action} {symbol} @ ${price:.2f} | {reason}", type='trade')
            return True
        else:
            print(f"[Bob] ❌ Webhook failed {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"[Bob] ❌ Webhook error: {e}")
        return False

# ── Status Broadcast ─────────────────────────────────────────────────────────
def broadcast_status(zones: list, active_trades: list, scan_count: int, prices: dict):
    state = {
        "id":           "bitcoin_bob",
        "name":         "Bitcoin Bob",
        "status":       "ACTIVE",
        "last_updated": datetime.now().isoformat(),
        "active_pairs": len(PAIRS),
        "scan_count":   scan_count,
        "pending_orders": [z for z in zones if z.get('status') == 'PENDING'][:10],
        "active_trades":  active_trades,
        "live_prices":    prices,
        "total_zones_found": len(zones),
        "performance": {
            "win_rate":  0,
            "total_pnl": 0,
            "trades":    len([t for t in active_trades if t.get('closed')])
        }
    }
    # Save JSON for dashboard
    STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATUS_FILE, 'w') as f:
        json.dump(state, f, indent=2)
    # Print to stdout for agent_runner.ts
    print(f"AGENT_STATUS_UPDATE:{json.dumps({'agentId': 'bitcoin_bob', 'status': 'ACTIVE', 'message': f'Tracking {len(zones)} zones | Prices: {prices}', 'timestamp': datetime.now().isoformat()})}", flush=True)

# ── Zone Scan ─────────────────────────────────────────────────────────────────
def run_scan() -> dict:
    """Full S/R zone scan across all pairs. Returns {ticker: [zones]}."""
    all_zones = {}
    print(f"[Bob] 🔍 Running zone scan at {datetime.now().strftime('%H:%M:%S')}...")
    for pair in PAIRS:
        try:
            data = yf.download(pair, period=PERIOD, interval=TIMEFRAME, progress=False)
            if data.empty:
                print(f"[Bob] ⚠️ No data for {pair}")
                continue
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)
            atr   = calculate_atr(data, ATR_PERIOD)
            zones = find_zones(data, atr)
            print(f"[Bob] {pair}: {len(zones)} fresh zones found")
            all_zones[pair] = zones
        except Exception as e:
            print(f"[Bob] ❌ Scan error for {pair}: {e}")
            # Don't clear existing zones on scan failure
            if pair not in all_zones:
                all_zones[pair] = []
    return all_zones

# ── Trade Monitor ─────────────────────────────────────────────────────────────
def check_trade_exits(active_trades: list, prices: dict) -> list:
    """Check if any open trade has hit TP or SL. Fires EXIT signal and removes it."""
    remaining = []
    for trade in active_trades:
        ticker = trade['ticker']
        price  = prices.get(ticker)
        if price is None:
            remaining.append(trade)
            continue

        hit_tp = hit_sl = False
        if trade['direction'] == 'LONG':
            hit_tp = price >= trade['take_profit']
            hit_sl = price <= trade['stop_loss']
        else:
            hit_tp = price <= trade['take_profit']
            hit_sl = price >= trade['stop_loss']

        if hit_tp:
            reason = f"Take profit hit @ ${price:.2f} (TP: ${trade['take_profit']:.2f})"
            fire_signal(ticker, 'EXIT', price, reason=reason)
            log_message('crypto', f"🎯 TP HIT: {YF_TO_SIGNAL.get(ticker, ticker)} +{RISK_REWARD}R", type='trade')
            print(f"[Bob] 🎯 TP hit: {ticker} @ ${price:.2f}")
        elif hit_sl:
            reason = f"Stop loss hit @ ${price:.2f} (SL: ${trade['stop_loss']:.2f})"
            fire_signal(ticker, 'EXIT', price, reason=reason)
            log_message('crypto', f"🛑 SL HIT: {YF_TO_SIGNAL.get(ticker, ticker)} -1R", type='trade')
            print(f"[Bob] 🛑 SL hit: {ticker} @ ${price:.2f}")
        else:
            remaining.append(trade)

    return remaining

# ── Zone Entry Check ──────────────────────────────────────────────────────────
def check_zone_entries(zones_by_pair: dict, active_trades: list, prices: dict) -> tuple:
    """Check if price has entered any PENDING zone. Returns (updated_zones, updated_trades)."""
    # Tickers already in active trade
    open_tickers = {t['ticker'] for t in active_trades}

    for pair, zones in zones_by_pair.items():
        price = prices.get(pair)
        if price is None:
            continue

        # Don't open another trade if we already have one for this pair or at max
        if pair in open_tickers:
            continue
        if len(active_trades) >= MAX_OPEN_TRADES:
            continue

        for zone in zones:
            if zone.get('triggered') or zone.get('status') != 'PENDING':
                continue

            entered = False
            action  = None

            if zone['type'] == 'DEMAND' and zone['bottom'] <= price <= zone['top']:
                entered = True
                action  = 'BUY'
            elif zone['type'] == 'SUPPLY' and zone['bottom'] <= price <= zone['top']:
                entered = True
                action  = 'SELL'

            if entered and action:
                print(f"[Bob] ⚡ Zone entry: {pair} {action} @ ${price:.2f} (zone {zone['bottom']}-{zone['top']})")
                success = fire_signal(
                    ticker=pair,
                    action=action,
                    price=price,
                    stop_loss=zone['stop_loss'],
                    take_profit=zone['take_profit'],
                    reason=f"S/R {zone['type']} zone entry",
                )
                if success:
                    zone['triggered'] = True
                    zone['status']    = 'TRIGGERED'
                    active_trades.append({
                        'ticker':       pair,
                        'direction':    'LONG' if action == 'BUY' else 'SHORT',
                        'entry_price':  price,
                        'stop_loss':    zone['stop_loss'],
                        'take_profit':  zone['take_profit'],
                        'opened_at':    datetime.now().isoformat(),
                    })
                    open_tickers.add(pair)
                break  # Only one entry per pair per tick

    return zones_by_pair, active_trades

# ── Main Loop ─────────────────────────────────────────────────────────────────
def run():
    print(f"""
╔══════════════════════════════════════════╗
║       BITCOIN BOB  —  S/R Zone Trader    ║
║  Pairs: {', '.join(PAIRS)}     ║
║  Scan: every {SCAN_INTERVAL_MIN}min | Tick: every {TICK_INTERVAL_SEC}s  ║
║  Max open positions: {MAX_OPEN_TRADES}                   ║
╚══════════════════════════════════════════╝
""")
    log_message('crypto', get_random_quip('crypto'))
    log_message('crypto', f"🚀 Bitcoin Bob online — scanning {', '.join(PAIRS)}")

    # Start Binance WebSocket feed (FREE, no auth needed for BTC/ETH/SOL)
    _price_feed = build_feed_for_agent('bitcoin_bob')

    # ── Restore persisted state ──────────────────────────────────────────────
    saved = load_agent_state('bitcoin_bob')
    zones_by_pair   = saved.get('zones_by_pair', {})
    active_trades   = saved.get('active_trades', [])
    scan_count      = saved.get('scan_count', 0)
    if active_trades:
        print(f"[Bob] Restored {len(active_trades)} active trades from saved state")
    last_scan_time  = 0 if not zones_by_pair else time.time()

    while True:
        now = time.time()

        # ── Periodic zone rescan ──────────────────────────────────────────────
        if now - last_scan_time >= SCAN_INTERVAL_MIN * 60:
            # Preserve triggered state so we don't re-enter the same zones
            triggered = {}
            for pair, zones in zones_by_pair.items():
                triggered[pair] = {(z['top'], z['bottom']): z.get('status') for z in zones}

            zones_by_pair  = run_scan()
            last_scan_time = now
            scan_count    += 1

            # Restore triggered state on re-scanned zones
            for pair, zones in zones_by_pair.items():
                for z in zones:
                    key = (z['top'], z['bottom'])
                    if triggered.get(pair, {}).get(key) == 'TRIGGERED':
                        z['triggered'] = True
                        z['status']    = 'TRIGGERED'

        # ── Fetch live prices ─────────────────────────────────────────────────
        prices = {}
        for pair in PAIRS:
            p = get_current_price(pair)
            if p:
                prices[pair] = p
        if prices:
            price_str = ' | '.join([f"{p.replace('-USD','')}: ${v:,.0f}" for p, v in prices.items()])
            print(f"[Bob] 💰 {price_str}")

        # ── Check open trade exits ────────────────────────────────────────────
        if active_trades:
            active_trades = check_trade_exits(active_trades, prices)

        # ── Check zone entries ────────────────────────────────────────────────
        if zones_by_pair:
            zones_by_pair, active_trades = check_zone_entries(zones_by_pair, active_trades, prices)

        # ── Persist state ────────────────────────────────────────────────────
        save_agent_state('bitcoin_bob', {
            'zones_by_pair': {p: [{k: v for k, v in z.items() if k in (
                'created_at','type','top','bottom','entry','stop_loss',
                'take_profit','status','triggered'
            )} for z in zs] for p, zs in zones_by_pair.items()},
            'active_trades': active_trades,
            'scan_count': scan_count,
        })

        # ── Broadcast status ──────────────────────────────────────────────────
        all_zones = [z for zones in zones_by_pair.values() for z in zones]
        broadcast_status(all_zones, active_trades, scan_count, prices)

        time.sleep(TICK_INTERVAL_SEC)

if __name__ == "__main__":
    run()
