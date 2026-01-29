import pandas as pd
import numpy as np
import yfinance as yf
from datetime import datetime, timedelta

class BobaTraderEngine:
    def __init__(self, symbol):
        self.symbol = symbol
        self.supply_zones = []
        self.demand_zones = []
        self.active_trade = None
        self.closed_trades = []
        self.daily_pnl = 0
        self.trades_today = 0

    def fetch_data(self, period="5d", interval="15m"):
        """Fetch market data from Yahoo Finance"""
        try:
            ticker = yf.Ticker(self.symbol)
            df = ticker.history(period=period, interval=interval)
            return df
        except Exception as e:
            print(f"Error fetching data: {e}")
            return pd.DataFrame()

    def identify_zones(self, df_15m):
        """
        Identify Supply and Demand zones on a 15-minute timeframe.
        Look for areas of consolidation followed by a strong impulsive move.
        """
        self.supply_zones = []
        self.demand_zones = []
        
        if df_15m.empty:
            return

        # Simple algorithm: Look for large body moves back into consolidation
        for i in range(5, len(df_15m) - 1):
            current_candle = df_15m.iloc[i]
            prev_candle = df_15m.iloc[i-1]
            
            # Body size comparison
            body = abs(current_candle['Close'] - current_candle['Open'])
            avg_body = (df_15m.iloc[i-5:i]['High'] - df_15m.iloc[i-5:i]['Low']).mean()
            
            is_impulsive = body > avg_body * 1.5
            
            if is_impulsive:
                if current_candle['Close'] > current_candle['Open']:
                    # Demand Zone
                    self.demand_zones.append({
                        'top': current_candle['Open'],
                        'bottom': prev_candle['Low'],
                        'fresh': True,
                        'type': 'demand'
                    })
                else:
                    # Supply Zone
                    self.supply_zones.append({
                        'top': prev_candle['High'],
                        'bottom': current_candle['Open'],
                        'fresh': True,
                        'type': 'supply'
                    })

        self.demand_zones = self.demand_zones[-5:]
        self.supply_zones = self.supply_zones[-5:]

    def check_signals(self, current_price, current_time):
        """Check for signals during 9:30-11:00 AM EST"""
        hour = current_time.hour
        minute = current_time.minute
        time_val = hour * 100 + minute
        
        # Simplified time check (assuming UTC or system time is handled by wrapper)
        if not (930 <= time_val <= 1100):
            return None

        for zone in self.demand_zones:
            if zone['fresh'] and zone['bottom'] <= current_price <= zone['top']:
                zone['fresh'] = False
                return {'side': 'LONG', 'price': current_price, 'type': 'DEMAND'}
                
        for zone in self.supply_zones:
            if zone['fresh'] and zone['bottom'] <= current_price <= zone['top']:
                zone['fresh'] = False
                return {'side': 'SHORT', 'price': current_price, 'type': 'SUPPLY'}
        
        return None

    def execute_trade(self, signal):
        self.active_trade = {
            'entry_price': signal['price'],
            'entry_time': datetime.now().isoformat(),
            'direction': signal['side'],
            'stop_loss': signal['price'] * (0.85 if signal['side'] == 'LONG' else 1.15),
            'targets': [signal['price'] * (1.15 if signal['side'] == 'LONG' else 0.85)],
            'status': 'ACTIVE'
        }
        self.trades_today += 1

    def get_status(self):
        return {
            'symbol': self.symbol,
            'active_trade': self.active_trade,
            'zones_found': len(self.supply_zones) + len(self.demand_zones),
            'daily_pnl': self.daily_pnl,
            'trades_today': self.trades_today
        }
