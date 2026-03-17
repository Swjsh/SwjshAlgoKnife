# Test Bitcoin Bob webhook → executor → Alpaca chain
# Run this while npm run dev is running to verify everything works

$ErrorActionPreference = "SilentlyContinue"

$headers = @{
    "Content-Type"      = "application/json"
    "X-Webhook-Secret"  = "swjshak-tv-webhook-2026"
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  BITCOIN BOB — End-to-End Test" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ── Test 1: BTC BUY signal ───────────────────────────────────────────────────
Write-Host "Test 1: Firing BTC BUY signal..." -ForegroundColor Yellow
$btcPrice = 82000
$btcBody = @{
    symbol      = "BTCUSD"
    action      = "BUY"
    price       = $btcPrice
    strategy    = "BitcoinBob_SR"
    stopLoss    = 80500
    takeProfit  = 85750
    notes       = "TEST: Demand zone entry @ $82k"
} | ConvertTo-Json

try {
    $resp = Invoke-WebRequest -Uri "http://localhost:3000/api/webhook/tradingview" `
                              -Method POST `
                              -Headers $headers `
                              -Body $btcBody `
                              -UseBasicParsing
    Write-Host "✅ BTC BUY accepted: HTTP $($resp.StatusCode)" -ForegroundColor Green
    Write-Host "   Response: $($resp.Content)" -ForegroundColor DarkGray
} catch {
    Write-Host "❌ BTC BUY failed: $_" -ForegroundColor Red
}

Start-Sleep -Seconds 2

# ── Test 2: ETH BUY signal ───────────────────────────────────────────────────
Write-Host ""
Write-Host "Test 2: Firing ETH BUY signal..." -ForegroundColor Yellow
$ethBody = @{
    symbol      = "ETHUSD"
    action      = "BUY"
    price       = 3200
    strategy    = "BitcoinBob_SR"
    stopLoss    = 3100
    takeProfit  = 3450
    notes       = "TEST: ETH demand zone entry"
} | ConvertTo-Json

try {
    $resp = Invoke-WebRequest -Uri "http://localhost:3000/api/webhook/tradingview" `
                              -Method POST `
                              -Headers $headers `
                              -Body $ethBody `
                              -UseBasicParsing
    Write-Host "✅ ETH BUY accepted: HTTP $($resp.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "❌ ETH BUY failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Check:" -ForegroundColor White
Write-Host "  • http://localhost:3000/journal  → trades should appear" -ForegroundColor White
Write-Host "  • Discord #crypto channel        → alerts should fire" -ForegroundColor White
Write-Host "  • Alpaca paper account           → positions should be open" -ForegroundColor White
Write-Host "    https://app.alpaca.markets/paper-trading/overview" -ForegroundColor DarkGray
Write-Host ""
