# Lessons Learned - HALO Agent Launcher

## Session: 2026-03-22

### Failure 1: Windows Terminal argument parsing
**Problem**: Passed arguments as array to `Start-Process wt`, title "HALO: Scout" split incorrectly
**Error**: `error 2147942402 when launching 'Scout -d C:\...'`
**Fix**: Build single string with embedded quotes instead of array
**Lesson**: Windows Terminal needs properly quoted strings, not PowerShell arrays

### Failure 2: Reserved variable `$pid`
**Problem**: Used `$pid` as variable name in netstat parsing
**Error**: Red errors, script crashed
**Fix**: Renamed to `$procId`
**Lesson**: `$pid` is a reserved PowerShell automatic variable (current process ID)

### Failure 3: Killing all Node processes
**Problem**: `Get-Process node | Stop-Process` killed ALL node processes including Claude sessions
**Fix**: Only kill processes on ports 3000/3001
**Lesson**: Claude Code runs on Node.js - never blanket-kill node processes

### Failure 4: Multi-line prompts in PowerShell -Command
**Problem**: Multi-line here-strings passed to `powershell -Command` were parsed as code
**Error**: `Unexpected token 'Query' in expression or statement`
**Fix**: Use single-line prompts
**Lesson**: `-Command` parameter parses its argument as PowerShell code, newlines = new statements

### Failure 5: CLI commands in prompts get mangled
**Problem**: `--status "To Do"` passed through PowerShell escaping lost its quotes
**Error**: `unknown option '--status'` (args got split wrong)
**Fix**: Don't embed CLI commands in prompts - let agent read soul file for commands
**Lesson**: Keep prompts simple, put detailed instructions in files agent can read

### Failure 6: Agents ask questions instead of working
**Problem**: Claude asked user a question instead of working autonomously
**Error**: Agent paused waiting for user input
**Fix**: Add explicit "Do NOT ask questions" to prompt
**Lesson**: Claude defaults to asking clarifying questions - must override this behavior

### Failure 7: Only 3/6 agents spawn successfully
**Problem**: Some Windows Terminal tabs don't spawn or crash immediately
**Error**: Agents show as "dead" in heartbeat - never started
**Fix**:
1. Increase delay between spawns to 2 seconds
2. Use temp .ps1 files instead of inline -Command (more reliable)
3. Use single quotes in scripts to avoid escaping issues
**Lesson**: Temp script files are more reliable than inline commands for complex args

---

## Session: 2026-03-22 (Part 2) - MAJOR FIX: Agents Now Stay Alive

### Achievement: Agents persist in interactive Claude sessions

**Before**: Agents would run one task, output results, then EXIT to PowerShell prompt
**After**: Agents stay in interactive Claude session, ready for more work

---

### Root Cause: The `-p` Flag Kills Sessions

**Problem**: Using `claude -p "prompt"` runs Claude in "print and exit" mode
```powershell
# BROKEN - exits immediately after one response
claude -p "You are CHIEF. Read SOUL file and execute..."
```

**Fix**: Remove `-p` flag for interactive mode, use `--system-prompt` for SOUL injection
```powershell
# WORKING - stays in interactive session
claude --dangerously-skip-permissions --system-prompt "$soulPath" "Begin workflow"
```

**Key Insight**: The `-p` flag is designed for piped/scripted one-shot usage. For persistent agents, you need interactive mode (no `-p`).

---

### Key Change 1: Interactive Mode (No `-p` Flag)

| Flag | Behavior | Use Case |
|------|----------|----------|
| `claude -p "prompt"` | Print response and EXIT | Scripts, pipes, one-shot queries |
| `claude "prompt"` | Interactive session (STAYS OPEN) | Agents, persistent work |
| `claude --system-prompt file.md "prompt"` | Interactive with system context | **Best for agents** |

---

### Key Change 2: System Prompt Injection

**Before** (unreliable):
```
"Read Library/agent-souls/CHIEF_SOUL.md and execute..."
```
Agent had to manually read the file, could fail or interpret wrong.

**After** (reliable):
```powershell
claude --system-prompt "Library/agent-souls/CHIEF_SOUL.md" "Begin workflow"
```
SOUL content is injected as system context before the conversation starts.

---

### Key Change 3: Permission Bypass for Autonomous Operation

**Problem**: Agents kept prompting "Do you want to proceed?" for Bash commands

**Fix**: Add `--dangerously-skip-permissions` flag
```powershell
claude --dangerously-skip-permissions --system-prompt "$soulPath" "Begin workflow"
```

**Warning**: Only use this for trusted autonomous agents in controlled environments.

---

### Key Change 4: Windows Terminal Argument Array Format

