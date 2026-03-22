"""
BaseAgent — Abstract base class for all Python trading agents
==============================================================
Extracts common patterns from pivot_pete, boba, spx_sniper, sterling, bitcoin_bob.

STANDARD PATTERNS EXTRACTED:
1. Status emission (AGENT_STATUS_UPDATE:{json} + status file)
2. Main loop structure with error handling
3. Webhook signal firing
4. State persistence via agent_utils
5. Position management (check_exits/check_entries)
6. Circuit breaker pattern for consecutive errors

USAGE:
    class MyAgent(BaseAgent):
        strategy_name = "My Strategy"

        def __init__(self):
            super().__init__(
                agent_id="my_agent",
                display_name="My Agent",
                scan_interval_sec=60
            )

        def execute_scan(self, price: float) -> None:
            # Agent-specific scan logic
            pass

        def should_trade(self) -> bool:
            # Market hours check (return True for 24/7 markets)
            return True

    if __name__ == "__main__":
        MyAgent().run()
"""

import json
import os
import sys
import time
import traceback
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import shared utilities
from agent_utils import log_message, save_agent_state, load_agent_state

# ── Config ────────────────────────────────────────────────────────────────────
_DATA_DIR = Path(os.environ.get('DATA_DIR', Path(__file__).parent.parent / 'data'))
WEBHOOK_URL = os.environ.get('WEBHOOK_URL', 'http://localhost:3000/api/webhook/tradingview')
WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET', '')


