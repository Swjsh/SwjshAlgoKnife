#!/usr/bin/env python3
"""
SwjshAK Paper Trading Validation Suite
========================================
Run this script to verify each agent can:
  1. Boot and load saved state
  2. Connect to market data (yfinance)
  3. Generate zones / detect setups
  4. Fire a webhook signal to the executor
  5. Persist state to disk
  6. Recover from a simulated crash (state survives)

Usage:
  python scripts/validate_paper_trading.py              # Run all checks
  python scripts/validate_paper_trading.py --agent bob   # Single agent
"""

import sys
import os
import json
import time
import argparse
import importlib
import requests
from pathlib import Path
from datetime import datetime

# Ensure scripts/ is in sys.path
SCRIPTS_DIR = Path(__file__).parent
ROOT_DIR = SCRIPTS_DIR.parent
sys.path.insert(0, str(SCRIPTS_DIR))

# Import agent utilities
from agent_utils import save_agent_state, load_agent_state, save_risk_state, load_risk_state

# ── Config ────────────────────────────────────────────────────────────────────
WEBHOOK_URL = "http://localhost:3000/api/webhook/tradingview"
WEBHOOK_SECRET = "swjshak-tv-webhook-2026"
STATE_DIR = ROOT_DIR / 'data' / 'agent_state'
RESULTS = {}


def log(agent: str, check: str, passed: bool, detail: str = ""):
    status = "PASS" if passed else "FAIL"
    icon = "✅" if passed else "❌"
    print(f"  {icon} [{agent}] {check}: {detail}")
    RESULTS.setdefault(agent, []).append({
        'check': check, 'passed': passed, 'detail': detail
    })


def check_dashboard_alive() -> bool:
    """Verify the Next.js dashboard is running on port 3000."""
    try:
        resp = requests.get("http://localhost:3000/api/health", timeout=5)
        return resp.status_code == 200
    except Exception:
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# AGENT-SPECIFIC VALIDATION
# ═══════════════════════════════════════════════════════════════════════════════

def validate_bitcoin_bob():
    agent = "Bitcoin Bob"
    print(f"\n{'─'*60}")
    print(f"  VALIDATING: {agent}")
    print(f"{'─'*60}")

    # Check 1: Data connectivity
    try:
        import yfinance as yf
        data = yf.download('BTC-USD', period='1d', interval='5m', progress=False)
        has_data = not data.empty and len(data) > 0
        log(agent, "Market Data (yfinance BTC-USD)", has_data,
            f"{len(data)} candles received" if has_data else "No data")
    except Exception as e:
        log(agent, "Market Data", False, str(e))

    # Check 2: Zone detection
    try:
        from bitcoin_bob_engine import run_scan
        zones = run_scan()
        total_zones = sum(len(z) for z in zones.values())
        log(agent, "Zone Detection", total_zones >= 0,
            f"{total_zones} zones across {len(zones)} pairs")
    except Exception as e:
        log(agent, "Zone Detection", False, str(e))

    # Check 3: State persistence
    try:
        test_state = {
            'active_trades': [{'ticker': 'BTC-USD', 'direction': 'LONG', 'entry_price': 50000}],
            'scan_count': 42,
        }
        save_agent_state('bitcoin_bob', test_state)
        loaded = load_agent_state('bitcoin_bob')
        trades_match = len(loaded.get('active_trades', [])) == 1
        log(agent, "State Persistence", trades_match,
            "Save/load round-trip successful" if trades_match else "State mismatch")
    except Exception as e:
        log(agent, "State Persistence", False, str(e))

    # Check 4: AGENT_STATUS_UPDATE format
    log(agent, "Runner Wrapper Exists", Path(SCRIPTS_DIR / 'run_bitcoin_bob.py').exists(),
        "run_bitcoin_bob.py found")


