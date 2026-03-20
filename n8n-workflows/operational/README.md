# SwjshAK Operational n8n Workflows

Production-ready n8n workflow JSON files for the SwjshAK autonomous trading system's operational automation layer.

---

## Overview

| Workflow | ID | Nodes | Trigger | Purpose |
|----------|-----|-------|---------|---------|
| CEO Morning Briefing | WF-A03 | 22 | Schedule (8 AM ET weekdays) | Daily executive summary with P&L, system health, market context |
| Daily Standup Compiler | WF-A02 | 20 | Schedule (9 AM ET weekdays) | Aggregates Jira sprint status, blockers, agent health |
| Weekly Sprint Planning | WF-A06 | 25 | Schedule (Monday 8 AM ET) | AI-powered sprint proposal with approval workflow |
| Approval Request Handler | WF-A04 | 18 | Webhook | Routes approval requests by risk level |

---

## Prerequisites

### 1. n8n Instance

These workflows require n8n v1.20+ with the following configuration:

```bash
# Required environment variables for n8n
N8N_TIMEZONE=America/New_York
N8N_PAYLOAD_SIZE_MAX=16777216
N8N_EXECUTIONS_DATA_SAVE_ON_ERROR=all
N8N_EXECUTIONS_DATA_SAVE_ON_SUCCESS=all
```

### 2. Required Credentials

Create these credentials in n8n before importing workflows:

| Credential ID | Type | Description |
|---------------|------|-------------|
| `swjshak-api-auth` | HTTP Header Auth | Header: `X-Webhook-Secret`, Value: your SwjshAK webhook secret |
| `anthropic-api-key` | HTTP Header Auth | Header: `x-api-key`, Value: your Anthropic API key |
| `discord-bot` | Discord Bot API | Bot token with Send Messages, Manage Messages, Add Reactions permissions |
| `jira-cloud` | Jira Software Cloud | Email + API token for Jira Cloud |
| `jira-basic-auth` | HTTP Basic Auth | For Agile API sprint creation |
| `webhook-auth` | HTTP Header Auth | For webhook authentication |

### 3. Discord Channel IDs

Set these environment variables or replace values in workflows:

```bash
DISCORD_CEO_CHANNEL_ID=<your-ceo-briefing-channel-id>
DISCORD_STANDUP_CHANNEL_ID=<your-daily-standup-channel-id>
DISCORD_CHIEF_CHANNEL_ID=<your-chief-channel-id>
DISCORD_APPROVALS_CHANNEL_ID=<your-approvals-channel-id>
DISCORD_SYSTEM_CHANNEL_ID=<your-system-channel-id>
DISCORD_ALERTS_CHANNEL_ID=<your-alerts-channel-id>
DISCORD_ERRORS_CHANNEL_ID=<your-n8n-errors-channel-id>
```

### 4. Jira Board IDs

```bash
JIRA_TRADE_BOARD_ID=<board-id-for-trade-project>
JIRA_INFRA_BOARD_ID=<board-id-for-infra-project>
```

---

## Import Instructions

### Method 1: n8n UI Import

1. Open n8n web interface
2. Click "Add Workflow" > "Import from File"
3. Select the `.json` file
4. Review and update credential references
5. Activate the workflow

### Method 2: n8n CLI Import

```bash
# Import single workflow
n8n import:workflow --input=WF-A03-ceo-morning-briefing.json

# Import all workflows
for f in *.json; do n8n import:workflow --input="$f"; done
```

### Method 3: API Import

```bash
curl -X POST "http://localhost:5678/api/v1/workflows" \
  -H "X-N8N-API-KEY: your-api-key" \
  -H "Content-Type: application/json" \
  -d @WF-A03-ceo-morning-briefing.json
```

---

## Workflow Details

### WF-A03: CEO Morning Briefing

**Purpose:** Delivers a comprehensive daily briefing to the CEO channel at 8 AM ET on weekdays.

**Architecture:**
```
[Schedule Trigger]
    |
    +---> [Fetch System Status]     --+
    +---> [Fetch Yesterday Trades]  --+
    +---> [Fetch Agent Status]      --+---> [Merge] --> [Calculate Metrics]
    +---> [Fetch Open Positions]    --+        |
    +---> [Fetch Fear & Greed]      --+        v
    +---> [Fetch Economic Calendar] --+   [Check Quality]
                                            |       |
                                        [AI Gen] [Fallback]
                                            |       |
                                            +---+---+
                                                |
                                        [Format Embed]
                                                |
                               +----------------+----------------+
                               |                                 |
                        [Post Discord]                   [Log Audit]
                               |
                        [Check Critical]
                               |
                        +------+------+
                        |             |
                  [Send Alert]  [Complete]
```

