import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30
HEADERS = {
    "Accept": "application/json"
}

def test_TC_BE010_agent_status_get_status():
    url = f"{BASE_URL}/api/agent-status"
    try:
        response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to {url} failed with exception: {e}"

    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
    try:
        data = response.json()
    except ValueError:
        assert False, "Response content is not valid JSON"

    # Validate response is a dict
    assert isinstance(data, dict), "Response JSON should be an object"

    # Check for presence of plausible keys, e.g. 'status' only
    plausible_keys = ["status"]
    for key in plausible_keys:
        assert key in data, f"Key '{key}' missing in response data"

    # If 'agents' key exists, validate its structure
    if "agents" in data:
        agents = data["agents"]
        assert isinstance(agents, list), "'agents' should be a list"
        if agents:
            agent = agents[0]
            assert isinstance(agent, dict), "Each agent entry should be an object"
            expected_agent_keys = ["id", "name", "state", "last_updated"]
            for ak in expected_agent_keys:
                assert ak in agent, f"Key '{ak}' missing in agent status"

test_TC_BE010_agent_status_get_status()
