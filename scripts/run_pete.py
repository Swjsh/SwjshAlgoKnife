#!/usr/bin/env python3
"""
Quick runner for Pivot Pete - handles Windows encoding
Usage: python scripts/run_pete.py [ES|NQ|GC]
"""

import sys
import os

# Fix Windows encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# Now import and run
from pivot_pete_engine import PivotPeteEngine, RiskManager
import yfinance as yf
from datetime import datetime
import time

def main():
    # Parse symbol
    symbol = "ES=F"
    if len(sys.argv) > 1:
        arg = sys.argv[1].upper()
        symbols = {"ES": "ES=F", "NQ": "NQ=F", "GC": "GC=F", "GOLD": "GC=F"}
        symbol = symbols.get(arg, "ES=F")
    
    print("\n" + "="*60)
    print("        PIVOT PETE - Socrates Methodology")
    print("="*60)
    print(f"  Symbol: {symbol}")
    print(f"  Mode: Paper Trading (yfinance - delayed data)")
    print(f"  Risk: Max $4K/day | 2 losses = done")
    print("="*60 + "\n")
    
    engine = PivotPeteEngine(symbol)
    print(f"Starting capital: ${engine.risk_manager.current_capital:,.2f}\n")
    
    iteration = 0
    while True:
        try:
            iteration += 1
            now = datetime.now().strftime('%H:%M:%S')
            print(f"\n[{now}] Scan #{iteration}")
            print("-" * 40)
            
            # Fetch data
            df_5m = engine.fetch_data(period="5d", interval="5m")
            df_1h = engine.fetch_data(period="1mo", interval="1h")
            df_daily = engine.fetch_data(period="3mo", interval="1d")
            
            if df_5m.empty:
                print("  No data - market closed?")
                time.sleep(60)
                continue
            
            # Update levels
            engine.update_pivot_levels(df_5m, df_1h, df_daily)
            
            current = df_5m['Close'].iloc[-1]
            vol_ratio = engine.volume_analyzer.get_volume_spike_ratio(df_5m)
            
            print(f"  Price: ${current:,.2f}")
            print(f"  Volume: {vol_ratio:.1f}x average")
            print(f"  Pivots: {len(engine.pivot_levels)} levels")
            print(f"  Bias: {engine.higher_tf_bias}")
            
            # Risk check
            can_trade, reason = engine.risk_manager.can_trade()
            if not can_trade:
                print(f"  Status: {reason}")
            else:
                print(f"  Status: Ready to trade")
            
            # Check active trade
            if engine.active_trade:
                t = engine.active_trade
                print(f"\n  OPEN: {t.direction} @ ${t.entry_price:,.2f}")
                print(f"  SL: ${t.stop_loss:,.2f} | TP: ${t.take_profit:,.2f}")
                engine.check_exit(current)
            elif can_trade:
                signal = engine.check_entry_signal(current, df_5m)
                if signal:
                    engine.execute_trade(signal)
            
            # Stats
            stats = engine.risk_manager.get_stats()
            print(f"\n  Capital: ${stats['capital']:,.2f}")
            print(f"  Daily P&L: ${stats['daily_pnl']:+,.2f}")
            print(f"  Trades today: {stats['trades_today']}")
            
            print(f"\n  Next scan in 5 min... (Ctrl+C to stop)")
            time.sleep(300)
            
        except KeyboardInterrupt:
            print("\n\nShutting down...")
            stats = engine.get_status()
            print(f"\nFinal Stats:")
            print(f"  Capital: ${stats['capital']:,.2f}")
            print(f"  Daily P&L: ${stats['daily_pnl']:+,.2f}")
            print(f"  Trades: {stats['trades_today']}")
            break
        except Exception as e:
            print(f"  Error: {e}")
            time.sleep(60)

if __name__ == "__main__":
    main()
