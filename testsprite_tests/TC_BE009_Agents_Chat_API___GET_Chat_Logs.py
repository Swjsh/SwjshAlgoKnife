import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def test_agents_chat_api_get_chat_logs():
    url = f"{BASE_URL}/api/agents/chat"
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    
    assert response.status_code == 200, f"Unexpected status code: {response.status_code}, body: {response.text}"
    
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Validate that the response is a list (chat logs)
    assert isinstance(data, list), f"Expected response to be a list, got {type(data)}"

    if data:
        # Each item should be a dict representing a chat log with persona info
        for log in data:
            assert isinstance(log, dict), f"Expected chat log to be a dict, got {type(log)}"
            # Check required keys presence
            assert "agentId" in log, "Missing 'agentId' in chat log"
            assert "persona" in log, "Missing 'persona' in chat log"
            assert isinstance(log["persona"], dict), "'persona' should be a dict"
            assert "message" in log, "Missing 'message' in chat log"
            assert "timestamp" in log, "Missing 'timestamp' in chat log"

            # Validate types
            assert isinstance(log["agentId"], (str, int)), "'agentId' should be str or int"
            assert isinstance(log["message"], str), "'message' should be str"
            # Persona dict should have at least a 'name' or 'role' field (common persona info)
            assert ("name" in log["persona"] or "role" in log["persona"]), "Persona should have 'name' or 'role'"

test_agents_chat_api_get_chat_logs()
