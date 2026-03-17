# Swjsh Algo Knife - Start Dashboard
Write-Host "🌐 Starting Dashboard..." -ForegroundColor Cyan
Set-Location "C:\Users\jackw\Desktop\SwjshAlgoKnife"
npm run dev
Start-Sleep -Seconds 5
Start-Process "http://localhost:3000/agents"
