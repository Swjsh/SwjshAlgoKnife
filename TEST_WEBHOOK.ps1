# SwjshAK — Test the full trading chain
# Run this with the app running (npm run dev) to verify Discord alerts fire

$uri = "http://localhost:3000/api/webhook/tradingview"
$headers = @{
    "Content-Type"    = "application/json"
    "X-Webhook-Secret" = "swjshak-tv-webhook-2026"
}

Write-Host ""
Write-Host "=== SwjshAK Webhook Test ===" -ForegroundColor Cyan
Write-Host ""

# Test 1 — FX buy (routes to OANDA)
Write-Host "1. Firing EURUSD BUY → OANDA paper..." -ForegroundColor Yellow
$body = '{"symbol":"EURUSD","action":"BUY","price":1.0842,"strategy":"Sterling-Test"}'
try {
    $r = Invoke-WebRequest -Uri $uri -Method POST -Headers $headers -Body $body -UseBasicParsing
    Write-Host "   ✅ Response: $($r.StatusCode) — $($r.Content)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 2

# Test 2 — Equity buy (routes to Alpaca)
Write-Host "2. Firing SPY BUY → Alpaca paper..." -ForegroundColor Yellow
$body2 = '{"symbol":"SPY","action":"BUY","price":512.50,"strategy":"ORB-Test"}'
try {
    $r2 = Invoke-WebRequest -Uri $uri -Method POST -Headers $headers -Body $body2 -UseBasicParsing
    Write-Host "   ✅ Response: $($r2.StatusCode) — $($r2.Content)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Done. Check Discord #chief for alerts." -ForegroundColor Cyan
Write-Host ""
