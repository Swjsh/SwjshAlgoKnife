#!/usr/bin/env python3
"""
SPX Sniper Runner - Integrates with agent_runner.ts
Outputs JSON status for the agents dashboard
"""

import sys
import json
from datetime import datetime
from spx_sniper_engine import SPXSniperEngine
import time

def main():
    """Run SPX Sniper and output status JSON"""
    engine = SPXSniperEngine("SPX")
    
    print(f"[SPX Sniper] Starting Options Engine (SPX)...", flush=True)
    
    while True:
        try:
            now = datetime.now().strftime('%H:%M:%S')
            print(f"[{now}] SPX Sniper Scanning SPX 15m zones...", flush=True)

            
            # Fetch data (15m for zones)
            df_15m = engine.fetch_data(period="5d", interval="15m")
            
            if df_15m.empty:
                print(json.dumps({"error": "No data available"}), flush=True)
            else:
                # Identify zones
                engine.identify_zones(df_15m)
                
                # Get latest price and time
                current_price = df_15m['Close'].iloc[-1]
                current_time = datetime.now()
                
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
                
                # Build JSON output
                output = {
                    "last_updated": datetime.now().isoformat(),
                    "status": "ACTIVE",
                    "active_pairs": 1,
                    "total_zones_found": len(engine.demand_zones) + len(engine.supply_zones),
                    "performance": {
                        "win_rate": status.get("win_rate", 0),
                        "total_pnl": status.get("total_pnl", 0),
                        "trades": status.get("total_trades", 0)
                    },
                    "pending_orders": status.get("pending_orders", []),
                    "closed_trades": status.get("closed_trades", []),
                    "meta": {
                        "name": "SPX Sniper",
                        "type": "Options"
                    }
                }
                
                # Output JSON with prefix for agent_runner.ts
                print(f"AGENT_STATUS_UPDATE:{json.dumps(output)}", flush=True)
                print(f"[SUCCESS] SPX Sniper update successful.", flush=True)
        
        except Exception as e:
            print(f"[ERROR] SPX Sniper error: {e}", flush=True)
        
        # Sleep for 5 minutes
        time.sleep(300)

if __name__ == "__main__":
    main()
