# ═══════════════════════════════════════════════════════════════
# Deploy Autonomous Cron Jobs to Local OpenClaw
#
# Run from PowerShell:
#   .\openclaw-setup\deploy-cron-local.ps1
#
# This copies the autonomous cron jobs to OpenClaw's cron directory
# and restarts OpenClaw to pick up the new config.
# ═══════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

$OPENCLAW_CRON_DIR = "$env:USERPROFILE\.openclaw\cron"
$SOURCE_FILE = "$PSScriptRoot\cron-jobs-autonomous.json"

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Deploy Autonomous Cron Jobs" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan

# Verify source file exists
if (-not (Test-Path $SOURCE_FILE)) {
    Write-Host "ERROR: Source file not found: $SOURCE_FILE" -ForegroundColor Red
    exit 1
}

# Create cron directory if it doesn't exist
if (-not (Test-Path $OPENCLAW_CRON_DIR)) {
    New-Item -ItemType Directory -Path $OPENCLAW_CRON_DIR -Force | Out-Null
    Write-Host "Created: $OPENCLAW_CRON_DIR" -ForegroundColor Yellow
}

# Backup existing jobs.json if it exists
if (Test-Path "$OPENCLAW_CRON_DIR\jobs.json") {
    $backup = "$OPENCLAW_CRON_DIR\jobs.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    Copy-Item "$OPENCLAW_CRON_DIR\jobs.json" $backup
    Write-Host "Backed up existing: $backup" -ForegroundColor Yellow
}

# Validate JSON before deploying
try {
    $json = Get-Content $SOURCE_FILE -Raw | ConvertFrom-Json
    $jobCount = $json.Count
    Write-Host "Validated: $jobCount cron jobs in source file" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Invalid JSON in source file" -ForegroundColor Red
    exit 1
}

# Deploy
Copy-Item $SOURCE_FILE "$OPENCLAW_CRON_DIR\jobs.json" -Force
Write-Host "Deployed to: $OPENCLAW_CRON_DIR\jobs.json" -ForegroundColor Green

# List deployed jobs
Write-Host ""
Write-Host "Deployed Jobs:" -ForegroundColor Cyan
foreach ($job in $json) {
    $status = if ($job.enabled) { "ON " } else { "OFF" }
    $schedule = $job.schedule.expr
    Write-Host "  [$status] $($job.jobId) | $schedule | $($job.name)" -ForegroundColor White
}

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Done! Restart OpenClaw to load new jobs." -ForegroundColor Green
Write-Host " Or refresh the Cron Jobs page in the UI." -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
