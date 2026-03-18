import requests
import time

BASE_URL = "http://localhost:3000"
TIMEOUT = 30


def test_TC_BE012_webhook_api_signal_processing():
    """
    Verify POST /api/webhook/tradingview triggers TradeExecutor.processSignal() correctly.
    The test will:
    - Create a valid webhook signal payload
    - POST it to /api/webhook/tradingview
    - Check that the response is success (e.g. 200 or 201)
    - Then call GET /api/signals to verify that the signal is stored and processed
    - Clean any created resource if applicable (no explicit ID concept given for webhook signals)
    """

    headers = {
        "Content-Type": "application/json",
    }

    # Added required 'secret' field with dummy test secret
    payload = {
        "ticker": "BTCUSD",
        "price": 29500.50,
        "time": int(time.time() * 1000),
        "strategy": {
            "order_action": "buy",
            "order_contracts": 1,
            "order_price": 29500.50,
            "order_comment": "test signal"
        },
        "strategy_id": "test_strategy_001",
        "signal_id": f"signal_{int(time.time())}",
        "exchange": "Binance",
        "interval": "1m",
        "secret": "test_secret"
    }

    try:
        response = requests.post(
            f"{BASE_URL}/api/webhook/tradingview",
            headers=headers,
            json=payload,
            timeout=TIMEOUT,
        )
    except requests.RequestException as e:
        assert False, f"POST /api/webhook/tradingview request failed: {e}"

    assert response.status_code in (200, 201), f"Unexpected status code: {response.status_code} - {response.text}"

    try:
        resp_json = response.json()
    except Exception:
        assert False, "Response is not valid JSON"

    assert ("success" in resp_json and resp_json["success"] is True) or \
           ("message" in resp_json and "processed" in resp_json["message"].lower()) or \
           ("signal_id" in resp_json and resp_json["signal_id"] == payload["signal_id"]), \
           f"Response JSON missing expected confirmation fields: {resp_json}"

    try:
        get_signals_resp = requests.get(
            f"{BASE_URL}/api/signals",
            timeout=TIMEOUT,
        )
    except requests.RequestException as e:
        assert False, f"GET /api/signals request failed: {e}"

    assert get_signals_resp.status_code == 200, f"Unexpected status code from /api/signals: {get_signals_resp.status_code}"
    try:
        signals_data = get_signals_resp.json()
    except Exception:
        assert False, "GET /api/signals response is not valid JSON"

    assert isinstance(signals_data, list), "Signals API did not return a list"

    found_signal = False
    for sig in signals_data:
        if sig.get("signal_id") == payload["signal_id"]:
            found_signal = True
            assert sig.get("ticker") == payload["ticker"], "Ticker mismatch in stored signal"
            assert sig.get("strategy_id") == payload.get("strategy_id"), "Strategy ID mismatch in stored signal"
            break

    assert found_signal, "Posted signal not found in signals list"


test_TC_BE012_webhook_api_signal_processing()
