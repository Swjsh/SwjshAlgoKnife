"""
Bitcoin Bob Agent v2 — Extends BaseAgent
========================================
Crypto Supply & Demand Zone Trader using the new BaseAgent foundation.

Same strategy as v1:
• Scans BTC, ETH, SOL for fresh Supply/Demand zones (every SCAN_INTERVAL_MIN minutes)
• Monitors prices every TICK_INTERVAL_SEC seconds
• Fires webhooks to the Next.js executor when price enters a zone
• Manages open trades: tracks stop-loss and take-profit, fires EXIT when hit

Improvements from BaseAgent:
• Circuit breaker pattern (halts after N consecutive errors)
• Exponential backoff on errors
• Proper error logging to agent_logs.json
• Cleaner state persistence
"""

import os
import time
import json
import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime
from typing import Optional

from base_agent import BaseAgent
from agent_utils import log_message
from data_feeds import build_feed_for_agent, get_latest_price

# ── Config ────────────────────────────────────────────────────────────────────
PAIRS             = ['BTC-USD', 'ETH-USD', 'SOL-USD']
TIMEFRAME         = '1h'
PERIOD            = '30d'
ATR_PERIOD        = 14
IMPULSE_MULT      = 2.5      # ATR multiplier for impulse candle detection
RISK_REWARD       = 2.5      # Take profit at R:R 2.5
SCAN_INTERVAL_MIN = 30       # Full S/R zone rescan every 30 minutes
TICK_INTERVAL_SEC = 60       # Price check every 60 seconds
MAX_OPEN_TRADES   = 2        # Don't open more than 2 crypto positions at once

# Symbol mappings
YF_TO_SIGNAL = {'BTC-USD': 'BTCUSD', 'ETH-USD': 'ETHUSD', 'SOL-USD': 'SOLUSD'}


# ═══════════════════════════════════════════════════════════════════════════════
# BITCOIN BOB AGENT (extends BaseAgent)
# ═══════════════════════════════════════════════════════════════════════════════

