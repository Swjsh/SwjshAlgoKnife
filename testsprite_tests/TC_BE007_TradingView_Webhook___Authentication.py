import requests

BASE_URL = "http://localhost:3000"
WEBHOOK_ENDPOINT = f"{BASE_URL}/api/webhook/tradingview"
TIMEOUT = 30

# Minimal valid TradingView webhook payload for testing purposes
valid_payload = {
    "version": "1.0",
    "strategy": {
        "order_action": "buy", 
        "order_contracts": 1
    },
    "ticker": "BTCUSD",
    "time": "2025-12-30T12:34:56Z"
}

def test_tradingview_webhook_authentication():
    # Case 1: No X-Webhook-Secret header (should be 400 Bad Request)
    try:
        response = requests.post(
            WEBHOOK_ENDPOINT,
            json=valid_payload,
            timeout=TIMEOUT
        )
        # Expect 400 status code for missing secret header
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    except requests.RequestException as e:
        assert False, f"Request failed unexpectedly: {e}"

    # Case 2: Invalid X-Webhook-Secret header (should be 400 Bad Request)
    headers = {
        "X-Webhook-Secret": "InvalidSecret123"
    }
    try:
        response = requests.post(
            WEBHOOK_ENDPOINT,
            headers=headers,
            json=valid_payload,
            timeout=TIMEOUT
        )
        # Expect 400 status code for invalid secret
        assert response.status_code == 400, f"Expected 400 for invalid secret, got {response.status_code}"
    except requests.RequestException as e:
        assert False, f"Request failed unexpectedly: {e}"

# Run the test function
test_tradingview_webhook_authentication()
