import json
import random
from datetime import datetime
from pathlib import Path

LOG_FILE = Path(__file__).parent.parent / 'data' / 'agent_logs.json'

def log_message(agent_id, content, type='status'):
    """Appends an IM-style message to the agent logs"""
    
    if not LOG_FILE.exists():
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_FILE, 'w') as f:
            json.dump([], f)
            
    try:
        with open(LOG_FILE, 'r') as f:
            logs = json.load(f)
    except:
        logs = []
        
    new_message = {
        'timestamp': datetime.now().isoformat(),
        'agentId': agent_id,
        'content': content,
        'type': type,
        'id': f"{agent_id}-{int(datetime.now().timestamp())}"
    }
    
    logs.append(new_message)
    
    # Keep last 50 messages
    logs = logs[-50:]
    
    with open(LOG_FILE, 'w') as f:
        json.dump(logs, f, indent=2)

def get_random_quip(agent_id):
    from agent_personas import PERSONAS
    if agent_id in PERSONAS:
        return random.choice(PERSONAS[agent_id]['quips'])
    return "Scanning markets..."
