# verify-activity-feed.ps1 - Diagnostic script for Activity Feed system
# Checks all components needed for Activity Feed to work
#
# Usage: .\scripts\verify-activity-feed.ps1

$ErrorActionPreference = "Continue"
$scriptDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "       ACTIVITY FEED DIAGNOSTIC CHECK          " -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# ─── Check 1: Next.js on port 3000 ───────────────────────────────────────────

Write-Host "[1] Next.js dev server (port 3000)..." -ForegroundColor White
$nextTest = Test-NetConnection -ComputerName localhost -Port 3000 -WarningAction SilentlyContinue -InformationLevel Quiet
if ($nextTest) {
    Write-Host "    OK - Next.js is running" -ForegroundColor Green
} else {
    Write-Host "    FAIL - Next.js not running on port 3000" -ForegroundColor Red
    Write-Host "    Fix: npm run dev" -ForegroundColor Yellow
    $allGood = $false
}

# ─── Check 2: WebSocket on port 3001 ─────────────────────────────────────────

Write-Host "[2] WebSocket server (port 3001)..." -ForegroundColor White
$wsTest = Test-NetConnection -ComputerName localhost -Port 3001 -WarningAction SilentlyContinue -InformationLevel Quiet
if ($wsTest) {
    Write-Host "    OK - WebSocket server is running" -ForegroundColor Green
} else {
    Write-Host "    FAIL - WebSocket not running on port 3001" -ForegroundColor Red
    Write-Host "    Fix: npx tsx scripts/activity-bridge.ts" -ForegroundColor Yellow
    $allGood = $false
}

# ─── Check 3: Agent registry ─────────────────────────────────────────────────

Write-Host "[3] Agent registry (data/agent-registry.json)..." -ForegroundColor White
$registryPath = Join-Path $scriptDir "data\agent-registry.json"
if (Test-Path $registryPath) {
    try {
        $registry = Get-Content $registryPath -Raw | ConvertFrom-Json
        $agentCount = 0
        if ($registry.agents) {
            $agentCount = ($registry.agents | Get-Member -MemberType NoteProperty).Count
        }
        if ($agentCount -gt 0) {
            Write-Host "    OK - Registry has $agentCount agents" -ForegroundColor Green
            $registry.agents | Get-Member -MemberType NoteProperty | ForEach-Object {
                $name = $_.Name
                $status = $registry.agents.$name.status
                $color = if ($status -eq "online") { "Green" } elseif ($status -eq "launching") { "Yellow" } else { "DarkGray" }
                Write-Host "        - $name : $status" -ForegroundColor $color
            }
        } else {
            Write-Host "    WARN - Registry exists but has no agents" -ForegroundColor Yellow
            Write-Host "    Fix: Run LAUNCH_HALO_SYSTEM.ps1 or LAUNCH_AGENTS.ps1" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "    FAIL - Registry file is invalid JSON" -ForegroundColor Red
        $allGood = $false
    }
} else {
    Write-Host "    WARN - Registry file does not exist" -ForegroundColor Yellow
    Write-Host "    Fix: Run LAUNCH_HALO_SYSTEM.ps1 to initialize" -ForegroundColor Yellow
}

# ─── Check 4: Activity feed JSON ─────────────────────────────────────────────

Write-Host "[4] Activity feed data (data/activity-feed.json)..." -ForegroundColor White
$feedPath = Join-Path $scriptDir "data\activity-feed.json"
if (Test-Path $feedPath) {
    try {
        $feed = Get-Content $feedPath -Raw | ConvertFrom-Json
        $entryCount = 0
        if ($feed.entries) {
            $entryCount = $feed.entries.Count
        }
        $agentCount = 0
        if ($feed.agents) {
            $agentCount = $feed.agents.Count
        }
        Write-Host "    OK - Feed has $entryCount entries, $agentCount agents" -ForegroundColor Green

        # Show agent statuses
        if ($feed.agents) {
            foreach ($agent in $feed.agents) {
                $status = $agent.status
                $name = $agent.name
                $actions = $agent.actionsToday
                $color = if ($status -eq "online" -or $status -eq "busy") { "Green" } else { "DarkGray" }
                Write-Host "        - $name : $status ($actions actions today)" -ForegroundColor $color
            }
        }
    } catch {
        Write-Host "    FAIL - Feed file is invalid JSON" -ForegroundColor Red
        $allGood = $false
    }
} else {
    Write-Host "    INFO - Feed file does not exist yet (will be created)" -ForegroundColor DarkGray
}

# ─── Check 5: Claude session files ───────────────────────────────────────────

Write-Host "[5] Claude session files (~/.claude/projects/)..." -ForegroundColor White
$claudeProjectDir = Join-Path $env:USERPROFILE ".claude\projects\C--Users-jackw-Desktop-SwjshAlgoKnife"
if (Test-Path $claudeProjectDir) {
    $sessionFiles = Get-ChildItem -Path $claudeProjectDir -Filter "*.jsonl" -ErrorAction SilentlyContinue
    $recentFiles = $sessionFiles | Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-10) }

    Write-Host "    Found $($sessionFiles.Count) total session files" -ForegroundColor Green
    Write-Host "    Active in last 10 min: $($recentFiles.Count)" -ForegroundColor $(if ($recentFiles.Count -gt 0) { "Green" } else { "Yellow" })

    if ($recentFiles.Count -gt 0) {
        Write-Host "    Recent sessions:" -ForegroundColor DarkGray
        $recentFiles | Select-Object -First 5 | ForEach-Object {
            $age = [math]::Round(((Get-Date) - $_.LastWriteTime).TotalMinutes, 1)
            Write-Host "        - $($_.Name.Substring(0,8))... ($age min ago)" -ForegroundColor DarkGray
        }
    }
} else {
    Write-Host "    WARN - Claude project directory not found" -ForegroundColor Yellow
    Write-Host "    Path: $claudeProjectDir" -ForegroundColor DarkGray
}

# ─── Check 6: Running claude.exe processes ───────────────────────────────────

Write-Host "[6] Running Claude processes..." -ForegroundColor White
$claudeProcs = Get-Process -Name "claude" -ErrorAction SilentlyContinue
if ($claudeProcs) {
    Write-Host "    OK - $($claudeProcs.Count) claude.exe processes running" -ForegroundColor Green
} else {
    Write-Host "    WARN - No claude.exe processes found" -ForegroundColor Yellow
    Write-Host "    Fix: Run LAUNCH_HALO_SYSTEM.ps1 to start agents" -ForegroundColor Yellow
}

# ─── Check 7: Node processes ─────────────────────────────────────────────────

Write-Host "[7] Running Node processes..." -ForegroundColor White
$nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcs) {
    Write-Host "    OK - $($nodeProcs.Count) node processes running" -ForegroundColor Green
} else {
    Write-Host "    WARN - No node processes found" -ForegroundColor Yellow
}

# ─── Summary ─────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "         ALL CRITICAL CHECKS PASSED            " -ForegroundColor Green
} else {
    Write-Host "         SOME CHECKS FAILED                    " -ForegroundColor Red
}
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

if (-not $allGood) {
    Write-Host "Quick fix: Run LAUNCH_HALO_SYSTEM.ps1 to start everything" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Dashboards:" -ForegroundColor White
Write-Host "  Activity Feed: http://localhost:3000/activity-feed" -ForegroundColor Cyan
Write-Host "  Halo Command:  http://localhost:3000/halo-command" -ForegroundColor Cyan
Write-Host ""