**Problem**: Complex string escaping was breaking WT argument parsing
```
error 2147942402 (0x80070002) when launching 'new-tab --title Chief...'
```

**Fix**: Use PowerShell array format with `--` separator
```powershell
$wtArgs = @(
    "new-tab"
    "--title"
    "$agentName"
    "-d"
    "$scriptDir"
    "--"           # <-- This separates WT args from the command
    "cmd.exe"
    "/k"
    "$launcherPath"
)
Start-Process wt -ArgumentList $wtArgs
```

**Key Insight**: The `--` separator tells Windows Terminal "everything after this is the command to run, not WT flags".

---

### Key Change 5: Use .cmd Files Instead of .ps1 in Temp

**Problem**: PowerShell execution policy can block .ps1 files in temp folder

**Fix**: Use .cmd batch files (no execution policy issues)
```powershell
$launcherPath = Join-Path $tempDir "launch-$agentName.cmd"
$cmdContent = @"
@echo off
title HALO: $agentName
cd /d "$scriptDir"
claude --dangerously-skip-permissions --system-prompt "$soulPath" "Begin workflow"
pause >nul
"@
$cmdContent | Set-Content -Path $launcherPath -Encoding ASCII
```

---

### Summary: The Complete Fix

```powershell
# OLD (broken) - agent exits after one task
claude -p 'You are CHIEF. Read Library/agent-souls/CHIEF_SOUL.md and execute...'

# NEW (working) - agent stays in interactive session
claude --dangerously-skip-permissions --system-prompt "Library/agent-souls/CHIEF_SOUL.md" "You are Chief. Begin your PRIMARY WORKFLOW now. Execute autonomously."
```

| Component | Old | New |
|-----------|-----|-----|
| Mode | `-p` (print & exit) | Interactive (no flag) |
| SOUL injection | "Read the file..." | `--system-prompt path` |
| Permissions | Prompts user | `--dangerously-skip-permissions` |
| Launcher files | .ps1 | .cmd |
| WT arguments | String concatenation | Array with `--` separator |

---

---

## Session: 2026-03-22 (Part 3) - Agent Pipeline Verification

### How to Verify Agents Are Working

Created `scripts/verify-halo-agents.ps1` - comprehensive pipeline verification.

