# Jira Agent System

## Overview

Fully autonomous multi-agent system integrated with Jira for self-learning, self-improving, and self-healing development workflows. Each Jira project has a dedicated agent that picks up issues, implements solutions, creates PRs, and learns patterns.

## Status
- **Setup Date:** 2026-03-21
- **Status:** Active and Ready
- **Jira URL:** https://swjshalgoknife.atlassian.net/

## Quick Start

```powershell
cd C:\Users\jackw\Desktop\SwjshAlgoKnife
.\START_JIRA_AGENTS.ps1
```

## The 7 Projects

| Project | Key | Purpose | Auto-Pickup | Halo Persona |
|---------|-----|---------|-------------|--------------|
| SwjshAK | SCRUM | Core development | Yes | Ops |
| Infrastructure | INFRA | Tech debt, automation | Yes | Chief |
| System Heartbeat | PULSE | Health monitoring | Yes | Arbiter |
| Product Backlog | BACK | Research, ideas | Yes | Scout |
| OpenClaw Learning | LEARN | Pattern aggregation | No (brain) | Cortana |
| Trade Grading | GRADE | Professor reviews | No | Cortana |
| Management Hub | MGMT | Cross-project sync | No | Chief |

## Architecture

```
Jira Projects → Loop Operator → Project Agents → Shared Learning Store
                     ↓
              Halo Crew Discord
```

## Self-Learning Loop

1. Agent picks up issue from Jira
2. Plans implementation
3. Executes via /orchestrate
4. Verifies (build, tests, lint)
5. Creates PR
6. Runs /learn to extract patterns
7. Reports completion to Jira + Discord
8. Patterns aggregate in LEARN project
9. Weekly /evolve generates skills
10. Skills shared across all agents

## Key Files

- `scripts/jira_client.py` - Jira REST API client
- `scripts/jira_agent_loop.py` - Autonomous loop runner
- `scripts/jira_complete.py` - Issue completion handler
- `data/jira-agents.json` - Agent configurations
- `.claude/plan/jira-agent-loop.json` - Self-healing loop config
- `~/.claude/commands/jira-pickup.md` - Issue pickup command
- `docs/JIRA_DISCORD_SETUP.md` - Discord integration guide

## Claude Code Commands

```
/jira-pickup SCRUM           # Pick next issue
/orchestrate feature "..."    # Implement
/learn                        # Extract patterns
/instinct-status              # Check learned patterns
/evolve --generate            # Create skills from patterns
```

## Safety Controls

- Max 100 iterations per session
- Max $50/day cost limit
- Human approval required for: database migrations, breaking changes, security-sensitive changes
- Kill switch: `POST /api/killswitch` or `@Arbiter killswitch` in Discord

## Discord Integration

Notifications flow through Halo Crew personas to appropriate channels:
- `#jira-feed` - All agent activity
- `#pulse-alerts` - Health incidents
- `#grade-reviews` - Trade grades
- `#learn-patterns` - New skills evolved

## Related Pages

- [[Agent System]]
- [[HALO_SOULS]]
- [[System Architecture]]
- [[Troubleshooting]]
