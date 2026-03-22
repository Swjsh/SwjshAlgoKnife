#!/usr/bin/env python3
"""
Autonomous Jira Agent Loop for Algo Knife
Self-learning, self-improving, self-healing agent system.

Usage:
    python scripts/jira_agent_loop.py start [--project SCRUM]
    python scripts/jira_agent_loop.py status
    python scripts/jira_agent_loop.py stop
"""

import sys
import json
import time
import random
from pathlib import Path
from datetime import datetime

# Add scripts to path
sys.path.insert(0, str(Path(__file__).parent))
from jira_client import JiraClient

# Paths
SWJSH_DIR = Path(__file__).parent.parent
DATA_DIR = SWJSH_DIR / "data"
AGENTS_CONFIG = DATA_DIR / "jira-agents.json"
LOOP_STATE = DATA_DIR / "jira-loop-state.json"


def load_config():
    """Load agent configuration."""
    if AGENTS_CONFIG.exists():
        return json.loads(AGENTS_CONFIG.read_text())
    return None


def load_state():
    """Load current loop state."""
    if LOOP_STATE.exists():
        return json.loads(LOOP_STATE.read_text())
    return {
        "running": False,
        "currentProject": None,
        "currentIssue": None,
        "iterationCount": 0,
        "issuesCompleted": 0,
        "skillsLearned": 0,
        "lastActivity": None,
        "errors": []
    }


def save_state(state):
    """Save loop state."""
    state["lastActivity"] = datetime.now().isoformat()
    LOOP_STATE.write_text(json.dumps(state, indent=2))


def pick_next_issue(client, project_key, config):
    """Pick the next available issue from a project."""
    agent_config = config["agents"].get(project_key, {})
    exclude_labels = agent_config.get("excludeLabels", [])
    issue_types = agent_config.get("issueTypes", ["Task", "Bug", "Story"])

    # Build JQL - support both "To Do" and "Selected for Development" across projects
    jql_parts = [
        "status IN ('To Do', 'Selected for Development')",
        "assignee IS EMPTY"
    ]

    if exclude_labels:
        for label in exclude_labels:
            jql_parts.append(f"labels != '{label}'")

    if issue_types:
        types_str = ", ".join([f"'{t}'" for t in issue_types])
        jql_parts.append(f"issuetype IN ({types_str})")

    jql = " AND ".join(jql_parts) + " ORDER BY priority DESC, created ASC"

    result = client.list_issues(project_key, jql_filter=jql, max_results=5)

    if "issues" in result and len(result["issues"]) > 0:
        return result["issues"][0]

    return None


def transition_issue(client, issue_key, status):
    """Transition an issue to a new status."""
    return client.update_issue_status(issue_key, status)


def add_comment(client, issue_key, comment):
    """Add a comment to an issue."""
    return client.add_comment(issue_key, comment)


def notify_discord(persona, message, channel=None):
    """Send notification via Halo Crew (placeholder - integrate with Discord API)."""
    print(f"[DISCORD] {persona.upper()}: {message}")
    # TODO: Integrate with src/lib/discord/halo-bots.ts


def run_iteration(client, project_key, config, state):
    """Run a single iteration of the agent loop."""
    print(f"\n{'='*60}")
    print(f"ITERATION {state['iterationCount'] + 1} - Project: {project_key}")
    print(f"{'='*60}")

    # Phase 1: Discover
    print("\n[PHASE 1: DISCOVER]")
    issue = pick_next_issue(client, project_key, config)

    if not issue:
        print(f"  No issues available in {project_key}")
        return "no_issues"

    issue_key = issue["key"]
    summary = issue["fields"]["summary"]
    print(f"  Picked: {issue_key} - {summary}")

    # Claim the issue
    transition_result = transition_issue(client, issue_key, "In Progress")
    if transition_result and "error" not in transition_result:
        print(f"  Transitioned to In Progress")
        add_comment(client, issue_key,
            f"Agent picking up this issue.\n\n"
            f"Project: {project_key}\n"
            f"Timestamp: {datetime.now().isoformat()}\n"
            f"Mode: Autonomous"
        )

    state["currentIssue"] = issue_key
    save_state(state)

    # Phase 2-6 would invoke Claude Code commands
    # This script sets up the state; the actual work is done by Claude

    print(f"\n[HANDOFF TO CLAUDE]")
    print(f"  Issue: {issue_key}")
    print(f"  Summary: {summary}")
    print(f"  Execute: /orchestrate feature \"{summary}\"")
    print(f"  Then: /learn")

    # Notify Discord
    agent_config = config["agents"].get(project_key, {})
    persona = agent_config.get("haloPersona", "chief")
    notify_discord(persona, f"Picked up {issue_key}: {summary}")

    state["iterationCount"] += 1
    save_state(state)

    return "handoff"


