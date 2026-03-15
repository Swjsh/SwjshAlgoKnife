#!/usr/bin/env python3
"""
Agent Backtest Runner
====================
Simple wrapper to run backtests for any agent using their pre-configured settings.

Usage:
  python scripts/run_backtest_agent.py pivot_pete --from 2025-06-01 --to 2026-03-14
  python scripts/run_backtest_agent.py bitcoin_bob --from 2025-01-01 --to 2026-03-14
  python scripts/run_backtest_agent.py boba_trades --from 2025-09-01 --to 2026-03-14 --all-symbols

  # Custom parameters
  python scripts/run_backtest_agent.py pivot_pete --from 2025-06-01 --to 2026-03-14 --risk 0.02 --capital 50000

  # Compare all agents
  python scripts/run_backtest_agent.py compare --from 2025-01-01 --to 2026-03-14
"""

import argparse
import sys
import subprocess
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))
from backtest_config import get_agent_config, AGENT_CONFIGS


def run_backtest(agent_name: str, start: str, end: str, **overrides):
    """Run backtest for an agent with optional parameter overrides."""

    config = get_agent_config(agent_name)

    # Apply overrides
    symbol = overrides.get('symbol', config['primary_symbol'])
    timeframe = overrides.get('timeframe', config['timeframe'])
    strategy = overrides.get('strategy', config['strategy'])
    capital = overrides.get('capital', config['initial_capital'])
    risk = overrides.get('risk', config['risk_per_trade'])

    print(f"\n{'=' * 60}")
    print(f"  Running backtest for: {config['name']}")
    print(f"  Symbol: {symbol}")
    print(f"  Strategy: {strategy}")
    print(f"  Period: {start} -> {end}")
    print(f"  Timeframe: {timeframe}")
    print(f"{'=' * 60}\n")

    # Build command
    cmd = [
        sys.executable,
        "scripts/universal_backtest.py",
        "--symbol", symbol,
        "--strategy", strategy,
        "--from", start,
        "--to", end,
        "--tf", timeframe,
        "--balance", str(capital),
        "--risk", str(risk),
    ]

    # Run backtest
    result = subprocess.run(cmd, cwd=Path(__file__).parent.parent)
    return result.returncode == 0


def compare_agents(start: str, end: str, **overrides):
    """Run backtests for all agents and compare results."""

    print(f"\n{'=' * 80}")
    print(f"  COMPARING ALL AGENTS")
    print(f"  Period: {start} -> {end}")
    print(f"{'=' * 80}\n")

    results = {}

    for agent_name in AGENT_CONFIGS.keys():
        print(f"\n  Running {agent_name}...")
        success = run_backtest(agent_name, start, end, **overrides)
        results[agent_name] = "[OK]" if success else "[FAIL]"

    print(f"\n{'=' * 80}")
    print(f"  COMPARISON COMPLETE")
    print(f"{'=' * 80}")
    for agent_name, status in results.items():
        print(f"  {agent_name:<20} {status}")
    print(f"{'=' * 80}\n")


def main():
    parser = argparse.ArgumentParser(description="Run backtests for SwjshAK agents")
    parser.add_argument("agent", help=f"Agent name: {', '.join(AGENT_CONFIGS.keys())}, or 'compare'")
    parser.add_argument("--from", dest="start", required=True, help="Start date YYYY-MM-DD")
    parser.add_argument("--to", dest="end", required=True, help="End date YYYY-MM-DD")
    parser.add_argument("--symbol", help="Override default symbol")
    parser.add_argument("--timeframe", help="Override default timeframe")
    parser.add_argument("--strategy", help="Override default strategy")
    parser.add_argument("--capital", type=float, help="Override initial capital")
    parser.add_argument("--risk", type=float, help="Override risk per trade")
    parser.add_argument("--all-symbols", action="store_true", help="Run on all agent symbols")

    args = parser.parse_args()

    overrides = {}
    if args.symbol:
        overrides['symbol'] = args.symbol
    if args.timeframe:
        overrides['timeframe'] = args.timeframe
    if args.strategy:
        overrides['strategy'] = args.strategy
    if args.capital:
        overrides['capital'] = args.capital
    if args.risk:
        overrides['risk'] = args.risk

    if args.agent == "compare":
        compare_agents(args.start, args.end, **overrides)
    elif args.agent in AGENT_CONFIGS:
        if args.all_symbols:
            # Run on all symbols for this agent
            config = get_agent_config(args.agent)
            for symbol in config['symbols']:
                overrides['symbol'] = symbol
                run_backtest(args.agent, args.start, args.end, **overrides)
        else:
            run_backtest(args.agent, args.start, args.end, **overrides)
    else:
        print(f"ERROR: Unknown agent '{args.agent}'")
        print(f"Available agents: {', '.join(AGENT_CONFIGS.keys())}, compare")
        sys.exit(1)


if __name__ == "__main__":
    main()
