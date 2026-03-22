# Deep Research: Jira Agent System

## Research Objective
Comprehensive analysis of the Jira ticket flow, agent management, inter-agent communication, reporting mechanisms, and how agents operate as "employees" within the Jira ecosystem.

---

## Executive Summary

SwjshAK employs a sophisticated **multi-agent autonomous system** that treats 6 AI agents as corporate employees, each with:
- A defined **role and personality** (SOUL files)
- An assigned **Jira project** they own
- **Autonomous workflows** triggered by ticket availability
- **Inter-agent communication** via Jira comments, Activity Feed, and Discord
- **Self-learning capabilities** that compound improvements over time

The system is architecturally sound but has several implementation gaps that prevent full autonomy.

---

## Part 1: The 7 Jira Projects

| Project Key | Name | Owner Agent | Purpose | Auto-Pickup |
|-------------|------|-------------|---------|-------------|
| **SCRUM** | SwjshAK Core | Ops | Sprint work, feature development | Yes (P1) |
| **INFRA** | Infrastructure | Hunter | Tech debt, bugs, automation | Yes (P2) |
| **PULSE** | System Heartbeat | Arbiter | Health monitoring, incidents | Yes (P3) |
| **BACK** | Product Backlog | Scout | Research, ideas, roadmap | Yes (P4) |
| **LEARN** | OpenClaw Learning | Cortana | Pattern aggregation, research | No (P5) |
| **GRADE** | Trade Grading | Cortana | Trade reviews, audits | No (P6) |
| **MGMT** | Management Hub | Chief | Cross-project coordination | No (P99) |

### Priority System
- `autoPickup: true` projects are cycled through automatically
- Priority determines order: SCRUM → INFRA → PULSE → BACK
- Manual projects (LEARN, GRADE, MGMT) require explicit ticket assignment

---

## Part 2: Agent Personas ("Employees")

### The 6 Halo Crew Agents

| Agent | Role Title | Personality Archetype | Communication Style |
|-------|------------|----------------------|---------------------|
| **Chief** | COO | Decisive, diplomatic, systematic | "Here's my recommendation..." |
| **Ops** | SRE Guardian | Vigilant, calm under pressure | "Systems nominal." / "Incident detected." |
| **Hunter** | Tech Lead | Methodical, quality-obsessed | "Here's my proposal..." |
| **Arbiter** | Quality Auditor | Analytical, critical but constructive | "Grade: B. Here's why..." |
| **Cortana** | Research Analyst | Curious, rigorous, patient | "The data suggests..." |
| **Scout** | Product Manager | Strategic, pragmatic, decisive | "The highest-impact item is..." |

### Soul File Structure
Each agent has a comprehensive SOUL.md file (~700-800 lines) containing:
1. **Identity** - Name, emoji, role title, Jira project ownership
2. **Personality Traits** - 5-6 defining characteristics
3. **Communication Style** - Tone, format, signature phrases
4. **Core Purpose** - Mission statement and value proposition
5. **Operating Rules** - 12-14 ALWAYS rules, 10-12 NEVER rules
6. **Workflow Steps** - Primary + Secondary workflows with step-by-step instructions
7. **Communication Protocol** - How to report to Chief, escalate to CEO
8. **Jira Integration** - Ticket types, processing rules, sprint participation
9. **Memory and Learning** - Files read/written, performance tracking
10. **Escalation Matrix** - Handle alone vs escalate criteria
11. **ECC Skills Integration** - Assigned Claude Code skills
12. **Autonomous Jira Workflow** - On-startup behavior (the critical piece)

---

## Part 3: Ticket Lifecycle

### Phase 1: DISCOVER
```
JQL Query:
  project = {PROJECT_KEY}
  AND status IN ('To Do', 'Selected for Development')
  AND assignee IS EMPTY
  ORDER BY priority DESC, created ASC
```

**Discovery Logic** (from `jira_agent_loop.py`):
1. Query project with JQL
2. Filter by: status IN ('To Do', 'Selected for Development')
3. Filter by: assignee IS EMPTY
4. Exclude labels (e.g., 'blocked', 'needs-design')
5. Filter by: issue_types (Task, Bug, Story, etc.)
6. Pick first by: priority DESC, created ASC

### Phase 2: CLAIM
```
1. Transition ticket to "In Progress"
2. Add comment: "Agent {NAME} picking up this ticket."
   - Timestamp: {ISO8601}
   - Mode: Autonomous
3. Save state to jira-loop-state.json
```

