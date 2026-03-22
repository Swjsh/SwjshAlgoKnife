# HALO SYSTEM - Master Launcher
# Launches SwjshAlgoKnife with the premium 23rd Century UI

$ErrorActionPreference = "Continue"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Clear-Host
Write-Host ""
Write-Host "  +============================================+" -ForegroundColor Cyan
Write-Host "  |                                            |" -ForegroundColor Cyan
Write-Host "  |   H A L O   S Y S T E M                    |" -ForegroundColor Cyan
Write-Host "  |   23rd Century Trading Platform            |" -ForegroundColor Magenta
Write-Host "  |                                            |" -ForegroundColor Cyan
Write-Host "  +============================================+" -ForegroundColor Cyan
Write-Host ""

# 1. Kill only SwjshAlgoKnife processes (NOT other Claude sessions)
Write-Host "  [1/9] Cleaning up old SwjshAlgoKnife processes..." -ForegroundColor Yellow

# Only kill processes on ports 3000 (dashboard) and 3001 (activity bridge)
try {
    $netstatOutput = netstat -ano | Select-String "LISTENING"
    foreach ($line in $netstatOutput) {
        $lineStr = $line.ToString()
        if ($lineStr -match ':3000\s' -or $lineStr -match ':3001\s') {
            $parts = $lineStr -split '\s+'
            $procId = $parts[-1]
            if ($procId -match '^\d+$' -and [int]$procId -gt 0) {
                Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
            }
        }
    }
} catch {
    # Ignore errors - ports may not be in use
}
Start-Sleep -Milliseconds 500

# Clean .next lock if exists
if (Test-Path ".next/lock") { Remove-Item ".next/lock" -Force -ErrorAction SilentlyContinue }
if (Test-Path ".next/dev/lock") { Remove-Item ".next/dev/lock" -Force -ErrorAction SilentlyContinue }
Write-Host "  [1/9] Clean slate (existing Claude sessions preserved)" -ForegroundColor Green

# 2. Check Node.js
Write-Host "  [2/9] Checking Node.js..." -ForegroundColor Yellow
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "  ERROR: Node.js not found. Please install from nodejs.org" -ForegroundColor Red
    Read-Host "  Press Enter to exit"
    exit 1
}
$nodeVer = node --version
Write-Host "  [2/9] Node.js ready ($nodeVer)" -ForegroundColor Green

# 3. Install dependencies if needed
Write-Host "  [3/9] Checking dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "       Installing npm packages (first run)..." -ForegroundColor DarkGray
    npm install --silent
}
Write-Host "  [3/9] Dependencies ready" -ForegroundColor Green

# 4. Start Activity Bridge (WebSocket server on port 3001)
Write-Host "  [4/9] Starting Activity Bridge (WebSocket :3001)..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx tsx scripts/activity-bridge.ts" -WindowStyle Minimized
Start-Sleep -Milliseconds 1500
Write-Host "  [4/9] Activity Bridge started" -ForegroundColor Green

# 5. Start Next.js Dev Server
Write-Host "  [5/9] Starting Next.js dashboard..." -ForegroundColor Yellow
Write-Host "       This may take a moment..." -ForegroundColor DarkGray

# Start dev server directly (not as job)
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WindowStyle Minimized

# Wait for server to be ready
$maxWait = 30
$waited = 0
while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 1
    $waited++

    $port3000 = netstat -ano 2>$null | Select-String ":3000.*LISTENING"
    if ($port3000) {
        Write-Host "  [5/9] Dashboard running on http://localhost:3000" -ForegroundColor Green
        break
    }

    if ($waited % 5 -eq 0) {
        Write-Host "       Waiting for server... ($waited s)" -ForegroundColor DarkGray
    }
}

if ($waited -ge $maxWait) {
    Write-Host "  WARNING: Server taking longer than expected." -ForegroundColor Yellow
}

