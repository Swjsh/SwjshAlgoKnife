# OpenClaw HQ Setup

> **Status**: 6 agents ONLINE with independent Discord identities
> **Server**: Contabo VPS 209.145.55.101
> **Guild**: 1484377910503543068
> **Last Updated**: 2026-03-20

---

## Overview

OpenClaw is the AI agent orchestration layer that manages the 6 management agents. Each agent has:
- Its own Discord bot account (separate token, avatar, username)
- Its own workspace with SOUL.md file
- Scoped channel access (only sees relevant channels)
- Independent Claude model assignment

## Agent Roster

| Agent | Role | Model | Primary Channel | Account |
|-------|------|-------|-----------------|---------|
| Chief | Orchestrator, CEO assistant | Claude Sonnet 4.6 | `#chief-announcements` | `chief` |
| Ops | System health, risk monitoring | Claude Haiku 4.5 | `#pulse-alerts` | `ops` |
| Hunter | Tech debt, bug fixes | Claude Haiku 4.5 | `#infra-tasks` | `hunter` |
| Arbiter | Trade grading, lessons | Claude Haiku 4.5 | `#grade-reviews` | `arbiter` |
| Cortana | Research, skill development | Claude Haiku 4.5 | `#learn-patterns` | `cortana` |
| Scout | Revenue, opportunities | Claude Haiku 4.5 | `#back-ideas` | `scout` |

## Discord Channel Map

```
HQ Discord Server (1484377910503543068)
├── GENERAL
│   ├── #general (Chief access)
│   ├── #daily-standup (Chief access)
│   └── #team-meetings (Chief access)
│
├── CHIEF
│   └── #chief-announcements (Chief only)
│
├── PULSE (Ops)
│   ├── #pulse-alerts
│   └── #pulse-log
│
├── INFRA (Hunter)
│   ├── #infra-tasks
│   └── #infra-log
│
├── GRADE (Arbiter)
│   ├── #grade-reviews
│   └── #grade-log
│
├── LEARN (Cortana)
│   ├── #learn-patterns
│   └── #learn-log
│
└── BACK (Scout)
    ├── #back-ideas
    └── #back-log
```

## Configuration Files

### Main Config: `~/.openclaw/openclaw.json`

```json
{
  "gateway": {
    "mode": "local",
    "bind": "loopback",
    "port": 3001
  },
  "accounts": [
    {
      "id": "chief",
      "platform": "discord",
      "model": "claude-sonnet-4-6-20260101",
      "channels": ["#general", "#daily-standup", "#team-meetings", "#chief-announcements"]
    },
    {
      "id": "ops",
      "platform": "discord",
      "model": "claude-haiku-4-5-20260101",
      "channels": ["#pulse-alerts", "#pulse-log"]
    }
    // ... etc for all 6 agents
  ],
  "cron": {
    "enabled": true,
    "jobsFile": "~/.openclaw/cron/jobs.json"
  }
}
```

### Agent Workspaces

Each agent has a workspace at `~/.openclaw/agents/<agent>/`:

```
~/.openclaw/agents/
├── chief/
│   ├── SOUL.md          # Agent identity + instructions
│   └── memory/          # Persistent memory
├── ops/
│   ├── SOUL.md
│   └── memory/
├── hunter/
│   ├── SOUL.md
│   └── memory/
├── arbiter/
│   ├── SOUL.md
│   └── memory/
├── cortana/
│   ├── SOUL.md
│   └── memory/
└── scout/
    ├── SOUL.md
    └── memory/
```

### Environment Variables: `~/.openclaw/.env`

```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENCLAW_GATEWAY_TOKEN=<generated>

# Per-agent Discord tokens
DISCORD_CHIEF_TOKEN=<bot_token>
DISCORD_OPS_TOKEN=<bot_token>
DISCORD_HUNTER_TOKEN=<bot_token>
DISCORD_ARBITER_TOKEN=<bot_token>
DISCORD_CORTANA_TOKEN=<bot_token>
DISCORD_SCOUT_TOKEN=<bot_token>
```

## Agent Personalities

### Chief (Orchestrator)
- **Jira Project**: MGMT
- **Responsibilities**: Morning briefings, decision routing, team coordination
- **Cron Jobs**: 8 AM briefing, 9 AM standup, EOD brain update

### Ops (System Health)
- **Jira Project**: PULSE
- **Responsibilities**: Health monitoring, kill switch authority, risk alerts
- **Superpower**: Can pause any trading agent

### Hunter (Infrastructure)
- **Jira Project**: INFRA
- **Responsibilities**: Bug fixes, tech debt, code improvements
- **Focus**: Codebase quality

### Arbiter (Trade Grading)
- **Jira Project**: GRADE
- **Responsibilities**: A-F grading, lesson extraction, pattern detection
- **Output**: Feeds learning loops

### Cortana (Learning)
- **Jira Project**: LEARN
- **Responsibilities**: Backlog triage, skill development, research
- **Focus**: Knowledge accumulation

### Scout (Revenue)
- **Jira Project**: BACK
- **Responsibilities**: New opportunities, monetization, market research
- **Focus**: Business growth

## Service Management

```bash
# Start OpenClaw
systemctl start openclaw.service

# Check status
systemctl status openclaw.service

# View logs
journalctl -u openclaw.service -f

# Restart after config change
systemctl restart openclaw.service
```

## Gateway API

The gateway runs on port 3001 (loopback by default).

```bash
# Health check
curl http://localhost:3001/health

# Wake an agent
curl -X POST http://localhost:3001/hooks/agent \
  -H "Content-Type: application/json" \
  -d '{"agentId": "chief", "message": "Time for morning briefing"}'
```

## Cron Jobs

Stored in `~/.openclaw/cron/jobs.json`:

| Job | Schedule | Agent | Action |
|-----|----------|-------|--------|
| Morning Briefing | 8:00 AM ET | Chief | Post market summary |
| Daily Standup | 9:00 AM ET | Chief | Compile overnight activity |
| System Builder | Every 3h | Chief | Audit system, update brain |
| EOD Brain Update | 4:45 PM ET | Chief | Daily narrative, stats |
| Evolution Engine | Sunday 6 PM | Chief | Pattern promotion, mutations |

## SOUL Files

Source templates in `Library/agent-souls/`:
- `CHIEF_SOUL.md`
- `OPS_SOUL.md`
- `HUNTER_SOUL.md`
- `ARBITER_SOUL.md`
- `CORTANA_SOUL.md`
- `SCOUT_SOUL.md`

## Integration with n8n

n8n workflows can trigger agents via the gateway:

```json
{
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "url": "http://172.18.0.1:3001/hooks/agent",
    "method": "POST",
    "body": {
      "agentId": "chief",
      "message": "{{ $json.alertMessage }}"
    }
  }
}
```

## Known Issues

1. **GAP-025**: Gateway bound to loopback - Docker can't reach it
   - Fix: Change `gateway.bind` to `"all"` in openclaw.json

2. **GAP-022**: OPENCLAW_GATEWAY env not in Docker
   - Fix: Add to docker-compose.yml environment section

## Related Pages

- [[n8n Automation]]
- [[Agent System]]
- [[System Architecture]]
- [[Deployment]]
