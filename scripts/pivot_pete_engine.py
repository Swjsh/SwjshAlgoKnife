#!/usr/bin/env python3
"""
Pivot Pete - Futures/Index Pivot Rejection Engine (PAPER ONLY)

Strategy:
- Wait for price to reach KEY PIVOT LEVELS
- Confirm with VOLUME
- Multi-timeframe: Weekly → Daily → 1H → 5m

Risk Rules (STRICT):
- Max daily loss: $4,000
- 2 consecutive losses = DONE FOR DAY
- Max 4 trades per day

Data: REAL market data only (Oanda or Alpaca)
"""

import os
import json
import time
import sys
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Tuple, Optional

from dotenv import load_dotenv
import requests
import pandas as pd
import numpy as np
from agent_utils import log_message, get_random_quip, save_agent_state, load_agent_state, save_risk_state, load_risk_state
import pytz

load_dotenv(os.path.join(os.getcwd(), '.env.local'))

# ============================================================================
# CONFIGURATION
# ============================================================================

WEBHOOK_URL       = "http://localhost:3000/api/webhook/tradingview"
WEBHOOK_SECRET    = os.getenv("WEBHOOK_SECRET")
if not WEBHOOK_SECRET:
    raise RuntimeError("WEBHOOK_SECRET environment variable is required")

ET = pytz.timezone("America/New_York")

DATA_PROVIDER = os.getenv("PIVOT_PETE_DATA_PROVIDER", "OANDA").upper()

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
    "ES": "US500_USD",    # S&P 500 CFD (proxy for ES)
    "NQ": "NAS100_USD",   # Nasdaq 100 CFD (proxy for NQ)
    "GC": "XAU_USD",
    "SI": "XAG_USD",
}

ALPACA_SYMBOL_MAP = {
    "ES": "SPY",  # ETF proxy
    "NQ": "QQQ",
}

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
        base_url = os.getenv("OANDA_BASE_URL") or ("https://api-fxpractice.oanda.com" if env == "practice" else "https://api-fxtrade.oanda.com")

        if not api_key or not account_id:
            raise RuntimeError("Missing OANDA_API_KEY/OANDA_API_TOKEN or OANDA_ACCOUNT_ID")

        instrument = OANDA_SYMBOL_MAP.get(symbol)
        if not instrument:
            raise RuntimeError(f"No Oanda mapping for symbol {symbol}")

        granularity = {
            "5m": "M5",
            "1h": "H1",
            "1d": "D",
        }[interval]

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
        params = {"timeframe": timeframe, "limit": 500, "start": start.isoformat() + 'Z', "end": end.isoformat() + 'Z', "feed": feed}
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
# DATA CLASSES
# ============================================================================

@dataclass
class PivotLevel:
    """Key price level"""
    price: float
    level_type: str  # 'prev_day_high', 'prev_day_low', 'pivot', 'r1', 's1', etc.
    timeframe: str
    timestamp: datetime
    strength: float  # 0-1

@dataclass
class Trade:
    """Trade record"""
    symbol: str
    entry_price: float
    entry_time: datetime
    direction: str  # 'LONG' or 'SHORT'
    stop_loss: float
    take_profit: float
    size: int
    status: str  # 'OPEN', 'CLOSED'
    pivot_level: str  # What level triggered entry
    exit_price: Optional[float] = None
    exit_time: Optional[datetime] = None
    pnl: Optional[float] = None
    exit_reason: Optional[str] = None

# ============================================================================
# WEBHOOK / STATUS
# ============================================================================

# Pivot Pete trades ES via OANDA CFD proxy (US500_USD) through the executor chain.
# The executor detects non-FX, non-crypto symbols and routes to Alpaca Paper (SPY).
# Symbol sent as "ES" which the executor handles.
SYMBOL_MAP = {"ES": "ES", "NQ": "NQ", "GC": "XAUUSD", "SI": "XAGUSD"}

