"""
Boba — Options S&D Zone Trader (Paper via SPY Proxy)
=====================================================
• Scans SPY 15m candles for Supply & Demand zones
• Time-gated: entries only 9:30-11:00 AM EST (peak options volume)
• Fires webhooks to Next.js executor → Alpaca Paper (SPY)
• Monitors open trades: SL at -15%, TP at +20% (options-style risk)
• Continuous live loop with 5-minute scans
• Broadcasts AGENT_STATUS_UPDATE for the dashboard
"""

import os
import yfinance as yf
import pandas as pd
import numpy as np
import json
import time
import requests
from pathlib import Path
from datetime import datetime, time as dtime
import pytz
from agent_utils import log_message, get_random_quip

# ── Config ────────────────────────────────────────────────────────────────────
SYMBOL              = 'SPY'
TIMEFRAME           = '15m'
PERIOD              = '5d'
SCAN_INTERVAL_SEC   = 300            # 5 minute scan interval
MAX_OPEN_TRADES     = 1              # Options = one at a time
SL_PCT              = 0.015          # 1.5% stop (tighter for equity proxy)
TP_PCT              = 0.03           # 3% target (simulates options leverage gain)
STATUS_FILE         = Path(__file__).parent.parent / 'data' / 'boba_agent_status.json'
WEBHOOK_URL         = "http://localhost:3000/api/webhook/tradingview"
WEBHOOK_SECRET      = os.getenv("WEBHOOK_SECRET")
if not WEBHOOK_SECRET:
    raise RuntimeError("WEBHOOK_SECRET environment variable is required")

EST = pytz.timezone('US/Eastern')


# ── Time Gates ────────────────────────────────────────────────────────────────
def is_entry_window() -> bool:
    """Entries only 9:30-11:00 AM EST (peak options flow)."""
    now = datetime.now(EST).time()
    return dtime(9, 30) <= now <= dtime(11, 0)


def is_market_hours() -> bool:
    now_et = datetime.now(EST)
    if now_et.weekday() >= 5:
        return False
    return dtime(9, 30) <= now_et.time() <= dtime(16, 0)