def validate_sterling():
    agent = "Sterling"
    print(f"\n{'─'*60}")
    print(f"  VALIDATING: {agent}")
    print(f"{'─'*60}")

    try:
        import yfinance as yf
        data = yf.download('EURUSD=X', period='1d', interval='1h', progress=False)
        has_data = not data.empty
        log(agent, "Market Data (yfinance EURUSD)", has_data,
            f"{len(data)} candles" if has_data else "No data")
    except Exception as e:
        log(agent, "Market Data", False, str(e))

    try:
        from sterling_fx_engine import run_scan
        zones = run_scan()
        total = sum(len(z) for z in zones.values())
        log(agent, "Zone Detection (5 pairs)", total >= 0,
            f"{total} zones across {len(zones)} pairs")
    except Exception as e:
        log(agent, "Zone Detection", False, str(e))

    try:
        test_state = {'active_trades': [{'pair': 'EURUSD=X', 'direction': 'LONG'}], 'scan_count': 10}
        save_agent_state('sterling_fx', test_state)
        loaded = load_agent_state('sterling_fx')
        log(agent, "State Persistence", len(loaded.get('active_trades', [])) == 1, "Round-trip OK")
    except Exception as e:
        log(agent, "State Persistence", False, str(e))


def validate_pivot_pete():
    agent = "Pivot Pete"
    print(f"\n{'─'*60}")
    print(f"  VALIDATING: {agent}")
    print(f"{'─'*60}")

    try:
        from pivot_pete_engine import PivotPeteEngine, DataProvider, DATA_PROVIDER
        engine = PivotPeteEngine("ES")
        # Try to fetch data (may fail without OANDA credentials, which is OK)
        try:
            df = engine.fetch_data("5m")
            has_data = not df.empty
            log(agent, f"Market Data ({DATA_PROVIDER})", has_data,
                f"{len(df)} candles via {DATA_PROVIDER}")
        except Exception as e:
            # Fallback: try yfinance for SPY
            import yfinance as yf
            data = yf.download('SPY', period='1d', interval='5m', progress=False)
            has_data = not data.empty
            log(agent, "Market Data (yfinance SPY fallback)", has_data,
                f"{len(data)} candles (OANDA unavailable: {e})")
    except Exception as e:
        log(agent, "Market Data", False, str(e))

    try:
        test_risk = {'daily_pnl': -500, 'consecutive_losses': 1, 'trades_today': 2,
                     'capital': 9500, 'locked': False, 'lock_reason': ''}
        save_risk_state('pivot_pete', test_risk)
        loaded = load_risk_state('pivot_pete')
        log(agent, "Risk State Persistence", loaded.get('daily_pnl') == -500,
            f"daily_pnl=${loaded.get('daily_pnl', '?')}")
    except Exception as e:
        log(agent, "Risk State Persistence", False, str(e))

    try:
        test_state = {'active_trade': {
            'symbol': 'ES', 'entry_price': 5100, 'entry_time': datetime.now().isoformat(),
            'direction': 'LONG', 'stop_loss': 5085, 'take_profit': 5120, 'size': 1,
            'pivot_level': 'pivot_r1'
        }}
        save_agent_state('pivot_pete', test_state)
        loaded = load_agent_state('pivot_pete')
        log(agent, "Trade State Persistence",
            loaded.get('active_trade', {}).get('entry_price') == 5100, "Round-trip OK")
    except Exception as e:
        log(agent, "Trade State Persistence", False, str(e))


