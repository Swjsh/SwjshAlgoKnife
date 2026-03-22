"""
Sterling FX Agent v2 — Extends BaseAgent
========================================
FX Supply & Demand Zone Trader using the new BaseAgent foundation.

Same strategy as v1:
• Scans EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD for fresh Supply/Demand zones (1H)
• Monitors prices every TICK_INTERVAL_SEC seconds (OANDA streaming or yfinance)
• Fires webhooks to the Next.js executor when price enters a zone → OANDA executes
• Manages open FX trades: tracks SL/TP, fires EXIT when hit

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
from datetime import datetime
from typing import Optional

from base_agent import BaseAgent
from agent_utils import log_message, get_random_quip
from data_feeds import build_feed_for_agent, get_latest_price

# ── Config ────────────────────────────────────────────────────────────────────
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

# yfinance ticker → clean signal symbol (OANDA format via executor)
YF_TO_SIGNAL = {
    'EURUSD=X': 'EURUSD',
    'GBPUSD=X': 'GBPUSD',
    'USDJPY=X': 'USDJPY',
    'AUDUSD=X': 'AUDUSD',
    'USDCAD=X': 'USDCAD',
}


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def pip_buffer(pair: str) -> float:
    """JPY pairs have 2-decimal prices; all others are 4-decimal."""
    return 0.05 if 'JPY' in pair else PIP_BUFFER


# ═══════════════════════════════════════════════════════════════════════════════
# STERLING FX AGENT (extends BaseAgent)
# ═══════════════════════════════════════════════════════════════════════════════

class SterlingFXAgent(BaseAgent):
    """
    FX Supply & Demand zone trader.
    Scans 5 major FX pairs for fresh zones and trades breakouts/bounces.
    """

    strategy_name = "Sterling_FX_SD"

    def __init__(self):
        super().__init__(
            agent_id="fx",
            display_name="Sterling",
            scan_interval_sec=TICK_INTERVAL_SEC,
            max_consecutive_errors=10,
            error_backoff_base_sec=60,
            status_file_name="fx_agent_status.json"
        )

        # Agent-specific state
        self.pairs = PAIRS
        self.zones_by_pair: dict[str, list] = {}
        self.last_zone_scan: float = 0
        self.scan_interval_min = SCAN_INTERVAL_MIN
        self.prices: dict[str, float] = {}

        # OANDA streaming price feed
        self._price_feed = None

    # ═══════════════════════════════════════════════════════════════════════════
    # REQUIRED OVERRIDES
    # ═══════════════════════════════════════════════════════════════════════════

    def execute_scan(self, price: float) -> None:
        """
        Main scan cycle. Called every TICK_INTERVAL_SEC.
        Price arg is ignored — we fetch all pair prices internally.
        """
        now = time.time()

        # ── Periodic zone rescan ───────────────────────────────────────────────
        if now - self.last_zone_scan >= self.scan_interval_min * 60:
            self._run_zone_scan()
            self.last_zone_scan = now

        # ── Fetch live prices ──────────────────────────────────────────────────
        self.prices = self._fetch_all_prices()
        if self.prices:
            price_str = ' | '.join([
                f"{p.replace('=X','')}: {v:.5f}"
                for p, v in self.prices.items()
            ])
            print(f"[Sterling] 💱 {price_str}")

        # ── Check zone entries ─────────────────────────────────────────────────
        if self.zones_by_pair:
            self._check_zone_entries()

    def get_current_price(self) -> Optional[float]:
        """
        For multi-ticker agents, return the first available price.
        Actual price handling is in execute_scan.
        """
        for pair in self.pairs:
            price = self._get_price(pair)
            if price:
                return price
        return None

    # ═══════════════════════════════════════════════════════════════════════════
    # OPTIONAL HOOKS
    # ═══════════════════════════════════════════════════════════════════════════

    def on_startup(self) -> None:
        """Initialize OANDA streaming feed and restore state."""
        log_message(self.agent_id, get_random_quip('fx'))
        self._price_feed = build_feed_for_agent('sterling')

        # Restore zone state
        state = self._get_restored_state()
        self.zones_by_pair = state.get('zones_by_pair', {})
        if self.zones_by_pair:
            self.last_zone_scan = time.time()  # Don't rescan immediately
            total_zones = sum(len(z) for z in self.zones_by_pair.values())
            log_message(self.agent_id, f"Restored {total_zones} zones from saved state")

    def on_shutdown(self) -> None:
        """Clean up price feed."""
        if self._price_feed:
            self._price_feed.stop()

    def get_banner(self) -> str:
        pairs_str = ', '.join([p.replace('=X', '') for p in self.pairs])
        return f"""