def fire_signal(symbol: str, action: str, price: float,
                stop_loss: float = None, take_profit: float = None,
                reason: str = "") -> bool:
    sig_symbol = SYMBOL_MAP.get(symbol, symbol)
    payload = {
        "symbol":      sig_symbol,
        "action":      action,
        "price":       price,
        "strategy":    "PivotPete_Rejection",
        "stopLoss":    stop_loss,
        "takeProfit":  take_profit,
        "notes":       reason or f"Pete: {action} {sig_symbol} @ {price}",
    }
    headers = {
        "Content-Type":     "application/json",
        "X-Webhook-Secret": WEBHOOK_SECRET,
    }
    try:
        resp = requests.post(WEBHOOK_URL, json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            print(f"[Pete] \u2705 Signal sent: {action} {sig_symbol} @ ${price:.2f}")
            log_message('futures', f"\U0001f514 {action} {sig_symbol} @ ${price:.2f} | {reason}", type='trade')
            return True
        else:
            print(f"[Pete] \u274c Webhook failed {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"[Pete] \u274c Webhook error: {e}")
        return False


def broadcast_status(engine, scan_count: int, current_price: float):
    stats = engine.risk_manager.get_stats()
    msg = f"Pivots: {len(engine.pivot_levels)} | Bias: {engine.higher_tf_bias} | Price: ${current_price:.2f}"
    print(
        f"AGENT_STATUS_UPDATE:{json.dumps({'agentId': 'pivot_pete', 'status': 'ACTIVE', 'message': msg, 'timestamp': datetime.now().isoformat()})}",
        flush=True
    )


# ============================================================================
# PIVOT DETECTION
# ============================================================================

class PivotDetector:
    """Detects key pivot levels across timeframes"""

    def calculate_classic_pivots(self, high: float, low: float, close: float) -> Dict[str, float]:
        """Calculate classic pivot points"""
        pivot = (high + low + close) / 3
        r1 = 2 * pivot - low
        s1 = 2 * pivot - high
        r2 = pivot + (high - low)
        s2 = pivot - (high - low)
        r3 = high + 2 * (pivot - low)
        s3 = low - 2 * (high - pivot)

        return {
            "pivot": pivot,
            "r1": r1, "r2": r2, "r3": r3,
            "s1": s1, "s2": s2, "s3": s3
        }

    def get_previous_day_levels(self, df: pd.DataFrame) -> Dict[str, float]:
        """Get previous day's high, low, close"""
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
        """Get previous week's high and low"""
        df_weekly = df.resample('W').agg({
            'High': 'max', 'Low': 'min'
        }).dropna()

        if len(df_weekly) < 2:
            return {}

        prev_week = df_weekly.iloc[-2]
        return {
            'prev_week_high': prev_week['High'],
            'prev_week_low': prev_week['Low'],
        }

    def find_swing_points(self, df: pd.DataFrame, window: int = 5) -> List[PivotLevel]:
        """Find swing highs and lows"""
        pivots = []

        for i in range(window, len(df) - window):
            if df['High'].iloc[i] == df['High'].iloc[i-window:i+window+1].max():
                pivots.append(PivotLevel(
                    price=df['High'].iloc[i],
                    level_type='swing_high',
                    timeframe='current',
                    timestamp=df.index[i].to_pydatetime(),
                    strength=0.7
                ))

            if df['Low'].iloc[i] == df['Low'].iloc[i-window:i+window+1].min():
                pivots.append(PivotLevel(
                    price=df['Low'].iloc[i],
                    level_type='swing_low',
                    timeframe='current',
                    timestamp=df.index[i].to_pydatetime(),
                    strength=0.7
                ))

        return pivots

    def identify_supply_demand_zones(self, df: pd.DataFrame) -> List[PivotLevel]:
        """Find supply/demand zones based on strong moves"""
        zones = []

        for i in range(10, len(df) - 1):
            body_size = abs(df['Close'].iloc[i] - df['Open'].iloc[i])
            prev_range = df['High'].iloc[i-5:i].max() - df['Low'].iloc[i-5:i].min()

            if prev_range == 0:
                continue

            if df['Close'].iloc[i] > df['Open'].iloc[i] and body_size > prev_range * 0.5:
                zones.append(PivotLevel(
                    price=df['Low'].iloc[i],
                    level_type='demand_zone',
                    timeframe='current',
                    timestamp=df.index[i].to_pydatetime(),
                    strength=0.8
                ))
            elif df['Close'].iloc[i] < df['Open'].iloc[i] and body_size > prev_range * 0.5:
                zones.append(PivotLevel(
                    price=df['High'].iloc[i],
                    level_type='supply_zone',
                    timeframe='current',
                    timestamp=df.index[i].to_pydatetime(),
                    strength=0.8
                ))

        return zones

    def get_round_numbers(self, current_price: float, range_pct: float = 0.02) -> List[PivotLevel]:
        """Get nearby round psychological numbers"""
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
                    price=float(level),
                    level_type='round_number',
                    timeframe='all',
                    timestamp=datetime.now(),
                    strength=0.6
                ))

        return levels