class BitcoinBobAgent(BaseAgent):
    """
    Crypto Supply & Demand zone trader.
    Scans BTC, ETH, SOL for fresh zones and trades breakouts/bounces.
    """

    strategy_name = "BitcoinBob_SR"

    def __init__(self):
        super().__init__(
            agent_id="crypto",
            display_name="Bitcoin Bob",
            scan_interval_sec=TICK_INTERVAL_SEC,
            max_consecutive_errors=10,
            error_backoff_base_sec=60,
            status_file_name="crypto_agent_status.json"
        )

        # Agent-specific state
        self.pairs = PAIRS
        self.zones_by_pair: dict[str, list] = {}
        self.last_zone_scan: float = 0
        self.scan_interval_min = SCAN_INTERVAL_MIN
        self.prices: dict[str, float] = {}

        # Price feed (Binance WebSocket for real-time crypto)
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
                f"{p.replace('-USD','')}: ${v:,.0f}"
                for p, v in self.prices.items()
            ])
            print(f"[Bob] 💰 {price_str}")

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
        """Initialize Binance WebSocket feed."""
        self._price_feed = build_feed_for_agent('bitcoin_bob')

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
        return f"""
╔══════════════════════════════════════════╗
║       BITCOIN BOB v2 — S/R Zone Trader   ║
║  Pairs: {', '.join(self.pairs):27} ║
║  Scan: every {self.scan_interval_min}min | Tick: every {self.scan_interval_sec}s   ║
║  Max open positions: {MAX_OPEN_TRADES}                   ║
║  [Using BaseAgent Foundation]            ║
╚══════════════════════════════════════════╝
"""

    def get_status_extras(self) -> dict:
        """Add crypto-specific status fields."""
        all_zones = [z for zones in self.zones_by_pair.values() for z in zones]
        return {
            'active_pairs': len(self.pairs),
            'pending_orders': [z for z in all_zones if z.get('status') == 'PENDING'][:10],
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
            ticker = trade.get('ticker', trade.get('symbol'))
            current_price = self.prices.get(ticker)

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
        ticker = trade.get('ticker', trade.get('symbol'))
        symbol = YF_TO_SIGNAL.get(ticker, ticker.replace('-', ''))
        entry = trade.get('entry_price', 0)
        direction = trade.get('direction', 'LONG')

        # Calculate P&L
        if direction == 'LONG':
            pnl = exit_price - entry
        else:
            pnl = entry - exit_price

        # Fire EXIT signal
        self.fire_signal('EXIT', symbol, exit_price, reason=f"{reason} | P&L: ${pnl:.2f}")

        # Update metrics
        if pnl >= 0:
            self.wins += 1
            log_message(self.agent_id, f"🎯 TP HIT: {symbol} +{RISK_REWARD}R", type='trade')
        else:
            self.losses += 1
            log_message(self.agent_id, f"🛑 SL HIT: {symbol} -1R", type='trade')

        self.daily_pnl += pnl
        print(f"[Bob] {'🎯' if reason == 'TAKE_PROFIT' else '🛑'} {reason}: {ticker} @ ${exit_price:.2f}")

    # ═══════════════════════════════════════════════════════════════════════════
    # ZONE DETECTION (agent-specific)
    # ═══════════════════════════════════════════════════════════════════════════

    def _run_zone_scan(self) -> None:
        """Full S/R zone scan across all pairs."""
        print(f"[Bob] 🔍 Running zone scan at {datetime.now().strftime('%H:%M:%S')}...")

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
                    print(f"[Bob] ⚠️ No data for {pair}")
                    new_zones[pair] = []
                    continue

                # Handle MultiIndex columns
                if isinstance(data.columns, pd.MultiIndex):
                    data.columns = data.columns.get_level_values(0)

                atr = self._calculate_atr(data, ATR_PERIOD)
                zones = self._find_zones(data, atr)
                print(f"[Bob] {pair}: {len(zones)} fresh zones found")
                new_zones[pair] = zones

            except Exception as e:
                print(f"[Bob] ❌ Scan error for {pair}: {e}")
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

    def _find_zones(self, df: pd.DataFrame, atr_series: pd.Series) -> list[dict]:
        """Detect fresh supply/demand zones from price data."""
        zones = []

        for i in range(len(df) - 2, 20, -1):
            body_size = abs(df['Close'].iloc[i] - df['Open'].iloc[i])
            atr = atr_series.iloc[i]

            if body_size < (atr * IMPULSE_MULT):
                continue

            is_bullish = df['Close'].iloc[i] > df['Open'].iloc[i]
            base_high = df['High'].iloc[i - 1]
            base_low = df['Low'].iloc[i - 1]
            zone_type = "DEMAND" if is_bullish else "SUPPLY"

            # Freshness check: zone must not have been touched since formation
            future = df.iloc[i + 1:]
            if zone_type == "DEMAND" and future['Low'].min() <= base_high:
                continue
            if zone_type == "SUPPLY" and future['High'].max() >= base_low:
                continue

            buf = (base_high - base_low) * 0.2
            stop_loss = round(base_low - buf, 2) if zone_type == "DEMAND" else round(base_high + buf, 2)
            entry_price = round(base_high, 2) if zone_type == "DEMAND" else round(base_low, 2)
            risk = abs(entry_price - stop_loss)
            take_profit = (
                round(entry_price + risk * RISK_REWARD, 2) if zone_type == "DEMAND"
                else round(entry_price - risk * RISK_REWARD, 2)
            )

            zones.append({
                'created_at': df.index[i].strftime('%Y-%m-%d %H:%M'),
                'type': zone_type,
                'top': round(base_high, 2),
                'bottom': round(base_low, 2),
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
        open_tickers = {t.get('ticker', t.get('symbol')) for t in self.active_trades}

        for pair, zones in self.zones_by_pair.items():
            price = self.prices.get(pair)
            if price is None:
                continue

            # Don't open another trade if we already have one for this pair
            if pair in open_tickers:
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
                    print(f"[Bob] ⚡ Zone entry: {pair} {action} @ ${price:.2f} "
                          f"(zone {zone['bottom']}-{zone['top']})")

                    symbol = YF_TO_SIGNAL.get(pair, pair.replace('-', ''))
                    success = self.fire_signal(
                        action=action,
                        symbol=symbol,
                        price=price,
                        stop_loss=zone['stop_loss'],
                        take_profit=zone['take_profit'],
                        reason=f"S/R {zone['type']} zone entry"
                    )

                    if success:
                        zone['triggered'] = True
                        zone['status'] = 'TRIGGERED'
                        self.active_trades.append({
                            'ticker': pair,
                            'symbol': symbol,
                            'direction': 'LONG' if action == 'BUY' else 'SHORT',
                            'entry_price': price,
                            'stop_loss': zone['stop_loss'],
                            'take_profit': zone['take_profit'],
                            'opened_at': datetime.now().isoformat(),
                        })
                        open_tickers.add(pair)

                    break  # Only one entry per pair per tick

    # ═══════════════════════════════════════════════════════════════════════════
    # PRICE FETCHING (agent-specific)
    # ═══════════════════════════════════════════════════════════════════════════

    def _fetch_all_prices(self) -> dict[str, float]:
        """Fetch current prices for all pairs."""
        prices = {}
        for pair in self.pairs:
            p = self._get_price(pair)
            if p:
                prices[pair] = p
        return prices

    def _get_price(self, ticker: str) -> Optional[float]:
        """Get current price for a single ticker."""
        try:
            # Try real-time WebSocket cache first
            price = get_latest_price(ticker, max_cache_age=10.0)
            if price:
                return price

            # yfinance fallback
            t = yf.Ticker(ticker)
            hist = t.history(period='1d', interval='5m')
            if not hist.empty:
                return float(hist['Close'].iloc[-1])
        except Exception as e:
            print(f"[Bob] ⚠️ Price fetch failed for {ticker}: {e}")
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
                    'stop_loss', 'take_profit', 'status', 'triggered'
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
    agent = BitcoinBobAgent()
    agent.run()
