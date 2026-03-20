# Implementation Gap Analysis

**Created**: 2026-03-19
**Purpose**: Identify what's documented vs what's still needed to actually build the autonomous system
**Status**: GAPS IDENTIFIED — Need more detail

---

## Documentation Inventory

### What Exists

| Document | Content | Detail Level |
|----------|---------|--------------|
| AUTONOMOUS_BUSINESS_PLAN.md | Vision, agent roles, loops, approval flow | ⚠️ Conceptual |
| AUTOMATION_ARCHITECTURE.md | How tools connect | ✅ Good |
| N8N_ULTIMATE_AUTOMATION_PLAN.md | 47 workflow specs | ⚠️ YAML pseudocode, not buildable |
| N8N_SUGGESTED_IMPROVEMENTS.md | 48 enhancements | ⚠️ Recommendations only |
| OPENCLAW_WEBHOOK_SPRINT_PLAN.md | Webhook setup, Developer agent | ⚠️ 1 agent only |
| CLAUDE_N8N_CONTROL_PLAN.md | How Claude uses n8n-mcp | ✅ Good |
| n8n_Setup.md | Installation, wipe, API | ✅ Good |
| Jira_Onboarding.md | Projects, credentials | ✅ Good |
| n8n_Advanced_Workflow_Ideas.md | 11 complex workflow concepts | ⚠️ Ideas, not specs |

### Gap Summary

| Area | Documented | Missing | Severity |
|------|------------|---------|----------|
| **Agent SOUL.md files** | 1 (Developer) | 5 (Chief, Arbiter, Ops, Hunter, Cortana, Scout) | 🔴 CRITICAL |
| **Agent cron schedules** | Partial | Complete schedule per agent | 🔴 CRITICAL |
| **n8n workflow JSON** | 0 | All 47+ workflows | 🔴 CRITICAL |
| **Discord channel setup** | Conceptual | Step-by-step with webhook URLs | 🟡 HIGH |
| **Discord bot for commands** | Not documented | Full bot setup | 🟡 HIGH |
| **Inter-agent communication** | Conceptual | Actual message formats, triggers | 🟡 HIGH |
| **Claude API prompts** | Not documented | System prompts for each agent | 🔴 CRITICAL |
| **Jira automation rules** | Not documented | Workflow triggers, transitions | 🟡 HIGH |
| **Approval reaction handling** | Conceptual | n8n workflow to process reactions | 🟡 HIGH |
| **Error handling patterns** | Mentioned | Actual error workflow JSON | 🟡 HIGH |
| **Testing/validation** | Not documented | How to verify each component | 🟡 HIGH |

---

## Detailed Gap Analysis

### 1. OpenClaw Agent Configuration

**What's documented**:
- Developer agent SOUL.md template (in OPENCLAW_WEBHOOK_SPRINT_PLAN.md)
- Basic webhook endpoint format
- Cron job JSON structure

**What's missing**:

#### SOUL.md Files Needed (6 total)

```
~/.openclaw/agents/
├── chief/
│   └── SOUL.md          ❌ NOT DOCUMENTED
├── arbiter/
│   └── SOUL.md          ❌ NOT DOCUMENTED
├── ops/
│   └── SOUL.md          ❌ NOT DOCUMENTED
├── hunter/
│   └── SOUL.md          ❌ NOT DOCUMENTED (Developer exists, Hunter is different)
├── cortana/
│   └── SOUL.md          ❌ NOT DOCUMENTED
└── scout/
    └── SOUL.md          ❌ NOT DOCUMENTED
```

Each SOUL.md needs:
- Identity (name, emoji, role)
- Core purpose
- Operating rules (ALWAYS/NEVER)
- Workflow steps
- Communication protocols
- Jira project ownership
- Escalation rules
- Example outputs

#### Cron Jobs Needed

```json
// ~/.openclaw/cron/jobs.json — NEEDS FULL SPEC

[
  {
    "jobId": "chief-morning-standup",
    "agentId": "chief",
    "schedule": "0 9 * * 1-5",  // 9 AM ET weekdays
    "payload": { ... }  // ❌ NOT DOCUMENTED
  },
  {
    "jobId": "chief-ceo-briefing",
    "agentId": "chief",
    "schedule": "0 8 * * 1-5",  // 8 AM ET weekdays
    "payload": { ... }  // ❌ NOT DOCUMENTED
  },
  // ... 20+ more cron jobs ❌ NOT DOCUMENTED
]
```

#### Memory File Structures

Each agent needs defined memory files:
```
data/brain/
├── chief/
│   ├── decisions-log.md      // ❌ Schema not documented
│   ├── escalations.md        // ❌ Schema not documented
│   └── sprint-status.md      // ❌ Schema not documented
├── arbiter/
│   ├── grading-history.md    // ❌ Schema not documented
│   ├── quality-metrics.md    // ❌ Schema not documented
│   └── feedback-queue.md     // ❌ Schema not documented
// ... etc for each agent
```