def cmd_start(project_key=None):
    """Start the autonomous loop."""
    config = load_config()
    if not config:
        print("[ERROR] No agent config found at data/jira-agents.json")
        return

    state = load_state()
    state["running"] = True
    state["currentProject"] = project_key
    save_state(state)

    client = JiraClient()

    # If no project specified, cycle through all auto-pickup projects
    if project_key:
        projects = [project_key]
    else:
        projects = [
            key for key, cfg in config["agents"].items()
            if cfg.get("autoPickup", False)
        ]
        # Sort by priority
        projects.sort(key=lambda k: config["agents"][k].get("priority", 99))

    print(f"\n{'#'*60}")
    print(f"# ALGO KNIFE AUTONOMOUS JIRA AGENT")
    print(f"# Projects: {', '.join(projects)}")
    print(f"# Mode: Self-learning, Self-improving, Self-healing")
    print(f"{'#'*60}")

    for proj in projects:
        result = run_iteration(client, proj, config, state)
        if result == "handoff":
            # Handoff to Claude for actual implementation
            print(f"\n[READY FOR CLAUDE EXECUTION]")
            print(f"Run the following commands:")
            print(f"  1. /jira-pickup {proj}")
            print(f"  2. /orchestrate feature \"<issue summary>\"")
            print(f"  3. /learn")
            break
        elif result == "no_issues":
            continue

    print(f"\n[LOOP STATE SAVED]")
    print(f"  State file: {LOOP_STATE}")


def cmd_status():
    """Show current loop status."""
    state = load_state()
    config = load_config()

    print(f"\n{'='*60}")
    print("ALGO KNIFE JIRA AGENT STATUS")
    print(f"{'='*60}")

    print(f"\nLoop State:")
    print(f"  Running: {state.get('running', False)}")
    print(f"  Current Project: {state.get('currentProject', 'None')}")
    print(f"  Current Issue: {state.get('currentIssue', 'None')}")
    print(f"  Iterations: {state.get('iterationCount', 0)}")
    print(f"  Issues Completed: {state.get('issuesCompleted', 0)}")
    print(f"  Skills Learned: {state.get('skillsLearned', 0)}")
    print(f"  Last Activity: {state.get('lastActivity', 'Never')}")

    if config:
        print(f"\nConfigured Projects:")
        for key, cfg in config.get("agents", {}).items():
            auto = "AUTO" if cfg.get("autoPickup") else "MANUAL"
            persona = cfg.get("haloPersona", "?")
            print(f"  [{key}] {auto} - Persona: {persona}")

    if state.get("errors"):
        print(f"\nRecent Errors:")
        for err in state["errors"][-5:]:
            print(f"  - {err}")


def cmd_stop():
    """Stop the loop."""
    state = load_state()
    state["running"] = False
    save_state(state)
    print("[STOPPED] Loop stopped. Resume with: python scripts/jira_agent_loop.py start")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        cmd_status()
        return

    command = sys.argv[1].lower()

    if command == "start":
        project = sys.argv[2] if len(sys.argv) > 2 else None
        cmd_start(project)
    elif command == "status":
        cmd_status()
    elif command == "stop":
        cmd_stop()
    else:
        print(f"Unknown command: {command}")
        print(__doc__)


if __name__ == "__main__":
    main()
