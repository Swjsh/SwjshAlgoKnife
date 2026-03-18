# SWJSH - One-time Windows Auto-Start Setup
# Registers START_SWJSH.ps1 to run automatically every time you log into Windows.
# Run this ONCE. After that, just log in and everything starts on its own.

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "SWJSH - Auto-Start Setup" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

$startupScript = Join-Path $scriptDir "START_SWJSH.ps1"
$taskName = "SwjshAK_AutoStart"

Write-Host "Registering with Windows Task Scheduler..." -ForegroundColor Yellow

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-WindowStyle Hidden -NonInteractive -ExecutionPolicy Bypass -File `"$startupScript`""

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -RunLevel Limited `
    -Description "Auto-starts SwjshAK trading system on login" `
    | Out-Null

Write-Host ""
Write-Host "OK - Scheduled task registered: $taskName" -ForegroundColor Green
Write-Host ""
Write-Host "  Fires: Every time $env:USERNAME logs into Windows" -ForegroundColor White
Write-Host "  Runs:  START_SWJSH.ps1 silently in background" -ForegroundColor White
Write-Host ""

Write-Host "Saving PM2 process list for persistence..." -ForegroundColor Yellow
$pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
if ($pm2) {
    pm2 save
    Write-Host "OK - PM2 process list saved" -ForegroundColor Green
} else {
    Write-Host "  PM2 not yet installed - run START_SWJSH.ps1 first, then re-run this" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Setup complete. What happens now:" -ForegroundColor White
Write-Host ""
Write-Host "  1. You log into Windows" -ForegroundColor White
Write-Host "  2. Task Scheduler silently runs START_SWJSH.ps1" -ForegroundColor White
Write-Host "  3. PM2 starts Dashboard + Bitcoin Bob" -ForegroundColor White
Write-Host "  4. Bob scans for zones and trades automatically" -ForegroundColor White
Write-Host "  5. Open http://localhost:3000 whenever you want to check in" -ForegroundColor White
Write-Host ""
Write-Host "  To verify: pm2 list" -ForegroundColor DarkGray
Write-Host "  To remove: Unregister-ScheduledTask -TaskName $taskName" -ForegroundColor DarkGray
Write-Host ""
