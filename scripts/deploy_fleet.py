#!/usr/bin/env python3
"""
SwjshAK Fleet Deployment — Launch All Agents
==============================================
Orchestrates the full agent fleet startup with pre-flight checks.

Usage:
  python scripts/deploy_fleet.py              # Full deployment
  python scripts/deploy_fleet.py --validate   # Validate only, don't start
  python scripts/deploy_fleet.py --agent bob  # Start single agent
"""

import argparse
import subprocess
import json
import sys
import os
import time
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).parent.parent
SCRIPTS = ROOT / 'scripts'
DATA = ROOT / 'data'
LOGS = DATA / 'logs'

AGENTS = {
    'bob':      {'name': 'AK-BitcoinBob', 'script': 'run_bitcoin_bob.py',    'type': 'python', 'market': '24/7 Crypto'},
    'sterling': {'name': 'AK-Sterling',    'script': 'sterling_fx_engine.py', 'type': 'python', 'market': 'FX 24/5'},
    'pete':     {'name': 'AK-PivotPete',   'script': 'pivot_pete_engine.py',  'type': 'python', 'market': 'US Equities 9:30-16:00'},
    'spx':      {'name': 'AK-SPXSniper',   'script': 'spx_sniper_engine.py',  'type': 'python', 'market': 'SPY 10:30-15:50'},
    'boba':     {'name': 'AK-Boba',        'script': 'boba_trades_engine.py', 'type': 'python', 'market': 'SPY Options 9:30-11:00'},
    'orb':      {'name': 'AK-ORBAgent',    'script': 'run_orb_agent.ts',      'type': 'typescript', 'market': 'US Equities 9:30-16:00'},
}


def check_prerequisites():
    """Verify environment is ready for deployment."""
    print("\n[1/4] Checking prerequisites...")
    checks = []

    # Python packages
    try:
        import yfinance
        checks.append(("yfinance", True, yfinance.__version__))
    except ImportError:
        checks.append(("yfinance", False, "pip install yfinance"))

    try:
        import pandas
        checks.append(("pandas", True, pandas.__version__))
    except ImportError:
        checks.append(("pandas", False, "pip install pandas"))

    try:
        import requests
        checks.append(("requests", True, requests.__version__))
    except ImportError:
        checks.append(("requests", False, "pip install requests"))

    # Check .env.local exists
    env_file = ROOT / '.env.local'
    checks.append((".env.local", env_file.exists(), str(env_file) if env_file.exists() else "Missing"))

    # Check data directory
    DATA.mkdir(parents=True, exist_ok=True)
    LOGS.mkdir(parents=True, exist_ok=True)
    checks.append(("data/logs directory", True, str(LOGS)))

    # Check PM2
    try:
        result = subprocess.run(['pm2', '--version'], capture_output=True, text=True, timeout=5)
        checks.append(("PM2", result.returncode == 0, result.stdout.strip()))
    except (FileNotFoundError, subprocess.TimeoutExpired):
        checks.append(("PM2", False, "npm install -g pm2"))

    all_pass = True
    for name, ok, detail in checks:
        icon = "✅" if ok else "❌"
        print(f"  {icon} {name}: {detail}")
        if not ok:
            all_pass = False

    return all_pass


def check_dashboard():
    """Verify dashboard is running."""
    print("\n[2/4] Checking dashboard...")
    try:
        import requests as req
        resp = req.get("http://localhost:3000/api/health", timeout=5)
        if resp.status_code == 200:
            print("  ✅ Dashboard running on http://localhost:3000")
            return True
    except Exception:
        pass
    print("  ⚠️  Dashboard not running. Start with: npm run dev")
    print("     (Agents will still work — signals queue until dashboard starts)")
    return False


def validate_agents():
    """Quick validation of each agent."""
    print("\n[3/4] Validating agents...")
    results = {}

    for key, info in AGENTS.items():
        script_path = SCRIPTS / info['script']
        exists = script_path.exists()
        icon = "✅" if exists else "❌"
        print(f"  {icon} {info['name']}: {info['script']} ({'found' if exists else 'MISSING'}) — {info['market']}")
        results[key] = exists

    return all(results.values())


