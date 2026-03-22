#!/usr/bin/env python3
"""
Position Sync Module — Reconcile Agent State with Broker Positions
===================================================================

Ensures Python trading agents stay in sync with Alpaca broker:
• On startup: compare local state vs broker positions
• On mismatch: log to console/Discord, update local state
• On duplicate: skip new entry if position already exists

Usage:
    from position_sync import sync_positions_on_startup, check_existing_position

    # On agent boot (before main loop)
    active_trades = sync_positions_on_startup('spx_sniper', 'SPY', active_trades)

    # Before opening a new trade
    if check_existing_position('SPY'):
        print("Position already exists on broker - skipping entry")
"""

import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

# Ensure scripts directory is on path
sys.path.insert(0, str(Path(__file__).parent))

from agent_utils import log_message, save_agent_state, load_agent_state

# Lazy import to avoid circular dependencies
_executor = None


def _get_executor():
    """Lazy-load AlpacaExecutor to avoid import errors if creds not set."""
    global _executor
    if _executor is None:
        try:
            from alpaca_executor import AlpacaExecutor
            _executor = AlpacaExecutor()
        except ValueError as e:
            # Credentials not configured
            print(f"[PositionSync] ⚠️ Alpaca not configured: {e}")
            return None
        except Exception as e:
            print(f"[PositionSync] ⚠️ Failed to init Alpaca: {e}")
            return None
    return _executor


def get_broker_position(symbol: str) -> Optional[dict]:
    """
    Get position from Alpaca broker.

    Args:
        symbol: Trading symbol (e.g., 'SPY', 'BTC/USD')

    Returns:
        Position dict with qty, side, avg_entry_price, etc.
        None if no position or Alpaca not configured.
    """
    executor = _get_executor()
    if not executor:
        return None

    try:
        return executor.get_position(symbol)
    except Exception as e:
        print(f"[PositionSync] Error getting position for {symbol}: {e}")
        return None


def check_existing_position(symbol: str) -> bool:
    """
    Check if a position already exists on the broker.

    Use this BEFORE opening a new trade to prevent duplicates.

    Args:
        symbol: Trading symbol

    Returns:
        True if position exists, False otherwise
    """
    position = get_broker_position(symbol)
    return position is not None and position.get('qty', 0) > 0


def sync_positions_on_startup(
    agent_id: str,
    symbol: str,
    local_active_trades: list,
    notify_discord: bool = True,
) -> list:
    """
    Sync agent's active_trades with broker positions on startup.

    Call this at the start of your agent's main loop, AFTER loading
    saved state but BEFORE processing any new signals.

    Scenarios handled:
    1. Agent thinks it has a trade, broker doesn't → Remove from local state
    2. Broker has position, agent doesn't know → Add to local state
    3. Both agree → No change

    Args:
        agent_id: Agent identifier for logging (e.g., 'spx_sniper', 'boba')
        symbol: The symbol this agent trades (e.g., 'SPY')
        local_active_trades: Agent's current active_trades list
        notify_discord: Whether to log mismatches (default True)

    Returns:
        Updated active_trades list, reconciled with broker
    """
    executor = _get_executor()
    if not executor:
        print(f"[PositionSync:{agent_id}] Alpaca not configured - skipping sync")
        return local_active_trades

    broker_position = get_broker_position(symbol)
    broker_has_position = broker_position is not None and broker_position.get('qty', 0) > 0

    # Find local trades for this symbol
    local_has_position = any(
        t.get('symbol', '').upper() == symbol.upper()
        for t in local_active_trades
    )

    # ── Scenario 1: Agent thinks it has trade, broker doesn't ───────────────
    if local_has_position and not broker_has_position:
        msg = f"⚠️ Orphaned trade detected: Agent has {symbol} but broker doesn't"
        print(f"[PositionSync:{agent_id}] {msg}")

        if notify_discord:
            log_message(agent_id, msg, type='warning')

        # Remove orphaned trade from local state
        local_active_trades = [
            t for t in local_active_trades
            if t.get('symbol', '').upper() != symbol.upper()
        ]

        print(f"[PositionSync:{agent_id}] Removed orphaned trade from local state")

    # ── Scenario 2: Broker has position, agent doesn't know ─────────────────
    elif broker_has_position and not local_has_position:
        msg = (
            f"⚠️ Untracked position found: Broker has {symbol} "
            f"({broker_position['qty']} @ ${broker_position['avg_entry_price']:.2f}) "
            f"but agent doesn't track it"
        )
        print(f"[PositionSync:{agent_id}] {msg}")

        if notify_discord:
            log_message(agent_id, msg, type='warning')

        # Add broker position to local tracking
        # We don't know SL/TP, so use defaults or mark as "manual"
        synced_trade = {
            'symbol': symbol,
            'direction': 'LONG' if broker_position['side'] == 'long' else 'SHORT',
            'entry_price': broker_position['avg_entry_price'],
            'qty': broker_position['qty'],
            'stop_loss': None,  # Unknown - agent should manage exit
            'take_profit': None,
            'synced_from_broker': True,
            'synced_at': datetime.now().isoformat(),
        }
        local_active_trades.append(synced_trade)

        print(f"[PositionSync:{agent_id}] Added broker position to local tracking")

    # ── Scenario 3: Both agree ──────────────────────────────────────────────
    elif broker_has_position and local_has_position:
        print(f"[PositionSync:{agent_id}] ✅ Positions synced: {symbol} matches broker")
    else:
        print(f"[PositionSync:{agent_id}] ✅ No positions (both agent and broker)")

    return local_active_trades