**Run it**:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-halo-agents.ps1
```

### Verification Points (7 Categories)

| Check | What It Verifies | Success Criteria |
|-------|------------------|------------------|
| **1. Launcher Files** | Temp .cmd files exist | 6 files with `--system-prompt` and `--dangerously-skip-permissions` |
| **2. Heartbeat Status** | Agents are alive | `data/heartbeat-status.json` shows status=alive, lastSeen < 3 min |
| **3. Activity Feed** | Agents are posting | `data/activity-feed.json` updated recently |
| **4. Brain Files** | Agents are writing output | `data/brain/*.md` files updated < 24h |
| **5. Processes** | Claude is running | `claude.exe` processes visible in Task Manager |
| **6. SOUL Files** | Config exists | `Library/agent-souls/*.md` files present |
| **7. Jira Loop** | Jira integration active | `data/jira-loop-state.json` shows running=true |

### Key Monitoring Files

| File | Purpose | Who Writes | Check Frequency |
|------|---------|------------|-----------------|
| `data/heartbeat-status.json` | Agent liveness | Heartbeat system | Every 2 min |
| `data/health_status.json` | System health | Health monitor | Every 1 min |
| `data/activity-feed.json` | Agent actions | All agents | Real-time |
| `data/jira-loop-state.json` | Jira work state | Jira loop | Per ticket |
| `data/brain/daily-log.md` | Daily summary | Chief | End of day |

### Quick Health Check Commands

```powershell
# See which agents are alive
Get-Content data/heartbeat-status.json | ConvertFrom-Json | Select-Object -ExpandProperty agents

# Count running Claude processes
(Get-Process -Name claude -ErrorAction SilentlyContinue).Count

# Check last activity time
(Get-Item data/activity-feed.json).LastWriteTime

# See recent activity entries
Get-Content data/activity-feed.json | ConvertFrom-Json | Select-Object -ExpandProperty entries | Select-Object -First 5
```

### What "ALIVE" Means

- **ALIVE**: lastSeen < 3 minutes (staleThresholdMs: 180000)
- **STALE**: lastSeen 3-10 minutes
- **DEAD**: lastSeen > 10 minutes (deadThresholdMs: 600000)

Agents ping heartbeat via API calls. If no ping in 10 min, marked DEAD.

---

## Principles Going Forward

1. **Test commands manually first** before embedding in scripts
2. **Keep it simple** - avoid complex escaping, temp files, nested quotes
3. **Check reserved names** - $pid, $host, $profile are PowerShell reserved
4. **Single-line for CLI args** - multi-line causes parsing issues
5. **Preserve user's processes** - never blanket-kill node/python/etc
6. **Use interactive mode for agents** - never use `-p` flag for persistent agents
7. **Inject context via `--system-prompt`** - don't tell agent to "read a file"
8. **Use `--` separator in WT commands** - separates WT flags from command to run
9. **Use .cmd over .ps1 in temp** - avoids execution policy issues
10. **Use array format for complex args** - cleaner than string escaping
11. **Run verify-halo-agents.ps1** after launching to confirm agents are working

---

## Session: 2026-03-22 (Part 4) - Git Stash Restore Overwrites

### Problem: Coffee Room Reappeared After Being Removed

**Root Cause:** When restoring Activity Feed from stash (`61d1867`), the stash contained an older version of `Sidebar.tsx` that still had Coffee Room. The restore operation overwrote the current Sidebar with the stashed version.

**Evidence:**
```
git show c3ee877 -- src/components/Layout/Sidebar.tsx
# Shows Coffee Room was in the stash, got restored
```

### Lesson: NEVER Blindly Restore From Stash

When restoring files from a stash:
1. **Review the stash contents first**: `git stash show -p stash@{N}`
2. **Check timestamps**: Stash might contain old versions of files
3. **Apply selectively**: Use `git checkout stash@{N} -- path/to/file` for specific files
4. **Compare before committing**: `git diff` to see what changed

### Fix Applied:
- Removed Coffee Room from `NAV_GROUPS` in Sidebar.tsx
- Removed unused `Coffee` import from lucide-react
- Added collapse functionality (isCollapsed state + button)

### Prevention:
- Document UI changes in commit messages
- Before restoring stashes, always diff against current state
- Consider using feature branches instead of stashes for significant work

---

## Session: 2026-03-22 (Part 5) - Activity Feed Terminal Routing FAILURE

### Problem: Non-HALO sessions appearing in agent terminals

Despite multiple fix attempts, user's direct Claude chat was appearing in Arbiter/Hunter terminals instead of being ignored.

### Failed Approaches

| Attempt | What We Tried | Why It Failed |
|---------|---------------|---------------|
| 1 | Default unknown to 'chief' | Flooded Chief with non-HALO sessions |
| 2 | Mark unknown as 'ignored' | Sessions matched BEFORE reaching fallback |
| 3 | Remove broad keyword detection | Strict patterns still matched content ("You are Hunter" in discussions) |

### Root Cause: Content-Based Detection Is Inherently Unreliable

The `detectAgentStrict()` function matches patterns like:
- `You are Chief\b`
- `CHIEF_SOUL\.md`

**Problem**: User conversations can contain these patterns!
- "I told the agent You are Hunter..." → matches Hunter
- Discussion about SOUL files → matches patterns
- Code snippets → match patterns

### The Correct Solution: Session Registry

**Principle**: Don't detect what you can track.

The LAUNCHER (`LAUNCH_AGENTS.ps1`) knows exactly which sessions it creates.
It should WRITE that information to a registry file.
The BRIDGE should READ from the registry, not guess from content.

### Implementation

1. **Create `data/halo-sessions.json`**
   ```json
   {
     "sessions": {
       "abc123-session-uuid": "chief",
       "def456-session-uuid": "arbiter"
     },
     "lastUpdated": "2026-03-22T15:00:00Z"
   }
   ```

2. **Update `LAUNCH_AGENTS.ps1`**
   - After launching each agent, poll for new JSONL file
   - Extract sessionId from filename
   - Write to `halo-sessions.json`

3. **Update `activity-bridge.ts`**
   - Load registry on startup
   - Check registry FIRST before any pattern detection
   - Only fallback to patterns if registry lookup fails

### Key Insight

> **Don't detect what you can track.**
> If you control the creation of sessions, write down which ones you created.
> Don't later try to reverse-engineer that information from content.

### Prevention Checklist

Before implementing session/identity detection:
- [ ] Is there a trusted source of truth available?
- [ ] Can the creator register items rather than detectors guessing?
- [ ] Are patterns unique enough to avoid false positives?
- [ ] What happens when patterns match unintended content?

### Files Involved

| File | Role |
|------|------|
| `LAUNCH_AGENTS.ps1` | Creates sessions, should register them |
| `data/halo-sessions.json` | Session registry (new file) |
| `scripts/activity-bridge.ts` | Reads registry, routes logs |
| `src/hooks/useActivityFeed.ts` | Frontend log distribution |
| `src/components/ActivityFeed/AgentTerminal.tsx` | Displays agent logs |
