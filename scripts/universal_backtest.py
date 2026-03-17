#!/usr/bin/env python3
"""
Universal Backtester — SwjshAlgoKnife
=====================================
Runs any strategy on any symbol over any date range using REAL market data (yfinance).

Usage:
  python scripts/universal_backtest.py --symbol SPY --strategy pivot --from 2025-06-01 --to 2026-03-14 --tf 5m
  python scripts/universal_backtest.py --symbol BTC-USD --strategy bb_squeeze --from 2025-01-01 --to 2026-03-14 --tf 1h
  python scripts/universal_backtest.py --symbol EURUSD=X --strategy vwap --from 2025-09-01 --to 2026-03-14 --tf 15m
  python scripts/universal_backtest.py --symbol SPY --strategy all --from 2025-06-01 --to 2026-03-14 --tf 1d

Strategies:
  pivot        — Multi-timeframe pivot rejection (Pivot Pete)
  orb          — Opening Range Breakout (15m session range)
  bb_squeeze   — Bollinger Band Squeeze & Breakout
  vwap         — VWAP Mean Reversion
  supp_res     — Support/Resistance zone rejection
  all          — Run ALL strategies and compare

Symbols (anything yfinance supports):
  Equities:   SPY, QQQ, AAPL, MSFT, ...
  Futures:    ES=F, NQ=F, YM=F, GC=F, CL=F   (real futures!)
  Crypto:     BTC-USD, ETH-USD, SOL-USD, ...
  Forex:      EURUSD=X, GBPUSD=X, USDJPY=X, ...
  ETFs:       DIA, IWM, TLT, GLD, ...

Timeframes:
  1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo

CSV Mode (offline, no internet needed):
  python scripts/universal_backtest.py --csv data/my_candles.csv --strategy pivot --symbol SPY
  (CSV must have: timestamp/date, open, high, low, close, volume columns)

Output:
  Console summary + JSON report saved to data/backtests/
"""

import argparse
import json
import os
import sys
import math
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

try:
    import yfinance as yf
    import pandas as pd
except ImportError:
    print("ERROR: Missing dependencies. Run:")
    print("  pip install yfinance pandas --break-system-packages")
    sys.exit(1)


# ===============================================================
#  DATA LAYER — Real market data via yfinance
# ===============================================================

