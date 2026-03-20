# Setup Brain Sync Scheduled Task
param([switch]$Force)

$TaskName = 'SwjshAK-BrainSync'
$TaskDesc = 'Automated sync of Obsidian brain files to GitHub brain-sync branch'
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$SyncScript = Join-Path (Join-Path $RepoRoot 'scripts') 'sync-brain-to-git.ps1'

Write-Host '=== Brain Sync Task Setup ===' -ForegroundColor Cyan

# Verify script exists
if (-not (Test-Path $SyncScript)) {
    Write-Host "ERROR: Sync script not found: $SyncScript" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Sync script found" -ForegroundColor Green

# Check if task exists
$existing = Get-ScheduledTask -TaskName $TaskName -EA SilentlyContinue
if ($existing) {
    if (-not $Force) {
        $response = Read-Host "Task already exists. Replace it? (y/n)"
        if ($response -ne 'y') { Write-Host 'Cancelled'; exit 0 }
    }
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host 'Removed existing task' -ForegroundColor Yellow
}

# Create trigger: Daily at 6 AM
$trigger = New-ScheduledTaskTrigger -Daily -At '6:00AM'

# Create action: Run PowerShell script (hidden, no window popup)
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$SyncScript`""

# Create settings
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

# Register the task
Write-Host 'Registering task...' -ForegroundColor Cyan
Register-ScheduledTask -TaskName $TaskName -Trigger $trigger -Action $action -Settings $settings -Description $TaskDesc -User $env:USERNAME -RunLevel Limited -Force | Out-Null

# Verify registration
$task = Get-ScheduledTask -TaskName $TaskName -EA SilentlyContinue
if ($task) {
    Write-Host '[OK] Task registered successfully!' -ForegroundColor Green
    Write-Host "Task Name: $TaskName"
    Write-Host 'Schedule: Daily at 6:00 AM'
    Write-Host ''
    Write-Host 'Verify with: schtasks /query /tn SwjshAK-BrainSync /v' -ForegroundColor Yellow
} else {
    Write-Host 'ERROR: Task registration failed' -ForegroundColor Red
    exit 1
}