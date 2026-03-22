# Implementation Plan: 100% Autonomous HALO Agent System

## Task Type
- [x] Backend (→ SOUL file updates, scripts)
- [x] Frontend (→ Dashboard monitoring)
- [x] Fullstack (→ End-to-end autonomous operation)

---

## Executive Summary

The 6 HALO agents (Chief, Arbiter, Ops, Hunter, Cortana, Scout) currently suffer from **idle-after-completion syndrome**: they execute their PRIMARY WORKFLOW once, then print variations of:
- "Waiting for CEO direction..."
- "Done with initial sweep. Awaiting next instructions..."
- "Recommendations for next session..."

This plan transforms them into **literal autonomous employees** that:
1. **NEVER stop working** during their shift (6 AM - 11 PM ET)
2. **Create Jira tickets** for blockers instead of just recommending them
3. **Check for new work** via Jira queue and command inbox
4. **Coordinate through actual ticketing** instead of printing suggestions
5. **Heartbeat continuously** so the dashboard knows they're alive
6. **Self-heal** by retrying failed operations

---

## Root Cause Analysis

### Why Agents Stop After One Task

**Problem 1: SOUL files lack a CONTINUOUS LOOP instruction**
Each SOUL.md has excellent workflows but NO explicit "after completion, check for more work" loop.

**Problem 2: Initial prompt says "Begin workflow" but not "Loop forever"**
The launcher prompt is:
```
"You are Chief. Begin your PRIMARY WORKFLOW now. After completing it, enter your CONTINUOUS ENGAGEMENT LOOP."
```
This is vague. Agents interpret "loop" differently.

**Problem 3: No work queue mechanism**
Agents don't know HOW to find new work. They print "awaiting instructions" because there's no inbox to check.

**Problem 4: "Create tickets" is interpreted as "recommend creating tickets"**
SOUL files say "create Jira tickets for blockers" but agents often just PRINT recommendations instead of using the API.

**Problem 5: No heartbeat during "waiting" states**
When agents are between tasks, they go silent. Dashboard marks them as DEAD.

---

## Technical Solution

### Architecture: The Agent Work Loop

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CONTINUOUS WORK LOOP                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌───────────────┐                                                          │
│   │  1. STARTUP   │  - Write heartbeat: "status: starting"                   │
│   │               │  - Log session start                                     │
│   └───────┬───────┘                                                          │
│           ↓                                                                   │
│   ┌───────────────┐                                                          │
│   │ 2. CHECK WORK │  - Query Jira for assigned tickets                       │
│   │               │  - Check command queue                                   │
│   │               │  - Check agent inbox                                     │
│   └───────┬───────┘                                                          │
│           ↓                                                                   │
│   ┌───────────────┐  ┌─────────────────────────────────────────────────┐    │
│   │ 3. EXECUTE    │  │ IF work exists:                                  │    │
│   │    TASK       │  │   - Pick highest priority                        │    │
│   │               │  │   - Execute appropriate workflow                 │    │
│   │               │  │   - Create follow-up tickets if needed           │    │
│   │               │  │   - Mark task complete                           │    │
│   │               │  │ IF no work:                                      │    │
│   │               │  │   - Run PROACTIVE MONITORING (agent-specific)    │    │
│   │               │  │   - Create tickets for anything found            │    │
│   └───────┬───────┘  └─────────────────────────────────────────────────┘    │
│           ↓                                                                   │
│   ┌───────────────┐                                                          │
│   │ 4. HEARTBEAT  │  - Write status JSON                                     │
│   │               │  - Append to heartbeat log                               │
│   │               │  - Update daily log                                      │
│   └───────┬───────┘                                                          │
│           ↓                                                                   │
│   ┌───────────────┐                                                          │
│   │ 5. CHECK STOP │  - STOP file exists? → EXIT                              │
│   │               │  - /stop command received? → EXIT                        │
│   │               │  - Outside shift hours? → SLEEP or EXIT                  │
│   │               │  - Critical error? → LOG and EXIT                        │
│   └───────┬───────┘                                                          │
│           ↓                                                                   │
│   ┌───────────────┐                                                          │
│   │ 6. WAIT 5 MIN │  - Print: "⏳ Cycle N complete. Next in 5m..."           │
│   │               │  - Actually wait 5 minutes                               │
│   └───────┬───────┘                                                          │
│           │                                                                   │
│           └─────────────────────────────→ LOOP BACK TO STEP 2                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Standardized CONTINUOUS LOOP Section

