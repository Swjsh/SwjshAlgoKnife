# DEPLOY.ps1 - SwjshAK OpenClaw Jarvis Full Installer
# Run this from the SwjshAlgoKnife project root
# Usage: .\openclaw-setup\DEPLOY.ps1

param(
    [string]$AnthropicKey = "",
    [string]$DiscordBotToken = "",
    [switch]$SkipInstall = $false,
    [switch]$Force = $false
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot | Split-Path -Parent
$OpenclawHome = "$env:USERPROFILE\.openclaw"
$SetupDir = Join-Path $ProjectRoot "openclaw-setup"

Write-Host ""
Write-Host "=== SwjshAK - OpenClaw Jarvis Installer ===" -ForegroundColor Cyan
Write-Host "Chief + 8 agents. Always on. Always watching." -ForegroundColor Cyan
Write-Host ""

# STEP 0: Verify project root

if (-not (Test-Path (Join-Path $ProjectRoot "CLAUDE.md"))) {
    Write-Host "ERROR: Not in SwjshAlgoKnife project root. Run from the project directory." -ForegroundColor Red
    exit 1
}
Write-Host "OK Project root confirmed: $ProjectRoot" -ForegroundColor Green

# STEP 1: Check Node.js

Write-Host ""
Write-Host "Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "OK Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# STEP 2: Install openclaw

if (-not $SkipInstall) {
    Write-Host ""
    Write-Host "Installing openclaw globally..." -ForegroundColor Yellow
    $existing = npm list -g --depth=0 openclaw 2>&1
    if ($existing -match "openclaw" -and -not $Force) {
        Write-Host "OK openclaw already installed. Use -Force to reinstall." -ForegroundColor Green
    } else {
        npm install -g openclaw@latest
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: openclaw install failed." -ForegroundColor Red
            exit 1
        }
        Write-Host "OK openclaw installed." -ForegroundColor Green
    }
    try {
        $clawVersion = openclaw --version 2>&1
        Write-Host "OK openclaw version: $clawVersion" -ForegroundColor Green
    } catch {
        Write-Host "WARN: Could not verify openclaw version. Continuing..." -ForegroundColor Yellow
    }
}

# STEP 3: Collect credentials

Write-Host ""
Write-Host "Credentials setup..." -ForegroundColor Yellow

if (-not $AnthropicKey) {
    Write-Host ""
    Write-Host "Enter your Anthropic API key (starts with sk-ant-):" -ForegroundColor Cyan
    Write-Host "  Get from: https://console.anthropic.com/settings/keys" -ForegroundColor Gray
    $AnthropicKey = Read-Host "  ANTHROPIC_API_KEY"
}

if (-not $AnthropicKey -or -not $AnthropicKey.StartsWith("sk-ant-")) {
    Write-Host "WARN: API key format unexpected (expected sk-ant-...). Continuing anyway." -ForegroundColor Yellow
}

if (-not $DiscordBotToken) {
    Write-Host ""
    Write-Host "Enter your Discord bot token:" -ForegroundColor Cyan
    Write-Host "  Get from: https://discord.com/developers/applications -> Chief -> Bot -> Token" -ForegroundColor Gray
    Write-Host "  If old token was compromised, reset it first." -ForegroundColor Yellow
    $DiscordBotToken = Read-Host "  DISCORD_BOT_TOKEN"
}

$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$GatewayToken = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
Write-Host "OK Generated random gateway token." -ForegroundColor Green

$GuildId = "340322473276997632"
$ChiefChannelId = "1465522015095099549"
$ForexChannelId = "1467174412615942186"
$CryptoChannelId = "1467174512377200640"

# STEP 4: Create directory structure

Write-Host ""
Write-Host "Creating directory structure..." -ForegroundColor Yellow

$dirs = @(
    $OpenclawHome,
    "$OpenclawHome\workspace",
    "$OpenclawHome\workspace\memory",
    "$OpenclawHome\agents\overseer",
    "$OpenclawHome\agents\professor",
    "$OpenclawHome\agents\auditor",
    "$OpenclawHome\agents\sterling",
    "$OpenclawHome\agents\bitcoin-bob",
    "$OpenclawHome\agents\pivot-pete",
    "$OpenclawHome\agents\boba",
    "$OpenclawHome\agents\spx-sniper",
    "$OpenclawHome\cron"
)

foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
}
Write-Host "OK Directory structure created." -ForegroundColor Green

# STEP 5: Write .env file

Write-Host ""
Write-Host "Writing openclaw .env file..." -ForegroundColor Yellow

$envContent = "ANTHROPIC_API_KEY=$AnthropicKey`n" +
              "DISCORD_BOT_TOKEN=$DiscordBotToken`n" +
              "OPENCLAW_GATEWAY_TOKEN=$GatewayToken`n" +
              "DISCORD_GUILD_ID=$GuildId`n" +
              "DISCORD_MAIN_CHANNEL_ID=$ChiefChannelId`n" +
              "DISCORD_FOREX_CHANNEL_ID=$ForexChannelId`n" +
              "DISCORD_CRYPTO_CHANNEL_ID=$CryptoChannelId`n"

[System.IO.File]::WriteAllText("$OpenclawHome\.env", $envContent, [System.Text.Encoding]::UTF8)
Write-Host "OK .env written to $OpenclawHome\.env" -ForegroundColor Green

