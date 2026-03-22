# Jira Projects

> **Instance**: https://swjsh.atlassian.net
> **Status**: 6 projects active
> **Last Updated**: 2026-03-20

---

## Project Structure

Each management agent owns a Jira project:

| Project | Key | Owner Agent | Purpose |
|---------|-----|-------------|---------|
| Management | MGMT | Chief | Orchestration, CEO decisions, team coordination |
| Learning | LEARN | Cortana | Research, skill development, pattern investigation |
| Grading | GRADE | Arbiter | Trade reviews, lesson documentation |
| Pulse | PULSE | Ops | System health, incidents, risk monitoring |
| Infrastructure | INFRA | Hunter | Tech debt, bugs, code improvements |
| Backlog | BACK | Scout | Revenue ideas, opportunities, monetization |

## Ticket Types

### Standard Issue Types
- **Task**: General work item
- **Bug**: Defect to fix
- **Story**: Feature or enhancement
- **Epic**: Large initiative (spans multiple tickets)

### Priority Levels
- **P1 (Highest)**: Critical - system down, money at risk
- **P2 (High)**: Important - blocking work, degraded service
- **P3 (Medium)**: Normal - scheduled work
- **P4 (Low)**: Nice-to-have

## Auto-Created Labels

n8n workflows create tickets with these labels:

| Label | Source | Meaning |
|-------|--------|---------|
| `auto-created` | All workflows | Ticket created by automation |
| `tech-debt` | Tech Debt Scanner | Code quality issue |
| `security` | Dependency Auditor | Security vulnerability |
| `stale` | Backlog Groomer | Inactive >7 days |
| `research-idea` | Research Pipeline | Needs investigation |
| `strategy-tune` | Strategy Tuner | Parameter change proposal |
| `lesson-learned` | Lesson Compiler | Trading insight |

## Workflow Automations

### INFRA Project
- **Tech Debt Scanner** (daily 6 AM)
  - Creates tasks for TODO/FIXME/HACK comments
  - Labels: `tech-debt`, `auto-created`
  - Priority based on Claude AI severity assessment

- **Dependency Auditor** (weekly Sunday)
  - Creates bugs for security vulnerabilities
  - Labels: `security`, `auto-created`
  - Priority: P1 for CRITICAL, P2 for HIGH

### PULSE Project
- **Health Aggregator** (every 5 min)
  - Creates incidents when health score <80
  - Labels: `auto-created`
  - Priority: P1 if critical, P2 if degraded

- **Anomaly Detector** (every 15 min)
  - Creates tickets for statistical anomalies
  - Labels: `auto-created`, `anomaly`
  - Priority based on severity

### LEARN Project
- **Lesson Compiler** (Friday 5 PM)
  - Creates weekly summary task
  - Labels: `lesson-learned`, `auto-created`

- **Research Pipeline** (Wednesday 10 AM)
  - Creates research investigation tickets
  - Labels: `research-idea`, `auto-created`

### BACK Project
- **Research Pipeline** (Wednesday 10 AM)
  - Creates implementation opportunity tickets
  - Labels: `research-idea`, `auto-created`

- **Backlog Groomer** (daily 7 AM)
  - Comments on stale tickets
  - Labels: `stale` added to inactive tickets

### MGMT Project
- **Weekly Retrospective** (Friday 6 PM)
  - Creates retrospective summary
  - Labels: `auto-created`

- **Velocity Tracker** (weekly)
  - Updates sprint progress

## API Integration

### Credentials
- **Email**: Stored in `~/.swjsh/jira_config.json`
- **API Token**: Encrypted in `~/.swjsh/jira.enc`
- **Encryption Key**: `~/.swjsh/jira.key`

### n8n Credential Setup
In n8n UI, create "Jira Cloud API" credential:
- Domain: `swjsh.atlassian.net`
- Email: `<your_email>`
- API Token: `<from_atlassian_account>`

### JQL Examples

```sql
-- All auto-created tickets this week
project in (MGMT, LEARN, GRADE, PULSE, INFRA, BACK)
AND labels = "auto-created"
AND created >= startOfWeek()

-- Open tech debt
project = INFRA AND labels = "tech-debt" AND status != Done

-- Stale tickets
project in (MGMT, LEARN, GRADE, PULSE, INFRA, BACK)
AND labels = "stale"

-- Security issues
project = INFRA AND labels = "security" AND status != Done
ORDER BY priority DESC
```

## Project Setup Script

```python
# scripts/jira_setup.py
# Creates all 6 projects with proper configuration
python scripts/jira_setup.py
```

## Related Pages

- [[n8n Automation]]
- [[OpenClaw HQ Setup]]
- [[Self-Improvement Architecture]]
