import requests
import uuid
import time

BASE_URL = "http://localhost:3000"
WEBHOOK_URL = f"{BASE_URL}/api/webhook/tradingview"
SIGNALS_URL = f"{BASE_URL}/api/signals"
JOURNAL_URL = f"{BASE_URL}/api/journal"

WEBHOOK_SECRET = "test_secret"

def test_TC_BE005_tradingview_webhook_post_valid_signal():
    webhook_payload = {
        "symbol": "BTCUSD",
        "action": "buy",
        "price": 30000,
        "strategy": "Test Strategy",
        "notes": "Long entry signal"
    }

    headers = {
        "Content-Type": "application/json",
        "X-Secret": WEBHOOK_SECRET
    }

    try:
        response = requests.post(WEBHOOK_URL, json=webhook_payload, headers=headers, timeout=30)
        assert response.status_code == 200 or response.status_code == 201, \
            f"Expected 200 or 201 response but got {response.status_code}, body: {response.text}"
        json_resp = response.json()
        assert "id" in json_resp or "message" in json_resp, "Response missing expected fields"

        signals_response = requests.get(SIGNALS_URL, timeout=30)
        assert signals_response.status_code == 200, \
            f"Failed to get signals, status {signals_response.status_code}"

        signals = signals_response.json()
        assert isinstance(signals, list), "Signals response is not a list"

        matched = False
        for signal in signals:
            if (
                signal.get("symbol") == webhook_payload["symbol"] and
                signal.get("action") == webhook_payload["action"].upper()
            ):
                matched = True
                break
        assert matched, "Posted signal not found in latest signals"

    except requests.exceptions.RequestException as e:
        assert False, f"HTTP request failed with exception: {e}"
    except ValueError as e:
        assert False, f"Response JSON decoding failed: {e}"


test_TC_BE005_tradingview_webhook_post_valid_signal()