Create a new file `Library/agent-souls/CONTINUOUS_LOOP_TEMPLATE.md` that will be included (conceptually) in all SOUL files:

```markdown
## CONTINUOUS ENGAGEMENT LOOP

**CRITICAL: You are an EMPLOYEE, not a contractor. Do NOT stop after completing one task.**

After completing your Primary or Secondary Workflow, you MUST enter this loop:

### Loop Step 1: Create Tickets for All Blockers and Findings

**DO NOT just print recommendations. CREATE actual Jira tickets.**

For every finding that requires action by another agent:

```bash
# Use the Jira API to create a ticket
curl -X POST http://localhost:3000/api/jira/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "[PROJECT] Description of work needed",
    "description": "Detailed context from your analysis.",
    "assignee": "agent_name",
    "priority": "high|medium|low",
    "labels": ["your-name-created", "category"]
  }'
```

| Finding Type | Ticket Project | Assign To |
|--------------|----------------|-----------|
| Code improvement needed | INFRA | Hunter |
| Pattern detected | LEARN | Cortana |
| Security concern | INFRA | Hunter + Ops |
| Process improvement | MGMT | Chief |
| Feature idea | BACK | Scout |
| Quality issue | GRADE | Arbiter |
| Infrastructure problem | PULSE | Ops |

### Loop Step 2: Check for New Work

After creating tickets, check for work assigned to you:

```bash
# Check your Jira queue
curl "http://localhost:3000/api/jira/tickets?assignee={your_name}&status=To%20Do"

# Check your command inbox
cat data/commands/{your_name}.json 2>/dev/null || echo '{"commands":[]}'

# Check for cross-agent requests in your inbox
cat data/agent-inbox/{your_name}.json 2>/dev/null || echo '{"requests":[]}'
```

**If tickets exist**: Pick the highest priority and execute the appropriate workflow.
**If commands exist**: Process safe commands, log unsafe ones.
**If no work**: Proceed to PROACTIVE MONITORING.

### Loop Step 3: Proactive Monitoring (Agent-Specific)

Even with no assigned work, monitor your domain:

| Agent | Proactive Checks |
|-------|------------------|
| Chief | Check all agents' heartbeats, compile daily status |
| Arbiter | Scan for ungraded trades, open PRs |
| Ops | Run health checks, monitor resource usage |
| Hunter | Code quality scan, dependency audit |
| Cortana | Analyze recent trade patterns |
| Scout | Review backlog for stale items |

Log findings to `data/brain/daily-log.md`.

### Loop Step 4: Write Heartbeat

```bash
# Update status file (overwrite)
echo '{
  "status": "idle",
  "role": "{YOUR_ROLE}",
  "lastActivity": "'$(date -Iseconds)'",
  "currentPhase": "MONITORING",
  "tasksCompleted": N,
  "tasksFailed": N,
  "nextCycleAt": "'$(date -d '+5 minutes' -Iseconds)'"
}' > data/heartbeat-status-{your_name}.json

# Append to heartbeat log
echo '{"timestamp":"'$(date -Iseconds)'","phase":"MONITORING","cycle":N}' >> data/heartbeat-{your_name}.jsonl
```

### Loop Step 5: Check Stop Conditions

You may ONLY stop if:
1. **Killswitch activated**: `.claude/overnight/STOP` file exists
2. **Explicit stop command**: Dashboard sends `/stop {your_name}`
3. **Critical error**: Unrecoverable failure (log error and alert Ops)
4. **Outside shift hours**: Before 6 AM or after 11 PM ET
5. **Context exhaustion**: Received context length warning (exit gracefully)

Before stopping, ALWAYS:
1. Print session summary with metrics
2. Create tickets for any unfinished work
3. Update `data/brain/daily-log.md` with session entry
4. Set status to "offline" in heartbeat file

### Loop Step 6: Wait and Loop

```
⏳ Cycle {N} complete. Waiting 5 minutes before next cycle...
   Next cycle at: {current_time + 5 minutes}
