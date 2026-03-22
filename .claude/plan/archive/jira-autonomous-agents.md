# Implementation Plan: Autonomous Jira Agent System

## Requirements Restatement

Transform the 6 HALO agents (Chief, Arbiter, Ops, Hunter, Cortana, Scout) from passive "awaiting instruction" mode into **autonomous Jira workers** that:

1. Automatically pick up unassigned tickets from their assigned Jira projects
2. Work on tickets autonomously without human intervention
3. Transition tickets through workflow states (To Do → In Progress → Done)
4. Add comments documenting their work
5. Create PRs, run tests, and complete implementations

The full flow should work by double-clicking `C:\Users\jackw\Desktop\HALO SYSTEM.lnk` → Agents spawn → Agents start working autonomously on Jira tickets.

---

## Current State Analysis

### Launch Chain
```
HALO SYSTEM.lnk
  → C:\Users\jackw\Desktop\LAUNCH_HALO.bat (missing - shortcut broken)
  → Should call LAUNCH_HALO_SYSTEM.ps1
    → Starts Dashboard, Activity Bridge, Agent Runner
    → Calls LAUNCH_AGENTS.ps1
      → Spawns 6 Claude terminals with prompts
```

### Current Agent Soul Files
Each agent has a detailed `Library/agent-souls/*_SOUL.md` file with:
- Identity, mission, personality
- Jira project assignment (MGMT, GRADE, PULSE, INFRA, LEARN, BACK)
- Operating rules and workflows
- BUT: **No autonomous Jira pickup instructions**

### Current Prompts in LAUNCH_AGENTS.ps1
The prompts are introductory briefings like:
- "Check the Master Tracker... provide your morning briefing"
- "Run /code-review on recent changes"
- "Check agent heartbeats, verify the Activity Bridge"

**Problem**: These prompts DON'T tell agents to pick up and work Jira tickets autonomously.

### Existing Jira Integration
- `data/jira-agents.json` - Maps agents to Jira projects with auto-pickup config
- `scripts/jira_agent_loop.py` - Python script that picks issues but just prints "handoff to Claude"
- NO integration between the launcher and the Jira loop

---

## Implementation Plan

### Phase 1: Fix the Launcher Chain (Critical)

**1.1 Create missing LAUNCH_HALO.bat**
The shortcut points to a missing file. Create it:
```batch
@echo off
cd /d "%~dp0\SwjshAlgoKnife"
powershell -ExecutionPolicy Bypass -File "LAUNCH_HALO_SYSTEM.ps1"
```

**1.2 Verify LAUNCH_AGENTS.ps1 PowerShell fix works**
- Already fixed: Uses temp scripts instead of inline quotes
- Already fixed: Auto-detects pwsh vs powershell

---

### Phase 2: Add Autonomous Jira Instructions to Agent Souls

**2.1 Create a new section in each SOUL.md: "Autonomous Jira Workflow"**

Add to each agent's soul file a new section that instructs them to:

1. **On Startup**: Query their assigned Jira project for unassigned tickets
2. **Pick Up Work**: Claim the highest-priority unassigned ticket
3. **Execute Work**: Follow their existing workflows to complete the ticket
4. **Transition**: Move ticket through states with comments
5. **Loop**: After completing, pick up next ticket

**2.2 Agent-Specific Jira Instructions**

| Agent | Jira Project | Ticket Types | Autonomous Actions |
|-------|-------------|--------------|-------------------|
| Chief | MGMT | Epic, Initiative, Sync | Coordinate, delegate, create sub-tickets |
| Arbiter | GRADE | Trade, Code, Audit | Review trades, review code, run audits |
| Ops | PULSE | Incident, Alert, Maintenance | Monitor, auto-remediate, run health checks |
| Hunter | INFRA | Bug, Feature, Refactor | Write code, create PRs, fix issues |
| Cortana | LEARN + GRADE | Hypothesis, Insight | Analyze patterns, grade trades |
| Scout | BACK | Idea, Feature, Research | Groom backlog, write specs, prioritize |

