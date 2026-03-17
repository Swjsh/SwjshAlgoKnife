# ═══════════════════════════════════════════════════════════════════════════════
#  SwjshAK — GCP Status Bridge
#
#  Query GCP VM status without direct HTTP access. Desktop Claude uses this to:
#    • Check container health and uptime
#    • Verify supervisord / docker compose processes
#    • Read recent logs from all services
#    • Get current agents_db.json summary
#    • Check disk and memory usage
#    • Report brain sync status
#
#  Usage:
#    ./scripts/gcp-status.ps1                    # Full status report
#    ./scripts/gcp-status.ps1 -Quick             # Quick status only
#    ./scripts/gcp-status.ps1 -Logs              # Full log dump
#    ./scripts/gcp-status.ps1 -AgentsOnly        # Just agents_db.json summary
#
# ═══════════════════════════════════════════════════════════════════════════════

param(
    [switch]$Quick,
    [switch]$Logs,
    [switch]$AgentsOnly,
    [string]$GcpProject = "swjsh-algo-knife",
    [string]$GcpInstance = "swjsh-server",
    [string]$GcpZone = "us-central1-a"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# ─────────────────────────────────────────────────────────────────────────────
# Utility Functions
# ─────────────────────────────────────────────────────────────────────────────

function Write-StatusSection {
    param([string]$Title, [string]$Color = "Cyan")
    Write-Host ""
    Write-Host "► $Title" -ForegroundColor $Color
    Write-Host "─" * 60 -ForegroundColor DarkGray
}

function Write-StatusItem {
    param([string]$Label, [string]$Value, [string]$Color = "White")
    $paddedLabel = "$Label".PadRight(25)
    Write-Host "  $paddedLabel $Value" -ForegroundColor $Color
}

function Ssh-Command {
    param([string]$Command)
    try {
        $output = gcloud compute ssh $GcpInstance `
            --zone=$GcpZone --project=$GcpProject --quiet `
            --command="$Command" 2>&1
        return $output
    } catch {
        return "ERROR: $_"
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# QUICK MODE: Container Status + Process List
# ─────────────────────────────────────────────────────────────────────────────

if ($Quick) {
    Write-Host ""
    Write-Host "SwjshAK — GCP Status (Quick)" -ForegroundColor Cyan
    Write-Host "═" * 60 -ForegroundColor Cyan
    Write-StatusSection "Container Status"

    # Docker compose status
    $dockerStatus = Ssh-Command "docker compose ps 2>/dev/null || echo 'N/A'"
    if ($dockerStatus -match "Up") {
        Write-Host "  ✓ Containers Running:" -ForegroundColor Green
        $dockerStatus -split "`n" | Where-Object { $_.Trim() -and $_ -match "Up|Exited" } | ForEach-Object {
            if ($_ -match "Up") {
                Write-Host "    ✓ $_" -ForegroundColor Green
            } else {
                Write-Host "    ✗ $_" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  ⚠  Docker compose not running" -ForegroundColor Yellow
    }

    Write-StatusSection "Supervisord Status"
    $supervisorStatus = Ssh-Command "supervisorctl status 2>/dev/null | head -5 || echo 'N/A'"
    if ($supervisorStatus -notmatch "N/A") {
        Write-Host "  Processes:" -ForegroundColor White
        $supervisorStatus -split "`n" | Where-Object { $_.Trim() } | ForEach-Object {
            if ($_ -match "RUNNING") {
                Write-Host "    ✓ $_" -ForegroundColor Green
            } elseif ($_ -match "FATAL|EXITED") {
                Write-Host "    ✗ $_" -ForegroundColor Red
            } else {
                Write-Host "    • $_" -ForegroundColor DarkGray
            }
        }
    } else {
        Write-Host "  Supervisord not active or not using it" -ForegroundColor DarkGray
    }

    Write-Host ""
    exit 0
}

# ─────────────────────────────────────────────────────────────────────────────
# AGENTS-ONLY MODE: agents_db.json Summary
# ─────────────────────────────────────────────────────────────────────────────

if ($AgentsOnly) {
    Write-Host ""
    Write-Host "SwjshAK — Agents Status" -ForegroundColor Cyan
    Write-Host "═" * 60 -ForegroundColor Cyan
    Write-StatusSection "Active Agents"

    $agentsJson = Ssh-Command "cat ~/SwjshAlgoKnife/data/agents_db.json 2>/dev/null || echo '{\"agents\":[]}'"

    try {
        $agents = $agentsJson | ConvertFrom-Json
        if ($agents.agents -and $agents.agents.Count -gt 0) {
            Write-Host "  Found $($agents.agents.Count) agent(s):" -ForegroundColor White
            $agents.agents | ForEach-Object {
                $status = if ($_.status -eq "running") { "✓" } else { "⚠" }
                $color = if ($_.status -eq "running") { "Green" } else { "Yellow" }
                Write-Host "    $status $_($name)  Status: $($_.status)  PnL: $$($_.pnl ?? '0')" -ForegroundColor $color
                Write-Host "       Last Update: $($_.lastUpdate ?? 'N/A')" -ForegroundColor DarkGray
            }
        } else {
            Write-Host "  No agents configured" -ForegroundColor DarkGray
        }
    } catch {
        Write-Host "  Error parsing agents_db.json: $_" -ForegroundColor Red
    }

    Write-Host ""
    exit 0
}

# ─────────────────────────────────────────────────────────────────────────────
# LOGS MODE: Full Log Dump
# ─────────────────────────────────────────────────────────────────────────────

if ($Logs) {
    Write-Host ""
    Write-Host "SwjshAK — Full Logs" -ForegroundColor Cyan
    Write-Host "═" * 60 -ForegroundColor Cyan

    $logFiles = @(
        @{ Name = "Next.js Server"; Path = "~/SwjshAlgoKnife/data/logs/nextjs.log" },
        @{ Name = "Agent Runner"; Path = "~/SwjshAlgoKnife/data/logs/agent-runner.log" },
        @{ Name = "Watchdog"; Path = "~/SwjshAlgoKnife/data/logs/watchdog.log" },
        @{ Name = "OpenClaw"; Path = "~/SwjshAlgoKnife/data/logs/openclaw.log" }
    )

    $logFiles | ForEach-Object {
        Write-StatusSection $_.Name
        $logContent = Ssh-Command "tail -20 $($_.Path) 2>/dev/null || echo 'Log file not found'"
        if ($logContent -match "Log file not found") {
            Write-Host "  (log file not found)" -ForegroundColor DarkGray
        } else {
            $logContent -split "`n" | Where-Object { $_.Trim() } | ForEach-Object {
                Write-Host "  $_" -ForegroundColor DarkGray
            }
        }
    }

    Write-Host ""
    exit 0
}

# ─────────────────────────────────────────────────────────────────────────────
# FULL MODE: Complete Status Report
# ─────────────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "SwjshAK — GCP Status Report" -ForegroundColor Cyan
Write-Host "═" * 60 -ForegroundColor Cyan
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# Section 1: Instance & Connection Info
# ─────────────────────────────────────────────────────────────────────────────

Write-StatusSection "Instance Information"

$instanceInfo = gcloud compute instances describe $GcpInstance `
    --zone=$GcpZone --project=$GcpProject `
    --format="get(status,machineType,networkInterfaces[0].accessConfigs[0].natIP)" 2>&1

$parts = $instanceInfo -split "`n"
$status = if ($parts[0] -eq "RUNNING") { "Running" } else { $parts[0] }
$statusColor = if ($parts[0] -eq "RUNNING") { "Green" } else { "Yellow" }
$ip = $parts[2]

Write-StatusItem "Instance" $GcpInstance "White"
Write-StatusItem "Status" $status $statusColor
Write-StatusItem "Zone" $GcpZone "White"
Write-StatusItem "External IP" $ip "Cyan"

# ─────────────────────────────────────────────────────────────────────────────
# Section 2: Container & Process Status
# ─────────────────────────────────────────────────────────────────────────────

Write-StatusSection "Container Status"

$dockerStatus = Ssh-Command "docker compose ps 2>/dev/null || echo 'N/A'"
$runningCount = ($dockerStatus | Select-String "Up" | Measure-Object).Count
$totalCount = ($dockerStatus | Select-String "^\w" | Measure-Object).Count

Write-StatusItem "Docker Compose" "$runningCount/$totalCount running" $(if ($runningCount -eq $totalCount) { "Green" } else { "Yellow" })

if ($dockerStatus -notmatch "N/A" -and $dockerStatus.Length -gt 0) {
    Write-Host "    Details:" -ForegroundColor DarkGray
    $dockerStatus -split "`n" | Where-Object { $_.Trim() -and $_ -notmatch "^NAME" } | ForEach-Object {
        if ($_ -match "Up") {
            Write-Host "      ✓ $_" -ForegroundColor Green
        } elseif ($_ -match "Exited") {
            Write-Host "      ✗ $_" -ForegroundColor Red
        }
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# Section 3: Supervisord Process Status
# ─────────────────────────────────────────────────────────────────────────────

Write-StatusSection "Supervisord Process Status"

$supervisorStatus = Ssh-Command "supervisorctl status 2>/dev/null || echo 'SUPERVISORD_INACTIVE'"

if ($supervisorStatus -notmatch "SUPERVISORD_INACTIVE") {
    $runningProcs = ($supervisorStatus | Select-String "RUNNING" | Measure-Object).Count
    $totalProcs = ($supervisorStatus | Select-String "RUNNING|FATAL|EXITED|STOPPED" | Measure-Object).Count

    Write-StatusItem "Processes Running" "$runningProcs/$totalProcs" $(if ($runningProcs -ge 3) { "Green" } else { "Red" })

    if ($supervisorStatus.Length -gt 0) {
        Write-Host "    Details:" -ForegroundColor DarkGray
        $supervisorStatus -split "`n" | Where-Object { $_.Trim() } | ForEach-Object {
            if ($_ -match "RUNNING") {
                Write-Host "      ✓ $_" -ForegroundColor Green
            } elseif ($_ -match "FATAL|EXITED") {
                Write-Host "      ✗ $_" -ForegroundColor Red
            } elseif ($_ -match "STOPPED") {
                Write-Host "      ○ $_" -ForegroundColor Yellow
            }
        }
    }
} else {
    Write-StatusItem "Supervisord" "Not active" "DarkGray"
}

# ─────────────────────────────────────────────────────────────────────────────
# Section 4: Application Health
# ─────────────────────────────────────────────────────────────────────────────

Write-StatusSection "Application Health"

# Check HTTP health endpoint
$healthResponse = Ssh-Command "curl -s -f http://localhost:3000/api/health --max-time 3 2>/dev/null || echo 'TIMEOUT'"

if ($healthResponse -match "ok|UP|healthy" -or $healthResponse.Length -lt 50) {
    Write-StatusItem "Health Endpoint" "✓ Responsive" "Green"
} else {
    Write-StatusItem "Health Endpoint" "⚠ Not responding" "Yellow"
}

# Get container uptime
$containerUptime = Ssh-Command "docker inspect swjsh-next-app --format='{{json .State}}' 2>/dev/null | grep -o '\"StartedAt\":\"[^\"]*' | cut -d'\"' -f4 || echo 'N/A'"
Write-StatusItem "Container Started" $containerUptime "DarkGray"

# ─────────────────────────────────────────────────────────────────────────────
# Section 5: Active Agents
# ─────────────────────────────────────────────────────────────────────────────

Write-StatusSection "Active Agents"

$agentsJson = Ssh-Command "cat ~/SwjshAlgoKnife/data/agents_db.json 2>/dev/null || echo '{\"agents\":[]}"
try {
    $agents = $agentsJson | ConvertFrom-Json
    if ($agents.agents -and $agents.agents.Count -gt 0) {
        Write-Host "  Found $($agents.agents.Count) agent(s):" -ForegroundColor White
        $agents.agents | ForEach-Object {
            $statusIcon = if ($_.status -eq "running") { "✓" } else { "⚠" }
            $statusColor = if ($_.status -eq "running") { "Green" } else { "Yellow" }
            Write-Host "    $statusIcon $($_.name ?? 'Unknown')" -ForegroundColor $statusColor
            Write-Host "       Status: $($_.status ?? 'unknown') | PnL: $$($_.pnl ?? '0') | Updated: $($_.lastUpdate ?? 'never')" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "  No agents configured" -ForegroundColor DarkGray
    }
} catch {
    Write-Host "  Error parsing agents_db.json" -ForegroundColor Yellow
}

# ─────────────────────────────────────────────────────────────────────────────
# Section 6: System Resources
# ─────────────────────────────────────────────────────────────────────────────

Write-StatusSection "System Resources"

$diskUsage = Ssh-Command "df -h ~ | tail -1 | awk '{print \$3 \"/\" \$2 \" (\" \$5 \")\"}'"
$memUsage = Ssh-Command "free -h | grep Mem | awk '{print \$3 \"/\" \$2}'"
$loadAvg = Ssh-Command "uptime | grep -o 'load average.*'"

Write-StatusItem "Disk Usage" $diskUsage "White"
Write-StatusItem "Memory Usage" $memUsage "White"
Write-StatusItem "Load Average" $loadAvg "DarkGray"

# ─────────────────────────────────────────────────────────────────────────────
# Section 7: Recent Logs (Last 10 lines from each)
# ─────────────────────────────────────────────────────────────────────────────

Write-StatusSection "Recent Logs"

$logFiles = @(
    @{ Name = "Next.js"; Path = "~/SwjshAlgoKnife/data/logs/nextjs.log" },
    @{ Name = "Agent Runner"; Path = "~/SwjshAlgoKnife/data/logs/agent-runner.log" },
    @{ Name = "Watchdog"; Path = "~/SwjshAlgoKnife/data/logs/watchdog.log" }
)

$logFiles | ForEach-Object {
    Write-Host "  $($_.Name):" -ForegroundColor White
    $logContent = Ssh-Command "tail -5 $($_.Path) 2>/dev/null || echo '(log not found)'"
    $logContent -split "`n" | Where-Object { $_.Trim() } | ForEach-Object {
        Write-Host "    $_" -ForegroundColor DarkGray
    }
    Write-Host ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Section 8: Brain Sync Status
# ─────────────────────────────────────────────────────────────────────────────

Write-StatusSection "Brain Sync Status"

$lastBrainSync = Ssh-Command "ls -l ~/SwjshAlgoKnife/.git/COMMIT_EDITMSG 2>/dev/null | awk '{print \$6 \" \" \$7 \" \" \$8}' || echo 'N/A'"
Write-StatusItem "Last Sync" $lastBrainSync "DarkGray"

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "═" * 60 -ForegroundColor Cyan
Write-Host "Report generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Quick troubleshooting:" -ForegroundColor White
Write-Host "  View live logs:     gcloud compute ssh $GcpInstance --zone=$GcpZone -- 'docker compose logs -f'" -ForegroundColor DarkGray
Write-Host "  SSH into instance:  gcloud compute ssh $GcpInstance --zone=$GcpZone" -ForegroundColor DarkGray
Write-Host "  Restart services:   gcloud compute ssh $GcpInstance --zone=$GcpZone -- 'docker compose restart'" -ForegroundColor DarkGray
Write-Host ""