```

After 5 minutes, return to **Loop Step 1**.
```

### Step 2: Update Each SOUL File

Add the CONTINUOUS ENGAGEMENT LOOP section to each of the 6 SOUL files, customized per agent:

#### Changes to CHIEF_SOUL.md:
- Add loop section after Secondary Workflows
- Proactive monitoring: Check all 5 agents' heartbeats, compile status
- Jira creation: Create MGMT tickets for blockers

#### Changes to ARBITER_SOUL.md:
- Add loop section (already partially exists but needs strengthening)
- Proactive monitoring: Scan for ungraded trades (>4h old), pending PRs
- Jira creation: Create INFRA tickets for quality issues

#### Changes to OPS_SOUL.md:
- Add loop section
- Proactive monitoring: Run health checks every cycle
- Jira creation: Create PULSE tickets for issues found

#### Changes to HUNTER_SOUL.md:
- Add loop section
- Proactive monitoring: Code quality scan, `npm audit`
- Jira creation: Create INFRA tickets for tech debt

#### Changes to CORTANA_SOUL.md:
- Add loop section
- Proactive monitoring: Analyze recent trades for patterns
- Jira creation: Create LEARN tickets for hypotheses

#### Changes to SCOUT_SOUL.md:
- Add loop section
- Proactive monitoring: Review backlog for >90-day stale items
- Jira creation: Create BACK tickets for new ideas

### Step 3: Update LAUNCH_AGENTS.ps1 Prompt

Change the initial prompt to be EXPLICIT about looping:

```powershell
$autonomyPrompt = @"
You are $agentName. Your SOUL file has been loaded as system context.

CRITICAL INSTRUCTIONS:
1. Execute your PRIMARY WORKFLOW immediately.
2. After completion, enter your CONTINUOUS ENGAGEMENT LOOP.
3. NEVER STOP WORKING unless a stop condition is met.
4. When you find work for other agents, CREATE JIRA TICKETS - don't just recommend.
5. When you have no assigned work, run PROACTIVE MONITORING.
6. Write heartbeat every cycle so the dashboard knows you're alive.
7. You are an EMPLOYEE on shift from 6 AM to 11 PM ET. Work like it.

PROHIBITED:
- Do NOT say "waiting for CEO direction"
- Do NOT say "recommendations for next session"
- Do NOT ask questions - make decisions autonomously
- Do NOT stop after one task
- Do NOT print "done" and wait

If you ever think you're "done", you're not. Check:
- Your Jira queue
- Your command inbox
- Your monitoring duties

START NOW. Execute PRIMARY WORKFLOW then loop forever.
"@

claude --dangerously-skip-permissions --system-prompt "$soulPath" "$autonomyPrompt"
```

### Step 4: Create Command Queue Infrastructure

Create directories and initial files:

```bash
mkdir -p data/commands
mkdir -p data/agent-inbox

# Create empty command files
echo '{"commands":[]}' > data/commands/chief.json
echo '{"commands":[]}' > data/commands/arbiter.json
echo '{"commands":[]}' > data/commands/ops.json
echo '{"commands":[]}' > data/commands/hunter.json
echo '{"commands":[]}' > data/commands/cortana.json
echo '{"commands":[]}' > data/commands/scout.json

# Create empty inbox files
echo '{"requests":[]}' > data/agent-inbox/chief.json
# ... etc for each agent
```

### Step 5: Update Dashboard to Show Heartbeats

Modify `scripts/activity-bridge.ts` to:
- Read `data/heartbeat-status-{agent}.json` for each agent
- Expose via WebSocket to dashboard
- Show "Next cycle in: Xm Xs" countdown
- Differentiate "idle" (waiting for next cycle) from "dead" (no heartbeat)

### Step 6: Add Shift Schedule Logic

