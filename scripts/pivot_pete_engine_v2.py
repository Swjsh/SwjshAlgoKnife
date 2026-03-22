#!/usr/bin/env python3
"""
Pivot Pete Agent v2 — Extends BaseAgent
========================================
Futures/Index Pivot Rejection Engine (PAPER ONLY) using BaseAgent foundation.

Same strategy as v1:
- Wait for price to reach KEY PIVOT LEVELS
- Confirm with VOLUME
- Multi-timeframe: Weekly → Daily → 1H → 5m

Risk Rules (STRICT):
- Max daily loss: $4,000
- 2 consecutive losses = DONE FOR DAY
- Max 4 trades per day

Improvements from BaseAgent:
• Circuit breaker pattern for errors
• Exponential backoff on consecutive failures
• Proper error logging to agent_logs.json
• Cleaner state persistence
"""

import os
import sys
import time
import json
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Tuple, Optional

from dotenv import load_dotenv
import requests
import pandas as pd
import numpy as np
import pytz

from base_agent import BaseAgent
from agent_utils import log_message, get_random_quip, save_risk_state, load_risk_state

load_dotenv(os.path.join(os.getcwd(), '.env.local'))

# ============================================================================
# CONFIGURATION
# ============================================================================

ET = pytz.timezone("America/New_York")
DATA_PROVIDER = os.getenv("PIVOT_PETE_DATA_PROVIDER", "OANDA").upper()

SCAN_INTERVAL_SEC = 300  # 5 minute scan interval

class Symbol(Enum):
    ES = "ES"
    NQ = "NQ"
    GC = "GC"
    SI = "SI"

# Contract specifications
CONTRACT_SPECS = {
    "ES": {"point_value": 50, "tick_size": 0.25, "name": "S&P 500 E-mini"},
    "NQ": {"point_value": 20, "tick_size": 0.25, "name": "Nasdaq 100 E-mini"},
    "GC": {"point_value": 100, "tick_size": 0.10, "name": "Gold"},
    "SI": {"point_value": 5000, "tick_size": 0.005, "name": "Silver"},
}

# Provider symbol mapping
OANDA_SYMBOL_MAP = {
    "ES": "US500_USD",
    "NQ": "NAS100_USD",
    "GC": "XAU_USD",
    "SI": "XAG_USD",
}

ALPACA_SYMBOL_MAP = {
    "ES": "SPY",
    "NQ": "QQQ",
}

SYMBOL_MAP = {"ES": "ES", "NQ": "NQ", "GC": "XAUUSD", "SI": "XAGUSD"}


# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class PivotLevel:
    """Key price level"""
    price: float
    level_type: str
    timeframe: str
    timestamp: datetime
    strength: float

@dataclass
class Trade:
    """Trade record"""
    symbol: str
    entry_price: float
    entry_time: datetime
    direction: str
    stop_loss: float
    take_profit: float
    size: int
    status: str
    pivot_level: str
    exit_price: Optional[float] = None
    exit_time: Optional[datetime] = None
    pnl: Optional[float] = None
    exit_reason: Optional[str] = None


# ============================================================================
# DATA PROVIDERS
# ============================================================================