---

### 2. n8n Workflow Specifications

**What's documented**:
- 47 workflows with YAML pseudocode descriptions
- Trigger types, general steps, outputs

**What's missing**:

#### Actual n8n JSON

None of the 47 workflows have actual buildable JSON. Example of what's documented vs what's needed:

**Documented (conceptual)**:
```yaml
name: "CEO Morning Briefing"
trigger: 8:00 AM ET weekdays
steps:
  1. GET /api/control
  2. Query yesterday's trades
  3. Compile report
  4. POST to Discord
```

**Needed (buildable)**:
```json
{
  "name": "WF-A03: CEO Morning Briefing",
  "nodes": [
    {
      "id": "trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1,
      "position": [0, 0],
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "cronExpression",
              "expression": "0 8 * * 1-5"
            }
          ]
        }
      }
    },
    {
      "id": "get_control",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [200, 0],
      "parameters": {
        "url": "http://localhost:3000/api/control",
        "method": "GET",
        "authentication": "none"
      }
    },
    {
      "id": "get_trades",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [400, 0],
      "parameters": {
        "url": "http://localhost:3000/api/trades",
        "method": "GET",
        "options": {
          "qs": {
            "date": "={{ $now.minus({days: 1}).toFormat('yyyy-MM-dd') }}"
          }
        }
      }
    },
    // ... 10+ more nodes
    {
      "id": "discord_post",
      "type": "n8n-nodes-base.discord",
      "typeVersion": 2,
      "position": [1000, 0],
      "parameters": {
        "resource": "webhook",
        "operation": "send",
        "webhookUri": "={{ $credentials.discordCeoBriefing.webhookUrl }}",
        "message": "={{ $json.compiledReport }}"
      }
    }
  ],
  "connections": {
    "trigger": { "main": [[{ "node": "get_control", "type": "main", "index": 0 }]] },
    "get_control": { "main": [[{ "node": "get_trades", "type": "main", "index": 0 }]] },
    // ... all connections
  }
}
```

**Scale of the gap**: 47 workflows × ~10-30 nodes each = 470-1400 node configurations needed.

#### Expression Syntax

n8n uses `={{ }}` expressions. None are documented:
```javascript
// Date expressions
={{ $now.toFormat('yyyy-MM-dd') }}
={{ $json.timestamp }}

// Conditionals
={{ $json.status === 'CRITICAL' ? 'red' : 'green' }}

// Aggregations
={{ $items().map(i => i.json.pnl).reduce((a,b) => a+b, 0) }}
```

#### Error Handling Patterns

Not documented:
- How to catch errors in n8n
- Retry configuration
- Error workflow routing
- Alerting on failure

---

### 3. Discord Configuration