class BaseAgent(ABC):
    """
    Abstract base class for trading agents.

    Subclasses must implement:
        - execute_scan(price) — agent-specific scanning/signal logic
        - get_current_price() — how to fetch the latest price

    Optional overrides:
        - should_trade() — market hours check (default: True)
        - on_startup() — initialization after load_state
        - on_shutdown() — cleanup before exit
        - get_banner() — startup banner text
        - get_status_extras() — additional fields for status broadcast
    """

    # ── Class attributes (override in subclass) ──────────────────────────────
    strategy_name: str = "BaseStrategy"

    def __init__(
        self,
        agent_id: str,
        display_name: str,
        scan_interval_sec: int = 60,
        max_consecutive_errors: int = 10,
        error_backoff_base_sec: int = 60,
        status_file_name: Optional[str] = None,
    ):
        """
        Initialize the base agent.

        Args:
            agent_id: Unique ID (e.g. 'crypto', 'fx', 'futures')
            display_name: Human-readable name (e.g. 'Bitcoin Bob')
            scan_interval_sec: Seconds between scan cycles
            max_consecutive_errors: Halt after this many errors in a row
            error_backoff_base_sec: Base delay for exponential backoff
            status_file_name: Override status file (default: {agent_id}_agent_status.json)
        """
        self.agent_id = agent_id
        self.display_name = display_name
        self.scan_interval_sec = scan_interval_sec
        self.max_consecutive_errors = max_consecutive_errors
        self.error_backoff_base_sec = error_backoff_base_sec

        # Status file path
        self.status_file = _DATA_DIR / (status_file_name or f"{agent_id}_agent_status.json")

        # Runtime state
        self.scan_count = 0
        self.active_trades: list[dict] = []
        self.consecutive_errors = 0
        self.halted = False
        self.last_error: Optional[str] = None

        # Performance tracking
        self.daily_pnl = 0.0
        self.wins = 0
        self.losses = 0

        # Validate webhook secret
        if not WEBHOOK_SECRET:
            raise RuntimeError(
                f"[{self.display_name}] WEBHOOK_SECRET not set. "
                "Export it or add to .env"
            )

    # ═══════════════════════════════════════════════════════════════════════════
    # CORE LOOP
    # ═══════════════════════════════════════════════════════════════════════════

    def run(self) -> None:
        """
        Main agent loop (template method pattern).
        Subclasses override hooks, not this method.
        """
        self._print_banner()
        self._load_state()
        self.on_startup()

        log_message(self.agent_id, f"{self.display_name} online. Scanning...")

        while not self.halted:
            try:
                # Check if we should be trading
                if not self.should_trade():
                    self._broadcast_waiting()
                    time.sleep(self.scan_interval_sec)
                    continue

                # Get current price
                price = self.get_current_price()
                if price is None:
                    log_message(self.agent_id, "Price unavailable, skipping cycle", type='warning')
                    time.sleep(self.scan_interval_sec)
                    continue

                # Execute scan cycle
                self.scan_count += 1

                # Check exits on open positions
                if self.active_trades:
                    self.active_trades = self.check_exits(price)

                # Execute agent-specific scan logic (entries, zone detection, etc.)
                self.execute_scan(price)

                # Persist state
                self._save_state()

                # Broadcast status
                self._broadcast_status()

                # Reset error counter on success
                self.consecutive_errors = 0

                # Sleep until next scan
                time.sleep(self.scan_interval_sec)

            except KeyboardInterrupt:
                log_message(self.agent_id, f"{self.display_name} shutting down (Ctrl+C)...")
                break
            except Exception as e:
                self._handle_error(e)

        self.on_shutdown()
        self._save_state()
        log_message(self.agent_id, f"{self.display_name} stopped.")

    # ═══════════════════════════════════════════════════════════════════════════
    # ABSTRACT METHODS (must implement)
    # ═══════════════════════════════════════════════════════════════════════════

    @abstractmethod
    def execute_scan(self, price: float) -> None:
        """
        Execute agent-specific scan logic.
        This is where entry signals are generated, zones are checked, etc.

        Args:
            price: Current market price for the primary instrument
        """
        pass

    @abstractmethod
    def get_current_price(self) -> Optional[float]:
        """
        Get the current price for the primary instrument.

        Returns:
            Current price as float, or None if unavailable
        """
        pass

    # ═══════════════════════════════════════════════════════════════════════════
    # OPTIONAL HOOKS (override as needed)
    # ═══════════════════════════════════════════════════════════════════════════

    def should_trade(self) -> bool:
        """
        Check if the agent should be actively trading.
        Override for market hours checks (equity markets).

        Returns:
            True if trading is allowed, False to wait
        """
        return True

    def on_startup(self) -> None:
        """Called after state is loaded, before main loop starts."""
        pass

    def on_shutdown(self) -> None:
        """Called after main loop exits, before final state save."""
        pass

    def get_banner(self) -> str:
        """Return startup banner text. Override for custom banner."""
        return f"""
╔══════════════════════════════════════════════════════════════╗
║  {self.display_name:^58}  ║
║  Strategy: {self.strategy_name:^47}  ║
║  Scan Interval: {self.scan_interval_sec}s                                       ║
╚══════════════════════════════════════════════════════════════╝
"""

    def get_status_extras(self) -> dict:
        """
        Return additional fields to include in status broadcasts.
        Override to add agent-specific metrics.
        """
        return {}

    # ═══════════════════════════════════════════════════════════════════════════
    # POSITION MANAGEMENT
    # ═══════════════════════════════════════════════════════════════════════════

    def check_exits(self, price: float) -> list[dict]:
        """
        Check all open positions for SL/TP hits.
        Default implementation checks 'stop_loss' and 'take_profit' fields.
        Override for custom exit logic.

        Args:
            price: Current market price

        Returns:
            List of trades still open (closed trades are removed)
        """
        remaining = []
        for trade in self.active_trades:
            direction = trade.get('direction', trade.get('side', 'LONG')).upper()
            stop = trade.get('stop_loss', trade.get('stop_premium'))
            target = trade.get('take_profit', trade.get('target_premium'))

            # Check stop loss
            if stop is not None:
                if (direction == 'LONG' and price <= stop) or \
                   (direction == 'SHORT' and price >= stop):
                    self._close_trade(trade, price, 'STOP_LOSS')
                    continue

            # Check take profit
            if target is not None:
                if (direction == 'LONG' and price >= target) or \
                   (direction == 'SHORT' and price <= target):
                    self._close_trade(trade, price, 'TAKE_PROFIT')
                    continue

            # Still open
            remaining.append(trade)

        return remaining

    def open_trade(
        self,
        symbol: str,
        direction: str,
        entry_price: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        size: float = 1.0,
        reason: str = "",
        **extras
    ) -> dict:
        """
        Open a new trade and fire webhook signal.

        Args:
            symbol: Instrument symbol
            direction: 'LONG' or 'SHORT'
            entry_price: Entry price
            stop_loss: Stop loss price (optional)
            take_profit: Take profit price (optional)
            size: Position size
            reason: Entry reason for logging
            **extras: Additional trade metadata

        Returns:
            Trade dict if successful, empty dict if webhook failed
        """
        action = 'BUY' if direction.upper() == 'LONG' else 'SELL'

        # Fire webhook
        if not self.fire_signal(action, symbol, entry_price, stop_loss, take_profit, reason):
            return {}

        # Create trade record
        trade = {
            'symbol': symbol,
            'direction': direction.upper(),
            'entry_price': entry_price,
            'entry_time': datetime.now().isoformat(),
            'stop_loss': stop_loss,
            'take_profit': take_profit,
            'size': size,
            'reason': reason,
            **extras
        }

        self.active_trades.append(trade)
        log_message(self.agent_id, f"Opened {direction} {symbol} @ {entry_price:.4f}", type='trade')

        return trade

    def _close_trade(self, trade: dict, exit_price: float, exit_reason: str) -> None:
        """
        Close a trade and update performance metrics.

        Args:
            trade: The trade dict to close
            exit_price: Exit price
            exit_reason: Why we're closing (STOP_LOSS, TAKE_PROFIT, MANUAL, etc.)
        """
        entry_price = trade.get('entry_price', trade.get('entry_premium', 0))
        direction = trade.get('direction', trade.get('side', 'LONG')).upper()
        symbol = trade.get('symbol', trade.get('ticker', trade.get('pair', '???')))
        size = trade.get('size', trade.get('qty', 1))

        # Calculate P&L
        if direction == 'LONG':
            pnl = (exit_price - entry_price) * size
        else:
            pnl = (entry_price - exit_price) * size

        # Update metrics
        self.daily_pnl += pnl
        if pnl >= 0:
            self.wins += 1
        else:
            self.losses += 1

        # Fire exit signal
        action = 'SELL' if direction == 'LONG' else 'BUY'
        self.fire_signal(action, symbol, exit_price, reason=f"{exit_reason}: P&L ${pnl:.2f}")

        log_message(
            self.agent_id,
            f"Closed {direction} {symbol} @ {exit_price:.4f} ({exit_reason}) | "
            f"P&L: ${pnl:.2f} | Daily: ${self.daily_pnl:.2f}",
            type='trade'
        )

    # ═══════════════════════════════════════════════════════════════════════════
    # WEBHOOK INTEGRATION
    # ═══════════════════════════════════════════════════════════════════════════

    def fire_signal(
        self,
        action: str,
        symbol: str,
        price: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        reason: str = ""
    ) -> bool:
        """
        Fire a trading signal via webhook.

        Args:
            action: 'BUY' or 'SELL'
            symbol: Instrument symbol
            price: Signal price
            stop_loss: Stop loss price (optional)
            take_profit: Take profit price (optional)
            reason: Signal reason for logging

        Returns:
            True if webhook succeeded, False otherwise
        """
        payload = {
            'symbol': symbol,
            'action': action.upper(),
            'price': price,
            'strategy': self.strategy_name,
            'notes': reason or f"{self.display_name}: {action} {symbol} @ {price}",
        }

        if stop_loss is not None:
            payload['stopLoss'] = stop_loss
        if take_profit is not None:
            payload['takeProfit'] = take_profit

        headers = {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': WEBHOOK_SECRET,
        }

        try:
            resp = requests.post(WEBHOOK_URL, json=payload, headers=headers, timeout=10)
            if resp.status_code == 200:
                return True
            else:
                log_message(
                    self.agent_id,
                    f"Webhook returned {resp.status_code}: {resp.text[:100]}",
                    type='warning'
                )
                return False
        except Exception as e:
            log_message(self.agent_id, f"Webhook error: {e}", type='error')
            return False

    # ═══════════════════════════════════════════════════════════════════════════
    # STATUS EMISSION
    # ═══════════════════════════════════════════════════════════════════════════

    def _broadcast_status(self, message: str = "Scanning...") -> None:
        """Emit status to stdout (for agent_runner.ts) and write status file."""
        status = {
            'id': self.agent_id,
            'name': self.display_name,
            'status': 'HALTED' if self.halted else 'ACTIVE',
            'last_updated': datetime.now().isoformat(),
            'scan_count': self.scan_count,
            'active_trades': len(self.active_trades),
            'message': message,
            'performance': {
                'daily_pnl': round(self.daily_pnl, 2),
                'wins': self.wins,
                'losses': self.losses,
                'win_rate': round(self.wins / max(self.wins + self.losses, 1) * 100, 1),
            },
            **self.get_status_extras()
        }

        # Write to status file
        try:
            self.status_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.status_file, 'w') as f:
                json.dump(status, f, indent=2)
        except Exception as e:
            print(f"[{self.display_name}] Failed to write status file: {e}", file=sys.stderr)

        # Emit to stdout for agent_runner.ts
        update = {
            'agentId': self.agent_id,
            'status': status['status'],
            'message': message,
            'pnl': self.daily_pnl,
            'trades': len(self.active_trades),
            'timestamp': datetime.now().isoformat(),
        }
        print(f"AGENT_STATUS_UPDATE:{json.dumps(update)}", flush=True)

    def _broadcast_waiting(self) -> None:
        """Emit waiting status (market closed, etc.)."""
        self._broadcast_status(message="Waiting for market hours...")

    # ═══════════════════════════════════════════════════════════════════════════
    # STATE PERSISTENCE
    # ═══════════════════════════════════════════════════════════════════════════

    def _save_state(self) -> None:
        """Persist agent state for crash recovery."""
        save_agent_state(self.agent_id, {
            'active_trades': self.active_trades,
            'scan_count': self.scan_count,
            'daily_pnl': self.daily_pnl,
            'wins': self.wins,
            'losses': self.losses,
        })

    def _load_state(self) -> None:
        """Restore agent state from previous session."""
        state = load_agent_state(self.agent_id)
        if state:
            self.active_trades = state.get('active_trades', [])
            self.scan_count = state.get('scan_count', 0)
            self.daily_pnl = state.get('daily_pnl', 0.0)
            self.wins = state.get('wins', 0)
            self.losses = state.get('losses', 0)
            log_message(
                self.agent_id,
                f"Restored state: {len(self.active_trades)} active trades, "
                f"${self.daily_pnl:.2f} daily P&L"
            )

    # ═══════════════════════════════════════════════════════════════════════════
    # ERROR HANDLING (CIRCUIT BREAKER)
    # ═══════════════════════════════════════════════════════════════════════════

    def _handle_error(self, e: Exception) -> None:
        """
        Handle exceptions with escalating backoff and circuit breaker.
        After max_consecutive_errors, agent halts.
        """
        self.consecutive_errors += 1
        self.last_error = f"{type(e).__name__}: {str(e)}"

        # Log error
        log_message(
            self.agent_id,
            f"Error #{self.consecutive_errors}/{self.max_consecutive_errors}: {self.last_error}",
            type='error' if self.consecutive_errors >= 3 else 'warning'
        )
        print(f"[{self.display_name}] Error: {self.last_error}", file=sys.stderr)
        traceback.print_exc()

        # Circuit breaker: halt after too many errors
        if self.consecutive_errors >= self.max_consecutive_errors:
            self.halted = True
            log_message(
                self.agent_id,
                f"CIRCUIT BREAKER: {self.max_consecutive_errors} consecutive errors. HALTING.",
                type='error'
            )
            self._broadcast_status(message=f"HALTED: {self.last_error}")
            return

        # Exponential backoff: 60s, 120s, 240s, ... capped at 10 min
        backoff = min(
            self.error_backoff_base_sec * (2 ** (self.consecutive_errors - 1)),
            600
        )
        log_message(
            self.agent_id,
            f"Retrying in {backoff}s...",
            type='warning'
        )
        time.sleep(backoff)

    # ═══════════════════════════════════════════════════════════════════════════
    # UTILITIES
    # ═══════════════════════════════════════════════════════════════════════════

    def _print_banner(self) -> None:
        """Print startup banner."""
        print(self.get_banner())

    def halt(self, reason: str = "Manual halt") -> None:
        """Halt the agent loop."""
        self.halted = True
        log_message(self.agent_id, f"HALTED: {reason}", type='warning')
        self._broadcast_status(message=f"HALTED: {reason}")

    def resume(self) -> None:
        """Resume a halted agent (must be called externally before re-running)."""
        self.halted = False
        self.consecutive_errors = 0
        log_message(self.agent_id, f"{self.display_name} resumed")