---

### Phase 3: Update LAUNCH_AGENTS.ps1 Prompts

Replace the current "introductory briefing" prompts with **autonomous work instructions**:

**New Prompt Template**:
```
You are {AGENT_NAME}, the {ROLE}. Your mission: {MISSION}.

## CRITICAL: AUTONOMOUS JIRA WORKFLOW

You are an autonomous agent. Start working immediately without waiting for human input.

### Step 1: Pick Up Work
1. Query your Jira project ({PROJECT_KEY}) for unassigned tickets:
   - Status: "To Do" or "Selected for Development"
   - Assignee: Empty
   - Priority: Highest first
2. Use the Jira MCP tools or API to fetch tickets
3. Claim the ticket by transitioning to "In Progress" and adding a comment

### Step 2: Execute Work
{AGENT_SPECIFIC_WORK_INSTRUCTIONS}

### Step 3: Complete and Loop
1. When done, transition ticket to "Done"
2. Add a summary comment
3. Create PR if code was changed
4. Pick up the next unassigned ticket
5. LOOP FOREVER until no tickets remain

### If Blocked
- Add a comment explaining the blocker
- Move ticket to "Blocked" or back to "To Do"
- Pick up a different ticket

## START NOW
Begin by querying {PROJECT_KEY} for your first ticket.
```

---

### Phase 4: Integrate Jira Tools

**4.1 Ensure Jira MCP Server is configured**
The agents need access to Jira. Options:
- Use existing `scripts/jira_client.py` via Bash
- Configure a Jira MCP server

**4.2 Add Jira credentials to environment**
Agents need `JIRA_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` available.

---

## Files to Modify

1. **CREATE**: `C:\Users\jackw\Desktop\LAUNCH_HALO.bat`
   - Bridge script that the shortcut calls

2. **MODIFY**: `Library/agent-souls/CHIEF_SOUL.md`
   - Add "Autonomous Jira Workflow" section

3. **MODIFY**: `Library/agent-souls/ARBITER_SOUL.md`
   - Add "Autonomous Jira Workflow" section

4. **MODIFY**: `Library/agent-souls/OPS_SOUL.md`
   - Add "Autonomous Jira Workflow" section

5. **MODIFY**: `Library/agent-souls/HUNTER_SOUL.md`
   - Add "Autonomous Jira Workflow" section

6. **MODIFY**: `Library/agent-souls/CORTANA_SOUL.md`
   - Add "Autonomous Jira Workflow" section

7. **MODIFY**: `Library/agent-souls/SCOUT_SOUL.md`
   - Add "Autonomous Jira Workflow" section

8. **MODIFY**: `LAUNCH_AGENTS.ps1`
   - Update prompts to include autonomous Jira instructions
   - Load agent instructions from SOUL files

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Agents pick up same ticket simultaneously | Jira's assign + status transition is atomic |
| Infinite loop if agent can't complete work | Add max iteration count, timeout logic |
| Jira API rate limits | Add delays between API calls |
| Agents lose context on complex tickets | Use `/checkpoint` to save progress |
| Bad code gets merged | Require Arbiter review before merge |

---

## Complexity Assessment

**Overall: MEDIUM-HIGH**

- Phase 1: LOW (simple bat file)
- Phase 2: MEDIUM (careful soul file updates)
- Phase 3: MEDIUM (prompt engineering)
- Phase 4: LOW (env vars already exist)

---

## Dependencies

- Jira credentials in environment (`JIRA_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`)
- Claude Code CLI installed and in PATH
- Windows Terminal installed (for wt command)
- PowerShell available (pwsh or powershell)

---

## Success Criteria

After implementation:
1. Double-clicking `HALO SYSTEM.lnk` launches 6 agent terminals
2. Each agent immediately queries their Jira project
3. Agents claim and work on tickets autonomously
4. Tickets move through workflow states
5. Code changes result in PRs
6. Agents loop to pick up next ticket after completing one

---

**WAITING FOR CONFIRMATION**: Proceed with this plan? (yes/no/modify)