**Key Features:**
- Parallel API calls for fast data collection
- AI-generated briefing using Claude 3.5 Sonnet
- Fallback message when data collection fails
- Critical alert escalation if system health is degraded
- Audit logging for historical tracking

**Sample Output:**
```
:sunrise: CEO Morning Briefing - Friday, March 20, 2026

**PERFORMANCE**
- Yesterday's P&L: +$847.50 (5 trades, 80% win rate)
- MTD: +$3,240.00 on track for monthly target

**SYSTEM**
- 8/8 agents running, all healthy
- No killswitch active

**EXPOSURE**
- 3 open positions, $12,500 total exposure

**ACTION ITEMS**
1. Review LEARN-42 trade lesson from yesterday's loss
2. Consider reducing crypto exposure ahead of Fed announcement
```

---

### WF-A02: Daily Standup Compiler

**Purpose:** Automatically generates and posts a daily standup summary at 9 AM ET on weekdays.

**Architecture:**
```
[Schedule Trigger]
    |
    +---> [Fetch TRADE Sprint] ----+
    +---> [Fetch INFRA Sprint] ----+
    +---> [Fetch LEARN Sprint] ----+---> [Merge] --> [Aggregate Data]
    +---> [Fetch MGMT Sprint]  ----+        |
    +---> [Fetch Agent Heartbeats]-+        v
    +---> [Fetch Yesterday Done]  -+  [Format Standup]
                                            |
                               +------------+------------+
                               |                         |
                        [Post Standup]           [Check Blockers]
                               |                         |
                               |              +----------+----------+
                               |              |                     |
                               |       [Create MGMT Ticket]   [No Blockers]
                               |              |
                               |       [Notify Chief]
                               |              |
                               +------+-------+
                                      |
                               [Log Completion]
```

**Key Features:**
- Queries all 4 Jira projects (TRADE, INFRA, LEARN, MGMT)
- Aggregates blockers across projects
- Creates MGMT ticket when blockers exist
- Agent heartbeat monitoring
- Sprint progress table

**Sample Output:**
```
:clipboard: Daily Standup - Friday, March 20, 2026

### :white_check_mark: Completed Yesterday (4)
- **[TRADE-123]** Implement stop-loss automation
- **[INFRA-45]** Fix agent restart reliability
- **[LEARN-67]** Document ORB strategy edge cases
- **[MGMT-89]** Update roadmap Q2

### :dart: Today's Focus
**TRADE:**
- :construction: **[TRADE-124]** Add trailing stop feature
- :hourglass: **[TRADE-125]** Backtest new entry signals

### :no_entry: Blockers (1)
- :rotating_light: **[INFRA-46]** VPS disk space at 92%

### :robot: Agent Health
- Running: 8/8
- :hourglass: Stale heartbeats: none

### :bar_chart: Sprint Progress
| Project | In Progress | To Do | Blocked |
|---------|-------------|-------|---------|
| TRADE   | 3           | 5     | 0       |
| INFRA   | 2           | 3     | 1       |
| LEARN   | 1           | 4     | 0       |
| MGMT    | 1           | 2     | 0       |
```

---

### WF-A06: Weekly Sprint Planning

**Purpose:** Every Monday at 8 AM ET, generates an AI-powered sprint proposal based on velocity data and backlog, then waits for CEO approval.

**Architecture:**
```
[Schedule Trigger (Monday 8AM)]
    |
    +---> [Fetch TRADE Backlog] ----+
    +---> [Fetch INFRA Backlog] ----+
    +---> [Fetch LEARN Backlog] ----+---> [Merge] --> [Calculate Velocity]
    +---> [Fetch MGMT Backlog]  ----+        |
    +---> [Fetch Last Week Done]----+        v
    +---> [Fetch Trading Perf] -----+  [AI Generate Proposal]
                                            |
                                     [Format Message]
                                            |
                                     [Post to Discord]
                                            |
                                     [Add Reactions]
                                            |
                                     [Wait for Response]
                                            |
                                      [Check Status]
                                            |
                    +-----------------------+-----------------------+
                    |                       |                       |
             [APPROVED]               [REJECTED]              [TIMEOUT]
                    |                       |                       |
        +----------+----------+      [Notify Chief]          [Notify Chief]
        |                     |
[Create TRADE Sprint] [Create INFRA Sprint]
        |                     |
        +----------+----------+
                   |
          [Notify Created]
                   |
          [Log Result]
```

