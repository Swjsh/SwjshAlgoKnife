#!/usr/bin/env python3
"""
Alpaca Paper Trading Connection Test
=====================================
Safe, read-only test to verify Alpaca paper trading connectivity.
Does NOT place any orders.

Usage:
    python scripts/test_alpaca_paper_connection.py
"""

import os
import sys
import requests

def main():
    # Load environment variables
    try:
        from dotenv import load_dotenv
        load_dotenv('.env.local', override=True)
    except ImportError:
        print("Warning: python-dotenv not installed, using system env vars")

    # Get credentials
    api_key = os.getenv('APCA_API_KEY_ID')
    api_secret = os.getenv('APCA_API_SECRET_KEY')
    base_url = os.getenv('APCA_API_BASE_URL', 'https://paper-api.alpaca.markets')
    use_direct = os.getenv('USE_DIRECT_ALPACA', 'false').lower() == 'true'

    print()
    print("=" * 60)
    print("ALPACA PAPER TRADING CONNECTION TEST")
    print("=" * 60)

    # Check configuration
    print()
    print("[1] CONFIGURATION CHECK")
    print("-" * 40)

    if not api_key:
        print("  ERROR: APCA_API_KEY_ID not set!")
        return 1
    print(f"  API Key: {api_key[:10]}...")

    if not api_secret:
        print("  ERROR: APCA_API_SECRET_KEY not set!")
        return 1
    print(f"  API Secret: {api_secret[:10]}...")

    print(f"  Base URL: {base_url}")
    print(f"  USE_DIRECT_ALPACA: {use_direct}")

    is_paper = 'paper' in base_url.lower()
    print(f"  Mode: {'PAPER' if is_paper else 'LIVE (!)'}")

    if not is_paper:
        print("\n  WARNING: Not using paper API! Aborting for safety.")
        return 1

    # Test API connection
    print()
    print("[2] API CONNECTION TEST")
    print("-" * 40)

    headers = {
        'APCA-API-KEY-ID': api_key,
        'APCA-API-SECRET-KEY': api_secret,
    }

    try:
        resp = requests.get(f'{base_url}/v2/account', headers=headers, timeout=10)

        if resp.status_code != 200:
            print(f"  ERROR: API returned {resp.status_code}")
            print(f"  Response: {resp.text[:200]}")
            return 1

        data = resp.json()

        print(f"  Status Code: {resp.status_code} OK")
        print(f"  Account Status: {data.get('status')}")
        print(f"  Account Number: {data.get('account_number')}")

    except requests.exceptions.RequestException as e:
        print(f"  ERROR: Connection failed - {e}")
        return 1

    # Account details
    print()
    print("[3] ACCOUNT DETAILS")
    print("-" * 40)

    cash = float(data.get('cash', 0))
    buying_power = float(data.get('buying_power', 0))
    portfolio_value = float(data.get('portfolio_value', 0))

    print(f"  Cash: ${cash:,.2f}")
    print(f"  Buying Power: ${buying_power:,.2f}")
    print(f"  Portfolio Value: ${portfolio_value:,.2f}")

    # Check positions
    print()
    print("[4] OPEN POSITIONS")
    print("-" * 40)

    try:
        resp = requests.get(f'{base_url}/v2/positions', headers=headers, timeout=10)
        positions = resp.json() if resp.status_code == 200 else []

        if positions:
            print(f"  Found {len(positions)} position(s):")
            for pos in positions:
                symbol = pos.get('symbol')
                qty = float(pos.get('qty', 0))
                unrealized_pl = float(pos.get('unrealized_pl', 0))
                print(f"    - {symbol}: {qty:.4f} (P&L: ${unrealized_pl:,.2f})")
        else:
            print("  No open positions")

    except Exception as e:
        print(f"  Warning: Could not fetch positions - {e}")

    # Summary
    print()
    print("=" * 60)
    print("CONNECTION TEST: PASSED")
    print("=" * 60)
    print()
    print("SPX Sniper is READY for paper trading!")
    print("  - Alpaca API connected")
    print("  - Paper account confirmed")
    print(f"  - Available buying power: ${buying_power:,.2f}")
    print()

    return 0

if __name__ == "__main__":
    sys.exit(main())
