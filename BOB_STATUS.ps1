# Quick status check — run this or ask Claude "is Bob running?"
pm2 list
Write-Host ""
Write-Host "Recent Bob output:" -ForegroundColor Cyan
pm2 logs AK-BitcoinBob --lines 20 --nostream
