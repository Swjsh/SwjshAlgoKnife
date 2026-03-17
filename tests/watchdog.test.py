#!/usr/bin/env python3
"""
Test suite for watchdog.py — validates all 18 monitoring checks, alert throttle, and wake_chief path.
Tests use mocks for DB, file I/O, and HTTP to avoid external dependencies.

Run: pytest tests/watchdog.test.py -v
"""

import json
import sqlite3
import tempfile
import time
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import pytest
import sys
import os

# Change to project directory for imports to work
os.chdir(Path(__file__).parent.parent)
sys.path.insert(0, str(Path(__file__).parent.parent / 'scripts'))

# Now import watchdog
import watchdog


# ═══════════════════════════════════════════════════════════════════════════
# FIXTURES
# ═══════════════════════════════════════════════════════════════════════════

@pytest.fixture
def mock_env(monkeypatch):
    """Mock environment variables and paths."""
    tmp_dir = tempfile.mkdtemp()
    tmp_path = Path(tmp_dir)

    db_path = tmp_path / "journal.db"
    agents_db_path = tmp_path / "agents_db.json"
    data_dir = tmp_path / "data"
    data_dir.mkdir(exist_ok=True)

    monkeypatch.setenv("APP_DIR", str(tmp_path))
    monkeypatch.setenv("DATABASE_PATH", str(db_path))
    monkeypatch.setenv("AGENTS_DB_PATH", str(agents_db_path))
    monkeypatch.setenv("DATA_DIR", str(data_dir))
    monkeypatch.setenv("DISCORD_CHIEF_WEBHOOK", "https://discord.com/api/webhooks/test/webhook")
    monkeypatch.setenv("OPENCLAW_GATEWAY", "http://127.0.0.1:3001")
    monkeypatch.setenv("OPENCLAW_GATEWAY_TOKEN", "test-token-12345")
    monkeypatch.setenv("ACCOUNT_BALANCE", "10000")

    yield {
        "db_path": db_path,
        "agents_db_path": agents_db_path,
        "data_dir": data_dir,
        "tmp_path": tmp_path
    }

    # Manual cleanup
    import shutil
    try:
        shutil.rmtree(str(tmp_path))
    except Exception:
        pass


@pytest.fixture
def sample_agents_db():
    """Sample agents_db.json with healthy agents."""
    return {
        "fx": {
            "status": "ACTIVE",
            "last_updated": datetime.now().isoformat(),
            "active_trades": [
                {"ticker": "EURUSD", "side": "LONG", "entry_time": datetime.now().isoformat()}
            ],
            "performance": {"win_rate": 45.0, "trades": 20, "total_pnl": 250.0},
            "closed_trades": []
        },
        "crypto": {
            "status": "ACTIVE",
            "last_updated": datetime.now().isoformat(),
            "active_trades": [],
            "performance": {"win_rate": 55.0, "trades": 25, "total_pnl": 500.0},
            "closed_trades": []
        },
        "futures": {
            "status": "ACTIVE",
            "last_updated": (datetime.now() - timedelta(seconds=60)).isoformat(),
            "active_trades": [],
            "performance": {"win_rate": 40.0, "trades": 30, "total_pnl": 300.0},
            "closed_trades": []
        },
        "boba": {
            "status": "PAUSED",
            "last_updated": datetime.now().isoformat(),
            "active_trades": [],
            "performance": {"win_rate": 0.0, "trades": 0, "total_pnl": 0.0},
            "closed_trades": []
        },
        "spx": {
            "status": "ONLINE",
            "last_updated": datetime.now().isoformat(),
            "active_trades": [],
            "performance": {"win_rate": 50.0, "trades": 10, "total_pnl": 150.0},
            "closed_trades": []
        },
        "orb": {
            "status": "ACTIVE",
            "last_updated": datetime.now().isoformat(),
            "active_trades": [],
            "performance": {"win_rate": 42.0, "trades": 20, "total_pnl": 200.0},
            "closed_trades": []
        },
        "professor": {
            "status": "ACTIVE",
            "reviews": []
        },
        "auditor": {
            "status": "ACTIVE",
            "audits": []
        }
    }


# ═══════════════════════════════════════════════════════════════════════════
# HELPER TESTS
# ═══════════════════════════════════════════════════════════════════════════

