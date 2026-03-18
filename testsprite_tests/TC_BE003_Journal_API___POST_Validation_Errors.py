import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def test_TC_BE003_journal_post_validation_errors():
    url = f"{BASE_URL}/api/journal"
    headers = {
        "Content-Type": "application/json"
    }
    # Invalid trade data with missing required fields and invalid types
    invalid_payloads = [
        {},  # Completely empty payload
        {"trade_date": "invalid-date", "price": "not-a-number"},  # Invalid date and price types
        {"symbol": "", "quantity": -10, "price": -100},  # Invalid values: empty string, negative qty and price
        {"trade_date": "2025-01-01T25:61:00Z", "symbol": "BTCUSD"},  # Invalid datetime format
        {"trade_type": "unknown", "quantity": 10},  # Unsupported trade_type field value and missing fields
    ]

    for payload in invalid_payloads:
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        except requests.RequestException as e:
            assert False, f"Request failed: {e}"
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}, payload={payload}"
        json_resp = None
        try:
            json_resp = response.json()
        except Exception:
            assert False, "Response is not valid JSON"
        # Check response contains proper validation error structure
        assert "error" in json_resp and json_resp["error"] == "Validation failed", f"Expected validation failed error, got {json_resp}"
        assert "details" in json_resp and isinstance(json_resp["details"], dict), f"Expected details dict in response, got {json_resp}"
        details = json_resp["details"]
        assert "fieldErrors" in details and isinstance(details["fieldErrors"], dict), f"Expected fieldErrors dict in details, got {json_resp}"

test_TC_BE003_journal_post_validation_errors()
