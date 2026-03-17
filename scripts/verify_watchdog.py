#!/usr/bin/env python3
"""
Watchdog Verification Script
Validates all prerequisites and configuration before running the main watchdog daemon.
Does NOT start the main loop — only validates config.
"""

import json
import sqlite3
import os
import sys
from pathlib import Path
from datetime import datetime
import urllib.request
import urllib.error

# ═══════════════════════════════════════════════════════════════════════════
# CONFIG LOADING
# ═══════════════════════════════════════════════════════════════════════════

APP_DIR = Path(os.environ.get("APP_DIR", "/home/jackw/SwjshAlgoKnife"))
DB_PATH = Path(os.environ.get("DATABASE_PATH", str(APP_DIR / "journal.db")))
AGENTS_DB_PATH = Path(os.environ.get("AGENTS_DB_PATH", str(APP_DIR / "data" / "agents_db.json")))
DATA_DIR = Path(os.environ.get("DATA_DIR", str(APP_DIR / "data")))
PIPELINE_DIR = Path(os.environ.get("PIPELINE_DIR", os.path.expanduser("~/.openclaw/pipeline")))

OPENCLAW_GATEWAY = os.environ.get("OPENCLAW_GATEWAY", "http://127.0.0.1:3001")
OPENCLAW_TOKEN = os.environ.get("OPENCLAW_GATEWAY_TOKEN", "")
DISCORD_WEBHOOK = os.environ.get("DISCORD_CHIEF_WEBHOOK", "")

ACCOUNT_BALANCE = os.environ.get("ACCOUNT_BALANCE", "10000")

# ═══════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def print_header(text: str):
    """Print section header."""
    print(f"\n{'=' * 70}")
    print(f"  {text}")
    print(f"{'=' * 70}")


def print_check(label: str, passed: bool, details: str = ""):
    """Print a single check result."""
    status = "✓ PASS" if passed else "✗ FAIL"
    result = f"  [{status}] {label}"
    if details:
        result += f" — {details}"
    print(result)
    return passed


def print_info(text: str):
    """Print informational line."""
    print(f"  {text}")


def print_error(text: str):
    """Print error line."""
    print(f"  ✗ ERROR: {text}")


# ═══════════════════════════════════════════════════════════════════════════
# VERIFICATION CHECKS
# ═══════════════════════════════════════════════════════════════════════════

def check_environment_variables() -> dict:
    """Verify all required environment variables are set or have defaults."""
    print_header("ENVIRONMENT VARIABLES")

    checks = {}

    # Critical vars with defaults
    checks['app_dir'] = print_check(
        "APP_DIR",
        True,
        f"Set to {APP_DIR}"
    )

    checks['db_path'] = print_check(
        "DATABASE_PATH",
        True,
        f"Set to {DB_PATH}"
    )

    checks['agents_db_path'] = print_check(
        "AGENTS_DB_PATH",
        True,
        f"Set to {AGENTS_DB_PATH}"
    )

    checks['account_balance'] = print_check(
        "ACCOUNT_BALANCE",
        True,
        f"${ACCOUNT_BALANCE}"
    )

    # OpenClaw config
    has_gateway = bool(OPENCLAW_GATEWAY)
    checks['openclaw_gateway'] = print_check(
        "OPENCLAW_GATEWAY",
        has_gateway,
        OPENCLAW_GATEWAY if has_gateway else "NOT SET — Chief wake-up will be disabled"
    )

    has_token = bool(OPENCLAW_TOKEN)
    checks['openclaw_token'] = print_check(
        "OPENCLAW_GATEWAY_TOKEN",
        has_token,
        "✓ Token set" if has_token else "NOT SET — Chief wake-up will be disabled"
    )

    # Discord webhook
    has_webhook = bool(DISCORD_WEBHOOK)
    checks['discord_webhook'] = print_check(
        "DISCORD_CHIEF_WEBHOOK",
        has_webhook,
        "✓ Webhook URL set" if has_webhook else "NOT SET — Discord alerts will be disabled"
    )

    return checks


