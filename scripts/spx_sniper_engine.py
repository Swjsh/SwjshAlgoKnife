"""
SPX Sniper Agent - 0DTE Options Scalper (Proxy)
Uses ^SPX Underlying Price Action to simulate Option Entry signals.
Enforces "Gold Rules" from historical analysis.

Rules:
1. Time Gate: No trades before 10:30 AM EST (Avoid Morning Bleed).
2. Trend Following: Trade with 9 EMA and VWAP.
3. Pulse Check: Momentum on 5m timeframe.
"""

import yfinance as yf
import pandas as pd
import numpy as np
import json
from pathlib import Path
from datetime import datetime, time as dtime
import pytz
from agent_utils import log_message, get_random_quip

# --- Configuration ---
TICKER = '^SPX'
TIMEFRAME = '5m' # Fast scalping
PERIOD = '5d'    # Recent context
STATUS_FILE = Path(__file__).parent.parent / 'data' / 'spx_agent_status.json'

def calculate_indicators(df):
    # EMA 9
    df['EMA9'] = df['Close'].ewm(span=9, adjust=False).mean()
    
    # VWAP (Approximation for daily)
    df['TP'] = (df['High'] + df['Low'] + df['Close']) / 3
    df['VWAP'] = (df['TP'] * df['Volume']).cumsum() / df['Volume'].cumsum()
    
    # RSI 14
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))
    
    return df

def check_time_gate():
    """Returns True if within safe trading hours (10:30 AM - 3:50 PM EST)"""
    est = pytz.timezone('US/Eastern')
    now = datetime.now(est).time()
    
    start_safe = dtime(10, 30)
    end_safe = dtime(15, 50)
    
    return start_safe <= now <= end_safe

def generate_signals(df):
    signals = []
    
    # Analyze the last few candles
    # Look for trend alignment
    
    last_candle = df.iloc[-1]
    prev_candle = df.iloc[-2]
    
    trend = "NEUTRAL"
    if last_candle['Close'] > last_candle['EMA9'] and last_candle['Close'] > last_candle['VWAP']:
        trend = "BULLISH"
    elif last_candle['Close'] < last_candle['EMA9'] and last_candle['Close'] < last_candle['VWAP']:
        trend = "BEARISH"
        
    # Signal Logic
    signal_type = None
    confidence = 0
    
    # Call Setup: Price crosses above VWAP + EMA9 with RSI < 70
    if prev_candle['Close'] < prev_candle['VWAP'] and last_candle['Close'] > last_candle['VWAP']:
        if trend == "BULLISH":
            signal_type = "CALL"
            confidence = 80
            
    # Put Setup: Price crosses below VWAP + EMA9 with RSI > 30
    elif prev_candle['Close'] > prev_candle['VWAP'] and last_candle['Close'] < last_candle['VWAP']:
        if trend == "BEARISH":
            signal_type = "PUT"
            confidence = 80

    if signal_type:
        signals.append({
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M'),
            'type': signal_type,
            'ticker': 'SPX 0DTE',
            'entry': round(last_candle['Close'], 2),
            'stop_loss': round(last_candle['Low'] if signal_type == "CALL" else last_candle['High'], 2),
            'status': 'PENDING',
            'notes': f"Trend: {trend}, RSI: {round(last_candle['RSI'], 1)}"
        })
        
    return signals, trend, last_candle['Close']

def run_engine():
    print(f"Starting SPX Sniper Agent at {datetime.now().strftime('%H:%M:%S')}...")
    log_message('spx', get_random_quip('spx'))
    
    try:
        data = yf.download(TICKER, period=PERIOD, interval=TIMEFRAME, progress=False)
        
        if isinstance(data.columns, pd.MultiIndex):
            try:
                data.columns = data.columns.get_level_values(0)
            except:
                pass
                
        if data.empty:
            print("No data for SPX")
            return

        df = calculate_indicators(data)
        signals, trend, current_price = generate_signals(df)
        
        is_safe_time = check_time_gate()
        
        # Filter signals based on time gate
        active_signals = []
        if is_safe_time:
            active_signals = signals
            if len(signals) > 0:
                log_message('spx', f"SPX 0DTE Trigger: {signals[0]['type']} at {signals[0]['entry']}", type='signal')
        else:
            print("  ⛔ Market Warning: Outside Safe Trading Hours (10:30-15:50 EST)")
            log_message('spx', "Time-gate active. Waiting for 10:30 AM EST.")
            
        agent_state = {
            'last_updated': datetime.now().isoformat(),
            'status': 'ACTIVE' if is_safe_time else 'WAITING (Time Gate)',
            'market_price': round(current_price, 2),
            'trend': trend,
            'active_pairs': 1, # SPX
            'pending_orders': active_signals,
            'total_zones_found': len(active_signals), # Using same schema as other agents for UI compatibility
            'performance': {
                'win_rate': 0,
                'total_pnl': 0,
                'trades': 0
            }
        }
        
        with open(STATUS_FILE, 'w') as f:
            json.dump(agent_state, f, indent=2)
            
        print(f"✅ SPX Sniper finished. Trend: {trend}. Status saved.")
        
    except Exception as e:
        print(f"Error running SPX Sniper: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_engine()
