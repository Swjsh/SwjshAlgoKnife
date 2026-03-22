#!/usr/bin/env python3
"""
Backtest Configuration System
=============================
Centralized configs for all agents/strategies.
Each agent has a JSON config defining its market, strategy, and parameters.
"""

import json
from pathlib import Path
from typing import Dict, Any

# Default configurations for each agent
AGENT_CONFIGS = {
    "pivot_pete": {
        "name": "Pivot Pete",
        "market": "futures",
        "symbols": ["ES=F", "NQ=F", "YM=F"],
        "primary_symbol": "ES=F",
        "strategy": "pivot",
        "timeframe": "5m",
        "initial_capital": 100000,
        "risk_per_trade": 0.01,
        "strategy_params": {
            "tolerance_pct": 0.0008,
            "min_confluence": 1,
            "risk_pct": 0.003,
            "rr": 2.0,
        },
        "session": {
            "start_hour": 9,
            "start_minute": 30,
            "end_hour": 16,
            "end_minute": 0,
        },
    },

    "boba_trades": {
        "name": "Boba Trades",
        "market": "options",
        "symbols": ["SPY", "QQQ", "IWM"],
        "primary_symbol": "SPY",
        "strategy": "supp_res",
        "timeframe": "5m",
        "initial_capital": 50000,
        "risk_per_trade": 0.02,
        "strategy_params": {
            "lookback": 50,
            "zone_tolerance_pct": 0.3,
            "min_touches": 2,
            "rr": 2.0,
        },
    },

    "bitcoin_bob": {
        "name": "Bitcoin Bob",
        "market": "crypto",
        "symbols": ["BTC-USD", "ETH-USD", "SOL-USD"],
        "primary_symbol": "BTC-USD",
        "strategy": "bb_squeeze",
        "timeframe": "1h",
        "initial_capital": 100000,
        "risk_per_trade": 0.015,
        "strategy_params": {
            "period": 20,
            "squeeze_threshold": 0.04,
            "rr": 2.5,
            # H-006 Confirmed Filters (Cortana pattern detection, p < 0.05)
            # SHORT trades: 43.5% WR vs LONG: 12.5% WR (+31pp effect)
            "direction_filter": "SHORT",         # Only take SHORT (SELL) signals
            "max_bandwidth": 0.025,              # Tighter squeezes = better (57% WR vs 11%)
            "max_hold_hours": 24,                # Sweet spot 6-24hr (42.9% WR)
            "avoid_entry_hours": [18, 19, 20, 21, 22, 23],  # UTC - US PM/Night toxic (0% WR)
        },
    },

    "spx_sniper": {
        "name": "SPX Sniper",
        "market": "options",
        "symbols": ["SPY"],  # Uses SPY as proxy for SPX
        "primary_symbol": "SPY",
        "strategy": "orb",
        "timeframe": "5m",
        "initial_capital": 25000,
        "risk_per_trade": 0.03,
        "strategy_params": {
            "session_start_hour": 9,
            "session_start_min": 30,
            "orb_duration": 15,
            "rr": 2.0,
        },
    },

    "sterling_fx": {
        "name": "Sterling FX",
        "market": "forex",
        "symbols": ["GBPUSD=X", "EURUSD=X", "USDJPY=X"],
        "primary_symbol": "GBPUSD=X",
        "strategy": "vwap",
        "timeframe": "15m",
        "initial_capital": 50000,
        "risk_per_trade": 0.01,
        "strategy_params": {
            # 0.4% threshold = ~40 pips, appropriate for GBP/USD 15m (daily range 30-80 pips)
            # Previous 1.5% = 150 pips was too high, causing 0 trades
            "threshold_pct": 0.4,
            "rr": 2.0,
        },
    },
}


def get_agent_config(agent_name: str) -> Dict[str, Any]:
    """Get configuration for a specific agent."""
    if agent_name not in AGENT_CONFIGS:
        available = ", ".join(AGENT_CONFIGS.keys())
        raise ValueError(f"Unknown agent '{agent_name}'. Available: {available}")

    return AGENT_CONFIGS[agent_name].copy()


def save_agent_config(agent_name: str, config: Dict[str, Any], path: str = None):
    """Save agent config to JSON file."""
    if path is None:
        config_dir = Path(__file__).parent.parent / "data" / "configs"
        config_dir.mkdir(parents=True, exist_ok=True)
        path = config_dir / f"{agent_name}_backtest.json"

    with open(path, "w") as f:
        json.dump(config, f, indent=2)

    print(f"  Config saved: {path}")


def load_agent_config(path: str) -> Dict[str, Any]:
    """Load agent config from JSON file."""
    with open(path, "r") as f:
        return json.load(f)


def create_all_configs():
    """Generate JSON config files for all agents."""
    config_dir = Path(__file__).parent.parent / "data" / "configs"
    config_dir.mkdir(parents=True, exist_ok=True)

    for agent_name, config in AGENT_CONFIGS.items():
        save_agent_config(agent_name, config)

    print(f"\n  Created {len(AGENT_CONFIGS)} agent config files in {config_dir}")


if __name__ == "__main__":
    # Generate all config files
    create_all_configs()