class DataProvider:
    def __init__(self, provider: str):
        self.provider = provider

    def fetch_candles(self, symbol: str, interval: str) -> pd.DataFrame:
        if self.provider == "OANDA":
            return self._fetch_oanda(symbol, interval)
        if self.provider == "ALPACA":
            return self._fetch_alpaca(symbol, interval)
        raise ValueError(f"Unsupported provider: {self.provider}")

    def _fetch_oanda(self, symbol: str, interval: str) -> pd.DataFrame:
        api_key = os.getenv("OANDA_API_KEY") or os.getenv("OANDA_API_TOKEN")
        account_id = os.getenv("OANDA_ACCOUNT_ID")
        env = (os.getenv("OANDA_ENVIRONMENT") or "practice").lower()
        base_url = os.getenv("OANDA_BASE_URL") or (
            "https://api-fxpractice.oanda.com" if env == "practice"
            else "https://api-fxtrade.oanda.com"
        )

        if not api_key or not account_id:
            raise RuntimeError("Missing OANDA_API_KEY/OANDA_API_TOKEN or OANDA_ACCOUNT_ID")

        instrument = OANDA_SYMBOL_MAP.get(symbol)
        if not instrument:
            raise RuntimeError(f"No Oanda mapping for symbol {symbol}")

        granularity = {"5m": "M5", "1h": "H1", "1d": "D"}[interval]
        count = 500 if interval in ["5m", "1h"] else 200

        url = f"{base_url}/v3/instruments/{instrument}/candles"
        params = {"granularity": granularity, "count": count, "price": "M"}
        headers = {"Authorization": f"Bearer {api_key}"}

        resp = requests.get(url, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        candles = data.get("candles", [])

        rows = []
        for c in candles:
            if not c.get("complete"):
                continue
            mid = c.get("mid") or {}
            rows.append({
                "Datetime": pd.to_datetime(c["time"]),
                "Open": float(mid.get("o", 0)),
                "High": float(mid.get("h", 0)),
                "Low": float(mid.get("l", 0)),
                "Close": float(mid.get("c", 0)),
                "Volume": int(c.get("volume", 0)),
            })

        df = pd.DataFrame(rows)
        if df.empty:
            return df
        df = df.set_index("Datetime")
        return df

    def _fetch_alpaca(self, symbol: str, interval: str) -> pd.DataFrame:
        api_key = os.getenv("APCA_API_KEY_ID")
        secret_key = os.getenv("APCA_API_SECRET_KEY")
        base_url = os.getenv("APCA_DATA_URL", "https://data.alpaca.markets")

        if not api_key or not secret_key:
            raise RuntimeError("Missing APCA_API_KEY_ID or APCA_API_SECRET_KEY")

        provider_symbol = ALPACA_SYMBOL_MAP.get(symbol)
        if not provider_symbol:
            raise RuntimeError(f"No Alpaca mapping for symbol {symbol}")

        timeframe = {"5m": "5Min", "1h": "1Hour", "1d": "1Day"}[interval]
        url = f"{base_url}/v2/stocks/{provider_symbol}/bars"
        end = datetime.utcnow()
        start = end - timedelta(days=5 if interval != '1d' else 90)
        feed = os.getenv("APCA_DATA_FEED", "iex")

        params = {
            "timeframe": timeframe,
            "limit": 500,
            "start": start.isoformat() + 'Z',
            "end": end.isoformat() + 'Z',
            "feed": feed
        }
        headers = {
            "APCA-API-KEY-ID": api_key,
            "APCA-API-SECRET-KEY": secret_key,
        }

        resp = requests.get(url, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        bars = data.get("bars", [])

        rows = []
        for b in bars:
            rows.append({
                "Datetime": pd.to_datetime(b["t"]),
                "Open": float(b["o"]),
                "High": float(b["h"]),
                "Low": float(b["l"]),
                "Close": float(b["c"]),
                "Volume": int(b.get("v", 0)),
            })

        df = pd.DataFrame(rows)
        if df.empty:
            return df
        df = df.set_index("Datetime")
        return df


# ============================================================================
# PIVOT DETECTION
# ============================================================================

class PivotDetector:
    """Detects key pivot levels across timeframes"""

    def calculate_classic_pivots(self, high: float, low: float, close: float) -> Dict[str, float]:
        pivot = (high + low + close) / 3
        r1 = 2 * pivot - low
        s1 = 2 * pivot - high
        r2 = pivot + (high - low)
        s2 = pivot - (high - low)
        r3 = high + 2 * (pivot - low)
        s3 = low - 2 * (high - pivot)
        return {"pivot": pivot, "r1": r1, "r2": r2, "r3": r3, "s1": s1, "s2": s2, "s3": s3}

    def get_previous_day_levels(self, df: pd.DataFrame) -> Dict[str, float]:
        if len(df) < 2:
            return {}
        df_daily = df.resample('D').agg({
            'Open': 'first', 'High': 'max', 'Low': 'min', 'Close': 'last', 'Volume': 'sum'
        }).dropna()
        if len(df_daily) < 2:
            return {}
        prev_day = df_daily.iloc[-2]
        return {
            'prev_day_high': prev_day['High'],
            'prev_day_low': prev_day['Low'],
            'prev_day_close': prev_day['Close'],
        }

    def get_previous_week_levels(self, df: pd.DataFrame) -> Dict[str, float]:
        df_weekly = df.resample('W').agg({'High': 'max', 'Low': 'min'}).dropna()
        if len(df_weekly) < 2:
            return {}
        prev_week = df_weekly.iloc[-2]
        return {'prev_week_high': prev_week['High'], 'prev_week_low': prev_week['Low']}

    def find_swing_points(self, df: pd.DataFrame, window: int = 5) -> List[PivotLevel]:
        pivots = []
        for i in range(window, len(df) - window):
            if df['High'].iloc[i] == df['High'].iloc[i-window:i+window+1].max():
                pivots.append(PivotLevel(
                    price=df['High'].iloc[i], level_type='swing_high',
                    timeframe='current', timestamp=df.index[i].to_pydatetime(), strength=0.7
                ))
            if df['Low'].iloc[i] == df['Low'].iloc[i-window:i+window+1].min():
                pivots.append(PivotLevel(
                    price=df['Low'].iloc[i], level_type='swing_low',
                    timeframe='current', timestamp=df.index[i].to_pydatetime(), strength=0.7
                ))
        return pivots

    def identify_supply_demand_zones(self, df: pd.DataFrame) -> List[PivotLevel]:
        zones = []
        for i in range(10, len(df) - 1):
            body_size = abs(df['Close'].iloc[i] - df['Open'].iloc[i])
            prev_range = df['High'].iloc[i-5:i].max() - df['Low'].iloc[i-5:i].min()
            if prev_range == 0:
                continue
            if df['Close'].iloc[i] > df['Open'].iloc[i] and body_size > prev_range * 0.5:
                zones.append(PivotLevel(
                    price=df['Low'].iloc[i], level_type='demand_zone',
                    timeframe='current', timestamp=df.index[i].to_pydatetime(), strength=0.8
                ))
            elif df['Close'].iloc[i] < df['Open'].iloc[i] and body_size > prev_range * 0.5:
                zones.append(PivotLevel(
                    price=df['High'].iloc[i], level_type='supply_zone',
                    timeframe='current', timestamp=df.index[i].to_pydatetime(), strength=0.8
                ))
        return zones

    def get_round_numbers(self, current_price: float, range_pct: float = 0.02) -> List[PivotLevel]:
        levels = []
        if current_price > 1000:
            increment = 50
        elif current_price > 100:
            increment = 10
        else:
            increment = 1
        base = int(current_price / increment) * increment
        for offset in range(-3, 4):
            level = base + (offset * increment)
            if abs(level - current_price) / current_price < range_pct:
                levels.append(PivotLevel(
                    price=float(level), level_type='round_number',
                    timeframe='all', timestamp=datetime.now(), strength=0.6
                ))
        return levels


# ============================================================================
# VOLUME ANALYZER
# ============================================================================

class VolumeAnalyzer:
    def get_volume_spike_ratio(self, df: pd.DataFrame, window: int = 20) -> float:
        if len(df) < window:
            return 1.0
        avg_volume = df['Volume'].rolling(window=window).mean().iloc[-1]
        if avg_volume == 0:
            return 1.0
        return df['Volume'].iloc[-1] / avg_volume

    def is_volume_confirming(self, df: pd.DataFrame, threshold: float = 1.5) -> bool:
        return self.get_volume_spike_ratio(df) >= threshold


# ============================================================================
# RISK MANAGER
# ============================================================================

class RiskManager:
    def __init__(self, starting_capital: float = 10000):
        self.starting_capital = starting_capital
        self.current_capital = starting_capital
        self.max_daily_loss = 4000
        self.max_consecutive_losses = 2
        self.max_trades_per_day = 4
        self.daily_target_min = 25
        self.daily_target_max = 5000
        self.daily_pnl = 0
        self.trades_today: List[Trade] = []
        self.consecutive_losses = 0
        self.trading_locked = False
        self.lock_reason = ""

    def can_trade(self) -> Tuple[bool, str]:
        if self.trading_locked:
            return False, f"LOCKED: {self.lock_reason}"
        if self.consecutive_losses >= self.max_consecutive_losses:
            self.trading_locked = True
            self.lock_reason = f"Hit {self.max_consecutive_losses} consecutive losses"
            return False, self.lock_reason
        if len(self.trades_today) >= self.max_trades_per_day:
            self.trading_locked = True
            self.lock_reason = f"Hit max {self.max_trades_per_day} trades"
            return False, self.lock_reason
        if self.daily_pnl <= -self.max_daily_loss:
            self.trading_locked = True
            self.lock_reason = f"Hit daily loss limit ${self.max_daily_loss}"
            return False, self.lock_reason
        if self.daily_pnl >= self.daily_target_max:
            return False, f"Daily target reached: ${self.daily_pnl:.2f}"
        return True, "OK to trade"

    def calculate_position_size(self, symbol: str, entry: float, stop: float, risk_pct: float = 0.02) -> int:
        spec = CONTRACT_SPECS.get(symbol, {"point_value": 50})
        point_value = spec["point_value"]
        risk_amount = self.current_capital * risk_pct
        price_risk = abs(entry - stop)
        if price_risk == 0:
            return 1
        contracts = int(risk_amount / (price_risk * point_value))
        return max(1, min(2, contracts))

    def record_trade(self, trade: Trade):
        self.trades_today.append(trade)
        if trade.pnl is not None:
            self.daily_pnl += trade.pnl
            self.current_capital += trade.pnl
            if trade.pnl < 0:
                self.consecutive_losses += 1
            else:
                self.consecutive_losses = 0

    def reset_daily(self):
        self.daily_pnl = 0
        self.trades_today = []
        self.consecutive_losses = 0
        self.trading_locked = False
        self.lock_reason = ""

    def get_stats(self) -> Dict:
        return {
            "capital": self.current_capital,
            "daily_pnl": self.daily_pnl,
            "trades_today": len(self.trades_today),
            "consecutive_losses": self.consecutive_losses,
            "locked": self.trading_locked,
            "lock_reason": self.lock_reason,
        }


# ============================================================================
# PIVOT PETE AGENT (extends BaseAgent)
# ============================================================================

class PivotPeteAgent(BaseAgent):
    """
    Futures pivot rejection trader.
    Multi-timeframe pivot analysis with strict risk rules.
    """

    strategy_name = "PivotPete_Rejection"

    def __init__(self, symbol: str = "ES"):
        super().__init__(
            agent_id="futures",
            display_name="Pivot Pete",
            scan_interval_sec=SCAN_INTERVAL_SEC,
            max_consecutive_errors=10,
            error_backoff_base_sec=60,
            status_file_name="futures_agent_status.json"
        )

        # Agent-specific state
        self.symbol = symbol
        self.spec = CONTRACT_SPECS.get(symbol, CONTRACT_SPECS["ES"])

        # Helper classes
        self.provider = DataProvider(DATA_PROVIDER)
        self.pivot_detector = PivotDetector()
        self.volume_analyzer = VolumeAnalyzer()
        self.risk_manager = RiskManager()

        # Analysis state
        self.pivot_levels: List[PivotLevel] = []
        self.active_trade_obj: Optional[Trade] = None
        self.higher_tf_bias = "NEUTRAL"
        self.current_price = 0.0
        self.volume_ratio = 1.0

        # Force scan mode
        self.force_scan = os.getenv("PIVOT_PETE_FORCE_SCAN", "0") == "1"

    # ═══════════════════════════════════════════════════════════════════════════
    # REQUIRED OVERRIDES
    # ═══════════════════════════════════════════════════════════════════════════

    def should_trade(self) -> bool:
        """Override: Only trade during market hours."""
        if self.force_scan:
            return True
        now_et = datetime.now(ET)
        if now_et.weekday() >= 5:
            return False
        start = now_et.replace(hour=9, minute=30, second=0, microsecond=0)
        end = now_et.replace(hour=16, minute=0, second=0, microsecond=0)
        return start <= now_et <= end

    def execute_scan(self, price: float) -> None:
        """Main scan cycle."""
        now_str = datetime.now(ET).strftime('%H:%M:%S')
        print(f"\n[{now_str}] Scan #{self.scan_count}")

        # Fetch multi-timeframe data
        df_5m = self.provider.fetch_candles(self.symbol, "5m")
        df_1h = self.provider.fetch_candles(self.symbol, "1h")
        df_daily = self.provider.fetch_candles(self.symbol, "1d")

        if df_5m.empty:
            log_message(self.agent_id, "No data received", type='warning')
            return

        # Update pivot levels
        self._update_pivot_levels(df_5m, df_1h, df_daily)

        # Get current price and volume
        self.current_price = df_5m['Close'].iloc[-1]
        self.volume_ratio = self.volume_analyzer.get_volume_spike_ratio(df_5m)

        print(f"   Price: ${self.current_price:.2f} | Vol: {self.volume_ratio:.1f}x avg")
        print(f"   Pivots: {len(self.pivot_levels)} | Bias: {self.higher_tf_bias}")

        # Check risk status
        can_trade, reason = self.risk_manager.can_trade()
        if not can_trade:
            print(f"   {reason}")

        # Check exits on open trade
        if self.active_trade_obj:
            print(f"   Open: {self.active_trade_obj.direction} @ ${self.active_trade_obj.entry_price:.2f}")
            self._check_exit(self.current_price)
        elif can_trade:
            signal = self._check_entry_signal(self.current_price, df_5m)
            if signal:
                self._execute_trade(signal)

        # Display stats
        stats = self.risk_manager.get_stats()
        print(f"   Capital: ${stats['capital']:,.2f} | Daily: ${stats['daily_pnl']:+,.2f} | Trades: {stats['trades_today']}")

        # Force scan mode: exit after one scan
        if self.force_scan:
            print("\nForce scan complete. Exiting.")
            self.halt("Force scan complete")

    def get_current_price(self) -> Optional[float]:
        """Fetch current price via data provider."""
        try:
            df = self.provider.fetch_candles(self.symbol, "5m")
            if not df.empty:
                return float(df['Close'].iloc[-1])
        except Exception as e:
            print(f"[Pete] Price fetch failed: {e}")
        return None

    # ═══════════════════════════════════════════════════════════════════════════
    # OPTIONAL HOOKS
    # ═══════════════════════════════════════════════════════════════════════════

    def on_startup(self) -> None:
        """Initialize and restore state."""
        log_message(self.agent_id, get_random_quip('futures'))

        # Restore risk state
        risk_saved = load_risk_state('pivot_pete')
        if risk_saved:
            self.risk_manager.daily_pnl = risk_saved.get('daily_pnl', 0)
            self.risk_manager.consecutive_losses = risk_saved.get('consecutive_losses', 0)
            self.risk_manager.current_capital = risk_saved.get('capital', self.risk_manager.starting_capital)
            trades_count = risk_saved.get('trades_today', 0)
            self.risk_manager.trades_today = [None] * trades_count
            if risk_saved.get('locked', False):
                self.risk_manager.trading_locked = True
                self.risk_manager.lock_reason = risk_saved.get('lock_reason', 'Restored from saved state')

        # Restore active trade
        state = self._get_restored_state()
        if state.get('active_trade'):
            t = state['active_trade']
            self.active_trade_obj = Trade(
                symbol=t['symbol'],
                entry_price=t['entry_price'],
                entry_time=datetime.fromisoformat(t['entry_time']) if isinstance(t['entry_time'], str) else t['entry_time'],
                direction=t['direction'],
                stop_loss=t['stop_loss'],
                take_profit=t['take_profit'],
                size=t.get('size', 1),
                status='OPEN',
                pivot_level=t.get('pivot_level', 'restored'),
            )
            # Sync with BaseAgent trades list
            self.active_trades = [{
                'symbol': t['symbol'],
                'direction': t['direction'],
                'entry_price': t['entry_price'],
                'stop_loss': t['stop_loss'],
                'take_profit': t['take_profit'],
            }]
            print(f"[Pete] Restored active trade: {t['direction']} @ ${t['entry_price']:.2f}")

        print(f"Tracking: {self.spec['name']} ({self.symbol})")
        print(f"Starting Capital: ${self.risk_manager.current_capital:,.2f}")
        print(f"Data Provider: {DATA_PROVIDER}\n")

    def on_shutdown(self) -> None:
        """Display final stats."""
        stats = self.risk_manager.get_stats()
        print(f"\nFinal Stats:")
        print(f"   Capital: ${stats['capital']:,.2f}")
        print(f"   Daily P&L: ${stats['daily_pnl']:+,.2f}")
        print(f"   Trades: {stats['trades_today']}")

    def get_banner(self) -> str:
        return f"""
+===============================================================+
|                    PIVOT PETE v2 ENGINE                       |
|            Socrates Investments Methodology                   |
+---------------------------------------------------------------+
|  Strategy: KEY PIVOT LEVELS + VOLUME confirmation             |
|  Risk: Max $4K daily loss | 2 consecutive losses = DONE       |
|  Data: REAL ({DATA_PROVIDER}) | Mode: PAPER TRADING           |
|  [Using BaseAgent Foundation]                                 |
+===============================================================+
"""

    def get_status_extras(self) -> dict:
        """Add Pete-specific status fields."""
        stats = self.risk_manager.get_stats()
        return {
            'symbol': self.symbol,
            'higher_tf_bias': self.higher_tf_bias,
            'pivot_levels_count': len(self.pivot_levels),
            'volume_ratio': round(self.volume_ratio, 2),
            'risk': stats,
        }

    # ═══════════════════════════════════════════════════════════════════════════
    # PIVOT ANALYSIS
    # ═══════════════════════════════════════════════════════════════════════════

    def _update_pivot_levels(self, df_5m: pd.DataFrame, df_1h: pd.DataFrame, df_daily: pd.DataFrame):
        """Update all pivot levels from multi-timeframe data."""
        self.pivot_levels = []

        # Previous day levels
        prev_day = self.pivot_detector.get_previous_day_levels(df_5m)
        for name, price in prev_day.items():
            self.pivot_levels.append(PivotLevel(
                price=price, level_type=name, timeframe='daily',
                timestamp=datetime.now(), strength=0.9
            ))

        # Previous week levels
        prev_week = self.pivot_detector.get_previous_week_levels(df_daily)
        for name, price in prev_week.items():
            self.pivot_levels.append(PivotLevel(
                price=price, level_type=name, timeframe='weekly',
                timestamp=datetime.now(), strength=0.95
            ))

        # Classic pivots
        if len(df_daily) >= 2:
            prev = df_daily.iloc[-2]
            pivots = self.pivot_detector.calculate_classic_pivots(prev['High'], prev['Low'], prev['Close'])
            for name, price in pivots.items():
                self.pivot_levels.append(PivotLevel(
                    price=price, level_type=f'pivot_{name}', timeframe='daily',
                    timestamp=datetime.now(), strength=0.85
                ))

        # Swing points and S/D zones
        swings = self.pivot_detector.find_swing_points(df_1h, window=3)
        self.pivot_levels.extend(swings)

        zones = self.pivot_detector.identify_supply_demand_zones(df_5m)
        self.pivot_levels.extend(zones[-10:])

        # Round numbers
        if len(df_5m) > 0:
            current = df_5m['Close'].iloc[-1]
            rounds = self.pivot_detector.get_round_numbers(current)
            self.pivot_levels.extend(rounds)

        # HTF bias
        self.higher_tf_bias = self._analyze_higher_timeframes(df_1h, df_daily)

    def _analyze_higher_timeframes(self, df_1h: pd.DataFrame, df_daily: pd.DataFrame) -> str:
        if len(df_daily) < 5 or len(df_1h) < 20:
            return "NEUTRAL"
        daily_sma20 = df_daily['Close'].rolling(20).mean().iloc[-1] if len(df_daily) >= 20 else df_daily['Close'].mean()
        daily_close = df_daily['Close'].iloc[-1]
        h1_sma20 = df_1h['Close'].rolling(20).mean().iloc[-1]
        h1_close = df_1h['Close'].iloc[-1]
        daily_bullish = daily_close > daily_sma20
        h1_bullish = h1_close > h1_sma20
        if daily_bullish and h1_bullish:
            return "BULLISH"
        elif not daily_bullish and not h1_bullish:
            return "BEARISH"
        return "NEUTRAL"

    # ═══════════════════════════════════════════════════════════════════════════
    # ENTRY / EXIT
    # ═══════════════════════════════════════════════════════════════════════════

    def _check_entry_signal(self, current_price: float, df_5m: pd.DataFrame) -> Optional[Dict]:
        can_trade, _ = self.risk_manager.can_trade()
        if not can_trade:
            return None
        if not self.volume_analyzer.is_volume_confirming(df_5m, threshold=1.3):
            return None

        for pivot in sorted(self.pivot_levels, key=lambda x: x.strength, reverse=True):
            distance_pct = abs(current_price - pivot.price) / current_price
            if distance_pct < 0.002:
                if pivot.level_type in ['demand_zone', 'swing_low', 'pivot_s1', 'pivot_s2', 'prev_day_low', 'prev_week_low']:
                    if self.higher_tf_bias != "BEARISH":
                        return {
                            'direction': 'LONG',
                            'entry': current_price,
                            'stop': pivot.price - (current_price * 0.003),
                            'pivot': pivot
                        }
                elif pivot.level_type in ['supply_zone', 'swing_high', 'pivot_r1', 'pivot_r2', 'prev_day_high', 'prev_week_high']:
                    if self.higher_tf_bias != "BULLISH":
                        return {
                            'direction': 'SHORT',
                            'entry': current_price,
                            'stop': pivot.price + (current_price * 0.003),
                            'pivot': pivot
                        }
        return None

    def _find_take_profit(self, entry: float, direction: str) -> float:
        if direction == 'LONG':
            above = [p for p in self.pivot_levels if p.price > entry * 1.001]
            if above:
                return min(above, key=lambda p: p.price).price
            return entry * 1.01
        else:
            below = [p for p in self.pivot_levels if p.price < entry * 0.999]
            if below:
                return max(below, key=lambda p: p.price).price
            return entry * 0.99

    def _execute_trade(self, signal: Dict):
        entry = signal['entry']
        stop = signal['stop']
        direction = signal['direction']
        pivot = signal['pivot']

        size = self.risk_manager.calculate_position_size(self.symbol, entry, stop)
        tp = self._find_take_profit(entry, direction)

        self.active_trade_obj = Trade(
            symbol=self.symbol,
            entry_price=entry,
            entry_time=datetime.now(),
            direction=direction,
            stop_loss=stop,
            take_profit=tp,
            size=size,
            status='OPEN',
            pivot_level=pivot.level_type
        )

        # Fire webhook
        action = 'BUY' if direction == 'LONG' else 'SELL'
        self.fire_signal(
            action=action,
            symbol=SYMBOL_MAP.get(self.symbol, self.symbol),
            price=entry,
            stop_loss=stop,
            take_profit=tp,
            reason=f"Pivot rejection @ {pivot.level_type} (${pivot.price:.2f}) | Bias: {self.higher_tf_bias}"
        )

        # Sync with BaseAgent
        self.active_trades = [{
            'symbol': self.symbol,
            'direction': direction,
            'entry_price': entry,
            'stop_loss': stop,
            'take_profit': tp,
        }]

        print(f"\n{'='*50}")
        print(f"TRADE {direction} {self.spec['name']} @ ${entry:.2f}")
        print(f"   Pivot: {pivot.level_type} (${pivot.price:.2f})")
        print(f"   Stop: ${stop:.2f} | TP: ${tp:.2f}")
        print(f"   Size: {size} contract(s)")
        print(f"   Higher TF Bias: {self.higher_tf_bias}")
        print(f"{'='*50}\n")

    def _check_exit(self, current_price: float):
        if not self.active_trade_obj or self.active_trade_obj.status != 'OPEN':
            return

        trade = self.active_trade_obj

        hit_sl = hit_tp = False
        if trade.direction == 'LONG':
            hit_sl = current_price <= trade.stop_loss
            hit_tp = current_price >= trade.take_profit
        else:
            hit_sl = current_price >= trade.stop_loss
            hit_tp = current_price <= trade.take_profit

        if hit_sl:
            self._close_trade(current_price, 'Stop Loss')
        elif hit_tp:
            self._close_trade(current_price, 'Take Profit')

    def _close_trade(self, exit_price: float, reason: str):
        trade = self.active_trade_obj
        if not trade:
            return

        trade.exit_price = exit_price
        trade.exit_time = datetime.now()
        trade.status = 'CLOSED'
        trade.exit_reason = reason

        point_value = self.spec['point_value']
        if trade.direction == 'LONG':
            points = exit_price - trade.entry_price
        else:
            points = trade.entry_price - exit_price

        trade.pnl = points * point_value * trade.size
        self.risk_manager.record_trade(trade)

        # Fire EXIT signal
        self.fire_signal(
            action='EXIT',
            symbol=SYMBOL_MAP.get(self.symbol, self.symbol),
            price=exit_price,
            reason=f"{reason} | PnL: ${trade.pnl:+.2f}"
        )

        outcome = "WIN" if trade.pnl > 0 else "LOSS"
        log_message(self.agent_id, f"{outcome}: {self.symbol} ${trade.pnl:+.2f} | {reason}", type='trade')

        print(f"\n{'='*50}")
        print(f"{outcome} CLOSED {trade.direction} @ ${exit_price:.2f}")
        print(f"   Entry: ${trade.entry_price:.2f} -> Exit: ${exit_price:.2f}")
        print(f"   P&L: ${trade.pnl:.2f} | Reason: {reason}")
        print(f"   Daily P&L: ${self.risk_manager.daily_pnl:.2f}")
        stats = self.risk_manager.get_stats()
        if stats['consecutive_losses'] > 0:
            print(f"   Consecutive Losses: {stats['consecutive_losses']}/{self.risk_manager.max_consecutive_losses}")
        print(f"{'='*50}\n")

        self.active_trade_obj = None
        self.active_trades = []

        # Persist risk state
        save_risk_state('pivot_pete', self.risk_manager.get_stats())

    # ═══════════════════════════════════════════════════════════════════════════
    # STATE PERSISTENCE
    # ═══════════════════════════════════════════════════════════════════════════

    def _save_state(self) -> None:
        """Save state including active trade."""
        from agent_utils import save_agent_state

        active_trade_data = None
        if self.active_trade_obj:
            active_trade_data = {
                'symbol': self.active_trade_obj.symbol,
                'entry_price': self.active_trade_obj.entry_price,
                'entry_time': self.active_trade_obj.entry_time.isoformat(),
                'direction': self.active_trade_obj.direction,
                'stop_loss': self.active_trade_obj.stop_loss,
                'take_profit': self.active_trade_obj.take_profit,
                'size': self.active_trade_obj.size,
                'pivot_level': self.active_trade_obj.pivot_level,
            }

        save_agent_state(self.agent_id, {
            'active_trade': active_trade_data,
            'scan_count': self.scan_count,
            'daily_pnl': self.daily_pnl,
            'wins': self.wins,
            'losses': self.losses,
        })

        # Also save risk state
        save_risk_state('pivot_pete', self.risk_manager.get_stats())

    def _get_restored_state(self) -> dict:
        from agent_utils import load_agent_state
        return load_agent_state(self.agent_id) or {}


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    symbol = "ES"
    if len(sys.argv) > 1:
        arg = sys.argv[1].upper()
        if arg in ["ES", "NQ", "GC", "GOLD", "SI"]:
            symbol = "GC" if arg == "GOLD" else arg

    agent = PivotPeteAgent(symbol)
    agent.run()
