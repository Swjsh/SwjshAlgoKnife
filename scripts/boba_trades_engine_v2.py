"""
Boba Trades Agent v2 — Extends BaseAgent
========================================
SPY Options S&D Zone Trader (Paper) using the new BaseAgent foundation.

Same strategy as v1:
• Scans SPY 15m candles for Supply & Demand zones
• Time-gated: entries only 9:30-11:00 AM EST (peak options volume)
• Fires webhooks to Next.js executor → Alpaca Paper (SPY)
• Monitors open trades: SL at -1.5%, TP at +3% (simulates options leverage)

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
from typing import Optional

from base_agent import BaseAgent
from agent_utils import log_message, get_random_quip
from position_sync import sync_positions_on_startup, pre_trade_health_check

# ── Config ────────────────────────────────────────────────────────────────────
SYMBOL              = 'SPY'
TIMEFRAME           = '15m'
PERIOD              = '5d'
SCAN_INTERVAL_SEC   = 300            # 5 minute scan interval
ZONE_RESCAN_MIN     = 15             # Full zone rescan every 15 minutes
MAX_OPEN_TRADES     = 1              # Options = one at a time
SL_PCT              = 0.015          # 1.5% stop (tighter for equity proxy)
TP_PCT              = 0.03           # 3% target (simulates options leverage gain)

EST = pytz.timezone('US/Eastern')


# ═══════════════════════════════════════════════════════════════════════════════
# BOBA AGENT (extends BaseAgent)
# ═══════════════════════════════════════════════════════════════════════════════

class BobaTradesAgent(BaseAgent):
    """
    SPY Options S&D zone trader.
    Single-symbol agent with time-gated entries during peak options flow.
    """

    strategy_name = "Boba_Options_SD"

    def __init__(self):
        super().__init__(
            agent_id="boba",
            display_name="Boba",
            scan_interval_sec=SCAN_INTERVAL_SEC,
            max_consecutive_errors=10,
            error_backoff_base_sec=60,
            status_file_name="boba_agent_status.json"
        )

        # Agent-specific state
        self.symbol = SYMBOL
        self.demand_zones: list[dict] = []
        self.supply_zones: list[dict] = []
        self.last_zone_scan: float = 0
        self.zone_rescan_min = ZONE_RESCAN_MIN
        self.current_price: float = 0.0

    # ═══════════════════════════════════════════════════════════════════════════
    # TIME GATES
    # ═══════════════════════════════════════════════════════════════════════════

    def _is_entry_window(self) -> bool:
        """Entries only 9:30-11:00 AM EST (peak options flow)."""
        now = datetime.now(EST).time()
        return dtime(9, 30) <= now <= dtime(11, 0)

    def _is_market_hours(self) -> bool:
        """Check if within NYSE trading hours."""
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
        """
        Main scan cycle. Called every SCAN_INTERVAL_SEC.
        """
        self.current_price = price
        now = time.time()
        now_str = datetime.now(EST).strftime('%H:%M:%S')

        print(f"\n[{now_str}] Boba scan #{self.scan_count}")

        # ── Periodic zone rescan ───────────────────────────────────────────────
        if now - self.last_zone_scan >= self.zone_rescan_min * 60:
            self._run_zone_scan()
            self.last_zone_scan = now

        # ── Display status ─────────────────────────────────────────────────────
        total_zones = len(self.demand_zones) + len(self.supply_zones)
        print(f"   {self.symbol}: ${price:.2f} | Zones: {total_zones} | Open: {len(self.active_trades)}")

        # ── Check zone entries (only during entry window) ─────────────────────
        if self._is_entry_window() and (self.demand_zones or self.supply_zones):
            self._check_zone_entries(price)
        elif not self._is_entry_window():
            print(f"   Entry window closed - monitoring exits only")

    def get_current_price(self) -> Optional[float]:
        """Fetch current SPY price."""
        try:
            hist = yf.Ticker(self.symbol).history(period='1d', interval='5m')
            if not hist.empty:
                return float(hist['Close'].iloc[-1])
        except Exception as e:
            print(f"[Boba] Price fetch failed: {e}")
        return None

    # ═══════════════════════════════════════════════════════════════════════════
    # OPTIONAL HOOKS
    # ═══════════════════════════════════════════════════════════════════════════

    def on_startup(self) -> None:
        """Initialize and sync with broker."""
        log_message(self.agent_id, get_random_quip('boba'))

        # Restore zone state
        state = self._get_restored_state()
        self.demand_zones = state.get('demand_zones', [])
        self.supply_zones = state.get('supply_zones', [])

        if self.demand_zones or self.supply_zones:
            self.last_zone_scan = time.time()
            log_message(
                self.agent_id,
                f"Restored {len(self.demand_zones)} demand, {len(self.supply_zones)} supply zones"
            )

        # Sync positions with broker
        print("[Boba] Syncing positions with Alpaca broker...")
        self.active_trades = sync_positions_on_startup('boba', self.symbol, self.active_trades)

    def get_banner(self) -> str:
        return f"""
