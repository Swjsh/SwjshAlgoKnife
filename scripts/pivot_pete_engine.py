#!/usr/bin/env python3
"""
Pivot Pete - Futures & Gold Trading Engine
Based on Socrates Investments Pivot Methodology
https://www.youtube.com/watch?v=K3Wh8K1mRY8

Strategy:
- Wait for price to reach KEY PIVOT LEVELS
- Confirm with VOLUME
- Multi-timeframe: Weekly → Daily → 4H → 1H → 5m

Risk Rules (STRICT):
- Max daily loss: $4,000
- 2 consecutive losses = DONE FOR DAY
- Max 4 trades per day
- Daily target: $25 - $5,000

Data: yfinance (free, 15-20min delayed)
"""

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import json
import time
import sys
from dataclasses import dataclass, asdict
from enum import Enum

# ============================================================================
# CONFIGURATION
# ============================================================================

class Symbol(Enum):
    ES = "ES=F"      # S&P 500 E-mini Futures
    NQ = "NQ=F"      # Nasdaq 100 E-mini Futures
    GC = "GC=F"      # Gold Futures
    SI = "SI=F"      # Silver Futures
    DX = "DX-Y.NYB"  # Dollar Index (for correlation)

# Contract specifications
CONTRACT_SPECS = {
    "ES=F": {"point_value": 50, "tick_size": 0.25, "name": "S&P 500 E-mini"},
    "NQ=F": {"point_value": 20, "tick_size": 0.25, "name": "Nasdaq 100 E-mini"},
    "GC=F": {"point_value": 100, "tick_size": 0.10, "name": "Gold"},
    "SI=F": {"point_value": 5000, "tick_size": 0.005, "name": "Silver"},
}

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
            'pivot': pivot,
            'r1': r1, 'r2': r2, 'r3': r3,
            's1': s1, 's2': s2, 's3': s3
        }
    
    def get_previous_day_levels(self, df: pd.DataFrame) -> Dict[str, float]:
        """Get previous day's high, low, close"""
        if len(df) < 2:
            return {}
        
        # Get yesterday's data
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
            # Swing high
            if df['High'].iloc[i] == df['High'].iloc[i-window:i+window+1].max():
                pivots.append(PivotLevel(
                    price=df['High'].iloc[i],
                    level_type='swing_high',
                    timeframe='current',
                    timestamp=df.index[i] if hasattr(df.index[i], 'timestamp') else datetime.now(),
                    strength=0.7
                ))
            
            # Swing low
            if df['Low'].iloc[i] == df['Low'].iloc[i-window:i+window+1].min():
                pivots.append(PivotLevel(
                    price=df['Low'].iloc[i],
                    level_type='swing_low',
                    timeframe='current',
                    timestamp=df.index[i] if hasattr(df.index[i], 'timestamp') else datetime.now(),
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
            
            # Demand zone: strong bullish move
            if df['Close'].iloc[i] > df['Open'].iloc[i] and body_size > prev_range * 0.5:
                zones.append(PivotLevel(
                    price=df['Low'].iloc[i],
                    level_type='demand_zone',
                    timeframe='current',
                    timestamp=df.index[i] if hasattr(df.index[i], 'timestamp') else datetime.now(),
                    strength=0.8
                ))
            
            # Supply zone: strong bearish move
            elif df['Close'].iloc[i] < df['Open'].iloc[i] and body_size > prev_range * 0.5:
                zones.append(PivotLevel(
                    price=df['High'].iloc[i],
                    level_type='supply_zone',
                    timeframe='current',
                    timestamp=df.index[i] if hasattr(df.index[i], 'timestamp') else datetime.now(),
                    strength=0.8
                ))
        
        return zones
    
    def get_round_numbers(self, current_price: float, range_pct: float = 0.02) -> List[PivotLevel]:
        """Get nearby round psychological numbers"""
        levels = []
        
        # Determine increment based on price
        if current_price > 1000:
            increment = 50  # For ES, Gold
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
        """Get current volume vs average"""
        if len(df) < window:
            return 1.0
        
        avg_volume = df['Volume'].rolling(window=window).mean().iloc[-1]
        if avg_volume == 0:
            return 1.0
        
        return df['Volume'].iloc[-1] / avg_volume
    
    def is_volume_confirming(self, df: pd.DataFrame, threshold: float = 1.5) -> bool:
        """Check if volume confirms the move"""
        return self.get_volume_spike_ratio(df) >= threshold

# ============================================================================
# CORRELATION CHECKER (for Gold)
# ============================================================================

class CorrelationChecker:
    """Check correlations for gold trading"""
    
    def __init__(self):
        self.dxy_data = None
        self.last_fetch = None
    
    def fetch_dxy(self) -> Optional[pd.DataFrame]:
        """Fetch dollar index data"""
        try:
            ticker = yf.Ticker("DX-Y.NYB")
            self.dxy_data = ticker.history(period="5d", interval="1h")
            self.last_fetch = datetime.now()
            return self.dxy_data
        except:
            return None
    
    def get_dxy_bias(self) -> str:
        """Get dollar bias for gold trading"""
        if self.dxy_data is None or len(self.dxy_data) < 20:
            self.fetch_dxy()
        
        if self.dxy_data is None or len(self.dxy_data) < 20:
            return "NEUTRAL"
        
        # Simple: compare current to 20-period SMA
        sma20 = self.dxy_data['Close'].rolling(20).mean().iloc[-1]
        current = self.dxy_data['Close'].iloc[-1]
        
        if current > sma20 * 1.002:
            return "BULLISH"  # Dollar strong = Gold bearish
        elif current < sma20 * 0.998:
            return "BEARISH"  # Dollar weak = Gold bullish
        return "NEUTRAL"
    
    def gold_bias_from_dxy(self) -> str:
        """Get gold bias based on dollar"""
        dxy_bias = self.get_dxy_bias()
        if dxy_bias == "BULLISH":
            return "BEARISH"  # Dollar up = Gold down
        elif dxy_bias == "BEARISH":
            return "BULLISH"  # Dollar down = Gold up
        return "NEUTRAL"

# ============================================================================
# RISK MANAGER (Socrates Rules)
# ============================================================================

class RiskManager:
    """
    Strict risk management based on Socrates methodology:
    - Max daily loss: $4,000
    - 2 consecutive losses = DONE
    - Max 4 trades per day
    """
    
    def __init__(self, starting_capital: float = 10000):
        self.starting_capital = starting_capital
        self.current_capital = starting_capital
        
        # Socrates rules
        self.max_daily_loss = 4000
        self.max_consecutive_losses = 2
        self.max_trades_per_day = 4
        self.daily_target_min = 25
        self.daily_target_max = 5000
        
        # Daily tracking
        self.daily_pnl = 0
        self.trades_today: List[Trade] = []
        self.consecutive_losses = 0
        self.trading_locked = False
        self.lock_reason = ""
    
    def can_trade(self) -> Tuple[bool, str]:
        """Check if we can take a new trade"""
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
    
    def calculate_position_size(self, symbol: str, entry: float, stop: float, 
                                risk_pct: float = 0.02) -> int:
        """Calculate contracts based on risk"""
        spec = CONTRACT_SPECS.get(symbol, {"point_value": 50})
        point_value = spec["point_value"]
        
        risk_amount = self.current_capital * risk_pct
        price_risk = abs(entry - stop)
        
        if price_risk == 0:
            return 1
        
        contracts = int(risk_amount / (price_risk * point_value))
        return max(1, min(2, contracts))  # Min 1, max 2 for testing
    
    def record_trade(self, trade: Trade):
        """Record completed trade"""
        self.trades_today.append(trade)
        
        if trade.pnl:
            self.daily_pnl += trade.pnl
            self.current_capital += trade.pnl
            
            if trade.pnl < 0:
                self.consecutive_losses += 1
            else:
                self.consecutive_losses = 0
    
    def reset_daily(self):
        """Reset for new trading day"""
        self.daily_pnl = 0
        self.trades_today = []
        self.consecutive_losses = 0
        self.trading_locked = False
        self.lock_reason = ""
    
    def get_stats(self) -> Dict:
        """Get current risk stats"""
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
    """Main trading engine"""
    
    def __init__(self, symbol: str = "ES=F"):
        self.symbol = symbol
        self.spec = CONTRACT_SPECS.get(symbol, CONTRACT_SPECS["ES=F"])
        
        self.pivot_detector = PivotDetector()
        self.volume_analyzer = VolumeAnalyzer()
        self.risk_manager = RiskManager()
        self.correlation_checker = CorrelationChecker()
        
        self.pivot_levels: List[PivotLevel] = []
        self.active_trade: Optional[Trade] = None
        self.higher_tf_bias = "NEUTRAL"
    
    def fetch_data(self, period: str = "5d", interval: str = "5m") -> pd.DataFrame:
        """Fetch market data"""
        try:
            ticker = yf.Ticker(self.symbol)
            df = ticker.history(period=period, interval=interval)
            return df
        except Exception as e:
            print(f"❌ Error fetching data: {e}")
            return pd.DataFrame()
    
    def analyze_higher_timeframes(self, df_1h: pd.DataFrame, df_daily: pd.DataFrame) -> str:
        """Determine bias from higher timeframes"""
        if len(df_daily) < 5 or len(df_1h) < 20:
            return "NEUTRAL"
        
        # Daily trend
        daily_sma20 = df_daily['Close'].rolling(20).mean().iloc[-1] if len(df_daily) >= 20 else df_daily['Close'].mean()
        daily_close = df_daily['Close'].iloc[-1]
        
        # 1H trend
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
        """Update all pivot levels"""
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
        
        # Classic pivots from daily
        if len(df_daily) >= 2:
            prev = df_daily.iloc[-2]
            pivots = self.pivot_detector.calculate_classic_pivots(prev['High'], prev['Low'], prev['Close'])
            for name, price in pivots.items():
                self.pivot_levels.append(PivotLevel(
                    price=price, level_type=f'pivot_{name}', timeframe='daily',
                    timestamp=datetime.now(), strength=0.85
                ))
        
        # Swing points from 1H
        swings = self.pivot_detector.find_swing_points(df_1h, window=3)
        self.pivot_levels.extend(swings)
        
        # Supply/demand zones from 5m
        zones = self.pivot_detector.identify_supply_demand_zones(df_5m)
        self.pivot_levels.extend(zones[-10:])  # Keep last 10 zones
        
        # Round numbers
        if len(df_5m) > 0:
            current = df_5m['Close'].iloc[-1]
            rounds = self.pivot_detector.get_round_numbers(current)
            self.pivot_levels.extend(rounds)
        
        # Update higher TF bias
        self.higher_tf_bias = self.analyze_higher_timeframes(df_1h, df_daily)
    
    def check_entry_signal(self, current_price: float, df_5m: pd.DataFrame) -> Optional[Dict]:
        """Check for entry signal at pivot level"""
        # Check if we can trade
        can_trade, reason = self.risk_manager.can_trade()
        if not can_trade:
            return None
        
        # Check volume
        if not self.volume_analyzer.is_volume_confirming(df_5m, threshold=1.3):
            return None
        
        # For gold, check DXY correlation
        if self.symbol == "GC=F":
            gold_bias = self.correlation_checker.gold_bias_from_dxy()
            print(f"   🥇 Gold bias from DXY: {gold_bias}")
        
        # Check proximity to pivot levels
        for pivot in sorted(self.pivot_levels, key=lambda x: x.strength, reverse=True):
            distance_pct = abs(current_price - pivot.price) / current_price
            
            if distance_pct < 0.002:  # Within 0.2%
                # Determine direction based on level type and higher TF bias
                if pivot.level_type in ['demand_zone', 'swing_low', 'pivot_s1', 'pivot_s2', 'prev_day_low', 'prev_week_low']:
                    if self.higher_tf_bias != "BEARISH":  # Don't go long in downtrend
                        return {
                            'direction': 'LONG',
                            'entry': current_price,
                            'stop': pivot.price - (current_price * 0.003),
                            'pivot': pivot
                        }
                
                elif pivot.level_type in ['supply_zone', 'swing_high', 'pivot_r1', 'pivot_r2', 'prev_day_high', 'prev_week_high']:
                    if self.higher_tf_bias != "BULLISH":  # Don't short in uptrend
                        return {
                            'direction': 'SHORT',
                            'entry': current_price,
                            'stop': pivot.price + (current_price * 0.003),
                            'pivot': pivot
                        }
        
        return None
    
    def find_take_profit(self, entry: float, direction: str) -> float:
        """Find next pivot level for take profit"""
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
        """Execute paper trade"""
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
        
        print(f"\n{'='*50}")
        print(f"⚡ {direction} {self.spec['name']} @ ${entry:.2f}")
        print(f"   📍 Pivot: {pivot.level_type} (${pivot.price:.2f})")
        print(f"   🛑 Stop: ${stop:.2f} | 🎯 TP: ${tp:.2f}")
        print(f"   📊 Size: {size} contract(s)")
        print(f"   📈 Higher TF Bias: {self.higher_tf_bias}")
        print(f"{'='*50}\n")
    
    def check_exit(self, current_price: float) -> bool:
        """Check if should exit trade"""
        if not self.active_trade or self.active_trade.status != 'OPEN':
            return False
        
        trade = self.active_trade
        
        # Stop loss
        if trade.direction == 'LONG' and current_price <= trade.stop_loss:
            self.close_trade(current_price, 'Stop Loss')
            return True
        elif trade.direction == 'SHORT' and current_price >= trade.stop_loss:
            self.close_trade(current_price, 'Stop Loss')
            return True
        
        # Take profit
        if trade.direction == 'LONG' and current_price >= trade.take_profit:
            self.close_trade(current_price, 'Take Profit')
            return True
        elif trade.direction == 'SHORT' and current_price <= trade.take_profit:
            self.close_trade(current_price, 'Take Profit')
            return True
        
        return False
    
    def close_trade(self, exit_price: float, reason: str):
        """Close active trade"""
        trade = self.active_trade
        if not trade:
            return
        
        trade.exit_price = exit_price
        trade.exit_time = datetime.now()
        trade.status = 'CLOSED'
        trade.exit_reason = reason
        
        # Calculate P&L
        point_value = self.spec['point_value']
        if trade.direction == 'LONG':
            points = exit_price - trade.entry_price
        else:
            points = trade.entry_price - exit_price
        
        trade.pnl = points * point_value * trade.size
        
        # Record
        self.risk_manager.record_trade(trade)
        
        # Print result
        emoji = "✅" if trade.pnl > 0 else "❌"
        print(f"\n{'='*50}")
        print(f"{emoji} CLOSED {trade.direction} @ ${exit_price:.2f}")
        print(f"   Entry: ${trade.entry_price:.2f} → Exit: ${exit_price:.2f}")
        print(f"   P&L: ${trade.pnl:.2f} | Reason: {reason}")
        print(f"   Daily P&L: ${self.risk_manager.daily_pnl:.2f}")
        
        stats = self.risk_manager.get_stats()
        if stats['consecutive_losses'] > 0:
            print(f"   ⚠️  Consecutive Losses: {stats['consecutive_losses']}/{self.risk_manager.max_consecutive_losses}")
        print(f"{'='*50}\n")
        
        self.active_trade = None
    
    def get_status(self) -> Dict:
        """Get engine status"""
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
# MAIN
# ============================================================================

def print_banner():
    """Print startup banner"""
    print("""
+===============================================================+
|                    PIVOT PETE ENGINE                          |
|            Socrates Investments Methodology                   |
+---------------------------------------------------------------+
|  Strategy: Wait for KEY PIVOT LEVELS + VOLUME confirmation    |
|  Risk: Max $4K daily loss | 2 consecutive losses = DONE       |
|  Data: yfinance (15-20min delayed) | Mode: PAPER TRADING      |
+===============================================================+
""")

def main():
    """Main loop"""
    print_banner()
    
    # Parse args for symbol
    symbol = "ES=F"
    if len(sys.argv) > 1:
        arg = sys.argv[1].upper()
        if arg in ["ES", "NQ", "GC", "GOLD"]:
            symbol = f"{arg}=F" if arg != "GOLD" else "GC=F"
    
    engine = PivotPeteEngine(symbol)
    print(f"📊 Tracking: {engine.spec['name']} ({symbol})")
    print(f"💰 Starting Capital: ${engine.risk_manager.current_capital:,.2f}\n")
    
    iteration = 0
    while True:
        try:
            iteration += 1
            print(f"\n⏰ [{datetime.now().strftime('%H:%M:%S')}] Scan #{iteration}")
            
            # Fetch data
            df_5m = engine.fetch_data(period="5d", interval="5m")
            df_1h = engine.fetch_data(period="1mo", interval="1h")
            df_daily = engine.fetch_data(period="3mo", interval="1d")
            
            if df_5m.empty:
                print("⚠️  No data received, retrying...")
                time.sleep(60)
                continue
            
            # Update levels
            engine.update_pivot_levels(df_5m, df_1h, df_daily)
            
            current = df_5m['Close'].iloc[-1]
            volume_ratio = engine.volume_analyzer.get_volume_spike_ratio(df_5m)
            
            print(f"   💹 Price: ${current:.2f} | Vol: {volume_ratio:.1f}x avg")
            print(f"   📍 Pivots: {len(engine.pivot_levels)} | Bias: {engine.higher_tf_bias}")
            
            # Check risk status
            can_trade, reason = engine.risk_manager.can_trade()
            if not can_trade:
                print(f"   {reason}")
            
            # Check exits
            if engine.active_trade:
                print(f"   📈 Open: {engine.active_trade.direction} @ ${engine.active_trade.entry_price:.2f}")
                engine.check_exit(current)
            
            # Check entries
            elif can_trade:
                signal = engine.check_entry_signal(current, df_5m)
                if signal:
                    engine.execute_trade(signal)
            
            # Status summary
            stats = engine.risk_manager.get_stats()
            print(f"   💰 Capital: ${stats['capital']:,.2f} | Daily: ${stats['daily_pnl']:+,.2f} | Trades: {stats['trades_today']}")
            
            # Wait for next candle (5 min)
            print(f"\n   ⏳ Next scan in 5 minutes...")
            time.sleep(300)
            
        except KeyboardInterrupt:
            print("\n\n🛑 Shutting down Pivot Pete...")
            
            # Final stats
            stats = engine.get_status()
            print(f"\n📊 Final Stats:")
            print(f"   Capital: ${stats['capital']:,.2f}")
            print(f"   Daily P&L: ${stats['daily_pnl']:+,.2f}")
            print(f"   Trades: {stats['trades_today']}")
            break
            
        except Exception as e:
            print(f"❌ Error: {e}")
            time.sleep(60)

if __name__ == "__main__":
    main()