def check_database_exists() -> bool:
    """Verify journal.db exists and is readable."""
    print_header("DATABASE (journal.db)")

    exists = DB_PATH.exists()
    print_check("Database file exists", exists, str(DB_PATH))

    if not exists:
        print_error(f"Database not found at {DB_PATH}")
        print_info("Watchdog can continue but monitoring will have no trade data.")
        return False

    # Try to read it
    try:
        conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, timeout=2)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1")
        tables = cursor.fetchall()
        conn.close()

        if tables:
            print_check("Database is readable", True, f"{len(tables)} tables found")
            return True
        else:
            print_error("Database exists but contains no tables")
            return False
    except Exception as e:
        print_error(f"Cannot read database: {e}")
        return False


def check_agents_db_exists() -> bool:
    """Verify agents_db.json exists and contains valid JSON."""
    print_header("AGENTS DATABASE (agents_db.json)")

    exists = AGENTS_DB_PATH.exists()
    print_check("agents_db.json exists", exists, str(AGENTS_DB_PATH))

    if not exists:
        print_error(f"agents_db.json not found at {AGENTS_DB_PATH}")
        print_info("Watchdog REQUIRES this file to monitor agent health.")
        return False

    # Try to parse JSON
    try:
        with open(AGENTS_DB_PATH) as f:
            data = json.load(f)

        print_check("agents_db.json is valid JSON", True, f"{len(data)} keys")

        # Verify expected agent keys
        expected_agents = ["fx", "crypto", "futures", "boba", "spx", "orb"]
        found = [k for k in expected_agents if k in data]
        missing = [k for k in expected_agents if k not in data]

        if found:
            print_check(
                "Agent keys present",
                len(found) > 0,
                f"Found: {', '.join(found)}"
            )

        if missing:
            print_info(f"⚠ Missing agents: {', '.join(missing)} (OK if not yet started)")

        return True
    except json.JSONDecodeError as e:
        print_error(f"agents_db.json is not valid JSON: {e}")
        return False
    except Exception as e:
        print_error(f"Cannot read agents_db.json: {e}")
        return False


