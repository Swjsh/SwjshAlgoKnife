"""
Crypto Cody Agent - Bollinger Band Squeeze Momentum Trader
===========================================================
• Scans BTC, ETH, SOL for Bollinger Band squeeze conditions (every SCAN_INTERVAL_MIN minutes)
• Detects squeeze when BB width < 4% of price AND BB inside Keltner Channel
• Monitors prices every TICK_INTERVAL_SEC seconds for squeeze breakout
• Enters LONG when price closes above upper BB after squeeze release
• Enters SHORT when price closes below lower BB after squeeze release
• **DIRECT ALPACA**: Submits orders directly to Alpaca API (no webhooks)
• Manages open trades: tracks stop-loss (opposite BB band) and take-profit (2.5R)
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
from datetime import datetime
from agent_utils import log_message, get_random_quip, save_agent_state, load_agent_state
from utils.retry import retry, retry_on_empty
from data_feeds import build_feed_for_agent, get_latest_price

# Try to import Alpaca executor (optional, falls back to webhooks if not available)
try:
    from alpaca_executor import AlpacaExecutor
    ALPACA_EXECUTOR_AVAILABLE = True
except ImportError:
    ALPACA_EXECUTOR_AVAILABLE = False
    print("[Cody] ⚠️ AlpacaExecutor not available, will use webhooks")

# ── Config ────────────────────────────────────────────────────────────────────
# CRITICAL: Set this to True to use direct Alpaca API instead of webhooks
USE_DIRECT_ALPACA = True

WEBHOOK_URL            = "http://localhost:3000/api/webhook/tradingview"
WEBHOOK_SECRET         = os.getenv("WEBHOOK_SECRET", "swjshak-tv-webhook-2026")
PAIRS                  = ['BTC-USD', 'ETH-USD', 'SOL-USD']
TIMEFRAME              = '1h'
PERIOD                 = '30d'
BB_PERIOD              = 20         # Bollinger Band period
BB_STDDEV              = 2.0        # Standard deviations
KC_PERIOD              = 20         # Keltner Channel EMA period
KC_ATR_PERIOD          = 10         # ATR period for Keltner Channel
KC_ATR_MULT            = 1.5        # ATR multiplier for KC bands
SQUEEZE_WIDTH_THRESHOLD = 0.04      # Squeeze detected when BB width < 4% of price
MIN_SQUEEZE_CANDLES    = 5          # Minimum candles in squeeze before entry allowed
RISK_REWARD            = 2.5        # Take profit at R:R 2.5
SCAN_INTERVAL_MIN      = 30         # Full squeeze scan every 30 minutes
TICK_INTERVAL_SEC      = 60         # Price check every 60 seconds
MAX_OPEN_TRADES        = 2          # Don't open more than 2 crypto positions at once
STATUS_FILE            = Path(__file__).parent.parent / 'data' / 'crypto_cody_status.json'

# Alpaca symbol map (yfinance ticker → Alpaca format)
YF_TO_ALPACA = {'BTC-USD': 'BTC/USD', 'ETH-USD': 'ETH/USD', 'SOL-USD': 'SOL/USD'}
# Webhook symbol map (yfinance ticker → signal symbol)
YF_TO_SIGNAL = {'BTC-USD': 'BTCUSD', 'ETH-USD': 'ETHUSD', 'SOL-USD': 'SOLUSD'}

# Global Alpaca executor instance (if enabled)
alpaca_executor = None
if USE_DIRECT_ALPACA and ALPACA_EXECUTOR_AVAILABLE:
    try:
        alpaca_executor = AlpacaExecutor()
        print("[Cody] ✅ Direct Alpaca executor initialized")
    except Exception as e:
        print(f"[Cody] ⚠️ Failed to initialize Alpaca executor: {e}")
        alpaca_executor = None

# ── ATR (Average True Range) ──────────────────────────────────────────────────
def calculate_atr(df, period=10):
    """Calculate ATR for Keltner Channel."""
    high_low   = df['High'] - df['Low']
    high_close = np.abs(df['High'] - df['Close'].shift())
    low_close  = np.abs(df['Low']  - df['Close'].shift())
    true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    return true_range.rolling(period).mean()

# ── Bollinger Bands ───────────────────────────────────────────────────────────
def calculate_bollinger_bands(df, period=20, stddev=2.0):
    """Calculate Bollinger Bands: SMA(20) ± 2*StdDev(20)."""
    sma = df['Close'].rolling(period).mean()
    std = df['Close'].rolling(period).std()
    upper_bb = sma + (std * stddev)
    lower_bb = sma - (std * stddev)
    return upper_bb, lower_bb, sma

# ── Keltner Channel ───────────────────────────────────────────────────────────
def calculate_keltner_channel(df, ema_period=20, atr_period=10, atr_mult=1.5):
    """Calculate Keltner Channel: EMA(20) ± 1.5*ATR(10)."""
    ema = df['Close'].ewm(span=ema_period).mean()
    atr = calculate_atr(df, atr_period)
    upper_kc = ema + (atr * atr_mult)
    lower_kc = ema - (atr * atr_mult)
    return upper_kc, lower_kc, ema

# ── Squeeze Detection ─────────────────────────────────────────────────────────
def detect_squeezes(df):
    """
    Detect Bollinger Band squeeze zones in historical data.

    Returns:
    {
        'current_squeeze': bool,
        'squeeze_start_idx': int or None,  # Index where current squeeze started
        'squeeze_candles': int,            # How many candles in current squeeze
        'bb_upper': float,
        'bb_lower': float,
        'kc_upper': float,
        'kc_lower': float,
        'price': float,
    }
    """
    # Calculate indicators
    upper_bb, lower_bb, bb_mid = calculate_bollinger_bands(df, BB_PERIOD, BB_STDDEV)
    upper_kc, lower_kc, kc_mid = calculate_keltner_channel(df, KC_PERIOD, KC_ATR_PERIOD, KC_ATR_MULT)

    # Get the last valid row
    if df.empty or upper_bb.isna().all():
        return {
            'current_squeeze': False,
            'squeeze_start_idx': None,
            'squeeze_candles': 0,
            'bb_upper': None,
            'bb_lower': None,
            'kc_upper': None,
            'kc_lower': None,
            'price': None,
        }

    # Get the last row index with valid data
    last_idx = df.shape[0] - 1

    # Find the last valid value
    valid_idx = last_idx
    while valid_idx >= 0 and (pd.isna(upper_bb.iloc[valid_idx]) or pd.isna(upper_kc.iloc[valid_idx])):
        valid_idx -= 1

    if valid_idx < 0:
        return {
            'current_squeeze': False,
            'squeeze_start_idx': None,
            'squeeze_candles': 0,
            'bb_upper': None,
            'bb_lower': None,
            'kc_upper': None,
            'kc_lower': None,
            'price': None,
        }

    # Current candle
    current_price = float(df['Close'].iloc[valid_idx])
    bb_upper = float(upper_bb.iloc[valid_idx])
    bb_lower = float(lower_bb.iloc[valid_idx])
    kc_upper = float(upper_kc.iloc[valid_idx])
    kc_lower = float(lower_kc.iloc[valid_idx])

    # Check squeeze: BB inside KC AND BB width < 4% of price
    bb_width = bb_upper - bb_lower
    bb_width_pct = bb_width / current_price if current_price > 0 else 0

    is_squeeze = (bb_upper < kc_upper and bb_lower > kc_lower) and (bb_width_pct < SQUEEZE_WIDTH_THRESHOLD)

    # Count consecutive squeeze candles
    squeeze_candles = 0
    squeeze_start_idx = None
    if is_squeeze:
        for i in range(valid_idx, max(-1, valid_idx - 100), -1):
            if i < 0 or pd.isna(upper_bb.iloc[i]) or pd.isna(upper_kc.iloc[i]):
                break
            bb_w = upper_bb.iloc[i] - lower_bb.iloc[i]
            bb_w_pct = bb_w / df['Close'].iloc[i] if df['Close'].iloc[i] > 0 else 0
            in_squeeze = (upper_bb.iloc[i] < upper_kc.iloc[i] and
                         lower_bb.iloc[i] > lower_kc.iloc[i] and
                         bb_w_pct < SQUEEZE_WIDTH_THRESHOLD)
            if in_squeeze:
                squeeze_candles += 1
                squeeze_start_idx = i
            else:
                break

    return {
        'current_squeeze': is_squeeze,
        'squeeze_start_idx': squeeze_start_idx,
        'squeeze_candles': squeeze_candles,
        'bb_upper': bb_upper,
        'bb_lower': bb_lower,
        'kc_upper': kc_upper,
        'kc_lower': kc_lower,
        'price': current_price,
    }

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
        print(f"[Cody] ❌ Alpaca executor not available")
        return False

    try:
        alpaca_symbol = YF_TO_ALPACA.get(ticker, ticker)
        signal_symbol = YF_TO_SIGNAL.get(ticker, ticker.replace('-', ''))

        if action == 'EXIT':
            # Close position
            result = alpaca_executor.close_position(alpaca_symbol)
            if result:
                print(f"[Cody] ✅ Direct Alpaca EXIT: {signal_symbol} @ ${price:.2f}")
                log_message('crypto', f"🔔 EXIT {signal_symbol} @ ${price:.2f} | {reason}", type='trade')
                return True
            else:
                print(f"[Cody] ⚠️ No position to close for {alpaca_symbol}")
                return False
        else:
            # Open position (BUY or SELL)
            direction = 'LONG' if action == 'BUY' else 'SHORT'

            # Calculate position size: 1% of account balance as risk amount
            try:
                account = alpaca_executor.get_account_info()
                account_balance = account['cash']
            except Exception as e:
                print(f"[Cody] ⚠️ Failed to fetch account balance: {e}")
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

            print(f"[Cody] ✅ Direct Alpaca {action}: {qty:.4f} {signal_symbol} @ ${price:.2f} | Order: {order['id']}")
            log_message(
                'crypto',
                f"🔔 {action} {signal_symbol} @ ${price:.2f} | Risk: $100 | SL: ${stop_loss:.2f} | TP: ${take_profit:.2f} | {reason}",
                type='trade'
            )
            return True

    except Exception as e:
        print(f"[Cody] ❌ Direct Alpaca execution failed: {e}")
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
        "strategy":    "CryptoCody_BBSqueeze",
        "stopLoss":    stop_loss,
        "takeProfit":  take_profit,
        "notes":       reason or f"Cody: {action} {symbol} @ {price}",
    }
    headers = {
        "Content-Type":    "application/json",
        "X-Webhook-Secret": WEBHOOK_SECRET,
    }
    try:
        resp = requests.post(WEBHOOK_URL, json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            print(f"[Cody] ✅ Webhook signal sent: {action} {symbol} @ ${price:.2f}")
            log_message('crypto', f"🔔 {action} {symbol} @ ${price:.2f} | {reason}", type='trade')
            return True
        else:
            print(f"[Cody] ❌ Webhook failed {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"[Cody] ❌ Webhook error: {e}")
        return False

# ── Status Broadcast ─────────────────────────────────────────────────────────
def broadcast_status(zones: list, active_trades: list, scan_count: int, prices: dict):
    state = {
        "id":           "crypto_cody",
        "name":         "Crypto Cody",
        "status":       "ACTIVE",
        "last_updated": datetime.now().isoformat(),
        "active_pairs": len(PAIRS),
        "scan_count":   scan_count,
        "pending_orders": zones[:10],
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
    print(f"AGENT_STATUS_UPDATE:{json.dumps({'agentId': 'crypto_cody', 'status': 'ACTIVE', 'message': f'Tracking {len(zones)} squeeze zones | Prices: {prices}', 'timestamp': datetime.now().isoformat()})}", flush=True)

# ── Zone Scan ─────────────────────────────────────────────────────────────────
def run_scan() -> dict:
    """Full squeeze zone scan across all pairs. Returns {ticker: [zones]}."""
    all_zones = {}
    print(f"[Cody] 🔍 Running squeeze scan at {datetime.now().strftime('%H:%M:%S')}...")
    for pair in PAIRS:
        try:
            data = yf.download(pair, period=PERIOD, interval=TIMEFRAME, progress=False)
            if data.empty:
                print(f"[Cody] ⚠️ No data for {pair}")
                continue
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)

            squeeze_info = detect_squeezes(data)
            zones = []

            # If we're currently in a squeeze, create a zone
            if squeeze_info['current_squeeze'] and squeeze_info['squeeze_candles'] >= MIN_SQUEEZE_CANDLES:
                zone = {
                    'created_at': datetime.now().strftime('%Y-%m-%d %H:%M'),
                    'type': 'BB_SQUEEZE',
                    'bb_upper': round(squeeze_info['bb_upper'], 2),
                    'bb_lower': round(squeeze_info['bb_lower'], 2),
                    'current_price': round(squeeze_info['price'], 2),
                    'squeeze_candles': squeeze_info['squeeze_candles'],
                    'status': 'PENDING',
                    'triggered': False,
                }
                zones.append(zone)
                print(f"[Cody] {pair}: Squeeze detected ({zone['squeeze_candles']} candles)")

            all_zones[pair] = zones
        except Exception as e:
            print(f"[Cody] ❌ Scan error for {pair}: {e}")
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
            print(f"[Cody] 🎯 TP hit: {ticker} @ ${price:.2f}")
        elif hit_sl:
            reason = f"Stop loss hit @ ${price:.2f} (SL: ${trade['stop_loss']:.2f})"
            fire_signal(ticker, 'EXIT', price, reason=reason)
            log_message('crypto', f"🛑 SL HIT: {YF_TO_SIGNAL.get(ticker, ticker)} -1R", type='trade')
            print(f"[Cody] 🛑 SL hit: {ticker} @ ${price:.2f}")
        else:
            remaining.append(trade)

    return remaining

# ── Squeeze Breakout Entry Check ──────────────────────────────────────────────
def check_squeeze_breakouts(zones_by_pair: dict, active_trades: list, prices: dict) -> tuple:
    """Check if squeeze has broken out and if we should enter. Returns (updated_zones, updated_trades)."""
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

            # Check for breakout: price closes outside BB after squeeze
            entered = False
            action = None
            direction = None

            # LONG: close above upper BB
            if price > zone['bb_upper']:
                entered = True
                action = 'BUY'
                direction = 'LONG'
            # SHORT: close below lower BB
            elif price < zone['bb_lower']:
                entered = True
                action = 'SELL'
                direction = 'SHORT'

            if entered and action:
                # Calculate SL and TP
                # SL = opposite BB band
                # TP = 2.5R from entry
                if direction == 'LONG':
                    stop_loss = zone['bb_lower']
                    risk = price - stop_loss
                    take_profit = price + (risk * RISK_REWARD)
                else:  # SHORT
                    stop_loss = zone['bb_upper']
                    risk = stop_loss - price
                    take_profit = price - (risk * RISK_REWARD)

                print(f"[Cody] ⚡ Squeeze breakout: {pair} {action} @ ${price:.2f} (BB: {zone['bb_lower']:.2f}-{zone['bb_upper']:.2f})")
                success = fire_signal(
                    ticker=pair,
                    action=action,
                    price=price,
                    stop_loss=stop_loss,
                    take_profit=take_profit,
                    reason=f"BB squeeze breakout | {zone['squeeze_candles']} candles in squeeze",
                )
                if success:
                    zone['triggered'] = True
                    zone['status']    = 'TRIGGERED'
                    active_trades.append({
                        'ticker':       pair,
                        'direction':    direction,
                        'entry_price':  price,
                        'stop_loss':    round(stop_loss, 2),
                        'take_profit':  round(take_profit, 2),
                        'opened_at':    datetime.now().isoformat(),
                    })
                    open_tickers.add(pair)
                break  # Only one entry per pair per tick

    return zones_by_pair, active_trades

# ── Main Loop ─────────────────────────────────────────────────────────────────
def run():
    print(f"""
