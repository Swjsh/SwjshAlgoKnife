#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Bitcoin Bob 4-hour scan"""

import yfinance as yf
import pandas as pd
import numpy as np

symbols = ['BTC-USD', 'ETH-USD']

for sym in symbols:
    print(f'\n=== {sym} ===')
    
    # 1H chart (last 30 days for impulse detection)
    df_1h = yf.download(sym, period='30d', interval='1h', progress=False)
    
    if len(df_1h) > 0:
        # Calculate 20-period ATR
        df_1h['tr1'] = df_1h['High'] - df_1h['Low']
        df_1h['tr2'] = abs(df_1h['High'] - df_1h['Close'].shift(1))
        df_1h['tr3'] = abs(df_1h['Low'] - df_1h['Close'].shift(1))
        df_1h['tr'] = df_1h[['tr1', 'tr2', 'tr3']].max(axis=1)
        df_1h['atr'] = df_1h['tr'].rolling(20).mean()
        df_1h['body'] = abs(df_1h['Close'] - df_1h['Open'])
        
        # Get current state
        current_price = df_1h['Close'].iloc[-1]
        latest_high = df_1h['High'].iloc[-1]
        latest_low = df_1h['Low'].iloc[-1]
        latest_body = df_1h['body'].iloc[-1]
        latest_atr = df_1h['atr'].iloc[-1]
        latest_vol = df_1h['Volume'].iloc[-1]
        vol_avg_20 = df_1h['Volume'].rolling(20).mean().iloc[-1]
        
        print(f'Current price: {current_price:.2f}')
        print(f'1H Range: {latest_low:.2f} - {latest_high:.2f}')
        print(f'\nTechnical metrics:')
        print(f'  ATR(20): {latest_atr:.2f}')
        print(f'  Latest candle body: {latest_body:.2f}')
        print(f'  Body/ATR ratio: {latest_body/latest_atr:.2f}x (impulse threshold: 2.5x)')
        
        if vol_avg_20 > 0:
            vol_ratio = latest_vol / vol_avg_20
            print(f'  Volume ratio: {vol_ratio:.2f}x (20-period avg)')
        else:
            vol_ratio = 0
        
        # Impulse detection
        is_impulse = latest_body >= 2.5 * latest_atr
        has_vol = vol_ratio >= 1.5
        
        print(f'\nSetup status:')
        if is_impulse:
            print(f'  [IMPULSE] Body {latest_body:.2f} >= 2.5x ATR {latest_atr:.2f}')
            if has_vol:
                print(f'  [VOLUME OK] {vol_ratio:.2f}x avg')
            else:
                print(f'  [NO VOLUME] {vol_ratio:.2f}x avg - need 1.5x+')
        else:
            print(f'  [NO IMPULSE] Body {latest_body:.2f} < 2.5x ATR {latest_atr:.2f}')
            print(f'  Market is choppy/ranging')

print('\n' + '='*50)
print('SCAN SUMMARY (Monday 2026-03-16 20:03 EST)')
print('='*50)
