# Management Agents

> **Count**: 6 AI agents managing the autonomous system
> **Platform**: Jira + Discord + Claude Code (formerly OpenClaw)
> **Last Updated**: 2026-03-21

---

## Overview

The SwjshAK system is managed by 6 AI agents, each with specialized responsibilities. Unlike the trading agents (which execute trades), management agents orchestrate, monitor, grade, and improve the system.

**Architecture**: Each agent runs as a Python thread via `scripts/run_improvement_agents.py`, performing autonomous eval→identify→fix→ticket→learn cycles every 2 minutes. Spawned by `agent_runner.ts` as the 7th managed process.

## Agent Hierarchy

```
                    ┌─────────────┐
                    │    JACK     │
                    │    (CEO)    │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │   CHIEF     │
                    │ Orchestrator│
                    └──────┬──────┘
                           │
      ┌────────────┬───────┼───────┬────────────┐
      │            │       │       │            │
┌─────┴─────┐ ┌────┴────┐ ┌┴─────┐ ┌────┴────┐ ┌─────┴─────┐
│    OPS    │ │ HUNTER  │ │ARBITER│ │ CORTANA │ │   SCOUT   │
│  Health   │ │  Infra  │ │Grading│ │ Research│ │ Revenue   │
└───────────┘ └─────────┘ └───────┘ └─────────┘ └───────────┘
```

## Agent Roster

| Agent | Jira Project | Discord Channel | Model | Purpose |
|-------|--------------|-----------------|-------|---------|
| [[Chief Agent]] | MGMT | #chief-announcements | Sonnet 4.6 | Orchestration |
| [[Ops Agent]] | PULSE | #pulse-alerts | Haiku 4.5 | System Health |
| [[Hunter Agent]] | INFRA | #infra-tasks | Haiku 4.5 | Tech Debt |
| [[Arbiter Agent]] | GRADE | #grade-reviews | Haiku 4.5 | Trade Grading |
| [[Cortana Agent]] | LEARN | #learn-patterns | Haiku 4.5 | Research |
| [[Scout Agent]] | BACK | #back-ideas | Haiku 4.5 | Opportunities |

## vs Trading Agents

| Aspect | Management Agents | Trading Agents |
|--------|-------------------|----------------|
| Platform | Jira + Python threads | Python engines |
| Execution | No trade execution | Execute trades |
| Purpose | Monitor, improve, auto-ticket | Generate P&L |
| Count | 6 | 5 |
| Examples | InfraAgent, PulseAgent | Sterling, Boba |
| Key Files | `improvement_agent_base.py`, `run_improvement_agents.py` | `*_engine.py` |

Trading agents are documented separately:
- [[Sterling FX]]
- [[Bitcoin Bob]]
- [[Pivot Pete]]
- [[Boba Trades]]
- [[SPX Sniper]]

## Communication Patterns

### Agent → Agent
```
Hunter finds issue → Creates INFRA ticket →
Cortana researches → Creates LEARN ticket →
Scout implements → Creates BACK ticket →
Chief coordinates
```

### Agent → Human
```
Any agent → Discord channel → Jack reads
Critical alert → @everyone in #pulse-alerts
Decision needed → #approvals with reaction buttons
```

### n8n → Agent
```
Workflow triggers → HTTP POST to OpenClaw gateway →
Agent processes → Response or action
```

## SOUL Files

Each agent has a SOUL.md file defining its identity:

| Agent | SOUL Location |
|-------|---------------|
| Chief | `Library/agent-souls/CHIEF_SOUL.md` |
| Ops | `Library/agent-souls/OPS_SOUL.md` |
| Hunter | `Library/agent-souls/HUNTER_SOUL.md` |
| Arbiter | `Library/agent-souls/ARBITER_SOUL.md` |
| Cortana | `Library/agent-souls/CORTANA_SOUL.md` |
| Scout | `Library/agent-souls/SCOUT_SOUL.md` |

## Autonomous Improvement Loop

Each agent runs this cycle autonomously every 2 minutes:

```
1. EVAL    → Assess current state (code quality, health, learning, etc.)
2. IDENTIFY → Find gaps, issues, or opportunities
3. FIX     → Apply fixes or improvements
4. TICKET  → Create/update Jira ticket with results
5. LEARN   → Extract patterns via /learn, save instincts
```

### Key Files

| File | Purpose |
|------|---------|
| `scripts/improvement_agent_base.py` | Base class with eval→ticket→fix→close cycle |
| `scripts/run_improvement_agents.py` | 6 threaded agents, one per Jira project |
| `scripts/jira_client.py` | Jira REST API client (encrypted creds) |
| `scripts/agent_runner.ts` | Master orchestrator (spawns improvement agents) |
| `skills/project-improvement/surgeon/eval_harness.ts` | Immutable scoring engine |
| `skills/project-improvement/war-room/` | War Room skill files |

### Eval Constraints (4 Immutable Gates)

1. **DATA_FLOW** — Is data flowing smart and actionable?
2. **HEARTBEAT** — Is monitoring/alerting working via Discord?
3. **AGENT_LEARNING** — Are agents autonomously learning?
4. **EFFICIENCY** — Are we cost efficient and self-improving?

## n8n Integration

n8n workflows complement the Jira agents with scheduled automation:

| Agent | Workflows |
|-------|-----------|
| Chief | WF-A02, WF-A03, WF-A04, WF-A06, WF-MGMT-01 |
| Ops | WF-OPS-01, WF-OPS-02, WF-S02 |
| Hunter | WF-INFRA-01, WF-INFRA-02, WF-P02 |
| Arbiter | WF-P01, WF-LEARN-01 |
| Cortana | WF-CORTANA-01, WF-LEARN-01, WF-LEARN-02 |
| Scout | WF-BACK-01 |

## Related Pages

- [[Jira Agent System]]
- [[n8n Automation]]
- [[Agent System]]
- [[Self-Improvement Architecture]]
