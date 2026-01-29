import requests
from requests.exceptions import RequestException

BASE_URL = "http://localhost:3000"
JOURNAL_ENDPOINT = f"{BASE_URL}/api/journal"
HEADERS = {"Accept": "application/json"}
TIMEOUT = 30

def test_journal_api_error_handling():
    """
    Test GET /api/journal to verify it handles database errors gracefully.
    Since we cannot directly induce a database error via the API,
    we test the endpoint response for robustness in error scenario,
    checking for proper status code and error message formatting.
    """
    try:
        response = requests.get(JOURNAL_ENDPOINT, headers=HEADERS, timeout=TIMEOUT)
    except RequestException as e:
        assert False, f"Request to {JOURNAL_ENDPOINT} failed with exception: {e}"

    # The test intent is to check graceful error handling in case of DB failure.
    # If the server is running normally, we expect 200 OK.
    # If a DB error occurs, the server should respond with a handled error (4xx or 5xx).
    if response.status_code == 200:
        # Server working normally, response should be a list or dict JSON,
        # Validate it returns JSON and structure is plausible (list of trades or empty)
        try:
            data = response.json()
        except ValueError:
            assert False, "Response is not valid JSON"

        # The data should be list or dict (usually list of trades)
        assert isinstance(data, (list, dict)), f"Unexpected data type: {type(data)}"
    else:
        # For error scenario (simulate DB error), validate graceful error response
        # Status code should be 4xx or 5xx handled by backend
        assert 400 <= response.status_code < 600, f"Unexpected status code: {response.status_code}"
        # Response body should contain JSON with error details
        try:
            error_data = response.json()
        except ValueError:
            assert False, "Error response is not valid JSON"
        # Error response should include some indication of error message or code
        assert any(
            key in error_data for key in ("error", "message", "detail")
        ), "Error response JSON missing expected keys"

test_journal_api_error_handling()