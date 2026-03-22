# HALO_WATCHDOG.ps1 - Autonomous Heartbeat Monitor & Agent Auto-Restart System
# Monitors HALO agents for stale heartbeats and auto-restarts dead agents
#
# Usage:
#   .\HALO_WATCHDOG.ps1                  # Start the watchdog
#   Ctrl+C to gracefully shutdown
#
# HTTP Control API (port 3002):
#   GET  http://localhost:3002/status           # All agent statuses
#   POST http://localhost:3002/restart?agent=chief      # Restart specific agent
#   POST http://localhost:3002/restart-all      # Kill + relaunch all agents
#   POST http://localhost:3002/stop?agent=chief         # Stop without restart
#   POST http://localhost:3002/stop-all         # Stop all agents + watchdog

$ErrorActionPreference = "SilentlyContinue"
$WarningPreference = "SilentlyContinue"

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Agent definitions
$agents = @(
    @{ Name = "Chief";   SoulFile = "CHIEF_SOUL.md" },
    @{ Name = "Arbiter"; SoulFile = "ARBITER_SOUL.md" },
    @{ Name = "Ops";     SoulFile = "OPS_SOUL.md" },
    @{ Name = "Hunter";  SoulFile = "HUNTER_SOUL.md" },
    @{ Name = "Cortana"; SoulFile = "CORTANA_SOUL.md" },
    @{ Name = "Scout";   SoulFile = "SCOUT_SOUL.md" }
)

# Paths
$heartbeatDir = Join-Path $scriptDir "data" "halo-heartbeats"
$watchdogLog = Join-Path $scriptDir "data" "halo-watchdog.log"
$registryPath = Join-Path $scriptDir "data" "agent-registry.json"
$tempDir = Join-Path $scriptDir "data" "halo-launchers"

# Monitoring parameters
$heartbeatCheckInterval = 120       # seconds (check every 2 minutes)
$heartbeatStaleThreshold = 600      # seconds (10 minutes = heartbeat is stale)
$httpListenerPort = 3002
$maxRestartAttempts = 3

# Tracking state
$script:watchdogState = @{
    running = $true
    httpListener = $null
    lastHeartbeats = @{}
    restartCounts = @{}
    shutdownRequested = $false
}

# ─────────────────────────────────────────────────────────────────────────────
# LOGGING FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

function Log-Message {
    param(
        [string]$Category = "WATCHDOG",
        [string]$Message,
        [string]$Color = "White"
    )

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$timestamp] [$Category] $Message"

    # Write to console
    Write-Host $logLine -ForegroundColor $Color

    # Append to log file
    Add-Content -Path $watchdogLog -Value $logLine -Encoding UTF8 -ErrorAction SilentlyContinue
}

function Log-Warning {
    param([string]$Message)
    Log-Message -Category "WARN" -Message $Message -Color "Yellow"
}

function Log-Error {
    param([string]$Message)
    Log-Message -Category "ERROR" -Message $Message -Color "Red"
}

function Log-Success {
    param([string]$Message)
    Log-Message -Category "OK" -Message $Message -Color "Green"
}

# ─────────────────────────────────────────────────────────────────────────────
# HEARTBEAT MONITORING
# ─────────────────────────────────────────────────────────────────────────────

function Get-AgentHeartbeat {
    param([string]$AgentName)

    $heartbeatFile = Join-Path $heartbeatDir "$($AgentName.ToLower()).json"

    if (-not (Test-Path $heartbeatFile)) {
        return $null
    }

    try {
        $content = Get-Content $heartbeatFile -Raw -Encoding UTF8
        $hb = $content | ConvertFrom-Json
        return $hb
    } catch {
        return $null
    }
}

function Get-HeartbeatAge {
    param($Heartbeat)

    if (-not $Heartbeat) {
        return [System.Int32]::MaxValue
    }

    try {
        $hbTime = [DateTime]::Parse($Heartbeat.timestamp)
        $age = ((Get-Date) - $hbTime).TotalSeconds
        return [int]$age
    } catch {
        return [System.Int32]::MaxValue
    }
}

function Check-AgentHealth {
    param([string]$AgentName)

    $hb = Get-AgentHeartbeat -AgentName $AgentName
    $age = Get-HeartbeatAge -Heartbeat $hb

    $isStale = $age -gt $heartbeatStaleThreshold

    return @{
        AgentName = $AgentName
        HasHeartbeat = ($hb -ne $null)
        Heartbeat = $hb
        AgeSeconds = $age
        IsStale = $isStale
        Status = if ($hb) { $hb.status } else { "unknown" }
        LastTask = if ($hb) { $hb.lastTask } else { "N/A" }
        CycleCount = if ($hb) { $hb.cycleCount } else { 0 }
    }
}