╔══════════════════════════════════════════════════════╗
║       STERLING v2 — FX Supply & Demand Engine        ║
║  Pairs: {pairs_str:42} ║
║  Scan: every {self.scan_interval_min}min  |  Tick: every {self.scan_interval_sec}s              ║
║  Broker: OANDA Practice  |  Max positions: {MAX_OPEN_TRADES}        ║
║  [Using BaseAgent Foundation]                        ║
╚══════════════════════════════════════════════════════╝
"""

    def get_status_extras(self) -> dict:
        """Add FX-specific status fields."""
        all_zones = [z for zones in self.zones_by_pair.values() for z in zones]
        pending = [z for z in all_zones if z.get('status') == 'PENDING']
        return {
            'active_pairs': len(self.pairs),
            'pending_orders': pending[:10],
            'live_prices': self.prices,
            'total_zones_found': len(all_zones),
        }

    # ═══════════════════════════════════════════════════════════════════════════
    # POSITION MANAGEMENT (override for multi-ticker)
    # ═══════════════════════════════════════════════════════════════════════════

    def check_exits(self, price: float) -> list[dict]:
        """
        Check all open trades for SL/TP.
        Uses self.prices dict instead of single price arg.
        """
        remaining = []
        for trade in self.active_trades:
            pair = trade.get('pair', trade.get('ticker', trade.get('symbol')))
            current_price = self.prices.get(pair)

            if current_price is None:
                remaining.append(trade)
                continue

            direction = trade.get('direction', 'LONG').upper()
            stop = trade.get('stop_loss')
            target = trade.get('take_profit')

            hit_tp = hit_sl = False

            if direction == 'LONG':
                hit_tp = target and current_price >= target
                hit_sl = stop and current_price <= stop
            else:
                hit_tp = target and current_price <= target
                hit_sl = stop and current_price >= stop

            if hit_tp:
                self._close_trade_with_signal(trade, current_price, 'TAKE_PROFIT')
            elif hit_sl:
                self._close_trade_with_signal(trade, current_price, 'STOP_LOSS')
            else:
                remaining.append(trade)

        return remaining

    def _close_trade_with_signal(self, trade: dict, exit_price: float, reason: str) -> None:
        """Close trade with proper EXIT signal and logging."""
        pair = trade.get('pair', trade.get('ticker', trade.get('symbol')))
        symbol = YF_TO_SIGNAL.get(pair, pair.replace('=X', ''))
        entry = trade.get('entry_price', 0)
        direction = trade.get('direction', 'LONG')

        # Calculate P&L (in pips for FX)
        pip_mult = 100 if 'JPY' in pair else 10000
        if direction == 'LONG':
            pips = (exit_price - entry) * pip_mult
        else:
            pips = (entry - exit_price) * pip_mult

        # Fire EXIT signal
        self.fire_signal('EXIT', symbol, exit_price, reason=f"{reason} | {pips:.1f} pips")

        # Update metrics
        if pips >= 0:
            self.wins += 1
            log_message(self.agent_id, f"🎯 TP HIT: {symbol} +{RISK_REWARD}R", type='trade')
        else:
            self.losses += 1
            log_message(self.agent_id, f"🛑 SL HIT: {symbol} -1R", type='trade')

        self.daily_pnl += pips  # Track in pips for FX
        print(f"[Sterling] {'🎯' if reason == 'TAKE_PROFIT' else '🛑'} {reason}: {symbol} @ {exit_price:.5f}")

    # ═══════════════════════════════════════════════════════════════════════════
    # ZONE DETECTION (agent-specific)
    # ═══════════════════════════════════════════════════════════════════════════

    def _run_zone_scan(self) -> None:
        """Full S/D zone scan across all FX pairs."""
        print(f"[Sterling] 🔍 Running zone scan at {datetime.now().strftime('%H:%M:%S')}...")

        # Preserve triggered state so we don't re-enter same zones
        triggered = {}
        for pair, zones in self.zones_by_pair.items():
            triggered[pair] = {
                (z['top'], z['bottom']): z.get('status')
                for z in zones
            }

        # Scan each pair
        new_zones = {}
        for pair in self.pairs:
            try:
                data = yf.download(pair, period=PERIOD, interval=TIMEFRAME, progress=False)
                if data.empty:
                    print(f"[Sterling] ⚠️ No data for {pair}")
                    new_zones[pair] = []
                    continue

                # Handle MultiIndex columns
                if isinstance(data.columns, pd.MultiIndex):
                    data.columns = data.columns.get_level_values(0)

                atr = self._calculate_atr(data, ATR_PERIOD)
                zones = self._find_zones(data, atr, pair)

                # Tag with ticker info
                for z in zones:
                    z['ticker'] = YF_TO_SIGNAL.get(pair, pair.replace('=X', ''))

                print(f"[Sterling] {pair.replace('=X','')}: {len(zones)} fresh zones found")
                new_zones[pair] = zones

            except Exception as e:
                log_message(self.agent_id, f"Scan error for {pair}: {e}", type='error')
                print(f"[Sterling] ❌ Scan error for {pair}: {e}")
                new_zones[pair] = []

        # Restore triggered state on re-scanned zones
        for pair, zones in new_zones.items():
            for z in zones:
                key = (z['top'], z['bottom'])
                if triggered.get(pair, {}).get(key) == 'TRIGGERED':
                    z['triggered'] = True
                    z['status'] = 'TRIGGERED'

        self.zones_by_pair = new_zones
        self.scan_count += 1

    def _calculate_atr(self, df: pd.DataFrame, period: int = 14) -> pd.Series:
        """Calculate Average True Range."""
        high_low = df['High'] - df['Low']
        high_close = np.abs(df['High'] - df['Close'].shift())
        low_close = np.abs(df['Low'] - df['Close'].shift())
        true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        return true_range.rolling(period).mean()

    def _find_zones(self, df: pd.DataFrame, atr_series: pd.Series, pair: str) -> list[dict]:
        """Detect fresh supply/demand zones from FX price data."""
        zones = []
        buf = pip_buffer(pair)

        for i in range(len(df) - 2, 20, -1):
            body_size = abs(df['Close'].iloc[i] - df['Open'].iloc[i])
            atr = atr_series.iloc[i]

            # Impulse candle check: body must be > IMPULSE_MULTIPLIER * ATR
            if body_size <= (atr * IMPULSE_MULTIPLIER):
                continue

            is_bullish = df['Close'].iloc[i] > df['Open'].iloc[i]
            zone_type = "DEMAND" if is_bullish else "SUPPLY"
            zone_top = df['High'].iloc[i - 1]
            zone_bottom = df['Low'].iloc[i - 1]
            future = df.iloc[i + 1:]

            # Freshness check: zone must not have been touched since formation
            if zone_type == "DEMAND":
                min_future = future['Low'].min()
                if min_future <= zone_top:
                    # Zone has been touched or broken
                    continue
            else:  # SUPPLY
                max_future = future['High'].max()
                if max_future >= zone_bottom:
                    continue

            # Calculate entry, stop, and target
            entry_price = round(zone_top, 5) if zone_type == "DEMAND" else round(zone_bottom, 5)
            stop_loss = round(zone_bottom - buf, 5) if zone_type == "DEMAND" else round(zone_top + buf, 5)
            risk = abs(entry_price - stop_loss)
            take_profit = (
                round(entry_price + risk * RISK_REWARD, 5) if zone_type == "DEMAND"
                else round(entry_price - risk * RISK_REWARD, 5)
            )

            zones.append({
                'created_at': df.index[i].strftime('%Y-%m-%d %H:%M'),
                'type': zone_type,
                'top': round(zone_top, 5),
                'bottom': round(zone_bottom, 5),
                'entry': entry_price,
                'stop_loss': stop_loss,
                'take_profit': take_profit,
                'status': 'PENDING',
                'triggered': False,
            })

        return zones

    # ═══════════════════════════════════════════════════════════════════════════
    # ZONE ENTRIES (agent-specific)
    # ═══════════════════════════════════════════════════════════════════════════

    def _check_zone_entries(self) -> None:
        """Check if price has entered any PENDING zone."""
        open_pairs = {t.get('pair', t.get('ticker')) for t in self.active_trades}

        for pair, zones in self.zones_by_pair.items():
            price = self.prices.get(pair)
            if price is None:
                continue

            # Don't open another trade if we already have one for this pair
            if pair in open_pairs:
                continue
            if len(self.active_trades) >= MAX_OPEN_TRADES:
                continue

            for zone in zones:
                if zone.get('triggered') or zone.get('status') != 'PENDING':
                    continue

                entered = False
                action = None

                if zone['type'] == 'DEMAND' and zone['bottom'] <= price <= zone['top']:
                    entered = True
                    action = 'BUY'
                elif zone['type'] == 'SUPPLY' and zone['bottom'] <= price <= zone['top']:
                    entered = True
                    action = 'SELL'

                if entered and action:
                    symbol = YF_TO_SIGNAL.get(pair, pair.replace('=X', ''))
                    print(f"[Sterling] ⚡ Zone entry: {symbol} {action} @ {price:.5f} "
                          f"({zone['type']} {zone['bottom']:.5f}-{zone['top']:.5f})")

                    success = self.fire_signal(
                        action=action,
                        symbol=symbol,
                        price=price,
                        stop_loss=zone['stop_loss'],
                        take_profit=zone['take_profit'],
                        reason=f"FX {zone['type']} zone — {symbol}"
                    )

                    if success:
                        zone['triggered'] = True
                        zone['status'] = 'TRIGGERED'
                        self.active_trades.append({
                            'pair': pair,
                            'symbol': symbol,
                            'direction': 'LONG' if action == 'BUY' else 'SHORT',
                            'entry_price': price,
                            'stop_loss': zone['stop_loss'],
                            'take_profit': zone['take_profit'],
                            'opened_at': datetime.now().isoformat(),
                        })
                        open_pairs.add(pair)

                    break  # Only one entry per pair per tick

    # ═══════════════════════════════════════════════════════════════════════════
    # PRICE FETCHING (agent-specific)
    # ═══════════════════════════════════════════════════════════════════════════

    def _fetch_all_prices(self) -> dict[str, float]:
        """Fetch current prices for all FX pairs."""
        prices = {}
        for pair in self.pairs:
            p = self._get_price(pair)
            if p:
                prices[pair] = p
        return prices

    def _get_price(self, ticker: str) -> Optional[float]:
        """Get current price for a single FX pair."""
        try:
            # Try real-time OANDA streaming cache first
            price = get_latest_price(ticker, max_cache_age=5.0)
            if price:
                return price

            # yfinance fallback (30s-5min delayed)
            hist = yf.Ticker(ticker).history(period='1d', interval='5m')
            if not hist.empty:
                return float(hist['Close'].iloc[-1])
        except Exception as e:
            print(f"[Sterling] ⚠️ Price fetch failed for {ticker}: {e}")
        return None

    # ═══════════════════════════════════════════════════════════════════════════
    # STATE PERSISTENCE (extend base with zone data)
    # ═══════════════════════════════════════════════════════════════════════════

    def _save_state(self) -> None:
        """Save state including zone data."""
        from agent_utils import save_agent_state

        # Serialize zones (only keep essential fields)
        serialized_zones = {
            pair: [
                {k: v for k, v in z.items() if k in (
                    'created_at', 'type', 'top', 'bottom', 'entry',
                    'stop_loss', 'take_profit', 'status', 'triggered', 'ticker'
                )}
                for z in zones
            ]
            for pair, zones in self.zones_by_pair.items()
        }

        save_agent_state(self.agent_id, {
            'active_trades': self.active_trades,
            'zones_by_pair': serialized_zones,
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
    agent = SterlingFXAgent()
    agent.run()
