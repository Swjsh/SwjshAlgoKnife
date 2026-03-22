# LAUNCH_AGENTS.ps1 - Launch 6 Halo agents in 2 Windows Terminal windows (3 tabs each)
# Each agent runs Claude Code in INTERACTIVE mode, reading their SOUL file on startup
#
# FIX (2026-03-22):
# - Changed from -p (print-and-exit) to interactive mode
# - Fixed --system-prompt: was passing file PATH, now agents read the file themselves
# - Split into 2 windows x 3 tabs (Window 1: Chief/Arbiter/Ops, Window 2: Hunter/Cortana/Scout)
# - Added cleanup of existing HALO Claude sessions on re-launch
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
Write-Host "  |   2 Windows x 3 Tabs                      |" -ForegroundColor DarkGray
Write-Host "  |   Session: $sessionPrefix               |" -ForegroundColor DarkGray
Write-Host "  |                                            |" -ForegroundColor Cyan
Write-Host "  +============================================+" -ForegroundColor Cyan
Write-Host ""

# ─── Cleanup existing HALO agent sessions ────────────────────────────────────
Write-Host "  [0/6] Cleaning up previous HALO sessions..." -ForegroundColor Yellow

# Kill any existing Claude processes that were launched by HALO
# (Check for our temp launcher .cmd files still running)
$tempDir = Join-Path $env:TEMP "halo-agents"
$existingClaude = Get-Process -Name "claude" -ErrorAction SilentlyContinue
if ($existingClaude) {
    $haloCount = ($existingClaude | Measure-Object).Count
    Write-Host "       Found $haloCount Claude process(es) — stopping..." -ForegroundColor DarkGray
    # Only kill claude processes whose command line includes our project dir
    foreach ($proc in $existingClaude) {
        try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)" -ErrorAction SilentlyContinue).CommandLine
            if ($cmdLine -and ($cmdLine -match "SwjshAlgoKnife" -or $cmdLine -match "halo-agents")) {
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                Write-Host "       Killed HALO Claude PID $($proc.Id)" -ForegroundColor DarkGray
            }
        } catch {}
    }
}

# Close existing HALO Windows Terminal windows (look for our title pattern)
$wtProcesses = Get-Process -Name "WindowsTerminal" -ErrorAction SilentlyContinue
# We can't selectively close WT tabs, but we'll close cmd.exe processes running our launchers
if (Test-Path $tempDir) {
    $oldLaunchers = Get-ChildItem $tempDir -Filter "launch-*.cmd" -ErrorAction SilentlyContinue
    foreach ($launcher in $oldLaunchers) {
        # Find cmd.exe processes running this specific launcher
        $cmdProcs = Get-CimInstance Win32_Process -Filter "Name = 'cmd.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -match [regex]::Escape($launcher.Name) }
        foreach ($cmdProc in $cmdProcs) {
            Stop-Process -Id $cmdProc.ProcessId -Force -ErrorAction SilentlyContinue
            Write-Host "       Killed old launcher: $($launcher.Name)" -ForegroundColor DarkGray
        }
    }
}

Start-Sleep -Milliseconds 500
Write-Host "  [0/6] Clean slate ready" -ForegroundColor Green
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

# Define the 6 Halo agents split into 2 windows of 3
# Window 1: Leadership + Operations (Chief, Arbiter, Ops)
# Window 2: Specialists (Hunter, Cortana, Scout)
$window1Agents = @(
    @{ Name = "Chief";   SoulFile = "CHIEF_SOUL.md" },
    @{ Name = "Arbiter"; SoulFile = "ARBITER_SOUL.md" },
    @{ Name = "Ops";     SoulFile = "OPS_SOUL.md" }
)

$window2Agents = @(
    @{ Name = "Hunter";  SoulFile = "HUNTER_SOUL.md" },
    @{ Name = "Cortana"; SoulFile = "CORTANA_SOUL.md" },
    @{ Name = "Scout";   SoulFile = "SCOUT_SOUL.md" }
)

$allAgents = $window1Agents + $window2Agents

Write-Host "  Launching 6 Halo Agent terminals..." -ForegroundColor Yellow
Write-Host "  Mode: INTERACTIVE + AUTONOMOUS (--dangerously-skip-permissions)" -ForegroundColor DarkGray
Write-Host "  Layout: Window 1 (Chief/Arbiter/Ops) + Window 2 (Hunter/Cortana/Scout)" -ForegroundColor DarkGray
Write-Host ""

# Create temp directory for launcher scripts
if (-not (Test-Path $tempDir)) { New-Item -ItemType Directory -Path $tempDir -Force | Out-Null }

