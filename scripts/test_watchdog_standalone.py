#!/usr/bin/env python3
"""
Standalone test runner for watchdog.py
Does not require pytest — just standard Python unittest
Run: python3 scripts/test_watchdog_standalone.py
"""

import sys
import json
import sqlite3
import tempfile
import time
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import unittest

# Import watchdog
sys.path.insert(0, str(Path(__file__).parent))
import watchdog


class TestAlertThrottle(unittest.TestCase):
    """Test AlertThrottle class."""

    def test_fires_first_time(self):
        """AlertThrottle should fire on first call."""
        throttle = watchdog.AlertThrottle()
        self.assertTrue(throttle.should_fire("test_key", 60))

    def test_suppresses_within_cooldown(self):
        """AlertThrottle should suppress within cooldown window."""
        throttle = watchdog.AlertThrottle()
        self.assertTrue(throttle.should_fire("test_key", 60))
        self.assertFalse(throttle.should_fire("test_key", 60))
        self.assertFalse(throttle.should_fire("test_key", 60))

    def test_fires_after_cooldown(self):
        """AlertThrottle should fire again after cooldown expires."""
        throttle = watchdog.AlertThrottle()
        cooldown = 1

        self.assertTrue(throttle.should_fire("test_key", cooldown))
        self.assertFalse(throttle.should_fire("test_key", cooldown))

        time.sleep(cooldown + 0.1)

        self.assertTrue(throttle.should_fire("test_key", cooldown))


class TestHelperFunctions(unittest.TestCase):
    """Test helper utility functions."""

    def test_parse_iso_valid(self):
        """parse_iso should handle valid ISO timestamps."""
        iso_str = "2026-03-15T14:30:00"
        result = watchdog.parse_iso(iso_str)
        self.assertIsNotNone(result)
        self.assertEqual(result.year, 2026)

    def test_parse_iso_with_z(self):
        """parse_iso should handle 'Z' timezone indicator."""
        iso_str = "2026-03-15T14:30:00Z"
        result = watchdog.parse_iso(iso_str)
        self.assertIsNotNone(result)

    def test_parse_iso_invalid(self):
        """parse_iso should return None for invalid input."""
        result = watchdog.parse_iso("not-a-date")
        self.assertIsNone(result)

    def test_seconds_since(self):
        """seconds_since should calculate elapsed time."""
        past = (datetime.now() - timedelta(seconds=10)).isoformat()
        elapsed = watchdog.seconds_since(past)
        self.assertTrue(9 < elapsed < 11)

    def test_is_weekday(self):
        """is_weekday should return bool."""
        result = watchdog.is_weekday()
        self.assertIsInstance(result, bool)

    def test_db_query_no_db(self):
        """db_query should return empty list if DB doesn't exist."""
        with patch.object(watchdog, 'DB_PATH', Path("/nonexistent/path/db.db")):
            result = watchdog.db_query("SELECT * FROM trades LIMIT 1")
            self.assertEqual(result, [])

    def test_load_agents_db_no_file(self):
        """load_agents_db should return empty dict if file missing."""
        with patch.object(watchdog, 'AGENTS_DB_PATH', Path("/nonexistent/agents_db.json")):
            result = watchdog.load_agents_db()
            self.assertEqual(result, {})

    def test_load_agents_db_valid(self):
        """load_agents_db should load valid JSON."""
        tmp_path = Path(tempfile.mkdtemp())
        agents_path = tmp_path / "agents_db.json"

        sample_data = {
            "fx": {"status": "ACTIVE"},
            "crypto": {"status": "ACTIVE"}
        }

        with open(agents_path, 'w') as f:
            json.dump(sample_data, f)

        with patch.object(watchdog, 'AGENTS_DB_PATH', agents_path):
            result = watchdog.load_agents_db()
            self.assertEqual(result, sample_data)

        # Cleanup
        import shutil
        shutil.rmtree(str(tmp_path))


class TestTier1Checks(unittest.TestCase):
    """Test Tier 1 critical monitoring checks."""

    @patch('watchdog.post_discord')
    @patch('watchdog.load_agents_db')
    def test_check_agent_health_empty_db(self, mock_load, mock_post):
        """check_agent_health should alert if agents_db missing."""
        mock_load.return_value = {}
        watchdog.check_agent_health()
        mock_post.assert_called()
        call_kwargs = mock_post.call_args[1]
        self.assertEqual(call_kwargs['level'], 'critical')

    @patch('watchdog.seconds_since')
    @patch('watchdog.wake_chief')
    @patch('watchdog.post_discord')
    @patch('watchdog.load_agents_db')
    def test_check_agent_health_halted(self, mock_load, mock_post, mock_wake, mock_secs):
        """check_agent_health should wake Chief if agent HALTED."""
        sample = {
            "fx": {
                "status": "HALTED",
                "last_updated": datetime.now().isoformat()
            }
        }
        mock_load.return_value = sample
        mock_secs.return_value = 30  # Return a valid number for staleness check

        watchdog.check_agent_health()

        mock_wake.assert_called()

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
        self.assertEqual(call_kwargs['level'], 'warn')

    @patch('watchdog.post_discord')
    @patch('urllib.request.urlopen')
    def test_check_services_success(self, mock_urlopen, mock_post):
        """check_services should pass if API responds 200."""
        import urllib.request
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
        self.assertEqual(call_kwargs['level'], 'critical')

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
        self.assertEqual(call_kwargs['level'], 'critical')