# ── Webhook ───────────────────────────────────────────────────────────────────
def fire_signal(action: str, price: float, stop_loss: float = None,
                take_profit: float = None, reason: str = "") -> bool:
    payload = {
        "symbol":      SYMBOL,
        "action":      action,
        "price":       price,
        "strategy":    "Boba_Options_SD",
        "stopLoss":    stop_loss,
        "takeProfit":  take_profit,
        "notes":       reason or f"Boba: {action} {SYMBOL} @ {price}",
    }
    headers = {
        "Content-Type":     "application/json",
        "X-Webhook-Secret": WEBHOOK_SECRET,
    }
    try:
        resp = requests.post(WEBHOOK_URL, json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            print(f"[Boba] Signal sent: {action} {SYMBOL} @ ${price:.2f}")
            log_message('boba', f"{action} {SYMBOL} @ ${price:.2f} | {reason}", type='trade')
            return True
        else:
            print(f"[Boba] Webhook failed {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"[Boba] Webhook error: {e}")
        return False


# ── Status Broadcast ──────────────────────────────────────────────────────────
def broadcast_status(zones_count: int, active_trades: list, price: float, scan_count: int):
    state = {
        "id":              "boba",
        "name":            "Boba",
        "last_updated":    datetime.now().isoformat(),
        "status":          "ACTIVE" if is_entry_window() else "SCANNING",
        "market_price":    round(price, 2),
        "active_pairs":    1,
        "scan_count":      scan_count,
        "pending_orders":  [],
        "active_trades":   active_trades,
        "total_zones_found": zones_count,
        "performance": {
            "win_rate":  0,
            "total_pnl": 0,
            "trades":    0,
        }
    }
    STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATUS_FILE, 'w') as f:
        json.dump(state, f, indent=2)

    msg = f"SPY ${price:.2f} | Zones: {zones_count} | Trades: {len(active_trades)}"
    print(
        f"AGENT_STATUS_UPDATE:{json.dumps({'agentId': 'boba', 'status': state['status'], 'message': msg, 'timestamp': datetime.now().isoformat()})}",
        flush=True
    )


# ── Zone Detection ────────────────────────────────────────────────────────────
def find_zones(df: pd.DataFrame) -> tuple:
    """Identify S&D zones on 15m data. Returns (demand_zones, supply_zones)."""
    demand = []
    supply = []

    if df.empty or len(df) < 10:
        return demand, supply

    for i in range(5, len(df) - 1):
        cur  = df.iloc[i]
        prev = df.iloc[i - 1]

        body = abs(cur['Close'] - cur['Open'])
        avg_range = (df['High'].iloc[i-5:i] - df['Low'].iloc[i-5:i]).mean()

        if avg_range == 0:
            continue

        is_impulse = body > avg_range * 1.5

        if is_impulse:
            if cur['Close'] > cur['Open']:
                # Bullish impulse → demand zone at base
                demand.append({
                    'top':     float(cur['Open']),
                    'bottom':  float(prev['Low']),
                    'fresh':   True,
                    'type':    'DEMAND',
                    'created': df.index[i].strftime('%Y-%m-%d %H:%M') if hasattr(df.index[i], 'strftime') else str(df.index[i]),
                })
            else:
                # Bearish impulse → supply zone at top
                supply.append({
                    'top':     float(prev['High']),
                    'bottom':  float(cur['Open']),
                    'fresh':   True,
                    'type':    'SUPPLY',
                    'created': df.index[i].strftime('%Y-%m-%d %H:%M') if hasattr(df.index[i], 'strftime') else str(df.index[i]),
                })

    # Keep only the most recent zones
    return demand[-5:], supply[-5:]


# ── Live Price ────────────────────────────────────────────────────────────────
def get_current_price() -> float | None:
    try:
        hist = yf.Ticker(SYMBOL).history(period='1d', interval='5m')
        if not hist.empty:
            return float(hist['Close'].iloc[-1])
    except Exception as e:
        print(f"[Boba] Price fetch failed: {e}")
    return None


# ── Entry Check ───────────────────────────────────────────────────────────────
def check_zone_entries(demand_zones: list, supply_zones: list,
                       active_trades: list, price: float) -> tuple:
    """Check if price has entered any fresh zone. Returns updated (zones, trades)."""
    if len(active_trades) >= MAX_OPEN_TRADES:
        return demand_zones, supply_zones, active_trades

    # Check demand zones (LONG)
    for zone in demand_zones:
        if not zone['fresh']:
            continue
        if zone['bottom'] <= price <= zone['top']:
            sl = round(price * (1 - SL_PCT), 2)
            tp = round(price * (1 + TP_PCT), 2)
            print(f"[Boba] Zone entry: BUY {SYMBOL} @ ${price:.2f} (DEMAND {zone['bottom']:.2f}-{zone['top']:.2f})")
            success = fire_signal(
                action='BUY',
                price=price,
                stop_loss=sl,
                take_profit=tp,
                reason=f"Demand zone entry ({zone['bottom']:.2f}-{zone['top']:.2f})",
            )
            if success:
                zone['fresh'] = False
                active_trades.append({
                    'direction':   'LONG',
                    'entry_price': price,
                    'stop_loss':   sl,
                    'take_profit': tp,
                    'opened_at':   datetime.now().isoformat(),
                    'zone_type':   'DEMAND',
                })
            break

    if len(active_trades) >= MAX_OPEN_TRADES:
        return demand_zones, supply_zones, active_trades

    # Check supply zones (SHORT)
    for zone in supply_zones:
        if not zone['fresh']:
            continue
        if zone['bottom'] <= price <= zone['top']:
            sl = round(price * (1 + SL_PCT), 2)
            tp = round(price * (1 - TP_PCT), 2)
            print(f"[Boba] Zone entry: SELL {SYMBOL} @ ${price:.2f} (SUPPLY {zone['bottom']:.2f}-{zone['top']:.2f})")
            success = fire_signal(
                action='SELL',
                price=price,
                stop_loss=sl,
                take_profit=tp,
                reason=f"Supply zone entry ({zone['bottom']:.2f}-{zone['top']:.2f})",
            )
            if success:
                zone['fresh'] = False
                active_trades.append({
                    'direction':   'SHORT',
                    'entry_price': price,
                    'stop_loss':   sl,
                    'take_profit': tp,
                    'opened_at':   datetime.now().isoformat(),
                    'zone_type':   'SUPPLY',
                })
            break

    return demand_zones, supply_zones, active_trades


# ── Trade Exit Monitor ────────────────────────────────────────────────────────
def check_trade_exits(active_trades: list, price: float) -> list:
    remaining = []
    for trade in active_trades:
        hit_tp = hit_sl = False
        if trade['direction'] == 'LONG':
            hit_tp = price >= trade['take_profit']
            hit_sl = price <= trade['stop_loss']
        else:
            hit_tp = price <= trade['take_profit']
            hit_sl = price >= trade['stop_loss']

        if hit_tp:
            fire_signal('EXIT', price, reason=f"TP hit @ ${price:.2f}")
            log_message('boba', f"TP HIT: Boba +{TP_PCT*100:.0f}%", type='trade')
            print(f"[Boba] TP: ${price:.2f}")
        elif hit_sl:
            fire_signal('EXIT', price, reason=f"SL hit @ ${price:.2f}")
            log_message('boba', f"SL HIT: Boba -{SL_PCT*100:.0f}%", type='trade')
            print(f"[Boba] SL: ${price:.2f}")
        else:
            remaining.append(trade)

    return remaining


# ── Main Loop ─────────────────────────────────────────────────────────────────
def run():
    print("""
+=================================================+
|       BOBA  -  Options S&D Zone Trader          |
|  Symbol: SPY (Options Proxy)                    |
|  Scan: every 5min | Entry: 9:30-11:00 AM EST    |
|  SL: -1.5% | TP: +3% | Max: 1 position          |
+=================================================+
""")
    log_message('boba', get_random_quip('boba'))
    log_message('boba', f"Boba online - scanning {SYMBOL} for options setups")

    demand_zones    = []
    supply_zones    = []
    active_trades   = []
    scan_count      = 0
    last_zone_scan  = 0

    while True:
        try:
            if not is_market_hours():
                now_str = datetime.now(EST).strftime('%H:%M:%S')
                print(f"[Boba] Outside market hours ({now_str} ET). Sleeping 5m...")
                time.sleep(300)
                continue

            scan_count += 1
            now = time.time()
            now_str = datetime.now(EST).strftime('%H:%M:%S')
            print(f"\n[{now_str}] Boba scan #{scan_count}")

            # Full zone rescan every 15 minutes
            if now - last_zone_scan >= 900:
                print(f"[Boba] Rescanning zones...")
                data = yf.download(SYMBOL, period=PERIOD, interval=TIMEFRAME, progress=False)
                if isinstance(data.columns, pd.MultiIndex):
                    data.columns = data.columns.get_level_values(0)
                if not data.empty:
                    demand_zones, supply_zones = find_zones(data)
                    print(f"[Boba] {SYMBOL}: {len(demand_zones)} demand, {len(supply_zones)} supply zones")
                last_zone_scan = now

            # Get live price
            price = get_current_price()
            if price is None:
                time.sleep(60)
                continue

            print(f"   SPY: ${price:.2f} | Zones: {len(demand_zones) + len(supply_zones)} | Open: {len(active_trades)}")

            # Check exits
            if active_trades:
                active_trades = check_trade_exits(active_trades, price)

            # Check entries (only during entry window)
            if is_entry_window() and (demand_zones or supply_zones):
                demand_zones, supply_zones, active_trades = check_zone_entries(
                    demand_zones, supply_zones, active_trades, price
                )
            elif not is_entry_window():
                print(f"   Entry window closed - monitoring exits only")

            # Broadcast
            total_zones = len(demand_zones) + len(supply_zones)
            broadcast_status(total_zones, active_trades, price, scan_count)

            time.sleep(SCAN_INTERVAL_SEC)

        except KeyboardInterrupt:
            print("\nBoba shutting down...")
            break
        except Exception as e:
            print(f"[Boba] Error: {e}")
            import traceback
            traceback.print_exc()
            time.sleep(60)


# ── Legacy class interface for run_boba.py compatibility ──────────────────────
class BobaTraderEngine:
    """Backward-compatible class wrapper."""
    def __init__(self, symbol='SPY'):
        self.symbol = symbol
        self.supply_zones = []
        self.demand_zones = []
        self.active_trade = None
        self.closed_trades = []
        self.daily_pnl = 0
        self.trades_today = 0

    def fetch_data(self, period="5d", interval="15m"):
        try:
            ticker = yf.Ticker(self.symbol)
            df = ticker.history(period=period, interval=interval)
            return df
        except Exception as e:
            print(f"Error fetching data: {e}")
            return pd.DataFrame()

    def identify_zones(self, df_15m):
        self.supply_zones = []
        self.demand_zones = []
        if df_15m.empty:
            return
        for i in range(5, len(df_15m) - 1):
            cur = df_15m.iloc[i]
            prev = df_15m.iloc[i-1]
            body = abs(cur['Close'] - cur['Open'])
            avg = (df_15m.iloc[i-5:i]['High'] - df_15m.iloc[i-5:i]['Low']).mean()
            if body > avg * 1.5:
                if cur['Close'] > cur['Open']:
                    self.demand_zones.append({'top': cur['Open'], 'bottom': prev['Low'], 'fresh': True, 'type': 'demand'})
                else:
                    self.supply_zones.append({'top': prev['High'], 'bottom': cur['Open'], 'fresh': True, 'type': 'supply'})
        self.demand_zones = self.demand_zones[-5:]
        self.supply_zones = self.supply_zones[-5:]

    def check_signals(self, current_price, current_time):
        hour = current_time.hour
        minute = current_time.minute
        time_val = hour * 100 + minute
        if not (930 <= time_val <= 1100):
            return None
        for zone in self.demand_zones:
            if zone['fresh'] and zone['bottom'] <= current_price <= zone['top']:
                zone['fresh'] = False
                return {'side': 'LONG', 'price': current_price, 'type': 'DEMAND'}
        for zone in self.supply_zones:
            if zone['fresh'] and zone['bottom'] <= current_price <= zone['top']:
                zone['fresh'] = False
                return {'side': 'SHORT', 'price': current_price, 'type': 'SUPPLY'}
        return None

    def execute_trade(self, signal):
        self.active_trade = {
            'entry_price': signal['price'],
            'entry_time': datetime.now().isoformat(),
            'direction': signal['side'],
            'stop_loss': signal['price'] * (0.985 if signal['side'] == 'LONG' else 1.015),
            'targets': [signal['price'] * (1.03 if signal['side'] == 'LONG' else 0.97)],
            'status': 'ACTIVE'
        }
        self.trades_today += 1

    def get_status(self):
        return {
            'symbol': self.symbol,
            'active_trade': self.active_trade,
            'zones_found': len(self.supply_zones) + len(self.demand_zones),
            'daily_pnl': self.daily_pnl,
            'trades_today': self.trades_today
        }


if __name__ == "__main__":
    run()