function Get-AllAgentStatus {
    $statuses = @()
    foreach ($agent in $agents) {
        $health = Check-AgentHealth -AgentName $agent.Name
        $statuses += $health
    }
    return $statuses
}

# ─────────────────────────────────────────────────────────────────────────────
# AGENT RESTART FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

function Kill-AgentProcess {
    param([string]$AgentName)

    $killed = 0

    # Try to find Claude processes by window title
    $cmdProcs = Get-Process -Name "cmd" -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowTitle -match "HALO: $AgentName" }

    foreach ($proc in $cmdProcs) {
        try {
            Stop-Process -Id $proc.Id -Force
            Log-Success "Killed cmd.exe process for $AgentName (PID $($proc.Id))"
            $killed++
        } catch {
            Log-Error "Failed to kill process for $AgentName: $_"
        }
    }

    # Try to find Claude processes running HALO launchers
    $claudeProcs = Get-Process -Name "claude" -ErrorAction SilentlyContinue
    foreach ($proc in $claudeProcs) {
        try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)" -ErrorAction SilentlyContinue).CommandLine
            if ($cmdLine -and ($cmdLine -match "HALO: $AgentName" -or $cmdLine -match $AgentName)) {
                Stop-Process -Id $proc.Id -Force
                Log-Success "Killed Claude process for $AgentName (PID $($proc.Id))"
                $killed++
            }
        } catch {}
    }

    return $killed -gt 0
}

