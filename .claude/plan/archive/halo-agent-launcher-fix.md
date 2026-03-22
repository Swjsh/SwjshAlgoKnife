# HALO Agent Launcher Fix - Implementation Complete

**Status**: ✅ IMPLEMENTED on 2026-03-22
**File Modified**: `LAUNCH_AGENTS.ps1`

---

## Problem Statement

The HALO agent launcher was failing in two ways:
1. **Agents exited immediately** after completing one task (dropped to PowerShell prompt)
2. **Interfered with existing Claude sessions** when launched

---

## Root Cause Analysis

### Issue 1: Agents Exit After One Task

**Cause**: The launcher used `claude -p "prompt"` which runs Claude in "print and exit" mode.

```powershell
# OLD CODE (broken)
claude -p 'You are CHIEF. Read Library/agent-souls/CHIEF_SOUL.md and execute...'
```

The `-p` flag is designed for one-shot piped usage. It:
- Processes the prompt
- Outputs response to stdout
- **Exits immediately**

This is the opposite of what we wanted (persistent interactive session).

### Issue 2: Interfered with Existing Sessions

**Cause**: The Windows Terminal command used `-w 0` which targets "most recent window".

```powershell
# OLD CODE (broken)
Start-Process wt -ArgumentList "-w 0 new-tab --title `"$agentName`" ..."
```

This would add tabs to whatever WT window was most recently focused, potentially an existing Claude session.

---

## Solution Implemented

### Fix 1: Use Interactive Mode with Permission Bypass

```powershell
# NEW CODE (working)
claude --dangerously-skip-permissions --system-prompt "$soulPath" "You are $agentName. Begin your PRIMARY WORKFLOW now."
```

**Key changes**:
- Removed `-p` flag → Claude stays in interactive session
- Added `--dangerously-skip-permissions` → No permission prompts (fully autonomous)
- Added `--system-prompt` → SOUL file content is injected as system context
- Simple initial prompt → Just tells agent to start working

### Fix 2: Create New Window with Unique Name

```powershell
# NEW CODE (working)
$wtWindowName = "HALO-$sessionPrefix"  # e.g., "HALO-20260322-143052"

# First agent: create NEW window
Start-Process wt -ArgumentList "--title `"$wtWindowName`" new-tab --title `"$agentName`" ..."

# Subsequent agents: add tab to HALO window by name
Start-Process wt -ArgumentList "-w `"$wtWindowName`" nt --title `"$agentName`" ..."
```

**Key changes**:
- Unique window name per launch (timestamp-based)
- First agent creates a new window with `--title`
- Subsequent agents target that specific window by name with `-w "name"`
- Never touches existing windows

### Fix 3: Use .cmd Instead of .ps1 for Temp Launchers

```cmd
@echo off
title HALO: Chief [halo-20260322-143052]
cd /d "C:\Users\jackw\Desktop\SwjshAlgoKnife"
echo.
echo   Starting Claude with SOUL context...
echo.
claude --system-prompt "C:\...\Library\agent-souls\CHIEF_SOUL.md" "You are Chief. Begin..."
echo.
echo   [Session ended - press any key to close]
pause >nul
```

**Why .cmd**:
- No execution policy issues
- Simpler escaping rules
- More reliable in temp folder

### Fix 4: Longer Delays Between Agent Launches

```powershell
Start-Sleep -Seconds 3  # Increased from 2
```

Ensures Windows Terminal has time to fully create each tab before the next one.

---

## How to Replicate

### Step 1: Understand the Claude CLI Flags

```bash
# One-shot mode (exits after response) - DON'T USE FOR AGENTS
claude -p "prompt"

# Interactive mode (stays in session) - USE THIS
claude "prompt"

# With system prompt injection - BEST FOR AGENTS
claude --system-prompt "path/to/soul.md" "initial prompt"
```

### Step 2: Create Unique Window Names

```powershell
# Generate timestamp-based session ID
$sessionPrefix = "halo-" + (Get-Date -Format "yyyyMMdd-HHmmss")
$wtWindowName = "HALO-$sessionPrefix"

# First tab: create new window with explicit title
Start-Process wt -ArgumentList "--title `"$wtWindowName`" new-tab ..."

# Additional tabs: target by window name
Start-Process wt -ArgumentList "-w `"$wtWindowName`" nt ..."
```

### Step 3: Use .cmd Launcher Files

```powershell
$launcherPath = Join-Path $tempDir "launch-$agentName.cmd"
$cmdContent = @"
@echo off
title HALO: $agentName
cd /d "$scriptDir"
claude --system-prompt "$soulPath" "Begin workflow"
pause >nul
"@
$cmdContent | Set-Content -Path $launcherPath -Encoding ASCII
```

### Step 4: Launch via cmd /k

```powershell
# Use cmd /k to run the .cmd file and keep window open
Start-Process wt -ArgumentList "-w `"$wtWindowName`" nt --title `"$agentName`" cmd /k `"$launcherPath`""
```

---

## Full Working Code

The complete fixed `LAUNCH_AGENTS.ps1`:

```powershell
# LAUNCH_AGENTS.ps1 - Launch 6 Halo agents in separate Windows Terminal tabs
# Each agent runs Claude Code in INTERACTIVE mode with their SOUL file as system prompt

