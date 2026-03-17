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
            "zone_tolerance_pct": 0.15,
            "min_touches": 3,
            "rr": 1.5,
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
            "threshold_pct": 0.4,
            "rr": 2.0,
        },
    },

    # ── NEW STRATEGIES ──────────────────────────────────────────

    "liquidity_scalper": {
        "name": "Liquidity Pool Scalper",
        "market": "futures",
        "symbols": ["ES=F", "NQ=F"],
        "primary_symbol": "ES=F",
        "strategy": "liquidity",
        "timeframe": "5m",
        "initial_capital": 100000,
        "risk_per_trade": 0.01,
        "strategy_params": {
            "swing_strength": 3,
            "zone_tolerance": 0.0004,
            "min_pool_touches": 2,
            "cooldown": 5,
            "risk_pct": 0.003,
            "rr": 2.0,
        },
        "session": {
            "start_hour": 9,
            "start_minute": 30,
            "end_hour": 16,
            "end_minute": 0,
        },
        "data_sources": ["yfinance", "alpaca"],
    },

    "ema_adx_trend": {
        "name": "EMA Crossover + ADX",
        "market": "multi",
        "symbols": ["ES=F", "NQ=F", "BTC-USD", "EURUSD=X"],
        "primary_symbol": "ES=F",
        "strategy": "ema_adx",
        "timeframe": "15m",
        "initial_capital": 100000,
        "risk_per_trade": 0.01,
        "strategy_params": {
            "fast": 9,
            "slow": 21,
            "adx_period": 14,
            "adx_threshold": 25,
            "risk_pct": 0.005,
            "rr": 2.0,
        },
        "data_sources": ["yfinance", "alpaca"],
    },

    "rsi_mean_reversion": {
        "name": "RSI Mean Reversion",
        "market": "multi",
        "symbols": ["BTC-USD", "ETH-USD", "SPY", "EURUSD=X"],
        "primary_symbol": "BTC-USD",
        "strategy": "rsi_mr",
        "timeframe": "1h",
        "initial_capital": 100000,
        "risk_per_trade": 0.015,
        "strategy_params": {
            "period": 14,
            "oversold": 30,
            "overbought": 70,
            "cooldown": 8,
            "risk_pct": 0.004,
            "rr": 1.5,
        },
        "data_sources": ["yfinance", "alpaca"],
    },

    "three_ducks_fx": {
        "name": "Three Ducks Trend",
        "market": "forex",
        "symbols": ["GBPUSD=X", "EURUSD=X", "USDJPY=X", "AUDUSD=X"],
        "primary_symbol": "GBPUSD=X",
        "strategy": "three_ducks",
        "timeframe": "1m",
        "initial_capital": 50000,
        "risk_per_trade": 0.01,
        "strategy_params": {
            "short_period": 60,
            "med_period": 240,
            "long_period": 1440,
            "rr": 2.0,
        },
        "notes": "Requires 1m data for SMA proxy timeframes (1H/4H/Daily)",
    },

    "grid_btc": {
        "name": "Grid Trading (BTC)",
        "market": "crypto",
        "symbols": ["BTC-USD", "ETH-USD"],
        "primary_symbol": "BTC-USD",
        "strategy": "grid",
        "timeframe": "5m",
        "initial_capital": 50000,
        "risk_per_trade": 0.01,
        "strategy_params": {
            "grid_pct": 0.5,
            "rr": 1.0,
        },
        "notes": "Best in ranging/consolidation markets. Poor in trends.",
    },

    "never_stopped_out_mnq": {
        "name": "NeverStoppedOut (MNQ)",
        "market": "futures",
        "symbols": ["NQ=F", "ES=F"],
        "primary_symbol": "NQ=F",
        "strategy": "never_stopped_out",
        "timeframe": "5m",
        "initial_capital": 100000,
        "risk_per_trade": 0.01,
        "strategy_params": {
            "session_start_hour": 9,
            "session_start_min": 30,
            "orb_duration": 15,
            "wide_range_threshold": 400,
            "cooldown_minutes": 15,
            "rr": 2.0,
        },
    },
}

# ── DATA SOURCE RECOMMENDATIONS ──────────────────────────────
# REAL DATA ONLY — never use simulated/synthetic data for backtesting.
#
# Recommended sources by asset class:
#   Futures (ES, NQ, YM):  Alpaca (ETF proxy: SPY/QQQ/DIA), yfinance (ES=F/NQ=F)
#   Forex:                 yfinance (*=X symbols), HistData.com (CSV), OANDA practice API
#   Crypto:                yfinance (*-USD), Alpaca crypto API, CoinGecko API
#   Equities:              Alpaca (5yr intraday free), yfinance
#
# Paper trading brokers:
#   Alpaca:  Equities + Crypto — https://paper-api.alpaca.markets
#   OANDA:   Forex — https://api-fxpractice.oanda.com (v20 API)
#
# Walk-forward analysis:
#   Always run --walk-forward 5 before deploying any strategy live.
#   Only out-of-sample results count. In-sample results are meaningless.


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
