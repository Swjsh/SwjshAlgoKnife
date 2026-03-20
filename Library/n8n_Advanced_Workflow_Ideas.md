# n8n Advanced Workflow Ideas

**Created**: 2026-03-19
**Purpose**: Complex multi-step workflows incorporating Claude AI, Jira ticket triage, and autonomous operations
**Status**: Ideas documented — NOT YET IMPLEMENTED

---

## Table of Contents

1. [Hunterure Overview](#architecture-overview)
2. [Jira + Claude AI Workflows](#jira--claude-ai-workflows)
3. [Autonomous Agent Coordination](#autonomous-agent-coordination)
4. [Self-Healing System Workflows](#self-healing-system-workflows)
5. [Intelligence & Learning Workflows](#intelligence--learning-workflows)
6. [Cross-Project Orchestration](#cross-project-orchestration)
7. [Implementation Notes](#implementation-notes)

---

## Hunterure Overview

### n8n Capabilities Summary

| Feature | Description |
|---------|-------------|
| **Triggers** | Webhooks, Cron schedules, Jira events, Manual |
| **Flow Logic** | If/Switch branching, Looping, Merging, Waiting |
| **Sub-workflows** | Reusable workflow modules via Execute Workflow node |
| **Error Handling** | Error Trigger node, Continue on Fail, Error workflows |
| **AI Integration** | Anthropic Chat Model, AI Agents, Memory, RAG |
| **Jira Integration** | Full CRUD (issues, comments, attachments), Webhooks for all events |

### Key Nodes We'll Use

```
TRIGGERS:
├── Jira Trigger (issue_created, issue_updated, comment_created, sprint events)
├── Webhook (external signals from OpenClaw, TradingView)
├── Schedule Trigger (cron-based automation)
└── Manual Trigger (testing)

AI/LLM:
├── Anthropic Chat Model (Claude 3.5 Sonnet/Haiku)
├── AI Agent (Tools Agent, ReAct Agent)
├── Memory Buffer Window (conversation context)
└── Text Classifier / Sentiment Analysis

JIRA:
├── Jira Software (create, update, get, search issues)
├── Jira Software Tool (AI-enabled variant for agents)
└── Jira Trigger (event-driven)

FLOW CONTROL:
├── Switch (multi-path routing)
├── If (binary decisions)
├── Loop Over Items (batch processing)
├── Merge (combine data streams)
├── Wait (delays, scheduling)
└── Execute Workflow (sub-workflows)
```

---

## Jira + Claude AI Workflows

### WF-IDEA-001: Intelligent Ticket Triage

**Purpose**: Auto-categorize and prioritize incoming tickets using Claude

```yaml
name: "Intelligent Ticket Triage"
trigger: Jira Trigger (issue_created)
complexity: Medium

flow:
  1. Jira Trigger: New issue created in any project
     ↓
  2. Extract Fields:
     - summary, description, labels, project key
     ↓
  3. Claude Analysis:
     prompt: |
       Analyze this Jira ticket and return JSON:
       {
         "category": "bug|feature|question|incident|improvement",
         "priority": "critical|high|medium|low",
         "estimated_effort": "xs|s|m|l|xl",
         "suggested_labels": ["label1", "label2"],
         "summary_improved": "clearer summary if needed",
         "routing": "LEARN|GRADE|PULSE|INFRA|BACK|MGMT",
         "reasoning": "brief explanation"
       }

       Ticket:
       Project: {{project}}
       Summary: {{summary}}
       Description: {{description}}
     ↓
  4. Parse JSON Response
     ↓
  5. Switch: Route by category
     ├── bug → Set priority, add "bug" label
     ├── incident → CRITICAL: Alert Discord immediately
     ├── feature → Add to BACK backlog
     └── question → Route to knowledge base check
     ↓
  6. Jira Update: Apply labels, priority, assignee
     ↓
  7. If routing != current project:
     - Move ticket OR create linked ticket in correct project
     ↓
  8. Discord Notification: "Ticket X triaged: {category}, {priority}"

claude_config:
  model: claude-3-haiku (fast, cheap for triage)
  max_tokens: 500
  temperature: 0.3 (consistent categorization)
```

---

### WF-IDEA-002: Trade Review Grading Pipeline

**Purpose**: Arbiter agent grades trades, creates GRADE tickets

```yaml
name: "Trade Review Grading Pipeline"
trigger: Webhook (trade closed) OR Schedule (daily 4:30 PM)
complexity: High

flow:
  1. Trigger: Trade closed event from OpenClaw
     ↓
  2. Fetch Trade Context:
     - Entry/exit prices, duration, P&L
     - Strategy rules from knowledge base
     - Market conditions at entry
     ↓
  3. Claude Arbiter Analysis:
     system_prompt: |
       You are Arbiter, a trading coach who grades trades fairly but firmly.
       Grade on: entry timing, exit execution, risk management, strategy adherence.

     prompt: |
       Grade this trade (A-F with +/- modifiers):

       Trade Details:
       - Symbol: {{symbol}}
       - Direction: {{direction}}
       - Entry: {{entry_price}} at {{entry_time}}
       - Exit: {{exit_price}} at {{exit_time}}
       - P&L: {{pnl}} ({{pnl_percent}}%)
       - Strategy: {{strategy_name}}

       Strategy Rules:
       {{strategy_rules}}

       Market Context:
       - VIX at entry: {{vix}}
       - Trend: {{trend_direction}}

       Return JSON:
       {
         "grade": "B+",
         "score": 85,
         "strengths": ["good entry timing", "proper stop loss"],
         "weaknesses": ["exited too early", "missed trend continuation"],
         "lessons": ["Consider trailing stops for trending markets"],
         "pattern_detected": "premature_exit|perfect_execution|overtrading|etc"
       }
     ↓
  4. Create GRADE Ticket:
     project: GRADE
     summary: "Trade Review: {{symbol}} {{grade}} ({{pnl}})"
     labels: ["trade-review", "grade-{{grade_letter}}"]
     description: Full analysis in ADF format
     ↓
  5. If grade <= C:
     - Add "needs-attention" label
     - Create linked LEARN ticket: "Lesson: {{lesson}}"
     ↓
  6. Update Trade Database: Store grade
     ↓
  7. If pattern_detected is recurring (3+ times):
     - Create INFRA ticket: "Pattern Alert: {{pattern}}"
     - Suggest strategy adjustment

claude_config:
  model: claude-3-5-sonnet (nuanced analysis)
  max_tokens: 1000
  temperature: 0.5
```

---

### WF-IDEA-003: Automated Sprint Planning

**Purpose**: AI reviews backlog and proposes sprint scope

```yaml
name: "AI Sprint Planner"
trigger: Schedule (Every Monday 8 AM) OR Manual
complexity: High

flow:
  1. Fetch All Open Tickets:
     - JQL: "project in (LEARN, GRADE, PULSE, INFRA, BACK) AND status != Done"
     ↓
  2. Fetch Recent Performance:
     - Last sprint velocity
     - Completed vs planned
     - Recurring blockers
     ↓
  3. Claude Sprint Planning:
     prompt: |
       You are a sprint planner for an autonomous trading system.
       Review the backlog and propose a focused sprint.

       Open Tickets ({{count}}):
       {{tickets_summary}}

       Last Sprint:
       - Planned: {{planned_points}}
       - Completed: {{completed_points}}
       - Velocity: {{velocity}}

       Constraints:
       - Max sprint points: {{max_points}}
       - Priority: System stability > Learning > Features

       Return JSON:
       {
         "sprint_name": "Sprint 2026-W12",
         "theme": "brief theme",
         "selected_tickets": ["INFRA-5", "PULSE-3", "LEARN-7"],
         "total_points": 21,
         "rationale": "why these tickets",
         "risks": ["potential blocker"],
         "dependencies": [{"from": "X", "to": "Y"}],
         "stretch_goals": ["BACK-2"]
       }
     ↓
  4. Create MGMT Ticket: "Sprint Planning: {{sprint_name}}"
     - Attach full proposal
     - Add "sync" label
     ↓
  5. For each selected ticket:
     - Add "sprint-{{sprint_name}}" label
     - Set sprint field (if available)
     ↓
  6. Discord Notification:
     - Post sprint summary to #chief
     - Request human approval
     ↓
  7. Wait for Approval (via Jira comment or Discord reaction)
     ↓
  8. On Approval: Activate sprint
     On Rejection: Re-run with feedback

claude_config:
  model: claude-3-5-sonnet
  max_tokens: 2000
```

---

## Autonomous Agent Coordination

### WF-IDEA-004: Multi-Agent Brainstorm Session

**Purpose**: 5 OpenClaw agents discuss a topic, create MGMT decision ticket

```yaml
name: "Multi-Agent Brainstorm"
trigger: MGMT ticket with "brainstorm" label created
complexity: Very High

agents:
  - Chief: Coordinator, final decision maker
  - Arbiter: Analysis and historical context
  - Developer: Technical feasibility
  - Auditor: Risk and compliance
  - Strategist: Long-term vision

flow:
  1. Jira Trigger: MGMT ticket with "brainstorm" label
     ↓
  2. Extract Topic: Parse ticket summary/description
     ↓
  3. PARALLEL: Each agent provides initial perspective
     │
     ├── Claude (Chief persona):
     │   "As Chief, what's the executive summary and key decisions needed?"
     │
     ├── Claude (Arbiter persona):
     │   "As Arbiter, what historical patterns or lessons apply here?"
     │
     ├── Claude (Developer persona):
     │   "As Developer, what's technically feasible and what are the constraints?"
     │
     ├── Claude (Auditor persona):
     │   "As Auditor, what risks exist and what controls are needed?"
     │
     └── Claude (Strategist persona):
         "As Strategist, how does this fit our long-term vision?"
     ↓
  4. Merge: Combine all perspectives
     ↓
  5. Claude (Chief): Synthesize discussion
     prompt: |
       You are Chief. Review these team perspectives and synthesize:

       Arbiter says: {{professor_input}}
       Developer says: {{developer_input}}
       Auditor says: {{auditor_input}}
       Strategist says: {{strategist_input}}

       Provide:
       1. Areas of agreement
       2. Areas of conflict
       3. Open questions
       4. Recommended decision
       5. Next steps
     ↓
  6. Update MGMT Ticket:
     - Add comment: Full brainstorm transcript
     - Add comment: Chief's synthesis
     - Update description: Decision recommendation
     ↓
  7. Create Action Tickets:
     - For each "next step", create linked ticket in appropriate project
     ↓
  8. Discord: Post summary to #chief with decision options

memory:
  - Store brainstorm in vector DB for future reference
  - Link to related past discussions
```

---

### WF-IDEA-005: Ticket Handoff Orchestrator

**Purpose**: When ticket moves between projects, ensure knowledge transfer

```yaml
name: "Cross-Project Ticket Handoff"
trigger: Jira Trigger (issue_updated) when project changes
complexity: Medium

flow:
  1. Jira Trigger: Issue updated
     ↓
  2. Filter: Check if project field changed
     ↓
  3. If project changed:
     - Source project: {{old_project}}
     - Target project: {{new_project}}
     ↓
  4. Fetch Full Context:
     - All comments
     - All attachments
     - Linked issues
     - Activity history
     ↓
  5. Claude Summary:
     prompt: |
       Summarize this ticket for handoff to a new team:

       Original Summary: {{summary}}
       Comments: {{comments}}
       History: {{history}}

       Provide:
       1. Current status (2 sentences)
       2. Key decisions made
       3. Open questions
       4. Recommended next steps for {{new_project}} team
     ↓
  6. Add Handoff Comment:
     "🔄 **Handoff from {{old_project}}**\n\n{{summary}}"
     ↓
  7. Create MGMT Ticket:
     summary: "Handoff: {{ticket_key}} from {{old}} to {{new}}"
     labels: ["knowledge-share", "sync"]
     ↓
  8. Notify Target Team:
     - Discord message to relevant channel
     - @mention assignee if set
```

---

## Self-Healing System Workflows

### WF-IDEA-006: Incident Auto-Response

**Purpose**: Detect incidents, create PULSE tickets, attempt auto-fix

```yaml
name: "Incident Auto-Response"
trigger: Webhook (health check failure) OR PULSE ticket with "incident" label
complexity: High

flow:
  1. Receive Incident Alert:
     - Source: health monitor, agent crash, broker error
     - Severity: critical|high|medium|low
     ↓
  2. Create/Update PULSE Ticket:
     summary: "Incident: {{component}} - {{error_type}}"
     labels: ["incident", "severity-{{severity}}"]
     priority: Based on severity
     ↓
  3. Claude Diagnosis:
     prompt: |
       Analyze this system incident:

       Component: {{component}}
       Error: {{error_message}}
       Timestamp: {{timestamp}}
       Recent logs: {{logs}}

       Return JSON:
       {
         "root_cause_hypothesis": "...",
         "confidence": 0.85,
         "auto_fixable": true,
         "fix_steps": ["restart service", "clear cache"],
         "rollback_steps": ["revert to previous state"],
         "requires_human": false,
         "similar_past_incidents": ["PULSE-42", "PULSE-67"]
       }
     ↓
  4. Switch: Auto-fixable?
     │
     ├── YES + Confidence > 0.7:
     │   ├── Execute fix steps
     │   ├── Wait 60 seconds
     │   ├── Verify fix worked
     │   ├── If fixed: Update ticket "Auto-resolved"
     │   └── If not fixed: Escalate to human
     │
     └── NO or Low Confidence:
         ├── Alert Discord #chief immediately
         ├── Add "needs-attention" label
         └── Create MGMT escalation ticket

  5. Post-Incident:
     - Create LEARN ticket: "Lesson from {{incident}}"
     - Update runbook if new fix discovered
     - Update INFRA if pattern suggests improvement needed
```

---

### WF-IDEA-007: Agent Health Monitor & Recovery

**Purpose**: Monitor all OpenClaw agents, restart if needed

```yaml
name: "Agent Health Monitor"
trigger: Schedule (every 2 minutes)
complexity: Medium

flow:
  1. Fetch Agent Status:
     GET /api/agents → List all agents with last_heartbeat
     ↓
  2. Loop Over Agents:
     For each agent:
     │
     ├── Calculate time since last heartbeat
     │
     ├── Switch: Status
     │   │
     │   ├── Healthy (< 5 min): Skip
     │   │
     │   ├── Stale (5-10 min):
     │   │   └── Create/update PULSE ticket "Agent Stale: {{name}}"
     │   │
     │   ├── Unresponsive (> 10 min):
     │   │   ├── POST /api/control {"command": "restart", "agentId": "X"}
     │   │   ├── Wait 30 seconds
     │   │   ├── Check if recovered
     │   │   └── Update PULSE ticket
     │   │
     │   └── Crash Loop (3+ restarts in 10 min):
     │       ├── STOP attempting restarts
     │       ├── Create CRITICAL PULSE ticket
     │       ├── Alert Discord + Email
     │       └── Create INFRA ticket: "Investigate {{agent}} crash loop"
     ↓
  3. Aggregate Status:
     - Total agents: X
     - Healthy: Y
     - Degraded: Z
     ↓
  4. If any degraded:
     - Update Grafana dashboard
     - Consider system-wide pause if > 50% degraded
```

---

## Intelligence & Learning Workflows

### WF-IDEA-008: Pattern Detection & Learning Loop

**Purpose**: Analyze trade patterns, create LEARN tickets for insights

```yaml
name: "Weekly Pattern Detection"
trigger: Schedule (Sunday 9 PM)
complexity: High

flow:
  1. Fetch Last 4 Weeks of Trades:
     - All closed trades with full context
     - Group by: strategy, time, symbol, outcome
     ↓
  2. Statistical Analysis:
     - Win rate by hour of day
     - Win rate by day of week
     - Win rate by strategy
     - Consecutive loss patterns
     - Best/worst performing setups
     ↓
  3. Claude Pattern Analysis:
     prompt: |
       You are a quantitative analyst. Review this trading data:

       Overall Stats:
       {{overall_stats}}

       By Time:
       {{time_analysis}}

       By Strategy:
       {{strategy_analysis}}

       Identify:
       1. Statistically significant patterns (p < 0.05 or n > 20)
       2. Potential improvements
       3. Strategies to pause/boost
       4. Time windows to avoid/prefer

       Return JSON:
       {
         "patterns": [
           {
             "type": "time_edge",
             "description": "Win rate 73% in first hour, 45% after 2pm",
             "confidence": "high",
             "sample_size": 45,
             "recommendation": "Reduce position size after 2pm"
           }
         ],
         "strategy_adjustments": [...],
         "new_hypotheses": [...]
       }
     ↓
  4. For Each Pattern (confidence >= medium):
     - Create LEARN ticket
     - Label: "pattern" or "hypothesis"
     - Link to supporting trade data
     ↓
  5. For High-Confidence Patterns (existing for 3+ weeks):
     - Mark as "confirmed"
     - Create INFRA ticket to implement rule
     ↓
  6. Weekly Summary:
     - Post to Discord #chief
     - Update Master Tracker
     - Archive to /data/patterns/
```

---

### WF-IDEA-009: Knowledge Base Builder

**Purpose**: Extract lessons from resolved tickets, build searchable knowledge

```yaml
name: "Knowledge Base Builder"
trigger: Jira Trigger (issue moved to Done)
complexity: Medium

flow:
  1. Jira Trigger: Issue status → Done
     ↓
  2. Filter: Has meaningful resolution?
     - Skip if closed as "Won't Do" or "Duplicate"
     ↓
  3. Fetch Full Ticket Context:
     - Description, comments, resolution
     - Linked tickets
     - Time to resolution
     ↓
  4. Claude Knowledge Extraction:
     prompt: |
       Extract knowledge from this resolved ticket:

       Summary: {{summary}}
       Resolution: {{resolution}}
       Comments: {{comments}}

       Return JSON:
       {
         "knowledge_type": "fix|process|insight|decision",
         "title": "brief title for KB article",
         "problem": "what was the problem",
         "solution": "what fixed it",
         "tags": ["tag1", "tag2"],
         "related_topics": ["topic1"],
         "reusable": true,
         "confidence": 0.9
       }
     ↓
  5. If reusable:
     - Create KB entry in vector store
     - Link to original ticket
     ↓
  6. If similar to existing KB entry:
     - Merge or link entries
     - Update frequency count
     ↓
  7. Monthly: Generate KB summary report
     - Most accessed entries
     - Gaps in knowledge
     - Suggested documentation
```

---

## Cross-Project Orchestration

### WF-IDEA-010: The Daily Standup

**Purpose**: AI-generated standup for all projects

```yaml
name: "Automated Daily Standup"
trigger: Schedule (9 AM ET, weekdays)
complexity: Medium

flow:
  1. Fetch Yesterday's Activity:
     - Tickets created, updated, closed
     - Per project breakdown
     ↓
  2. Fetch Today's Priorities:
     - Tickets in current sprint
     - Overdue items
     - Blocked items
     ↓
  3. Claude Standup Report:
     prompt: |
       Generate a daily standup report:

       Yesterday:
       {{yesterday_activity}}

       Today's Focus:
       {{today_priorities}}

       Blockers:
       {{blocked_tickets}}

       Format as:
       ## 📊 Daily Standup - {{date}}

       ### Yesterday
       - Completed: X tickets
       - Key wins: ...

       ### Today
       - Focus: ...
       - Top 3 priorities: ...

       ### Blockers
       - [list or "None"]

       ### Metrics
       - Sprint progress: X%
       - Open incidents: Y
     ↓
  4. Create MGMT Ticket:
     summary: "Standup {{date}}"
     labels: ["standup"]
     ↓
  5. Post to Discord #chief
     ↓
  6. If blockers exist:
     - @mention relevant stakeholders
     - Create linked tickets for blocker resolution
```

---

### WF-IDEA-011: Retrospective Automation

**Purpose**: End-of-sprint retrospective with AI facilitation

```yaml
name: "Sprint Retrospective"
trigger: Manual OR Schedule (Friday 5 PM)
complexity: High

flow:
  1. Gather Sprint Data:
     - All tickets in sprint
     - Completion rate
     - Cycle time per ticket
     - Incidents during sprint
     - Pattern detections
     ↓
  2. Collect Agent Feedback:
     - Query each OpenClaw agent for "sprint thoughts"
     - Aggregate responses
     ↓
  3. Claude Retrospective Facilitation:
     prompt: |
       Facilitate a sprint retrospective:

       Sprint: {{sprint_name}}
       Completion: {{completed}}/{{planned}} ({{percent}}%)

       Ticket Data:
       {{ticket_summary}}

       Agent Feedback:
       {{agent_feedback}}

       Incidents:
       {{incidents}}

       Generate:
       1. What went well (3-5 items)
       2. What could improve (3-5 items)
       3. Action items for next sprint
       4. Kudos (highlight good work)
       5. Process improvements

       Be specific and actionable.
     ↓
  4. Create MGMT Ticket:
     summary: "Retro: {{sprint_name}}"
     labels: ["retro", "sync"]
     ↓
  5. For Each Action Item:
     - Create ticket in appropriate project
     - Link to retro ticket
     ↓
  6. Post to Discord:
     - Full retro summary
     - Request human input on action items
     ↓
  7. Archive:
     - Save to /data/retros/
     - Update performance metrics
```

---

## Implementation Notes

### Claude API Cost Management

```yaml
cost_tiers:
  cheap: # Use Haiku
    - Ticket triage (WF-001)
    - Simple categorization
    - Health checks

  standard: # Use Sonnet
    - Trade grading (WF-002)
    - Pattern analysis (WF-008)
    - Knowledge extraction (WF-009)

  expensive: # Use Sonnet sparingly
    - Multi-agent brainstorms (WF-004)
    - Sprint planning (WF-003)

budget_controls:
  daily_limit: $2.00
  per_workflow_limit: $0.50
  cache_similar_requests: true
  batch_requests_when_possible: true
```

### Jira Node Capabilities Used

```yaml
jira_operations:
  issue:
    - create: New tickets from automation
    - update: Labels, priority, status transitions
    - get: Fetch single ticket details
    - getAll: JQL queries for bulk operations
    - notify: Send email notifications
    - transitions: Change ticket status

  issueComment:
    - add: Post AI analysis as comments
    - getAll: Fetch conversation history

  issueAttachment:
    - add: Attach reports, logs
    - getAll: Fetch attached context

jira_trigger_events:
  - jira:issue_created (new ticket)
  - jira:issue_updated (any change)
  - comment_created (new comment)
  - sprint_started (sprint begins)
  - sprint_closed (sprint ends)
```

### Sub-Workflow Pattern

```yaml
reusable_subworkflows:
  - name: "Claude Analyzer"
    inputs: prompt, model, max_tokens
    outputs: response, tokens_used, cost

  - name: "Jira Ticket Creator"
    inputs: project, summary, description, labels, priority
    outputs: ticket_key, ticket_url

  - name: "Discord Notifier"
    inputs: channel, message, severity, mentions
    outputs: message_id

  - name: "Cost Tracker"
    inputs: workflow_name, api_calls, tokens
    outputs: daily_total, budget_remaining
```

### Error Handling Pattern

```yaml
error_workflow:
  trigger: Error Trigger (any workflow fails)

  flow:
    1. Capture error context
    2. Classify error type
    3. Switch:
       ├── Transient (network, timeout):
       │   └── Retry with backoff
       ├── Rate limit:
       │   └── Queue for later
       ├── Auth failure:
       │   └── Alert + disable workflow
       └── Unknown:
           └── Create PULSE incident ticket
    4. Log to error database
    5. Update metrics
```

---

## Priority Order for Implementation

| Priority | Workflow | Reason |
|----------|----------|--------|
| P1 | WF-IDEA-006: Incident Auto-Response | Foundation for self-healing |
| P1 | WF-IDEA-007: Agent Health Monitor | Keep system running |
| P2 | WF-IDEA-001: Ticket Triage | Reduce manual work |
| P2 | WF-IDEA-010: Daily Standup | Visibility into progress |
| P3 | WF-IDEA-002: Trade Grading | Learning loop |
| P3 | WF-IDEA-008: Pattern Detection | Intelligence |
| P4 | WF-IDEA-003: Sprint Planning | Coordination |
| P4 | WF-IDEA-004: Multi-Agent Brainstorm | Advanced collaboration |
| P5 | WF-IDEA-005: Ticket Handoff | Nice to have |
| P5 | WF-IDEA-009: Knowledge Base | Long-term value |

---

## Next Steps

1. **Connect n8n to Jira** — Set up credentials in n8n UI
2. **Connect n8n to Claude** — Add Anthropic API key
3. **Build WF-IDEA-006 first** — Incident auto-response (foundation)
4. **Test with manual triggers** — Before enabling automation
5. **Monitor costs** — Track Claude API usage carefully

---

*Document created for planning purposes. Implementation requires n8n workflow building.*
