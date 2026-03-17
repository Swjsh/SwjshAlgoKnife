import requests

BASE_URL = "http://localhost:3000"
JOURNAL_ENDPOINT = f"{BASE_URL}/api/journal"
TIMEOUT = 30
HEADERS = {
    "Accept": "application/json"
}

def test_TC_BE001_journal_api_get_all_trades_descending_order():
    try:
        # Get all trades from the journal endpoint
        response = requests.get(JOURNAL_ENDPOINT, headers=HEADERS, timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"
        
        trades = response.json()
        assert isinstance(trades, list), "Response should be a list of trades"
        
        # Check if trades have 'entry_date' field and are sorted in descending order
        entry_dates = []
        for trade in trades:
            assert "entry_date" in trade, "'entry_date' field missing in a trade"
            entry_dates.append(trade["entry_date"])
        
        # Assert descending order by entry_date
        assert entry_dates == sorted(entry_dates, reverse=True), "Trades are not sorted by entry_date descending"

    except requests.RequestException as e:
        assert False, f"HTTP request failed: {e}"
    except ValueError:
        assert False, "Response content is not valid JSON"

test_TC_BE001_journal_api_get_all_trades_descending_order()