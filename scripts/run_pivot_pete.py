#!/usr/bin/env python3
"""
Pivot Pete Runner - Integrates with agent_runner.ts
Outputs JSON status for the agents dashboard
"""

import sys
import json
from datetime import datetime
from pivot_pete_engine import PivotPeteEngine
import time

def main():
    """Run Pivot Pete and output status JSON"""
    engine = PivotPeteEngine("ES=F")
    
    print(f"[Pivot Pete] Starting Futures Engine (ES=F)...", flush=True)
    
    while True:
        try:
            now = datetime.now().strftime('%H:%M:%S')
            print(f"[{now}] Pivot Pete Scanning ES Futures (5m/1h/4h)...", flush=True)


            
            # Fetch data
            df_5m = engine.fetch_data(period="5d", interval="5m")
            df_1h = engine.fetch_data(period="1mo", interval="1h")
            df_4h = engine.fetch_data(period="3mo", interval="1d")
            
            if df_5m.empty:
                print(json.dumps({"error": "No data available"}))
            else:
                # Update pivot levels
                engine.update_pivot_levels(df_5m, df_1h, df_4h)
                
                current_price = df_5m['Close'].iloc[-1]
                
                # Check for trades
                if engine.active_trade:
                    engine.check_exit(current_price)
                elif engine.risk_manager.can_trade()[0]:
                    signal = engine.check_entry_signal(current_price, df_5m)
                    if signal:
                        engine.execute_trade(signal)
                
                # Get status
                status = engine.get_status()
                
                # Format for agent system
                output = {
                    "last_updated": datetime.now().isoformat(),
                    "status": "ACTIVE" if status['can_trade'] else "INACTIVE",
                    "active_pairs": 1,  # ES
                    "total_zones_found": status['pivot_levels_count'],
                    "performance": {
                        "win_rate": 0,  # Calculate from trades
                        "total_pnl": status['daily_pnl'],
                        "trades": status['trades_today']
                    },
                    "pending_orders": [],
                    "closed_trades": [],
                    "meta": {
                        "name": "Pivot Pete",
                        "type": "Futures"
                    }
                }
                
                # Add active trade if exists
                if status['active_trade']:
                    trade = status['active_trade']
                    output['pending_orders'].append({
                        "created_at": trade['entry_time'],
                        "type": "DEMAND" if trade['direction'] == "LONG" else "SUPPLY",
                        "ticker": "ES",
                        "entry": trade['entry_price'],
                        "stop_loss": trade['stop_loss'],
                        "status": "ACTIVE"
                    })
                
                # Output JSON for the runner
                print("AGENT_STATUS_UPDATE:" + json.dumps(output), flush=True)
                
                # Heartbeat for terminal
                print(f"[SUCCESS] [{datetime.now().strftime('%H:%M:%S')}] Pivot Pete update successful. {status['pivot_levels_count']} pivots monitored.", flush=True)
                
        except Exception as e:
            print(f"[ERROR] [Pivot Pete Error] {e}", file=sys.stderr, flush=True)



        # Wait 5 minutes before next scan
        time.sleep(300)

if __name__ == "__main__":
    main()
