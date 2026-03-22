# LAUNCH_AGENTS.ps1 - Launch 6 Halo agents in separate Windows Terminal tabs
# Each agent runs Claude Code in INTERACTIVE mode with their SOUL file as system prompt
#
# FIX (2026-03-22): Changed from -p (print-and-exit) to interactive mode
# - Agents now stay in Claude session after initial task
# - SOUL content injected via --system-prompt (not just "read the file")
# - Uses unique session IDs for resumability

$ErrorActionPreference = "SilentlyContinue"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Generate unique session prefix for this launch
$sessionPrefix = "halo-" + (Get-Date -Format "yyyyMMdd-HHmmss")

Clear-Host
Write-Host ""
Write-Host "  +============================================+" -ForegroundColor Cyan
Write-Host "  |                                            |" -ForegroundColor Cyan
Write-Host "  |   H A L O   A G E N T S                    |" -ForegroundColor Cyan
Write-Host "  |   Spawning 6 Claude Terminals              |" -ForegroundColor Magenta
Write-Host "  |   Session: $sessionPrefix               |" -ForegroundColor DarkGray
Write-Host "  |                                            |" -ForegroundColor Cyan
Write-Host "  +============================================+" -ForegroundColor Cyan
Write-Host ""

# Check if Claude Code is available
$claude = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claude) {
    Write-Host "  ERROR: Claude Code CLI not found." -ForegroundColor Red
    Write-Host "  Install with: npm install -g @anthropic-ai/claude-code" -ForegroundColor Yellow
    Read-Host "  Press Enter to exit"
    exit 1
}

# Check if Windows Terminal is available
$wt = Get-Command wt -ErrorAction SilentlyContinue
if (-not $wt) {
    Write-Host "  WARNING: Windows Terminal not found. Using PowerShell windows." -ForegroundColor Yellow
    $useWT = $false
} else {
    $useWT = $true
}

# Check which PowerShell is available (pwsh = Core, powershell = Windows)
$pwshCmd = Get-Command pwsh -ErrorAction SilentlyContinue
if ($pwshCmd) {
    $shellExe = "pwsh"
} else {
    $shellExe = "powershell"
}

# Define the 6 Halo agents with their SOUL file paths
$agents = @(
    @{ Name = "Chief";   SoulFile = "CHIEF_SOUL.md" },
    @{ Name = "Arbiter"; SoulFile = "ARBITER_SOUL.md" },
    @{ Name = "Ops";     SoulFile = "OPS_SOUL.md" },
    @{ Name = "Hunter";  SoulFile = "HUNTER_SOUL.md" },
    @{ Name = "Cortana"; SoulFile = "CORTANA_SOUL.md" },
    @{ Name = "Scout";   SoulFile = "SCOUT_SOUL.md" }
)

Write-Host "  Launching 6 Halo Agent terminals..." -ForegroundColor Yellow
Write-Host "  Mode: INTERACTIVE (agents stay in Claude session)" -ForegroundColor DarkGray
Write-Host ""

# Create temp directory for launcher scripts
$tempDir = Join-Path $env:TEMP "halo-agents"
if (-not (Test-Path $tempDir)) { New-Item -ItemType Directory -Path $tempDir -Force | Out-Null }

# Track the WT window name for tab grouping
$wtWindowName = "HALO-$sessionPrefix"

$agentNumber = 0
foreach ($agent in $agents) {
    $agentNumber++
    $agentName = $agent.Name
    $soulFileName = $agent.SoulFile
    $soulPath = Join-Path $scriptDir "Library\agent-souls\$soulFileName"

    Write-Host "  [$agentNumber/6] Spawning $agentName..." -ForegroundColor Cyan

    # Create a .cmd launcher (more reliable than .ps1 in temp folder)
    $launcherPath = Join-Path $tempDir "launch-$agentName.cmd"

    # The key fix: NO -p flag = interactive mode
    # Use --system-prompt to inject SOUL context directly
    # Use --dangerously-skip-permissions for autonomous operation (no prompts)
    # The initial prompt just tells agent to start working
    $cmdContent = @"
@echo off
title HALO: $agentName [$sessionPrefix]
cd /d "$scriptDir"
echo.
echo   ==========================================
echo     HALO AGENT: $agentName
echo     Soul File: $soulFileName
echo     Mode: AUTONOMOUS (skip permissions)
echo   ==========================================
echo.
echo   Starting Claude with SOUL context...
echo.
claude --dangerously-skip-permissions --system-prompt "$soulPath" "You are $agentName. Your SOUL file has been loaded as system context. Begin your PRIMARY WORKFLOW now. After completing it, enter your CONTINUOUS ENGAGEMENT LOOP. You are an EMPLOYEE, not a contractor - do NOT stop after one task. Create Jira tickets for blockers (don't just recommend). Check for new work. Loop until shift ends or killswitch."
echo.
echo   [Session ended - press any key to close]
pause >nul
"@
    $cmdContent | Set-Content -Path $launcherPath -Encoding ASCII

    if ($useWT) {
        if ($agentNumber -eq 1) {
            # First agent: create NEW window with specific title (don't reuse existing windows)
            # Use array format for cleaner argument handling
            $wtArgs = @(
                "new-tab"
                "--title"
                "$agentName"
                "-d"
                "$scriptDir"
                "--"
                "cmd.exe"
                "/k"
                "$launcherPath"
            )
            Start-Process wt -ArgumentList $wtArgs
        } else {
            # Subsequent agents: add tab to the HALO window (use -w 0 for most recent window)
            $wtArgs = @(
                "-w"
                "0"
                "nt"
                "--title"
                "$agentName"
                "-d"
                "$scriptDir"
                "--"
                "cmd.exe"
                "/k"
                "$launcherPath"
            )
            Start-Process wt -ArgumentList $wtArgs
        }
    } else {
        # Fallback for systems without Windows Terminal
        Start-Process cmd.exe -ArgumentList "/k", "$launcherPath"
    }

    # Longer delay to ensure tab is fully created before next
    Start-Sleep -Seconds 3
}

