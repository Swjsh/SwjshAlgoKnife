#!/usr/bin/env python3
"""
Mutable Strategy Target — SwjshAlgoKnife AutoResearch Loop
============================================================
Karpathy Convention: prepare.py → strategy.py → eval cycle

This script provides a mutable strategy interface that the Surgeon skill
can autonomously tune via eval→mutate→backtest→commit cycles.

Usage:
  # Run strategy with default params (from backtest_config.py)
  python scripts/strategy.py --agent spx_sniper

  # Run with custom params (overrides)
  python scripts/strategy.py --agent spx_sniper --param rr=2.5 --param orb_duration=20

  # Run on cached data (fast, no network - requires prepare.py first)
  python scripts/strategy.py --agent spx_sniper --use-cache

  # Save current params to config file
  python scripts/strategy.py --agent spx_sniper --save-config

  # Load params from config file
  python scripts/strategy.py --agent spx_sniper --load-config data/configs/spx_sniper_tuned.json

  # Output to specific file
  python scripts/strategy.py --agent spx_sniper --output data/backtests/spx_tuned.json

Mutable Parameters:
  The Surgeon skill can modify strategy_params in backtest_config.py or
  use --param overrides to test variations without changing source code.

Output:
  JSON report with metrics: win_rate, return, sharpe, max_drawdown, trades
  Compatible with universal_backtest.py output format for consistency.
"""

import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Import from project
sys.path.insert(0, str(Path(__file__).parent))

try:
    import pandas as pd
except ImportError:
    print("ERROR: Missing dependencies. Run:")
    print("  pip install pandas --break-system-packages")
    sys.exit(1)

from backtest_config import AGENT_CONFIGS, get_agent_config, load_agent_config
from prepare import load_cached_data, cache_symbol

# Import backtest engine components
try:
    from universal_backtest import (
        STRATEGIES,
        PaperTrader,
        run_backtest,
        fetch_candles,
    )
except ImportError as e:
    print(f"ERROR: Cannot import from universal_backtest.py: {e}")
    sys.exit(1)

# Constants
BACKTEST_OUTPUT_DIR = Path(__file__).parent.parent / "data" / "backtests"


def ensure_output_dir():
    """Create output directory if it doesn't exist."""
    BACKTEST_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def parse_param_override(param_str: str) -> Tuple[str, Any]:
    """
    Parse a parameter override string like 'rr=2.5' or 'min_touches=3'.

    Returns:
        (key, value) with value auto-converted to appropriate type
    """
    if "=" not in param_str:
        raise ValueError(f"Invalid param format: {param_str}. Expected key=value")

    key, value = param_str.split("=", 1)
    key = key.strip()
    value = value.strip()

    # Auto-convert value type
    if value.lower() == "true":
        return key, True
    if value.lower() == "false":
        return key, False
    try:
        if "." in value:
            return key, float(value)
        return key, int(value)
    except ValueError:
        return key, value


def apply_param_overrides(config: Dict, overrides: List[str]) -> Dict:
    """Apply parameter overrides to a config."""
    config = config.copy()
    config["strategy_params"] = config["strategy_params"].copy()

    for override in overrides:
        key, value = parse_param_override(override)
        if key in config:
            config[key] = value
        elif key in config.get("strategy_params", {}):
            config["strategy_params"][key] = value
        else:
            # Add to strategy_params as new key
            config["strategy_params"][key] = value

    return config


def get_strategy_instance(strategy_name: str, params: Dict):
    """
    Get strategy instance for backtesting.
    Instantiates strategy with params from config.
    """
    if strategy_name not in STRATEGIES:
        available = ", ".join(STRATEGIES.keys())
        raise ValueError(f"Unknown strategy: {strategy_name}. Available: {available}")

    strategy_cls = STRATEGIES[strategy_name]

    # Map config params to strategy constructor args
    # Each strategy has different constructor signatures, so we pass **params
    try:
        return strategy_cls(**params)
    except TypeError:
        # Fallback: instantiate with defaults if params don't match
        return strategy_cls()


def run_agent_backtest(
    config: Dict,
    df: pd.DataFrame,
    verbose: bool = True
) -> Dict[str, Any]:
    """
    Run backtest using universal_backtest.py machinery.

    Returns:
        Dict with trades, metrics, and metadata
    """
    symbol = config["primary_symbol"]
    strategy_name = config["strategy"]
    strategy_params = config.get("strategy_params", {})
    balance = config.get("initial_capital", 100000)
    risk_pct = config.get("risk_per_trade", 0.01)

    # Instantiate strategy with params
    strategy = get_strategy_instance(strategy_name, strategy_params)

    # Run backtest using universal_backtest machinery
    metrics, trades = run_backtest(
        symbol=symbol,
        strategy_name=strategy_name,
        strategy_instance=strategy,
        df=df,
        balance=balance,
        risk_pct=risk_pct
    )

    # Build result compatible with universal_backtest output
    result = {
        "agent": config.get("name", "Unknown"),
        "symbol": symbol,
        "strategy": strategy_name,
        "strategy_display": strategy.display_name,
        "timeframe": config["timeframe"],
        "config": {
            "initial_capital": balance,
            "risk_per_trade": risk_pct,
            "strategy_params": strategy_params,
        },
        "data_range": {
            "start": str(df.index[0]),
            "end": str(df.index[-1]),
            "candles": len(df),
        },
        "metrics": metrics,
        "trades": trades,
        "run_timestamp": datetime.now().isoformat(),
    }

    if verbose:
        print(f"\n  Strategy: {strategy.display_name}")
        print(f"  Symbol: {symbol}")
        print(f"  Candles: {len(df)}")
        print(f"  Signals: {metrics.get('signals_emitted', 0)}")
        print(f"  Trades: {metrics.get('total_trades', 0)}")
        print(f"  Win Rate: {metrics.get('win_rate', 0):.1f}%")
        print(f"  Return: {metrics.get('return_pct', 0):+.2f}%")
        print(f"  Sharpe: {metrics.get('sharpe_ratio', 0):.2f}")
        print(f"  Max Drawdown: {metrics.get('max_drawdown_pct', 0):.2f}%")
        print(f"  Final Balance: ${metrics.get('final_balance', 0):,.2f}")

    return result


