# Implementation Plan: HALO Agent Session Longevity

## Problem Statement

HALO agents (6 Claude Code terminals) die prematurely after a few cycles. User wants agents to run autonomously for extended periods (4-8 hours minimum).

## Root Causes Identified

1. **Context Window Exhaustion** - Agents fill context to 95%, auto-compact drops critical state, agents die confused
2. **No --max-turns Limit** - Agents run until context exhaustion instead of graceful exit
3. **No State Checkpointing** - When agents die, no way to resume from last known state
4. **No Context Management in Prompts** - Agents don't know to run `/compact` proactively
5. **Session Resume Doesn't Preserve Flags** - `--continue` loses `--dangerously-skip-permissions`

## Implementation Phases

### Phase 1: Update LAUNCH_AGENTS.ps1 Claude Invocation

Add `--max-turns 480` for ~4 hour sessions with graceful exit:

**File**: `LAUNCH_AGENTS.ps1` line 103

**Current**:
```cmd
claude --dangerously-skip-permissions --system-prompt "$soulPath" "You are $agentName..."
```

**New**:
```cmd
claude --dangerously-skip-permissions --max-turns 480 --system-prompt "$soulPath" "You are $agentName..."
```

---

### Phase 2: Rewrite Agent Initial Prompt

Replace the current simple prompt with a context-aware continuous loop prompt.

**Current Prompt** (line 103):
```
You are $agentName. Your SOUL file has been loaded as system context. Begin your PRIMARY WORKFLOW now. After completing it, enter your CONTINUOUS ENGAGEMENT LOOP. You are an EMPLOYEE, not a contractor - do NOT stop after one task. Create Jira tickets for blockers (don't just recommend). Check for new work. Loop until shift ends or killswitch.
```

**New Prompt**:
```
You are $agentName. Session ID: $sessionId. Your SOUL file is loaded.

=== OPERATIONAL PROTOCOL ===

1. STARTUP: Read data/brain/daily-log.md for last checkpoint. If your session ID appears, resume from that state.

2. PRIMARY WORKFLOW: Execute your SOUL file's primary workflow.

3. CONTINUOUS LOOP (repeat until stop condition):
   a) Check command inbox: data/agent-inbox/$agentName.md
   b) Check Jira for assigned tickets
   c) If work found → Execute → Log completion
   d) If no work → Run proactive monitoring from SOUL
   e) CONTEXT CHECK (every 3 cycles):
      - If context > 70%: /compact "Preserve: agent identity, session ID, current task, next action, all API results"
      - If context > 85%: Write checkpoint → /clear → Reload SOUL → Resume from checkpoint
   f) Write checkpoint to data/brain/daily-log.md
   g) Wait 5 minutes
   h) Loop

4. STOP CONDITIONS (exit gracefully):
   - File exists: .claude/overnight/STOP
   - Command: /stop in inbox
   - Max turns reached (480)
   - Context exhaustion after /compact fails

5. ON EXIT: Write final checkpoint with metrics, print summary to console.

=== BEGIN PRIMARY WORKFLOW NOW ===
```

---

### Phase 3: Add Checkpoint File Structure

Create agent checkpoint system in `data/brain/daily-log.md`.

**Checkpoint Format** (agents append this after each cycle):
```markdown
## Agent Checkpoint
- **Agent**: Arbiter
- **Session**: arbiter-2026-03-22-163000
- **Cycle**: 12
- **Context**: 62%
- **Completed**: GRADE-234, GRADE-235
- **Next**: Check for new GRADE tickets
- **Blockers**: None
- **Timestamp**: 2026-03-22T16:45:00Z
```

---

### Phase 4: Update GUARDRAILS_COMMON.md

Add context management section that all agents inherit.

**File**: `Library/agent-souls/GUARDRAILS_COMMON.md`

**Add Section**:
```markdown
## Context Management Protocol

### Proactive Compaction
- Check context usage every 3 cycles (~15 minutes)
- At 70% context: Run `/compact` with preservation instructions
- At 85% context: Emergency checkpoint → `/clear` → Reload SOUL → Resume

### Preservation Instructions for /compact
"Preserve: agent identity ($AGENT_NAME), session ID, current task state, next planned action, all external API responses, Jira ticket numbers, file paths modified. Discard: verbose reasoning, intermediate search results, duplicate file reads."

### Checkpoint Protocol
After each cycle, append to `data/brain/daily-log.md`:
- Session ID, cycle number, context %
- Work completed this cycle
- Next planned action
- Any blockers

### Graceful Exit
Before exiting (max turns, stop file, or error):
1. Write final checkpoint
2. Print session summary to console
3. Update agent-registry.json status to "offline"
```

---

### Phase 5: Update ~/.claude/settings.json

Add autoCompact configuration for all sessions.

**Add/Update**:
```json
{
  "autoCompact": {
    "enabled": true,
    "trigger": 70,
    "instructions": "Preserve agent identity, session ID, current task, next action, Jira tickets, API results. Discard verbose reasoning and duplicate file reads."
  }
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `LAUNCH_AGENTS.ps1` | Add `--max-turns 480`, rewrite prompt |
| `Library/agent-souls/GUARDRAILS_COMMON.md` | Add context management protocol |
| `~/.claude/settings.json` | Add autoCompact config |
| `data/brain/daily-log.md` | Will receive checkpoint entries |

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Agents still die unexpectedly | Medium | Checkpoint system allows resume |
| Context compaction loses state | Medium | Explicit preservation instructions |
| 480 turns too short | Low | Adjust based on testing |
| Checkpoint file grows large | Low | Rotate daily |

## Testing Plan

1. Launch single agent with new config
2. Monitor for 2 hours, verify:
   - Context stays under 70%
   - Checkpoints appear in daily-log.md
   - Agent runs `/compact` proactively
3. Kill agent manually, restart, verify resume from checkpoint
4. Run full 6-agent system for 8 hours

## Complexity

**Medium** - Prompt engineering + config changes, no new code required

---

**WAITING FOR CONFIRMATION**: Proceed with this plan? (yes/no/modify)
