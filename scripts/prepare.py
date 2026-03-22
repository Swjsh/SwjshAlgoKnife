#!/usr/bin/env python3
"""
OHLCV Data Preparation — SwjshAlgoKnife AutoResearch Loop
==========================================================
Karpathy Convention: prepare.py → strategy.py → eval cycle

This script caches OHLCV data from yfinance to local files for fast,
repeatable backtesting without network calls during optimization loops.

Usage:
  # Cache single symbol
  python scripts/prepare.py --symbol SPY --timeframe 5m --days 60

  # Cache all agents' symbols (uses backtest_config.py)
  python scripts/prepare.py --all-agents --days 60

  # Cache specific agent's symbols
  python scripts/prepare.py --agent spx_sniper --days 60

  # Update existing cache (incremental)
  python scripts/prepare.py --symbol SPY --timeframe 5m --update

  # List cached data
  python scripts/prepare.py --list

Cache Location:
  data/ohlcv_cache/{symbol}_{timeframe}.csv

Metadata stored in:
  data/ohlcv_cache/metadata.json
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    import yfinance as yf
    import pandas as pd
except ImportError:
    print("ERROR: Missing dependencies. Run:")
    print("  pip install yfinance pandas --break-system-packages")
    sys.exit(1)

# Import agent configs
try:
    from backtest_config import AGENT_CONFIGS, get_agent_config
except ImportError:
    # If run from different directory
    sys.path.insert(0, str(Path(__file__).parent))
    from backtest_config import AGENT_CONFIGS, get_agent_config

# Constants
CACHE_DIR = Path(__file__).parent.parent / "data" / "ohlcv_cache"
METADATA_FILE = CACHE_DIR / "metadata.json"

# yfinance intraday limits
INTRADAY_LIMITS = {
    "1m": 7, "2m": 60, "5m": 60, "15m": 60, "30m": 60,
    "60m": 730, "90m": 730, "1h": 730,
}


def ensure_cache_dir():
    """Create cache directory if it doesn't exist."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def load_metadata() -> Dict:
    """Load cache metadata."""
    if METADATA_FILE.exists():
        with open(METADATA_FILE, "r") as f:
            return json.load(f)
    return {"caches": {}, "last_update": None}


def save_metadata(metadata: Dict):
    """Save cache metadata."""
    metadata["last_update"] = datetime.now().isoformat()
    with open(METADATA_FILE, "w") as f:
        json.dump(metadata, f, indent=2)


def get_cache_path(symbol: str, timeframe: str) -> Path:
    """Get path to cache file for a symbol/timeframe pair."""
    # Sanitize symbol for filename (replace special chars)
    safe_symbol = symbol.replace("=", "_").replace("/", "_")
    return CACHE_DIR / f"{safe_symbol}_{timeframe}.csv"


def fetch_candles(
    symbol: str,
    start: str,
    end: str,
    interval: str,
    verbose: bool = True
) -> Optional[pd.DataFrame]:
    """
    Fetch OHLCV candles from Yahoo Finance with chunking for long ranges.
    Same logic as universal_backtest.py for consistency.
    """
    if verbose:
        print(f"  Fetching {symbol} | {interval} | {start} -> {end} ...")

    ticker = yf.Ticker(symbol)
    start_dt = datetime.strptime(start, "%Y-%m-%d")
    end_dt = datetime.strptime(end, "%Y-%m-%d")

    max_days = INTRADAY_LIMITS.get(interval)

    if max_days and (end_dt - start_dt).days > max_days:
        # Chunk into smaller requests
        frames = []
        chunk_start = start_dt
        while chunk_start < end_dt:
            chunk_end = min(chunk_start + timedelta(days=max_days - 1), end_dt)
            try:
                df = ticker.history(
                    start=chunk_start.strftime("%Y-%m-%d"),
                    end=chunk_end.strftime("%Y-%m-%d"),
                    interval=interval,
                    auto_adjust=True,
                )
                if not df.empty:
                    frames.append(df)
                    if verbose:
                        print(f"    Chunk {chunk_start.date()} -> {chunk_end.date()}: {len(df)} candles")
            except Exception as e:
                if verbose:
                    print(f"    WARNING: chunk {chunk_start.date()} -> {chunk_end.date()} failed: {e}")
            chunk_start = chunk_end + timedelta(days=1)

        if not frames:
            if verbose:
                print(f"  ERROR: No data returned for {symbol}")
            return None
        df = pd.concat(frames)
    else:
        df = ticker.history(start=start, end=end, interval=interval, auto_adjust=True)

    if df.empty:
        if verbose:
            print(f"  ERROR: No data for {symbol} ({start} -> {end}, {interval})")
        return None

    # Normalize columns
    df = df.rename(columns={
        "Open": "open", "High": "high", "Low": "low",
        "Close": "close", "Volume": "volume"
    })

    # Keep only OHLCV columns
    df = df[["open", "high", "low", "close", "volume"]].dropna()

    if verbose:
        print(f"  Got {len(df)} candles ({df.index[0]} -> {df.index[-1]})")

    return df