### Phase 3-6: EXECUTE
```
1. /orchestrate feature "{summary}"
2. Implement solution following SOUL workflow
3. Run /verify (build + lint + test)
4. Create PR with comprehensive description
5. Respond to code review feedback
```

### Phase 7: COMPLETE
```
1. Transition ticket to "Done"
2. Add completion comment with summary
3. Run /learn to extract patterns
4. Update Master Tracker if applicable
5. Notify Discord via haloPersona
```

### Phase 8: LOOP
```
1. Save completion count to jira-loop-state.json
2. Immediately query for next unassigned ticket
3. If no tickets: Run default workflow (health check, backlog grooming, etc.)
```

---

## Part 4: Inter-Agent Communication

### 4.1 Via Jira Comments
- **Primary mechanism**: Agents leave comments on tickets
- **Cross-project coordination**: Scout recommends → Chief creates SCRUM ticket → Ops implements → Hunter fixes infra issue
- **Blocking/unblocking**: Agents comment when blocked, tag other agents

**Example Flow**:
```
Scout picks up: BACK-42 "Analyze profitability"
  ├─ Executes analysis
  ├─ Comments: "Recommends SCRUM sprint for feature X"
  └─ Transitions to Done

Chief reads BACK-42
  ├─ Sees recommendation
  ├─ Creates: SCRUM-50 "Implement feature X"
  └─ Auto-picked by Ops (via autoPickup)

Ops picks up: SCRUM-50
  ├─ Comments: "Blocked on infrastructure upgrade INFRA-99"
  └─ Pauses (status = blocked)

Hunter sees: SCRUM-50 blocked by INFRA-99
  ├─ Prioritizes INFRA-99
  ├─ Completes infrastructure upgrade
  └─ Comments: "Ready for Ops to resume SCRUM-50"
```

### 4.2 Via Activity Feed
**Central hub**: `data/activity-feed.json`
**API Endpoints**:
- `POST /api/activity/agents` - Signal status change
- `GET /api/activity/agents?status=online` - Query peer status

**Status Model**:
```typescript
interface TrackedAgent {
  name: string;  // "Chief", "Arbiter", etc.
  status: 'online' | 'offline' | 'busy' | 'error';
  lastSeen: ISO8601;
  currentTask?: string;
  actionsToday: number;
}
```

**Timeout Rules**:
- 5 min without activity = offline
- 2 min without update while busy = back to online/offline

### 4.3 Via Discord (Planned)
**Each agent has a `haloPersona`** mapping to Discord channel:
- `ops` → `#pulse-alerts`
- `hunter` → `#infra-tasks`
- `arbiter` → `#grade-reviews`
- `cortana` → `#learn-patterns`
- `scout` → `#back-ideas`
- `chief` → `#chief-announcements`

**Current Status**: `notify_discord()` only prints to stdout (placeholder)

### 4.4 Via JSON Config Coordination
`data/jira-agents.json` defines:
- Agent priorities (who picks up first)
- Issue types per project
- Exclude labels (tickets to skip)
- Maximum concurrent issues
- Auto-transition settings

---

## Part 5: Reporting Mechanisms

### 5.1 Loop State Persistence
**File**: `data/jira-loop-state.json`
```json
{
  "running": true,
  "currentProject": "SCRUM",
  "currentIssue": "SCRUM-9",
  "iterationCount": 1,
  "issuesCompleted": 0,
  "skillsLearned": 0,
  "lastActivity": "2026-03-22T00:51:50.088340",
  "errors": []
}
```

### 5.2 Agent Database
**File**: `agents_db.json`
- Contains: status, performance metrics, active/closed trades, reviews, audits
- Managed by: `scripts/agent_runner.ts`
- Exposed via: `/api/agents`

### 5.3 Brain Files
Each agent reads/writes to specific brain files:

| Agent | Reads | Writes |
|-------|-------|--------|
| Chief | Master Tracker, Daily Log, agents_db.json | Master Tracker, decisions-log.md |
| Ops | agents_db.json, health_status.json | incident-memory.md, runbooks/*.md |
| Hunter | Entire codebase, test files | code-evolution.md, refactor-log.md |
| Arbiter | agents_db.json, strategy docs | quality-memory.md, agents_db.json (reviews) |
| Cortana | trades database, Arbiter grades | pattern-memory.md, learning-log.md |
| Scout | Master Tracker, all agent reports | backlog-memory.md, roadmap.md |

### 5.4 Daily Standup Reports
Each agent posts to `#daily-standup` with structured format:
- Chief: Morning briefing (8:00 AM ET)
- Ops: Health report (continuous)
- Hunter: Implementation progress
- Arbiter: Grade distribution
- Cortana: Hypothesis updates
- Scout: Backlog health

---

## Part 6: Self-Learning Loop

```
1. Agent picks up issue from Jira
2. Plans implementation (using ECC skills)
3. Executes via /orchestrate
4. Verifies (build, tests, lint)
5. Creates PR (with security review)
6. Runs /learn to extract patterns
7. Reports completion to Jira + Discord
8. Patterns aggregate in LEARN project
9. Weekly /evolve generates skills
10. Skills shared across all agents
```

### Pattern → Skill Pipeline
- Cortana detects statistical pattern in trades
- Creates [HYPOTHESIS] ticket in LEARN
- Tracks until p < 0.05 with sufficient samples
- Marks [CONFIRMED] when significant
- Creates implementation proposal
- Hunter implements via INFRA ticket
- Strategy documentation updated
- All agents benefit from new pattern

---

## Part 7: Safety Controls

### Kill Switch
- `POST /api/killswitch` - Emergency halt
- `@Arbiter killswitch` in Discord
- All trading agents stop immediately
- Requires explicit reset to resume

### Cost Limits
- Max 100 iterations per session
- Max $50/day cost limit for Claude API

### Approval Gates
**Always require CEO approval**:
- Database migrations
- Breaking changes
- Security-sensitive changes
- New feature development
- Refactors > 4 hours
- Any work affecting trading logic

### Quality Gates
Each PR must pass:
1. `/code-review` skill (ECC)
2. Language-specific reviewer (python-reviewer, typescript-reviewer)
3. `/verify` (build + lint + test)
4. `/security-review` (for sensitive code)
5. Test coverage ≥ 80%

---

## Part 8: Implementation Gaps

### Critical Issues

1. **Agent Souls NOT Linked to Jira at Runtime**
   - Soul files exist with detailed instructions
   - BUT: Launch scripts don't pass soul context to Claude sessions
   - Missing: "On startup, query your Jira project for unassigned tickets"

2. **Launch Chain Broken**
   - `LAUNCH_HALO_SYSTEM.ps1` references missing files
   - Agent prompts are "briefing only", not "autonomous work instructions"
   - No mechanism to inject SOUL.md content into Claude session

3. **Discord Integration Incomplete**
   - `notify_discord()` only prints to stdout
   - Missing: Actual Discord API calls
   - Missing: `src/lib/discord/halo-bots.ts` implementation

4. **n8n Webhooks Not Wired**
   - 18 n8n workflows deployed but not triggering
   - Jira webhook → n8n flow → Agent not connected
   - Need: n8n API key configuration

5. **No Continuous Loop Mechanism**
   - `jira_agent_loop.py` runs once and stops
   - Missing: Scheduled task or daemon to keep agents running
   - OpenClaw was intended executor but is being phased out

### Medium Issues

6. **Credential Management Fragile**
   - Fernet encryption keys stored in `~/.swjsh/`
   - No key rotation mechanism
   - No backup strategy

7. **State Persistence Gaps**
   - `jira-loop-state.json` doesn't track per-agent state
   - No mechanism to resume interrupted work
   - No distributed locking for concurrent agents

8. **Monitoring Limited**
   - Health checks are passive (polling)
   - No proactive alerting infrastructure
   - Jira health check has 5-minute cache

---

## Part 9: Making Agents "Feel Like Employees"

### Current State vs Ideal State

| Aspect | Current | Ideal |
|--------|---------|-------|
| **Startup** | Manual, briefing-only | Auto-query Jira on startup |
| **Work Pickup** | Script invocation | Continuous polling loop |
| **Communication** | Jira comments only | Jira + Discord + Activity Feed |
| **Reporting** | Manual updates | Auto-standup at scheduled times |
| **Learning** | /learn command | Auto-capture patterns |
| **Collaboration** | Explicit handoffs | Implicit coordination via queue |

### Recommendations for "Employee" Behavior

1. **Always-On Daemon Mode**
   - Each agent runs as persistent process
   - Polls Jira every 60 seconds for new work
   - Respects business hours (optional)

2. **Morning Standup Automation**
   - Chief queries all agents at 7:30 AM
   - Each agent auto-posts status
   - CEO briefing at 8:00 AM

3. **Work Hours Configuration**
   - Agents only pick up work during configured hours
   - Emergency escalation bypasses hours
   - Weekend mode (monitoring only)

4. **Peer Awareness**
   - Agents check Activity Feed before claiming work
   - Don't claim if another agent is already on it
   - Coordinate via comments for blocked work

5. **Personality Injection**
   - Each message uses signature phrases from SOUL
   - Consistent tone across all communications
   - Quips/personality in Discord notifications

6. **Career Growth (Meta)**
   - Track agent performance metrics
   - "Promote" agents to harder work after success
   - "Train" agents on new ECC skills

---

## Part 10: Technical Architecture

### Data Flow
```
Jira Cloud API
    ↓
scripts/jira_client.py (REST wrapper)
    ↓
scripts/jira_agent_loop.py (Loop orchestrator)
    ↓
data/jira-loop-state.json (State persistence)
    ↓
Claude Code Session (via SOUL.md context)
    ↓
/orchestrate, /verify, /learn (ECC skills)
    ↓
PR Creation → GitHub → Arbiter Review → Merge
    ↓
Jira Transition → Done
    ↓
Discord Notification (via haloPersona)
    ↓
Activity Feed Update
    ↓
Loop continues...
```

### Key Files

| File | Purpose |
|------|---------|
| `scripts/jira_client.py` | REST API client (requests + Fernet auth) |
| `scripts/jira_creds.py` | Credential encryption/decryption |
| `scripts/jira_agent_loop.py` | Autonomous loop runner |
| `data/jira-agents.json` | Agent-project mappings |
| `data/jira-loop-state.json` | Current loop state |
| `src/app/api/jira/tickets/route.ts` | Ticket CRUD API |
| `src/app/api/jira/loop/route.ts` | Loop control API |
| `src/lib/jiraHealth.ts` | Health check (5-min cache) |
| `Library/agent-souls/*.md` | Agent personality files |

---

## Part 11: Recommended Next Steps

### Immediate (This Week)
1. ✅ **Fix Launch Chain**: Updated `LAUNCH_AGENTS.ps1` to:
   - Use interactive mode (removed `-p` flag)
   - Inject SOUL content via `--system-prompt`
   - Create unique session IDs for each launch
   - Use new WT window to avoid interfering with existing sessions
   - **STATUS: FIXED on 2026-03-22**

2. **Implement Continuous Loop**: Add scheduled task or PM2 restart policy
   - Agents now STAY in interactive session after initial task
   - Can be given more work by typing in the terminal
   - For true autonomous looping, consider PM2 with `--cron-restart`

3. **Wire Discord Notifications**: Complete `notify_discord()` implementation

### Short-Term (This Month)
4. **Activity Feed Integration**: Agents post status on pickup/complete
5. **Health Monitoring**: Proactive alerts when agents go stale
6. **n8n Webhook Activation**: Configure credentials, activate workflows

### Medium-Term (Next Quarter)
7. **Distributed Locking**: Prevent concurrent ticket claims
8. **State Recovery**: Resume interrupted work on restart
9. **Performance Dashboard**: Agent metrics visualization

---

## Conclusion

The SwjshAK Jira agent system has a **sophisticated conceptual design** with detailed agent personas, clear ownership boundaries, and well-defined workflows. The SOUL files provide exceptional depth for agent behavior.

~~However, the **execution infrastructure is incomplete**:~~
~~- Agents can't actually start autonomously~~
~~- Discord integration is stubbed~~
~~- n8n workflows aren't triggered~~
~~- No continuous loop mechanism exists~~

**UPDATE (2026-03-22)**: The launch chain has been fixed:
- Agents now start in INTERACTIVE mode (stay in session)
- SOUL files are injected via `--system-prompt`
- Each launch creates a unique WT window (won't interfere with other Claude sessions)
- Remaining gaps: Discord integration, n8n webhooks, true autonomous looping

~~The gap between "documented behavior" and "actual capability" is the primary blocker to achieving the vision of agents that "feel like employees."~~

**Priority 1**: ✅ FIXED - Launch chain now injects SOUL context and keeps agents in interactive session.
**Priority 2**: Complete Discord notifications for team presence.
**Priority 3**: Add scheduled automation (Windows Scheduled Tasks or PM2 cron) for true autonomous looping.

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: Not applicable (research-only task)
- GEMINI_SESSION: Not applicable (research-only task)

---

*Research completed: 2026-03-22*
*Scope: Deep analysis of Jira agent system architecture and implementation*