**Key Features:**
- Calculates velocity from last week's completed work
- AI generates balanced sprint proposal
- Suggests capacity at 80% of last week velocity
- Approval/rejection via Discord reactions
- 60-minute timeout with fallback notification
- Automatic sprint creation in Jira on approval

**Approval Criteria:**
- User reacts with :white_check_mark: = Create sprints
- User reacts with :x: = Reject, notify for manual planning
- No response in 60 minutes = Timeout, notify Chief

---

### WF-A04: Approval Request Handler

**Purpose:** Receives approval requests from agents via webhook and routes them based on risk level.

**Architecture:**
```
[Webhook: /approval-request]
    |
[Validate Request]
    |       |
  [OK]   [Invalid]
    |       |
    |   [400 Error]
    |
[Normalize Request]
    |
[Determine Level]
    |
    +--- [Auto-Approve] (low risk, <=$100) ---> [Notify] --> [Callback?] --> [Log]
    |
    +--- [Chief Approval] ($100-$1000, strategy changes)
    |       |
    |       +---> [Post to #approvals] --> [Store Pending] --> [Log]
    |
    +--- [CEO Approval] (>$1000, killswitch, critical)
            |
            +---> [Post to #ceo-briefing] --> [Store Pending] --> [Log]
```

**Approval Levels:**

| Level | Criteria | Channel | Timeout |
|-------|----------|---------|---------|
| Auto-Approve | `type=low_risk_trade` AND `amount<=100` | #system | Immediate |
| Auto-Approve | `type=informational` | #system | Immediate |
| Chief | `amount>100` AND `amount<=1000` | #approvals | 30 min |
| Chief | `type=strategy_change` | #approvals | 30 min |
| CEO | `amount>1000` | #ceo-briefing | 60 min |
| CEO | `type=killswitch` | #ceo-briefing | 60 min |
| CEO | `priority=critical` | #ceo-briefing | 60 min |

**Request Format:**
```json
POST /webhook/approval-request
{
  "type": "strategy_change",
  "description": "Enable trailing stop for Bitcoin Bob",
  "requestor": "bitcoin_bob",
  "amount": 500,
  "priority": "medium",
  "context": {
    "strategy": "ORB",
    "change": "Add 2% trailing stop"
  },
  "callbackUrl": "http://localhost:3000/api/agents/bitcoin-bob/approval-callback"
}
```

**Response:**
```json
{
  "success": true,
  "requestId": "APR-20260320091234-x7k2m9",
  "status": "pending",
  "approvalLevel": "chief",
  "message": "Request submitted for approval"
}
```

---

## Error Handling

All workflows include:

1. **Error Trigger Node** - Catches workflow errors
2. **Error Formatting** - Structures error data
3. **Discord Notification** - Posts to #n8n-errors channel
4. **Non-Critical Failures** - HTTP nodes use `neverError: true` for graceful degradation

Example error notification:
```
:warning: CEO Briefing Workflow Error

Error: Connection timeout after 30000ms
Node: Fetch System Status
Execution: abc123def456
```

---

## Testing Workflows

### Manual Test (Without Activating)

1. Open workflow in n8n
2. Click "Execute Workflow"
3. Provide test trigger data if needed
4. Review execution results

### Test Webhook Workflows

```bash
# Test approval handler
curl -X POST "http://localhost:5678/webhook/approval-request" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-secret" \
  -d '{
    "type": "informational",
    "description": "Test request",
    "requestor": "test_agent",
    "amount": 0
  }'
```

### Dry Run Schedule Triggers

1. Temporarily change cron to run in 1 minute
2. Activate workflow
3. Wait for execution
4. Review results
5. Restore original cron

---

## Maintenance

### Updating Workflows

1. Export current version: `n8n export:workflow --id=<id>`
2. Make changes in n8n UI
3. Test thoroughly
4. Export updated version
5. Update this repository

### Monitoring

- Check n8n execution history daily
- Review #n8n-errors channel
- Monitor audit trail API for gaps

### Credential Rotation

When rotating credentials:
1. Create new credential in n8n
2. Update workflow to use new credential
3. Test workflow
4. Delete old credential

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-20 | Initial production release |

---

## Support

- **n8n Documentation:** https://docs.n8n.io
- **SwjshAK Brain:** `C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\`
- **Issues:** Create Jira ticket in INFRA project
