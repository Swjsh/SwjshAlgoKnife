#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════
INTEL PREFLIGHT HELPER — For Python Trading Agents
═══════════════════════════════════════════════════════════════

Usage in your agent:
    from intel_preflight import check_preflight, PreflightResult

    result = check_preflight(
        agent_id="pivot_pete",
        symbol="BTCUSD",
        direction="LONG"
    )

    if result.decision == "NO_GO":
        return  # Skip this trade

    # Apply size multiplier
    position_size *= result.size_multiplier

ROI Impact: +10-20% P&L improvement through intel gating
═══════════════════════════════════════════════════════════════
"""

import os
import sys
import json
import requests
from dataclasses import dataclass
from typing import List, Dict, Optional

# Default API endpoint
API_BASE = os.environ.get("SWJSH_API_URL", "http://localhost:3000")
PREFLIGHT_ENDPOINT = f"{API_BASE}/api/intel/preflight"

@dataclass
class PreflightResult:
    """Result from preflight check."""
    decision: str  # "GO" | "NO_GO" | "REDUCED"
    size_multiplier: float  # 0.0 to 1.0
    intel_score: float  # -1.0 to 1.0
    regime: str  # Market regime
    reasons: List[str]
    signal_count: int
    adjustments: List[str]
    confluence_bonus: float
    contrarian_active: bool
    funding_signal: str  # "OVERHEATED" | "OVERSOLD" | "NEUTRAL"
    raw_response: Dict


def check_preflight(
    agent_id: str,
    symbol: str,
    direction: str,
    strategy: Optional[str] = None,
    entry_price: Optional[float] = None,
    stop_loss: Optional[float] = None,
    timeout: float = 5.0
) -> PreflightResult:
    """
    Check if a trade should be executed based on intel signals.

    Args:
        agent_id: Your agent's identifier (e.g., "pivot_pete")
        symbol: Trading symbol (e.g., "BTCUSD", "ETHUSD")
        direction: "LONG" or "SHORT"
        strategy: Optional strategy name for logging
        entry_price: Optional entry price for context
        stop_loss: Optional stop loss for R:R context
        timeout: Request timeout in seconds

    Returns:
        PreflightResult with decision and adjustments

    Example:
        result = check_preflight("boba", "BTCUSD", "LONG")
        if result.decision == "NO_GO":
            print(f"Trade blocked: {result.reasons}")
            return
        size = base_size * result.size_multiplier
    """
    payload = {
        "agentId": agent_id,
        "symbol": symbol.upper(),
        "direction": direction.upper(),
    }

    if strategy:
        payload["strategy"] = strategy
    if entry_price is not None:
        payload["entryPrice"] = entry_price
    if stop_loss is not None:
        payload["stopLoss"] = stop_loss

    try:
        response = requests.post(
            PREFLIGHT_ENDPOINT,
            json=payload,
            timeout=timeout,
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        data = response.json()

        return PreflightResult(
            decision=data.get("decision", "GO"),
            size_multiplier=data.get("sizeMultiplier", 1.0),
            intel_score=data.get("intelScore", 0.0),
            regime=data.get("regime", "UNKNOWN"),
            reasons=data.get("reasons", []),
            signal_count=data.get("signalCount", 0),
            adjustments=data.get("adjustments", []),
            confluence_bonus=data.get("confluenceBonus", 1.0),
            contrarian_active=data.get("contrarianActive", False),
            funding_signal=data.get("fundingSignal", "NEUTRAL"),
            raw_response=data
        )

    except requests.exceptions.Timeout:
        print(f"[Preflight] Timeout - proceeding with default GO")
        return _default_result(agent_id, symbol, direction, "Timeout - API not responding")

    except requests.exceptions.ConnectionError:
        print(f"[Preflight] Connection error - proceeding with default GO")
        return _default_result(agent_id, symbol, direction, "Connection error - API unavailable")

    except Exception as e:
        print(f"[Preflight] Error: {e} - proceeding with default GO")
        return _default_result(agent_id, symbol, direction, str(e))


def _default_result(agent_id: str, symbol: str, direction: str, error: str) -> PreflightResult:
    """Return a safe default result when API is unavailable."""
    return PreflightResult(
        decision="GO",
        size_multiplier=0.75,  # Reduced size when flying blind
        intel_score=0.0,
        regime="UNKNOWN",
        reasons=[f"Preflight unavailable: {error}", "Using reduced size (flying blind)"],
        signal_count=0,
        adjustments=["api_fallback"],
        confluence_bonus=1.0,
        contrarian_active=False,
        funding_signal="NEUTRAL",
        raw_response={}
    )


def should_trade(
    agent_id: str,
    symbol: str,
    direction: str,
    min_multiplier: float = 0.0
) -> bool:
    """
    Quick check: should we trade at all?

    Args:
        agent_id: Agent identifier
        symbol: Trading symbol
        direction: "LONG" or "SHORT"
        min_multiplier: Minimum size multiplier to accept (default 0 = any)

    Returns:
        True if trade should proceed, False if blocked
    """
    result = check_preflight(agent_id, symbol, direction)
    return (
        result.decision != "NO_GO" and
        result.size_multiplier >= min_multiplier
    )


def get_size_adjustment(
    agent_id: str,
    symbol: str,
    direction: str,
    base_size: float
) -> float:
    """
    Get the intel-adjusted position size.

    Args:
        agent_id: Agent identifier
        symbol: Trading symbol
        direction: "LONG" or "SHORT"
        base_size: Base position size before adjustment

    Returns:
        Adjusted position size (may be 0 if blocked)
    """
    result = check_preflight(agent_id, symbol, direction)

    if result.decision == "NO_GO":
        return 0.0

    return base_size * result.size_multiplier


# ═══════════════════════════════════════════════════════════════
# CLI interface for testing
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Intel Preflight Check")
    parser.add_argument("agent_id", help="Agent identifier")
    parser.add_argument("symbol", help="Trading symbol (e.g., BTCUSD)")
    parser.add_argument("direction", choices=["LONG", "SHORT"], help="Trade direction")
    parser.add_argument("--strategy", help="Strategy name")
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    result = check_preflight(
        agent_id=args.agent_id,
        symbol=args.symbol,
        direction=args.direction,
        strategy=args.strategy
    )

    if args.json:
        print(json.dumps({
            "decision": result.decision,
            "sizeMultiplier": result.size_multiplier,
            "intelScore": result.intel_score,
            "regime": result.regime,
            "reasons": result.reasons,
            "adjustments": result.adjustments,
            "contrarianActive": result.contrarian_active,
            "fundingSignal": result.funding_signal,
        }, indent=2))
    else:
        print(f"\n{'='*60}")
        print(f"PREFLIGHT CHECK: {args.agent_id} → {args.direction} {args.symbol}")
        print(f"{'='*60}")
        print(f"Decision:        {result.decision}")
        print(f"Size Multiplier: {result.size_multiplier:.2f}x")
        print(f"Intel Score:     {result.intel_score:.2f}")
        print(f"Market Regime:   {result.regime}")
        print(f"Signal Count:    {result.signal_count}")
        print(f"Contrarian:      {'Yes' if result.contrarian_active else 'No'}")
        print(f"Funding Signal:  {result.funding_signal}")
        print(f"\nReasons:")
        for reason in result.reasons:
            print(f"  • {reason}")
        if result.adjustments:
            print(f"\nAdjustments Applied:")
            for adj in result.adjustments:
                print(f"  • {adj}")
        print(f"{'='*60}\n")
