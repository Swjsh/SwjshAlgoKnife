"""
Digital Dash Agent - VWAP Mean Reversion Trader for Crypto
==========================================================
• Scans BTC-USD, ETH-USD, SOL-USD for VWAP mean reversion setups (every SCAN_INTERVAL_MIN minutes)
• Monitors prices every TICK_INTERVAL_SEC seconds
• **DIRECT ALPACA**: Submits orders directly to Alpaca API (no webhooks)
• Fallback: Uses webhooks to Next.js executor if direct execution is disabled
• Strategy: Mean reversion from VWAP using 30-day lookback on 1h timeframe
  - Entry when price deviates > 2% from VWAP + RSI confirmation (RSI < 35 for longs, RSI > 65 for shorts)
  - Stop loss: 1.5x the VWAP deviation distance
  - Take profit: VWAP itself (approximately 2R)
• Manages open trades: tracks stop-loss and take-profit, fires EXIT when hit
• Prints AGENT_STATUS_UPDATE:{json} so agent_runner.ts can track it on the dashboard
• 100% paper — uses Alpaca Paper trading via REST API
"""

import os
import yfinance as yf
import pandas as pd
import numpy as np
import json
import time
import requests
from pathlib import Path
from utils.retry import retry, retry_on_empty
from datetime import datetime
from agent_utils import log_message, get_random_quip, save_agent_state, load_agent_state
from data_feeds import build_feed_for_agent, get_latest_price

# Try to import Alpaca executor (optional, falls back to webhooks if not available)
try:
    from alpaca_executor import AlpacaExecutor
    ALPACA_EXECUTOR_AVAILABLE = True
except ImportError:
    ALPACA_EXECUTOR_AVAILABLE = False
    print("[Dash] ⚠️ AlpacaExecutor not available, will use webhooks")

# ── Config ────────────────────────────────────────────────────────────────────
# CRITICAL: Set this to True to use direct Alpaca API instead of webhooks
USE_DIRECT_ALPACA = True

WEBHOOK_URL           = "http://localhost:3000/api/webhook/tradingview"
WEBHOOK_SECRET        = os.getenv("WEBHOOK_SECRET", "swjshak-tv-webhook-2026")
PAIRS                 = ['BTC-USD', 'ETH-USD', 'SOL-USD']
TIMEFRAME             = '1h'
PERIOD                = '30d'
VWAP_DEVIATION_PCT    = 2.0      # Entry when price > 2% away from VWAP (oversold/overbought)
RSI_PERIOD            = 14
RSI_LONG_THRESHOLD    = 35       # RSI < 35 for long entries (oversold)
RSI_SHORT_THRESHOLD   = 65       # RSI > 65 for short entries (overbought)
STOP_LOSS_MULTIPLIER  = 1.5      # SL = 1.5x the deviation distance
RISK_REWARD           = 2.0      # TP roughly at VWAP (mean reversion target)
SCAN_INTERVAL_MIN     = 30       # Full VWAP rescan every 30 minutes
TICK_INTERVAL_SEC     = 60       # Price check every 60 seconds
MAX_OPEN_TRADES       = 2        # Don't open more than 2 crypto positions at once
STATUS_FILE           = Path(__file__).parent.parent / 'data' / 'digital_dash_status.json'

# Alpaca symbol map (yfinance ticker → Alpaca format)
YF_TO_ALPACA = {'BTC-USD': 'BTC/USD', 'ETH-USD': 'ETH/USD', 'SOL-USD': 'SOL/USD'}
# Webhook symbol map (yfinance ticker → signal symbol)
YF_TO_SIGNAL = {'BTC-USD': 'BTCUSD', 'ETH-USD': 'ETHUSD', 'SOL-USD': 'SOLUSD'}

# Global Alpaca executor instance (if enabled)
alpaca_executor = None
if USE_DIRECT_ALPACA and ALPACA_EXECUTOR_AVAILABLE:
    try:
        alpaca_executor = AlpacaExecutor()
        print("[Dash] ✅ Direct Alpaca executor initialized")
    except Exception as e:
        print(f"[Dash] ⚠️ Failed to initialize Alpaca executor: {e}")
        alpaca_executor = None

