"""
Swjsh FX Engine - "Set & Forget" Agent
Scans for Supply & Demand zones using free yfinance data.
Implements a simplified version of FX Alex Gianola's strategy.

Logic:
1. Fetch 4H data for major pairs.
2. Identify "Impluse Moves" (large body candles).
3. Define the "Base" (zone) prior to the move.
4. Check if the zone is fresh (untested).
5. Output signals to JSON for the dashboard.
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
PAIRS = ['EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'AUDUSD=X', 'USDCAD=X']
TIMEFRAME = '1h'  # Using 1h for more signals (free yfinance 4h is sometimes spotty)
PERIOD = '1mo'    # 1 month of data
LOOKBACK = 100    # Candles to scan
ATR_PERIOD = 14
IMPULSE_MULTIPLIER = 2.0  # Candle body must be 2x ATR to be "Impulsive"
ZONE_HISTORY_FILE = Path(__file__).parent.parent / 'data' / 'fx_agent_history.json'
STATUS_FILE = Path(__file__).parent.parent / 'data' / 'fx_agent_status.json'

def calculate_atr(df, period=14):
    high_low = df['High'] - df['Low']
    high_close = np.abs(df['High'] - df['Close'].shift())
    low_close = np.abs(df['Low'] - df['Close'].shift())
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = np.max(ranges, axis=1)
    return true_range.rolling(period).mean()

def find_zones(df, atr_series):
    zones = []
    
    # Iterate backwards from the most recent closed candle
    # Skip the very last candle as it might be forming
    for i in range(len(df) - 2, 20, -1):
        current_idx = df.index[i]
        
        body_size = abs(df['Close'].iloc[i] - df['Open'].iloc[i])
        atr = atr_series.iloc[i]
        
        # Check for Impulsive Move (Large Body)
        if body_size > (atr * IMPULSE_MULTIPLIER):
            # Direction of impulse
            is_bullish = df['Close'].iloc[i] > df['Open'].iloc[i]
            
            # The "Base" is the candle BEFORE the impulse
            base_idx = i - 1
            base_high = df['High'].iloc[base_idx]
            base_low = df['Low'].iloc[base_idx]
            
            # Simple Zone Definition: High/Low of the base candle
            zone_top = base_high
            zone_bottom = base_low
            
            # Determine Zone Type
            zone_type = "DEMAND" if is_bullish else "SUPPLY"
            
            # Check for FRESHNESS (Has price returned?)
            # Look at all candles AFTER the impulse (i+1) up to NOW
            future_prices = df[i+1:]
            
            is_fresh = True
            is_mitigated = False
            
            if zone_type == "DEMAND":
                # For Demand, check if Low of any future candle touched the Top of Zone
                min_future = future_prices['Low'].min()
                if min_future <= zone_top:
                    is_fresh = False
                    # Check if it broke the zone (Low < Bottom) - INVALID
                    if min_future < zone_bottom:
                        continue # Zone failed, ignore it
                    else:
                        is_mitigated = True # Touched but held (could be a re-entry, but strict rules say 'Fresh Only')

            elif zone_type == "SUPPLY":
                # For Supply, check if High of any future candle touched Bottom of Zone
                max_future = future_prices['High'].max()
                if max_future >= zone_bottom:
                    is_fresh = False
                    if max_future > zone_top:
                        continue # Zone failed
                    else:
                        is_mitigated = True

            # If strict "Fresh" rule:
            if is_fresh:
                zones.append({
                    'created_at': current_idx.strftime('%Y-%m-%d %H:%M'),
                    'type': zone_type,
                    'top': round(zone_top, 5),
                    'bottom': round(zone_bottom, 5),
                    'entry': round(zone_top, 5) if zone_type == "DEMAND" else round(zone_bottom, 5),
                    'stop_loss': round(zone_bottom - (0.0005), 5) if zone_type == "DEMAND" else round(zone_top + (0.0005), 5),
                    'status': 'PENDING'
                })
                
    return zones

def run_engine():
    print(f"Starting Swjsh FX Engine at {datetime.now().strftime('%H:%M:%S')}...")
    log_message('fx', get_random_quip('fx'))
    
    scan_results = []
    
    for pair in PAIRS:
        print(f"Scanning {pair}...")
        try:
            # Download data
            data = yf.download(pair, period=PERIOD, interval=TIMEFRAME, progress=False)
            
            if data.empty:
                print(f"  No data for {pair}")
                continue
                
            # Clean indices
            # Check if columns are MultiIndex (common in new yfinance)
            if isinstance(data.columns, pd.MultiIndex):
                # Flatten or select the price level (usually empty string or Ticker)
                # Just keeping it simple: selecting 'Close', 'High', etc regardless of level 1
                try:
                    data.columns = data.columns.get_level_values(0)
                except:
                    pass

            atr = calculate_atr(data, ATR_PERIOD)
            zones = find_zones(data, atr)
            
            print(f"  Found {len(zones)} fresh zones.")
            if len(zones) > 0:
                log_message('fx', f"Scanning {pair.replace('=X', '')}: Found {len(zones)} fresh zones.", type='signal')
            
            # Add ticker info to zones
            for z in zones:
                z['ticker'] = pair.replace('=X', '') # Clean ticker name for UI
                scan_results.append(z)
                
        except Exception as e:
            print(f"  Error scanning {pair}: {e}")
            import traceback
            traceback.print_exc()

    # Sort by creation time (newest first)
    scan_results.sort(key=lambda x: x['created_at'], reverse=True)
    
    # State update
    agent_state = {
        'last_updated': datetime.now().isoformat(),
        'status': 'ACTIVE',
        'active_pairs': len(PAIRS),
        'pending_orders': scan_results[:10], # Top 10 freshest signals
        'total_zones_found': len(scan_results),
        'equity_curve': [ # Mock equity for UI init
            {'date': '2025-01-01', 'balance': 10000},
        ],
        'performance': {
            'win_rate': 0,
            'total_pnl': 0,
            'trades': 0
        }
    }
    
    # Save to JSON
    with open(STATUS_FILE, 'w') as f:
        json.dump(agent_state, f, indent=2)
        
    log_message('fx', f"Scan cycle complete. Monitoring {len(scan_results)} zones.")
    print(f"✅ Engine cycle complete. Status saved to {STATUS_FILE}")

if __name__ == "__main__":
    run_engine()
