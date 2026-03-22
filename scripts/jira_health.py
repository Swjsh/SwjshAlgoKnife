#!/usr/bin/env python3
"""
Jira Health Check for SwjshAlgoKnife
Outputs JSON health status for integration with /api/health endpoint.

PULSE-8: Add Jira connectivity to system health dashboard

Usage:
    python scripts/jira_health.py

Output (JSON):
    {
        "status": "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "ERROR",
        "connected": true | false,
        "latencyMs": 123,
        "lastCheck": "2026-03-22T12:00:00.000Z",
        "user": "jack.watergun@gmail.com",
        "baseUrl": "https://swjshalgoknife.atlassian.net",
        "error": null | "error message"
    }
"""

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Ensure scripts/ is on path
sys.path.insert(0, str(Path(__file__).parent))

try:
    from jira_creds import get_credentials
    import requests
except ImportError as e:
    print(json.dumps({
        "status": "ERROR",
        "connected": False,
        "latencyMs": 0,
        "lastCheck": datetime.now(timezone.utc).isoformat(),
        "user": None,
        "baseUrl": None,
        "error": f"Missing dependency: {e}"
    }))
    sys.exit(0)


def check_jira_health():
    """Check Jira API connectivity and return health status."""
    result = {
        "status": "ERROR",
        "connected": False,
        "latencyMs": 0,
        "lastCheck": datetime.now(timezone.utc).isoformat(),
        "user": None,
        "baseUrl": None,
        "error": None
    }

    # Check credentials
    creds = get_credentials()
    if not creds:
        result["error"] = "Jira credentials not configured"
        return result

    email, token, base_url = creds
    result["user"] = email
    result["baseUrl"] = base_url

    # Build request
    api_url = f"{base_url.rstrip('/')}/rest/api/3/myself"
    import base64
    auth = base64.b64encode(f"{email}:{token}".encode()).decode()
    headers = {
        "Authorization": f"Basic {auth}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    # Make request with timing
    start = time.time()
    try:
        resp = requests.get(api_url, headers=headers, timeout=10)
        latency_ms = int((time.time() - start) * 1000)
        result["latencyMs"] = latency_ms

        if resp.status_code == 200:
            result["connected"] = True
            # Classify status based on latency
            if latency_ms < 500:
                result["status"] = "HEALTHY"
            elif latency_ms < 2000:
                result["status"] = "DEGRADED"
            else:
                result["status"] = "UNHEALTHY"
        else:
            result["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
            result["status"] = "UNHEALTHY"

    except requests.Timeout:
        result["latencyMs"] = 10000
        result["error"] = "Request timed out (10s)"
        result["status"] = "UNHEALTHY"
    except requests.RequestException as e:
        result["latencyMs"] = int((time.time() - start) * 1000)
        result["error"] = str(e)
        result["status"] = "ERROR"

    return result


def main():
    """Output health check as JSON."""
    result = check_jira_health()
    print(json.dumps(result))


if __name__ == "__main__":
    main()