class TestHelpers:
    """Test utility functions."""

    def test_alert_throttle_fires_first_time(self):
        """AlertThrottle should fire on first call."""
        throttle = watchdog.AlertThrottle()
        assert throttle.should_fire("test_key", 60) is True

    def test_alert_throttle_suppresses_within_cooldown(self):
        """AlertThrottle should suppress within cooldown window."""
        throttle = watchdog.AlertThrottle()
        assert throttle.should_fire("test_key", 60) is True
        assert throttle.should_fire("test_key", 60) is False
        assert throttle.should_fire("test_key", 60) is False

    def test_alert_throttle_fires_after_cooldown(self):
        """AlertThrottle should fire again after cooldown expires."""
        throttle = watchdog.AlertThrottle()
        cooldown = 1

        assert throttle.should_fire("test_key", cooldown) is True
        assert throttle.should_fire("test_key", cooldown) is False

        time.sleep(cooldown + 0.1)

        assert throttle.should_fire("test_key", cooldown) is True

    def test_parse_iso_valid(self):
        """parse_iso should handle valid ISO timestamps."""
        iso_str = "2026-03-15T14:30:00"
        result = watchdog.parse_iso(iso_str)
        assert result is not None
        assert result.year == 2026

    def test_parse_iso_with_z(self):
        """parse_iso should handle 'Z' timezone indicator."""
        iso_str = "2026-03-15T14:30:00Z"
        result = watchdog.parse_iso(iso_str)
        assert result is not None

    def test_parse_iso_invalid(self):
        """parse_iso should return None for invalid input."""
        result = watchdog.parse_iso("not-a-date")
        assert result is None

    def test_seconds_since(self):
        """seconds_since should calculate elapsed time."""
        past = (datetime.now() - timedelta(seconds=10)).isoformat()
        elapsed = watchdog.seconds_since(past)
        assert 9 < elapsed < 11

    def test_is_weekday(self):
        """is_weekday should return bool based on current day."""
        result = watchdog.is_weekday()
        assert isinstance(result, bool)

    @patch('watchdog.now_et')
    def test_is_market_session_nyse_open(self, mock_now):
        """is_market_session should detect NYSE open hours (9:30am-4:00pm ET)."""
        mock_now.return_value = datetime(2026, 3, 13, 10, 30)
        assert watchdog.is_market_session("nyse") is True

    @patch('watchdog.now_et')
    def test_is_market_session_nyse_closed(self, mock_now):
        """is_market_session should detect NYSE closed hours."""
        mock_now.return_value = datetime(2026, 3, 13, 17, 0)
        assert watchdog.is_market_session("nyse") is False

    def test_db_query_no_db(self, mock_env):
        """db_query should return empty list if DB doesn't exist."""
        with patch.object(watchdog, 'DB_PATH', mock_env['db_path']):
            result = watchdog.db_query("SELECT * FROM trades LIMIT 1")
            assert result == []

    def test_load_agents_db_no_file(self, mock_env):
        """load_agents_db should return empty dict if file missing."""
        with patch.object(watchdog, 'AGENTS_DB_PATH', mock_env['agents_db_path']):
            result = watchdog.load_agents_db()
            assert result == {}

    def test_load_agents_db_valid(self, mock_env, sample_agents_db):
        """load_agents_db should load valid JSON."""
        agents_path = mock_env['agents_db_path']
        with open(agents_path, 'w') as f:
            json.dump(sample_agents_db, f)

        with patch.object(watchdog, 'AGENTS_DB_PATH', agents_path):
            result = watchdog.load_agents_db()
            assert result == sample_agents_db


# ═══════════════════════════════════════════════════════════════════════════
# TIER 1 CRITICAL CHECKS
# ═══════════════════════════════════════════════════════════════════════════