# ── VWAP Calculation ──────────────────────────────────────────────────────────
def calculate_vwap(df):
    """
    Calculate Volume-Weighted Average Price (VWAP).
    VWAP = cumsum(typical_price * volume) / cumsum(volume)
    """
    typical_price = (df['High'] + df['Low'] + df['Close']) / 3
    cum_vol_price = (typical_price * df['Volume']).cumsum()
    cum_vol = df['Volume'].cumsum()
    vwap = cum_vol_price / cum_vol
    return vwap

# ── RSI Calculation ───────────────────────────────────────────────────────────
def calculate_rsi(series, period=14):
    """
    Calculate Relative Strength Index (RSI).
    RSI = 100 - (100 / (1 + RS))
    where RS = avg_gain / avg_loss
    """
    delta = series.diff()
    gain = delta.where(delta > 0, 0).rolling(period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

# ── Setup Detection ───────────────────────────────────────────────────────────
def find_vwap_setups(df):
    """
    Find VWAP mean reversion setups.

    Returns:
        list of {
            'created_at': ISO timestamp,
            'type': 'VWAP_LONG' or 'VWAP_SHORT',
            'vwap': current VWAP,
            'price': current price,
            'deviation_pct': deviation from VWAP (%),
            'rsi': current RSI,
            'entry': entry price (current price),
            'stop_loss': stop loss price,
            'take_profit': VWAP target,
            'status': 'PENDING',
            'triggered': False,
        }
    """
    setups = []

    if len(df) < RSI_PERIOD + 1:
        return setups

    # Calculate VWAP and RSI
    vwap = calculate_vwap(df)
    rsi = calculate_rsi(df['Close'], RSI_PERIOD)

    # Get latest values
    current_price = df['Close'].iloc[-1]
    current_vwap = vwap.iloc[-1]
    current_rsi = rsi.iloc[-1]

    # Calculate deviation from VWAP
    deviation_pct = ((current_price - current_vwap) / current_vwap) * 100

    # LONG setup: Price > 2% BELOW VWAP (oversold) + RSI < 35
    if deviation_pct < -VWAP_DEVIATION_PCT and current_rsi < RSI_LONG_THRESHOLD:
        deviation_distance = abs(current_price - current_vwap)
        stop_loss = current_price - (deviation_distance * STOP_LOSS_MULTIPLIER)

        setups.append({
            'created_at': df.index[-1].strftime('%Y-%m-%d %H:%M'),
            'type': 'VWAP_LONG',
            'vwap': round(current_vwap, 2),
            'price': round(current_price, 2),
            'deviation_pct': round(deviation_pct, 2),
            'rsi': round(current_rsi, 2),
            'entry': round(current_price, 2),
            'stop_loss': round(stop_loss, 2),
            'take_profit': round(current_vwap, 2),
            'status': 'PENDING',
            'triggered': False,
        })

    # SHORT setup: Price > 2% ABOVE VWAP (overbought) + RSI > 65
    elif deviation_pct > VWAP_DEVIATION_PCT and current_rsi > RSI_SHORT_THRESHOLD:
        deviation_distance = abs(current_price - current_vwap)
        stop_loss = current_price + (deviation_distance * STOP_LOSS_MULTIPLIER)

        setups.append({
            'created_at': df.index[-1].strftime('%Y-%m-%d %H:%M'),
            'type': 'VWAP_SHORT',
            'vwap': round(current_vwap, 2),
            'price': round(current_price, 2),
            'deviation_pct': round(deviation_pct, 2),
            'rsi': round(current_rsi, 2),
            'entry': round(current_price, 2),
            'stop_loss': round(stop_loss, 2),
            'take_profit': round(current_vwap, 2),
            'status': 'PENDING',
            'triggered': False,
        })

    return setups

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
    t = yf.Ticker(ticker)
    hist = t.history(period='1d', interval='5m')
    if not hist.empty:
        return float(hist['Close'].iloc[-1])
    return None

# ── Direct Alpaca Execution ───────────────────────────────────────────────────
def execute_on_alpaca(
    ticker: str,
    action: str,
    price: float,
    stop_loss: float = None,
    take_profit: float = None,
    reason: str = ""
) -> bool:
    """
    Submit order directly to Alpaca API (no webhooks).

    Args:
        ticker: yfinance ticker (e.g., 'BTC-USD')
        action: 'BUY', 'SELL', or 'EXIT'
        price: Entry price
        stop_loss: Stop loss price
        take_profit: Take profit price
        reason: Trade reason for logging

    Returns:
        True if order submitted successfully
    """
    if not alpaca_executor:
        print(f"[Dash] ❌ Alpaca executor not available")
        return False

    try:
        alpaca_symbol = YF_TO_ALPACA.get(ticker, ticker)
        signal_symbol = YF_TO_SIGNAL.get(ticker, ticker.replace('-', ''))

        if action == 'EXIT':
            # Close position
            result = alpaca_executor.close_position(alpaca_symbol)
            if result:
                print(f"[Dash] ✅ Direct Alpaca EXIT: {signal_symbol} @ ${price:.2f}")
                log_message('crypto', f"🔔 EXIT {signal_symbol} @ ${price:.2f} | {reason}", type='trade')
                return True
            else:
                print(f"[Dash] ⚠️ No position to close for {alpaca_symbol}")
                return False
        else:
            # Open position (BUY or SELL)
            direction = 'LONG' if action == 'BUY' else 'SHORT'

            # Calculate position size: 1% of account balance as risk amount
            try:
                account = alpaca_executor.get_account_info()
                account_balance = account['cash']
            except Exception as e:
                print(f"[Dash] ⚠️ Failed to fetch account balance: {e}")
                account_balance = 10000  # Fallback

            # Position sizing: use 1% risk
            qty = alpaca_executor.calculate_position_size_from_sl(
                entry_price=price,
                stop_loss=stop_loss or price * 0.99,
                account_balance=account_balance,
                risk_pct=1.0
            )

            # Round for crypto (4 decimals), minimum 0.001
            qty = max(0.001, float(f"{qty:.4f}"))

            # Submit market order
            order = alpaca_executor.submit_market_order(
                symbol=alpaca_symbol,
                qty=qty,
                side='buy' if action == 'BUY' else 'sell',
                time_in_force='gtc'  # Good til cancelled for crypto
            )

            print(f"[Dash] ✅ Direct Alpaca {action}: {qty:.4f} {signal_symbol} @ ${price:.2f} | Order: {order['id']}")
            log_message(
                'crypto',
                f"🔔 {action} {signal_symbol} @ ${price:.2f} | Risk: $100 | SL: ${stop_loss:.2f} | TP: ${take_profit:.2f} | {reason}",
                type='trade'
            )
            return True

    except Exception as e:
        print(f"[Dash] ❌ Direct Alpaca execution failed: {e}")
        return False

# ── Webhook Fire (Fallback) ────────────────────────────────────────────────────
def fire_signal(ticker: str, action: str, price: float, stop_loss: float = None,
                take_profit: float = None, reason: str = "") -> bool:
    """
    Fire signal via webhook (fallback if direct Alpaca is disabled).
    """
    # If direct Alpaca is enabled and available, use it
    if USE_DIRECT_ALPACA and alpaca_executor:
        return execute_on_alpaca(ticker, action, price, stop_loss, take_profit, reason)

    # Fallback to webhook
    symbol = YF_TO_SIGNAL.get(ticker, ticker.replace('-', ''))
    payload = {
        "symbol":      symbol,
        "action":      action,        # BUY / SELL / EXIT
        "price":       price,
        "strategy":    "DigitalDash_VWAP",
        "stopLoss":    stop_loss,
        "takeProfit":  take_profit,
        "notes":       reason or f"Dash: {action} {symbol} @ {price}",
    }
    headers = {
        "Content-Type":    "application/json",
        "X-Webhook-Secret": WEBHOOK_SECRET,
    }
    try:
        resp = requests.post(WEBHOOK_URL, json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            print(f"[Dash] ✅ Webhook signal sent: {action} {symbol} @ ${price:.2f}")
            log_message('crypto', f"🔔 {action} {symbol} @ ${price:.2f} | {reason}", type='trade')
            return True
        else:
            print(f"[Dash] ❌ Webhook failed {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"[Dash] ❌ Webhook error: {e}")
        return False

# ── Status Broadcast ──────────────────────────────────────────────────────────
def broadcast_status(setups: list, active_trades: list, scan_count: int, prices: dict):
    state = {
        "id":           "digital_dash",
        "name":         "Digital Dash",
        "status":       "ACTIVE",
        "last_updated": datetime.now().isoformat(),
        "active_pairs": len(PAIRS),
        "scan_count":   scan_count,
        "pending_orders": [z for z in setups if z.get('status') == 'PENDING'][:10],
        "active_trades":  active_trades,
        "live_prices":    prices,
        "total_zones_found": len(setups),
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
    print(f"AGENT_STATUS_UPDATE:{json.dumps({'agentId': 'digital_dash', 'status': 'ACTIVE', 'message': f'Tracking {len(setups)} setups | Prices: {prices}', 'timestamp': datetime.now().isoformat()})}", flush=True)

# ── VWAP Scan ─────────────────────────────────────────────────────────────────
def run_scan() -> dict:
    """Full VWAP scan across all pairs. Returns {ticker: [setups]}."""
    all_setups = {}
    print(f"[Dash] 🔍 Running VWAP scan at {datetime.now().strftime('%H:%M:%S')}...")
    for pair in PAIRS:
        try:
            data = yf.download(pair, period=PERIOD, interval=TIMEFRAME, progress=False)
            if data.empty:
                print(f"[Dash] ⚠️ No data for {pair}")
                continue
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)
            setups = find_vwap_setups(data)
            print(f"[Dash] {pair}: {len(setups)} VWAP setup(s) found")
            all_setups[pair] = setups
        except Exception as e:
            print(f"[Dash] ❌ Scan error for {pair}: {e}")
            # Don't clear existing setups on scan failure
            if pair not in all_setups:
                all_setups[pair] = []
    return all_setups

# ── Trade Monitor ──────────────────────────────────────────────────────────────
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
            print(f"[Dash] 🎯 TP hit: {ticker} @ ${price:.2f}")
        elif hit_sl:
            reason = f"Stop loss hit @ ${price:.2f} (SL: ${trade['stop_loss']:.2f})"
            fire_signal(ticker, 'EXIT', price, reason=reason)
            log_message('crypto', f"🛑 SL HIT: {YF_TO_SIGNAL.get(ticker, ticker)} -1R", type='trade')
            print(f"[Dash] 🛑 SL hit: {ticker} @ ${price:.2f}")
        else:
            remaining.append(trade)

    return remaining

# ── Setup Entry Check ──────────────────────────────────────────────────────────
def check_setup_entries(setups_by_pair: dict, active_trades: list, prices: dict) -> tuple:
    """Check if price has entered any PENDING setup. Returns (updated_setups, updated_trades)."""
    # Tickers already in active trade
    open_tickers = {t['ticker'] for t in active_trades}

    for pair, setups in setups_by_pair.items():
        price = prices.get(pair)
        if price is None:
            continue

        # Don't open another trade if we already have one for this pair or at max
        if pair in open_tickers:
            continue
        if len(active_trades) >= MAX_OPEN_TRADES:
            continue

        for setup in setups:
            if setup.get('triggered') or setup.get('status') != 'PENDING':
                continue

            # For VWAP setups, we enter at current price (already at the deviation level)
            # The setup is "live" as soon as conditions are met
            action = 'BUY' if setup['type'] == 'VWAP_LONG' else 'SELL'
            direction = 'LONG' if setup['type'] == 'VWAP_LONG' else 'SHORT'

            print(f"[Dash] ⚡ Setup entry: {pair} {action} @ ${price:.2f} (VWAP: ${setup['vwap']:.2f}, RSI: {setup['rsi']})")
            success = fire_signal(
                ticker=pair,
                action=action,
                price=price,
                stop_loss=setup['stop_loss'],
                take_profit=setup['take_profit'],
                reason=f"VWAP {setup['type']} (deviation: {setup['deviation_pct']}% | RSI: {setup['rsi']})",
            )
            if success:
                setup['triggered'] = True
                setup['status']    = 'TRIGGERED'
                active_trades.append({
                    'ticker':       pair,
                    'direction':    direction,
                    'entry_price':  price,
                    'stop_loss':    setup['stop_loss'],
                    'take_profit':  setup['take_profit'],
                    'opened_at':    datetime.now().isoformat(),
                })
                open_tickers.add(pair)
                break  # Only one entry per pair per tick

    return setups_by_pair, active_trades

# ── Main Loop ──────────────────────────────────────────────────────────────────
def run():
    print(f"""
╔══════════════════════════════════════════╗
║   DIGITAL DASH  —  VWAP Mean Revert     ║
║  Pairs: BTC-USD, ETH-USD, SOL-USD       ║
║  Scan: every {SCAN_INTERVAL_MIN}min | Tick: every {TICK_INTERVAL_SEC}s    ║
║  Max open positions: {MAX_OPEN_TRADES}                   ║
╚══════════════════════════════════════════╝
""")
    log_message('crypto', get_random_quip('crypto'))
    log_message('crypto', f"🚀 Digital Dash online — scanning {', '.join(PAIRS)}")

    # Start Binance WebSocket feed (FREE, no auth needed for BTC/ETH/SOL)
    _price_feed = build_feed_for_agent('digital_dash')

    # ── Restore persisted state ────────────────────────────────────────────────
    saved = load_agent_state('digital_dash')
    setups_by_pair  = saved.get('setups_by_pair', {})
    active_trades   = saved.get('active_trades', [])
    scan_count      = saved.get('scan_count', 0)
    if active_trades:
        print(f"[Dash] Restored {len(active_trades)} active trades from saved state")
    last_scan_time  = 0 if not setups_by_pair else time.time()

    while True:
        now = time.time()

        # ── Periodic VWAP rescan ──────────────────────────────────────────────
        if now - last_scan_time >= SCAN_INTERVAL_MIN * 60:
            # Preserve triggered state so we don't re-enter the same setups
            triggered = {}
            for pair, setups in setups_by_pair.items():
                triggered[pair] = {(s['vwap'], s['price']): s.get('status') for s in setups}

            setups_by_pair = run_scan()
            last_scan_time = now
            scan_count    += 1

            # Restore triggered state on re-scanned setups
            for pair, setups in setups_by_pair.items():
                for s in setups:
                    key = (s['vwap'], s['price'])
                    if triggered.get(pair, {}).get(key) == 'TRIGGERED':
                        s['triggered'] = True
                        s['status']    = 'TRIGGERED'

        # ── Fetch live prices ──────────────────────────────────────────────────
        prices = {}
        for pair in PAIRS:
            p = get_current_price(pair)
            if p:
                prices[pair] = p
        if prices:
            price_str = ' | '.join([f"{p.replace('-USD','')}: ${v:,.0f}" for p, v in prices.items()])
            print(f"[Dash] 💰 {price_str}")

        # ── Check open trade exits ─────────────────────────────────────────────
        if active_trades:
            active_trades = check_trade_exits(active_trades, prices)

        # ── Check setup entries ────────────────────────────────────────────────
        if setups_by_pair:
            setups_by_pair, active_trades = check_setup_entries(setups_by_pair, active_trades, prices)

        # ── Persist state ──────────────────────────────────────────────────────
        save_agent_state('digital_dash', {
            'setups_by_pair': {p: [{k: v for k, v in s.items() if k in (
                'created_at','type','vwap','price','deviation_pct','rsi',
                'entry','stop_loss','take_profit','status','triggered'
            )} for s in ss] for p, ss in setups_by_pair.items()},
            'active_trades': active_trades,
            'scan_count': scan_count,
        })

        # ── Broadcast status ───────────────────────────────────────────────────
        all_setups = [s for setups in setups_by_pair.values() for s in setups]
        broadcast_status(all_setups, active_trades, scan_count, prices)

        time.sleep(TICK_INTERVAL_SEC)

if __name__ == "__main__":
    run()
