# n8n Automation System

> **Status**: 18 workflows deployed to Contabo VPS (209.145.55.101:5678)
> **Total Nodes**: 534 across all workflows
> **Last Updated**: 2026-03-20

---

## Overview

n8n is the automation backbone that enables true autonomous operation. It orchestrates:
- **Scheduled operations** (morning briefings, sprint planning)
- **Reactive workflows** (trade grading, incident response)
- **Self-improvement loops** (tech debt scanning, strategy tuning)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      n8n Workflow Engine                        │
│                    (209.145.55.101:5678)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ OPERATIONAL │  │  REACTIVE   │  │    SELF-IMPROVEMENT     │ │
│  │ 4 workflows │  │ 4 workflows │  │      10 workflows       │ │
│  │   85 nodes  │  │  112 nodes  │  │       337 nodes         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│         │                │                     │                │
│         ▼                ▼                     ▼                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    INTEGRATIONS                          │  │
│  │  Jira Cloud │ Discord │ Claude AI │ GitHub │ SwjshAK API │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Workflow Categories

### Operational (Daily Operations)
| Workflow | Nodes | Schedule | Purpose |
|----------|-------|----------|---------|
| [[WF-A02 Daily Standup]] | 20 | 9:00 AM ET | Compile overnight activity |
| [[WF-A03 CEO Briefing]] | 22 | 8:00 AM ET | Market + portfolio summary |
| [[WF-A04 Approval Handler]] | 18 | On-demand | Human-in-loop decisions |
| [[WF-A06 Sprint Planning]] | 25 | Monday 9 AM | Weekly sprint automation |

### Reactive (Event-Driven)
| Workflow | Nodes | Trigger | Purpose |
|----------|-------|---------|---------|
| [[WF-P01 Trade Grading]] | 28 | Trade close | AI grades closed trades |
| [[WF-P02 Code Review]] | 23 | PR opened | AI code review pipeline |
| [[WF-S02 Incident Response]] | 40 | Error detected | Self-healing + escalation |
| [[WF-SC01 Pattern Detection]] | 21 | Every 4 hours | Market signal processing |

### Self-Improvement (Autonomous Enhancement)
| Workflow | Nodes | Schedule | Purpose |
|----------|-------|----------|---------|
| [[WF-INFRA-01 Tech Debt Scanner]] | 33 | Daily 6 AM | Scan code, create INFRA tickets |
| [[WF-INFRA-02 Dependency Auditor]] | 41 | Weekly Sunday | Monitor outdated packages |
| [[WF-OPS-01 Health Aggregator]] | 33 | Every 5 min | Composite health + auto-recovery |
| [[WF-OPS-02 Anomaly Detector]] | 33 | Every 15 min | Z-score statistical analysis |
| [[WF-LEARN-01 Lesson Compiler]] | 34 | Friday 5 PM | Weekly trading lessons |
| [[WF-LEARN-02 Strategy Tuner]] | 35 | Sunday 6 PM | Parameter optimization |
| [[WF-BACK-01 Backlog Groomer]] | 32 | Daily 7 AM | Auto-prioritize tickets |
| [[WF-CORTANA-01 Research Pipeline]] | 36 | Wednesday 10 AM | Weekly market research |
| [[WF-MGMT-01 Weekly Retrospective]] | 30 | Friday 6 PM | Team velocity + wins |
| [[WF-MGMT-02 Velocity Tracker]] | 33 | Weekly | Sprint burndown tracking |

## Required Credentials

Configure these in n8n UI (Settings > Credentials):

| Credential | Type | Used By |
|------------|------|---------|
| `jira-cred` | Jira Cloud API | All workflows creating tickets |
| `discord-bot-cred` | Discord Bot | All notification workflows |
| `anthropic-api-cred` | HTTP Header Auth | Claude AI analysis nodes |
| `github-token-cred` | HTTP Header Auth | Tech debt scanner, code review |
| `swjshak-api-auth` | HTTP Header Auth | Internal API calls |

## Environment Variables

Set in n8n Settings > Variables:

```
JIRA_BASE_URL=https://swjsh.atlassian.net
GITHUB_REPO_OWNER=Swjsh
GITHUB_REPO_NAME=SwjshAlgoKnife
DISCORD_GUILD_ID=1484377910503543068
DISCORD_SYSTEM_CHANNEL=<channel_id>
DISCORD_ALERTS_CHANNEL=<channel_id>
```

## Activation

All workflows are deployed **inactive** by default. To activate:

1. Go to n8n UI: http://209.145.55.101:5678
2. Login: admin / (check CLAUDE_SETUP_HANDOFF.md)
3. Configure credentials first
4. Toggle each workflow to "Active"
5. Verify with manual test run

## File Locations

- **Local JSON**: `C:\Users\jackw\Desktop\SwjshAlgoKnife\n8n-workflows\`
- **Server Import**: `/var/lib/docker/volumes/n8n_data/_data/`
- **Manifest**: `n8n-workflows/workflow-manifest.json`

## Related Pages

- [[Self-Improvement Architecture]]
- [[OpenClaw HQ Setup]]
- [[System Architecture]]
- [[Deployment]]