class TestTier1Checks:
    """Test Tier 1 critical monitoring checks."""

    @patch('watchdog.post_discord')
    @patch('watchdog.load_agents_db')
    def test_check_agent_health_empty_db(self, mock_load, mock_post):
        """check_agent_health should alert if agents_db missing."""
        mock_load.return_value = {}
        watchdog.check_agent_health()
        mock_post.assert_called()
        call_kwargs = mock_post.call_args[1]
        assert call_kwargs['level'] == 'critical'

    @patch('watchdog.wake_chief')
    @patch('watchdog.post_discord')
    @patch('watchdog.load_agents_db')
    @patch('watchdog.seconds_since')
    def test_check_agent_health_stale(self, mock_secs, mock_load, mock_post, mock_wake):
        """check_agent_health should flag stale agents."""
        sample = {
            "fx": {
                "status": "ACTIVE",
                "last_updated": "2026-03-15T10:00:00"
            }
        }
        mock_load.return_value = sample
        mock_secs.return_value = 150

        watchdog.check_agent_health()

        mock_post.assert_called()
        call_args = mock_post.call_args[0]
        assert "stale" in str(call_args).lower()

    @patch('watchdog.wake_chief')
    @patch('watchdog.post_discord')
    @patch('watchdog.load_agents_db')
    def test_check_agent_health_halted(self, mock_load, mock_post, mock_wake):
        """check_agent_health should wake Chief if agent HALTED."""
        sample = {
            "fx": {
                "status": "HALTED",
                "last_updated": datetime.now().isoformat()
            }
        }
        mock_load.return_value = sample

        watchdog.check_agent_health()

        mock_wake.assert_called()
        assert "halted" in str(mock_wake.call_args).lower()

    @patch('watchdog.post_discord')
    @patch('watchdog.db_query')
    @patch('watchdog.write_error_task')
    @patch('watchdog.wake_chief')
    def test_check_daily_pnl_kill_switch(self, mock_wake, mock_error, mock_query, mock_post):
        """check_daily_pnl should wake Chief when limit breached."""
        mock_query.return_value = [
            {
                "daily_pnl": -250.0,
                "wins": 2,
                "losses": 5
            }
        ]

        with patch.object(watchdog, 'DAILY_LOSS_KILL', 200):
            watchdog.check_daily_pnl()

        mock_wake.assert_called()
        mock_error.assert_called()

    @patch('watchdog.post_discord')
    @patch('watchdog.db_query')
    def test_check_daily_pnl_warning(self, mock_query, mock_post):
        """check_daily_pnl should warn at 50% of kill switch."""
        mock_query.return_value = [
            {
                "daily_pnl": -120.0,
                "wins": 1,
                "losses": 4
            }
        ]

        with patch.object(watchdog, 'DAILY_LOSS_KILL', 200):
            with patch.object(watchdog, 'DAILY_LOSS_WARN', 100):
                watchdog.check_daily_pnl()

        mock_post.assert_called()
        call_kwargs = mock_post.call_args[1]
        assert call_kwargs['level'] == 'warn'

    @patch('watchdog.post_discord')
    @patch('watchdog.load_agents_db')
    def test_check_active_trade_count_limit(self, mock_load, mock_post):
        """check_active_trade_count should flag concurrent limit breach."""
        sample = {
            "fx": {
                "active_trades": [
                    {"ticker": "EURUSD", "side": "LONG"},
                    {"ticker": "GBPUSD", "side": "SHORT"}
                ]
            },
            "crypto": {
                "active_trades": [
                    {"ticker": "BTC-USD", "side": "LONG"}
                ]
            },
            "futures": {"active_trades": []},
            "boba": {"active_trades": []},
            "spx": {"active_trades": []},
            "orb": {"active_trades": []}
        }
        mock_load.return_value = sample

        with patch.object(watchdog, 'MAX_CONCURRENT_TRADES', 2):
            watchdog.check_active_trade_count()

        mock_post.assert_called()
        call_kwargs = mock_post.call_args[1]
        assert call_kwargs['level'] == 'warn'

    @patch('watchdog.post_discord')
    @patch('urllib.request.urlopen')
    def test_check_services_success(self, mock_urlopen, mock_post):
        """check_services should pass if API responds 200."""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.read.return_value = json.dumps({"agents": []}).encode()
        mock_urlopen.return_value.__enter__.return_value = mock_response

        watchdog.check_services()

        mock_post.assert_not_called()

    @patch('watchdog.post_discord')
    @patch('urllib.request.urlopen')
    def test_check_services_down(self, mock_urlopen, mock_post):
        """check_services should alert if API fails."""
        mock_urlopen.side_effect = Exception("Connection refused")

        watchdog.check_services()

        mock_post.assert_called()
        call_kwargs = mock_post.call_args[1]
        assert call_kwargs['level'] == 'critical'

    @patch('watchdog.post_discord')
    @patch('shutil.disk_usage')
    def test_check_disk_space_critical(self, mock_usage, mock_post):
        """check_disk_space should alert at 95% usage."""
        usage = Mock()
        usage.used = 950
        usage.total = 1000
        mock_usage.return_value = usage

        watchdog.check_disk_space()

        mock_post.assert_called()
        call_kwargs = mock_post.call_args[1]
        assert call_kwargs['level'] == 'critical'


# ═══════════════════════════════════════════════════════════════════════════
# TIER 2 TRADING CHECKS
# ═══════════════════════════════════════════════════════════════════════════