def run_strategy(
    agent_name: str,
    param_overrides: List[str] = None,
    use_cache: bool = False,
    days: int = 60,
    config_path: str = None,
    output_path: str = None,
    verbose: bool = True,
) -> Dict[str, Any]:
    """
    Run strategy with optional parameter overrides.

    This is the main entry point for the Surgeon skill to call.
    """
    # Load base config
    if config_path:
        config = load_agent_config(config_path)
        if verbose:
            print(f"Loaded config from {config_path}")
    else:
        config = get_agent_config(agent_name)

    # Apply overrides
    if param_overrides:
        config = apply_param_overrides(config, param_overrides)
        if verbose:
            print(f"Applied {len(param_overrides)} parameter overrides")
            for override in param_overrides:
                print(f"  - {override}")

    symbol = config["primary_symbol"]
    timeframe = config["timeframe"]

    # Get OHLCV data
    if use_cache:
        df = load_cached_data(symbol, timeframe)
        if df is None:
            if verbose:
                print(f"  Cache miss for {symbol} @ {timeframe}. Fetching...")
            success, msg = cache_symbol(symbol, timeframe, days, verbose=verbose)
            if not success:
                raise RuntimeError(f"Failed to cache data: {msg}")
            df = load_cached_data(symbol, timeframe)
    else:
        # Fetch directly using universal_backtest's fetch function
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        df = fetch_candles(
            symbol,
            start_date.strftime("%Y-%m-%d"),
            end_date.strftime("%Y-%m-%d"),
            timeframe
        )

    if df is None or df.empty:
        raise RuntimeError(f"No data available for {symbol}")

    # Run backtest
    result = run_agent_backtest(config, df, verbose)

    # Save output
    ensure_output_dir()
    if output_path:
        out_path = Path(output_path)
    else:
        # Default output path
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        safe_symbol = symbol.replace("=", "_").replace("/", "_")
        out_path = BACKTEST_OUTPUT_DIR / f"{safe_symbol}_{config['strategy']}_{timestamp}.json"

    with open(out_path, "w") as f:
        json.dump(result, f, indent=2, default=str)

    if verbose:
        print(f"\n  Results saved to {out_path}")

    return result


def save_config(agent_name: str, param_overrides: List[str] = None, verbose: bool = True):
    """Save config (with optional overrides) to file."""
    config = get_agent_config(agent_name)
    if param_overrides:
        config = apply_param_overrides(config, param_overrides)

    config_dir = Path(__file__).parent.parent / "data" / "configs"
    config_dir.mkdir(parents=True, exist_ok=True)
    config_path = config_dir / f"{agent_name}_tuned.json"

    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)

    if verbose:
        print(f"Config saved to {config_path}")

    return config_path


def main():
    parser = argparse.ArgumentParser(
        description="Mutable Strategy Target for AutoResearch Loop"
    )
    parser.add_argument("--agent", "-a", required=True, help="Agent name (spx_sniper, boba_trades, etc.)")
    parser.add_argument("--param", "-p", action="append", default=[], help="Parameter override (e.g., rr=2.5)")
    parser.add_argument("--use-cache", "-c", action="store_true", help="Use cached OHLCV data")
    parser.add_argument("--days", "-d", type=int, default=60, help="Days of history")
    parser.add_argument("--load-config", help="Load config from JSON file")
    parser.add_argument("--save-config", action="store_true", help="Save current config to file")
    parser.add_argument("--output", "-o", help="Output file path")
    parser.add_argument("--quiet", "-q", action="store_true", help="Quiet mode")

    args = parser.parse_args()
    verbose = not args.quiet

    # Validate agent name
    if args.agent not in AGENT_CONFIGS:
        available = ", ".join(AGENT_CONFIGS.keys())
        print(f"ERROR: Unknown agent '{args.agent}'. Available: {available}")
        sys.exit(1)

    # Save config mode
    if args.save_config:
        save_config(args.agent, args.param, verbose)
        return

    # Run strategy
    try:
        result = run_strategy(
            agent_name=args.agent,
            param_overrides=args.param,
            use_cache=args.use_cache,
            days=args.days,
            config_path=args.load_config,
            output_path=args.output,
            verbose=verbose,
        )

        # Exit with code based on profitability (for CI/CD gates)
        total_return = result["metrics"].get("return_pct", 0)
        if total_return > 0:
            if verbose:
                print(f"\n  [PASS] Strategy profitable: {total_return:+.2f}%")
            sys.exit(0)
        else:
            if verbose:
                print(f"\n  [FAIL] Strategy not profitable: {total_return:+.2f}%")
            sys.exit(1)

    except Exception as e:
        if verbose:
            print(f"ERROR: {e}")
            import traceback
            traceback.print_exc()
        sys.exit(2)


if __name__ == "__main__":
    main()
