#!/usr/bin/env python3
"""
SwjshAK Preflight Check — Paper Trading Readiness
===================================================
Run this BEFORE starting any agents to verify everything is connected.

Usage: python scripts/preflight_check.py

Checks:
  1. Python dependencies installed
  2. Environment variables set
  3. OANDA practice account accessible
  4. Alpaca paper account accessible
  5. yfinance data feed working
  6. Webhook endpoint reachable (localhost:3000)
  7. Agent engines importable
  8. Database writable
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime

PASS = "PASS"
FAIL = "FAIL"
WARN = "WARN"
SKIP = "SKIP"

results = []


def check(name, status, detail=""):
    icon = {"PASS": "✅", "FAIL": "❌", "WARN": "⚠️", "SKIP": "⏭️"}[status]
    results.append({"name": name, "status": status, "detail": detail})
    print(f"  {icon} {name}: {detail}" if detail else f"  {icon} {name}")


def main():
    print(f"\n{'═' * 60}")
    print(f"  SwjshAK Preflight Check — Paper Trading Readiness")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'═' * 60}\n")

    # ── 1. Python Dependencies ──
    print("  [1/8] Python Dependencies")
    deps = {"yfinance": "yfinance", "pandas": "pandas", "requests": "requests", "pytz": "pytz"}
    for name, module in deps.items():
        try:
            __import__(module)
            check(f"  {name}", PASS)
        except ImportError:
            check(f"  {name}", FAIL, f"pip install {name} --break-system-packages")

    # ── 2. Environment Variables ──
    print("\n  [2/8] Environment Variables")
    env_checks = {
        "OANDA_API_TOKEN": "OANDA broker connection",
        "OANDA_ACCOUNT_ID": "OANDA account ID",
        "APCA_API_KEY_ID": "Alpaca API key",
        "APCA_API_SECRET_KEY": "Alpaca API secret",
        "WEBHOOK_SECRET": "Webhook authentication",
    }

    # Try loading .env.local
    env_path = Path(os.getcwd()) / ".env.local"
    env_vars = {}
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    key, val = line.split("=", 1)
                    env_vars[key.strip()] = val.strip().strip('"').strip("'")
        check("  .env.local found", PASS)
    else:
        check("  .env.local", WARN, "File not found — using system env vars only")

    for var, purpose in env_checks.items():
        val = os.environ.get(var) or env_vars.get(var)
        if val and len(val) > 3:
            masked = val[:4] + "..." + val[-4:] if len(val) > 10 else "***"
            check(f"  {var}", PASS, f"Set ({masked}) — {purpose}")
        else:
            check(f"  {var}", FAIL, f"Missing — needed for {purpose}")

    optional_vars = {
        "DISCORD_CHIEF_WEBHOOK": "Discord alerts (chief)",
        "DISCORD_FOREX_WEBHOOK": "Discord alerts (forex)",
        "DISCORD_CRYPTO_WEBHOOK": "Discord alerts (crypto)",
        "NEXT_PUBLIC_FINNHUB_KEY": "Real-time FX quotes",
    }
    for var, purpose in optional_vars.items():
        val = os.environ.get(var) or env_vars.get(var)
        if val and len(val) > 3:
            check(f"  {var}", PASS, f"(optional) {purpose}")
        else:
            check(f"  {var}", WARN, f"Not set — {purpose} (optional)")

    # ── 3. OANDA Connection ──
    print("\n  [3/8] OANDA Practice Account")
    oanda_token = os.environ.get("OANDA_API_TOKEN") or env_vars.get("OANDA_API_TOKEN")
    oanda_account = os.environ.get("OANDA_ACCOUNT_ID") or env_vars.get("OANDA_ACCOUNT_ID")
    oanda_env = os.environ.get("OANDA_ENVIRONMENT") or env_vars.get("OANDA_ENVIRONMENT", "practice")

    if oanda_token and oanda_account:
        try:
            import requests
            base = "https://api-fxpractice.oanda.com" if oanda_env == "practice" else "https://api-fxtrade.oanda.com"
            resp = requests.get(
                f"{base}/v3/accounts/{oanda_account}/summary",
                headers={"Authorization": f"Bearer {oanda_token}"},
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                bal = data.get("account", {}).get("balance", "?")
                check("  Connection", PASS, f"Balance: {bal} ({oanda_env})")
            else:
                check("  Connection", FAIL, f"HTTP {resp.status_code}: {resp.text[:100]}")
        except Exception as e:
            check("  Connection", FAIL, str(e)[:80])
    else:
        check("  Connection", SKIP, "OANDA credentials not set")

    # ── 4. Alpaca Paper Account ──
    print("\n  [4/8] Alpaca Paper Account")
    alpaca_key = os.environ.get("APCA_API_KEY_ID") or env_vars.get("APCA_API_KEY_ID")
    alpaca_secret = os.environ.get("APCA_API_SECRET_KEY") or env_vars.get("APCA_API_SECRET_KEY")
    alpaca_base = os.environ.get("APCA_API_BASE_URL") or env_vars.get("APCA_API_BASE_URL", "https://paper-api.alpaca.markets")

    if alpaca_key and alpaca_secret:
        try:
            import requests
            resp = requests.get(
                f"{alpaca_base}/v2/account",
                headers={
                    "APCA-API-KEY-ID": alpaca_key,
                    "APCA-API-SECRET-KEY": alpaca_secret,
                },
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                equity = data.get("equity", "?")
                status = data.get("status", "?")
                check("  Connection", PASS, f"Equity: ${equity} | Status: {status}")
            else:
                check("  Connection", FAIL, f"HTTP {resp.status_code}: {resp.text[:100]}")
        except Exception as e:
            check("  Connection", FAIL, str(e)[:80])
    else:
        check("  Connection", SKIP, "Alpaca credentials not set")

    # ── 5. yfinance Data Feed ──
    print("\n  [5/8] yfinance Market Data")
    try:
        import yfinance as yf
        ticker = yf.Ticker("SPY")
        hist = ticker.history(period="5d")
        if not hist.empty:
            last_close = hist["Close"].iloc[-1]
            last_date = str(hist.index[-1].date())
            check("  SPY data", PASS, f"Last close: ${last_close:.2f} ({last_date})")
        else:
            check("  SPY data", FAIL, "Empty response from yfinance")

        # Test futures
        fut = yf.Ticker("ES=F")
        fut_hist = fut.history(period="5d")
        if not fut_hist.empty:
            check("  ES=F futures data", PASS, f"Last: ${fut_hist['Close'].iloc[-1]:.2f}")
        else:
            check("  ES=F futures data", WARN, "No data — futures may require market hours")

        # Test crypto
        btc = yf.Ticker("BTC-USD")
        btc_hist = btc.history(period="5d")
        if not btc_hist.empty:
            check("  BTC-USD crypto data", PASS, f"Last: ${btc_hist['Close'].iloc[-1]:,.2f}")
        else:
            check("  BTC-USD crypto data", WARN, "No data")

    except ImportError:
        check("  yfinance", FAIL, "pip install yfinance --break-system-packages")
    except Exception as e:
        check("  yfinance", FAIL, str(e)[:80])

    # ── 6. Webhook Endpoint ──
    print("\n  [6/8] Local Webhook Endpoint")
    try:
        import requests
        resp = requests.get("http://localhost:3000/api/health", timeout=5)
        if resp.status_code == 200:
            check("  localhost:3000/api/health", PASS, "Next.js server running")
        else:
            check("  localhost:3000/api/health", WARN, f"HTTP {resp.status_code}")
    except Exception:
        check("  localhost:3000/api/health", WARN, "Not reachable — start with: npm run dev")

    # ── 7. Agent Engines ──
    print("\n  [7/8] Agent Engine Files")
    engines = {
        "pivot_pete_engine.py": "Pivot Pete (ES Futures)",
        "boba_trades_engine.py": "Boba (SPY Options)",
        "spx_sniper_engine.py": "SPX Sniper (0DTE Options)",
        "bitcoin_bob_engine.py": "Bitcoin Bob (Crypto)",
        "sterling_fx_engine.py": "Sterling (Forex)",
        "the_professor.py": "The Professor (Grader)",
        "agent_runner.ts": "Agent Orchestrator (TS)",
    }
    scripts_dir = Path(os.getcwd()) / "scripts"
    for filename, description in engines.items():
        filepath = scripts_dir / filename
        if filepath.exists():
            size_kb = filepath.stat().st_size / 1024
            check(f"  {filename}", PASS, f"{description} ({size_kb:.0f}KB)")
        else:
            check(f"  {filename}", FAIL, f"{description} — file missing!")

    # ── 8. Data Directory ──
    print("\n  [8/8] Data & State Files")
    data_dir = Path(os.getcwd()) / "data"
    if data_dir.exists():
        check("  data/ directory", PASS)
    else:
        check("  data/ directory", WARN, "Creating...")
        data_dir.mkdir(parents=True, exist_ok=True)

    agents_db = data_dir / "agents_db.json"
    if agents_db.exists():
        try:
            with open(agents_db) as f:
                db = json.load(f)
            agents = list(db.keys()) if isinstance(db, dict) else []
            check("  agents_db.json", PASS, f"{len(agents)} agents tracked")
        except Exception as e:
            check("  agents_db.json", WARN, f"Parse error: {e}")
    else:
        check("  agents_db.json", WARN, "Will be created on first agent run")

    backtests_dir = data_dir / "backtests"
    backtests_dir.mkdir(parents=True, exist_ok=True)
    check("  data/backtests/ directory", PASS)

    # ── Summary ──
    print(f"\n{'═' * 60}")
    passes = sum(1 for r in results if r["status"] == PASS)
    fails = sum(1 for r in results if r["status"] == FAIL)
    warns = sum(1 for r in results if r["status"] == WARN)

    print(f"  SUMMARY: {passes} passed, {fails} failed, {warns} warnings")

    if fails == 0:
        print(f"  STATUS: READY FOR PAPER TRADING ✅")
    elif fails <= 3:
        print(f"  STATUS: PARTIALLY READY — fix {fails} issue(s) above ⚠️")
    else:
        print(f"  STATUS: NOT READY — {fails} critical issues ❌")

    print(f"{'═' * 60}\n")

    # Save results
    report_path = data_dir / "preflight_report.json"
    with open(report_path, "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "summary": {"pass": passes, "fail": fails, "warn": warns},
            "checks": results,
        }, f, indent=2)
    print(f"  Report saved: {report_path}\n")

    sys.exit(1 if fails > 0 else 0)


if __name__ == "__main__":
    main()
