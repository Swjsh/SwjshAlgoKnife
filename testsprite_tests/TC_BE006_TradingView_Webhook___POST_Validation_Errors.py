import requests

BASE_URL = "http://localhost:3000"
WEBHOOK_ENDPOINT = "/api/webhook/tradingview"
TIMEOUT = 30

def test_tradingview_webhook_post_validation_errors():
    url = BASE_URL + WEBHOOK_ENDPOINT
    headers = {
        "Content-Type": "application/json"
    }
    # Create invalid payloads to test validation errors
    invalid_payloads = [
        {},  # empty payload
        {"invalidField": "invalidValue"},  # unrelated fields
        {"type": 123, "symbol": None, "price": "not_a_number"},  # wrong types
        {"type": "", "symbol": "", "price": -1},  # invalid values
    ]

    for payload in invalid_payloads:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        assert response.status_code == 400, f"Expected 400 for payload {payload}, got {response.status_code}"
        # Optional: check if response contains indication of validation errors
        json_response = response.json()
        assert isinstance(json_response, dict), "Response should be a JSON object"
        assert "error" in json_response or "errors" in json_response, "Response should contain error details"

test_tradingview_webhook_post_validation_errors()