class TestTier2Checks:
    """Test Tier 2 trading health checks."""

    @patch('watchdog.post_discord')
    @patch('watchdog.db_query')
    def test_check_stale_pending_trades(self, mock_query, mock_post):
        """check_stale_pending_trades should flag old PENDING trades."""
        mock_query.return_value = [
            {
                "id": 1,
                "symbol": "EURUSD",
                "strategy": "Support/Resistance",
                "mins_pending": 45
            }
        ]

        watchdog.check_stale_pending_trades()

        mock_post.assert_called()
        call_kwargs = mock_post.call_args[1]
        assert call_kwargs['level'] == 'warn'

    @patch('watchdog.post_discord')
    @patch('watchdog.load_agents_db')
    @patch('watchdog.seconds_since')
    def test_check_stale_pending_orders(self, mock_secs, mock_load, mock_post):
        """check_stale_pending_orders should flag old orders in agents_db."""
        sample = {
            "fx": {
                "pending_orders": [
                    {
                        "ticker": "EURUSD",
                        "created_at": "2026-03-15T10:00:00",
                        "type": "ENTRY"
                    }
                ]
            },
            "crypto": {"pending_orders": []},
            "futures": {"pending_orders": []},
            "boba": {"pending_orders": []},
            "spx": {"pending_orders": []},
            "orb": {"pending_orders": []}
        }
        mock_load.return_value = sample
        mock_secs.return_value = 8000

        watchdog.check_stale_pending_orders()

        mock_post.assert_called()

    @patch('watchdog.post_discord')
    @patch('watchdog.load_agents_db')
    @patch('watchdog.seconds_since')
    def test_check_active_trade_duration(self, mock_secs, mock_load, mock_post):
        """check_active_trade_duration should flag trades held too long."""
        sample = {
            "fx": {
                "active_trades": [
                    {
                        "ticker": "EURUSD",
                        "side": "LONG",
                        "entry_time": "2026-03-15T10:00:00"
                    }
                ]
            },
            "crypto": {"active_trades": []},
            "futures": {"active_trades": []},
            "boba": {"active_trades": []},
            "spx": {"active_trades": []},
            "orb": {"active_trades": []}
        }
        mock_load.return_value = sample
        mock_secs.return_value = 15000

        watchdog.check_active_trade_duration()

        mock_post.assert_called()

    @patch('watchdog.post_discord')
    @patch('watchdog.load_agents_db')
    @patch('watchdog.now_et')
    def test_check_sterling_noon_window(self, mock_now, mock_load, mock_post):
        """check_sterling_noon_window should flag FX positions past noon ET."""
        mock_now.return_value = datetime(2026, 3, 13, 12, 30)

        sample = {
            "fx": {
                "active_trades": [
                    {"ticker": "EURUSD", "side": "LONG"}
                ]
            },
            "crypto": {"active_trades": []},
            "futures": {"active_trades": []},
            "boba": {"active_trades": []},
            "spx": {"active_trades": []},
            "orb": {"active_trades": []}
        }
        mock_load.return_value = sample

        watchdog.check_sterling_noon_window()

        mock_post.assert_called()

    @patch('watchdog.post_discord')
    @patch('watchdog.db_query')
    @patch('watchdog.now_et')
    def test_check_overnight_positions(self, mock_now, mock_query, mock_post):
        """check_overnight_positions should flag trades held from previous day."""
        mock_now.return_value = datetime(2026, 3, 13, 8, 0)

        mock_query.return_value = [
            {
                "symbol": "EURUSD",
                "direction": "LONG",
                "strategy": "Trend",
                "hours_held": 18
            }
        ]

        watchdog.check_overnight_positions()

        mock_post.assert_called()

    @patch('watchdog.post_discord')
    @patch('watchdog.db_query')
    @patch('watchdog.is_any_market_open')
    def test_check_signal_pipeline_drought(self, mock_market, mock_query, mock_post):
        """check_signal_pipeline should flag no signals during market hours."""
        mock_market.return_value = True
        mock_query.side_effect = [
            [{"cnt": 0}],
            []
        ]

        watchdog.check_signal_pipeline()

        mock_post.assert_called()

    @patch('watchdog.post_discord')
    @patch('watchdog.load_agents_db')
    def test_check_broker_connectivity(self, mock_load, mock_post):
        """check_broker_connectivity should flag unlinked brokers."""
        sample = {
            "fx": {
                "meta": {
                    "broker": {
                        "platform": "OANDA",
                        "status": "unlinked"
                    }
                }
            },
            "crypto": {"meta": {}},
            "futures": {"meta": {}},
            "boba": {"meta": {}},
            "spx": {"meta": {}},
            "orb": {"meta": {}}
        }
        mock_load.return_value = sample

        watchdog.check_broker_connectivity()

        mock_post.assert_called()

    @patch('watchdog.post_discord')
    @patch('watchdog.write_error_task')
    @patch('watchdog.wake_chief')
    @patch('watchdog.db_query')
    def test_check_consecutive_losses_breach(self, mock_query, mock_wake, mock_error, mock_post):
        """check_consecutive_losses should wake Chief at 3+ losses."""
        mock_query.return_value = [
            {
                "strategy": "ORB",
                "recent_losses": 3
            }
        ]

        watchdog.check_consecutive_losses()

        mock_wake.assert_called()
        mock_error.assert_called()


