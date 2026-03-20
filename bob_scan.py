import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import numpy as np

# Fetch 1H data for last 30 days
end = datetime.now()
start = end - timedelta(days=30)

symbols = ['BTC-USD', 'ETH-USD']
for sym in symbols:
    print(f'\n=== {sym} 1H Chart (Last 30 Days) ===')
    try:
        data = yf.download(sym, start=start, end=end, interval='1h', progress=False)
        
        if data.empty:
            print('No data')
            continue
        
        # Recent 20 candles (20 hours)
        recent = data.tail(20)
        
        # Calculate ATR (14-period)
        high_low = recent['High'] - recent['Low']
        high_close = abs(recent['High'] - recent['Close'].shift())
        low_close = abs(recent['Low'] - recent['Close'].shift())
        tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        atr = tr.rolling(14).mean().iloc[-1]
        
        print(f'ATR(14): {float(atr):.2f}')
        
        # Latest candles
        latest = recent.iloc[-5:]
        print(f'\nRecent candles (last 5H):')
        for idx, row in latest.iterrows():
            body = float(abs(row['Close'] - row['Open']))
            ts = idx.strftime('%Y-%m-%d %H:%M')
            ratio = body / float(atr) if float(atr) > 0 else 0
            o = float(row["Open"])
            h = float(row["High"])
            l = float(row["Low"])
            c = float(row["Close"])
            print(f'  {ts} | O:{o:.2f} H:{h:.2f} L:{l:.2f} C:{c:.2f} | Body:{body:.2f} | {ratio:.1f}x ATR')
        
        # Check for impulses in last 10 candles
        last_10 = data.tail(10)
        impulses = []
        for i in range(1, len(last_10)):
            candle = last_10.iloc[i]
            body = float(abs(candle['Close'] - candle['Open']))
            atr_val = float(atr)
            if body >= 2.5 * atr_val:
                direction = 'UP' if candle['Close'] > candle['Open'] else 'DOWN'
                impulses.append({
                    'time': last_10.index[i].strftime('%Y-%m-%d %H:%M'),
                    'body': body,
                    'ratio': body / atr_val,
                    'direction': direction
                })
        
        if impulses:
            print(f'\nIMPULSES DETECTED ({len(impulses)}):')
            for imp in impulses:
                print(f'  {imp["time"]} | {imp["direction"]:4s} | {imp["ratio"]:.1f}x ATR')
        else:
            print(f'\nNo impulses (>2.5x ATR) in last 10 candles. Market is choppy.')
            
    except Exception as e:
        print(f'Error: {e}')
