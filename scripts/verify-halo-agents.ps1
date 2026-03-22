# verify-halo-agents.ps1 - Comprehensive HALO Agent Pipeline Verification
# Run this after launching agents to verify they're working

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir

Clear-Host
Write-Host ""
Write-Host "  +============================================================+" -ForegroundColor Cyan
Write-Host "  |   HALO AGENT PIPELINE VERIFICATION                         |" -ForegroundColor Cyan
Write-Host "  |   Checking all verification points...                      |" -ForegroundColor Cyan
Write-Host "  +============================================================+" -ForegroundColor Cyan
Write-Host ""

$checks = @{
    passed = 0
    failed = 0
    warnings = 0
}

function Write-Check {
    param([string]$Name, [string]$Status, [string]$Details)

    switch ($Status) {
        "PASS" {
            Write-Host "  [OK]   " -NoNewline -ForegroundColor Green
            $script:checks.passed++
        }
        "FAIL" {
            Write-Host "  [FAIL] " -NoNewline -ForegroundColor Red
            $script:checks.failed++
        }
        "WARN" {
            Write-Host "  [WARN] " -NoNewline -ForegroundColor Yellow
            $script:checks.warnings++
        }
        "INFO" {
            Write-Host "  [INFO] " -NoNewline -ForegroundColor Cyan
        }
    }
    Write-Host "$Name" -NoNewline
    if ($Details) {
        Write-Host " - $Details" -ForegroundColor DarkGray
    } else {
        Write-Host ""
    }
}

# ============================================================================
# CHECK 1: Temp Launcher Files
# ============================================================================
Write-Host "  --- CHECK 1: Temp Launcher Files ---" -ForegroundColor White
$tempDir = Join-Path $env:TEMP "halo-agents"
$agents = @("Chief", "Arbiter", "Ops", "Hunter", "Cortana", "Scout")

if (Test-Path $tempDir) {
    $launcherFiles = Get-ChildItem $tempDir -Filter "launch-*.cmd" -ErrorAction SilentlyContinue
    if ($launcherFiles.Count -ge 6) {
        Write-Check "Launcher files exist" "PASS" "$($launcherFiles.Count) .cmd files in temp"

        # Check content of one launcher
        $sampleLauncher = Get-Content (Join-Path $tempDir "launch-Chief.cmd") -Raw -ErrorAction SilentlyContinue
        if ($sampleLauncher -match "--dangerously-skip-permissions") {
            Write-Check "Permission bypass enabled" "PASS" "Agents will run autonomously"
        } else {
            Write-Check "Permission bypass enabled" "WARN" "Agents may prompt for permissions"
        }

        if ($sampleLauncher -match "--system-prompt") {
            Write-Check "System prompt injection" "PASS" "SOUL files injected properly"
        } else {
            Write-Check "System prompt injection" "FAIL" "SOUL files not injected"
        }
    } else {
        Write-Check "Launcher files exist" "FAIL" "Only $($launcherFiles.Count) files found"
    }
} else {
    Write-Check "Launcher files exist" "FAIL" "Temp directory not found - run LAUNCH_HALO.bat first"
}

Write-Host ""

# ============================================================================
# CHECK 2: Heartbeat Status
# ============================================================================
Write-Host "  --- CHECK 2: Heartbeat Status ---" -ForegroundColor White
$heartbeatPath = Join-Path $projectDir "data\heartbeat-status.json"