Agents should respect shift hours. Add to SOUL files:

```markdown
## Shift Schedule

**Operating Hours**: 6:00 AM - 11:00 PM ET (Eastern Time)

### Start of Shift
- Check in: Write heartbeat with "status: starting"
- Review overnight activity
- Pick up any urgent tickets

### During Shift
- Execute continuous loop
- Respond to commands within 5 minutes
- Escalate critical issues immediately

### End of Shift
- Write "status: offline" to heartbeat
- Create tickets for any incomplete work
- Log daily summary to `data/brain/daily-log.md`

### Off-Hours (11 PM - 6 AM ET)
- Stop active work
- Only respond to: CRITICAL alerts, killswitch
- Resume automatically at 6 AM
```

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `Library/agent-souls/CHIEF_SOUL.md` | Modify | Add continuous loop section |
| `Library/agent-souls/ARBITER_SOUL.md` | Modify | Strengthen existing loop |
| `Library/agent-souls/OPS_SOUL.md` | Modify | Add continuous loop section |
| `Library/agent-souls/HUNTER_SOUL.md` | Modify | Add continuous loop section |
| `Library/agent-souls/CORTANA_SOUL.md` | Modify | Add continuous loop section |
| `Library/agent-souls/SCOUT_SOUL.md` | Modify | Add continuous loop section |
| `LAUNCH_AGENTS.ps1` | Modify | Update autonomy prompt |
| `data/commands/` | Create | Command queue directory |
| `data/agent-inbox/` | Create | Cross-agent request directory |
| `scripts/activity-bridge.ts` | Modify | Add heartbeat monitoring |

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Agents create duplicate tickets | Check for existing tickets before creating: `GET /api/jira/tickets?summary=...` |
| Infinite API call loops | Add rate limiting, max 60 API calls per cycle |
| Runaway Claude costs | Max turns limit (1000), daily cost monitoring |
| Agents miss stop commands | Check stop conditions at START of each cycle, not just end |
| Context exhaustion | Exit gracefully when context warning received, create checkpoint |
| Shift boundary edge cases | Use server time (ET), not local machine time |
| Agent conflicts | Jira transitions are atomic; first to claim wins |

---

## Success Criteria

After implementation:
1. Launch HALO System → All 6 agents start working within 1 minute
2. No agent prints "waiting for CEO" or "awaiting instructions" EVER
3. Agents create actual Jira tickets for blockers (not recommendations)
4. Dashboard shows all agents with heartbeat status
5. Agents run for 8+ hours without human intervention
6. Each agent completes multiple work cycles per hour
7. Daily log shows continuous activity throughout shift

---

## Estimated Complexity: MEDIUM-HIGH

| Phase | Effort |
|-------|--------|
| SOUL file updates (6 files) | 3-4 hours |
| LAUNCH_AGENTS.ps1 update | 30 minutes |
| Command queue infrastructure | 1 hour |
| Dashboard heartbeat display | 2 hours |
| Testing and iteration | 2-3 hours |
| **Total** | **8-10 hours** |

---

## Iteration Strategy

### Iteration 1: Arbiter Pilot (3 hours)
1. Update ARBITER_SOUL.md with full continuous loop
2. Test with single agent launch
3. Verify: loop works, tickets created, heartbeat written
4. Fix issues discovered

### Iteration 2: Roll Out to All Agents (3 hours)
1. Apply pattern to remaining 5 SOUL files
2. Launch all 6 agents together
3. Monitor for conflicts, resource issues
4. Tune timing and rate limits

### Iteration 3: Dashboard Integration (2 hours)
1. Update activity-bridge for heartbeats
2. Add "next cycle" countdown
3. Add "tickets created this session" metric
4. Verify end-to-end visibility

### Iteration 4: Hardening (2 hours)
1. Add shift schedule enforcement
2. Add cost monitoring
3. Add graceful context exhaustion handling
4. Document runbook for issues

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: N/A (solo plan)
- GEMINI_SESSION: N/A (solo plan)

---

*Plan generated: 2026-03-22*
*Feature: halo-100-percent-autonomy*