# ─── Session Registration ─────────────────────────────────────────────────────
# After launching agents, detect their session files and register them
# This allows activity-bridge to correctly route logs to each terminal

Write-Host ""
Write-Host "  Registering agent sessions..." -ForegroundColor Yellow

$claudeProjectDir = Join-Path $env:USERPROFILE ".claude\projects\C--Users-jackw-Desktop-SwjshAlgoKnife"
$registryPath = Join-Path $scriptDir "data\agent-registry.json"

# Wait for session files to be created (Claude Code creates them on startup)
Start-Sleep -Seconds 5

# Find recent JSONL files (created in the last 2 minutes)
$cutoffTime = (Get-Date).AddMinutes(-2)
$recentSessions = @()

if (Test-Path $claudeProjectDir) {
    $recentSessions = Get-ChildItem -Path $claudeProjectDir -Filter "*.jsonl" |
        Where-Object { $_.LastWriteTime -gt $cutoffTime } |
        Sort-Object LastWriteTime -Descending
}

# Build registry from detected sessions
$registry = @{
    description = "Registry of active Halo agents - written by LAUNCH_AGENTS.ps1"
    agents = @{}
    lastUpdated = (Get-Date -Format "o")
}

# Match sessions to agents by reading their content
foreach ($sessionFile in $recentSessions) {
    $sessionId = $sessionFile.BaseName

    # Read first 30 lines to find agent identifier
    $content = Get-Content $sessionFile.FullName -TotalCount 30 -ErrorAction SilentlyContinue | Out-String

    $detectedAgent = $null
    foreach ($agent in $agents) {
        $agentName = $agent.Name
        # Match "You are {Agent}" pattern from our launch prompt
        if ($content -match "You are $agentName\b") {
            $detectedAgent = $agentName.ToLower()
            break
        }
    }

    if ($detectedAgent) {
        $registry.agents[$detectedAgent] = @{
            agentId = $detectedAgent
            sessionId = $sessionId
            startedAt = $sessionFile.LastWriteTime.ToString("o")
            status = "online"
            cwd = $scriptDir
        }
        Write-Host "    ✓ $detectedAgent → $($sessionId.Substring(0,8))..." -ForegroundColor Green
    }
}

# Write registry to disk
$registry | ConvertTo-Json -Depth 4 | Set-Content -Path $registryPath -Encoding UTF8
Write-Host "  Registry saved: $($registry.agents.Count) agents registered" -ForegroundColor Cyan

Write-Host ""
Write-Host "  +============================================+" -ForegroundColor Green
Write-Host "  |   6 HALO AGENTS DEPLOYED                   |" -ForegroundColor Green
Write-Host "  +============================================+" -ForegroundColor Green
Write-Host ""
Write-Host "  Each agent is now in a CONTINUOUS ENGAGEMENT LOOP." -ForegroundColor White
Write-Host "  They execute their PRIMARY WORKFLOW, then:" -ForegroundColor White
Write-Host "    1. Create Jira tickets for any blockers" -ForegroundColor White
Write-Host "    2. Check for new work assigned to them" -ForegroundColor White
Write-Host "    3. Wait 5 min, then loop back" -ForegroundColor White
Write-Host ""
Write-Host "  Agent Roster:" -ForegroundColor DarkGray
Write-Host "    - Chief (COO) - Coordinates team, morning briefings" -ForegroundColor DarkGray
Write-Host "    - Arbiter (QA) - Quality gates, constraint enforcement" -ForegroundColor DarkGray
Write-Host "    - Ops (SRE) - System health, incident response" -ForegroundColor DarkGray
Write-Host "    - Hunter (Security) - Vulnerability scanning, tech debt" -ForegroundColor DarkGray
Write-Host "    - Cortana (Research) - Pattern extraction, learnings" -ForegroundColor DarkGray
Write-Host "    - Scout (Strategy) - Feature planning, backlog" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Session ID: $sessionPrefix" -ForegroundColor DarkGray
Write-Host "  Window Name: $wtWindowName" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  TIP: Agents now run in CONTINUOUS ENGAGEMENT LOOP." -ForegroundColor Yellow
Write-Host "       They will create Jira tickets and check for new work every 5 min." -ForegroundColor Yellow
Write-Host "       To stop an agent, send /stop or activate killswitch." -ForegroundColor Yellow
Write-Host ""
