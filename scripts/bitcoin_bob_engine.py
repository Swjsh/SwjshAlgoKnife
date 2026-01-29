"""
Bitcoin Bob Agent - Crypto Supply & Demand Hunter
Scans for Supply & Demand zones on Crypto pairs using free yfinance data.
Optimized for high volatility assets.

Logic:
1. Fetch 4H data for BTC, ETH, SOL.
2. Identify "Impulse Moves" (Higher threshold for crypto).
3. Define Supply/Demand zones.
4. Output signals to JSON for the dashboard.
"""

import yfinance as yf
import pandas as pd
import numpy as np
import json
from pathlib import Path
from datetime import datetime
import time
from agent_utils import log_message, get_random_quip

# --- Configuration ---
PAIRS = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD', 'DOGE-USD']
TIMEFRAME = '1h'  # Crypto markets move fast, 1h is good for "Set & Forget" intraday
PERIOD = '1mo'    
LOOKBACK = 100    
ATR_PERIOD = 14
IMPULSE_MULTIPLIER = 2.5  # Higher than FX (2.0) because crypto is noisier and needs stronger moves
STATUS_FILE = Path(__file__).parent.parent / 'data' / 'crypto_agent_status.json'

def calculate_atr(df, period=14):
    high_low = df['High'] - df['Low']
    high_close = np.abs(df['High'] - df['Close'].shift())
    low_close = np.abs(df['Low'] - df['Close'].shift())
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = np.max(ranges, axis=1)
    return true_range.rolling(period).mean()

def find_zones(df, atr_series):
    zones = []
    
    # Iterate backwards
    for i in range(len(df) - 2, 20, -1):
        current_idx = df.index[i]
        
        body_size = abs(df['Close'].iloc[i] - df['Open'].iloc[i])
        atr = atr_series.iloc[i]
        
        # Check for Impulsive Move (Large Body)
        if body_size > (atr * IMPULSE_MULTIPLIER):
            is_bullish = df['Close'].iloc[i] > df['Open'].iloc[i]
            
            # The "Base" is the candle BEFORE the impulse
            base_idx = i - 1
            base_high = df['High'].iloc[base_idx]
            base_low = df['Low'].iloc[base_idx]
            
            zone_top = base_high
            zone_bottom = base_low
            
            zone_type = "DEMAND" if is_bullish else "SUPPLY"
            
            # Check for FRESHNESS
            future_prices = df[i+1:]
            is_fresh = True
            
            if zone_type == "DEMAND":
                min_future = future_prices['Low'].min()
                if min_future <= zone_top:
                    is_fresh = False
            elif zone_type == "SUPPLY":
                max_future = future_prices['High'].max()
                if max_future >= zone_bottom:
                    is_fresh = False

            if is_fresh:
                # Add buffer for crypto volatility
                stop_buffer = (zone_top - zone_bottom) * 0.2
                
                zones.append({
                    'created_at': current_idx.strftime('%Y-%m-%d %H:%M'),
                    'type': zone_type,
                    'top': round(zone_top, 2),
                    'bottom': round(zone_bottom, 2),
                    'entry': round(zone_top, 2) if zone_type == "DEMAND" else round(zone_bottom, 2),
                    'stop_loss': round(zone_bottom - stop_buffer, 2) if zone_type == "DEMAND" else round(zone_top + stop_buffer, 2),
                    'status': 'PENDING'
                })
                
    return zones

def run_engine():
    print(f"Starting Bitcoin Bob Agent at {datetime.now().strftime('%H:%M:%S')}...")
    log_message('crypto', get_random_quip('crypto'))
    
    scan_results = []
    
    for pair in PAIRS:
        print(f"Scanning {pair}...")
        try:
            data = yf.download(pair, period=PERIOD, interval=TIMEFRAME, progress=False)
            
            if data.empty:
                print(f"  No data for {pair}")
                continue

            if isinstance(data.columns, pd.MultiIndex):
                try:
                    data.columns = data.columns.get_level_values(0)
                except:
                    pass

            atr = calculate_atr(data, ATR_PERIOD)
            zones = find_zones(data, atr)
            
            print(f"  Found {len(zones)} fresh zones.")
            if len(zones) > 0:
                log_message('crypto', f"Scanning {pair}: Found {len(zones)} fresh crypto zones.", type='signal')
            
            for z in zones:
                z['ticker'] = pair
                scan_results.append(z)
                
        except Exception as e:
            print(f"  Error scanning {pair}: {e}")

    scan_results.sort(key=lambda x: x['created_at'], reverse=True)
    
    agent_state = {
        'last_updated': datetime.now().isoformat(),
        'status': 'ACTIVE',
        'active_pairs': len(PAIRS),
        'pending_orders': scan_results[:10],
        'total_zones_found': len(scan_results),
        'equity_curve': [
            {'date': '2025-01-01', 'balance': 5000}, # Start a bit smaller for Bob
        ],
        'performance': {
            'win_rate': 0,
            'total_pnl': 0,
            'trades': 0
        }
    }
    
    with open(STATUS_FILE, 'w') as f:
        json.dump(agent_state, f, indent=2)
        
    log_message('crypto', f"Crypto scan cycle complete. Tracking {len(scan_results)} zones.")
    print(f"✅ Bitcoin Bob finished. Status saved to {STATUS_FILE}")

if __name__ == "__main__":
    run_engine()