**What's documented**:
- Channel names (#ceo-briefing, #approvals, etc.)
- General message formats
- Reaction-based approval concept

**What's missing**:

#### Webhook Setup

```yaml
# NEEDED: Actual webhook configuration per channel

discord_webhooks:
  ceo_briefing:
    channel_id: "???"           # ❌ NOT DOCUMENTED
    webhook_url: "???"          # ❌ NOT DOCUMENTED
    name: "Chief"
    avatar: "chief_avatar.png"

  approvals:
    channel_id: "???"           # ❌ NOT DOCUMENTED
    webhook_url: "???"          # ❌ NOT DOCUMENTED
    name: "Approval Bot"

  # ... for each channel
```

#### Bot for Inbound Commands

Webhooks are outbound only (n8n → Discord). For inbound (Discord → n8n):

```yaml
# OPTION A: Discord Bot
discord_bot:
  token: "???"                  # ❌ NOT DOCUMENTED
  permissions: [READ_MESSAGES, SEND_MESSAGES, ADD_REACTIONS]
  commands:
    - "!status" → trigger WF-STATUS
    - "!pause {agent}" → trigger WF-PAUSE
    - "!approve {ticket}" → trigger WF-APPROVE

# OPTION B: Discord → n8n via Webhook Trigger
# User reacts → Discord calls n8n webhook
```

Neither option is documented.

#### Approval Reaction Handling

The flow "user reacts 👍, n8n processes approval" needs:

```yaml
# NEEDED: How does n8n know about Discord reactions?

option_1_discord_bot:
  # Discord.js bot listens for reactions
  # Calls n8n webhook with reaction data
  # ❌ NOT DOCUMENTED

option_2_polling:
  # n8n polls Discord API for reactions
  # Requires Discord bot token
  # ❌ NOT DOCUMENTED

option_3_discord_interactions:
  # Use Discord slash commands + interactions webhook
  # ❌ NOT DOCUMENTED
```

#### Message Templates

Need actual embeds, not conceptual descriptions:

```json
// NEEDED: Actual Discord embed JSON
{
  "embeds": [{
    "title": "☀️ CEO Morning Briefing — {{ date }}",
    "color": 3447003,
    "fields": [
      {
        "name": "📊 Yesterday's Performance",
        "value": "Trades: {{ trades }} | P&L: ${{ pnl }} | WR: {{ winRate }}%",
        "inline": false
      },
      {
        "name": "🔧 System Status",
        "value": "{{ systemStatus }}",
        "inline": false
      }
    ],
    "footer": {
      "text": "Reply 'status' for details"
    }
  }]
}
```

---

### 4. Claude API Integration

**What's documented**:
- Concept that agents "call Claude for thinking"
- Cost limits ($50/month)

**What's missing**:

#### System Prompts for Each Agent

```yaml
# NEEDED: Full system prompts

chief_system_prompt: |
  You are Chief, the COO of SwjshAlgoKnife trading system.

  ## Your Role
  - Coordinate all other agents
  - Prepare CEO briefings
  - Run daily standups
  - Handle escalations

  ## Your Context
  - Master Tracker: [path]
  - Agent statuses: [data]
  - Today's date: {{ date }}

  ## Your Task
  {{ task_description }}

  ## Output Format
  Respond with JSON:
  {
    "summary": "...",
    "actions": [...],
    "escalations": [...],
    "next_steps": [...]
  }

# ❌ NOT DOCUMENTED for any agent
```

#### API Call Patterns

```python
# NEEDED: How agents call Claude

def agent_think(agent_id: str, context: dict, task: str) -> dict:
    """
    Agent thinking via Claude API
    """
    system_prompt = load_system_prompt(agent_id)

    response = anthropic.messages.create(
        model="claude-sonnet-4-20250514",  # or haiku for simple tasks
        max_tokens=4096,
        system=system_prompt,
        messages=[
            {"role": "user", "content": format_context(context, task)}
        ]
    )

    return parse_response(response)

# ❌ NOT DOCUMENTED
```

#### Token/Cost Tracking

```yaml
# NEEDED: How to track API costs

cost_tracking:
  log_every_call:
    - timestamp
    - agent_id
    - model
    - input_tokens
    - output_tokens
    - cost_usd

  daily_budget: $2.00
  weekly_budget: $12.00
  monthly_budget: $50.00

  alert_at: 80% of daily budget
  hard_stop_at: 100% of daily budget

# ❌ NOT DOCUMENTED
```

---

### 5. Jira Automation

**What's documented**:
- 6 projects exist with labels
- Ticket types per project
- General workflow concept

**What's missing**:

#### Jira Automation Rules

```yaml
# NEEDED: Actual Jira automation rules

rules:
  - name: "Auto-assign to agent"
    when: Issue created in INFRA
    then: Assign to "Hunter" (service account or agent ID)

  - name: "Escalation on SLA breach"
    when: Issue in PULSE not updated for 30 min AND priority = P1
    then:
      - Add label "escalated"
      - Trigger webhook to n8n

  - name: "Sprint auto-close"
    when: Sprint end date reached
    then:
      - Move incomplete to backlog
      - Create retrospective ticket

# ❌ NOT DOCUMENTED
```

#### Jira → n8n Webhooks

```yaml
# NEEDED: How Jira triggers n8n

jira_webhooks:
  - event: issue_created
    project: INFRA
    webhook: http://n8n:5678/webhook/jira-infra-created

  - event: issue_updated
    filter: status changed to "Done"
    webhook: http://n8n:5678/webhook/jira-issue-closed

  - event: comment_created
    filter: contains "@approve"
    webhook: http://n8n:5678/webhook/jira-approval-comment

# ❌ NOT DOCUMENTED
```

#### Sprint Management

```yaml
# NEEDED: How sprints are created/managed

sprint_automation:
  duration: 1 week (Monday-Friday)

  planning:
    trigger: Monday 8:00 AM
    workflow:
      1. Chief queries each project backlog (top 5 by priority)
      2. Chief estimates capacity
      3. Chief creates sprint in each Jira project
      4. Chief posts sprint plan to #ceo-briefing
      5. Wait for CEO approval
      6. On approval → Activate sprints

  closure:
    trigger: Friday 5:00 PM
    workflow:
      1. Query sprint status per project
      2. Calculate velocity
      3. Move incomplete to backlog
      4. Create retrospective ticket
      5. Post sprint summary

# ❌ NOT DOCUMENTED
```

---

### 6. Inter-Agent Communication

**What's documented**:
- Concept that agents create tickets for each other
- Escalation chain

**What's missing**:

#### Message Formats

```yaml
# NEEDED: Standardized inter-agent message format

cross_agent_ticket:
  summary: "[FROM:{source_agent}] {brief_description}"
  description: |
    ## Origin
    Agent: {{ source_agent }}
    Timestamp: {{ timestamp }}
    Trigger: {{ what_caused_this }}

    ## Request
    {{ detailed_request }}

    ## Context
    {{ relevant_context }}

    ## Expected Action
    {{ what_target_should_do }}

    ## Deadline
    {{ urgency_level }}

  labels:
    - cross-agent
    - from-{{ source_agent }}
    - urgency-{{ level }}

# ❌ NOT DOCUMENTED
```

#### Handoff Protocols

```yaml
# NEEDED: How agents hand off work

handoff_protocol:
  cortana_to_hunter:
    trigger: LEARN ticket marked [CONFIRMED] for 3 weeks
    action:
      1. Cortana creates INFRA ticket
      2. Includes: pattern data, confidence, suggested implementation
      3. Links to original LEARN ticket
      4. Hunter receives via cron scan or Jira notification

  arbiter_to_hunter:
    trigger: Code review finds bug
    action:
      1. Arbiter creates INFRA ticket with [BUG] label
      2. Includes: file, line, issue, suggested fix
      3. Links to PR

  ops_to_chief:
    trigger: P1 incident
    action:
      1. Ops creates PULSE ticket
      2. Immediately posts to Discord #alerts
      3. Creates MGMT ticket for Chief
      4. If not resolved in 5 min → CEO alert

# ❌ NOT DOCUMENTED
```

---

### 7. Testing & Validation

**What's documented**:
- Nothing specific

**What's missing**:

```yaml
# NEEDED: How to test each component

testing:
  n8n_workflows:
    - Manual trigger test
    - Mock external APIs
    - Verify outputs

  agent_responses:
    - Test SOUL.md with sample scenarios
    - Verify output format
    - Check for hallucinations

  discord_integration:
    - Test webhook delivery
    - Test reaction handling
    - Test message formatting

  jira_integration:
    - Test ticket creation
    - Test automation rules
    - Test webhook triggers

  end_to_end:
    - Simulate incident → verify full flow
    - Simulate trade close → verify grading
    - Simulate approval request → verify CEO receives

# ❌ NOT DOCUMENTED
```

---

## Priority Order for Filling Gaps

### Phase 1: Agent Foundation (CRITICAL)

| Item | Est. Time | Why First |
|------|-----------|-----------|
| 6 Agent SOUL.md files | 3-4 hours | Agents can't think without this |
| Agent cron job specs | 1-2 hours | Agents can't wake up without this |
| Claude API prompt templates | 2-3 hours | Agents can't reason without this |

### Phase 2: Communication Layer (HIGH)

| Item | Est. Time | Why |
|------|-----------|-----|
| Discord webhook setup | 1 hour | Agents can't report without this |
| Discord bot/reaction handling | 2-3 hours | CEO can't approve without this |
| Message templates (embeds) | 1-2 hours | Professional output |

### Phase 3: Workflow Engine (HIGH)

| Item | Est. Time | Why |
|------|-----------|-----|
| 5-10 core n8n workflows (JSON) | 4-6 hours | Most critical automations |
| Error handling patterns | 1-2 hours | Reliability |
| Expression syntax reference | 1 hour | Buildability |

### Phase 4: Integration (MEDIUM)

| Item | Est. Time | Why |
|------|-----------|-----|
| Jira automation rules | 2-3 hours | Agent ↔ Jira |
| Jira webhooks to n8n | 1-2 hours | Reactive triggers |
| Sprint management workflow | 2-3 hours | Business operations |

### Phase 5: Refinement (LOWER)

| Item | Est. Time | Why |
|------|-----------|-----|
| Remaining 35+ n8n workflows | 10-15 hours | Full coverage |
| Testing procedures | 2-3 hours | Validation |
| Memory file schemas | 1-2 hours | Agent learning |

---

## Recommendation

**Current state**: Vision is clear, but not buildable without significant additional documentation.

**What I can create now** (in priority order):

1. **Complete Agent SOUL.md files** — Full personality, rules, workflows for all 6 agents
2. **Cron job configuration** — Complete `jobs.json` for all agent schedules
3. **Discord setup guide** — Step-by-step with webhook creation
4. **5 core n8n workflows** — Actual JSON for the most critical automations
5. **Claude API integration spec** — Prompts, patterns, cost tracking

**Estimated documentation time**: 15-20 hours to make this fully buildable

---

## Next Steps

Do you want me to:

1. **Start with Agent SOUL.md files** — Create all 6 agent personalities in detail?
2. **Create Discord setup guide** — Step-by-step channel + webhook + bot setup?
3. **Build core n8n workflows** — Actual JSON for CEO briefing, approval, standup?
4. **All of the above** — Comprehensive pass through all gaps?

Let me know which to prioritize.

---

*Gap analysis complete. Ready to fill the holes.*