# 6. Start Agent Runner (spawns all trading agents)
Write-Host "  [6/9] Starting Agent Runner (spawns trading bots)..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx tsx scripts/agent_runner.ts" -WindowStyle Minimized
Start-Sleep -Milliseconds 1000
Write-Host "  [6/9] Agent Runner started (trading bots launching)" -ForegroundColor Green

# 7. Launch Halo Agent Terminals (6 Claude Code sessions)
Write-Host "  [7/9] Launching 6 Halo Agent terminals..." -ForegroundColor Yellow
$launchAgentsBat = Join-Path $scriptDir "LAUNCH_AGENTS.bat"
if (Test-Path $launchAgentsBat) {
    Write-Host "       Script found: $launchAgentsBat" -ForegroundColor DarkGray
    # Use cmd.exe /c to run the batch file — proven reliable method (see HALO_LESSONS.md)
    # Do NOT use Start-Process powershell or Start-Process wt — both fail (Attempts 5-7)
    $agentProcess = Start-Process cmd.exe -ArgumentList "/c `"$launchAgentsBat`"" -WindowStyle Normal -PassThru
    Write-Host "       Agent launcher PID: $($agentProcess.Id)" -ForegroundColor DarkGray
    Write-Host "       Waiting for agents to spawn (this takes ~20 seconds)..." -ForegroundColor DarkGray
    $agentProcess.WaitForExit(60000) | Out-Null
    Write-Host "  [7/9] 6 Halo Agent terminals spawned" -ForegroundColor Green
} else {
    Write-Host "  [7/9] SKIPPED - LAUNCH_AGENTS.bat not found at: $launchAgentsBat" -ForegroundColor Red
}

# 8. Start Watchdog (auto-restarts dead agents)
Write-Host "  [8/9] Starting Halo Watchdog (port 3002)..." -ForegroundColor Yellow
$watchdogScript = Join-Path $scriptDir "HALO_WATCHDOG.ps1"
if (Test-Path $watchdogScript) {
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$watchdogScript`"" -WindowStyle Minimized
    Start-Sleep -Milliseconds 1500
    Write-Host "  [8/9] Watchdog running on port 3002 (auto-restart enabled)" -ForegroundColor Green
} else {
    Write-Host "  [8/9] SKIPPED - HALO_WATCHDOG.ps1 not found" -ForegroundColor Red
}

# 9. Open Browser
Write-Host "  [9/9] Opening browser..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
Start-Process "http://localhost:3000/activity-feed"
Write-Host "  [9/9] Browser launched" -ForegroundColor Green

# Done
Write-Host ""
Write-Host "  +============================================+" -ForegroundColor Green
Write-Host "  |   HALO SYSTEM ONLINE                       |" -ForegroundColor Green
Write-Host "  +============================================+" -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard:      http://localhost:3000" -ForegroundColor White
Write-Host "  Activity Feed:  http://localhost:3000/activity-feed" -ForegroundColor White
Write-Host "  Halo Command:   http://localhost:3000/halo-command" -ForegroundColor White
Write-Host "  Agents:         http://localhost:3000/agents" -ForegroundColor White
Write-Host ""
Write-Host "  Premium 23rd Century UI is LIVE" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Running processes:" -ForegroundColor DarkGray
Write-Host "    - Next.js Dashboard (port 3000) [minimized]" -ForegroundColor DarkGray
Write-Host "    - Activity Bridge WebSocket (port 3001) [minimized]" -ForegroundColor DarkGray
Write-Host "    - Agent Runner (trading bots) [minimized]" -ForegroundColor DarkGray
Write-Host "    - Halo Watchdog (port 3002) [minimized]" -ForegroundColor DarkGray
Write-Host "    - 6 Halo Agent Claude terminals [cmd.exe windows]" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Close the minimized cmd windows to stop backend services." -ForegroundColor DarkGray
Write-Host "  Close agent cmd windows to stop Halo agents." -ForegroundColor DarkGray
Write-Host ""
Read-Host "  Press Enter to close this launcher"
