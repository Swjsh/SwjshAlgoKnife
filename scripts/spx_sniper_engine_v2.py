"""
SPX Sniper Agent v2 — Extends BaseAgent
========================================
0DTE Options Scalper (Proxy via SPY) using the new BaseAgent foundation.

Same strategy as v1:
• Uses SPY price action to generate CALL/PUT signals
• Enforces "Gold Rules":
    1. Time Gate: No trades before 10:30 AM or after 3:50 PM EST
    2. Trend Following: Trade with 9 EMA + VWAP alignment
    3. Pulse Check: RSI momentum confirmation on 5m timeframe
• Fires webhooks or direct Alpaca API execution

Improvements from BaseAgent:
• Circuit breaker pattern (halts after N consecutive errors)
• Exponential backoff on errors
• Proper error logging to agent_logs.json
• Cleaner state persistence
"""

import os
import time
import numpy as np
import pandas as pd
import yfinance as yf
import pytz
from datetime import datetime, time as dtime
from typing import Optional, List

from base_agent import BaseAgent
from agent_utils import log_message, get_random_quip
from position_sync import sync_positions_on_startup, pre_trade_health_check

# ── Config ────────────────────────────────────────────────────────────────────
TICKER             = 'SPY'
PROXY_SYMBOL       = 'SPY'
TIMEFRAME          = '5m'
PERIOD             = '5d'
SCAN_INTERVAL_SEC  = 300             # 5 minute scan interval
MAX_OPEN_TRADES    = 1               # 0DTE = one at a time
RISK_REWARD        = 1.5

EST = pytz.timezone('US/Eastern')

# ── Direct Alpaca Execution ───────────────────────────────────────────────────
USE_DIRECT_ALPACA = os.getenv("USE_DIRECT_ALPACA", "false").lower() == "true"

# Lazy-loaded executor instance
_executor_instance = None


def _get_executor():
    """Lazy-load AlpacaExecutor."""
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
    """Execute trade directly via Alpaca REST API."""
    try:
        executor = _get_executor()

        # Handle EXIT action
        if action == "EXIT":
            close_result = executor.close_position(PROXY_SYMBOL)
            if close_result:
                fill_price = float(close_result.get('filled_avg_price') or price)
                slippage = fill_price - price
                log_message('spx', f"EXIT {PROXY_SYMBOL} @ ${fill_price:.2f} | Slippage: ${slippage:+.2f}", type='trade')
                print(f"[SPX Sniper] Direct EXIT filled @ ${fill_price:.2f} | Slippage: ${slippage:+.2f}")
                return {'success': True, 'order_id': close_result.get('id'), 'fill_price': fill_price, 'slippage': slippage}
            return {'success': True, 'order_id': None, 'fill_price': None, 'slippage': 0}

        # Calculate position size from stop loss
        if stop_loss is None:
            raise ValueError("stop_loss required for BUY/SELL orders")

        account = executor.get_account_info()
        risk_per_unit = abs(price - stop_loss)
        if risk_per_unit <= 0:
            raise ValueError(f"Invalid stop loss: entry={price}, sl={stop_loss}")

        risk_amount = account['cash'] * 0.01
        qty = max(1, int(risk_amount / risk_per_unit))

        side = "buy" if action == "BUY" else "sell"
        print(f"[SPX Sniper] Direct order: {action} {qty} {PROXY_SYMBOL} @ ~${price:.2f}")
        order = executor.submit_market_order(PROXY_SYMBOL, qty, side, "day")
        order_id = order['id']

        # Poll for fill status
        fill_price = None
        for _ in range(max_poll_attempts):
            order_status = executor.get_order(order_id)
            status = order_status.get('status')
            if status == 'filled':
                fill_price = float(order_status.get('filled_avg_price') or price)
                break
            elif status in ('canceled', 'rejected', 'expired'):
                return {'success': False, 'order_id': order_id, 'fill_price': None, 'slippage': 0, 'error': f"Order {status}"}
            time.sleep(poll_interval_sec)

        if fill_price:
            slippage = fill_price - price
            log_message('spx', f"{action} {PROXY_SYMBOL} @ ${fill_price:.2f} | Slippage: ${slippage:+.2f}", type='trade')
            print(f"[SPX Sniper] Direct {action} filled @ ${fill_price:.2f} | Slippage: ${slippage:+.2f}")
            return {'success': True, 'order_id': order_id, 'fill_price': fill_price, 'slippage': slippage}

        return {'success': True, 'order_id': order_id, 'fill_price': None, 'slippage': 0}

    except Exception as e:
        print(f"[SPX Sniper] Direct execution failed: {e}")
        return {'success': False, 'order_id': None, 'fill_price': None, 'slippage': 0, 'error': str(e)}


