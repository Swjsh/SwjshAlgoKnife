"""
SPX Sniper Agent — 0DTE Options Scalper (Proxy via SPY)
========================================================
• Uses ^SPX underlying price action to generate CALL/PUT signals
• Enforces "Gold Rules":
    1. Time Gate: No trades before 10:30 AM or after 3:50 PM EST
    2. Trend Following: Trade with 9 EMA + VWAP alignment
    3. Pulse Check: Momentum confirmation on 5m timeframe
• Fires webhooks to Next.js executor → Alpaca Paper (SPY proxy)
• Continuous live loop with 5m scan interval
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
from agent_utils import log_message, get_random_quip, save_agent_state, load_agent_state, load_brain_knowledge
from position_sync import sync_positions_on_startup, pre_trade_health_check, check_existing_position

# ── Brain Integration ─────────────────────────────────────────────────────────
# Load agent-specific learning and strategy knowledge from the brain system
BRAIN = load_brain_knowledge('spx_sniper')

# ── Config ────────────────────────────────────────────────────────────────────
TICKER             = 'SPY'            # Use SPY directly — eliminates SPX/SPY price divergence
PROXY_SYMBOL       = 'SPY'           # Alpaca executes SPY
TIMEFRAME          = '5m'
PERIOD             = '5d'
SCAN_INTERVAL_SEC  = 300             # 5 minute scan interval
MAX_OPEN_TRADES    = 1               # 0DTE = one at a time
RISK_REWARD        = 1.5
STATUS_FILE        = Path(__file__).parent.parent / 'data' / 'spx_agent_status.json'
WEBHOOK_URL        = "http://localhost:3000/api/webhook/tradingview"
WEBHOOK_SECRET     = os.getenv("WEBHOOK_SECRET")
if not WEBHOOK_SECRET:
    raise RuntimeError("WEBHOOK_SECRET environment variable is required")

# ── Direct Alpaca Execution (SCRUM-5) ──────────────────────────────────────────
# When USE_DIRECT_ALPACA=true, bypass webhook and execute directly via REST API.
# This provides: fill confirmation, slippage logging, and eliminates webhook latency.
USE_DIRECT_ALPACA = os.getenv("USE_DIRECT_ALPACA", "false").lower() == "true"

# Lazy-loaded executor instance (P023 pattern - avoid import errors if credentials not set)
_executor_instance = None

def _get_executor():
    """Lazy-load AlpacaExecutor to avoid import errors when credentials not set."""
    global _executor_instance
    if _executor_instance is None:
        from alpaca_executor import AlpacaExecutor
        _executor_instance = AlpacaExecutor()
    return _executor_instance


def execute_direct(
    action: str,
    price: float,
    stop_loss: float = None,
    take_profit: float = None,
    reason: str = "",
    max_poll_attempts: int = 10,
    poll_interval_sec: float = 0.5
) -> dict:
    """
    Execute trade directly via Alpaca REST API.

    Args:
        action: "BUY", "SELL", or "EXIT"
        price: Expected entry/exit price (for slippage calculation)
        stop_loss: Stop loss price (not used for EXIT)
        take_profit: Take profit price (not used for EXIT)
        reason: Trade reason for logging
        max_poll_attempts: Maximum times to poll for fill status
        poll_interval_sec: Seconds between poll attempts

    Returns:
        {
            'success': bool,
            'order_id': str,
            'fill_price': float or None,
            'slippage': float (difference from expected price),
            'error': str (if failed)
        }
    """
    try:
        executor = _get_executor()

        # Handle EXIT action - close position
        if action == "EXIT":
            close_result = executor.close_position(PROXY_SYMBOL)
            if close_result:
                fill_price = float(close_result.get('filled_avg_price') or price)
                slippage = fill_price - price
                log_message('spx', f"🎯 EXIT {PROXY_SYMBOL} @ ${fill_price:.2f} | Slippage: ${slippage:+.2f} | {reason}", type='trade')
                print(f"[SPX Sniper] ✅ Direct EXIT filled @ ${fill_price:.2f} | Slippage: ${slippage:+.2f}")
                return {
                    'success': True,
                    'order_id': close_result.get('id'),
                    'fill_price': fill_price,
                    'slippage': slippage,
                }
            else:
                return {'success': True, 'order_id': None, 'fill_price': None, 'slippage': 0}

        # Calculate position size from stop loss
        if stop_loss is None:
            raise ValueError("stop_loss required for BUY/SELL orders")

        account = executor.get_account_info()
        risk_per_unit = abs(price - stop_loss)
        if risk_per_unit <= 0:
            raise ValueError(f"Invalid stop loss: entry={price}, sl={stop_loss}")

        # 1% risk per trade
        risk_amount = account['cash'] * 0.01
        qty = int(risk_amount / risk_per_unit)
        qty = max(1, qty)  # Minimum 1 share

        side = "buy" if action == "BUY" else "sell"
        time_in_force = "day"

        # Submit order
        print(f"[SPX Sniper] 📤 Direct order: {action} {qty} {PROXY_SYMBOL} @ ~${price:.2f}")
        order = executor.submit_market_order(PROXY_SYMBOL, qty, side, time_in_force)
        order_id = order['id']

        # Poll for fill status
        fill_price = None
        for attempt in range(max_poll_attempts):
            order_status = executor.get_order(order_id)
            status = order_status.get('status')

            if status == 'filled':
                fill_price = float(order_status.get('filled_avg_price') or price)
                break
            elif status in ('canceled', 'rejected', 'expired'):
                return {
                    'success': False,
                    'order_id': order_id,
                    'fill_price': None,
                    'slippage': 0,
                    'error': f"Order {status}: {order_status}",
                }

            time.sleep(poll_interval_sec)

        if fill_price is None:
            # Still not filled after polling - return partial success
            print(f"[SPX Sniper] ⚠️ Order {order_id} not filled after {max_poll_attempts} polls")
            return {
                'success': True,  # Order submitted successfully
                'order_id': order_id,
                'fill_price': None,
                'slippage': 0,
            }

        slippage = fill_price - price
        log_message('spx', f"⚡ {action} {PROXY_SYMBOL} @ ${fill_price:.2f} | Slippage: ${slippage:+.2f} | {reason}", type='trade')
        print(f"[SPX Sniper] ✅ Direct {action} filled @ ${fill_price:.2f} | Slippage: ${slippage:+.2f}")

        return {
            'success': True,
            'order_id': order_id,
            'fill_price': fill_price,
            'slippage': slippage,
        }

    except Exception as e:
        error_msg = str(e)
        print(f"[SPX Sniper] ❌ Direct execution failed: {error_msg}")
        return {
            'success': False,
            'order_id': None,
            'fill_price': None,
            'slippage': 0,
            'error': error_msg,
        }


EST = pytz.timezone('US/Eastern')


# ── Indicators ────────────────────────────────────────────────────────────────
def calculate_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    # EMA 9
    df['EMA9'] = df['Close'].ewm(span=9, adjust=False).mean()

    # VWAP with proper daily reset
    # Detect session boundaries: new day = new VWAP accumulation
    df['TP'] = (df['High'] + df['Low'] + df['Close']) / 3
    df['TPxVol'] = df['TP'] * df['Volume']

    # Group by trading date and compute cumulative VWAP per day
    df['TradeDate'] = df.index.date if hasattr(df.index, 'date') else pd.to_datetime(df.index).date
    df['CumTPxVol'] = df.groupby('TradeDate')['TPxVol'].cumsum()
    df['CumVol'] = df.groupby('TradeDate')['Volume'].cumsum()
    df['VWAP'] = df['CumTPxVol'] / df['CumVol'].replace(0, np.nan)
    df['VWAP'] = df['VWAP'].ffill()  # forward fill any NaN from zero volume

    # Clean up temp columns
    df.drop(columns=['TP', 'TPxVol', 'TradeDate', 'CumTPxVol', 'CumVol'], inplace=True)

    # RSI 14 (with NaN protection)
    delta = df['Close'].diff()
    gain = delta.where(delta > 0, 0).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss.replace(0, np.nan)
    df['RSI'] = 100 - (100 / (1 + rs))
    df['RSI'] = df['RSI'].fillna(50.0)  # default to neutral when insufficient data
    return df


# ── Time Gate ─────────────────────────────────────────────────────────────────
def is_safe_time() -> bool:
    """Returns True if within safe trading window (10:30 AM - 3:50 PM EST)."""
    now = datetime.now(EST).time()
    return dtime(10, 30) <= now <= dtime(15, 50)


def is_market_hours() -> bool:
    """Returns True if US equities market is open."""
    now_et = datetime.now(EST)
    if now_et.weekday() >= 5:
        return False
    return dtime(9, 30) <= now_et.time() <= dtime(16, 0)


# ── Webhook / Direct Execution ────────────────────────────────────────────────
def fire_signal(action: str, price: float, stop_loss: float = None,
                take_profit: float = None, reason: str = "") -> bool:
    """
    Execute trade signal via webhook or direct Alpaca API.

    When USE_DIRECT_ALPACA=true, bypasses webhook and executes directly
    via Alpaca REST API for fill confirmation and slippage logging.
    """
    # Route to direct execution if enabled
    if USE_DIRECT_ALPACA:
        result = execute_direct(
            action=action,
            price=price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            reason=reason,
        )
        return result.get('success', False)

    # Default: webhook execution
    payload = {
        "symbol":      PROXY_SYMBOL,
        "action":      action,
        "price":       price,
        "strategy":    "SPXSniper_0DTE",
        "stopLoss":    stop_loss,
        "takeProfit":  take_profit,
        "notes":       reason or f"SPX Sniper: {action} {PROXY_SYMBOL} @ {price}",
    }
    headers = {
        "Content-Type":     "application/json",
        "X-Webhook-Secret": WEBHOOK_SECRET,
    }
    try:
        resp = requests.post(WEBHOOK_URL, json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            print(f"[SPX Sniper] Signal sent: {action} {PROXY_SYMBOL} @ ${price:.2f}")
            log_message('spx', f"{action} {PROXY_SYMBOL} @ ${price:.2f} | {reason}", type='trade')
            return True
        else:
            print(f"[SPX Sniper] Webhook failed {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"[SPX Sniper] Webhook error: {e}")
        return False


# ── Status Broadcast ──────────────────────────────────────────────────────────
def broadcast_status(trend: str, price: float, active_trades: list,
                     pending_signals: list, scan_count: int):
    state = {
        "id":              "spx_sniper",
        "name":            "SPX Sniper",
        "last_updated":    datetime.now().isoformat(),
        "status":          "ACTIVE" if is_safe_time() else "WAITING (Time Gate)",
        "market_price":    round(price, 2),
        "trend":           trend,
        "active_pairs":    1,
        "scan_count":      scan_count,
        "pending_orders":  pending_signals[:5],
        "active_trades":   active_trades,
        "total_zones_found": len(pending_signals),
        "performance": {
            "win_rate":  0,
            "total_pnl": 0,
            "trades":    0,
        }
    }
    STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATUS_FILE, 'w') as f:
        json.dump(state, f, indent=2)

    msg = f"SPX ${price:.2f} | Trend: {trend} | Signals: {len(pending_signals)}"
    print(
        f"AGENT_STATUS_UPDATE:{json.dumps({'agentId': 'spx_sniper', 'status': state['status'], 'message': msg, 'timestamp': datetime.now().isoformat()})}",
        flush=True
    )


# ── Signal Generation ─────────────────────────────────────────────────────────
def generate_signals(df: pd.DataFrame) -> tuple:
    """Analyze 5m candles for CALL/PUT setups. Returns (signals, trend, price)."""
    signals = []
    last  = df.iloc[-1]
    prev  = df.iloc[-2]

    # Determine trend
    trend = "NEUTRAL"
    if last['Close'] > last['EMA9'] and last['Close'] > last['VWAP']:
        trend = "BULLISH"
    elif last['Close'] < last['EMA9'] and last['Close'] < last['VWAP']:
        trend = "BEARISH"

    current_price = float(last['Close'])
    rsi           = float(last['RSI']) if not pd.isna(last['RSI']) else 50.0

    # CALL Setup: cross above VWAP + bullish trend + RSI < 70
    if prev['Close'] < prev['VWAP'] and last['Close'] > last['VWAP']:
        if trend == "BULLISH" and rsi < 70:
            risk  = abs(current_price - float(last['Low']))
            if risk > 0:
                signals.append({
                    'type':       'CALL',
                    'action':     'BUY',
                    'price':      current_price,
                    'stop_loss':  round(float(last['Low']), 2),
                    'take_profit': round(current_price + risk * RISK_REWARD, 2),
                    'reason':     f"VWAP cross-up | Trend: {trend} | RSI: {rsi:.1f}",
                })

    # PUT Setup: cross below VWAP + bearish trend + RSI > 30
    elif prev['Close'] > prev['VWAP'] and last['Close'] < last['VWAP']:
        if trend == "BEARISH" and rsi > 30:
            risk  = abs(float(last['High']) - current_price)
            if risk > 0:
                signals.append({
                    'type':       'PUT',
                    'action':     'SELL',
                    'price':      current_price,
                    'stop_loss':  round(float(last['High']), 2),
                    'take_profit': round(current_price - risk * RISK_REWARD, 2),
                    'reason':     f"VWAP cross-down | Trend: {trend} | RSI: {rsi:.1f}",
                })

    return signals, trend, current_price


# ── Trade Exit Monitor ────────────────────────────────────────────────────────
def check_trade_exits(active_trades: list, current_price: float) -> list:
    remaining = []
    for trade in active_trades:
        hit_tp = hit_sl = False
        if trade['direction'] == 'LONG':
            hit_tp = current_price >= trade['take_profit']
            hit_sl = current_price <= trade['stop_loss']
        else:
            hit_tp = current_price <= trade['take_profit']
            hit_sl = current_price >= trade['stop_loss']

        if hit_tp:
            reason = f"TP hit @ ${current_price:.2f}"
            fire_signal('EXIT', current_price, reason=reason)
            log_message('spx', f"TP HIT: SPX Sniper +{RISK_REWARD}R", type='trade')
            print(f"[SPX Sniper] TP: ${current_price:.2f}")
        elif hit_sl:
            reason = f"SL hit @ ${current_price:.2f}"
            fire_signal('EXIT', current_price, reason=reason)
            log_message('spx', f"SL HIT: SPX Sniper -1R", type='trade')
            print(f"[SPX Sniper] SL: ${current_price:.2f}")
        else:
            remaining.append(trade)

    return remaining


# ── Main Loop ─────────────────────────────────────────────────────────────────
def run():
    print("""
