#!/usr/bin/env python3
"""
Test suite for SPX Sniper direct Alpaca execution (SCRUM-5).

Tests the USE_DIRECT_ALPACA flag behavior:
- When False: uses webhook (default)
- When True: uses AlpacaExecutor directly with order polling

Run: pytest tests/spx_sniper_direct.test.py -v
"""

import json
import tempfile
import time
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import pytest
import sys
import os

# Change to project directory for imports to work
os.chdir(Path(__file__).parent.parent)
sys.path.insert(0, str(Path(__file__).parent.parent / 'scripts'))


# ═══════════════════════════════════════════════════════════════════════════
# FIXTURES
# ═══════════════════════════════════════════════════════════════════════════

@pytest.fixture
def mock_env(monkeypatch):
    """Mock environment variables."""
    monkeypatch.setenv("WEBHOOK_SECRET", "test-secret-123")
    monkeypatch.setenv("APCA_API_KEY_ID", "test-key")
    monkeypatch.setenv("APCA_API_SECRET_KEY", "test-secret")
    monkeypatch.setenv("APCA_API_BASE_URL", "https://paper-api.alpaca.markets")
    monkeypatch.setenv("USE_DIRECT_ALPACA", "false")
    yield


@pytest.fixture
def mock_env_direct(monkeypatch):
    """Mock environment with USE_DIRECT_ALPACA=true."""
    monkeypatch.setenv("WEBHOOK_SECRET", "test-secret-123")
    monkeypatch.setenv("APCA_API_KEY_ID", "test-key")
    monkeypatch.setenv("APCA_API_SECRET_KEY", "test-secret")
    monkeypatch.setenv("APCA_API_BASE_URL", "https://paper-api.alpaca.markets")
    monkeypatch.setenv("USE_DIRECT_ALPACA", "true")
    yield


@pytest.fixture
def mock_alpaca_executor():
    """Create a mock AlpacaExecutor."""
    mock = MagicMock()
    mock.get_account_info.return_value = {
        'id': 'test-account',
        'account_number': '12345',
        'status': 'ACTIVE',
        'currency': 'USD',
        'cash': 100000.0,
        'portfolio_value': 100000.0,
        'buying_power': 200000.0,
        'pattern_day_trader': False,
    }
    mock.get_position.return_value = None  # No existing position
    mock.submit_market_order.return_value = {
        'id': 'order-123',
        'symbol': 'SPY',
        'qty': '10',
        'side': 'buy',
        'status': 'pending_new',
        'filled_qty': '0',
        'filled_avg_price': None,
        'type': 'market',
        'submitted_at': datetime.now().isoformat(),
        'filled_at': None,
    }
    mock.get_order.return_value = {
        'id': 'order-123',
        'symbol': 'SPY',
        'qty': '10',
        'side': 'buy',
        'status': 'filled',
        'filled_qty': '10',
        'filled_avg_price': '590.25',
        'type': 'market',
        'submitted_at': datetime.now().isoformat(),
        'filled_at': datetime.now().isoformat(),
    }
    return mock


# ═══════════════════════════════════════════════════════════════════════════
# TEST: CONFIG FLAG
# ═══════════════════════════════════════════════════════════════════════════

class TestDirectAlpacaConfig:
    """Test USE_DIRECT_ALPACA configuration flag."""

    def test_default_is_false(self, mock_env):
        """USE_DIRECT_ALPACA defaults to False."""
        # Import after env is set
        import importlib
        import spx_sniper_engine as engine
        importlib.reload(engine)

        assert hasattr(engine, 'USE_DIRECT_ALPACA')
        assert engine.USE_DIRECT_ALPACA is False

    def test_can_enable_via_env(self, mock_env_direct):
        """USE_DIRECT_ALPACA can be enabled via environment variable."""
        import importlib
        import spx_sniper_engine as engine
        importlib.reload(engine)

        assert engine.USE_DIRECT_ALPACA is True


# ═══════════════════════════════════════════════════════════════════════════
# TEST: DIRECT EXECUTION
# ═══════════════════════════════════════════════════════════════════════════