def pre_trade_health_check(
    agent_id: str,
    symbol: str,
    skip_if_position_exists: bool = True,
) -> dict:
    """
    Pre-trade health check before opening a new position.

    Call this BEFORE firing a new entry signal.

    Args:
        agent_id: Agent ID for logging
        symbol: Symbol to trade
        skip_if_position_exists: If True, returns skip=True if position exists

    Returns:
        {
            'ok': bool,           # True if safe to trade
            'skip': bool,         # True if should skip (position exists)
            'reason': str,        # Human-readable explanation
            'account': dict,      # Account info (if available)
            'position': dict,     # Existing position (if any)
        }
    """
    result = {
        'ok': False,
        'skip': False,
        'reason': '',
        'account': None,
        'position': None,
    }

    executor = _get_executor()
    if not executor:
        result['reason'] = "Alpaca not configured"
        # Still allow trade through webhooks
        result['ok'] = True
        return result

    # Check existing position
    position = get_broker_position(symbol)
    if position and position.get('qty', 0) > 0:
        result['position'] = position
        if skip_if_position_exists:
            result['skip'] = True
            result['reason'] = f"Position already exists: {position['qty']} {symbol}"
            log_message(
                agent_id,
                f"⏭️ Skipping entry: position already exists ({position['qty']} {symbol})",
                type='info'
            )
            return result

    # Check account health
    try:
        account = executor.get_account_info()
        result['account'] = account

        if account['status'] != 'ACTIVE':
            result['reason'] = f"Account not active: {account['status']}"
            return result

        if account['buying_power'] < 100:  # Minimum $100 buying power
            result['reason'] = f"Insufficient buying power: ${account['buying_power']:.2f}"
            return result

        result['ok'] = True
        result['reason'] = "Health check passed"

    except Exception as e:
        result['reason'] = f"Account check failed: {e}"
        # Allow trade anyway - don't block on transient errors
        result['ok'] = True

    return result


# ── Standalone Test ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("POSITION SYNC MODULE - TEST")
    print("=" * 60 + "\n")

    # Test with a mock agent
    agent_id = "test_agent"
    symbol = "SPY"

    print("1. Testing get_broker_position...")
    pos = get_broker_position(symbol)
    print(f"   Result: {pos}\n")

    print("2. Testing check_existing_position...")
    exists = check_existing_position(symbol)
    print(f"   Position exists: {exists}\n")

    print("3. Testing sync_positions_on_startup...")
    mock_trades = [
        {'symbol': 'SPY', 'direction': 'LONG', 'entry_price': 500.0},
    ]
    synced = sync_positions_on_startup(agent_id, symbol, mock_trades, notify_discord=False)
    print(f"   Synced trades: {synced}\n")

    print("4. Testing pre_trade_health_check...")
    health = pre_trade_health_check(agent_id, symbol)
    print(f"   Health check: {health}\n")

    print("=" * 60)
    print("✅ Position sync module tests complete")
    print("=" * 60 + "\n")