if (Test-Path $heartbeatPath) {
    $heartbeat = Get-Content $heartbeatPath -Raw | ConvertFrom-Json
    $now = Get-Date

    foreach ($agent in $agents) {
        $agentKey = $agent.ToLower()
        $agentData = $heartbeat.agents.$agentKey

        if ($agentData) {
            $lastSeen = [DateTime]::Parse($agentData.lastSeen)
            $ageMinutes = [math]::Round(($now - $lastSeen).TotalMinutes, 1)
            $status = $agentData.status

            if ($status -eq "alive") {
                Write-Check "$agent" "PASS" "ALIVE (last seen $ageMinutes min ago)"
            } elseif ($status -eq "stale") {
                Write-Check "$agent" "WARN" "STALE (last seen $ageMinutes min ago)"
            } else {
                Write-Check "$agent" "FAIL" "DEAD (last seen $ageMinutes min ago)"
            }
        } else {
            Write-Check "$agent" "FAIL" "No heartbeat data"
        }
    }
} else {
    Write-Check "Heartbeat file" "FAIL" "data/heartbeat-status.json not found"
}

Write-Host ""

# ============================================================================
# CHECK 3: Activity Feed
# ============================================================================
Write-Host "  --- CHECK 3: Activity Feed ---" -ForegroundColor White
$activityPath = Join-Path $projectDir "data\activity-feed.json"

if (Test-Path $activityPath) {
    $activityFile = Get-Item $activityPath
    $ageMinutes = [math]::Round(((Get-Date) - $activityFile.LastWriteTime).TotalMinutes, 1)

    if ($ageMinutes -lt 5) {
        Write-Check "Activity feed freshness" "PASS" "Updated $ageMinutes min ago"
    } elseif ($ageMinutes -lt 30) {
        Write-Check "Activity feed freshness" "WARN" "Updated $ageMinutes min ago"
    } else {
        Write-Check "Activity feed freshness" "FAIL" "Stale - $ageMinutes min ago"
    }

    # Check for recent HALO agent entries
    try {
        $activity = Get-Content $activityPath -Raw | ConvertFrom-Json
        $haloEntries = $activity.entries | Where-Object {
            $_.agentId -in @("chief", "arbiter", "ops", "hunter", "cortana", "scout")
        } | Select-Object -First 5

        if ($haloEntries.Count -gt 0) {
            Write-Check "HALO agent activity" "PASS" "$($haloEntries.Count) recent entries found"
        } else {
            Write-Check "HALO agent activity" "WARN" "No HALO agent entries in activity feed"
        }
    } catch {
        Write-Check "Activity feed parse" "FAIL" "Could not parse JSON"
    }
} else {
    Write-Check "Activity feed" "FAIL" "data/activity-feed.json not found"
}

Write-Host ""

# ============================================================================
# CHECK 4: Brain Files
# ============================================================================
Write-Host "  --- CHECK 4: Brain Files ---" -ForegroundColor White
$brainDir = Join-Path $projectDir "data\brain"

$brainFiles = @{
    "daily-log.md" = "Daily activity log"
    "pattern-memory.md" = "Cortana pattern tracking"
    "backlog-memory.md" = "Scout backlog analysis"
}

foreach ($file in $brainFiles.Keys) {
    $filePath = Join-Path $brainDir $file
    if (Test-Path $filePath) {
        $fileInfo = Get-Item $filePath
        $ageHours = [math]::Round(((Get-Date) - $fileInfo.LastWriteTime).TotalHours, 1)

        if ($ageHours -lt 24) {
            Write-Check $file "PASS" "$($brainFiles[$file]) - updated $ageHours hours ago"
        } else {
            Write-Check $file "WARN" "$($brainFiles[$file]) - stale ($ageHours hours ago)"
        }
    } else {
        Write-Check $file "WARN" "Not found (agent may not have run yet)"
    }
}

Write-Host ""

# ============================================================================
# CHECK 5: Windows Terminal Processes
# ============================================================================
Write-Host "  --- CHECK 5: Running Processes ---" -ForegroundColor White

# Check for Windows Terminal
$wtProcess = Get-Process -Name "WindowsTerminal" -ErrorAction SilentlyContinue
if ($wtProcess) {
    Write-Check "Windows Terminal" "PASS" "$($wtProcess.Count) instance(s) running"
} else {
    Write-Check "Windows Terminal" "FAIL" "Not running"
}

