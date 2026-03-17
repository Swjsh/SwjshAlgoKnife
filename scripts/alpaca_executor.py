#!/usr/bin/env python3
"""
Alpaca Direct Executor - Direct REST API Integration
=====================================================

This module submits crypto and equity trades directly to Alpaca's REST API.
No webhooks, no round-trip through Next.js — pure direct execution from Python agents.

Key Features:
• Market orders for BTC/USD, ETH/USD, SOL/USD (crypto) and equities
• Position sizing based on account balance and risk params
• Real-time order status checking
• Account balance and position queries
• Proper error handling and logging
• Environment variable support (APCA_API_KEY_ID, APCA_API_SECRET_KEY, APCA_API_BASE_URL)

Usage:
    from alpaca_executor import AlpacaExecutor

    executor = AlpacaExecutor()
    account = executor.get_account_info()
    print(f"Cash: ${account['cash']}, Buying Power: ${account['buying_power']}")

    order = executor.submit_market_order(
        symbol="BTC/USD",
        qty=0.01,
        side="buy"
    )
    print(f"Order {order['id']} status: {order['status']}")
"""

import os
import json
import requests
import time
from typing import Optional, Dict, Any, List
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env.local (same as Next.js does)
load_dotenv(".env.local", override=True)

# ── Configuration ──────────────────────────────────────────────────────────
APCA_API_KEY_ID = os.getenv("APCA_API_KEY_ID")
APCA_API_SECRET_KEY = os.getenv("APCA_API_SECRET_KEY")
APCA_API_BASE_URL = os.getenv("APCA_API_BASE_URL", "https://paper-api.alpaca.markets")

# Only raise on instantiation if credentials are missing, not at import time
# This allows the module to be imported even if .env hasn't been loaded yet

# For notional sizing: use 1% of account balance per trade
DEFAULT_RISK_PER_TRADE_PCT = 1.0


