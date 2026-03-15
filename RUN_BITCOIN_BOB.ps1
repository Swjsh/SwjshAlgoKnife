# ╔══════════════════════════════════════════════════════════════════╗
# ║           BITCOIN BOB — Weekend Warrior Launcher                ║
# ║  Runs continuously: scans S/R zones, enters on touch, manages   ║
# ║  SL/TP, fires paper trades via Alpaca.                          ║
# ║                                                                  ║
# ║  Requirements:                                                   ║
# ║    1. npm run dev must be running in another window              ║
# ║    2. pip install yfinance pandas numpy requests                 ║
# ╚══════════════════════════════════════════════════════════════════╝

$ErrorActionPreference = "Stop"

# Navigate to project root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       BITCOIN BOB  —  Starting Up        ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check dashboard is running
Write-Host "Checking dashboard is online..." -ForegroundColor Yellow
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:3000/api/signals" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ Dashboard is online at localhost:3000" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "❌ Dashboard not responding at localhost:3000" -ForegroundColor Red
    Write-Host "   Please start it first: npm run dev" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Check Python + deps
Write-Host "Checking Python dependencies..." -ForegroundColor Yellow
try {
    python -c "import yfinance, pandas, numpy, requests; print('✅ All dependencies OK')"
} catch {
    Write-Host "Installing missing Python packages..." -ForegroundColor Yellow
    pip install yfinance pandas numpy requests --quiet
}

Write-Host ""
Write-Host "🚀 Launching Bitcoin Bob engine..." -ForegroundColor Green
Write-Host "   BTC/ETH/SOL — S/R Zone Trading — Alpaca Paper" -ForegroundColor White
Write-Host "   Scans every 30 min | Checks prices every 60s" -ForegroundColor White
Write-Host "   Max 2 open positions at once" -ForegroundColor White
Write-Host ""
Write-Host "   Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host ""

# Run the engine from scripts/ directory
Set-Location "$scriptDir\scripts"
python bitcoin_bob_engine.py