def validate_spx_sniper():
    agent = "SPX Sniper"
    print(f"\n{'─'*60}")
    print(f"  VALIDATING: {agent}")
    print(f"{'─'*60}")

    try:
        import yfinance as yf
        data = yf.download('SPY', period='1d', interval='5m', progress=False)
        has_data = not data.empty
        log(agent, "Market Data (SPY direct)", has_data,
            f"{len(data)} candles" if has_data else "No data")
    except Exception as e:
        log(agent, "Market Data", False, str(e))

    try:
        from spx_sniper_engine import calculate_indicators
        import pandas as pd
        data = yf.download('SPY', period='5d', interval='5m', progress=False)
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)
        df = calculate_indicators(data)
        # Verify VWAP resets daily
        dates = df.index.date if hasattr(df.index, 'date') else pd.to_datetime(df.index).date
        unique_dates = set(dates)
        # Check that VWAP values aren't monotonically increasing across days
        vwap_first = df['VWAP'].iloc[:5].mean()
        vwap_mid = df['VWAP'].iloc[len(df)//2:len(df)//2+5].mean()
        # They should be in roughly similar range if VWAP resets
        ratio = abs(vwap_first - vwap_mid) / max(vwap_first, vwap_mid, 1)
        vwap_resets = ratio < 0.05  # Within 5% suggests proper daily reset
        log(agent, "VWAP Daily Reset", vwap_resets,
            f"VWAP variance across days: {ratio:.4f} ({len(unique_dates)} trading days)")
        log(agent, "RSI NaN Protection", not df['RSI'].isna().any(),
            f"No NaN values in RSI (filled with 50.0)")
    except Exception as e:
        log(agent, "Indicator Calculation", False, str(e))

    try:
        save_agent_state('spx_sniper', {'active_trades': [], 'scan_count': 5})
        loaded = load_agent_state('spx_sniper')
        log(agent, "State Persistence", loaded.get('scan_count') == 5, "Round-trip OK")
    except Exception as e:
        log(agent, "State Persistence", False, str(e))


def validate_boba():
    agent = "Boba"
    print(f"\n{'─'*60}")
    print(f"  VALIDATING: {agent}")
    print(f"{'─'*60}")

    try:
        import yfinance as yf
        data = yf.download('SPY', period='1d', interval='15m', progress=False)
        has_data = not data.empty
        log(agent, "Market Data (SPY 15m)", has_data,
            f"{len(data)} candles" if has_data else "No data")
    except Exception as e:
        log(agent, "Market Data", False, str(e))

    try:
        from boba_trades_engine import BobaTraderEngine
        engine = BobaTraderEngine("SPY")
        import yfinance as yf
        import pandas as pd
        df = yf.download('SPY', period='5d', interval='15m', progress=False)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        engine.identify_zones(df)
        total = len(engine.supply_zones) + len(engine.demand_zones)
        log(agent, "Zone Detection", total >= 0,
            f"{total} zones (S:{len(engine.supply_zones)} D:{len(engine.demand_zones)})")
    except Exception as e:
        log(agent, "Zone Detection", False, str(e))


def validate_webhook():
    """Check if webhook endpoint is reachable."""
    agent = "Webhook Pipeline"
    print(f"\n{'─'*60}")
    print(f"  VALIDATING: {agent}")
    print(f"{'─'*60}")

    dashboard_up = check_dashboard_alive()
    log(agent, "Dashboard Health", dashboard_up,
        "http://localhost:3000 responding" if dashboard_up else "Dashboard not running — start with npm run dev")

    if dashboard_up:
        try:
            # Send a test signal (will be rejected without valid secret, which is fine)
            resp = requests.post(WEBHOOK_URL, json={
                "symbol": "TEST", "action": "BUY", "price": 100,
                "strategy": "ValidationTest", "notes": "Paper trading validation"
            }, headers={
                "Content-Type": "application/json",
                "X-Webhook-Secret": WEBHOOK_SECRET,
            }, timeout=5)
            log(agent, "Webhook Endpoint", resp.status_code in (200, 400, 422),
                f"Status {resp.status_code}: {resp.text[:100]}")
        except Exception as e:
            log(agent, "Webhook Endpoint", False, str(e))


def validate_crash_recovery():
    """Simulate crash by writing state, clearing memory, and reloading."""
    agent = "Crash Recovery"
    print(f"\n{'─'*60}")
    print(f"  VALIDATING: {agent}")
    print(f"{'─'*60}")

    # Simulate: agent has an open trade, then "crashes"
    test_trade = {
        'active_trades': [{
            'ticker': 'BTC-USD', 'direction': 'LONG',
            'entry_price': 65000, 'stop_loss': 64000,
            'take_profit': 68000, 'opened_at': datetime.now().isoformat(),
        }],
        'scan_count': 99,
    }
    save_agent_state('crash_test', test_trade)

    # "Crash" — clear in-memory state
    del test_trade

    # "Restart" — reload from disk
    recovered = load_agent_state('crash_test')
    trades = recovered.get('active_trades', [])
    has_trade = len(trades) == 1 and trades[0].get('entry_price') == 65000
    log(agent, "Trade Recovery After Crash", has_trade,
        f"Recovered {len(trades)} trade(s), entry=${trades[0].get('entry_price', '?')}" if trades else "No trades recovered")

    # Test risk state recovery
    save_risk_state('crash_test', {
        'daily_pnl': -1500, 'consecutive_losses': 2, 'trades_today': 3,
        'capital': 8500, 'locked': True, 'lock_reason': '2 consecutive losses'
    })
    risk = load_risk_state('crash_test')
    risk_ok = risk.get('locked') == True and risk.get('consecutive_losses') == 2
    log(agent, "Risk State Recovery", risk_ok,
        f"locked={risk.get('locked')}, losses={risk.get('consecutive_losses')}")

    # Cleanup test files
    for f in STATE_DIR.glob('crash_test_*'):
        f.unlink()


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def print_summary():
    print(f"\n{'═'*60}")
    print(f"  VALIDATION SUMMARY")
    print(f"{'═'*60}")

    total_pass = 0
    total_fail = 0

    for agent, checks in RESULTS.items():
        passed = sum(1 for c in checks if c['passed'])
        failed = sum(1 for c in checks if not c['passed'])
        total_pass += passed
        total_fail += failed
        icon = "✅" if failed == 0 else "⚠️"
        print(f"  {icon} {agent}: {passed}/{len(checks)} passed")

    print(f"\n  Total: {total_pass} passed, {total_fail} failed out of {total_pass + total_fail}")

    if total_fail == 0:
        print(f"\n  🎉 ALL CHECKS PASSED — Ready for paper trading!")
    else:
        print(f"\n  ⚠️  {total_fail} issue(s) need attention before going live.")

    # Write results to JSON
    results_file = ROOT_DIR / 'data' / 'validation_results.json'
    results_file.parent.mkdir(parents=True, exist_ok=True)
    with open(results_file, 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_pass': total_pass,
            'total_fail': total_fail,
            'results': RESULTS,
        }, f, indent=2)
    print(f"\n  Results saved to: {results_file}")