class TestDirectExecution:
    """Test direct Alpaca execution path."""

    def test_execute_direct_submits_order(self, mock_env_direct, mock_alpaca_executor):
        """execute_direct() submits order via AlpacaExecutor."""
        import importlib
        import spx_sniper_engine as engine
        importlib.reload(engine)

        # Patch the executor
        with patch.object(engine, '_get_executor', return_value=mock_alpaca_executor):
            result = engine.execute_direct(
                action='BUY',
                price=590.00,
                stop_loss=585.00,
                take_profit=595.00,
                reason='Test signal'
            )

        assert result['success'] is True
        assert result['order_id'] == 'order-123'
        mock_alpaca_executor.submit_market_order.assert_called_once()

    def test_execute_direct_polls_for_fill(self, mock_env_direct, mock_alpaca_executor):
        """execute_direct() polls order status until filled."""
        import importlib
        import spx_sniper_engine as engine
        importlib.reload(engine)

        # Make get_order return pending first, then filled
        mock_alpaca_executor.get_order.side_effect = [
            {'id': 'order-123', 'status': 'pending_new', 'filled_avg_price': None},
            {'id': 'order-123', 'status': 'filled', 'filled_avg_price': '590.25'},
        ]

        with patch.object(engine, '_get_executor', return_value=mock_alpaca_executor):
            with patch('time.sleep'):  # Don't actually sleep in tests
                result = engine.execute_direct(
                    action='BUY',
                    price=590.00,
                    stop_loss=585.00,
                    take_profit=595.00,
                    reason='Test signal'
                )

        assert result['success'] is True
        assert result['fill_price'] == 590.25
        assert mock_alpaca_executor.get_order.call_count >= 2

    def test_execute_direct_logs_slippage(self, mock_env_direct, mock_alpaca_executor):
        """execute_direct() logs slippage (fill price vs expected price)."""
        import importlib
        import spx_sniper_engine as engine
        importlib.reload(engine)

        expected_price = 590.00
        fill_price = 590.25

        mock_alpaca_executor.get_order.return_value = {
            'id': 'order-123',
            'status': 'filled',
            'filled_avg_price': str(fill_price),
        }

        with patch.object(engine, '_get_executor', return_value=mock_alpaca_executor):
            result = engine.execute_direct(
                action='BUY',
                price=expected_price,
                stop_loss=585.00,
                take_profit=595.00,
                reason='Test signal'
            )

        assert result['success'] is True
        assert result['fill_price'] == fill_price
        assert result['slippage'] == pytest.approx(0.25, abs=0.01)  # $0.25 slippage

    def test_execute_direct_handles_order_failure(self, mock_env_direct, mock_alpaca_executor):
        """execute_direct() handles order rejection gracefully."""
        import importlib
        import spx_sniper_engine as engine
        importlib.reload(engine)

        mock_alpaca_executor.submit_market_order.side_effect = Exception("Insufficient buying power")

        with patch.object(engine, '_get_executor', return_value=mock_alpaca_executor):
            result = engine.execute_direct(
                action='BUY',
                price=590.00,
                stop_loss=585.00,
                take_profit=595.00,
                reason='Test signal'
            )

        assert result['success'] is False
        assert 'error' in result


# ═══════════════════════════════════════════════════════════════════════════
# TEST: SIGNAL ROUTING
# ═══════════════════════════════════════════════════════════════════════════

class TestSignalRouting:
    """Test fire_signal routes to correct execution path."""

    def test_fire_signal_uses_webhook_when_flag_false(self, mock_env):
        """fire_signal() uses webhook when USE_DIRECT_ALPACA=false."""
        import importlib
        import spx_sniper_engine as engine
        importlib.reload(engine)

        with patch.object(engine, 'requests') as mock_requests:
            mock_requests.post.return_value = MagicMock(status_code=200)

            result = engine.fire_signal(
                action='BUY',
                price=590.00,
                stop_loss=585.00,
                take_profit=595.00,
                reason='Test signal'
            )

        mock_requests.post.assert_called_once()
        assert result is True

    def test_fire_signal_uses_direct_when_flag_true(self, mock_env_direct, mock_alpaca_executor):
        """fire_signal() uses direct execution when USE_DIRECT_ALPACA=true."""
        import importlib
        import spx_sniper_engine as engine
        importlib.reload(engine)

        with patch.object(engine, '_get_executor', return_value=mock_alpaca_executor):
            with patch.object(engine, 'execute_direct', return_value={'success': True}) as mock_direct:
                result = engine.fire_signal(
                    action='BUY',
                    price=590.00,
                    stop_loss=585.00,
                    take_profit=595.00,
                    reason='Test signal'
                )

        mock_direct.assert_called_once()
        assert result is True


# ═══════════════════════════════════════════════════════════════════════════
# TEST: EXIT ORDERS
# ═══════════════════════════════════════════════════════════════════════════

class TestExitOrders:
    """Test exit order handling with direct execution."""

    def test_exit_closes_position_directly(self, mock_env_direct, mock_alpaca_executor):
        """EXIT action closes position via direct API when flag is true."""
        import importlib
        import spx_sniper_engine as engine
        importlib.reload(engine)

        mock_alpaca_executor.close_position.return_value = {
            'id': 'close-order-123',
            'symbol': 'SPY',
            'status': 'filled',
        }

        with patch.object(engine, '_get_executor', return_value=mock_alpaca_executor):
            result = engine.execute_direct(
                action='EXIT',
                price=595.00,
                reason='TP hit'
            )

        mock_alpaca_executor.close_position.assert_called_with('SPY')
        assert result['success'] is True


# ═══════════════════════════════════════════════════════════════════════════
# RUN TESTS
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