# ═══════════════════════════════════════════════════════════════════════════
# API INTEGRATION TESTS
# ═══════════════════════════════════════════════════════════════════════════

class TestAPIIntegration:
    """Test API and external communication functions."""

    @patch('urllib.request.urlopen')
    def test_post_discord_success(self, mock_urlopen):
        """post_discord should POST valid JSON to Discord webhook."""
        mock_response = MagicMock()
        mock_response.status = 204
        mock_urlopen.return_value.__enter__.return_value = mock_response

        with patch.object(watchdog, 'DISCORD_WEBHOOK', "https://discord.com/api/webhooks/test/webhook"):
            watchdog.post_discord("Test message", title="Test", level="info")

        mock_urlopen.assert_called()
        call_args = mock_urlopen.call_args
        request = call_args[0][0]

        assert request.get_method() == "POST"
        assert "application/json" in request.headers.get("Content-Type", "")

    @patch('watchdog.post_discord')
    @patch('urllib.request.urlopen')
    def test_wake_chief_success(self, mock_urlopen, mock_post):
        """wake_chief should POST to OpenClaw gateway."""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_urlopen.return_value.__enter__.return_value = mock_response

        with patch.object(watchdog, 'OPENCLAW_GATEWAY', "http://127.0.0.1:3001"):
            with patch.object(watchdog, 'OPENCLAW_TOKEN', "test-token"):
                watchdog.wake_chief("Test reason", "Test context")

        mock_urlopen.assert_called()
        call_args = mock_urlopen.call_args
        request = call_args[0][0]

        assert "/system/event" in request.full_url
        assert "Bearer test-token" in request.headers.get("Authorization", "")

    @patch('watchdog.post_discord')
    @patch('urllib.request.urlopen')
    def test_wake_chief_no_token(self, mock_urlopen, mock_post):
        """wake_chief should post to Discord if token missing."""
        with patch.object(watchdog, 'OPENCLAW_TOKEN', ""):
            watchdog.wake_chief("Test reason", "Test context")

        mock_urlopen.assert_not_called()
        mock_post.assert_called()

    @patch('watchdog.post_discord')
    @patch('urllib.request.urlopen')
    def test_wake_chief_gateway_down(self, mock_urlopen, mock_post):
        """wake_chief should fallback to Discord if gateway unreachable."""
        mock_urlopen.side_effect = Exception("Connection refused")

        with patch.object(watchdog, 'OPENCLAW_GATEWAY', "http://127.0.0.1:3001"):
            with patch.object(watchdog, 'OPENCLAW_TOKEN', "test-token"):
                watchdog.wake_chief("Test reason", "Test context")

        mock_post.assert_called()
        call_kwargs = mock_post.call_args[1]
        assert call_kwargs['level'] == 'critical'


# ═══════════════════════════════════════════════════════════════════════════
# MAIN LOOP TESTS
# ═══════════════════════════════════════════════════════════════════════════

class TestMainLoop:
    """Test the main run_cycle orchestration."""

    @patch('watchdog.check_agent_health')
    @patch('watchdog.check_daily_pnl')
    @patch('watchdog.check_active_trade_count')
    @patch('watchdog.check_services')
    @patch('watchdog.throttle')
    def test_run_cycle_calls_checks(self, mock_throttle, mock_svc, mock_trades, mock_pnl, mock_health):
        """run_cycle should call monitoring checks."""
        mock_throttle.should_fire.return_value = True

        watchdog.run_cycle()

        mock_health.assert_called()
        mock_pnl.assert_called()
        mock_trades.assert_called()
        mock_svc.assert_called()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
