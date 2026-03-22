# Implementation Plan: Agent Continuous Engagement Loop

## Problem Statement

Agents currently:
1. Execute their PRIMARY WORKFLOW once
2. Print a summary
3. Stop and become "UNRESPONSIVE"

They should:
1. Execute their PRIMARY WORKFLOW
2. Check for new work (Jira tickets, blockers, requests from other agents)
3. If blockers exist → CREATE Jira tickets (not just recommend)
4. Loop back to step 1 after a configurable interval
5. Only stop when explicitly told to or when shift ends

---

## Requirements

### R1: Agents Must Create Tickets for Blockers
When Arbiter finds "Python engines lack unit tests", he should:
- Create a Jira ticket: `INFRA-XX: Add unit tests for Python engines`
- Assign it to Hunter (the appropriate agent)
- NOT just print "Hunter should do this"

### R2: Agents Must Check for Work Continuously
After completing a task, agents should:
- Poll Jira for tickets assigned to them
- Poll command queue for dashboard commands
- Check for cross-agent requests (e.g., Cortana flagged a pattern)
- Wait for a configurable interval (e.g., 5 minutes)
- Resume work

### R3: Agents Must Coordinate Through Jira
Instead of printing "recommendations for next session":
- Create actual Jira tickets with proper assignees
- Link tickets to parent epics
- Track blockers with `blocked-by` relationships

### R4: Agents Must Have a "Shift" Concept
- Define shift hours (e.g., 9am-5pm)
- Outside shift: agents sleep but can be woken for critical alerts
- During shift: continuous engagement loop

---

## Technical Solution

### Phase 1: Update SOUL Files with Loop Instruction

Add to each SOUL file's PRIMARY WORKFLOW:

```markdown
## CONTINUOUS ENGAGEMENT LOOP

After completing your primary task:

1. **Create Tickets for Blockers**
   - If you identify work for another agent, create a Jira ticket
   - Use: `POST /api/jira/tickets` with assignee, summary, priority
   - Do NOT just print recommendations

2. **Check for New Work**
   - Fetch your Jira tickets: `GET /api/jira/tickets?assignee={your_name}`
   - If tickets exist with status "To Do", pick the highest priority and work it
   - If no tickets, proceed to monitoring

3. **Monitor Your Domain**
   - Run your SECONDARY WORKFLOW (monitoring/health checks)
   - Log findings to data/brain/daily-log.md

4. **Wait and Loop**
   - Print: "⏳ Waiting 5 minutes before next cycle..."
   - After 5 minutes, return to step 1

5. **Stop Conditions**
   - Only stop if: killswitch activated, explicit "/stop" command, or critical error
   - Print session summary before stopping
```

### Phase 2: Add Jira Ticket Creation Endpoint

**File**: `src/app/api/jira/tickets/route.ts` (already exists)

Ensure POST supports:
```typescript
interface CreateTicketRequest {
  summary: string;
  description: string;
  assignee: 'chief' | 'hunter' | 'ops' | 'scout' | 'arbiter' | 'cortana';
  priority: 'highest' | 'high' | 'medium' | 'low';
  labels?: string[];
  blockedBy?: string[]; // Jira ticket keys
}
```

### Phase 3: Update Launch Script with Loop Flag

**File**: `LAUNCH_AGENTS.ps1`

Change prompt to include loop instruction:

```powershell
$prompt = "You are $agentName. Your SOUL file has been loaded. " +
          "Execute your PRIMARY WORKFLOW, then enter your CONTINUOUS ENGAGEMENT LOOP. " +
          "Do NOT stop after one task. You are an employee, not a contractor."
```

### Phase 4: Add Heartbeat Keepalive

**File**: `scripts/activity-bridge.ts`

When an agent's heartbeat goes stale but they're in a "waiting" state (not dead):
- Mark status as `waiting_next_cycle` instead of `unresponsive`
- Display differently in UI (yellow pulsing, not red)

### Phase 5: Cross-Agent Communication Queue

**File**: `data/agent-inbox/{agent}.json`

Agents can send requests to each other:
```json
{
  "from": "arbiter",
  "to": "hunter",
  "type": "work_request",
  "message": "Create unit tests for BaseAgent circuit breaker",
  "priority": "high",
  "created": "2026-03-22T10:00:00Z"
}
```

Agents check their inbox at the start of each loop cycle.

---

## Implementation Steps

### Step 1: Update ARBITER_SOUL.md (Pilot Agent)
1. Add CONTINUOUS ENGAGEMENT LOOP section
2. Add instruction to CREATE tickets, not recommend them
3. Add explicit loop-back behavior

### Step 2: Update Jira API
1. Ensure POST endpoint works for agent-created tickets
2. Add `created_by` field to track which agent created which ticket
3. Validate assignee against known agent names

### Step 3: Update LAUNCH_AGENTS.ps1
1. Add loop instruction to initial prompt
2. Consider adding `--max-turns 1000` to allow long-running sessions

### Step 4: Update Dashboard UI
1. Differentiate "waiting_next_cycle" from "unresponsive"
2. Show "Next cycle in: 4m 32s" countdown
3. Add "Tickets Created This Session" metric

### Step 5: Roll Out to All Agents
1. Test with Arbiter first
2. If successful, update remaining 5 SOUL files
3. Monitor for infinite loops or runaway costs

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `Library/agent-souls/ARBITER_SOUL.md` | Modify | Add continuous loop section |
| `Library/agent-souls/*.md` | Modify | Roll out to all agents |
| `LAUNCH_AGENTS.ps1` | Modify | Add loop instruction to prompt |
| `src/app/api/jira/tickets/route.ts` | Verify | Ensure POST works for agents |
| `scripts/activity-bridge.ts` | Modify | Add waiting_next_cycle status |
| `src/hooks/useActivityFeed.ts` | Modify | Handle new status type |

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Infinite loop / runaway API costs | Add max turns limit (1000), add cost monitoring |
| Agents create duplicate tickets | Check for existing tickets before creating |
| Agents block each other with circular work requests | Add cycle detection in inbox processing |
| Long-running Claude sessions become expensive | Consider cheaper model for monitoring phases |

---

## Success Criteria

1. Arbiter completes work → creates Jira ticket → waits 5 min → checks for new work → loops
2. Dashboard shows "waiting_next_cycle" instead of "unresponsive"
3. No manual intervention required for 8-hour shift
4. Tickets created by agents appear in Jira with correct assignees

---

## Estimated Complexity: MEDIUM

- SOUL file updates: 1-2 hours
- API verification: 30 minutes
- Dashboard status: 1 hour
- Testing with Arbiter: 1-2 hours
- Rollout to all agents: 1 hour

**Total: 5-7 hours**
