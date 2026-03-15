# ═══════════════════════════════════════════════════════════════════════════════
# SwjshAK — Master Launcher (Local Windows)
#
# ONE command to start the entire autonomous trading platform:
#   ./START_SWJSH.ps1
#
# This starts 2 PM2 processes:
#   - AK-Dashboard  (Next.js on port 3000 — UI + APIs + LLM Control)
#   - AK-Runner     (Master orchestrator — spawns ALL trading agents)
#
# The Runner autonomously manages:
#   - All Python agents (Pivot Pete, Boba, SPX Sniper, Sterling, Bitcoin Bob)
#   - ORB Runner (TypeScript)
#   - Intelligence layer (OrderFlow, Sentiment, OnChain, Whale)
#   - Risk gating, trade grading, health watchdog
#   - LLM Control command polling
#
# After startup, the system is ALIVE. No manual intervention needed.
# Control it from any LLM chat via: http://localhost:3000/api/control
# ═══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "SilentlyContinue"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║   SwjshAK — Autonomous Trading Bot    ║" -ForegroundColor Cyan
Write-Host "  ║   Starting All Systems...              ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── 1. Check prerequisites ───────────────────────────────────────────────────
$pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
if (-not $pm2) {
    Write-Host "[1/4] PM2 not found. Installing globally..." -ForegroundColor Yellow
    npm install -g pm2
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install PM2. Make sure Node.js is installed." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "[1/4] PM2 installed" -ForegroundColor Green
} else {
    Write-Host "[1/4] PM2 ready" -ForegroundColor Green
}

# ── 2. Build Next.js if needed ───────────────────────────────────────────────
if (-not (Test-Path ".next")) {
    Write-Host "[2/4] Building Next.js production bundle..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Build failed." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "[2/4] Build complete" -ForegroundColor Green
} else {
    Write-Host "[2/4] Next.js build exists" -ForegroundColor Green
}

# ── 3. Check Python deps ────────────────────────────────────────────────────
Write-Host "[3/4] Checking Python dependencies..." -ForegroundColor Yellow
python -c "import yfinance, pandas, numpy, requests" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Installing Python dependencies..." -ForegroundColor Yellow
    pip install yfinance pandas numpy requests --quiet
}
Write-Host "[3/4] Python deps ready" -ForegroundColor Green

# ── 4. Create data directory ─────────────────────────────────────────────────
if (-not (Test-Path "data/logs")) {
    New-Item -ItemType Directory -Force -Path "data/logs" | Out-Null
}

# ── 5. Start via PM2 ────────────────────────────────────────────────────────
Write-Host "[4/4] Starting PM2 processes..." -ForegroundColor Yellow

# Stop any old processes first to avoid duplicates
pm2 delete all 2>$null

# Start fresh with the consolidated ecosystem (2 processes only)
pm2 start scripts/ecosystem.config.js
pm2 save

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║   All Systems ONLINE                   ║" -ForegroundColor Green
Write-Host "  ╚═══════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

pm2 list

Write-Host ""
Write-Host "  Dashboard:     http://localhost:3000" -ForegroundColor White
Write-Host "  LLM Control:   http://localhost:3000/api/control" -ForegroundColor White
Write-Host ""
Write-Host "  The system is now autonomous. Agents are scanning," -ForegroundColor DarkGray
Write-Host "  trading, and learning on their own." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Control from chat:" -ForegroundColor DarkGray
Write-Host "    GET  /api/control              - Full system status" -ForegroundColor DarkGray
Write-Host "    POST /api/control              - Send commands" -ForegroundColor DarkGray
Write-Host '    { "command": "summary" }       - Daily P&L report' -ForegroundColor DarkGray
Write-Host '    { "command": "pause", "agentId": "boba" }' -ForegroundColor DarkGray
Write-Host ""
Write-Host "  PM2 commands:" -ForegroundColor DarkGray
Write-Host "    pm2 logs               - Watch all logs" -ForegroundColor DarkGray
Write-Host "    pm2 logs AK-Runner     - Watch agent runner" -ForegroundColor DarkGray
Write-Host "    pm2 restart AK-Runner  - Restart all agents" -ForegroundColor DarkGray
Write-Host ""