# STEP 6: Patch openclaw.json with real credentials and copy

Write-Host ""
Write-Host "Deploying openclaw.json..." -ForegroundColor Yellow

$configRaw = Get-Content "$SetupDir\openclaw.json" -Raw
$configRaw = $configRaw.Replace('${ANTHROPIC_API_KEY}', $AnthropicKey)
$configRaw = $configRaw.Replace('${DISCORD_BOT_TOKEN}', $DiscordBotToken)
$configRaw = $configRaw.Replace('${OPENCLAW_GATEWAY_TOKEN}', $GatewayToken)
[System.IO.File]::WriteAllText("$OpenclawHome\openclaw.json", $configRaw, [System.Text.Encoding]::UTF8)
Write-Host "OK openclaw.json deployed with credentials substituted." -ForegroundColor Green

# STEP 7: Deploy cron jobs

Write-Host ""
Write-Host "Deploying cron jobs..." -ForegroundColor Yellow

Copy-Item "$SetupDir\cron-jobs.json" "$OpenclawHome\cron\jobs.json" -Force
Write-Host "OK 12 cron jobs deployed to $OpenclawHome\cron\jobs.json" -ForegroundColor Green

# STEP 8: Deploy Chief workspace files

Write-Host ""
Write-Host "Deploying Chief workspace files..." -ForegroundColor Yellow

$workspaceFiles = @("SOUL.md", "USER.md", "AGENTS.md", "TOOLS.md", "MEMORY.md")
foreach ($file in $workspaceFiles) {
    $src = "$SetupDir\workspace\$file"
    $dst = "$OpenclawHome\workspace\$file"
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
        Write-Host "  OK $file" -ForegroundColor Green
    } else {
        Write-Host "  WARN $file not found" -ForegroundColor Yellow
    }
}

# STEP 9: Deploy sub-agent SOUL.md files

Write-Host ""
Write-Host "Deploying sub-agent SOUL.md files..." -ForegroundColor Yellow

$agents = @("overseer", "professor", "auditor", "sterling", "bitcoin-bob", "pivot-pete", "boba", "spx-sniper")
foreach ($agent in $agents) {
    $src = "$SetupDir\agents\$agent\SOUL.md"
    $dst = "$OpenclawHome\agents\$agent\SOUL.md"
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
        Write-Host "  OK $agent\SOUL.md" -ForegroundColor Green
    } else {
        Write-Host "  WARN $agent\SOUL.md not found" -ForegroundColor Yellow
    }
}

# STEP 10: Verify

Write-Host ""
Write-Host "Verifying installation..." -ForegroundColor Yellow

$criticalFiles = @(
    "$OpenclawHome\openclaw.json",
    "$OpenclawHome\.env",
    "$OpenclawHome\cron\jobs.json",
    "$OpenclawHome\workspace\SOUL.md",
    "$OpenclawHome\workspace\AGENTS.md",
    "$OpenclawHome\workspace\TOOLS.md",
    "$OpenclawHome\workspace\MEMORY.md"
)

$allGood = $true
foreach ($f in $criticalFiles) {
    if (Test-Path $f) {
        Write-Host "  OK $(Split-Path $f -Leaf)" -ForegroundColor Green
    } else {
        Write-Host "  MISSING: $f" -ForegroundColor Red
        $allGood = $false
    }
}

# STEP 11: Start openclaw

Write-Host ""
if ($allGood) {
    Write-Host "=== Installation complete. Starting Chief... ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Cron schedule (ET, Mon-Fri):" -ForegroundColor Cyan
    Write-Host "   8:00 AM  - Morning brief (Chief)"
    Write-Host "   3:00 AM  - London open (Sterling)"
    Write-Host "   8:30 AM  - NY overlap (Sterling)"
    Write-Host "   9:30 AM  - Market open check (Chief)"
    Write-Host "  12:00 PM  - Midday + Sterling session close"
    Write-Host "   4:15 PM  - EOD grades (Professor)"
    Write-Host "   4:30 PM  - EOD risk audit (Overseer)"
    Write-Host "   Hourly   - System heartbeat (Chief)"
    Write-Host "   Every 4h - Crypto watch (Bitcoin Bob)"
    Write-Host "   Every 2h - FX scan (Sterling)"
    Write-Host "  Sunday 6 PM - Weekly review (Chief)"
    Write-Host ""
    Write-Host "Chief will send a startup message to #chief-main when connected." -ForegroundColor Green
    Write-Host "To talk to Chief: type in your Discord #chief-main channel." -ForegroundColor Green
    Write-Host "To update config later: run .\UPDATE_OPENCLAW.ps1" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Starting openclaw..." -ForegroundColor Cyan

    # Try daemon install first, fall back to foreground
    $daemonResult = & openclaw onboard --install-daemon 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Daemon install skipped (may already be installed). Running in foreground..." -ForegroundColor Yellow
        openclaw
    } else {
        Write-Host "OK openclaw daemon installed and started." -ForegroundColor Green
        Write-Host "Check status anytime with: openclaw status" -ForegroundColor Gray
    }

} else {
    Write-Host "ERROR: Some files are missing. Fix errors above before starting openclaw." -ForegroundColor Red
    exit 1
}