# ============================================================================
# VOLUME ANALYZER
# ============================================================================

class VolumeAnalyzer:
    """Analyzes volume for trade confirmation"""

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
            return False, f"🔒 LOCKED: {self.lock_reason}"

        if self.consecutive_losses >= self.max_consecutive_losses:
            self.trading_locked = True
            self.lock_reason = f"Hit {self.max_consecutive_losses} consecutive losses"
            return False, f"❌ {self.lock_reason}"

        if len(self.trades_today) >= self.max_trades_per_day:
            self.trading_locked = True
            self.lock_reason = f"Hit max {self.max_trades_per_day} trades"
            return False, f"❌ {self.lock_reason}"

        if self.daily_pnl <= -self.max_daily_loss:
            self.trading_locked = True
            self.lock_reason = f"Hit daily loss limit ${self.max_daily_loss}"
            return False, f"❌ {self.lock_reason}"

        if self.daily_pnl >= self.daily_target_max:
            return False, f"🎯 Daily target reached: ${self.daily_pnl:.2f}"

        return True, "✅ OK to trade"

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
# PIVOT PETE ENGINE
# ============================================================================

class PivotPeteEngine:
    def __init__(self, symbol: str = "ES"):
        self.symbol = symbol
        self.spec = CONTRACT_SPECS.get(symbol, CONTRACT_SPECS["ES"])

        self.provider = DataProvider(DATA_PROVIDER)
        self.pivot_detector = PivotDetector()
        self.volume_analyzer = VolumeAnalyzer()
        self.risk_manager = RiskManager()

        self.pivot_levels: List[PivotLevel] = []
        self.active_trade: Optional[Trade] = None
        self.higher_tf_bias = "NEUTRAL"

    def fetch_data(self, interval: str) -> pd.DataFrame:
        return self.provider.fetch_candles(self.symbol, interval)

    def analyze_higher_timeframes(self, df_1h: pd.DataFrame, df_daily: pd.DataFrame) -> str:
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

    def update_pivot_levels(self, df_5m: pd.DataFrame, df_1h: pd.DataFrame, df_daily: pd.DataFrame):
        self.pivot_levels = []

        prev_day = self.pivot_detector.get_previous_day_levels(df_5m)
        for name, price in prev_day.items():
            self.pivot_levels.append(PivotLevel(
                price=price, level_type=name, timeframe='daily',
                timestamp=datetime.now(), strength=0.9
            ))

        prev_week = self.pivot_detector.get_previous_week_levels(df_daily)
        for name, price in prev_week.items():
            self.pivot_levels.append(PivotLevel(
                price=price, level_type=name, timeframe='weekly',
                timestamp=datetime.now(), strength=0.95
            ))

        if len(df_daily) >= 2:
            prev = df_daily.iloc[-2]
            pivots = self.pivot_detector.calculate_classic_pivots(prev['High'], prev['Low'], prev['Close'])
            for name, price in pivots.items():
                self.pivot_levels.append(PivotLevel(
                    price=price, level_type=f'pivot_{name}', timeframe='daily',
                    timestamp=datetime.now(), strength=0.85
                ))

        swings = self.pivot_detector.find_swing_points(df_1h, window=3)
        self.pivot_levels.extend(swings)

        zones = self.pivot_detector.identify_supply_demand_zones(df_5m)
        self.pivot_levels.extend(zones[-10:])

        if len(df_5m) > 0:
            current = df_5m['Close'].iloc[-1]
            rounds = self.pivot_detector.get_round_numbers(current)
            self.pivot_levels.extend(rounds)

        self.higher_tf_bias = self.analyze_higher_timeframes(df_1h, df_daily)

    def check_entry_signal(self, current_price: float, df_5m: pd.DataFrame) -> Optional[Dict]:
        can_trade, reason = self.risk_manager.can_trade()
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

    def find_take_profit(self, entry: float, direction: str) -> float:
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

    def execute_trade(self, signal: Dict):
        entry = signal['entry']
        stop = signal['stop']
        direction = signal['direction']
        pivot = signal['pivot']

        size = self.risk_manager.calculate_position_size(self.symbol, entry, stop)
        tp = self.find_take_profit(entry, direction)

        self.active_trade = Trade(
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

        # Fire webhook → executor chain → Alpaca Paper
        action = 'BUY' if direction == 'LONG' else 'SELL'
        fire_signal(
            symbol=self.symbol,
            action=action,
            price=entry,
            stop_loss=stop,
            take_profit=tp,
            reason=f"Pivot rejection @ {pivot.level_type} (${pivot.price:.2f}) | Bias: {self.higher_tf_bias}",
        )

        # Persist active trade state
        save_agent_state('pivot_pete', {
            'active_trade': {
                'symbol': self.symbol, 'entry_price': entry,
                'entry_time': datetime.now().isoformat(), 'direction': direction,
                'stop_loss': stop, 'take_profit': tp, 'size': size,
                'pivot_level': pivot.level_type,
            }
        })

        print(f"\n{'='*50}")
        print(f"TRADE {direction} {self.spec['name']} @ ${entry:.2f}")
        print(f"   Pivot: {pivot.level_type} (${pivot.price:.2f})")
        print(f"   Stop: ${stop:.2f} | TP: ${tp:.2f}")
        print(f"   Size: {size} contract(s)")
        print(f"   Higher TF Bias: {self.higher_tf_bias}")
        print(f"{'='*50}\n")

    def check_exit(self, current_price: float) -> bool:
        if not self.active_trade or self.active_trade.status != 'OPEN':
            return False

        trade = self.active_trade

        if trade.direction == 'LONG' and current_price <= trade.stop_loss:
            self.close_trade(current_price, 'Stop Loss')
            return True
        elif trade.direction == 'SHORT' and current_price >= trade.stop_loss:
            self.close_trade(current_price, 'Stop Loss')
            return True

        if trade.direction == 'LONG' and current_price >= trade.take_profit:
            self.close_trade(current_price, 'Take Profit')
            return True
        elif trade.direction == 'SHORT' and current_price <= trade.take_profit:
            self.close_trade(current_price, 'Take Profit')
            return True

        return False

    def close_trade(self, exit_price: float, reason: str):
        trade = self.active_trade
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

        # Fire EXIT webhook so executor closes the broker position
        fire_signal(
            symbol=self.symbol,
            action='EXIT',
            price=exit_price,
            reason=f"{reason} | PnL: ${trade.pnl:+.2f}",
        )

        outcome = "WIN" if trade.pnl > 0 else "LOSS"
        emoji = "\U0001f3af" if trade.pnl > 0 else "\U0001f6d1"
        log_message('futures', f"{emoji} {outcome}: {self.symbol} ${trade.pnl:+.2f} | {reason}", type='trade')
        print(f"\n{'='*50}")
        print(f"{outcome} CLOSED {trade.direction} @ ${exit_price:.2f}")
        print(f"   Entry: ${trade.entry_price:.2f} → Exit: ${exit_price:.2f}")
        print(f"   P&L: ${trade.pnl:.2f} | Reason: {reason}")
        print(f"   Daily P&L: ${self.risk_manager.daily_pnl:.2f}")

        stats = self.risk_manager.get_stats()
        if stats['consecutive_losses'] > 0:
            print(f"   Consecutive Losses: {stats['consecutive_losses']}/{self.risk_manager.max_consecutive_losses}")
        print(f"{'='*50}\n")

        self.active_trade = None

        # Persist risk state after every trade close
        save_risk_state('pivot_pete', self.risk_manager.get_stats())
        save_agent_state('pivot_pete', {'active_trade': None})

    def get_status(self) -> Dict:
        stats = self.risk_manager.get_stats()
        return {
            'symbol': self.symbol,
            'name': self.spec['name'],
            **stats,
            'pivot_levels': len(self.pivot_levels),
            'higher_tf_bias': self.higher_tf_bias,
            'active_trade': asdict(self.active_trade) if self.active_trade else None,
        }

# ============================================================================
# HELPERS
# ============================================================================

def is_market_hours(now_et: datetime) -> bool:
    if now_et.weekday() >= 5:
        return False
    start = now_et.replace(hour=9, minute=30, second=0, microsecond=0)
    end = now_et.replace(hour=16, minute=0, second=0, microsecond=0)
    return start <= now_et <= end


def write_status(engine: PivotPeteEngine, current_price: float, volume_ratio: float, scan_num: int):
    status = {
        "agent": "Pivot Pete",
        "mode": "PAPER",
        "provider": DATA_PROVIDER,
        "symbol": engine.symbol,
        "generated_at": datetime.now(ET).isoformat(),
        "last_price": float(current_price),
        "volume_ratio": float(round(volume_ratio, 2)),
        "scan": scan_num,
        "pivot_levels_count": len(engine.pivot_levels),
        "higher_tf_bias": engine.higher_tf_bias,
        "risk": engine.risk_manager.get_stats(),
        "active_trade": asdict(engine.active_trade) if engine.active_trade else None,
    }
    out_path = os.path.join(os.getcwd(), "data", "futures_agent_status.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(status, f, indent=2)

# ============================================================================
# MAIN
# ============================================================================

def print_banner():
    print("""
+===============================================================+
|                    PIVOT PETE ENGINE                          |
|            Socrates Investments Methodology                   |
+---------------------------------------------------------------+
|  Strategy: KEY PIVOT LEVELS + VOLUME confirmation             |
|  Risk: Max $4K daily loss | 2 consecutive losses = DONE       |
|  Data: REAL (Oanda or Alpaca) | Mode: PAPER TRADING            |
+===============================================================+
""")


def main():
    print_banner()

    symbol = "ES"
    if len(sys.argv) > 1:
        arg = sys.argv[1].upper()
        if arg in ["ES", "NQ", "GC", "GOLD", "SI"]:
            symbol = "GC" if arg == "GOLD" else arg

    engine = PivotPeteEngine(symbol)

    # ── Restore persisted risk state ─────────────────────────────────────────
    risk_saved = load_risk_state('pivot_pete')
    if risk_saved:
        engine.risk_manager.daily_pnl = risk_saved.get('daily_pnl', 0)
        engine.risk_manager.consecutive_losses = risk_saved.get('consecutive_losses', 0)
        engine.risk_manager.current_capital = risk_saved.get('capital', engine.risk_manager.starting_capital)
        trades_count = risk_saved.get('trades_today', 0)
        # Populate trades_today list with placeholders so count check works
        engine.risk_manager.trades_today = [None] * trades_count
        if risk_saved.get('locked', False):
            engine.risk_manager.trading_locked = True
            engine.risk_manager.lock_reason = risk_saved.get('lock_reason', 'Restored from saved state')

    # ── Restore active trade state ───────────────────────────────────────────
    saved = load_agent_state('pivot_pete')
    if saved.get('active_trade'):
        t = saved['active_trade']
        engine.active_trade = Trade(
            symbol=t['symbol'], entry_price=t['entry_price'],
            entry_time=datetime.fromisoformat(t['entry_time']) if isinstance(t['entry_time'], str) else t['entry_time'],
            direction=t['direction'], stop_loss=t['stop_loss'],
            take_profit=t['take_profit'], size=t.get('size', 1),
            status='OPEN', pivot_level=t.get('pivot_level', 'restored'),
        )
        print(f"[Pete] Restored active trade: {t['direction']} @ ${t['entry_price']:.2f}")

    print(f"Tracking: {engine.spec['name']} ({symbol})")
    print(f"Starting Capital: ${engine.risk_manager.current_capital:,.2f}")
    print(f"Data Provider: {DATA_PROVIDER}\n")
    log_message('futures', get_random_quip('futures'))
    log_message('futures', f"\U0001f680 Pivot Pete online — tracking {engine.spec['name']} ({symbol})")

    iteration = 0
    force_scan = os.getenv("PIVOT_PETE_FORCE_SCAN", "0") == "1"

    while True:
        try:
            now_et = datetime.now(ET)
            if not is_market_hours(now_et) and not force_scan:
                print(f"Outside market hours ({now_et.strftime('%H:%M:%S')} ET). Sleeping 5m...")
                time.sleep(300)
                continue

            iteration += 1
            print(f"\n[{now_et.strftime('%H:%M:%S')}] Scan #{iteration}")

            df_5m = engine.fetch_data("5m")
            df_1h = engine.fetch_data("1h")
            df_daily = engine.fetch_data("1d")

            if df_5m.empty:
                if force_scan:
                    raise RuntimeError("No data received during force scan")
                print("No data received, retrying...")
                time.sleep(60)
                continue

            engine.update_pivot_levels(df_5m, df_1h, df_daily)

            current = df_5m['Close'].iloc[-1]
            volume_ratio = engine.volume_analyzer.get_volume_spike_ratio(df_5m)

            print(f"   Price: ${current:.2f} | Vol: {volume_ratio:.1f}x avg")
            print(f"   Pivots: {len(engine.pivot_levels)} | Bias: {engine.higher_tf_bias}")

            can_trade, reason = engine.risk_manager.can_trade()
            if not can_trade:
                print(f"   {reason}")

            if engine.active_trade:
                print(f"   Open: {engine.active_trade.direction} @ ${engine.active_trade.entry_price:.2f}")
                engine.check_exit(current)
            elif can_trade:
                signal = engine.check_entry_signal(current, df_5m)
                if signal:
                    engine.execute_trade(signal)

            stats = engine.risk_manager.get_stats()
            print(f"   Capital: ${stats['capital']:,.2f} | Daily: ${stats['daily_pnl']:+,.2f} | Trades: {stats['trades_today']}")

            write_status(engine, current, volume_ratio, iteration)
            broadcast_status(engine, iteration, current)

            if force_scan:
                print("\nForce scan complete. Exiting.")
                break

            print(f"\n   Next scan in 5 minutes...")
            time.sleep(300)

        except KeyboardInterrupt:
            print("\n\n🛑 Shutting down Pivot Pete...")
            stats = engine.get_status()
            print(f"\n📊 Final Stats:")
            print(f"   Capital: ${stats['capital']:,.2f}")
            print(f"   Daily P&L: ${stats['daily_pnl']:+,.2f}")
            print(f"   Trades: {stats['trades_today']}")
            break

        except Exception as e:
            print(f"Error: {e}")
            time.sleep(60)


if __name__ == "__main__":
    main()