class TestTier2Checks(unittest.TestCase):
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
        self.assertEqual(call_kwargs['level'], 'warn')

    @patch('watchdog.post_discord')
    @patch('watchdog.load_agents_db')
    @patch('watchdog.seconds_since')
    def test_check_stale_pending_orders(self, mock_secs, mock_load, mock_post):
        """check_stale_pending_orders should flag old orders."""
        sample = {
            "fx": {
                "pending_orders": [
                    {"ticker": "EURUSD", "created_at": "2026-03-15T10:00:00"}
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
    @patch('watchdog.now_et')
    def test_check_sterling_noon_window(self, mock_now, mock_load, mock_post):
        """check_sterling_noon_window should flag FX positions past noon."""
        mock_now.return_value = datetime(2026, 3, 13, 12, 30)

        sample = {
            "fx": {"active_trades": [{"ticker": "EURUSD", "side": "LONG"}]},
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
    @patch('watchdog.load_agents_db')
    def test_check_broker_connectivity(self, mock_load, mock_post):
        """check_broker_connectivity should flag unlinked brokers."""
        sample = {
            "fx": {"meta": {"broker": {"platform": "OANDA", "status": "unlinked"}}},
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
        mock_query.return_value = [{"strategy": "ORB", "recent_losses": 3}]

        watchdog.check_consecutive_losses()

        mock_wake.assert_called()
        mock_error.assert_called()


class TestAPIIntegration(unittest.TestCase):
    """Test API and external communication functions."""

    @patch('urllib.request.urlopen')
    def test_post_discord_success(self, mock_urlopen):
        """post_discord should POST valid JSON to Discord."""
        import urllib.request
        mock_response = MagicMock()
        mock_response.status = 204
        mock_urlopen.return_value.__enter__.return_value = mock_response

        with patch.object(watchdog, 'DISCORD_WEBHOOK', "https://discord.com/api/webhooks/test/webhook"):
            watchdog.post_discord("Test message", title="Test", level="info")

        mock_urlopen.assert_called()

    @patch('watchdog.post_discord')
    @patch('urllib.request.urlopen')
    def test_wake_chief_success(self, mock_urlopen, mock_post):
        """wake_chief should POST to OpenClaw gateway."""
        import urllib.request
        mock_response = MagicMock()
        mock_response.status = 200
        mock_urlopen.return_value.__enter__.return_value = mock_response

        with patch.object(watchdog, 'OPENCLAW_GATEWAY', "http://127.0.0.1:3001"):
            with patch.object(watchdog, 'OPENCLAW_TOKEN', "test-token"):
                watchdog.wake_chief("Test reason", "Test context")

        mock_urlopen.assert_called()
        call_args = mock_urlopen.call_args
        request = call_args[0][0]
        self.assertIn("/system/event", request.full_url)
        self.assertIn("Bearer test-token", request.headers.get("Authorization", ""))

    @patch('watchdog.post_discord')
    @patch('urllib.request.urlopen')
    def test_wake_chief_no_token(self, mock_urlopen, mock_post):
        """wake_chief should post to Discord if token missing."""
        with patch.object(watchdog, 'OPENCLAW_TOKEN', ""):
            watchdog.wake_chief("Test reason", "Test context")

        mock_urlopen.assert_not_called()
        mock_post.assert_called()


class TestMainLoop(unittest.TestCase):
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


def run_tests():
    """Run all tests."""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    suite.addTests(loader.loadTestsFromTestCase(TestAlertThrottle))
    suite.addTests(loader.loadTestsFromTestCase(TestHelperFunctions))
    suite.addTests(loader.loadTestsFromTestCase(TestTier1Checks))
    suite.addTests(loader.loadTestsFromTestCase(TestTier2Checks))
    suite.addTests(loader.loadTestsFromTestCase(TestAPIIntegration))
    suite.addTests(loader.loadTestsFromTestCase(TestMainLoop))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print(f"\n{'=' * 70}")
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Skipped: {len(result.skipped)}")
    print(f"{'=' * 70}")

    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(run_tests())
