#!/usr/bin/env python3
"""
Gold-DXY Mismatch Retracement Engine (PAPER ONLY)

Strategy:
- Monitor DXY (Dollar Index) and Gold for correlation mismatches
- When DXY makes a big move (Z-score > 1.5) while Gold stays sideways (Z-score < 0.5)
- Track the mismatch state and wait for DXY retracement (20-50% of move)
- Fire Gold signal in OPPOSITE direction to the original DXY move
- Skip signals when correlation breaks down (> -0.3)

Risk Rules (STRICT):
- Max daily loss: $3,000
- 2 consecutive losses = DONE FOR DAY
- Max 3 trades per day (high conviction strategy)

Data: REAL market data only (yfinance or Oanda)
"""

import os
import json
import time
import sys
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional

from dotenv import load_dotenv
import requests
import pandas as pd
import numpy as np
from agent_utils import (
    log_message,
    get_random_quip,
    save_agent_state,
    load_agent_state,
    save_risk_state,
    load_risk_state,
    call_preflight,
    should_take_trade,
    get_size_multiplier,
    send_feedback,
)
import pytz

load_dotenv(os.path.join(os.getcwd(), '.env.local'))

# ============================================================================
# CONFIGURATION
# ============================================================================

WEBHOOK_URL = "http://localhost:3000/api/webhook/tradingview"
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET")
if not WEBHOOK_SECRET:
    raise RuntimeError("WEBHOOK_SECRET environment variable is required")

ET = pytz.timezone("America/New_York")

DATA_PROVIDER = os.getenv("GOLD_DXY_DATA_PROVIDER", "YFINANCE").upper()

# Strategy Parameters
DXY_PUSH_THRESHOLD = 1.5       # Z-score threshold for DXY "big move"
GOLD_SIDEWAYS_THRESHOLD = 0.5  # Z-score threshold for Gold "sideways"
RETRACEMENT_MIN = 0.20         # Minimum retracement (20%)
RETRACEMENT_MAX = 0.50         # Maximum retracement (50%)
CORRELATION_THRESHOLD = -0.30  # Skip if correlation > this (breakdown)
LOOKBACK_PERIOD = 20           # Rolling window for Z-scores and correlation

# Symbol mappings
YFINANCE_SYMBOLS = {
    "DXY": "DX-Y.NYB",   # Dollar Index
    "GOLD": "GC=F",       # Gold Futures
}

OANDA_SYMBOLS = {
    "DXY": None,          # No direct DXY on OANDA, use proxy or yfinance fallback
    "GOLD": "XAU_USD",    # Gold CFD
}

# Contract specifications
CONTRACT_SPECS = {
    "GOLD": {"point_value": 100, "tick_size": 0.10, "name": "Gold", "pip_value": 10},
}

# ============================================================================
# DATA PROVIDERS
# ============================================================================

class DataProvider:
    """Fetches candle data from yfinance or OANDA"""

    def __init__(self, provider: str):
        self.provider = provider

    def fetch_candles(self, symbol: str, interval: str, count: int = 100) -> pd.DataFrame:
        """Fetch OHLCV candles for the given symbol and interval"""
        if self.provider == "YFINANCE":
            return self._fetch_yfinance(symbol, interval, count)
        elif self.provider == "OANDA":
            return self._fetch_oanda(symbol, interval, count)
        raise ValueError(f"Unsupported provider: {self.provider}")

    def _fetch_yfinance(self, symbol: str, interval: str, count: int) -> pd.DataFrame:
        """Fetch data from yfinance"""
        try:
            import yfinance as yf
        except ImportError:
            raise RuntimeError("yfinance not installed. Run: pip install yfinance")

        yf_symbol = YFINANCE_SYMBOLS.get(symbol, symbol)

        # Map interval to yfinance format
        interval_map = {
            "5m": "5m",
            "15m": "15m",
            "1h": "1h",
            "1d": "1d",
        }
        yf_interval = interval_map.get(interval, interval)

        # Determine period based on interval and count
        if interval in ["5m", "15m"]:
            period = "5d"
        elif interval == "1h":
            period = "30d"
        else:
            period = "90d"

        ticker = yf.Ticker(yf_symbol)
        df = ticker.history(period=period, interval=yf_interval)

        if df.empty:
            return df

        # Standardize column names
        df = df.rename(columns={
            'Open': 'Open',
            'High': 'High',
            'Low': 'Low',
            'Close': 'Close',
            'Volume': 'Volume',
        })

        # Ensure we have a datetime index
        if not isinstance(df.index, pd.DatetimeIndex):
            df.index = pd.to_datetime(df.index)

        return df.tail(count)

    def _fetch_oanda(self, symbol: str, interval: str, count: int) -> pd.DataFrame:
        """Fetch data from OANDA API"""
        api_key = os.getenv("OANDA_API_KEY") or os.getenv("OANDA_API_TOKEN")
        account_id = os.getenv("OANDA_ACCOUNT_ID")
        env = (os.getenv("OANDA_ENVIRONMENT") or "practice").lower()
        base_url = os.getenv("OANDA_BASE_URL") or (
            "https://api-fxpractice.oanda.com" if env == "practice"
            else "https://api-fxtrade.oanda.com"
        )

        if not api_key or not account_id:
            raise RuntimeError("Missing OANDA_API_KEY/OANDA_API_TOKEN or OANDA_ACCOUNT_ID")

        instrument = OANDA_SYMBOLS.get(symbol)
        if not instrument:
            # Fall back to yfinance for DXY
            if symbol == "DXY":
                return self._fetch_yfinance(symbol, interval, count)
            raise RuntimeError(f"No OANDA mapping for symbol {symbol}")

        granularity_map = {
            "5m": "M5",
            "15m": "M15",
            "1h": "H1",
            "1d": "D",
        }
        granularity = granularity_map.get(interval, "H1")

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


# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class MismatchState:
    """Tracks the current DXY-Gold mismatch condition"""
    active: bool
    dxy_direction: str        # 'UP' or 'DOWN'
    dxy_peak_price: float     # DXY price at peak of move
    dxy_start_price: float    # DXY price at start of move
    move_size: float          # Size of DXY move in points
    timestamp: datetime       # When mismatch was detected
    gold_price_at_detect: float  # Gold price when mismatch detected


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
    mismatch_direction: str  # What direction DXY was moving
    exit_price: Optional[float] = None
    exit_time: Optional[datetime] = None
    pnl: Optional[float] = None
    exit_reason: Optional[str] = None
    intel_score_at_entry: Optional[float] = None
    intel_decision_at_entry: Optional[str] = None


# ============================================================================
# WEBHOOK / STATUS
# ============================================================================

def fire_signal(
    symbol: str,
    action: str,
    price: float,
    stop_loss: float = None,
    take_profit: float = None,
    reason: str = ""
) -> bool:
    """Send trade signal via webhook to the executor chain"""
    payload = {
        "symbol": symbol,
        "action": action,
        "price": price,
        "strategy": "GoldDXY_Mismatch",
        "stopLoss": stop_loss,
        "takeProfit": take_profit,
        "notes": reason or f"GoldDXY: {action} {symbol} @ {price}",
    }
    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Secret": WEBHOOK_SECRET,
    }
    try:
        resp = requests.post(WEBHOOK_URL, json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            print(f"[GoldDXY] Signal sent: {action} {symbol} @ ${price:.2f}")
            log_message('gold_dxy', f"Signal: {action} {symbol} @ ${price:.2f} | {reason}", type='trade')
            return True
        else:
            print(f"[GoldDXY] Webhook failed {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"[GoldDXY] Webhook error: {e}")
        return False


def broadcast_status(engine: 'GoldDXYMismatchEngine', scan_count: int, dxy_price: float, gold_price: float):
    """Broadcast status update for agent dashboard"""
    stats = engine.risk_manager.get_stats()
    mismatch_status = "ACTIVE" if engine.mismatch_state and engine.mismatch_state.active else "WATCHING"
    corr = engine.last_correlation if engine.last_correlation is not None else 0
    msg = (
        f"DXY: ${dxy_price:.2f} | Gold: ${gold_price:.2f} | "
        f"Corr: {corr:.2f} | Mismatch: {mismatch_status}"
    )
    status_payload = {
        'agentId': 'gold_dxy',
        'status': 'ACTIVE',
        'message': msg,
        'timestamp': datetime.now().isoformat(),
    }
    print(f"AGENT_STATUS_UPDATE:{json.dumps(status_payload)}", flush=True)


# ============================================================================
# Z-SCORE & CORRELATION ANALYZER
# ============================================================================

class MismatchAnalyzer:
    """Analyzes DXY-Gold mismatch conditions"""

    def __init__(self, lookback: int = LOOKBACK_PERIOD):
        self.lookback = lookback

    def calculate_zscore(self, series: pd.Series) -> float:
        """Calculate Z-score for the latest value"""
        if len(series) < self.lookback:
            return 0.0

        window = series.tail(self.lookback)
        mean = window.mean()
        std = window.std()

        if std == 0 or np.isnan(std):
            return 0.0

        current = series.iloc[-1]
        return (current - mean) / std

    def calculate_rolling_zscore(self, df: pd.DataFrame, column: str = 'Close') -> pd.Series:
        """Calculate rolling Z-scores for an entire series"""
        rolling_mean = df[column].rolling(window=self.lookback).mean()
        rolling_std = df[column].rolling(window=self.lookback).std()

        zscore = (df[column] - rolling_mean) / rolling_std
        return zscore.fillna(0)

    def calculate_correlation(
        self,
        dxy_prices: pd.Series,
        gold_prices: pd.Series
    ) -> float:
        """Calculate rolling correlation between DXY and Gold returns"""
        if len(dxy_prices) < self.lookback or len(gold_prices) < self.lookback:
            return -0.5  # Assume normal inverse correlation

        # Use returns for correlation
        dxy_returns = dxy_prices.pct_change().dropna().tail(self.lookback)
        gold_returns = gold_prices.pct_change().dropna().tail(self.lookback)

        if len(dxy_returns) < 5 or len(gold_returns) < 5:
            return -0.5

        # Align the series
        aligned = pd.DataFrame({
            'dxy': dxy_returns.values[:min(len(dxy_returns), len(gold_returns))],
            'gold': gold_returns.values[:min(len(dxy_returns), len(gold_returns))],
        })

        corr = aligned['dxy'].corr(aligned['gold'])
        return corr if not np.isnan(corr) else -0.5

    def detect_mismatch(
        self,
        dxy_df: pd.DataFrame,
        gold_df: pd.DataFrame,
        dxy_threshold: float = DXY_PUSH_THRESHOLD,
        gold_threshold: float = GOLD_SIDEWAYS_THRESHOLD
    ) -> Tuple[bool, str, Dict]:
        """
        Detect if DXY is making a big move while Gold is sideways.

        Returns:
            (is_mismatch, dxy_direction, metadata)
        """
        dxy_zscore = self.calculate_zscore(dxy_df['Close'])
        gold_zscore = self.calculate_zscore(gold_df['Close'])

        # Determine DXY direction based on recent price change
        dxy_recent = dxy_df['Close'].tail(5)
        dxy_direction = 'UP' if dxy_recent.iloc[-1] > dxy_recent.iloc[0] else 'DOWN'

        metadata = {
            'dxy_zscore': dxy_zscore,
            'gold_zscore': gold_zscore,
            'dxy_direction': dxy_direction,
            'dxy_price': dxy_df['Close'].iloc[-1],
            'gold_price': gold_df['Close'].iloc[-1],
        }

        # Check for mismatch: DXY big move (high Z-score) + Gold sideways (low Z-score)
        is_mismatch = (
            abs(dxy_zscore) > dxy_threshold and
            abs(gold_zscore) < gold_threshold
        )

        return is_mismatch, dxy_direction, metadata

    def calculate_retracement(
        self,
        current_price: float,
        peak_price: float,
        start_price: float
    ) -> float:
        """Calculate retracement percentage from peak back towards start"""
        move_size = abs(peak_price - start_price)
        if move_size == 0:
            return 0.0

        retraced = abs(peak_price - current_price)
        return retraced / move_size


# ============================================================================
# RISK MANAGER
# ============================================================================

class RiskManager:
    """Manages daily risk limits and position sizing"""

    def __init__(self, starting_capital: float = 10000):
        self.starting_capital = starting_capital
        self.current_capital = starting_capital

        self.max_daily_loss = 3000
        self.max_consecutive_losses = 2
        self.max_trades_per_day = 3
        self.daily_target_min = 25
        self.daily_target_max = 5000

        self.daily_pnl = 0
        self.trades_today: List[Trade] = []
        self.consecutive_losses = 0
        self.trading_locked = False
        self.lock_reason = ""

    def can_trade(self) -> Tuple[bool, str]:
        """Check if trading is allowed based on risk rules"""
        if self.trading_locked:
            return False, f"LOCKED: {self.lock_reason}"

        if self.consecutive_losses >= self.max_consecutive_losses:
            self.trading_locked = True
            self.lock_reason = f"Hit {self.max_consecutive_losses} consecutive losses"
            return False, f"{self.lock_reason}"

        if len(self.trades_today) >= self.max_trades_per_day:
            self.trading_locked = True
            self.lock_reason = f"Hit max {self.max_trades_per_day} trades"
            return False, f"{self.lock_reason}"

        if self.daily_pnl <= -self.max_daily_loss:
            self.trading_locked = True
            self.lock_reason = f"Hit daily loss limit ${self.max_daily_loss}"
            return False, f"{self.lock_reason}"

        if self.daily_pnl >= self.daily_target_max:
            return False, f"Daily target reached: ${self.daily_pnl:.2f}"

        return True, "OK to trade"

    def calculate_position_size(
        self,
        entry: float,
        stop: float,
        risk_pct: float = 0.02,
        size_multiplier: float = 1.0
    ) -> int:
        """Calculate position size based on risk and intel multiplier"""
        spec = CONTRACT_SPECS["GOLD"]
        point_value = spec["point_value"]

        risk_amount = self.current_capital * risk_pct * size_multiplier
        price_risk = abs(entry - stop)

        if price_risk == 0:
            return 1

        contracts = int(risk_amount / (price_risk * point_value))
        return max(1, min(2, contracts))  # Cap at 2 contracts for this strategy

    def record_trade(self, trade: Trade):
        """Record a completed trade and update stats"""
        self.trades_today.append(trade)

        if trade.pnl is not None:
            self.daily_pnl += trade.pnl
            self.current_capital += trade.pnl

            if trade.pnl < 0:
                self.consecutive_losses += 1
            else:
                self.consecutive_losses = 0

    def reset_daily(self):
        """Reset daily counters"""
        self.daily_pnl = 0
        self.trades_today = []
        self.consecutive_losses = 0
        self.trading_locked = False
        self.lock_reason = ""

    def get_stats(self) -> Dict:
        """Get current risk statistics"""
        return {
            "capital": self.current_capital,
            "daily_pnl": self.daily_pnl,
            "trades_today": len(self.trades_today),
            "consecutive_losses": self.consecutive_losses,
            "locked": self.trading_locked,
            "lock_reason": self.lock_reason,
        }


# ============================================================================
# GOLD-DXY MISMATCH ENGINE
# ============================================================================

class GoldDXYMismatchEngine:
    """Main engine for the Gold-DXY Mismatch strategy"""

    def __init__(self):
        self.provider = DataProvider(DATA_PROVIDER)
        self.analyzer = MismatchAnalyzer(LOOKBACK_PERIOD)
        self.risk_manager = RiskManager()

        self.mismatch_state: Optional[MismatchState] = None
        self.active_trade: Optional[Trade] = None
        self.last_correlation: Optional[float] = None
        self.last_dxy_zscore: float = 0
        self.last_gold_zscore: float = 0

    def fetch_data(self, symbol: str, interval: str = "1h") -> pd.DataFrame:
        """Fetch candle data for a symbol"""
        return self.provider.fetch_candles(symbol, interval, count=100)

    def update_state(self, dxy_df: pd.DataFrame, gold_df: pd.DataFrame) -> Dict:
        """Update mismatch state and correlation"""
        # Calculate correlation
        self.last_correlation = self.analyzer.calculate_correlation(
            dxy_df['Close'], gold_df['Close']
        )

        # Check for mismatch
        is_mismatch, dxy_direction, metadata = self.analyzer.detect_mismatch(
            dxy_df, gold_df
        )

        self.last_dxy_zscore = metadata['dxy_zscore']
        self.last_gold_zscore = metadata['gold_zscore']

        # Update or create mismatch state
        if is_mismatch and not (self.mismatch_state and self.mismatch_state.active):
            # New mismatch detected
            self.mismatch_state = MismatchState(
                active=True,
                dxy_direction=dxy_direction,
                dxy_peak_price=metadata['dxy_price'],
                dxy_start_price=dxy_df['Close'].iloc[-self.analyzer.lookback] if len(dxy_df) >= self.analyzer.lookback else dxy_df['Close'].iloc[0],
                move_size=abs(metadata['dxy_price'] - dxy_df['Close'].iloc[-self.analyzer.lookback]) if len(dxy_df) >= self.analyzer.lookback else 0,
                timestamp=datetime.now(),
                gold_price_at_detect=metadata['gold_price'],
            )
            print(f"\n[GoldDXY] MISMATCH DETECTED!")
            print(f"   DXY Direction: {dxy_direction}")
            print(f"   DXY Z-score: {metadata['dxy_zscore']:.2f}")
            print(f"   Gold Z-score: {metadata['gold_zscore']:.2f}")
            log_message('gold_dxy', f"Mismatch detected: DXY {dxy_direction} (Z: {metadata['dxy_zscore']:.2f})", type='status')

        elif self.mismatch_state and self.mismatch_state.active:
            # Update peak if DXY continues in same direction
            if self.mismatch_state.dxy_direction == 'UP':
                if metadata['dxy_price'] > self.mismatch_state.dxy_peak_price:
                    self.mismatch_state.dxy_peak_price = metadata['dxy_price']
            else:
                if metadata['dxy_price'] < self.mismatch_state.dxy_peak_price:
                    self.mismatch_state.dxy_peak_price = metadata['dxy_price']

        return metadata

    def check_entry_signal(self, dxy_df: pd.DataFrame, gold_df: pd.DataFrame) -> Optional[Dict]:
        """Check if conditions are met for a Gold trade"""
        # Must have an active mismatch state
        if not self.mismatch_state or not self.mismatch_state.active:
            return None

        # Check risk rules
        can_trade, reason = self.risk_manager.can_trade()
        if not can_trade:
            return None

        # Check correlation - skip if relationship has broken down
        if self.last_correlation is not None and self.last_correlation > CORRELATION_THRESHOLD:
            print(f"   Correlation breakdown ({self.last_correlation:.2f} > {CORRELATION_THRESHOLD}). Skipping.")
            return None

        # Check for DXY retracement
        current_dxy = dxy_df['Close'].iloc[-1]
        retracement = self.analyzer.calculate_retracement(
            current_dxy,
            self.mismatch_state.dxy_peak_price,
            self.mismatch_state.dxy_start_price
        )

        if RETRACEMENT_MIN <= retracement <= RETRACEMENT_MAX:
            # Retracement condition met - fire Gold signal
            gold_price = gold_df['Close'].iloc[-1]

            # Gold direction is OPPOSITE to original DXY move
            # If DXY went UP (dollar strong), Gold should have gone DOWN but didn't
            # Now DXY is retracing (weakening) so Gold should catch up and go UP
            gold_direction = 'LONG' if self.mismatch_state.dxy_direction == 'UP' else 'SHORT'

            # Calculate stop and target
            atr = self._calculate_atr(gold_df)
            if gold_direction == 'LONG':
                stop_loss = gold_price - (atr * 1.5)
                take_profit = gold_price + (atr * 2.5)
            else:
                stop_loss = gold_price + (atr * 1.5)
                take_profit = gold_price - (atr * 2.5)

            return {
                'direction': gold_direction,
                'entry': gold_price,
                'stop': stop_loss,
                'take_profit': take_profit,
                'retracement': retracement,
                'dxy_direction': self.mismatch_state.dxy_direction,
            }

        return None

    def _calculate_atr(self, df: pd.DataFrame, period: int = 14) -> float:
        """Calculate Average True Range"""
        if len(df) < period:
            return df['High'].iloc[-1] - df['Low'].iloc[-1]

        high = df['High']
        low = df['Low']
        close = df['Close'].shift(1)

        tr1 = high - low
        tr2 = abs(high - close)
        tr3 = abs(low - close)

        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr = tr.rolling(window=period).mean().iloc[-1]

        return atr if not np.isnan(atr) else (df['High'].iloc[-1] - df['Low'].iloc[-1])

    def execute_trade(self, signal: Dict):
        """Execute a trade based on the signal"""
        entry = signal['entry']
        stop = signal['stop']
        direction = signal['direction']
        tp = signal['take_profit']

        # Call intel preflight
        preflight = call_preflight('gold_dxy', 'XAUUSD', direction, 'GoldDXY_Mismatch')

        if not should_take_trade(preflight):
            print(f"[GoldDXY] Intel says NO_GO. Skipping trade.")
            log_message('gold_dxy', f"Trade blocked by Intel: {preflight.get('reasons', [])}", type='intel')
            return

        size_mult = get_size_multiplier(preflight)
        size = self.risk_manager.calculate_position_size(entry, stop, size_multiplier=size_mult)

        self.active_trade = Trade(
            symbol='XAUUSD',
            entry_price=entry,
            entry_time=datetime.now(),
            direction=direction,
            stop_loss=stop,
            take_profit=tp,
            size=size,
            status='OPEN',
            mismatch_direction=signal['dxy_direction'],
            intel_score_at_entry=preflight.get('intelScore'),
            intel_decision_at_entry=preflight.get('decision'),
        )

        # Fire webhook
        action = 'BUY' if direction == 'LONG' else 'SELL'
        reason = (
            f"DXY {signal['dxy_direction']} mismatch | "
            f"Retracement: {signal['retracement']:.1%} | "
            f"Corr: {self.last_correlation:.2f}"
        )
        fire_signal(
            symbol='XAUUSD',
            action=action,
            price=entry,
            stop_loss=stop,
            take_profit=tp,
            reason=reason,
        )

        # Persist state
        save_agent_state('gold_dxy', {
            'active_trade': asdict(self.active_trade),
            'mismatch_state': asdict(self.mismatch_state) if self.mismatch_state else None,
        })

        # Clear mismatch state after trade entry
        self.mismatch_state = None

        print(f"\n{'='*60}")
        print(f"TRADE {direction} GOLD @ ${entry:.2f}")
        print(f"   DXY Mismatch: {signal['dxy_direction']}")
        print(f"   Retracement: {signal['retracement']:.1%}")
        print(f"   Stop: ${stop:.2f} | TP: ${tp:.2f}")
        print(f"   Size: {size} contract(s)")
        print(f"   Intel: {preflight.get('decision')} (score: {preflight.get('intelScore', 0):.2f})")
        print(f"{'='*60}\n")

    def check_exit(self, gold_df: pd.DataFrame) -> bool:
        """Check if active trade should be closed"""
        if not self.active_trade or self.active_trade.status != 'OPEN':
            return False

        current_price = gold_df['Close'].iloc[-1]
        trade = self.active_trade

        # Check stop loss
        if trade.direction == 'LONG' and current_price <= trade.stop_loss:
            self.close_trade(current_price, 'Stop Loss')
            return True
        elif trade.direction == 'SHORT' and current_price >= trade.stop_loss:
            self.close_trade(current_price, 'Stop Loss')
            return True

        # Check take profit
        if trade.direction == 'LONG' and current_price >= trade.take_profit:
            self.close_trade(current_price, 'Take Profit')
            return True
        elif trade.direction == 'SHORT' and current_price <= trade.take_profit:
            self.close_trade(current_price, 'Take Profit')
            return True

        return False

    def close_trade(self, exit_price: float, reason: str):
        """Close the active trade"""
        trade = self.active_trade
        if not trade:
            return

        trade.exit_price = exit_price
        trade.exit_time = datetime.now()
        trade.status = 'CLOSED'
        trade.exit_reason = reason

        spec = CONTRACT_SPECS['GOLD']
        point_value = spec['point_value']
        if trade.direction == 'LONG':
            points = exit_price - trade.entry_price
        else:
            points = trade.entry_price - exit_price

        trade.pnl = points * point_value * trade.size
        self.risk_manager.record_trade(trade)

        # Fire exit webhook
        fire_signal(
            symbol='XAUUSD',
            action='EXIT',
            price=exit_price,
            reason=f"{reason} | PnL: ${trade.pnl:+.2f}",
        )

        # Send feedback to intel
        outcome = 'WIN' if trade.pnl > 0 else 'LOSS'
        duration = (trade.exit_time - trade.entry_time).total_seconds() / 60
        send_feedback(
            agent_id='gold_dxy',
            symbol='XAUUSD',
            direction=trade.direction,
            outcome=outcome,
            pnl=trade.pnl,
            duration_minutes=duration,
            strategy='GoldDXY_Mismatch',
            intel_score_at_entry=trade.intel_score_at_entry,
            intel_decision_at_entry=trade.intel_decision_at_entry,
        )

        emoji = "TARGET" if trade.pnl > 0 else "STOP"
        log_message('gold_dxy', f"{emoji}: XAUUSD ${trade.pnl:+.2f} | {reason}", type='trade')

        print(f"\n{'='*60}")
        print(f"{outcome} CLOSED {trade.direction} @ ${exit_price:.2f}")
        print(f"   Entry: ${trade.entry_price:.2f} -> Exit: ${exit_price:.2f}")
        print(f"   P&L: ${trade.pnl:.2f} | Reason: {reason}")
        print(f"   Daily P&L: ${self.risk_manager.daily_pnl:.2f}")

        stats = self.risk_manager.get_stats()
        if stats['consecutive_losses'] > 0:
            print(f"   Consecutive Losses: {stats['consecutive_losses']}/{self.risk_manager.max_consecutive_losses}")
        print(f"{'='*60}\n")

        self.active_trade = None

        # Persist state
        save_risk_state('gold_dxy', self.risk_manager.get_stats())
        save_agent_state('gold_dxy', {'active_trade': None, 'mismatch_state': None})

    def get_status(self) -> Dict:
        """Get current engine status"""
        stats = self.risk_manager.get_stats()
        return {
            'symbol': 'XAUUSD',
            'name': 'Gold-DXY Mismatch',
            **stats,
            'correlation': self.last_correlation,
            'dxy_zscore': self.last_dxy_zscore,
            'gold_zscore': self.last_gold_zscore,
            'mismatch_active': self.mismatch_state.active if self.mismatch_state else False,
            'active_trade': asdict(self.active_trade) if self.active_trade else None,
        }


# ============================================================================
# HELPERS
# ============================================================================

def is_market_hours(now_et: datetime) -> bool:
    """Check if within forex/gold trading hours (24/5)"""
    # Forex/Gold trades 24 hours, Sunday 5pm to Friday 5pm ET
    weekday = now_et.weekday()

    # Saturday - closed
    if weekday == 5:
        return False

    # Sunday - opens at 5pm
    if weekday == 6:
        return now_et.hour >= 17

    # Friday - closes at 5pm
    if weekday == 4:
        return now_et.hour < 17

    # Monday-Thursday - open 24 hours
    return True


def write_status(engine: GoldDXYMismatchEngine, dxy_price: float, gold_price: float, scan_num: int):
    """Write status to JSON file"""
    status = {
        "agent": "Gold-DXY Mismatch",
        "mode": "PAPER",
        "provider": DATA_PROVIDER,
        "generated_at": datetime.now(ET).isoformat(),
        "dxy_price": float(dxy_price),
        "gold_price": float(gold_price),
        "correlation": float(engine.last_correlation) if engine.last_correlation else None,
        "dxy_zscore": float(engine.last_dxy_zscore),
        "gold_zscore": float(engine.last_gold_zscore),
        "scan": scan_num,
        "mismatch_active": engine.mismatch_state.active if engine.mismatch_state else False,
        "risk": engine.risk_manager.get_stats(),
        "active_trade": asdict(engine.active_trade) if engine.active_trade else None,
    }
    out_path = os.path.join(os.getcwd(), "data", "gold_dxy_agent_status.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(status, f, indent=2)


# ============================================================================
# MAIN
# ============================================================================

def print_banner():
    print("""
+===============================================================+
|              GOLD-DXY MISMATCH RETRACEMENT ENGINE             |
|                   Correlation Divergence Strategy             |
+---------------------------------------------------------------+
|  Logic: Detect DXY big move + Gold sideways -> retracement    |
|  Risk: Max $3K daily loss | 2 consecutive losses = DONE       |
|  Data: yfinance (DXY) + OANDA (Gold) | Mode: PAPER TRADING    |
+===============================================================+
""")


def main():
    print_banner()

    engine = GoldDXYMismatchEngine()

    # Restore persisted risk state
    risk_saved = load_risk_state('gold_dxy')
    if risk_saved:
        engine.risk_manager.daily_pnl = risk_saved.get('daily_pnl', 0)
        engine.risk_manager.consecutive_losses = risk_saved.get('consecutive_losses', 0)
        engine.risk_manager.current_capital = risk_saved.get('capital', engine.risk_manager.starting_capital)
        trades_count = risk_saved.get('trades_today', 0)
        engine.risk_manager.trades_today = [None] * trades_count
        if risk_saved.get('locked', False):
            engine.risk_manager.trading_locked = True
            engine.risk_manager.lock_reason = risk_saved.get('lock_reason', 'Restored from saved state')

    # Restore active trade state
    saved = load_agent_state('gold_dxy')
    if saved.get('active_trade'):
        t = saved['active_trade']
        engine.active_trade = Trade(
            symbol=t['symbol'],
            entry_price=t['entry_price'],
            entry_time=datetime.fromisoformat(t['entry_time']) if isinstance(t['entry_time'], str) else t['entry_time'],
            direction=t['direction'],
            stop_loss=t['stop_loss'],
            take_profit=t['take_profit'],
            size=t.get('size', 1),
            status='OPEN',
            mismatch_direction=t.get('mismatch_direction', 'UNKNOWN'),
            intel_score_at_entry=t.get('intel_score_at_entry'),
            intel_decision_at_entry=t.get('intel_decision_at_entry'),
        )
        print(f"[GoldDXY] Restored active trade: {t['direction']} @ ${t['entry_price']:.2f}")

    if saved.get('mismatch_state'):
        ms = saved['mismatch_state']
        engine.mismatch_state = MismatchState(
            active=ms['active'],
            dxy_direction=ms['dxy_direction'],
            dxy_peak_price=ms['dxy_peak_price'],
            dxy_start_price=ms['dxy_start_price'],
            move_size=ms['move_size'],
            timestamp=datetime.fromisoformat(ms['timestamp']) if isinstance(ms['timestamp'], str) else ms['timestamp'],
            gold_price_at_detect=ms['gold_price_at_detect'],
        )
        print(f"[GoldDXY] Restored mismatch state: DXY {ms['dxy_direction']}")

    print(f"Tracking: Gold (XAU_USD) vs DXY (Dollar Index)")
    print(f"Starting Capital: ${engine.risk_manager.current_capital:,.2f}")
    print(f"Data Provider: {DATA_PROVIDER}")
    print(f"Strategy Parameters:")
    print(f"   DXY Push Threshold: Z > {DXY_PUSH_THRESHOLD}")
    print(f"   Gold Sideways Threshold: Z < {GOLD_SIDEWAYS_THRESHOLD}")
    print(f"   Retracement Range: {RETRACEMENT_MIN:.0%} - {RETRACEMENT_MAX:.0%}")
    print(f"   Correlation Breakdown: > {CORRELATION_THRESHOLD}\n")

    log_message('gold_dxy', "Gold-DXY Mismatch Engine online. Scanning for divergence...")

    iteration = 0
    force_scan = os.getenv("GOLD_DXY_FORCE_SCAN", "0") == "1"

    while True:
        try:
            now_et = datetime.now(ET)
            if not is_market_hours(now_et) and not force_scan:
                print(f"Outside market hours ({now_et.strftime('%H:%M:%S')} ET). Sleeping 5m...")
                time.sleep(300)
                continue

            iteration += 1
            print(f"\n[{now_et.strftime('%H:%M:%S')}] Scan #{iteration}")

            # Fetch data
            dxy_df = engine.fetch_data("DXY", "1h")
            gold_df = engine.fetch_data("GOLD", "1h")

            if dxy_df.empty or gold_df.empty:
                if force_scan:
                    raise RuntimeError("No data received during force scan")
                print("No data received, retrying...")
                time.sleep(60)
                continue

            # Update state and check conditions
            metadata = engine.update_state(dxy_df, gold_df)
            dxy_price = metadata['dxy_price']
            gold_price = metadata['gold_price']

            print(f"   DXY: ${dxy_price:.2f} (Z: {engine.last_dxy_zscore:+.2f})")
            print(f"   Gold: ${gold_price:.2f} (Z: {engine.last_gold_zscore:+.2f})")
            print(f"   Correlation: {engine.last_correlation:.2f}")

            if engine.mismatch_state and engine.mismatch_state.active:
                current_retracement = engine.analyzer.calculate_retracement(
                    dxy_price,
                    engine.mismatch_state.dxy_peak_price,
                    engine.mismatch_state.dxy_start_price
                )
                print(f"   Mismatch: ACTIVE ({engine.mismatch_state.dxy_direction}) | Retracement: {current_retracement:.1%}")

            can_trade, reason = engine.risk_manager.can_trade()
            if not can_trade:
                print(f"   {reason}")

            # Check for exit on active trade
            if engine.active_trade:
                print(f"   Open: {engine.active_trade.direction} @ ${engine.active_trade.entry_price:.2f}")
                engine.check_exit(gold_df)
            elif can_trade:
                # Check for entry signal
                signal = engine.check_entry_signal(dxy_df, gold_df)
                if signal:
                    engine.execute_trade(signal)

            stats = engine.risk_manager.get_stats()
            print(f"   Capital: ${stats['capital']:,.2f} | Daily: ${stats['daily_pnl']:+,.2f} | Trades: {stats['trades_today']}")

            write_status(engine, dxy_price, gold_price, iteration)
            broadcast_status(engine, iteration, dxy_price, gold_price)

            if force_scan:
                print("\nForce scan complete. Exiting.")
                break

            print(f"\n   Next scan in 5 minutes...")
            time.sleep(300)

        except KeyboardInterrupt:
            print("\n\nShutting down Gold-DXY Mismatch Engine...")
            stats = engine.get_status()
            print(f"\nFinal Stats:")
            print(f"   Capital: ${stats['capital']:,.2f}")
            print(f"   Daily P&L: ${stats['daily_pnl']:+,.2f}")
            print(f"   Trades: {stats['trades_today']}")
            break

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
            time.sleep(60)


if __name__ == "__main__":
    main()