def cache_symbol(
    symbol: str,
    timeframe: str,
    days: int = 60,
    update: bool = False,
    verbose: bool = True
) -> Tuple[bool, str]:
    """
    Cache OHLCV data for a single symbol/timeframe pair.

    Returns:
        (success: bool, message: str)
    """
    ensure_cache_dir()
    metadata = load_metadata()
    cache_key = f"{symbol}_{timeframe}"
    cache_path = get_cache_path(symbol, timeframe)

    # Determine date range
    end_date = datetime.now()

    if update and cache_path.exists():
        # Incremental update - start from last cached date
        existing_df = pd.read_csv(cache_path, index_col=0, parse_dates=True)
        last_date = existing_df.index[-1]
        start_date = last_date + timedelta(days=1)

        if start_date >= end_date:
            return True, f"Cache up-to-date (last: {last_date.date()})"

        if verbose:
            print(f"  Incremental update from {start_date.date()}")
    else:
        # Full fetch
        max_days = INTRADAY_LIMITS.get(timeframe, days)
        start_date = end_date - timedelta(days=min(days, max_days))
        existing_df = None

    # Fetch data
    df = fetch_candles(
        symbol,
        start_date.strftime("%Y-%m-%d"),
        end_date.strftime("%Y-%m-%d"),
        timeframe,
        verbose=verbose
    )

    if df is None or df.empty:
        return False, f"No data returned for {symbol}"

    # Merge with existing data if incremental
    if existing_df is not None and not df.empty:
        df = pd.concat([existing_df, df])
        df = df[~df.index.duplicated(keep='last')]
        df = df.sort_index()

    # Save to CSV
    df.to_csv(cache_path)

    # Update metadata
    metadata["caches"][cache_key] = {
        "symbol": symbol,
        "timeframe": timeframe,
        "path": str(cache_path),
        "candles": len(df),
        "start": str(df.index[0]),
        "end": str(df.index[-1]),
        "cached_at": datetime.now().isoformat(),
        "source": "yfinance"
    }
    save_metadata(metadata)

    return True, f"Cached {len(df)} candles to {cache_path.name}"


def cache_agent(agent_name: str, days: int = 60, verbose: bool = True) -> Dict[str, str]:
    """Cache all symbols for a specific agent."""
    config = get_agent_config(agent_name)
    results = {}

    if verbose:
        print(f"\n[{config['name']}] Caching {len(config['symbols'])} symbols @ {config['timeframe']}...")

    for symbol in config["symbols"]:
        success, msg = cache_symbol(symbol, config["timeframe"], days, verbose=verbose)
        results[symbol] = msg
        if verbose:
            status = "[OK]" if success else "[FAIL]"
            print(f"  {status} {symbol}: {msg}")

    return results


def cache_all_agents(days: int = 60, verbose: bool = True) -> Dict[str, Dict[str, str]]:
    """Cache all symbols for all agents."""
    results = {}

    for agent_name in AGENT_CONFIGS:
        results[agent_name] = cache_agent(agent_name, days, verbose)

    return results


def list_cached_data(verbose: bool = True) -> List[Dict]:
    """List all cached data files."""
    metadata = load_metadata()
    caches = metadata.get("caches", {})

    if verbose:
        print("\nCached OHLCV Data:")
        print("-" * 70)
        if not caches:
            print("  No cached data found.")
        else:
            for key, info in caches.items():
                print(f"  {key}:")
                print(f"    Candles: {info['candles']}")
                print(f"    Range: {info['start'][:10]} -> {info['end'][:10]}")
                print(f"    Cached: {info['cached_at'][:19]}")
        print("-" * 70)

    return list(caches.values())


def load_cached_data(symbol: str, timeframe: str) -> Optional[pd.DataFrame]:
    """
    Load cached OHLCV data for strategy.py to use.

    Returns:
        DataFrame with OHLCV columns, or None if not cached.
    """
    cache_path = get_cache_path(symbol, timeframe)

    if not cache_path.exists():
        return None

    df = pd.read_csv(cache_path, index_col=0, parse_dates=True)
    return df


def main():
    parser = argparse.ArgumentParser(
        description="OHLCV Data Preparation for AutoResearch Loop"
    )
    parser.add_argument("--symbol", "-s", help="Symbol to cache (e.g., SPY, BTC-USD)")
    parser.add_argument("--timeframe", "-t", default="5m", help="Timeframe (1m, 5m, 15m, 1h, 1d)")
    parser.add_argument("--days", "-d", type=int, default=60, help="Days of history to fetch")
    parser.add_argument("--agent", "-a", help="Cache all symbols for a specific agent")
    parser.add_argument("--all-agents", action="store_true", help="Cache all symbols for all agents")
    parser.add_argument("--update", "-u", action="store_true", help="Incremental update only")
    parser.add_argument("--list", "-l", action="store_true", help="List cached data")
    parser.add_argument("--quiet", "-q", action="store_true", help="Quiet mode")

    args = parser.parse_args()
    verbose = not args.quiet

    if args.list:
        list_cached_data(verbose)
        return

    if args.all_agents:
        if verbose:
            print("Caching OHLCV data for all agents...")
        results = cache_all_agents(args.days, verbose)
        if verbose:
            total = sum(len(r) for r in results.values())
            print(f"\nDone. Cached {total} symbol/timeframe pairs.")
        return

    if args.agent:
        results = cache_agent(args.agent, args.days, verbose)
        if verbose:
            print(f"\nDone. Cached {len(results)} symbols for {args.agent}.")
        return

    if args.symbol:
        success, msg = cache_symbol(args.symbol, args.timeframe, args.days, args.update, verbose)
        if verbose:
            status = "SUCCESS" if success else "FAILED"
            print(f"\n{status}: {msg}")
        sys.exit(0 if success else 1)

    # No arguments - show help
    parser.print_help()


if __name__ == "__main__":
    main()
