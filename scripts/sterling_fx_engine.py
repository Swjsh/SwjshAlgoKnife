"""
Sterling — FX Live Engine
=========================
• Scans EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD for fresh Supply/Demand zones (1H data)
• Monitors live prices every TICK_INTERVAL_SEC seconds (yfinance 1m snapshot)
• Fires webhook to Next.js executor when price enters a zone → OANDA Practice executes
• Manages open FX trades: tracks SL/TP, fires EXIT when hit
• Broadcasts AGENT_STATUS_UPDATE:{json} to stdout for agent_runner.ts dashboard
• Risk: 1% per trade, stop = 5 pip buffer beyond zone edge
"""

import yfinance as yf
import pandas as pd
import numpy as np
import json
import time
import requests
from pathlib import Path
from datetime import datetime
from agent_utils import log_message, get_random_quip, save_agent_state, load_agent_state
from data_feeds import build_feed_for_agent, get_latest_price

# ── Config ────────────────────────────────────────────────────────────────────
WEBHOOK_URL        = "http://localhost:3000/api/webhook/tradingview"
WEBHOOK_SECRET     = "swjshak-tv-webhook-2026"
PAIRS              = ['EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'AUDUSD=X', 'USDCAD=X']
TIMEFRAME          = '1h'
PERIOD             = '1mo'
ATR_PERIOD         = 14
IMPULSE_MULTIPLIER = 2.0        # Candle body must be 2x ATR to qualify as impulse
RISK_REWARD        = 2.0        # 1:2 R:R
SCAN_INTERVAL_MIN  = 60         # Full zone rescan every 60 minutes
TICK_INTERVAL_SEC  = 30         # Price check every 30 seconds
MAX_OPEN_TRADES    = 2          # Max simultaneous FX positions
PIP_BUFFER         = 0.0005     # 5 pip SL buffer beyond zone edge (JPY pairs use 0.05)
STATUS_FILE        = Path(__file__).parent.parent / 'data' / 'fx_agent_status.json'

# yfinance ticker → clean signal symbol (OANDA format via executor)
YF_TO_SIGNAL = {
    'EURUSD=X': 'EURUSD',
    'GBPUSD=X': 'GBPUSD',
    'USDJPY=X': 'USDJPY',
    'AUDUSD=X': 'AUDUSD',
    'USDCAD=X': 'USDCAD',
}

# ── Helpers ───────────────────────────────────────────────────────────────────
def pip_buffer(pair: str) -> float:
    """JPY pairs have 2-decimal prices; all others are 4-decimal."""
    return 0.05 if 'JPY' in pair else PIP_BUFFER

def calculate_atr(df, period=14):
    high_low   = df['High'] - df['Low']
    high_close = np.abs(df['High'] - df['Close'].shift())
    low_close  = np.abs(df['Low']  - df['Close'].shift())
    true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    return true_range.rolling(period).mean()

# ── Zone Detection ────────────────────────────────────────────────────────────
def find_zones(df, atr_series, pair: str):
    zones = []
    buf = pip_buffer(pair)
    for i in range(len(df) - 2, 20, -1):
        body_size = abs(df['Close'].iloc[i] - df['Open'].iloc[i])
        atr       = atr_series.iloc[i]
        if body_size <= (atr * IMPULSE_MULTIPLIER):
            continue

        is_bullish  = df['Close'].iloc[i] > df['Open'].iloc[i]
        zone_type   = "DEMAND" if is_bullish else "SUPPLY"
        zone_top    = df['High'].iloc[i - 1]
        zone_bottom = df['Low'].iloc[i - 1]
        future      = df.iloc[i + 1:]

        # Freshness check
        if zone_type == "DEMAND":
            min_future = future['Low'].min()
            if min_future <= zone_top:
                if min_future < zone_bottom:
                    continue    # zone failed — price blew through
                else:
                    continue    # mitigated — strict fresh-only rule
        else:
            max_future = future['High'].max()
            if max_future >= zone_bottom:
                if max_future > zone_top:
                    continue
                else:
                    continue

        entry_price = round(zone_top,    5) if zone_type == "DEMAND" else round(zone_bottom, 5)
        stop_loss   = round(zone_bottom - buf, 5) if zone_type == "DEMAND" else round(zone_top + buf, 5)
        risk        = abs(entry_price - stop_loss)
        take_profit = round(entry_price + risk * RISK_REWARD, 5) if zone_type == "DEMAND" \
                      else round(entry_price - risk * RISK_REWARD, 5)

        zones.append({
            'created_at':  df.index[i].strftime('%Y-%m-%d %H:%M'),
            'type':        zone_type,
            'top':         round(zone_top,    5),
            'bottom':      round(zone_bottom, 5),
            'entry':       entry_price,
            'stop_loss':   stop_loss,
            'take_profit': take_profit,
            'status':      'PENDING',
            'triggered':   False,
        })
    return zones

# ── Live Price ────────────────────────────────────────────────────────────────
def get_current_price(ticker: str) -> float | None:
    """
    Get FX pair price. Uses OANDA streaming cache first (real-time),
    falls back to yfinance REST if OANDA stream isn't running.
    """
    try:
        # Try real-time OANDA streaming cache first
        price = get_latest_price(ticker, max_cache_age=5.0)
        if price:
            return price
        # yfinance fallback (30s - 5m delayed)
        hist = yf.Ticker(ticker).history(period='1d', interval='5m')
        if not hist.empty:
            return float(hist['Close'].iloc[-1])
    except Exception as e:
        print(f"[Sterling] ⚠️ Price fetch failed {ticker}: {e}")
    return None

# ── Webhook ───────────────────────────────────────────────────────────────────
def fire_signal(pair: str, action: str, price: float,
                stop_loss: float = None, take_profit: float = None,
                reason: str = "") -> bool:
    symbol = YF_TO_SIGNAL.get(pair, pair.replace('=X', ''))
    payload = {
        "symbol":      symbol,
        "action":      action,
        "price":       price,
        "strategy":    "Sterling_FX_SD",
        "stopLoss":    stop_loss,
        "takeProfit":  take_profit,
        "notes":       reason or f"Sterling: {action} {symbol} @ {price}",
    }
    headers = {
        "Content-Type":     "application/json",
        "X-Webhook-Secret": WEBHOOK_SECRET,
    }
    try:
        resp = requests.post(WEBHOOK_URL, json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            print(f"[Sterling] ✅ Signal sent: {action} {symbol} @ {price:.5f}")
            log_message('fx', f"🔔 {action} {symbol} @ {price:.5f} | {reason}", type='trade')
            return True
        else:
            print(f"[Sterling] ❌ Webhook failed {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"[Sterling] ❌ Webhook error: {e}")
        return False

# ── Status Broadcast ──────────────────────────────────────────────────────────
def broadcast_status(zones_by_pair: dict, active_trades: list, scan_count: int, prices: dict):
    all_zones = [z for zones in zones_by_pair.values() for z in zones]
    pending   = [z for z in all_zones if z.get('status') == 'PENDING']

    state = {
        "id":             "sterling_fx",
        "name":           "Sterling",
        "status":         "ACTIVE",
        "last_updated":   datetime.now().isoformat(),
        "active_pairs":   len(PAIRS),
        "scan_count":     scan_count,
        "pending_orders": pending[:10],
        "active_trades":  active_trades,
        "live_prices":    prices,
        "total_zones_found": len(all_zones),
        "performance": {
            "win_rate":  0,
            "total_pnl": 0,
            "trades":    len([t for t in active_trades if t.get('closed')])
        }
    }
    STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATUS_FILE, 'w') as f:
        json.dump(state, f, indent=2)

    price_str = ' | '.join([f"{p.replace('=X','')}: {v:.5f}" for p, v in prices.items()])
    print(
        f"AGENT_STATUS_UPDATE:{json.dumps({'agentId': 'sterling_fx', 'status': 'ACTIVE', 'message': f'Tracking {len(pending)} zones | {price_str}', 'timestamp': datetime.now().isoformat()})}",
        flush=True
    )

# ── Zone Scan ─────────────────────────────────────────────────────────────────
def run_scan() -> dict:
    """Full zone scan across all pairs. Returns {ticker: [zones]}."""
    all_zones = {}
    print(f"[Sterling] 🔍 Zone scan at {datetime.now().strftime('%H:%M:%S')}...")
    for pair in PAIRS:
        try:
            data = yf.download(pair, period=PERIOD, interval=TIMEFRAME, progress=False)
            if data.empty:
                print(f"[Sterling] ⚠️ No data: {pair}")
                all_zones[pair] = []
                continue
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)
            atr   = calculate_atr(data, ATR_PERIOD)
            zones = find_zones(data, atr, pair)
            # Tag ticker
            for z in zones:
                z['ticker'] = YF_TO_SIGNAL.get(pair, pair.replace('=X', ''))
            print(f"[Sterling] {pair}: {len(zones)} fresh zones")
            all_zones[pair] = zones
        except Exception as e:
            print(f"[Sterling] ❌ Scan error {pair}: {e}")
            all_zones[pair] = []
    return all_zones

# ── Trade Exit Monitor ────────────────────────────────────────────────────────
def check_trade_exits(active_trades: list, prices: dict) -> list:
    remaining = []
    for trade in active_trades:
        pair  = trade['pair']
        price = prices.get(pair)
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
            reason = f"TP hit @ {price:.5f} (target {trade['take_profit']:.5f})"
            fire_signal(pair, 'EXIT', price, reason=reason)
            log_message('fx', f"🎯 TP HIT: {YF_TO_SIGNAL.get(pair,pair)} +{RISK_REWARD}R", type='trade')
            print(f"[Sterling] 🎯 TP: {pair} @ {price:.5f}")
        elif hit_sl:
            reason = f"SL hit @ {price:.5f} (stop {trade['stop_loss']:.5f})"
            fire_signal(pair, 'EXIT', price, reason=reason)
            log_message('fx', f"🛑 SL HIT: {YF_TO_SIGNAL.get(pair,pair)} -1R", type='trade')
            print(f"[Sterling] 🛑 SL: {pair} @ {price:.5f}")
        else:
            remaining.append(trade)
    return remaining

# ── Zone Entry Check ──────────────────────────────────────────────────────────
def check_zone_entries(zones_by_pair: dict, active_trades: list, prices: dict) -> tuple:
    open_pairs = {t['pair'] for t in active_trades}

    for pair, zones in zones_by_pair.items():
        price = prices.get(pair)
        if price is None:
            continue
        if pair in open_pairs:
            continue
        if len(active_trades) >= MAX_OPEN_TRADES:
            break

        for zone in zones:
            if zone.get('triggered') or zone.get('status') != 'PENDING':
                continue

            action  = None
            entered = False
            if zone['type'] == 'DEMAND' and zone['bottom'] <= price <= zone['top']:
                entered = True
                action  = 'BUY'
            elif zone['type'] == 'SUPPLY' and zone['bottom'] <= price <= zone['top']:
                entered = True
                action  = 'SELL'

            if entered and action:
                symbol = YF_TO_SIGNAL.get(pair, pair.replace('=X', ''))
                print(f"[Sterling] ⚡ Zone entry: {pair} {action} @ {price:.5f} ({zone['type']} {zone['bottom']:.5f}-{zone['top']:.5f})")
                success = fire_signal(
                    pair=pair,
                    action=action,
                    price=price,
                    stop_loss=zone['stop_loss'],
                    take_profit=zone['take_profit'],
                    reason=f"FX {zone['type']} zone — {symbol}",
                )
                if success:
                    zone['triggered'] = True
                    zone['status']    = 'TRIGGERED'
                    active_trades.append({
                        'pair':        pair,
                        'symbol':      symbol,
                        'direction':   'LONG' if action == 'BUY' else 'SHORT',
                        'entry_price': price,
                        'stop_loss':   zone['stop_loss'],
                        'take_profit': zone['take_profit'],
                        'opened_at':   datetime.now().isoformat(),
                    })
                    open_pairs.add(pair)
                break   # one entry per pair per tick

    return zones_by_pair, active_trades

# ── Main Loop ─────────────────────────────────────────────────────────────────
def run():
    print(f"""
╔══════════════════════════════════════════════════════╗
║       STERLING  —  FX Supply & Demand Engine         ║
║  Pairs: EURUSD  GBPUSD  USDJPY  AUDUSD  USDCAD      ║
║  Scan: every {SCAN_INTERVAL_MIN}min  |  Tick: every {TICK_INTERVAL_SEC}s              ║
║  Broker: OANDA Practice  |  Max positions: {MAX_OPEN_TRADES}        ║
╚══════════════════════════════════════════════════════╝
""")
    log_message('fx', get_random_quip('fx'))
    log_message('fx', f"🚀 Sterling online — live FX scanning {len(PAIRS)} pairs")

    # Start OANDA Streaming feed (FREE with practice account — sub-second FX prices)
    # Falls back to yfinance polling if OANDA_API_TOKEN is not set
    _price_feed = build_feed_for_agent('sterling')

    # ── Restore persisted state ──────────────────────────────────────────────
    saved = load_agent_state('sterling_fx')
    zones_by_pair  = saved.get('zones_by_pair', {})
    active_trades  = saved.get('active_trades', [])
    scan_count     = saved.get('scan_count', 0)
    if active_trades:
        print(f"[Sterling] Restored {len(active_trades)} active trades from saved state")
    last_scan_time = 0 if not zones_by_pair else time.time()  # force scan if no zones

    while True:
        now = time.time()

        # ── Periodic zone rescan ──────────────────────────────────────────────
        if now - last_scan_time >= SCAN_INTERVAL_MIN * 60:
            # Preserve triggered state across re-scans
            triggered = {}
            for pair, zones in zones_by_pair.items():
                triggered[pair] = {(z['top'], z['bottom']): z.get('status') for z in zones}

            zones_by_pair  = run_scan()
            last_scan_time = now
            scan_count    += 1

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
            price_str = '  '.join([f"{p.replace('=X','')}: {v:.5f}" for p, v in prices.items()])
            print(f"[Sterling] 💱 {price_str}")

        # ── Check open trade exits ────────────────────────────────────────────
        if active_trades:
            active_trades = check_trade_exits(active_trades, prices)

        # ── Check zone entries ────────────────────────────────────────────────
        if zones_by_pair:
            zones_by_pair, active_trades = check_zone_entries(zones_by_pair, active_trades, prices)

        # ── Persist state ────────────────────────────────────────────────────
        save_agent_state('sterling_fx', {
            'zones_by_pair': {p: [_clean_zone(z) for z in zs] for p, zs in zones_by_pair.items()},
            'active_trades': active_trades,
            'scan_count': scan_count,
        })

        # ── Broadcast status ──────────────────────────────────────────────────
        broadcast_status(zones_by_pair, active_trades, scan_count, prices)

        time.sleep(TICK_INTERVAL_SEC)


def _clean_zone(z: dict) -> dict:
    """Strip non-serializable fields from zone dict."""
    return {k: v for k, v in z.items() if k in (
        'created_at', 'type', 'top', 'bottom', 'entry', 'stop_loss',
        'take_profit', 'status', 'triggered', 'ticker'
    )}

if __name__ == "__main__":
    run()
