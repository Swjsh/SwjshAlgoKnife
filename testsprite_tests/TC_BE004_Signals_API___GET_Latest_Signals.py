import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def test_signals_api_get_latest_signals():
    url = f"{BASE_URL}/api/signals"
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        # Basic status code check
        assert response.status_code == 200, f"Unexpected status code: {response.status_code}"
        data = response.json()
        # Expecting a list/array response
        assert isinstance(data, list), "Response is not a list"
        # Validate response is max 10 signals
        assert len(data) <= 10, f"Returned {len(data)} signals, expected at most 10"
        # Optional: Validate each signal has expected keys (heuristic)
        required_keys = {"id", "symbol", "timestamp", "action"}
        for signal in data:
            assert all(key in signal for key in required_keys), f"Signal missing required keys: {signal}"
        # Check signals ordered by timestamp descending if timestamps present
        timestamps = [signal.get("timestamp") for signal in data if "timestamp" in signal]
        assert timestamps == sorted(timestamps, reverse=True), "Signals are not sorted by timestamp descending"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    except ValueError:
        assert False, "Response is not valid JSON"

test_signals_api_get_latest_signals()