def load_csv_candles(csv_path: str) -> pd.DataFrame:
    """Load OHLCV candles from a CSV file. Supports most common formats."""
    print(f"  Loading candles from CSV: {csv_path}")
    df = pd.read_csv(csv_path)

    # Normalize column names (case-insensitive)
    col_map = {}
    for col in df.columns:
        cl = col.lower().strip()
        if cl in ("timestamp", "date", "datetime", "time", "t"):
            col_map[col] = "timestamp"
        elif cl == "open" or cl == "o":
            col_map[col] = "open"
        elif cl == "high" or cl == "h":
            col_map[col] = "high"
        elif cl == "low" or cl == "l":
            col_map[col] = "low"
        elif cl in ("close", "c", "adj close", "adj_close"):
            col_map[col] = "close"
        elif cl in ("volume", "vol", "v"):
            col_map[col] = "volume"

    df = df.rename(columns=col_map)

    required = ["timestamp", "open", "high", "low", "close"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        print(f"  ERROR: CSV missing columns: {missing}")
        print(f"  Found columns: {list(df.columns)}")
        print(f"  Expected: timestamp/date, open, high, low, close, volume")
        sys.exit(1)

    if "volume" not in df.columns:
        df["volume"] = 0

    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.set_index("timestamp").sort_index()
    df = df[["open", "high", "low", "close", "volume"]].dropna()

    print(f"  Got {len(df)} candles ({df.index[0]} -> {df.index[-1]})")
    return df


def fetch_candles(symbol: str, start: str, end: str, interval: str) -> pd.DataFrame:
    """Fetch real OHLCV candles from Yahoo Finance."""
    print(f"  Fetching {symbol} | {interval} | {start} -> {end} ...")

    ticker = yf.Ticker(symbol)

    # yfinance limits intraday history:
    #   1m: 7 days, 2m/5m/15m/30m: 60 days, 60m/90m/1h: 730 days, 1d+: unlimited
    # For long ranges with short intervals, we chunk the requests.
    start_dt = datetime.strptime(start, "%Y-%m-%d")
    end_dt = datetime.strptime(end, "%Y-%m-%d")

    intraday_limits = {
        "1m": 7, "2m": 60, "5m": 60, "15m": 60, "30m": 60,
        "60m": 730, "90m": 730, "1h": 730,
    }

    max_days = intraday_limits.get(interval)
    if max_days and (end_dt - start_dt).days > max_days:
        # Chunk into smaller requests
        frames = []
        chunk_start = start_dt
        while chunk_start < end_dt:
            chunk_end = min(chunk_start + timedelta(days=max_days - 1), end_dt)
            try:
                df = ticker.history(
                    start=chunk_start.strftime("%Y-%m-%d"),
                    end=chunk_end.strftime("%Y-%m-%d"),
                    interval=interval,
                    auto_adjust=True,
                )
                if not df.empty:
                    frames.append(df)
            except Exception as e:
                print(f"  WARNING: chunk {chunk_start} -> {chunk_end} failed: {e}")
            chunk_start = chunk_end + timedelta(days=1)

        if not frames:
            print(f"  ERROR: No data returned for {symbol}")
            sys.exit(1)
        df = pd.concat(frames)
    else:
        df = ticker.history(start=start, end=end, interval=interval, auto_adjust=True)

    if df.empty:
        print(f"  ERROR: No data returned for {symbol} ({start} -> {end}, {interval})")
        print(f"  Check: is '{symbol}' a valid yfinance symbol?")
        sys.exit(1)

    # Standardize columns
    df = df.rename(columns={"Open": "open", "High": "high", "Low": "low", "Close": "close", "Volume": "volume"})
    df = df[["open", "high", "low", "close", "volume"]].dropna()
    df.index.name = "timestamp"

    print(f"  Got {len(df)} candles ({df.index[0]} -> {df.index[-1]})")
    return df


# ===============================================================
#  STRATEGY ENGINE — Pure Python implementations
# ===============================================================

class BacktestSignal:
    """A trade signal emitted by a strategy."""
    def __init__(self, timestamp, symbol, action, price, strategy, stop_loss=None, take_profit=None, notes=""):
        self.timestamp = timestamp
        self.symbol = symbol
        self.action = action        # BUY | SELL
        self.price = price
        self.strategy = strategy
        self.stop_loss = stop_loss
        self.take_profit = take_profit
        self.notes = notes


class PivotStrategy:
    """Multi-timeframe pivot rejection. Uses daily/weekly/monthly pivots from real OHLC."""
    name = "pivot"
    display_name = "Pivot Pete — Multi-TF Pivot Rejection"

    def __init__(self, tolerance_pct=0.0008, min_confluence=1, risk_pct=0.003, rr=2.0):
        self.tolerance_pct = tolerance_pct
        self.min_confluence = min_confluence
        self.risk_pct = risk_pct
        self.rr = rr

        self.current_day = None
        self.current_week = None
        self.current_month = None

        self.day_agg = None
        self.week_agg = None
        self.month_agg = None

        self.daily_pivots = None
        self.weekly_pivots = None
        self.monthly_pivots = None

    @staticmethod
    def _compute_pivots(agg):
        h, l, c = agg["high"], agg["low"], agg["close"]
        P = (h + l + c) / 3
        return {
            "P": P,
            "R1": 2 * P - l, "R2": P + (h - l), "R3": h + 2 * (P - l),
            "S1": 2 * P - h, "S2": P - (h - l), "S3": l - 2 * (h - P),
        }

    def on_candle(self, ts, o, h, l, c, v, symbol):
        day_key = ts.strftime("%Y-%m-%d")
        week_key = f"{ts.isocalendar()[0]}-W{ts.isocalendar()[1]:02d}"
        month_key = ts.strftime("%Y-%m")

        def new_agg():
            return {"open": o, "high": h, "low": l, "close": c}

        def update_agg(agg):
            agg["high"] = max(agg["high"], h)
            agg["low"] = min(agg["low"], l)
            agg["close"] = c

        # Initialize
        if self.current_day is None:
            self.current_day = day_key
            self.current_week = week_key
            self.current_month = month_key
            self.day_agg = new_agg()
            self.week_agg = new_agg()
            self.month_agg = new_agg()
            return None

        # Rollovers
        if day_key != self.current_day:
            self.daily_pivots = self._compute_pivots(self.day_agg)
            self.current_day = day_key
            self.day_agg = new_agg()
        else:
            update_agg(self.day_agg)

        if week_key != self.current_week:
            self.weekly_pivots = self._compute_pivots(self.week_agg)
            self.current_week = week_key
            self.week_agg = new_agg()
        else:
            update_agg(self.week_agg)

        if month_key != self.current_month:
            self.monthly_pivots = self._compute_pivots(self.month_agg)
            self.current_month = month_key
            self.month_agg = new_agg()
        else:
            update_agg(self.month_agg)

        # Collect all pivot levels
        levels = []
        for pset in [self.daily_pivots, self.weekly_pivots, self.monthly_pivots]:
            if pset:
                levels.extend(pset.values())

        if not levels:
            return None

        tol = max(0.01, c * self.tolerance_pct)
        near = [lvl for lvl in levels if abs(lvl - c) <= tol or (l <= lvl <= h)]

        if len(near) < self.min_confluence:
            return None

        bullish = l <= min(near) and c > o
        bearish = h >= max(near) and c < o

        if not bullish and not bearish:
            return None

        action = "BUY" if bullish else "SELL"
        risk = c * self.risk_pct
        sl = c - risk if bullish else c + risk
        tp = c + risk * self.rr if bullish else c - risk * self.rr

        return BacktestSignal(ts, symbol, action, c, self.name, sl, tp,
                              f"Pivot confluence={len(near)}")


class ORBStrategy:
    """Opening Range Breakout — first 15 minutes of session."""
    name = "orb"
    display_name = "Opening Range Breakout (15m)"

    def __init__(self, session_start_hour=9, session_start_min=30, orb_duration=15, rr=2.0):
        self.session_start_hour = session_start_hour
        self.session_start_min = session_start_min
        self.orb_duration = orb_duration
        self.rr = rr

        self.current_date = None
        self.orb_high = None
        self.orb_low = None
        self.orb_candles = 0
        self.traded_today = False

    def on_candle(self, ts, o, h, l, c, v, symbol):
        day = ts.strftime("%Y-%m-%d")
        if day != self.current_date:
            self.current_date = day
            self.orb_high = None
            self.orb_low = None
            self.orb_candles = 0
            self.traded_today = False

        hour, minute = ts.hour, ts.minute
        session_start = self.session_start_hour * 60 + self.session_start_min
        current_min = hour * 60 + minute

        # Building ORB range
        if session_start <= current_min < session_start + self.orb_duration:
            self.orb_high = max(self.orb_high or h, h)
            self.orb_low = min(self.orb_low or l, l)
            self.orb_candles += 1
            return None

        # After ORB, check for breakout
        if self.orb_high is None or self.traded_today:
            return None

        orb_range = self.orb_high - self.orb_low
        if orb_range <= 0:
            return None

        if c > self.orb_high:
            self.traded_today = True
            sl = self.orb_low
            tp = c + orb_range * self.rr
            return BacktestSignal(ts, symbol, "BUY", c, self.name, sl, tp,
                                  f"ORB breakout HIGH ({self.orb_high:.2f})")

        if c < self.orb_low:
            self.traded_today = True
            sl = self.orb_high
            tp = c - orb_range * self.rr
            return BacktestSignal(ts, symbol, "SELL", c, self.name, sl, tp,
                                  f"ORB breakdown LOW ({self.orb_low:.2f})")

        return None


class BBSqueezeStrategy:
    """Bollinger Band Squeeze and Breakout detection."""
    name = "bb_squeeze"
    display_name = "Bollinger Band Squeeze & Breakout"

    def __init__(self, period=20, squeeze_threshold=0.04, rr=2.0):
        self.period = period
        self.squeeze_threshold = squeeze_threshold
        self.rr = rr
        self.prices = []
        self.is_squeezed = False

    def on_candle(self, ts, o, h, l, c, v, symbol):
        self.prices.append(c)
        if len(self.prices) > self.period:
            self.prices.pop(0)
        if len(self.prices) < self.period:
            return None

        sma = sum(self.prices) / self.period
        variance = sum((p - sma) ** 2 for p in self.prices) / self.period
        std_dev = math.sqrt(variance)

        upper = sma + std_dev * 2
        lower = sma - std_dev * 2
        bandwidth = (upper - lower) / sma if sma > 0 else 0

        if bandwidth < self.squeeze_threshold:
            self.is_squeezed = True

        if self.is_squeezed:
            risk = abs(c - sma)
            if risk < 0.001:
                return None

            if c > upper:
                self.is_squeezed = False
                sl = sma
                tp = c + risk * self.rr
                return BacktestSignal(ts, symbol, "BUY", c, self.name, sl, tp,
                                      f"BB squeeze breakout UP (bw={bandwidth:.4f})")
            if c < lower:
                self.is_squeezed = False
                sl = sma
                tp = c - risk * self.rr
                return BacktestSignal(ts, symbol, "SELL", c, self.name, sl, tp,
                                      f"BB squeeze breakout DOWN (bw={bandwidth:.4f})")

        return None


class VWAPStrategy:
    """VWAP Mean Reversion — trades deviation from volume-weighted average."""
    name = "vwap"
    display_name = "VWAP Mean Reversion"

    def __init__(self, threshold_pct=1.5, rr=2.0):
        self.threshold_pct = threshold_pct
        self.rr = rr
        self.vwap_sum = 0
        self.volume_sum = 0
        self.session_date = None

    def on_candle(self, ts, o, h, l, c, v, symbol):
        day = ts.strftime("%Y-%m-%d")
        if day != self.session_date:
            self.session_date = day
            self.vwap_sum = 0
            self.volume_sum = 0

        self.vwap_sum += c * v
        self.volume_sum += v

        if self.volume_sum == 0:
            return None

        vwap = self.vwap_sum / self.volume_sum
        deviation = ((c - vwap) / vwap) * 100 if vwap > 0 else 0

        risk = abs(c - vwap)
        if risk < 0.001:
            return None

        if deviation < -self.threshold_pct:
            sl = c - risk
            tp = vwap  # Target is the VWAP itself (mean reversion)
            return BacktestSignal(ts, symbol, "BUY", c, self.name, sl, tp,
                                  f"VWAP reversion LONG (dev={deviation:.2f}%)")

        if deviation > self.threshold_pct:
            sl = c + risk
            tp = vwap
            return BacktestSignal(ts, symbol, "SELL", c, self.name, sl, tp,
                                  f"VWAP reversion SHORT (dev={deviation:.2f}%)")

        return None


class SuppResStrategy:
    """Support/Resistance zone detection and rejection trades."""
    name = "supp_res"
    display_name = "Support & Resistance Rejection"

    def __init__(self, lookback=50, zone_tolerance_pct=0.3, min_touches=2, rr=2.0):
        self.lookback = lookback
        self.zone_tolerance_pct = zone_tolerance_pct
        self.min_touches = min_touches
        self.rr = rr
        self.highs = []
        self.lows = []
        self.last_action = None

    def on_candle(self, ts, o, h, l, c, v, symbol):
        self.highs.append(h)
        self.lows.append(l)
        if len(self.highs) > self.lookback:
            self.highs.pop(0)
            self.lows.pop(0)
        if len(self.highs) < 10:
            return None

        # Find levels with multiple touches
        all_levels = self.highs + self.lows
        zones = self._cluster_levels(all_levels, c * self.zone_tolerance_pct / 100)

        for zone_price, touches, zone_type in zones:
            if touches < self.min_touches:
                continue

            dist_pct = abs(c - zone_price) / zone_price * 100 if zone_price > 0 else 999
            if dist_pct > self.zone_tolerance_pct:
                continue

            risk = abs(c - zone_price) + c * 0.001  # buffer
            if risk < 0.001:
                continue

            # Support bounce
            if zone_type == "support" and c > zone_price and c > o and self.last_action != "BUY":
                self.last_action = "BUY"
                sl = zone_price - risk * 0.5
                tp = c + risk * self.rr
                return BacktestSignal(ts, symbol, "BUY", c, self.name, sl, tp,
                                      f"Support rejection at {zone_price:.2f} ({touches} touches)")

            # Resistance rejection
            if zone_type == "resistance" and c < zone_price and c < o and self.last_action != "SELL":
                self.last_action = "SELL"
                sl = zone_price + risk * 0.5
                tp = c - risk * self.rr
                return BacktestSignal(ts, symbol, "SELL", c, self.name, sl, tp,
                                      f"Resistance rejection at {zone_price:.2f} ({touches} touches)")

        return None

    def _cluster_levels(self, levels, tolerance):
        if not levels or tolerance <= 0:
            return []

        sorted_levels = sorted(levels)
        clusters = []
        current_cluster = [sorted_levels[0]]

        for lvl in sorted_levels[1:]:
            if lvl - current_cluster[0] <= tolerance:
                current_cluster.append(lvl)
            else:
                avg = sum(current_cluster) / len(current_cluster)
                zone_type = "support" if avg < sum(sorted_levels) / len(sorted_levels) else "resistance"
                clusters.append((avg, len(current_cluster), zone_type))
                current_cluster = [lvl]

        if current_cluster:
            avg = sum(current_cluster) / len(current_cluster)
            zone_type = "support" if avg < sum(sorted_levels) / len(sorted_levels) else "resistance"
            clusters.append((avg, len(current_cluster), zone_type))

        return sorted(clusters, key=lambda x: -x[1])  # Most touches first


STRATEGIES = {
    "pivot": PivotStrategy,
    "orb": ORBStrategy,
    "bb_squeeze": BBSqueezeStrategy,
    "vwap": VWAPStrategy,
    "supp_res": SuppResStrategy,
}


# ===============================================================
#  PAPER TRADING ENGINE — Simulated execution with slippage
# ===============================================================

class PaperTrader:
    """Simulates trade execution with slippage and SL/TP management."""

    # Slippage as fraction of price
    SLIPPAGE_MAP = {
        "futures": 0.00005,   # ~$0.25 on ES
        "forex":   0.00002,   # ~0.2 pips
        "crypto":  0.0001,    # ~$9 on BTC
        "equity":  0.0001,    # ~$0.05 on SPY
    }

    def __init__(self, balance=100_000, risk_pct=0.01, asset_class="equity"):
        self.starting_balance = balance
        self.balance = balance
        self.risk_pct = risk_pct
        self.asset_class = asset_class
        self.slippage_rate = self.SLIPPAGE_MAP.get(asset_class, 0.0001)

        self.open_trade = None
        self.closed_trades = []
        self.peak_balance = balance
        self.max_drawdown = 0

    def _detect_asset_class(self, symbol):
        s = symbol.upper()
        if "=F" in s:
            return "futures"
        if "=X" in s or any(fx in s for fx in ["EUR", "GBP", "JPY", "AUD", "CHF", "CAD", "NZD"]):
            return "forex"
        if s.endswith("-USD") or s in ["BTC", "ETH", "SOL", "DOGE"]:
            return "crypto"
        return "equity"

    def process_signal(self, signal: BacktestSignal):
        """Process an entry signal."""
        if self.open_trade is not None:
            return  # One trade at a time

        slip = signal.price * self.slippage_rate
        fill = signal.price + slip if signal.action == "BUY" else signal.price - slip

        # Position size based on risk
        if signal.stop_loss:
            risk_per_unit = abs(fill - signal.stop_loss)
            if risk_per_unit > 0:
                risk_amount = self.balance * self.risk_pct
                qty = risk_amount / risk_per_unit
            else:
                qty = 1
        else:
            qty = 1

        self.open_trade = {
            "symbol": signal.symbol,
            "side": "LONG" if signal.action == "BUY" else "SHORT",
            "entry_price": fill,
            "entry_time": str(signal.timestamp),
            "stop_loss": signal.stop_loss,
            "take_profit": signal.take_profit,
            "qty": qty,
            "strategy": signal.strategy,
            "notes": signal.notes,
        }

    def update_price(self, timestamp, high, low, close):
        """Check SL/TP hits on the current open trade."""
        if self.open_trade is None:
            return

        t = self.open_trade
        side = t["side"]

        # Check stop loss
        if t["stop_loss"] is not None:
            hit_sl = (side == "LONG" and low <= t["stop_loss"]) or \
                     (side == "SHORT" and high >= t["stop_loss"])
            if hit_sl:
                self._close_trade(t["stop_loss"], str(timestamp), "STOP")
                return

        # Check take profit
        if t["take_profit"] is not None:
            hit_tp = (side == "LONG" and high >= t["take_profit"]) or \
                     (side == "SHORT" and low <= t["take_profit"])
            if hit_tp:
                self._close_trade(t["take_profit"], str(timestamp), "TAKE_PROFIT")
                return

    def _close_trade(self, exit_price, exit_time, reason):
        t = self.open_trade
        slip = exit_price * self.slippage_rate
        fill = exit_price - slip if t["side"] == "LONG" else exit_price + slip

        pnl = (fill - t["entry_price"]) * t["qty"] if t["side"] == "LONG" \
            else (t["entry_price"] - fill) * t["qty"]

        risk = abs(t["entry_price"] - t["stop_loss"]) * t["qty"] if t["stop_loss"] else 1
        rr = pnl / risk if risk > 0 else 0

        entry_dt = pd.Timestamp(t["entry_time"])
        exit_dt = pd.Timestamp(exit_time)
        duration = (exit_dt - entry_dt).total_seconds() / 60

        self.closed_trades.append({
            "symbol": t["symbol"],
            "side": t["side"],
            "strategy": t["strategy"],
            "entry_price": round(t["entry_price"], 5),
            "exit_price": round(fill, 5),
            "entry_time": t["entry_time"],
            "exit_time": exit_time,
            "stop_loss": t["stop_loss"],
            "take_profit": t["take_profit"],
            "qty": round(t["qty"], 4),
            "pnl": round(pnl, 2),
            "rr": round(rr, 2),
            "reason": reason,
            "duration_min": round(duration, 1),
            "notes": t["notes"],
        })

        self.balance += pnl
        self.peak_balance = max(self.peak_balance, self.balance)
        dd = (self.peak_balance - self.balance) / self.peak_balance if self.peak_balance > 0 else 0
        self.max_drawdown = max(self.max_drawdown, dd)

        self.open_trade = None

    def force_close(self, close_price, timestamp):
        """Force close any open trade at end of backtest."""
        if self.open_trade:
            self._close_trade(close_price, str(timestamp), "FORCE_CLOSE")

    def get_metrics(self):
        trades = self.closed_trades
        n = len(trades)
        if n == 0:
            return {
                "total_trades": 0, "win_rate": 0, "total_pnl": 0,
                "profit_factor": 0, "max_drawdown": 0, "sharpe": 0,
                "avg_rr": 0, "avg_duration_min": 0, "return_pct": 0,
            }

        wins = [t for t in trades if t["pnl"] > 0]
        losses = [t for t in trades if t["pnl"] <= 0]
        total_pnl = sum(t["pnl"] for t in trades)
        gross_profit = sum(t["pnl"] for t in wins)
        gross_loss = abs(sum(t["pnl"] for t in losses))
        pf = gross_profit / gross_loss if gross_loss > 0 else (float("inf") if gross_profit > 0 else 0)

        # Sharpe (daily returns approximation)
        returns = [t["pnl"] / self.starting_balance for t in trades]
        avg_ret = sum(returns) / len(returns) if returns else 0
        std_ret = math.sqrt(sum((r - avg_ret) ** 2 for r in returns) / len(returns)) if len(returns) > 1 else 0
        sharpe = (avg_ret / std_ret) * math.sqrt(252) if std_ret > 0 else 0

        avg_rr = sum(t["rr"] for t in trades) / n
        avg_dur = sum(t["duration_min"] for t in trades) / n

        return {
            "total_trades": n,
            "wins": len(wins),
            "losses": len(losses),
            "win_rate": round(len(wins) / n * 100, 1),
            "total_pnl": round(total_pnl, 2),
            "profit_factor": round(pf, 2) if pf != float("inf") else "Infinity",
            "max_drawdown_pct": round(self.max_drawdown * 100, 2),
            "sharpe_ratio": round(sharpe, 2),
            "avg_rr": round(avg_rr, 2),
            "avg_duration_min": round(avg_dur, 1),
            "return_pct": round((self.balance - self.starting_balance) / self.starting_balance * 100, 2),
            "final_balance": round(self.balance, 2),
        }


# ===============================================================
#  BACKTEST RUNNER
# ===============================================================

def run_backtest(symbol, strategy_name, strategy_instance, df, balance, risk_pct):
    """Run a single strategy backtest and return results."""
    asset_class = "futures" if "=F" in symbol else \
                  "forex" if "=X" in symbol else \
                  "crypto" if "-USD" in symbol else "equity"

    trader = PaperTrader(balance=balance, risk_pct=risk_pct, asset_class=asset_class)

    signals_emitted = 0

    for idx, row in df.iterrows():
        ts = idx.to_pydatetime() if hasattr(idx, "to_pydatetime") else idx
        o, h, l, c, v = row["open"], row["high"], row["low"], row["close"], row["volume"]

        # Update open positions with OHLC (check SL/TP)
        trader.update_price(ts, h, l, c)

        # Run strategy
        signal = strategy_instance.on_candle(ts, o, h, l, c, v, symbol)
        if signal:
            signals_emitted += 1
            trader.process_signal(signal)

    # Force close any open position at backtest end
    if not df.empty:
        last = df.iloc[-1]
        trader.force_close(last["close"], df.index[-1])

    metrics = trader.get_metrics()
    metrics["signals_emitted"] = signals_emitted

    return metrics, trader.closed_trades


def print_results(symbol, strategy_name, display_name, start, end, interval, metrics, candle_count):
    """Print formatted backtest results to console."""
    print(f"\n{'=' * 60}")
    print(f"  BACKTEST RESULTS")
    print(f"  Strategy:   {display_name}")
    print(f"  Symbol:     {symbol}")
    print(f"  Period:     {start} -> {end} ({interval})")
    print(f"  Candles:    {candle_count:,}")
    print(f"{'=' * 60}")
    print(f"  Signals:       {metrics.get('signals_emitted', 0)}")
    print(f"  Total Trades:  {metrics['total_trades']}")

    if metrics["total_trades"] == 0:
        print(f"  (No trades generated — strategy may need different params or timeframe)")
        print(f"{'=' * 60}\n")
        return

    print(f"  Wins / Losses: {metrics.get('wins', 0)} / {metrics.get('losses', 0)}")
    print(f"  Win Rate:      {metrics['win_rate']}%")
    print(f"  Total PnL:     ${metrics['total_pnl']:,.2f}")
    print(f"  Return:        {metrics['return_pct']}%")
    print(f"  Profit Factor: {metrics['profit_factor']}")
    print(f"  Max Drawdown:  {metrics['max_drawdown_pct']}%")
    print(f"  Sharpe Ratio:  {metrics['sharpe_ratio']}")
    print(f"  Avg R:R:       {metrics['avg_rr']}")
    print(f"  Avg Duration:  {metrics['avg_duration_min']} min")
    print(f"  Final Balance: ${metrics['final_balance']:,.2f}")
    print(f"{'=' * 60}\n")


def main():
    parser = argparse.ArgumentParser(description="SwjshAK Universal Backtester — Real Market Data")
    parser.add_argument("--symbol", required=True, help="yfinance symbol (SPY, ES=F, BTC-USD, EURUSD=X, ...)")
    parser.add_argument("--strategy", required=True, help="Strategy: pivot, orb, bb_squeeze, vwap, supp_res, all")
    parser.add_argument("--from", dest="start", default=None, help="Start date YYYY-MM-DD (required unless using --csv)")
    parser.add_argument("--to", dest="end", default=None, help="End date YYYY-MM-DD (required unless using --csv)")
    parser.add_argument("--csv", dest="csv_path", default=None, help="Path to CSV file with OHLCV data (skips yfinance)")
    parser.add_argument("--tf", default="1d", help="Timeframe: 1m,5m,15m,30m,1h,1d,1wk (default: 1d)")
    parser.add_argument("--balance", type=float, default=100000, help="Starting balance (default: 100000)")
    parser.add_argument("--risk", type=float, default=0.01, help="Risk per trade as decimal (default: 0.01 = 1%%)")
    parser.add_argument("--out", help="Custom output path for JSON results")
    args = parser.parse_args()

    symbol = args.symbol
    start = args.start
    end = args.end
    interval = args.tf
    balance = args.balance
    risk_pct = args.risk

    print(f"\n  SwjshAK Universal Backtester")
    print(f"  Real market data via yfinance")
    print(f"{'-' * 50}")

    # Fetch data — CSV or yfinance
    if args.csv_path:
        df = load_csv_candles(args.csv_path)
        if not start:
            start = str(df.index[0].date()) if not df.empty else "N/A"
        if not end:
            end = str(df.index[-1].date()) if not df.empty else "N/A"
        interval = "csv"
    else:
        if not start or not end:
            print("  ERROR: --from and --to are required when not using --csv")
            sys.exit(1)
        df = fetch_candles(symbol, start, end, interval)

    # Determine which strategies to run
    if args.strategy == "all":
        strats_to_run = list(STRATEGIES.keys())
    elif args.strategy in STRATEGIES:
        strats_to_run = [args.strategy]
    else:
        print(f"\n  ERROR: Unknown strategy '{args.strategy}'")
        print(f"  Available: {', '.join(STRATEGIES.keys())}, all")
        sys.exit(1)

    all_results = {}

    for strat_name in strats_to_run:
        strat_cls = STRATEGIES[strat_name]
        strat_instance = strat_cls()

        metrics, trades = run_backtest(symbol, strat_name, strat_instance, df, balance, risk_pct)
        print_results(symbol, strat_name, strat_instance.display_name,
                      start, end, interval, metrics, len(df))

        all_results[strat_name] = {
            "strategy": strat_instance.display_name,
            "metrics": metrics,
            "trades": trades[-20:],  # Last 20 trades for review
        }

    # Compare table if running all
    if len(strats_to_run) > 1:
        print(f"\n{'=' * 80}")
        print(f"  STRATEGY COMPARISON — {symbol} ({start} -> {end}, {interval})")
        print(f"{'=' * 80}")
        print(f"  {'Strategy':<30} {'Trades':>7} {'WinRate':>8} {'PnL':>12} {'PF':>6} {'MaxDD':>7} {'Sharpe':>7}")
        print(f"  {'-' * 78}")
        for name in strats_to_run:
            r = all_results[name]
            m = r["metrics"]
            pf_str = str(m["profit_factor"])
            print(f"  {r['strategy']:<30} {m['total_trades']:>7} {m['win_rate']:>7.1f}% ${m['total_pnl']:>10,.2f} {pf_str:>6} {m['max_drawdown_pct']:>6.1f}% {m['sharpe_ratio']:>7.2f}")
        print(f"{'=' * 80}\n")

    # Save JSON output
    out_dir = Path(os.getcwd()) / "data" / "backtests"
    out_dir.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    out_path = args.out or str(out_dir / f"{symbol}_{args.strategy}_{run_id}.json")

    report = {
        "run_id": run_id,
        "generated_at": datetime.now().isoformat(),
        "params": {
            "symbol": symbol,
            "strategy": args.strategy,
            "start": start,
            "end": end,
            "interval": interval,
            "balance": balance,
            "risk_pct": risk_pct,
        },
        "data": {
            "source": "yfinance (real market data)",
            "candle_count": len(df),
            "first_candle": str(df.index[0]) if not df.empty else None,
            "last_candle": str(df.index[-1]) if not df.empty else None,
        },
        "results": all_results,
    }

    with open(out_path, "w") as f:
        json.dump(report, f, indent=2, default=str)

    print(f"  JSON report saved: {out_path}")

    # Generate HTML and Markdown reports
    try:
        import sys
        sys.path.insert(0, str(Path(__file__).parent))
        from backtest_report import generate_html_report, generate_markdown_report

        html_path = Path(out_path).with_suffix('.html')
        md_path = Path(out_path).with_suffix('.md')

        generate_html_report(report, str(html_path))
        generate_markdown_report(report, str(md_path))

        print(f"  HTML report: file://{html_path.absolute()}")
    except Exception as e:
        print(f"  (HTML report generation skipped: {e})")

    print(f"  Data source:  yfinance (REAL market data)")
    print()


if __name__ == "__main__":
    main()
