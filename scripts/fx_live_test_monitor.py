#!/usr/bin/env python3
"""
FX Bot Live Test Monitor
Runs the FX engine every hour for 12-24 hours and logs results
"""

import time
import json
from datetime import datetime
from pathlib import Path
import subprocess

# Configuration
TEST_DURATION_HOURS = 24
SCAN_INTERVAL_SECONDS = 3600  # 1 hour
LOG_FILE = Path(__file__).parent.parent / 'data' / 'fx_live_test_log.json'

def run_fx_scan():
    """Execute FX engine and return results"""
    print(f"\n{'='*60}")
    print(f"🔍 Running FX Scan at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")
    
    try:
        result = subprocess.run(
            ['python', 'scripts/swjsh_fx_engine.py'],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent.parent
        )
        
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        
        # Load the status file to get zone count
        status_file = Path(__file__).parent.parent / 'data' / 'fx_agent_status.json'
        if status_file.exists():
            with open(status_file, 'r') as f:
                status = json.load(f)
                return {
                    'timestamp': datetime.now().isoformat(),
                    'zones_found': status.get('total_zones_found', 0),
                    'pending_orders': len(status.get('pending_orders', [])),
                    'success': result.returncode == 0,
                    'error': result.stderr if result.returncode != 0 else None
                }
        
        return {
            'timestamp': datetime.now().isoformat(),
            'success': result.returncode == 0,
            'error': result.stderr if result.returncode != 0 else None
        }
        
    except Exception as e:
        print(f"❌ Error running FX scan: {e}")
        return {
            'timestamp': datetime.now().isoformat(),
            'success': False,
            'error': str(e)
        }

def main():
    """Main monitoring loop"""
    print(f"""
╔════════════════════════════════════════════════════════════╗
║          FX BOT LIVE TEST MONITOR                          ║
║          Duration: {TEST_DURATION_HOURS} hours                                   ║
║          Scan Interval: {SCAN_INTERVAL_SECONDS//60} minutes                              ║
╚════════════════════════════════════════════════════════════╝
    """)
    
    # Initialize log file
    test_log = {
        'start_time': datetime.now().isoformat(),
        'test_duration_hours': TEST_DURATION_HOURS,
        'scan_interval_seconds': SCAN_INTERVAL_SECONDS,
        'scans': []
    }
    
    start_time = time.time()
    end_time = start_time + (TEST_DURATION_HOURS * 3600)
    scan_count = 0
    
    try:
        while time.time() < end_time:
            scan_count += 1
            
            # Run scan
            scan_result = run_fx_scan()
            test_log['scans'].append(scan_result)
            
            # Save log
            with open(LOG_FILE, 'w') as f:
                json.dump(test_log, f, indent=2)
            
            # Print summary
            total_zones = sum(s.get('zones_found', 0) for s in test_log['scans'])
            successful_scans = sum(1 for s in test_log['scans'] if s.get('success', False))
            
            print(f"\n📊 Test Summary:")
            print(f"   Scans Completed: {scan_count}")
            print(f"   Successful: {successful_scans}/{scan_count}")
            print(f"   Total Zones Found: {total_zones}")
            print(f"   Log File: {LOG_FILE}")
            
            # Calculate time until next scan
            elapsed = time.time() - start_time
            remaining = end_time - time.time()
            hours_remaining = remaining / 3600
            
            print(f"\n⏰ Time Remaining: {hours_remaining:.1f} hours")
            
            if time.time() < end_time:
                print(f"⏳ Next scan in {SCAN_INTERVAL_SECONDS//60} minutes...")
                print(f"{'='*60}\n")
                time.sleep(SCAN_INTERVAL_SECONDS)
        
        # Test complete
        test_log['end_time'] = datetime.now().isoformat()
        test_log['total_scans'] = scan_count
        test_log['total_zones_found'] = sum(s.get('zones_found', 0) for s in test_log['scans'])
        
        with open(LOG_FILE, 'w') as f:
            json.dump(test_log, f, indent=2)
        
        print(f"\n{'='*60}")
        print(f"✅ TEST COMPLETE!")
        print(f"{'='*60}")
        print(f"Total Scans: {scan_count}")
        print(f"Total Zones Found: {test_log['total_zones_found']}")
        print(f"Results saved to: {LOG_FILE}")
        
    except KeyboardInterrupt:
        print(f"\n\n⚠️ Test interrupted by user")
        test_log['end_time'] = datetime.now().isoformat()
        test_log['interrupted'] = True
        
        with open(LOG_FILE, 'w') as f:
            json.dump(test_log, f, indent=2)
        
        print(f"Partial results saved to: {LOG_FILE}")

if __name__ == "__main__":
    main()
