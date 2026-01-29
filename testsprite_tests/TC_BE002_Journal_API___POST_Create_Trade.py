import requests
import uuid

BASE_URL = "http://localhost:3000"
JOURNAL_ENDPOINT = f"{BASE_URL}/api/journal"
HEADERS = {
    "Content-Type": "application/json",
    # Add authentication headers here if required, e.g.:
    # "Authorization": "Bearer <token>"
}
TIMEOUT = 30

def test_post_create_trade():
    trade_data = {
        "symbol": "BTCUSD",
        "entry_date": "2025-12-29T15:00:00Z",
        "direction": "LONG",
        "entry_price": 50000.0,
        "notes": "Test trade creation from API",
        "strategy": "ORB",
        "size": 1.5
    }

    created_trade_id = None
    try:
        # Send POST request to create new trade
        resp = requests.post(JOURNAL_ENDPOINT, json=trade_data, headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Unexpected status code: {resp.status_code}"
        resp_json = resp.json()
        # Validate that an ID is returned and consistent with trade data
        assert isinstance(resp_json, dict), "Response is not a JSON object"
        assert "id" in resp_json, "Response JSON missing 'id'"
        created_trade_id = resp_json["id"]
        assert isinstance(created_trade_id, (str, int)), "'id' is not string or int"
        # Check returned fields match input data where applicable
        for key in trade_data:
            # exit_date and exit_price might be None and could be omitted or null in response
            if trade_data[key] is not None:
                assert key in resp_json, f"Response missing field '{key}'"
                # For floats, tolerate slight differences by converting to string fixed precision
                if isinstance(trade_data[key], float):
                    assert abs(resp_json[key] - trade_data[key]) < 1e-6, f"Mismatch for field '{key}'"
                else:
                    assert resp_json[key] == trade_data[key], f"Mismatch for field '{key}'"

    finally:
        # Clean up - delete the created trade if created_trade_id is present
        if created_trade_id is not None:
            try:
                delete_resp = requests.delete(f"{JOURNAL_ENDPOINT}/{created_trade_id}", headers=HEADERS, timeout=TIMEOUT)
                # It's ok if delete fails, but we can assert if you prefer
                assert delete_resp.status_code in (200, 204, 404), f"Unexpected delete status code: {delete_resp.status_code}"
            except Exception:
                pass

test_post_create_trade()