# Check for Claude processes
$claudeProcess = Get-Process -Name "claude" -ErrorAction SilentlyContinue
if ($claudeProcess) {
    Write-Check "Claude CLI processes" "PASS" "$($claudeProcess.Count) instance(s) running"
} else {
    Write-Check "Claude CLI processes" "WARN" "No claude.exe processes found"
}

# Check for Node (dashboard)
$nodeOnPort3000 = netstat -ano 2>$null | Select-String ":3000.*LISTENING"
if ($nodeOnPort3000) {
    Write-Check "Dashboard (port 3000)" "PASS" "Listening"
} else {
    Write-Check "Dashboard (port 3000)" "WARN" "Not running"
}

Write-Host ""

# ============================================================================
# CHECK 6: SOUL Files
# ============================================================================
Write-Host "  --- CHECK 6: SOUL Files ---" -ForegroundColor White
$soulDir = Join-Path $projectDir "Library\agent-souls"

foreach ($agent in $agents) {
    $soulFile = Join-Path $soulDir "$($agent.ToUpper())_SOUL.md"
    if (Test-Path $soulFile) {
        $lineCount = (Get-Content $soulFile).Count
        Write-Check "$agent SOUL" "PASS" "$lineCount lines"
    } else {
        Write-Check "$agent SOUL" "FAIL" "File not found"
    }
}

Write-Host ""

# ============================================================================
# CHECK 7: Jira Loop State
# ============================================================================
Write-Host "  --- CHECK 7: Jira Integration ---" -ForegroundColor White
$jiraStatePath = Join-Path $projectDir "data\jira-loop-state.json"

if (Test-Path $jiraStatePath) {
    $jiraState = Get-Content $jiraStatePath -Raw | ConvertFrom-Json
    $lastActivity = [DateTime]::Parse($jiraState.lastActivity)
    $ageHours = [math]::Round(((Get-Date) - $lastActivity).TotalHours, 1)

    if ($jiraState.running) {
        Write-Check "Jira loop status" "PASS" "Running on $($jiraState.currentIssue)"
    } else {
        Write-Check "Jira loop status" "WARN" "Not running"
    }

    Write-Check "Last Jira activity" "INFO" "$ageHours hours ago - $($jiraState.issuesCompleted) issues completed"
} else {
    Write-Check "Jira loop state" "WARN" "File not found"
}

Write-Host ""

# ============================================================================
# SUMMARY
# ============================================================================
Write-Host "  ============================================================" -ForegroundColor White
Write-Host ""
Write-Host "  SUMMARY" -ForegroundColor White
Write-Host "  -------" -ForegroundColor White
Write-Host "  [OK]   Passed:   $($checks.passed)" -ForegroundColor Green
Write-Host "  [WARN] Warnings: $($checks.warnings)" -ForegroundColor Yellow
Write-Host "  [FAIL] Failed:   $($checks.failed)" -ForegroundColor Red
Write-Host ""

if ($checks.failed -eq 0 -and $checks.warnings -eq 0) {
    Write-Host "  SUCCESS: All checks passed! HALO agents are operational." -ForegroundColor Green
} elseif ($checks.failed -eq 0) {
    Write-Host "  PARTIAL: Some warnings detected. Agents may be partially operational." -ForegroundColor Yellow
} else {
    Write-Host "  ISSUES: Critical issues detected. Run LAUNCH_HALO.bat to start agents." -ForegroundColor Red
}

Write-Host ""
Write-Host "  --- VERIFICATION TIPS ---" -ForegroundColor DarkGray
Write-Host "  * Watch heartbeat-status.json for live agent status" -ForegroundColor DarkGray
Write-Host "  * Check activity-feed.json for recent agent actions" -ForegroundColor DarkGray
Write-Host "  * Open http://localhost:3000/agents for visual dashboard" -ForegroundColor DarkGray
Write-Host "  * Review data/brain/*.md for agent outputs" -ForegroundColor DarkGray
Write-Host ""