# ─── Build launcher .cmd files ───────────────────────────────────────────────
$agentNumber = 0
foreach ($agent in $allAgents) {
    $agentNumber++
    $agentName = $agent.Name
    $soulFileName = $agent.SoulFile
    $soulPath = Join-Path $scriptDir "Library\agent-souls\$soulFileName"

    Write-Host "  [$agentNumber/6] Spawning $agentName..." -ForegroundColor Cyan

    # Create a .cmd launcher
    $launcherPath = Join-Path $tempDir "launch-$agentName.cmd"

    # FIX: --system-prompt takes a LITERAL STRING, not a file path.
    # Soul files are 20-26KB which exceeds cmd.exe's 8191-char limit.
    # Solution: Tell the agent to READ the soul file in the initial prompt.
    # The agent has --dangerously-skip-permissions so it can use Read tool freely.
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
echo   Starting Claude session...
echo.
claude --dangerously-skip-permissions "You are $agentName. FIRST: Use the Read tool to read your SOUL file at '$soulPath' — it contains your complete identity, personality, workflows, and operating procedures. Internalize everything in it. THEN: Begin your PRIMARY WORKFLOW immediately. After completing it, enter your CONTINUOUS ENGAGEMENT LOOP. You are an EMPLOYEE, not a contractor — do NOT stop after one task. Create Jira tickets for blockers (don't just recommend). Check for new work assigned to you. Loop until shift ends or killswitch."
echo.
echo   [Session ended - press any key to close]
pause >nul
"@
    $cmdContent | Set-Content -Path $launcherPath -Encoding ASCII

    # Determine which window this agent belongs to
    $isFirstInWindow = ($agentNumber -eq 1 -or $agentNumber -eq 4)
    $isWindow2 = ($agentNumber -ge 4)

    if ($useWT) {
        if ($isFirstInWindow) {
            # First agent in each window: create NEW Windows Terminal window
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

            if ($isWindow2) {
                Write-Host "       [New Window 2: Specialists]" -ForegroundColor DarkGray
            } else {
                Write-Host "       [New Window 1: Leadership]" -ForegroundColor DarkGray
            }
        } else {
            # Subsequent agents: add tab to the MOST RECENT window (-w 0)
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

    # Delay to ensure tab is fully created before next
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
    sessionPrefix = $sessionPrefix
    agents = @{}
    lastUpdated = (Get-Date -Format "o")
}

# Match sessions to agents by reading their content
foreach ($sessionFile in $recentSessions) {
    $sessionId = $sessionFile.BaseName

    # Read first 30 lines to find agent identifier
    $content = Get-Content $sessionFile.FullName -TotalCount 30 -ErrorAction SilentlyContinue | Out-String

    $detectedAgent = $null
    foreach ($agent in $allAgents) {
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
        Write-Host "    + $detectedAgent -> $($sessionId.Substring(0,8))..." -ForegroundColor Green
    }
}

# Write registry to disk
$registry | ConvertTo-Json -Depth 4 | Set-Content -Path $registryPath -Encoding UTF8
Write-Host "  Registry saved: $($registry.agents.Count) agents registered" -ForegroundColor Cyan

Write-Host ""
Write-Host "  +============================================+" -ForegroundColor Green
Write-Host "  |   6 HALO AGENTS DEPLOYED                   |" -ForegroundColor Green
Write-Host "  |   Window 1: Chief / Arbiter / Ops          |" -ForegroundColor Green
Write-Host "  |   Window 2: Hunter / Cortana / Scout       |" -ForegroundColor Green
Write-Host "  +============================================+" -ForegroundColor Green
Write-Host ""
Write-Host "  Each agent reads its SOUL file then enters CONTINUOUS ENGAGEMENT LOOP." -ForegroundColor White
Write-Host "  They execute their PRIMARY WORKFLOW, then:" -ForegroundColor White
Write-Host "    1. Create Jira tickets for any blockers" -ForegroundColor White
Write-Host "    2. Check for new work assigned to them" -ForegroundColor White
Write-Host "    3. Wait 5 min, then loop back" -ForegroundColor White
Write-Host ""
Write-Host "  Agent Roster:" -ForegroundColor DarkGray
Write-Host "    Window 1 (Leadership + Operations):" -ForegroundColor DarkGray
Write-Host "      - Chief (COO) - Coordinates team, morning briefings" -ForegroundColor DarkGray
Write-Host "      - Arbiter (QA) - Quality gates, constraint enforcement" -ForegroundColor DarkGray
Write-Host "      - Ops (SRE) - System health, incident response" -ForegroundColor DarkGray
Write-Host "    Window 2 (Specialists):" -ForegroundColor DarkGray
Write-Host "      - Hunter (Security) - Vulnerability scanning, tech debt" -ForegroundColor DarkGray
Write-Host "      - Cortana (Research) - Pattern extraction, learnings" -ForegroundColor DarkGray
Write-Host "      - Scout (Strategy) - Feature planning, backlog" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Session ID: $sessionPrefix" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  TIP: Agents now run in CONTINUOUS ENGAGEMENT LOOP." -ForegroundColor Yellow
Write-Host "       They will create Jira tickets and check for new work every 5 min." -ForegroundColor Yellow
Write-Host "       To stop an agent, send /stop or activate killswitch." -ForegroundColor Yellow
Write-Host "       Re-running this launcher will clean up old sessions first." -ForegroundColor Yellow
Write-Host ""
