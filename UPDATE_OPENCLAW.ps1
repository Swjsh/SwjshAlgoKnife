# UPDATE_OPENCLAW.ps1 - Hot-reload openclaw config + all SOUL.md files + cron jobs
# Run from SwjshAlgoKnife project root whenever you change openclaw-setup files
# Usage: .\UPDATE_OPENCLAW.ps1

$ProjectRoot = $PSScriptRoot
$OpenclawHome = "$env:USERPROFILE\.openclaw"
$SetupDir = Join-Path $ProjectRoot "openclaw-setup"

Write-Host "Syncing openclaw configuration..." -ForegroundColor Cyan

if (-not (Test-Path "$SetupDir\openclaw.json")) {
    Write-Host "ERROR: openclaw-setup\openclaw.json not found. Run from project root." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $OpenclawHome)) {
    Write-Host "ERROR: $OpenclawHome not found. Run DEPLOY.ps1 first." -ForegroundColor Red
    exit 1
}

# Read existing .env to get credentials for substitution
$existingEnv = @{}
if (Test-Path "$OpenclawHome\.env") {
    Get-Content "$OpenclawHome\.env" | ForEach-Object {
        if ($_ -match "^(.+?)=(.*)$") {
            $existingEnv[$matches[1]] = $matches[2]
        }
    }
}

# Copy openclaw.json with credential substitution
$configRaw = Get-Content "$SetupDir\openclaw.json" -Raw
if ($existingEnv.ContainsKey("ANTHROPIC_API_KEY")) {
    $configRaw = $configRaw.Replace('${ANTHROPIC_API_KEY}', $existingEnv["ANTHROPIC_API_KEY"])
}
if ($existingEnv.ContainsKey("DISCORD_BOT_TOKEN")) {
    $configRaw = $configRaw.Replace('${DISCORD_BOT_TOKEN}', $existingEnv["DISCORD_BOT_TOKEN"])
}
if ($existingEnv.ContainsKey("OPENCLAW_GATEWAY_TOKEN")) {
    $configRaw = $configRaw.Replace('${OPENCLAW_GATEWAY_TOKEN}', $existingEnv["OPENCLAW_GATEWAY_TOKEN"])
}
[System.IO.File]::WriteAllText("$OpenclawHome\openclaw.json", $configRaw, [System.Text.Encoding]::UTF8)
Write-Host "  OK openclaw.json" -ForegroundColor Green

# Copy cron jobs
if (Test-Path "$SetupDir\cron-jobs.json") {
    if (-not (Test-Path "$OpenclawHome\cron")) {
        New-Item -ItemType Directory -Force -Path "$OpenclawHome\cron" | Out-Null
    }
    Copy-Item "$SetupDir\cron-jobs.json" "$OpenclawHome\cron\jobs.json" -Force
    Write-Host "  OK cron\jobs.json" -ForegroundColor Green
}

# Copy Chief workspace files
$workspaceFiles = @("SOUL.md", "USER.md", "AGENTS.md", "TOOLS.md", "MEMORY.md")
foreach ($file in $workspaceFiles) {
    $src = "$SetupDir\workspace\$file"
    if (Test-Path $src) {
        Copy-Item $src "$OpenclawHome\workspace\$file" -Force
        Write-Host "  OK workspace\$file" -ForegroundColor Green
    }
}

# Copy all sub-agent SOUL.md files
$agents = @("overseer", "professor", "auditor", "sterling", "bitcoin-bob", "pivot-pete", "boba", "spx-sniper")
foreach ($agent in $agents) {
    $src = "$SetupDir\agents\$agent\SOUL.md"
    $dst = "$OpenclawHome\agents\$agent\SOUL.md"
    if (Test-Path $src) {
        $dstDir = Split-Path $dst -Parent
        if (-not (Test-Path $dstDir)) {
            New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
        }
        Copy-Item $src $dst -Force
        Write-Host "  OK agents\$agent\SOUL.md" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "OK openclaw config hot-reloaded. Changes take effect immediately." -ForegroundColor Green
Write-Host "Check openclaw status with: openclaw status" -ForegroundColor Gray
