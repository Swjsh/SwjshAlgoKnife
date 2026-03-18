import requests
from requests.exceptions import RequestException
import json

BASE_URL = "http://localhost:3000"
API_PATH = "/api/agents"
TIMEOUT = 30
HEADERS = {
    "Accept": "application/json",
    # Include authentication headers if needed, e.g.:
    # "Authorization": "Bearer <token>",
}

def test_agents_api_get_agent_state():
    url = f"{BASE_URL}{API_PATH}"
    try:
        response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    except RequestException as e:
        assert False, f"Request to {url} failed with exception: {e}"
    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
    try:
        agents_list = response.json()
    except json.JSONDecodeError:
        assert False, "Response content is not valid JSON"

    assert isinstance(agents_list, dict), "Response JSON is not a dict of agents"

    # Basic validation on each agent item
    for agent_id, agent in agents_list.items():
        assert isinstance(agent, dict), "Agent entry is not a JSON object"
        
        # Check basic fields
        assert "status" in agent, f"Agent {agent_id} missing 'status'"
        assert "meta" in agent, f"Agent {agent_id} missing 'meta'"
        
        # Validate 'meta' (which acts as persona)
        meta = agent['meta']
        assert isinstance(meta, dict), "'meta' field is not an object"
        assert "name" in meta, "'meta' missing 'name'"
        assert "type" in meta, "'meta' missing 'type'"

test_agents_api_get_agent_state()