+=================================================+
|       BOBA v2 — Options S&D Zone Trader         |
|  Symbol: {self.symbol} (Options Proxy)                    |
|  Scan: every {self.scan_interval_sec // 60}min | Entry: 9:30-11:00 AM EST    |
|  SL: -{SL_PCT*100:.1f}% | TP: +{TP_PCT*100:.0f}% | Max: {MAX_OPEN_TRADES} position          |
|  [Using BaseAgent Foundation]                   |
+=================================================+
"""

    def get_status_extras(self) -> dict:
        """Add Boba-specific status fields."""
        return {
            'market_price': round(self.current_price, 2) if self.current_price else 0,
            'total_zones_found': len(self.demand_zones) + len(self.supply_zones),
            'entry_window': self._is_entry_window(),
            'pending_orders': [],
        }

    # ═══════════════════════════════════════════════════════════════════════════
    # POSITION MANAGEMENT (override for percentage-based SL/TP)
    # ═══════════════════════════════════════════════════════════════════════════

    def check_exits(self, price: float) -> list[dict]:
        """
        Check trades for SL/TP hit using percentage-based thresholds.
        """
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
                self._close_trade_with_signal(trade, price, 'TAKE_PROFIT')
            elif hit_sl:
                self._close_trade_with_signal(trade, price, 'STOP_LOSS')
            else:
                remaining.append(trade)

        return remaining

    def _close_trade_with_signal(self, trade: dict, exit_price: float, reason: str) -> None:
        """Close trade with EXIT signal and logging."""
        entry = trade.get('entry_price', 0)
        direction = trade.get('direction', 'LONG')

        # Calculate P&L percentage
        if direction == 'LONG':
            pnl_pct = (exit_price - entry) / entry * 100
        else:
            pnl_pct = (entry - exit_price) / entry * 100

        # Fire EXIT signal
        self.fire_signal('EXIT', self.symbol, exit_price, reason=f"{reason} | {pnl_pct:+.1f}%")

        # Update metrics
        if pnl_pct >= 0:
            self.wins += 1
            log_message(self.agent_id, f"🎯 TP HIT: Boba +{TP_PCT*100:.0f}%", type='trade')
        else:
            self.losses += 1
            log_message(self.agent_id, f"🛑 SL HIT: Boba -{SL_PCT*100:.1f}%", type='trade')

        self.daily_pnl += pnl_pct
        print(f"[Boba] {'🎯' if reason == 'TAKE_PROFIT' else '🛑'} {reason}: ${exit_price:.2f}")

    # ═══════════════════════════════════════════════════════════════════════════
    # ZONE DETECTION (agent-specific)
    # ═══════════════════════════════════════════════════════════════════════════

    def _run_zone_scan(self) -> None:
        """Scan SPY 15m candles for S&D zones."""
        print(f"[Boba] Rescanning zones...")

        try:
            data = yf.download(self.symbol, period=PERIOD, interval=TIMEFRAME, progress=False)
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)

            if data.empty or len(data) < 10:
                log_message(self.agent_id, f"No data available for {self.symbol}", type='warning')
                return

            demand, supply = self._find_zones(data)
            self.demand_zones = demand
            self.supply_zones = supply

            print(f"[Boba] {self.symbol}: {len(demand)} demand, {len(supply)} supply zones")

        except Exception as e:
            log_message(self.agent_id, f"Zone scan error: {e}", type='error')
            print(f"[Boba] Zone scan error: {e}")

    def _find_zones(self, df: pd.DataFrame) -> tuple[list, list]:
        """Identify S&D zones on 15m data. Returns (demand_zones, supply_zones)."""
        demand = []
        supply = []

        for i in range(5, len(df) - 1):
            cur = df.iloc[i]
            prev = df.iloc[i - 1]

            body = abs(cur['Close'] - cur['Open'])
            avg_range = (df['High'].iloc[i-5:i] - df['Low'].iloc[i-5:i]).mean()

            if avg_range == 0:
                continue

            is_impulse = body > avg_range * 1.5

            if is_impulse:
                timestamp = (
                    df.index[i].strftime('%Y-%m-%d %H:%M')
                    if hasattr(df.index[i], 'strftime')
                    else str(df.index[i])
                )

                if cur['Close'] > cur['Open']:
                    # Bullish impulse → demand zone at base
                    demand.append({
                        'top': float(cur['Open']),
                        'bottom': float(prev['Low']),
                        'fresh': True,
                        'type': 'DEMAND',
                        'created': timestamp,
                    })
                else:
                    # Bearish impulse → supply zone at top
                    supply.append({
                        'top': float(prev['High']),
                        'bottom': float(cur['Open']),
                        'fresh': True,
                        'type': 'SUPPLY',
                        'created': timestamp,
                    })

        # Keep only the most recent zones
        return demand[-5:], supply[-5:]

    # ═══════════════════════════════════════════════════════════════════════════
    # ZONE ENTRIES (agent-specific)
    # ═══════════════════════════════════════════════════════════════════════════

    def _check_zone_entries(self, price: float) -> None:
        """Check if price has entered any fresh zone."""
        if len(self.active_trades) >= MAX_OPEN_TRADES:
            return

        # Pre-trade health check: skip if position already exists on broker
        health = pre_trade_health_check('boba', self.symbol)
        if health.get('skip'):
            print(f"[Boba] Skipping entry: {health.get('reason')}")
            return
        if not health.get('ok'):
            print(f"[Boba] Health check failed: {health.get('reason')}")
            return

        # Check demand zones (LONG)
        for zone in self.demand_zones:
            if not zone.get('fresh', False):
                continue
            if zone['bottom'] <= price <= zone['top']:
                sl = round(price * (1 - SL_PCT), 2)
                tp = round(price * (1 + TP_PCT), 2)

                print(f"[Boba] ⚡ Zone entry: BUY {self.symbol} @ ${price:.2f} "
                      f"(DEMAND {zone['bottom']:.2f}-{zone['top']:.2f})")

                success = self.fire_signal(
                    action='BUY',
                    symbol=self.symbol,
                    price=price,
                    stop_loss=sl,
                    take_profit=tp,
                    reason=f"Demand zone entry ({zone['bottom']:.2f}-{zone['top']:.2f})"
                )

                if success:
                    zone['fresh'] = False
                    self.active_trades.append({
                        'symbol': self.symbol,
                        'direction': 'LONG',
                        'entry_price': price,
                        'stop_loss': sl,
                        'take_profit': tp,
                        'opened_at': datetime.now().isoformat(),
                        'zone_type': 'DEMAND',
                    })
                return  # One entry per scan

        if len(self.active_trades) >= MAX_OPEN_TRADES:
            return

        # Check supply zones (SHORT)
        for zone in self.supply_zones:
            if not zone.get('fresh', False):
                continue
            if zone['bottom'] <= price <= zone['top']:
                sl = round(price * (1 + SL_PCT), 2)
                tp = round(price * (1 - TP_PCT), 2)

                print(f"[Boba] ⚡ Zone entry: SELL {self.symbol} @ ${price:.2f} "
                      f"(SUPPLY {zone['bottom']:.2f}-{zone['top']:.2f})")

                success = self.fire_signal(
                    action='SELL',
                    symbol=self.symbol,
                    price=price,
                    stop_loss=sl,
                    take_profit=tp,
                    reason=f"Supply zone entry ({zone['bottom']:.2f}-{zone['top']:.2f})"
                )

                if success:
                    zone['fresh'] = False
                    self.active_trades.append({
                        'symbol': self.symbol,
                        'direction': 'SHORT',
                        'entry_price': price,
                        'stop_loss': sl,
                        'take_profit': tp,
                        'opened_at': datetime.now().isoformat(),
                        'zone_type': 'SUPPLY',
                    })
                return

    # ═══════════════════════════════════════════════════════════════════════════
    # STATE PERSISTENCE (extend base with zone data)
    # ═══════════════════════════════════════════════════════════════════════════

    def _save_state(self) -> None:
        """Save state including zone data."""
        from agent_utils import save_agent_state

        save_agent_state(self.agent_id, {
            'active_trades': self.active_trades,
            'demand_zones': self.demand_zones,
            'supply_zones': self.supply_zones,
            'scan_count': self.scan_count,
            'daily_pnl': self.daily_pnl,
            'wins': self.wins,
            'losses': self.losses,
        })

    def _get_restored_state(self) -> dict:
        """Get additional state not handled by base class."""
        from agent_utils import load_agent_state
        return load_agent_state(self.agent_id) or {}


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    agent = BobaTradesAgent()
    agent.run()