class AlpacaExecutor:
    """Direct REST API executor for Alpaca crypto and equity trading."""

    def __init__(
        self,
        api_key: str = None,
        api_secret: str = None,
        base_url: str = None,
    ):
        """
        Initialize Alpaca executor.

        Args:
            api_key: Alpaca API key ID (defaults to APCA_API_KEY_ID env var)
            api_secret: Alpaca API secret key (defaults to APCA_API_SECRET_KEY env var)
            base_url: Base URL (defaults to APCA_API_BASE_URL env var or paper-api.alpaca.markets)
        """
        # Use provided values or fall back to environment variables
        api_key = api_key or APCA_API_KEY_ID or os.getenv("APCA_API_KEY_ID")
        api_secret = api_secret or APCA_API_SECRET_KEY or os.getenv("APCA_API_SECRET_KEY")
        base_url = base_url or APCA_API_BASE_URL or os.getenv("APCA_API_BASE_URL", "https://paper-api.alpaca.markets")

        if not api_key or not api_secret:
            raise ValueError("APCA_API_KEY_ID and APCA_API_SECRET_KEY must be set in environment variables or passed to constructor")

        self.api_key = api_key
        self.api_secret = api_secret
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self._set_headers()

    def _set_headers(self) -> None:
        """Set Alpaca API headers."""
        self.session.headers.update({
            "APCA-API-KEY-ID": self.api_key,
            "APCA-API-SECRET-KEY": self.api_secret,
            "Content-Type": "application/json",
        })

    def _request(
        self,
        method: str,
        endpoint: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Make authenticated request to Alpaca API.

        Args:
            method: HTTP method (GET, POST, DELETE)
            endpoint: API endpoint (e.g., "/v2/account")
            **kwargs: Additional arguments for requests.request()

        Returns:
            Response JSON

        Raises:
            Exception: If API returns error status
        """
        url = f"{self.base_url}{endpoint}"

        try:
            resp = self.session.request(method, url, timeout=10, **kwargs)

            if not resp.ok:
                error_text = resp.text[:500]  # First 500 chars of error
                raise Exception(f"Alpaca API error {resp.status_code}: {error_text}")

            return resp.json()
        except requests.exceptions.RequestException as e:
            raise Exception(f"Request failed: {str(e)}")

    # ── Account & Position Info ────────────────────────────────────────────

    def get_account_info(self) -> Dict[str, Any]:
        """
        Get account details (balance, buying power, status).

        Returns:
            {
                'id': str,
                'account_number': str,
                'status': str,
                'currency': str,
                'cash': float,
                'portfolio_value': float,
                'buying_power': float,
                'pattern_day_trader': bool,
            }
        """
        data = self._request("GET", "/v2/account")

        # Convert string values to appropriate types
        return {
            'id': data.get('id'),
            'account_number': data.get('account_number'),
            'status': data.get('status'),
            'currency': data.get('currency', 'USD'),
            'cash': float(data.get('cash', 0)),
            'portfolio_value': float(data.get('portfolio_value', 0)),
            'buying_power': float(data.get('buying_power', 0)),
            'pattern_day_trader': bool(data.get('pattern_day_trader', False)),
        }

    def get_positions(self) -> List[Dict[str, Any]]:
        """
        Get all open positions.

        Returns:
            List of positions:
            [{
                'symbol': str,
                'qty': float,
                'side': 'long' | 'short',
                'avg_entry_price': float,
                'market_value': float,
                'unrealized_pl': float,
                'current_price': float,
            }, ...]
        """
        data = self._request("GET", "/v2/positions")

        positions = []
        for pos in data:
            positions.append({
                'symbol': pos.get('symbol'),
                'qty': float(pos.get('qty', 0)),
                'side': pos.get('side'),
                'avg_entry_price': float(pos.get('avg_entry_price', 0)),
                'market_value': float(pos.get('market_value', 0)),
                'unrealized_pl': float(pos.get('unrealized_pl', 0)),
                'current_price': float(pos.get('current_price', 0)),
            })
        return positions

    def get_position(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific position by symbol.

        Args:
            symbol: Trading symbol (e.g., "BTC/USD", "AAPL")

        Returns:
            Position dict, or None if not found
        """
        try:
            data = self._request("GET", f"/v2/positions/{symbol}")
            return {
                'symbol': data.get('symbol'),
                'qty': float(data.get('qty', 0)),
                'side': data.get('side'),
                'avg_entry_price': float(data.get('avg_entry_price', 0)),
                'market_value': float(data.get('market_value', 0)),
                'unrealized_pl': float(data.get('unrealized_pl', 0)),
                'current_price': float(data.get('current_price', 0)),
            }
        except Exception as e:
            if "404" in str(e):
                return None  # No position
            raise

    # ── Market Data ────────────────────────────────────────────────────────

    def get_current_price(self, symbol: str) -> Optional[float]:
        """
        Get current price from Alpaca's data API.

        Args:
            symbol: Trading symbol (e.g., "BTC/USD")

        Returns:
            Current price, or None if not available
        """
        try:
            data = self._request("GET", f"/v2/last/crypto?symbols={symbol}")
            if data and 'crypto' in data:
                crypto_data = data['crypto'].get(symbol, {})
                last = crypto_data.get('last', {})
                return float(last.get('price')) if last else None
            return None
        except Exception as e:
            print(f"[AlpacaExecutor] ⚠️ Price fetch failed for {symbol}: {e}")
            return None

    # ── Order Submission ───────────────────────────────────────────────────

    def submit_market_order(
        self,
        symbol: str,
        qty: float,
        side: str,
        time_in_force: str = "day",
    ) -> Dict[str, Any]:
        """
        Submit a market order.

        Args:
            symbol: Trading symbol (e.g., "BTC/USD", "AAPL")
            qty: Quantity to trade
            side: "buy" or "sell"
            time_in_force: "day" (default) or "gtc" (for crypto, use "gtc")

        Returns:
            {
                'id': str (order ID),
                'symbol': str,
                'qty': str,
                'side': str,
                'status': str (e.g., 'pending_new', 'filled', 'partially_filled'),
                'filled_qty': str,
                'filled_avg_price': str,
                'type': str,
                'submitted_at': str,
                'filled_at': str (if filled),
            }
        """
        if side not in ("buy", "sell"):
            raise ValueError(f"Invalid side: {side}. Must be 'buy' or 'sell'")

        payload = {
            "symbol": symbol,
            "qty": str(qty),
            "side": side,
            "type": "market",
            "time_in_force": time_in_force,
        }

        print(f"[AlpacaExecutor] 📤 Submitting order: {side.upper()} {qty} {symbol} (TIF: {time_in_force})")

        data = self._request("POST", "/v2/orders", json=payload)

        order = {
            'id': data.get('id'),
            'symbol': data.get('symbol'),
            'qty': data.get('qty'),
            'side': data.get('side'),
            'status': data.get('status'),
            'filled_qty': data.get('filled_qty', '0'),
            'filled_avg_price': data.get('filled_avg_price'),
            'type': data.get('type'),
            'submitted_at': data.get('submitted_at'),
            'filled_at': data.get('filled_at'),
        }

        print(f"[AlpacaExecutor] ✅ Order {order['id']} submitted: status={order['status']}")
        return order

    def get_order(self, order_id: str) -> Dict[str, Any]:
        """
        Get order status by ID.

        Args:
            order_id: Order ID from submit_market_order()

        Returns:
            Order dict with current status
        """
        data = self._request("GET", f"/v2/orders/{order_id}")

        return {
            'id': data.get('id'),
            'symbol': data.get('symbol'),
            'qty': data.get('qty'),
            'side': data.get('side'),
            'status': data.get('status'),
            'filled_qty': data.get('filled_qty', '0'),
            'filled_avg_price': data.get('filled_avg_price'),
            'type': data.get('type'),
            'submitted_at': data.get('submitted_at'),
            'filled_at': data.get('filled_at'),
        }

    def cancel_order(self, order_id: str) -> None:
        """
        Cancel an open order.

        Args:
            order_id: Order ID to cancel
        """
        try:
            self._request("DELETE", f"/v2/orders/{order_id}")
            print(f"[AlpacaExecutor] ✅ Order {order_id} cancelled")
        except Exception as e:
            if "404" in str(e):
                print(f"[AlpacaExecutor] ⚠️ Order {order_id} not found (already filled/cancelled?)")
            else:
                raise

    # ── Position Management ────────────────────────────────────────────────

    def close_position(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Close a position (liquidate all shares/coins).

        Args:
            symbol: Symbol to close (e.g., "BTC/USD")

        Returns:
            Closing order dict, or None if no position
        """
        # First check if position exists
        position = self.get_position(symbol)
        if not position:
            print(f"[AlpacaExecutor] ℹ️ No position to close for {symbol}")
            return None

        print(f"[AlpacaExecutor] 🔄 Closing position: {position['side'].upper()} {position['qty']} {symbol}")

        try:
            data = self._request("DELETE", f"/v2/positions/{symbol}")

            order = {
                'id': data.get('id'),
                'symbol': data.get('symbol'),
                'qty': data.get('qty'),
                'side': data.get('side'),
                'status': data.get('status'),
                'filled_qty': data.get('filled_qty', '0'),
                'filled_avg_price': data.get('filled_avg_price'),
            }

            print(f"[AlpacaExecutor] ✅ Position closed: {order['id']}")
            return order
        except Exception as e:
            print(f"[AlpacaExecutor] ❌ Failed to close {symbol}: {e}")
            raise

    # ── Position Sizing ───────────────────────────────────────────────────

    def calculate_position_size_notional(
        self,
        account_balance: float = None,
        risk_pct: float = DEFAULT_RISK_PER_TRADE_PCT,
    ) -> float:
        """
        Calculate position size based on notional amount (% of account).

        Args:
            account_balance: Account balance (if None, fetches from API)
            risk_pct: Risk as % of account (default 1%)

        Returns:
            Dollar amount to risk in trade
        """
        if account_balance is None:
            account = self.get_account_info()
            account_balance = account['cash']

        risk_amount = account_balance * (risk_pct / 100)
        return risk_amount

    def calculate_position_size_from_sl(
        self,
        entry_price: float,
        stop_loss: float,
        account_balance: float = None,
        risk_pct: float = DEFAULT_RISK_PER_TRADE_PCT,
    ) -> float:
        """
        Calculate position size from entry and stop loss prices.

        Args:
            entry_price: Entry price
            stop_loss: Stop loss price
            account_balance: Account balance (if None, fetches from API)
            risk_pct: Risk as % of account

        Returns:
            Quantity (for crypto, in coins; for equities, in shares)
        """
        if account_balance is None:
            account = self.get_account_info()
            account_balance = account['cash']

        risk_amount = account_balance * (risk_pct / 100)
        risk_per_unit = abs(entry_price - stop_loss)

        if risk_per_unit <= 0:
            raise ValueError(f"Invalid SL: entry={entry_price}, sl={stop_loss}")

        qty = risk_amount / risk_per_unit
        return qty

    # ── Execution Flow ────────────────────────────────────────────────────

    def execute_trade(
        self,
        symbol: str,
        direction: str,  # "LONG" or "SHORT"
        entry_price: float,
        stop_loss: float,
        take_profit: float,
        account_balance: float = None,
        risk_pct: float = DEFAULT_RISK_PER_TRADE_PCT,
    ) -> Dict[str, Any]:
        """
        Execute a trade with position sizing.

        Args:
            symbol: Trading symbol
            direction: "LONG" or "SHORT"
            entry_price: Expected entry price
            stop_loss: Stop loss price
            take_profit: Take profit price
            account_balance: Account balance (fetched if None)
            risk_pct: Risk as % of account

        Returns:
            Order dict with execution details
        """
        if direction not in ("LONG", "SHORT"):
            raise ValueError(f"Invalid direction: {direction}")

        # Calculate position size
        qty = self.calculate_position_size_from_sl(
            entry_price, stop_loss, account_balance, risk_pct
        )

        # Round for crypto (4 decimals), whole numbers for equities
        is_crypto = "/" in symbol  # e.g., "BTC/USD"
        if is_crypto:
            qty = max(0.001, float(f"{qty:.4f}"))  # Min 0.001 coins
        else:
            qty = max(1, int(qty))  # Min 1 share

        side = "buy" if direction == "LONG" else "sell"
        time_in_force = "gtc" if is_crypto else "day"

        # Submit order
        order = self.submit_market_order(symbol, qty, side, time_in_force)

        # Log trade details
        risk_amount = self.calculate_position_size_notional(account_balance, risk_pct)
        print(
            f"[AlpacaExecutor] 💼 Trade: {direction} {qty:.4f if is_crypto else '.0f'} {symbol} "
            f"@ ~${entry_price:.2f} | Risk: ${risk_amount:.2f} | "
            f"SL: ${stop_loss:.2f} | TP: ${take_profit:.2f}"
        )

        return {
            'order': order,
            'symbol': symbol,
            'direction': direction,
            'qty': qty,
            'entry_price': entry_price,
            'stop_loss': stop_loss,
            'take_profit': take_profit,
            'risk_amount': risk_amount,
        }

    # ── Connection Test ───────────────────────────────────────────────────

    def test_connection(self) -> bool:
        """
        Test connection to Alpaca API.

        Returns:
            True if connected, False otherwise
        """
        try:
            account = self.get_account_info()
            print(
                f"[AlpacaExecutor] ✅ Alpaca connected!\n"
                f"  Account: {account['account_number']}\n"
                f"  Cash: ${account['cash']:,.2f}\n"
                f"  Buying Power: ${account['buying_power']:,.2f}\n"
                f"  Portfolio Value: ${account['portfolio_value']:,.2f}\n"
                f"  Status: {account['status']}"
            )
            return True
        except Exception as e:
            print(f"[AlpacaExecutor] ❌ Connection failed: {e}")
            return False


# ── Standalone Test ───────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "="*70)
    print("ALPACA EXECUTOR - DIRECT INTEGRATION TEST")
    print("="*70 + "\n")

    try:
        executor = AlpacaExecutor()

        # Test connection
        print("1. Testing connection...")
        if not executor.test_connection():
            print("Failed to connect to Alpaca")
            exit(1)

        print("\n2. Getting account info...")
        account = executor.get_account_info()
        print(f"  Cash available: ${account['cash']:,.2f}")
        print(f"  Buying power: ${account['buying_power']:,.2f}")

        print("\n3. Checking open positions...")
        positions = executor.get_positions()
        if positions:
            print(f"  Found {len(positions)} open position(s):")
            for pos in positions:
                print(
                    f"    • {pos['symbol']}: {pos['qty']} @ ${pos['avg_entry_price']} "
                    f"| Value: ${pos['market_value']:,.2f} | P&L: ${pos['unrealized_pl']:,.2f}"
                )
        else:
            print("  No open positions")

        print("\n4. Testing position size calculation...")
        risk_amount = executor.calculate_position_size_notional(
            account_balance=account['cash'],
            risk_pct=1.0
        )
        print(f"  Risk amount (1% of ${account['cash']:,.2f}): ${risk_amount:,.2f}")

        print("\n5. Testing SL-based position sizing...")
        qty = executor.calculate_position_size_from_sl(
            entry_price=72800,  # BTC price
            stop_loss=72000,
            account_balance=account['cash'],
            risk_pct=1.0
        )
        print(f"  Position size for BTC entry=$72,800, SL=$72,000: {qty:.4f} BTC")

        print("\n" + "="*70)
        print("✅ Alpaca executor ready for trading")
        print("="*70 + "\n")

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