def check_openclaw_gateway() -> bool:
    """Verify OpenClaw gateway is reachable."""
    print_header("OPENCLAW GATEWAY")

    if not OPENCLAW_GATEWAY:
        print_info("OPENCLAW_GATEWAY not set — skipping connectivity check")
        return False

    if not OPENCLAW_TOKEN:
        print_error("OPENCLAW_GATEWAY_TOKEN not set — gateway will not be used")
        return False

    # Try to reach gateway
    try:
        req = urllib.request.Request(
            f"{OPENCLAW_GATEWAY}/health",
            method="GET",
            headers={"Authorization": f"Bearer {OPENCLAW_TOKEN}"}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            status = resp.status
            if status in [200, 204]:
                print_check("OpenClaw gateway reachable", True, f"HTTP {status}")
                return True
            else:
                print_error(f"Gateway returned unexpected status: {status}")
                return False
    except urllib.error.URLError as e:
        print_error(f"Gateway unreachable: {e.reason}")
        print_info("This is OK if gateway is not yet running. Watchdog will queue errors for later.")
        return False
    except Exception as e:
        print_error(f"Error connecting to gateway: {e}")
        return False


def check_discord_webhook() -> bool:
    """Verify Discord webhook is configured and valid format."""
    print_header("DISCORD WEBHOOK")

    if not DISCORD_WEBHOOK:
        print_info("DISCORD_CHIEF_WEBHOOK not set — Discord alerts will be disabled")
        return False

    # Validate URL format
    if not DISCORD_WEBHOOK.startswith("https://discord.com/api/webhooks/"):
        print_error(f"Discord webhook has invalid format: {DISCORD_WEBHOOK[:50]}...")
        return False

    print_check("Discord webhook URL format valid", True, f"{DISCORD_WEBHOOK[:60]}...")

    # Try to validate with a test POST (without actually sending message)
    try:
        # Don't actually send — just validate endpoint is reachable
        req = urllib.request.Request(
            DISCORD_WEBHOOK,
            method="GET",
            headers={"User-Agent": "Watchdog"}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                print_check("Discord webhook reachable", True)
                return True
    except urllib.error.HTTPError as e:
        if e.code == 405:  # Method Not Allowed for GET, but endpoint exists
            print_check("Discord webhook reachable", True, "(GET not allowed but endpoint exists)")
            return True
        else:
            print_error(f"Discord webhook error: HTTP {e.code}")
            return False
    except Exception as e:
        print_error(f"Cannot reach Discord webhook: {e}")
        print_info("This may be OK if Discord is blocked by firewall. Errors will queue.")
        return False


def check_pipeline_directories() -> bool:
    """Verify OpenClaw pipeline directories exist or can be created."""
    print_header("PIPELINE DIRECTORIES")

    if not PIPELINE_DIR.exists():
        print_info(f"Pipeline directory does not exist: {PIPELINE_DIR}")
        print_info("Watchdog will attempt to create it on startup.")
        return False

    required_dirs = ["inbox/pending", "inbox/active", "inbox/completed", "outbox/reports", "outbox/errors"]
    all_exist = True

    for subdir in required_dirs:
        full_path = PIPELINE_DIR / subdir
        exists = full_path.exists()
        print_check(f"Pipeline/{subdir}", exists, str(full_path))
        if not exists:
            all_exist = False

    return all_exist


def check_data_directories() -> bool:
    """Verify data directory structure."""
    print_header("DATA DIRECTORIES")

    exists = DATA_DIR.exists()
    print_check("DATA_DIR exists", exists, str(DATA_DIR))

    if not exists:
        print_error(f"Data directory missing: {DATA_DIR}")
        return False

    # Check for brain directory
    brain_dir = DATA_DIR / "brain"
    has_brain = brain_dir.exists()
    print_check("Brain directory exists", has_brain, str(brain_dir))

    if not has_brain:
        print_info("Brain directory missing — self-healing logs will not be available")
        return False

    return True


def check_watchdog_imports() -> bool:
    """Verify watchdog.py can import all dependencies."""
    print_header("PYTHON DEPENDENCIES")

    required = ["json", "sqlite3", "os", "time", "urllib", "logging", "pathlib"]
    all_ok = True

    for module in required:
        try:
            __import__(module)
            print_check(f"Import {module}", True)
        except ImportError:
            print_error(f"Cannot import {module}")
            all_ok = False

    return all_ok


# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════

def main():
    """Run all verification checks."""
    print("\n")
    print("╔" + "═" * 68 + "╗")
    print("║" + " " * 68 + "║")
    print("║" + "  SwjshAK Watchdog — Pre-Flight Configuration Check".center(68) + "║")
    print("║" + " " * 68 + "║")
    print("╚" + "═" * 68 + "╝")

    results = {}

    # Run all checks
    results['env_vars'] = all(check_environment_variables().values())
    results['database'] = check_database_exists()
    results['agents_db'] = check_agents_db_exists()
    results['openclaw'] = check_openclaw_gateway()
    results['discord'] = check_discord_webhook()
    results['pipeline'] = check_pipeline_directories()
    results['data_dirs'] = check_data_directories()
    results['imports'] = check_watchdog_imports()

    # Summary
    print_header("SUMMARY")

    total = len(results)
    passed = sum(1 for v in results.values() if v)
    failed = total - passed

    print(f"\n  Total Checks: {total}")
    print(f"  Passed: {passed}")
    print(f"  Failed: {failed}\n")

    # Details
    status_lines = []
    for check, result in results.items():
        status = "✓" if result else "✗"
        label = check.replace('_', ' ').title()
        status_lines.append(f"  {status} {label}")

    for line in status_lines:
        print(line)

    # Overall status
    print_header("STATUS")

    if failed == 0:
        print("  ✓ READY — All checks passed. Watchdog can start.")
        print("  Run: python3 /scripts/watchdog.py")
        return 0
    elif failed <= 3:
        print("  ⚠ WARNING — Some non-critical checks failed.")
        print("  Watchdog will start but some features may be limited:")
        if not results['openclaw']:
            print("    - Chief wake-up disabled (set OPENCLAW_GATEWAY_TOKEN)")
        if not results['discord']:
            print("    - Discord alerts disabled (set DISCORD_CHIEF_WEBHOOK)")
        if not results['pipeline']:
            print("    - Pipeline directories will be created on startup")
        print("  Run: python3 /scripts/watchdog.py")
        return 0
    else:
        print("  ✗ CRITICAL — Essential checks failed. Watchdog cannot start safely.")
        print("  Fix these issues before running watchdog:")
        for check, result in results.items():
            if not result and check in ['database', 'agents_db']:
                print(f"    - {check.replace('_', ' ').title()}")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