function Launch-Agent {
    param([string]$AgentName)

    $agentDef = $agents | Where-Object { $_.Name -eq $AgentName }
    if (-not $agentDef) {
        Log-Error "Agent definition not found for $AgentName"
        return $false
    }

    $soulFileName = $agentDef.SoulFile
    $soulPath = Join-Path $scriptDir "Library\agent-souls\$soulFileName"

    # Verify soul file exists
    if (-not (Test-Path $soulPath)) {
        Log-Error "Soul file not found for $AgentName at $soulPath"
        return $false
    }

    # Create temp launcher directory
    if (-not (Test-Path $tempDir)) {
        New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    }

    # Create .cmd launcher
    $launcherPath = Join-Path $tempDir "launch-$AgentName.cmd"

    $agentNameLower = $AgentName.ToLower()
    $cmdContent = @"
@echo off
title HALO: $AgentName [WATCHDOG-RESTART]
cd /d "$scriptDir"
echo.
echo   ==========================================
echo     HALO AGENT: $AgentName
echo     Restarted by: WATCHDOG
echo     Mode: AUTONOMOUS (skip permissions)
echo   ==========================================
echo.
echo   Starting Claude session...
echo.
call claude --dangerously-skip-permissions "You are $AgentName. FIRST: Use the Read tool to read your SOUL file at '$soulPath' then internalize everything in it. THEN: Begin your PRIMARY WORKFLOW immediately. You are an EMPLOYEE -- do NOT stop after one task. Create Jira tickets for blockers. Check for new work assigned to you. Loop continuously. Every 5 minutes, write a heartbeat to data/halo-heartbeats/$agentNameLower.json with JSON containing agent, timestamp, status, lastTask, cycleCount fields."
echo.
echo   [Claude session ended]
echo   Exit code: %errorlevel%
echo.
cmd /k echo Type 'exit' to close this window.
"@

    try {
        $cmdContent | Set-Content -Path $launcherPath -Encoding OEM -ErrorAction Stop
    } catch {
        Log-Error "Failed to create launcher for $AgentName : $_"
        return $false
    }

    # Launch using cmd.exe /k — proven to work via HALO_DIAGNOSE.bat
    # (Windows Terminal wt new-tab was losing the working directory and killing windows)
    try {
        Start-Process cmd.exe -ArgumentList "/k", "`"$launcherPath`"" -ErrorAction Stop
        Log-Success "Launched $AgentName via cmd.exe"
        return $true
    } catch {
        Log-Error "Failed to launch $AgentName : $_"
        return $false
    }
}

function Restart-Agent {
    param([string]$AgentName)

    Log-Warning "Restarting agent: $AgentName"

    # Increment restart counter
    if (-not $script:watchdogState.restartCounts[$AgentName]) {
        $script:watchdogState.restartCounts[$AgentName] = 0
    }
    $script:watchdogState.restartCounts[$AgentName]++

    $attemptNum = $script:watchdogState.restartCounts[$AgentName]
    if ($attemptNum -gt $maxRestartAttempts) {
        Log-Error "Agent $AgentName exceeded max restart attempts ($maxRestartAttempts). Manual intervention required."
        return $false
    }

    # Kill existing process
    Kill-AgentProcess -AgentName $AgentName
    Start-Sleep -Milliseconds 500

    # Launch new process
    $success = Launch-Agent -AgentName $AgentName

    if ($success) {
        Log-Success "Agent $AgentName restarted (attempt $attemptNum/$maxRestartAttempts)"
        # Reset counter after successful restart
        $script:watchdogState.restartCounts[$AgentName] = 0
        # Clear stale heartbeat
        $heartbeatFile = Join-Path $heartbeatDir "$($AgentName.ToLower()).json"
        if (Test-Path $heartbeatFile) {
            Remove-Item $heartbeatFile -Force -ErrorAction SilentlyContinue
        }
        return $true
    } else {
        Log-Error "Failed to restart $AgentName (attempt $attemptNum/$maxRestartAttempts)"
        return $false
    }
}

function Restart-AllAgents {
    Log-Warning "RESTART-ALL requested. Killing all agents..."

    foreach ($agent in $agents) {
        Kill-AgentProcess -AgentName $agent.Name
    }

    Start-Sleep -Seconds 1

    Log-Warning "Relaunching all agents..."
    $failures = 0
    foreach ($agent in $agents) {
        if (-not (Launch-Agent -AgentName $agent.Name)) {
            $failures++
        }
        Start-Sleep -Seconds 2
    }

    if ($failures -eq 0) {
        Log-Success "All agents restarted successfully"
    } else {
        Log-Error "$failures agents failed to restart"
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# HTTP CONTROL API
# ─────────────────────────────────────────────────────────────────────────────

function Start-HttpListener {
    try {
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://localhost:$httpListenerPort/")
        $listener.Start()
        Log-Success "HTTP listener started on port $httpListenerPort"
        return $listener
    } catch {
        Log-Error "Failed to start HTTP listener: $_"
        return $null
    }
}

function Handle-HttpRequest {
    param($context)

    $request = $context.Request
    $response = $context.Response

    # Parse URL and method
    $path = $request.Url.AbsolutePath
    $method = $request.HttpMethod
    $query = $request.Url.Query

    $responseText = ""
    $statusCode = 200

    # Route the request
    if ($path -eq "/status" -and $method -eq "GET") {
        # Return all agent statuses as JSON
        $statuses = Get-AllAgentStatus
        $statusJson = @{
            timestamp = Get-Date -Format "o"
            agents = @()
        }

        foreach ($status in $statuses) {
            $statusJson.agents += @{
                name = $status.AgentName
                status = $status.Status
                hasHeartbeat = $status.HasHeartbeat
                ageSeconds = $status.AgeSeconds
                isStale = $status.IsStale
                lastTask = $status.LastTask
                cycleCount = $status.CycleCount
            }
        }

        $responseText = $statusJson | ConvertTo-Json

    } elseif ($path -eq "/restart" -and $method -eq "POST") {
        # Restart a specific agent
        if ($query -like "*agent=*") {
            $agentName = [System.Web.HttpUtility]::ParseQueryString($query)["agent"]
            $agentDef = $agents | Where-Object { $_.Name -eq $agentName -or $_.Name.ToLower() -eq $agentName.ToLower() }

            if ($agentDef) {
                $success = Restart-Agent -AgentName $agentDef.Name
                $responseText = @{
                    action = "restart"
                    agent = $agentDef.Name
                    success = $success
                    message = if ($success) { "Agent restart initiated" } else { "Agent restart failed" }
                } | ConvertTo-Json
            } else {
                $statusCode = 400
                $responseText = @{
                    error = "Agent not found"
                    requested = $agentName
                } | ConvertTo-Json
            }
        } else {
            $statusCode = 400
            $responseText = @{
                error = "Missing 'agent' parameter"
                usage = "POST /restart?agent=chief"
            } | ConvertTo-Json
        }

    } elseif ($path -eq "/restart-all" -and $method -eq "POST") {
        # Restart all agents
        Restart-AllAgents
        $responseText = @{
            action = "restart-all"
            success = $true
            message = "Restart-all initiated for all agents"
        } | ConvertTo-Json

    } elseif ($path -eq "/stop" -and $method -eq "POST") {
        # Stop a specific agent
        if ($query -like "*agent=*") {
            $agentName = [System.Web.HttpUtility]::ParseQueryString($query)["agent"]
            $agentDef = $agents | Where-Object { $_.Name -eq $agentName -or $_.Name.ToLower() -eq $agentName.ToLower() }

            if ($agentDef) {
                $success = Kill-AgentProcess -AgentName $agentDef.Name
                $responseText = @{
                    action = "stop"
                    agent = $agentDef.Name
                    success = $success
                    message = if ($success) { "Agent stopped" } else { "No process found" }
                } | ConvertTo-Json
            } else {
                $statusCode = 400
                $responseText = @{
                    error = "Agent not found"
                    requested = $agentName
                } | ConvertTo-Json
            }
        } else {
            $statusCode = 400
            $responseText = @{
                error = "Missing 'agent' parameter"
                usage = "POST /stop?agent=chief"
            } | ConvertTo-Json
        }

    } elseif ($path -eq "/stop-all" -and $method -eq "POST") {
        # Stop all agents and shutdown watchdog
        Log-Warning "STOP-ALL requested via HTTP. Stopping all agents and watchdog..."
        foreach ($agent in $agents) {
            Kill-AgentProcess -AgentName $agent.Name
        }
        $responseText = @{
            action = "stop-all"
            success = $true
            message = "All agents stopped. Watchdog shutting down."
        } | ConvertTo-Json
        $script:watchdogState.shutdownRequested = $true

    } else {
        $statusCode = 404
        $responseText = @{
            error = "Endpoint not found"
            available = @(
                "GET /status",
                "POST /restart?agent={name}",
                "POST /restart-all",
                "POST /stop?agent={name}",
                "POST /stop-all"
            )
        } | ConvertTo-Json
    }

    # Send response
    try {
        $response.StatusCode = $statusCode
        $response.ContentType = "application/json"
        $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseText)
        $response.ContentLength64 = $buffer.Length
        $response.OutputStream.Write($buffer, 0, $buffer.Length)
        $response.OutputStream.Close()
    } catch {
        Log-Error "Error sending HTTP response: $_"
    }
}

function Run-HttpListener {
    param($listener)

    while ($script:watchdogState.running -and -not $script:watchdogState.shutdownRequested) {
        try {
            $context = $listener.GetContext()
            Handle-HttpRequest -context $context
        } catch {
            if ($script:watchdogState.running) {
                Log-Error "HTTP listener error: $_"
            }
        }
    }

    try {
        $listener.Stop()
        $listener.Close()
    } catch {}
}

# ─────────────────────────────────────────────────────────────────────────────
# MAIN MONITORING LOOP
# ─────────────────────────────────────────────────────────────────────────────

function Start-MonitoringLoop {
    Log-Message -Category "MONITOR" -Message "Starting monitoring loop (check interval: ${heartbeatCheckInterval}s, stale threshold: ${heartbeatStaleThreshold}s)" -Color "Cyan"

    while ($script:watchdogState.running -and -not $script:watchdogState.shutdownRequested) {
        try {
            # Check all agents
            $statuses = Get-AllAgentStatus

            foreach ($status in $statuses) {
                $agentName = $status.AgentName

                if ($status.IsStale) {
                    $ageMinutes = [math]::Round($status.AgeSeconds / 60, 1)
                    Log-Warning "Agent '$agentName' heartbeat stale (age: ${ageMinutes}m). Restarting..."
                    Restart-Agent -AgentName $agentName
                } elseif ($status.HasHeartbeat) {
                    # Heartbeat is fresh - log status
                    $ageSeconds = $status.AgeSeconds
                    # Only log periodically to avoid spam (every 10 checks)
                    if ($script:watchdogState.lastHeartbeats[$agentName] -ne $status.CycleCount) {
                        Log-Success "$agentName: alive (cycle $($status.CycleCount), age ${ageSeconds}s, status: $($status.Status))"
                        $script:watchdogState.lastHeartbeats[$agentName] = $status.CycleCount
                    }
                } else {
                    # No heartbeat file yet (might be starting)
                    Log-Message -Category "INIT" -Message "$agentName: no heartbeat yet (starting up?)" -Color "DarkGray"
                }
            }

            # Sleep until next check
            Start-Sleep -Seconds $heartbeatCheckInterval

        } catch {
            Log-Error "Error in monitoring loop: $_"
            Start-Sleep -Seconds 5
        }
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# STARTUP SEQUENCE
# ─────────────────────────────────────────────────────────────────────────────

function Show-Banner {
    Write-Host ""
    Write-Host "  +════════════════════════════════════════════════════════+" -ForegroundColor Cyan
    Write-Host "  |                                                        |" -ForegroundColor Cyan
    Write-Host "  |   H A L O   W A T C H D O G                           |" -ForegroundColor Cyan
    Write-Host "  |   Autonomous Agent Heartbeat Monitor                  |" -ForegroundColor Magenta
    Write-Host "  |   v1.0 - Starts $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')                |" -ForegroundColor DarkGray
    Write-Host "  |                                                        |" -ForegroundColor Cyan
    Write-Host "  +════════════════════════════════════════════════════════+" -ForegroundColor Cyan
    Write-Host ""
}

function Initialize-Watchdog {
    # Create data directories
    if (-not (Test-Path $heartbeatDir)) {
        New-Item -ItemType Directory -Path $heartbeatDir -Force | Out-Null
        Log-Success "Created heartbeat directory"
    }

    if (-not (Test-Path (Split-Path $watchdogLog))) {
        New-Item -ItemType Directory -Path (Split-Path $watchdogLog) -Force | Out-Null
    }

    # Clear old log file
    if (Test-Path $watchdogLog) {
        Remove-Item $watchdogLog -Force -ErrorAction SilentlyContinue
    }

    Log-Message -Category "STARTUP" -Message "HALO Watchdog initialization" -Color "Cyan"
    Log-Message -Category "CONFIG" -Message "Project root: $scriptDir" -Color "DarkGray"
    Log-Message -Category "CONFIG" -Message "Heartbeat dir: $heartbeatDir" -Color "DarkGray"
    Log-Message -Category "CONFIG" -Message "Check interval: ${heartbeatCheckInterval}s" -Color "DarkGray"
    Log-Message -Category "CONFIG" -Message "Stale threshold: ${heartbeatStaleThreshold}s (10m)" -Color "DarkGray"
    Log-Message -Category "CONFIG" -Message "HTTP listener: port $httpListenerPort" -Color "DarkGray"
    Log-Message -Category "CONFIG" -Message "Max restart attempts: $maxRestartAttempts" -Color "DarkGray"
    Log-Message -Category "AGENTS" -Message "Monitoring $(($agents | Measure-Object).Count) agents" -Color "Cyan"
    foreach ($agent in $agents) {
        Log-Message -Category "AGENTS" -Message "  • $($agent.Name)" -Color "DarkGray"
    }
}

function Main {
    Show-Banner
    Initialize-Watchdog

    Write-Host ""
    Log-Message -Category "STARTUP" -Message "Starting HTTP listener on port $httpListenerPort..." -Color "Yellow"

    # Start HTTP listener in background runspace
    $httpListener = Start-HttpListener
    if (-not $httpListener) {
        Log-Error "Failed to start HTTP listener. Continuing without HTTP control."
        $httpListener = $null
    } else {
        $listenerJob = {
            param($listener)
            Run-HttpListener -listener $listener
        }
        $listenerRunspace = [PowerShell]::Create()
        [void]$listenerRunspace.AddScript($function:Run-HttpListener)
        [void]$listenerRunspace.AddParameter("listener", $httpListener)
        [void]$listenerRunspace.BeginInvoke()
        $script:watchdogState.httpListener = $httpListener
    }

    Write-Host ""
    Log-Message -Category "STARTUP" -Message "Watchdog ready. Entering monitoring loop..." -Color "Green"
    Write-Host ""
    Log-Message -Category "CONTROL" -Message "HTTP API available:" -Color "DarkGray"
    Log-Message -Category "CONTROL" -Message "  GET  http://localhost:$httpListenerPort/status" -Color "DarkGray"
    Log-Message -Category "CONTROL" -Message "  POST http://localhost:$httpListenerPort/restart?agent=chief" -Color "DarkGray"
    Log-Message -Category "CONTROL" -Message "  POST http://localhost:$httpListenerPort/restart-all" -Color "DarkGray"
    Log-Message -Category "CONTROL" -Message "  POST http://localhost:$httpListenerPort/stop?agent=chief" -Color "DarkGray"
    Log-Message -Category "CONTROL" -Message "  POST http://localhost:$httpListenerPort/stop-all" -Color "DarkGray"
    Write-Host ""
    Log-Message -Category "CONTROL" -Message "Press Ctrl+C to shutdown watchdog gracefully" -Color "Yellow"
    Write-Host ""

    # Setup Ctrl+C handler
    $null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
        Log-Warning "Shutdown requested (Ctrl+C)"
        $script:watchdogState.running = $false
        $script:watchdogState.shutdownRequested = $true
    }

    # Start monitoring loop
    Start-MonitoringLoop

    # Cleanup
    Log-Warning "Watchdog shutting down..."
    if ($script:watchdogState.httpListener) {
        try {
            $script:watchdogState.httpListener.Stop()
            $script:watchdogState.httpListener.Close()
        } catch {}
    }
    Log-Success "Watchdog stopped"
}

# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

Main