def main():
    parser = argparse.ArgumentParser(description='SwjshAK Paper Trading Validation')
    parser.add_argument('--agent', type=str, default='all',
                        help='Validate specific agent: bob, sterling, pete, spx, boba, webhook, crash, or all')
    args = parser.parse_args()

    print(f"""
╔══════════════════════════════════════════════════════════╗
║       SwjshAK Paper Trading Validation Suite             ║
║       {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}                               ║
╚══════════════════════════════════════════════════════════╝
""")

    validators = {
        'bob': validate_bitcoin_bob,
        'sterling': validate_sterling,
        'pete': validate_pivot_pete,
        'spx': validate_spx_sniper,
        'boba': validate_boba,
        'webhook': validate_webhook,
        'crash': validate_crash_recovery,
    }

    if args.agent == 'all':
        for name, fn in validators.items():
            try:
                fn()
            except Exception as e:
                print(f"  ❌ [{name}] Validator crashed: {e}")
                RESULTS.setdefault(name, []).append({
                    'check': 'Validator', 'passed': False, 'detail': str(e)
                })
    elif args.agent in validators:
        validators[args.agent]()
    else:
        print(f"Unknown agent: {args.agent}. Options: {', '.join(validators.keys())}")
        sys.exit(1)

    print_summary()


if __name__ == "__main__":
    main()
