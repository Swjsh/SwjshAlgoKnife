"""
Market Context Fetches basic market data (daily ranges) to correlate with trades.
Uses yfinance (Free)

Author: Swjsh Algo Knife
"""

import json
import pandas as pd
import yfinance as yf
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List


def load_trades() -> Dict:
    """Load analyzed trades from shared folder"""
    base_path = Path(__file__).parent.parent
    history_file = base_path / 'docs' / 'analysis' / 'trades_summary.json'
    
    if not history_file.exists():
        print(f"Error: {history_file} not found.")
        return {}
        
    with open(history_file, 'r') as f:
        return json.load(f)


def get_market_ranges(tickers: List[str], start_date: str, end_date: str) -> Dict:
    """Fetch daily high/low for each ticker"""
    print(f"Fetching daily data for {len(tickers)} tickers from {start_date} to {end_date}...")
    
    data_map = {}
    
    # Process in batches to avoid overwhelming yfinance
    for ticker in tickers:
        # Map indices if needed (SPX -> ^SPX, SPY -> SPY)
        yf_ticker = ticker
        if ticker == 'SPX': yf_ticker = '^SPX'
        elif ticker == 'NDX': yf_ticker = '^NDX'
        
        try:
            df = yf.download(yf_ticker, start=start_date, end=end_date, progress=False)
            if not df.empty:
                # Convert index to string for easier mapping
                df.index = df.index.strftime('%Y-%m-%d')
                data_map[ticker] = df[['High', 'Low', 'Close']].to_dict('index')
        except Exception as e:
            print(f"  Error fetching {ticker}: {e}")
            
    return data_map


def analyze_missed_profits(trades: List[Dict], market_data: Dict) -> List[Dict]:
    """Identify trades where the underlying moved significantly after exit"""
    results = []
    
    for t in trades:
        ticker = t['underlying']
        # Map indices if needed for lookup
        lookup_ticker = ticker
        if ticker == 'SPX': lookup_ticker = 'SPX' # Using our internal key
        
        date = t['entry_time'][:10] # YYYY-MM-DD
        
        if lookup_ticker in market_data and date in market_data[lookup_ticker]:
            day_stats = market_data[lookup_ticker][date]
            
            # Safely handle potential multi-index or missing columns
            try:
                high = day_stats.get('High')
                low = day_stats.get('Low')
                close = day_stats.get('Close')
                
                # Check if values are not None and not NaN
                if high is not None and not pd.isna(high):
                    t['market_context'] = {
                        'day_high': float(high),
                        'day_low': float(low) if low is not None else 0,
                        'day_close': float(close) if close is not None else 0
                    }
            except Exception:
                pass
            
        results.append(t)
            
    return results


def main():
    base_path = Path(__file__).parent.parent
    data = load_trades()
    if not data: return
    
    trades = data['trades']
    
    # Get unique tickers and date range
    tickers = list(set([t['underlying'] for t in trades]))
    dates = [t['entry_time'][:10] for t in trades]
    start_date = min(dates)
    # Add one day to end_date for yfinance download
    end_date = (datetime.strptime(max(dates), '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
    
    # Fetch market data
    # Limiting to top 15 tickers to keep it free/fast for now
    top_tickers = [t[0] for t in sorted(data['statistics']['by_underlying'].items(), key=lambda x: x[1]['trades'], reverse=True)[:15]]
    market_data = get_market_ranges(top_tickers, start_date, end_date)
    
    # Correlate
    updated_trades = analyze_missed_profits(trades, market_data)
    
    # Save back to shared docs
    output_file = base_path / 'docs' / 'analysis' / 'trades_with_market.json'
    with open(output_file, 'w') as f:
        json.dump({'trades': updated_trades, 'market_data_summary': f"Correlated {len(top_tickers)} tickers"}, f, indent=2)
        
    print(f"\n✅ Correlated trades saved to: {output_file}")


if __name__ == '__main__':
    main()