def deploy_fleet(agents_to_start=None):
    """Start agents via PM2."""
    print("\n[4/4] Deploying fleet...")

    if agents_to_start is None:
        # Start all via ecosystem config
        eco_path = SCRIPTS / 'ecosystem.config.js'
        print(f"  Starting all agents via {eco_path}...")
        try:
            result = subprocess.run(
                ['pm2', 'start', str(eco_path)],
                cwd=str(ROOT),
                capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0:
                print("  ✅ All agents started successfully")
                print(result.stdout)
            else:
                print(f"  ❌ PM2 start failed: {result.stderr}")
                return False
        except Exception as e:
            print(f"  ❌ Deployment error: {e}")
            return False
    else:
        # Start specific agent
        for agent_key in agents_to_start:
            if agent_key not in AGENTS:
                print(f"  ❌ Unknown agent: {agent_key}")
                continue
            info = AGENTS[agent_key]
            print(f"  Starting {info['name']}...")
            try:
                result = subprocess.run(
                    ['pm2', 'restart', info['name']],
                    cwd=str(ROOT),
                    capture_output=True, text=True, timeout=15
                )
                if result.returncode != 0:
                    # Try start instead of restart
                    result = subprocess.run(
                        ['pm2', 'start', str(SCRIPTS / 'ecosystem.config.js'), '--only', info['name']],
                        cwd=str(ROOT),
                        capture_output=True, text=True, timeout=15
                    )
                print(f"  {'✅' if result.returncode == 0 else '❌'} {info['name']}: {result.stdout.strip()[:100]}")
            except Exception as e:
                print(f"  ❌ {info['name']}: {e}")

    # Wait a moment then show status
    time.sleep(3)
    print("\n  Fleet status:")
    try:
        result = subprocess.run(['pm2', 'list'], capture_output=True, text=True, timeout=10)
        print(result.stdout)
    except Exception:
        print("  (pm2 list unavailable)")

    return True


def print_monitoring_guide():
    """Print helpful monitoring commands."""
    print(f"""
{'='*60}
  FLEET DEPLOYED — MONITORING GUIDE
{'='*60}

  View all logs:        pm2 logs
  View specific agent:  pm2 logs AK-BitcoinBob
  Agent status:         pm2 list
  Restart an agent:     pm2 restart AK-PivotPete
  Stop all:             pm2 stop all
  Kill switch:          curl -X POST http://localhost:3000/api/killswitch

  Dashboard:            http://localhost:3000/agents
  Validation:           python scripts/validate_paper_trading.py

  State files:          {DATA / 'agent_state'}/
  Log files:            {LOGS}/
""")


def main():
    parser = argparse.ArgumentParser(description='SwjshAK Fleet Deployment')
    parser.add_argument('--validate', action='store_true', help='Validate only, do not start')
    parser.add_argument('--agent', type=str, help='Start specific agent(s), comma-separated')
    args = parser.parse_args()

    print(f"""
╔══════════════════════════════════════════════════════════╗
║       SwjshAK Fleet Deployment                           ║
║       {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}                               ║
║       6 Agents | Paper Trading Mode                      ║
╚══════════════════════════════════════════════════════════╝
""")

    prereqs_ok = check_prerequisites()
    dashboard_ok = check_dashboard()
    agents_ok = validate_agents()

    if args.validate:
        print(f"\n{'='*60}")
        print(f"  Validation {'PASSED' if prereqs_ok and agents_ok else 'FAILED'}")
        print(f"{'='*60}")
        sys.exit(0 if prereqs_ok and agents_ok else 1)

    if not prereqs_ok:
        print("\n  ❌ Prerequisites not met. Fix the issues above first.")
        sys.exit(1)

    agents_to_start = args.agent.split(',') if args.agent else None
    deploy_fleet(agents_to_start)
    print_monitoring_guide()


if __name__ == "__main__":
    main()