# ═══════════════════════════════════════════════════════════════════════════════
# SPX SNIPER AGENT (extends BaseAgent)
# ═══════════════════════════════════════════════════════════════════════════════

class SPXSniperAgent(BaseAgent):
    """
    0DTE SPX options scalper using SPY as proxy.
    VWAP cross + EMA9 trend alignment + RSI confirmation.
    """

    strategy_name = "SPXSniper_0DTE"

    def __init__(self):
        super().__init__(
            agent_id="spx",
            display_name="SPX Sniper",
            scan_interval_sec=SCAN_INTERVAL_SEC,
            max_consecutive_errors=10,
            error_backoff_base_sec=60,
            status_file_name="spx_agent_status.json"
        )

        # Agent-specific state
        self.ticker = TICKER
        self.proxy_symbol = PROXY_SYMBOL
        self.current_price: float = 0.0
        self.trend: str = "NEUTRAL"
        self.rsi: float = 50.0
        self.pending_signals: List[dict] = []

    # ═══════════════════════════════════════════════════════════════════════════
    # TIME GATES
    # ═══════════════════════════════════════════════════════════════════════════

    def _is_safe_time(self) -> bool:
        """Returns True if within safe trading window (10:30 AM - 3:50 PM EST)."""
        now = datetime.now(EST).time()
        return dtime(10, 30) <= now <= dtime(15, 50)

    def _is_market_hours(self) -> bool:
        """Returns True if US equities market is open."""
        now_et = datetime.now(EST)
        if now_et.weekday() >= 5:
            return False
        return dtime(9, 30) <= now_et.time() <= dtime(16, 0)

    # ═══════════════════════════════════════════════════════════════════════════
    # REQUIRED OVERRIDES
    # ═══════════════════════════════════════════════════════════════════════════

    def should_trade(self) -> bool:
        """Override: Only trade during market hours."""
        return self._is_market_hours()

    def execute_scan(self, price: float) -> None:
        """Main scan cycle."""
        now_str = datetime.now(EST).strftime('%H:%M:%S')
        print(f"\n[{now_str}] SPX Sniper scan #{self.scan_count}")

        # Fetch and process data
        data = yf.download(self.ticker, period=PERIOD, interval=TIMEFRAME, progress=False)
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)

        if data.empty:
            log_message(self.agent_id, "No data received", type='warning')
            return

        df = self._calculate_indicators(data)
        signals, self.trend, self.current_price = self._generate_signals(df)
        self.pending_signals = signals

        rsi_val = df['RSI'].iloc[-1]
        self.rsi = float(rsi_val) if not pd.isna(rsi_val) else 50.0
        rsi_str = f"{self.rsi:.1f}"

        print(f"   SPY: ${self.current_price:.2f} | Trend: {self.trend} | RSI: {rsi_str}")

        # Check for entry signals
        if self._is_safe_time() and signals and len(self.active_trades) < MAX_OPEN_TRADES:
            self._process_entry_signal(signals[0])
        elif not self._is_safe_time():
            print(f"   Time gate active - waiting for 10:30 AM EST")

    def get_current_price(self) -> Optional[float]:
        """Fetch current SPY price."""
        try:
            hist = yf.Ticker(self.ticker).history(period='1d', interval='5m')
            if not hist.empty:
                return float(hist['Close'].iloc[-1])
        except Exception as e:
            print(f"[SPX Sniper] Price fetch failed: {e}")
        return None

    # ═══════════════════════════════════════════════════════════════════════════
    # OPTIONAL HOOKS
    # ═══════════════════════════════════════════════════════════════════════════

    def on_startup(self) -> None:
        """Initialize and sync with broker."""
        log_message(self.agent_id, get_random_quip('spx'))

        # Sync positions with broker
        print("[SPX Sniper] Syncing positions with Alpaca broker...")
        self.active_trades = sync_positions_on_startup('spx_sniper', self.proxy_symbol, self.active_trades)

    def get_banner(self) -> str:
        exec_mode = "Direct Alpaca" if USE_DIRECT_ALPACA else "Webhook"
        return f"""
+=================================================+
|       SPX SNIPER v2 — 0DTE Options Scalper      |
|  Proxy: {self.proxy_symbol} via Alpaca Paper                    |
|  Scan: every {self.scan_interval_sec // 60}min | Time Gate: 10:30-15:50 EST  |
|  Execution: {exec_mode:32} |
|  [Using BaseAgent Foundation]                   |
+=================================================+
"""

    def get_status_extras(self) -> dict:
        """Add SPX-specific status fields."""
        return {
            'market_price': round(self.current_price, 2) if self.current_price else 0,
            'trend': self.trend,
            'rsi': round(self.rsi, 1),
            'time_gate_active': not self._is_safe_time(),
            'pending_orders': self.pending_signals[:5],
            'total_zones_found': len(self.pending_signals),
        }

    # ═══════════════════════════════════════════════════════════════════════════
    # POSITION MANAGEMENT (override for webhook/direct execution)
    # ═══════════════════════════════════════════════════════════════════════════

    def check_exits(self, price: float) -> list[dict]:
        """Check trades for SL/TP hit."""
        remaining = []
        for trade in self.active_trades:
            direction = trade.get('direction', 'LONG').upper()
            stop = trade.get('stop_loss')
            target = trade.get('take_profit')

            hit_tp = hit_sl = False

            if direction == 'LONG':
                hit_tp = target and price >= target
                hit_sl = stop and price <= stop
            else:
                hit_tp = target and price <= target
                hit_sl = stop and price >= stop

            if hit_tp:
                self._close_trade(trade, price, 'TAKE_PROFIT')
            elif hit_sl:
                self._close_trade(trade, price, 'STOP_LOSS')
            else:
                remaining.append(trade)

        return remaining

    def _close_trade(self, trade: dict, exit_price: float, reason: str) -> None:
        """Close trade via webhook or direct API."""
        entry = trade.get('entry_price', 0)
        direction = trade.get('direction', 'LONG')

        # Calculate P&L percentage
        if direction == 'LONG':
            pnl_pct = (exit_price - entry) / entry * 100
        else:
            pnl_pct = (entry - exit_price) / entry * 100

        # Fire EXIT signal
        self._fire_signal('EXIT', exit_price, reason=f"{reason} | {pnl_pct:+.1f}%")

        # Update metrics
        if pnl_pct >= 0:
            self.wins += 1
            log_message(self.agent_id, f"TP HIT: SPX Sniper +{RISK_REWARD}R", type='trade')
        else:
            self.losses += 1
            log_message(self.agent_id, f"SL HIT: SPX Sniper -1R", type='trade')

        self.daily_pnl += pnl_pct
        print(f"[SPX Sniper] {'TP' if reason == 'TAKE_PROFIT' else 'SL'}: ${exit_price:.2f}")

    # ═══════════════════════════════════════════════════════════════════════════
    # INDICATORS
    # ═══════════════════════════════════════════════════════════════════════════

    def _calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate EMA9, VWAP, and RSI."""
        df = df.copy()

        # EMA 9
        df['EMA9'] = df['Close'].ewm(span=9, adjust=False).mean()

        # VWAP with daily reset
        df['TP'] = (df['High'] + df['Low'] + df['Close']) / 3
        df['TPxVol'] = df['TP'] * df['Volume']
        df['TradeDate'] = df.index.date if hasattr(df.index, 'date') else pd.to_datetime(df.index).date
        df['CumTPxVol'] = df.groupby('TradeDate')['TPxVol'].cumsum()
        df['CumVol'] = df.groupby('TradeDate')['Volume'].cumsum()
        df['VWAP'] = df['CumTPxVol'] / df['CumVol'].replace(0, np.nan)
        df['VWAP'] = df['VWAP'].ffill()
        df.drop(columns=['TP', 'TPxVol', 'TradeDate', 'CumTPxVol', 'CumVol'], inplace=True)

        # RSI 14
        delta = df['Close'].diff()
        gain = delta.where(delta > 0, 0).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss.replace(0, np.nan)
        df['RSI'] = 100 - (100 / (1 + rs))
        df['RSI'] = df['RSI'].fillna(50.0)

        return df

    # ═══════════════════════════════════════════════════════════════════════════
    # SIGNAL GENERATION
    # ═══════════════════════════════════════════════════════════════════════════

    def _generate_signals(self, df: pd.DataFrame) -> tuple[list, str, float]:
        """Analyze 5m candles for CALL/PUT setups."""
        signals = []
        last = df.iloc[-1]
        prev = df.iloc[-2]

        # Determine trend
        trend = "NEUTRAL"
        if last['Close'] > last['EMA9'] and last['Close'] > last['VWAP']:
            trend = "BULLISH"
        elif last['Close'] < last['EMA9'] and last['Close'] < last['VWAP']:
            trend = "BEARISH"

        current_price = float(last['Close'])
        rsi = float(last['RSI']) if not pd.isna(last['RSI']) else 50.0

        # CALL Setup: cross above VWAP + bullish trend + RSI < 70
        if prev['Close'] < prev['VWAP'] and last['Close'] > last['VWAP']:
            if trend == "BULLISH" and rsi < 70:
                risk = abs(current_price - float(last['Low']))
                if risk > 0:
                    signals.append({
                        'type': 'CALL',
                        'action': 'BUY',
                        'price': current_price,
                        'stop_loss': round(float(last['Low']), 2),
                        'take_profit': round(current_price + risk * RISK_REWARD, 2),
                        'reason': f"VWAP cross-up | Trend: {trend} | RSI: {rsi:.1f}",
                    })

        # PUT Setup: cross below VWAP + bearish trend + RSI > 30
        elif prev['Close'] > prev['VWAP'] and last['Close'] < last['VWAP']:
            if trend == "BEARISH" and rsi > 30:
                risk = abs(float(last['High']) - current_price)
                if risk > 0:
                    signals.append({
                        'type': 'PUT',
                        'action': 'SELL',
                        'price': current_price,
                        'stop_loss': round(float(last['High']), 2),
                        'take_profit': round(current_price - risk * RISK_REWARD, 2),
                        'reason': f"VWAP cross-down | Trend: {trend} | RSI: {rsi:.1f}",
                    })

        return signals, trend, current_price

    # ═══════════════════════════════════════════════════════════════════════════
    # ENTRY / SIGNAL FIRING
    # ═══════════════════════════════════════════════════════════════════════════

    def _process_entry_signal(self, sig: dict) -> None:
        """Process a trading signal."""
        # Pre-trade health check
        health = pre_trade_health_check('spx_sniper', self.proxy_symbol)
        if health.get('skip'):
            print(f"[SPX Sniper] Skipping entry: {health.get('reason')}")
            return
        if not health.get('ok'):
            print(f"[SPX Sniper] Health check failed: {health.get('reason')}")
            return

        print(f"[SPX Sniper] {sig['type']} signal: {self.proxy_symbol} @ ${sig['price']:.2f}")

        success = self._fire_signal(
            action=sig['action'],
            price=sig['price'],
            stop_loss=sig['stop_loss'],
            take_profit=sig['take_profit'],
            reason=sig['reason'],
        )

        if success:
            self.active_trades.append({
                'symbol': self.proxy_symbol,
                'direction': 'LONG' if sig['action'] == 'BUY' else 'SHORT',
                'entry_price': sig['price'],
                'stop_loss': sig['stop_loss'],
                'take_profit': sig['take_profit'],
                'opened_at': datetime.now().isoformat(),
                'signal_type': sig['type'],
            })

    def _fire_signal(self, action: str, price: float, stop_loss: float = None,
                     take_profit: float = None, reason: str = "") -> bool:
        """Fire signal via webhook or direct Alpaca API."""
        if USE_DIRECT_ALPACA:
            result = execute_direct(
                action=action,
                price=price,
                stop_loss=stop_loss,
                take_profit=take_profit,
                reason=reason,
            )
            return result.get('success', False)

        # Default: use BaseAgent's fire_signal (webhook)
        return self.fire_signal(
            action=action,
            symbol=self.proxy_symbol,
            price=price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            reason=reason,
        )

    # ═══════════════════════════════════════════════════════════════════════════
    # STATE PERSISTENCE
    # ═══════════════════════════════════════════════════════════════════════════

    def _save_state(self) -> None:
        """Save state including signals."""
        from agent_utils import save_agent_state

        save_agent_state(self.agent_id, {
            'active_trades': self.active_trades,
            'scan_count': self.scan_count,
            'daily_pnl': self.daily_pnl,
            'wins': self.wins,
            'losses': self.losses,
        })

    def _get_restored_state(self) -> dict:
        from agent_utils import load_agent_state
        return load_agent_state(self.agent_id) or {}


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    agent = SPXSniperAgent()
    agent.run()
