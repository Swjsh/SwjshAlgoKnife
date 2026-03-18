#!/usr/bin/env python3
"""Quick 4-hour scan for Bitcoin Bob - one-shot zone analysis"""

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime

# Config
PAIRS = ['BTC-USD', 'ETH-USD']
TIMEFRAME = '1h'
PERIOD = '30d'
ATR_PERIOD = 14
IMPULSE_MULT = 2.5

def calculate_atr(df, period=14):
    high_low = df['High'].values - df['Low'].values
    high_close = np.abs(df['High'].values - df['Close'].shift(1).values)
    low_close = np.abs(df['Low'].values - df['Close'].shift(1).values)
    true_range = np.maximum(high_low, np.maximum(high_close, low_close))
    atr = pd.Series(true_range).rolling(period).mean()
    return atr.values

def find_impulse_zones(df, pair_name):
    """Find fresh supply/demand zones from impulse candles"""
    atr = calculate_atr(df, ATR_PERIOD)
    df_np = df.copy()
    df_np['ATR'] = atr
    
    impulse_up = (df['Close'].values - df['Open'].values) >= (atr * IMPULSE_MULT)
    impulse_down = (df['Open'].values - df['Close'].values) >= (atr * IMPULSE_MULT)
    
    zones = []
    
    # Scan for impulse candles
    for i in range(5, len(df) - 1):
        base_high = df['High'].iloc[i-4:i].max()
        base_low = df['Low'].iloc[i-4:i].min()
        
        # Impulse UP = Demand zone forms below
        if impulse_up[i]:
            vol_ratio = float(df['Volume'].iloc[i]) / float(df['Volume'].iloc[i-10:i].mean())
            if vol_ratio >= 1.5:
                zones.append({
                    'type': 'DEMAND',
                    'date': df.index[i].strftime('%Y-%m-%d %H:%M'),
                    'impulse_price': float(df['Close'].iloc[i]),
                    'zone_top': float(base_high),
                    'zone_bottom': float(base_low),
                    'volume_ratio': round(vol_ratio, 2),
                })
        
        # Impulse DOWN = Supply zone forms above
        if impulse_down[i]:
            vol_ratio = float(df['Volume'].iloc[i]) / float(df['Volume'].iloc[i-10:i].mean())
            if vol_ratio >= 1.5:
                zones.append({
                    'type': 'SUPPLY',
                    'date': df.index[i].strftime('%Y-%m-%d %H:%M'),
                    'impulse_price': float(df['Close'].iloc[i]),
                    'zone_top': float(base_high),
                    'zone_bottom': float(base_low),
                    'volume_ratio': round(vol_ratio, 2),
                })
    
    return zones[-3:] if zones else []

def get_weekly_context(pair):
    """Get weekly structure for macro context"""
    df = yf.download(pair, period='1y', interval='1wk', progress=False)
    if len(df) < 2:
        return "UNKNOWN"
    
    recent_close = float(df['Close'].iloc[-1])
    prev_close = float(df['Close'].iloc[-2])
    
    if recent_close > prev_close:
        return "BULLISH"
    elif recent_close < prev_close:
        return "BEARISH"
    else:
        return "RANGING"

print("=" * 70)
print("  BITCOIN BOB — 4-HOUR SCAN")
print(f"  {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
print("=" * 70)

for pair in PAIRS:
    print(f"\n📊 {pair}")
    print("-" * 70)
    
    try:
        # Fetch 1H data
        df = yf.download(pair, period=PERIOD, interval=TIMEFRAME, progress=False)
        
        if df.empty or len(df) < 20:
            print(f"  [SKIP] Insufficient data")
            continue
        
        current_price = float(df['Close'].iloc[-1])
        print(f"  Current Price: ${current_price:,.2f}")
        
        # Weekly context
        weekly = get_weekly_context(pair)
        print(f"  Weekly Structure: {weekly}")
        
        # Find zones
        zones = find_impulse_zones(df, pair)
        
        if not zones:
            print(f"  [NO ZONES] Choppy/ranging market OR no fresh impulse detected")
        else:
            print(f"  Fresh Zones Found: {len(zones)}")
            for i, z in enumerate(zones, 1):
                print(f"\n    Zone {i} ({z['type']}):")
                print(f"      Formed: {z['date']}")
                print(f"      Range: ${z['zone_bottom']:,.2f} - ${z['zone_top']:,.2f}")
                print(f"      Vol Ratio: {z['volume_ratio']}x")
                
                # Check if price is in zone now
                in_zone = z['zone_bottom'] <= current_price <= z['zone_top']
                if in_zone:
                    print(f"      ⚠️  PRICE IN ZONE - Monitor for confirmation")
    
    except Exception as e:
        print(f"  [ERROR] {e}")

print("\n" + "=" * 70)
print("PROTOCOL: Post to #crypto ONLY if high-confidence fresh zone.")
print("No zones = STAY QUIET (signal strength = 0)")
print("=" * 70)
