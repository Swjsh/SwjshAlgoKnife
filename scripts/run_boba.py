#!/usr/bin/env python3
"""
Boba Runner - Integrates with agent_runner.ts
Outputs JSON status for the agents dashboard
"""

import sys
import json
from datetime import datetime
from boba_trades_engine import BobaTraderEngine
import time

def main():
    """Run Boba and output status JSON"""
    engine = BobaTraderEngine("SPY")
    
    print(f"[Boba] Starting Options Engine (SPY)...", flush=True)
    
    while True:
        try:
            now = datetime.now().strftime('%H:%M:%S')
            print(f"[{now}] Boba Scanning SPY 15m zones...", flush=True)


            
            # Fetch data (15m for zones)
            df_15m = engine.fetch_data(period="5d", interval="15m")
            
            if df_15m.empty:
                print(json.dumps({"error": "No data available"}))
            else:
                # Identify zones
                engine.identify_zones(df_15m)
                
                # Get latest price and time
                current_price = df_15m['Close'].iloc[-1]
                current_time = datetime.now() # In real usage, sync with market time
                
                # Check for signals
                if engine.active_trade:
                    # Simple simulation: Check if hit SL or target
                    pass
                else:
                    signal = engine.check_signals(current_price, current_time)
                    if signal:
                        engine.execute_trade(signal)
                
                # Get status
                status = engine.get_status()
                
                # Format for agent system
                output = {
                    "last_updated": datetime.now().isoformat(),
                    "status": "ACTIVE",
                    "active_pairs": 1,  # SPY
                    "total_zones_found": status['zones_found'],
                    "performance": {
                        "win_rate": 65,  # Estimated from strategy guide
                        "total_pnl": status['daily_pnl'],
                        "trades": status['trades_today']
                    },
                    "pending_orders": [],
                    "closed_trades": [],
                    "meta": {
                        "name": "Boba",
                        "type": "Options"
                    }
                }
                
                # Add active trade if exists
                if status['active_trade']:
                    trade = status['active_trade']
                    output['pending_orders'].append({
                        "created_at": trade['entry_time'],
                        "type": "DEMAND" if trade['direction'] == "LONG" else "SUPPLY",
                        "ticker": "SPY",
                        "entry": trade['entry_price'],
                        "stop_loss": trade['stop_loss'],
                        "status": "ACTIVE"
                    })
                
                # Output JSON on a single line for the runner to parse easily
                print("AGENT_STATUS_UPDATE:" + json.dumps(output), flush=True)
                
                # Heartbeat for terminal
                print(f"[SUCCESS] [{datetime.now().strftime('%H:%M:%S')}] Boba update successful. {output['total_zones_found']} zones tracked.", flush=True)
                
        except Exception as e:
            print(f"[ERROR] [Boba Error] {e}", file=sys.stderr, flush=True)


            
        # Wait 5 minutes before next scan
        time.sleep(300)

if __name__ == "__main__":
    main()