+=================================================+
|       SPX SNIPER  -  0DTE Options Scalper       |
|  Proxy: SPY via Alpaca Paper                    |
|  Scan: every 5min | Time Gate: 10:30-15:50 EST  |
+=================================================+
""")
    log_message('spx', get_random_quip('spx'))
    log_message('spx', f"SPX Sniper online - 0DTE scalper targeting SPY (direct, no proxy mismatch)")

    # ── Restore persisted state ──────────────────────────────────────────────
    saved = load_agent_state('spx_sniper')
    active_trades   = saved.get('active_trades', [])
    scan_count      = saved.get('scan_count', 0)
    if active_trades:
        print(f"[SPX Sniper] Restored {len(active_trades)} active trades from saved state")

    # ── Sync with broker positions ──────────────────────────────────────────
    print("[SPX Sniper] Syncing positions with Alpaca broker...")
    active_trades = sync_positions_on_startup('spx_sniper', PROXY_SYMBOL, active_trades)
    save_agent_state('spx_sniper', {'active_trades': active_trades, 'scan_count': scan_count})

    while True:
        try:
            # Check market hours
            if not is_market_hours():
                now_str = datetime.now(EST).strftime('%H:%M:%S')
                print(f"[SPX Sniper] Outside market hours ({now_str} ET). Sleeping 5m...")
                time.sleep(300)
                continue

            scan_count += 1
            now_str = datetime.now(EST).strftime('%H:%M:%S')
            print(f"\n[{now_str}] SPX Sniper scan #{scan_count}")

            # Fetch data
            data = yf.download(TICKER, period=PERIOD, interval=TIMEFRAME, progress=False)
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)

            if data.empty:
                print("[SPX Sniper] No data received, retrying...")
                time.sleep(60)
                continue

            df = calculate_indicators(data)
            signals, trend, current_price = generate_signals(df)

            rsi_val = df['RSI'].iloc[-1]
            rsi_str = f"{rsi_val:.1f}" if not pd.isna(rsi_val) else "N/A"
            print(f"   SPX: ${current_price:.2f} | Trend: {trend} | RSI: {rsi_str}")

            # Check exits on existing trades
            if active_trades:
                active_trades = check_trade_exits(active_trades, current_price)

            # Only enter during safe time window
            if is_safe_time() and signals and len(active_trades) < MAX_OPEN_TRADES:
                sig = signals[0]

                # Pre-trade health check: skip if position already exists
                health = pre_trade_health_check('spx_sniper', PROXY_SYMBOL)
                if health.get('skip'):
                    print(f"[SPX Sniper] Skipping entry: {health.get('reason')}")
                elif not health.get('ok'):
                    print(f"[SPX Sniper] Health check failed: {health.get('reason')}")
                else:
                    print(f"[SPX Sniper] {sig['type']} signal: {PROXY_SYMBOL} @ ${sig['price']:.2f}")
                    success = fire_signal(
                        action=sig['action'],
                        price=sig['price'],
                        stop_loss=sig['stop_loss'],
                        take_profit=sig['take_profit'],
                        reason=sig['reason'],
                    )
                    if success:
                        active_trades.append({
                            'symbol':      PROXY_SYMBOL,
                            'direction':   'LONG' if sig['action'] == 'BUY' else 'SHORT',
                            'entry_price': sig['price'],
                            'stop_loss':   sig['stop_loss'],
                            'take_profit': sig['take_profit'],
                            'opened_at':   datetime.now().isoformat(),
                            'signal_type': sig['type'],
                        })
            elif not is_safe_time():
                print(f"   Time gate active - waiting for 10:30 AM EST")

            # Persist state
            save_agent_state('spx_sniper', {
                'active_trades': active_trades,
                'scan_count': scan_count,
            })

            # Broadcast
            broadcast_status(trend, current_price, active_trades, signals, scan_count)

            time.sleep(SCAN_INTERVAL_SEC)

        except KeyboardInterrupt:
            print("\nSPX Sniper shutting down...")
            break
        except Exception as e:
            print(f"[SPX Sniper] Error: {e}")
            import traceback
            traceback.print_exc()
            time.sleep(60)


# ── Legacy class interface for run_spx_sniper.py compatibility ────────────────
class SPXSniperEngine:
    """Compatibility wrapper so run_spx_sniper.py doesn't crash."""
    def __init__(self, symbol="SPX"):
        self.symbol = symbol
        self.supply_zones = []
        self.demand_zones = []
        self.active_trade = None

    def fetch_data(self, period="5d", interval="15m"):
        try:
            data = yf.download('SPY', period=period, interval=interval, progress=False)
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)
            return data
        except Exception as e:
            print(f"[SPX Sniper] Data error: {e}")
            return pd.DataFrame()

    def identify_zones(self, df):
        self.supply_zones = []
        self.demand_zones = []
        if df.empty:
            return
        for i in range(5, len(df) - 1):
            body = abs(df['Close'].iloc[i] - df['Open'].iloc[i])
            avg = (df['High'].iloc[i-5:i] - df['Low'].iloc[i-5:i]).mean()
            if body > avg * 1.5:
                if df['Close'].iloc[i] > df['Open'].iloc[i]:
                    self.demand_zones.append({
                        'top': float(df['Open'].iloc[i]),
                        'bottom': float(df.iloc[i-1]['Low']),
                        'fresh': True, 'type': 'demand'
                    })
                else:
                    self.supply_zones.append({
                        'top': float(df.iloc[i-1]['High']),
                        'bottom': float(df['Open'].iloc[i]),
                        'fresh': True, 'type': 'supply'
                    })
        self.demand_zones = self.demand_zones[-5:]
        self.supply_zones = self.supply_zones[-5:]

    def check_signals(self, price, current_time):
        hour = current_time.hour
        minute = current_time.minute
        if not (1030 <= hour * 100 + minute <= 1550):
            return None
        for z in self.demand_zones:
            if z['fresh'] and z['bottom'] <= price <= z['top']:
                z['fresh'] = False
                return {'side': 'LONG', 'price': price, 'type': 'DEMAND'}
        for z in self.supply_zones:
            if z['fresh'] and z['bottom'] <= price <= z['top']:
                z['fresh'] = False
                return {'side': 'SHORT', 'price': price, 'type': 'SUPPLY'}
        return None

    def execute_trade(self, signal):
        self.active_trade = {
            'entry_price': signal['price'],
            'entry_time': datetime.now().isoformat(),
            'direction': signal['side'],
            'stop_loss': signal['price'] * (0.995 if signal['side'] == 'LONG' else 1.005),
            'take_profit': signal['price'] * (1.005 if signal['side'] == 'LONG' else 0.995),
            'status': 'ACTIVE',
        }

    def get_status(self):
        return {
            'symbol': self.symbol,
            'active_trade': self.active_trade,
            'zones_found': len(self.supply_zones) + len(self.demand_zones),
            'win_rate': 0, 'total_pnl': 0, 'total_trades': 0,
            'pending_orders': [], 'closed_trades': [],
        }


if __name__ == "__main__":
    run()