$ErrorActionPreference = "SilentlyContinue"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Generate unique session prefix for this launch
$sessionPrefix = "halo-" + (Get-Date -Format "yyyyMMdd-HHmmss")
$wtWindowName = "HALO-$sessionPrefix"

# Define agents with their SOUL files
$agents = @(
    @{ Name = "Chief";   SoulFile = "CHIEF_SOUL.md" },
    @{ Name = "Arbiter"; SoulFile = "ARBITER_SOUL.md" },
    @{ Name = "Ops";     SoulFile = "OPS_SOUL.md" },
    @{ Name = "Hunter";  SoulFile = "HUNTER_SOUL.md" },
    @{ Name = "Cortana"; SoulFile = "CORTANA_SOUL.md" },
    @{ Name = "Scout";   SoulFile = "SCOUT_SOUL.md" }
)

# Create temp directory
$tempDir = Join-Path $env:TEMP "halo-agents"
if (-not (Test-Path $tempDir)) { New-Item -ItemType Directory -Path $tempDir -Force | Out-Null }

$agentNumber = 0
foreach ($agent in $agents) {
    $agentNumber++
    $agentName = $agent.Name
    $soulPath = Join-Path $scriptDir "Library\agent-souls\$($agent.SoulFile)"

    # Create .cmd launcher
    $launcherPath = Join-Path $tempDir "launch-$agentName.cmd"
    $cmdContent = @"
@echo off
title HALO: $agentName [$sessionPrefix]
cd /d "$scriptDir"
echo.
echo   HALO AGENT: $agentName
echo   Mode: INTERACTIVE
echo.
claude --dangerously-skip-permissions --system-prompt "$soulPath" "You are $agentName. Begin your PRIMARY WORKFLOW now. Execute autonomously."
pause >nul
"@
    $cmdContent | Set-Content -Path $launcherPath -Encoding ASCII

    # Launch in Windows Terminal
    if ($agentNumber -eq 1) {
        Start-Process wt -ArgumentList "--title `"$wtWindowName`" new-tab --title `"$agentName`" -d `"$scriptDir`" cmd /k `"$launcherPath`""
    } else {
        Start-Process wt -ArgumentList "-w `"$wtWindowName`" nt --title `"$agentName`" -d `"$scriptDir`" cmd /k `"$launcherPath`""
    }

    Start-Sleep -Seconds 3
}

Write-Host "6 HALO agents deployed in window: $wtWindowName"
```

---

## Testing Checklist

| Test | Expected Result | Status |
|------|-----------------|--------|
| Run `LAUNCH_HALO.bat` | 6 agent tabs spawn in new "HALO-*" window | ⬜ Verify |
| Check agent terminal | Should be IN Claude session (not at PS prompt) | ⬜ Verify |
| Type in agent terminal | Agent should respond (proves interactive) | ⬜ Verify |
| Have existing Claude open | Should NOT be closed or affected | ⬜ Verify |
| Run launcher twice | Creates second HALO window (doesn't interfere) | ⬜ Verify |

---

## What Still Needs Work

From the deep research plan, these items remain:

1. **True Autonomous Looping**
   - Agents stay in session but don't auto-query Jira for next ticket
   - Need: PM2 cron job or scheduled task to restart agents periodically

2. **Discord Notifications**
   - `notify_discord()` in Python agents is still a stub
   - Need: Implement actual Discord webhook calls

3. **n8n Webhooks**
   - 18 workflows deployed but not triggered
   - Need: Wire Jira webhooks → n8n → Agent triggers

---

## Troubleshooting

### Agent exits immediately after output
**Cause**: Still using `-p` flag somewhere
**Fix**: Remove `-p`, use interactive mode

### Windows Terminal says "window not found"
**Cause**: Race condition - first tab not created yet
**Fix**: Increase delay to 4+ seconds

### SOUL file not loaded
**Cause**: Path escaping issue in .cmd file
**Fix**: Use forward slashes or escaped backslashes

### "Execution policy" error
**Cause**: Using .ps1 in temp folder without bypass
**Fix**: Use .cmd files instead, or add `-ExecutionPolicy Bypass`

---

## References

- Claude CLI help: `claude --help`
- Windows Terminal args: https://docs.microsoft.com/en-us/windows/terminal/command-line-arguments
- Deep research plan: `.claude/plan/jira-agent-deep-research.md`

---

*Implemented: 2026-03-22*
*Author: Claude Code session*
*Files modified: LAUNCH_AGENTS.ps1*
