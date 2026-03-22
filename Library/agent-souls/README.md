# Agent Souls Directory

This directory contains the SOUL.md files for SwjshAK's autonomous AI agent team. Each file defines an agent's complete personality, operating rules, workflows, and communication protocols.

## The Executive Team

| Agent | Role | Jira Project | SOUL File |
|-------|------|--------------|-----------|
| **Chief** | COO - Coordinates all agents, CEO briefings | MGMT | [CHIEF_SOUL.md](./CHIEF_SOUL.md) |
| **Arbiter** | Quality Auditor - Grades trades, reviews code | GRADE | [ARBITER_SOUL.md](./ARBITER_SOUL.md) |
| **Ops** | SRE - Monitors health, handles incidents | PULSE | [OPS_SOUL.md](./OPS_SOUL.md) |
| **Hunter** | Tech Lead - Implements features, fixes bugs | INFRA | [HUNTER_SOUL.md](./HUNTER_SOUL.md) |
| **Cortana** | Research Analyst - Finds patterns, tests hypotheses | LEARN | [CORTANA_SOUL.md](./CORTANA_SOUL.md) |
| **Scout** | Product Manager - Manages backlog, roadmap | BACK | [SCOUT_SOUL.md](./SCOUT_SOUL.md) |

## Org Chart

```
                    ┌─────────────┐
                    │   CEO       │
                    │   (Jack)    │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │   Chief     │
                    │   (MGMT)    │
                    └──────┬──────┘
                           │
     ┌─────────┬───────────┼───────────┬─────────┐
     │         │           │           │         │
┌────┴────┐ ┌──┴───┐ ┌─────┴─────┐ ┌───┴───┐ ┌───┴────┐
│ Arbiter │ │Cortana│ │    Ops    │ │ Hunter │ │ Scout  │
│ (GRADE) │ │(LEARN)│ │ (PULSE)   │ │ (INFRA)│ │(BACK)  │
└─────────┘ └──────┘ └───────────┘ └─────────┘ └───────┘
```

## SOUL File Structure

Each SOUL.md file contains:

1. **Identity** - Name, emoji, role, mission, personality traits
2. **Core Purpose** - Detailed description of the agent's reason for existing
3. **Operating Rules** - ALWAYS/NEVER rules + edge case handling
4. **Workflow Steps** - Primary and secondary workflows with detailed steps
5. **Communication Protocol** - How to report, escalate, and request help
6. **Jira Integration** - Project key, ticket types, sprint participation
7. **Memory and Learning** - Files read/written, performance tracking
8. **Escalation Matrix** - What to handle alone vs escalate
9. **Example Outputs** - Sample messages, tickets, decisions
10. **Philosophy** - The agent's core beliefs and approach

## How Agents Use SOUL Files

When an agent is instantiated (via OpenClaw or direct LLM invocation), it should:

1. **Read its SOUL.md** - Embody the identity and personality
2. **Follow the operating rules** - ALWAYS and NEVER are non-negotiable
3. **Execute workflows** - Use the detailed steps as guides
4. **Communicate consistently** - Use the established formats and channels
5. **Track its performance** - Update memory files as specified
6. **Respect the escalation matrix** - Know when to handle vs ask for help

## Cross-Agent Communication

Agents communicate via:
- **Jira tickets** - Formal work tracking and requests
- **Discord channels** - Real-time updates and alerts
- **Shared memory files** - `data/brain/*.md` for persistent context

## Key Channels

| Channel | Purpose | Who Posts |
|---------|---------|-----------|
| #ceo-briefing | Daily summaries, approvals | Chief |
| #approvals | Items needing CEO decision | All agents |
| #daily-standup | Agent status updates | All agents |
| #alerts | Critical issues only | Ops |
| #system | Health and deployments | Ops, Hunter |

## Approval Thresholds

| Change Type | Auto-Approve | Chief Approve | CEO Approve |
|-------------|--------------|---------------|-------------|
| Bug fix (<1 hour) | Yes | | |
| Bug fix (1-4 hours) | | Yes | |
| Refactor (any size) | | | Yes |
| New feature | | | Yes |
| Config change | Yes | | |
| Strategy parameter change | | Yes | |
| Security-related | | | Yes |

## Related Documentation

- [AUTONOMOUS_BUSINESS_PLAN.md](../AUTONOMOUS_BUSINESS_PLAN.md) - Overall architecture
- [Master Tracker](../../Brain/Master%20Tracker.md) - Current priorities
- [Agent System](../../Brain/Agent%20System.md) - Technical implementation

---

*These agents exist to make Jack's business run autonomously. They work together, respect the hierarchy, and always prioritize the CEO's vision.*