╔══════════════════════════════════════════╗
║     CRYPTO CODY  —  BB Squeeze Trader    ║
║  Pairs: BTC-USD, ETH-USD, SOL-USD        ║
║  Scan: every 30min | Tick: every 60s     ║
║  Max open positions: 2                   ║
╚══════════════════════════════════════════╝
""")
    log_message('crypto', get_random_quip('crypto'))
    log_message('crypto', f"🚀 Crypto Cody online — scanning {', '.join(PAIRS)}")

    # Start Binance WebSocket feed (FREE, no auth needed for BTC/ETH/SOL)
    _price_feed = build_feed_for_agent('crypto_cody')

    # ── Restore persisted state ──────────────────────────────────────────────
    saved = load_agent_state('crypto_cody')
    zones_by_pair   = saved.get('zones_by_pair', {})
    active_trades   = saved.get('active_trades', [])
    scan_count      = saved.get('scan_count', 0)
    if active_trades:
        print(f"[Cody] Restored {len(active_trades)} active trades from saved state")
    last_scan_time  = 0 if not zones_by_pair else time.time()

    while True:
        now = time.time()

        # ── Periodic squeeze rescan ──────────────────────────────────────────────
        if now - last_scan_time >= SCAN_INTERVAL_MIN * 60:
            # Preserve triggered state so we don't re-enter the same zones
            triggered = {}
            for pair, zones in zones_by_pair.items():
                triggered[pair] = {(z['bb_upper'], z['bb_lower']): z.get('status') for z in zones}

            zones_by_pair  = run_scan()
            last_scan_time = now
            scan_count    += 1

            # Restore triggered state on re-scanned zones
            for pair, zones in zones_by_pair.items():
                for z in zones:
                    key = (z['bb_upper'], z['bb_lower'])
                    if triggered.get(pair, {}).get(key) == 'TRIGGERED':
                        z['triggered'] = True
                        z['status'] = 'TRIGGERED'

        # ── Fetch live prices ────────────────────────────────────────────────────
        prices = {}
        for pair in PAIRS:
            p = get_current_price(pair)
            if p:
                prices[pair] = p

        if prices:
            price_str = ' | '.join([
                f"{p.replace('-USD', '')}: ${v:,.0f}" for p, v in prices.items()
            ])
            now_str = datetime.now().strftime('%H:%M:%S')
            print(f"[{now_str}] Cody scanning... {price_str}", flush=True)

        # ── Check open trade exits ───────────────────────────────────────────────
        trades_before = len(active_trades)
        if active_trades:
            active_trades = check_trade_exits(active_trades, prices)
            # Report closed trades via feedback
            if len(active_trades) < trades_before:
                closed_count = trades_before - len(active_trades)
                print(f"[Cody] {closed_count} trade(s) closed", flush=True)

        # ── Check squeeze breakout entries ───────────────────────────────────────
        if zones_by_pair:
            zones_by_pair, active_trades = check_squeeze_breakouts(
                zones_by_pair, active_trades, prices
            )

        # ── Persist state ────────────────────────────────────────────────────────
        save_agent_state('crypto_cody', {
            'zones_by_pair': _serialize_zones(zones_by_pair),
            'active_trades': active_trades,
            'scan_count': scan_count,
        })

        # ── Build status for dashboard ───────────────────────────────────────────
        all_zones = [z for zones in zones_by_pair.values() for z in zones]
        pending = [z for z in all_zones if z.get('status') == 'PENDING']

        output = {
            "last_updated": datetime.now().isoformat(),
            "status": "ACTIVE",
            "active_pairs": len(PAIRS),
            "total_zones_found": len(all_zones),
            "performance": {
                "win_rate": 0,
                "total_pnl": 0,
                "trades": 0,
            },
            "pending_orders": pending[:10],
            "closed_trades": [],
            "meta": {
                "name": "Crypto Cody",
                "type": "Crypto"
            }
        }

        # Add active trades
        for trade in active_trades:
            output.setdefault('pending_orders', [])

        # ── Emit AGENT_STATUS_UPDATE for agent_runner.ts ─────────────────────────
        print("AGENT_STATUS_UPDATE:" + json.dumps(output), flush=True)

        # Also broadcast via the engine's file-based status
        broadcast_status(all_zones, active_trades, scan_count, prices)

        now_str = datetime.now().strftime('%H:%M:%S')
        print(f"[SUCCESS] [{now_str}] Cody update: {len(pending)} pending zones, "
              f"{len(active_trades)} active trades", flush=True)

        time.sleep(TICK_INTERVAL_SEC)


def _serialize_zones(zones_by_pair: dict) -> dict:
    """Make zones JSON-serializable (strip any non-serializable fields)."""
    result = {}
    for pair, zones in zones_by_pair.items():
        result[pair] = []
        for z in zones:
            result[pair].append({
                'created_at': z.get('created_at', ''),
                'type': z.get('type', ''),
                'bb_upper': z.get('bb_upper', 0),
                'bb_lower': z.get('bb_lower', 0),
                'current_price': z.get('current_price', 0),
                'squeeze_candles': z.get('squeeze_candles', 0),
                'status': z.get('status', 'PENDING'),
                'triggered': z.get('triggered', False),
            })
    return result


if __name__ == "__main__":
    run()
