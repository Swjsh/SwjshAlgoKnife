@echo off
title Restart Activity Bridge
cd /d "%~dp0"

echo   Killing old activity bridge on port 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>nul
    echo   Killed PID %%a
)
timeout /t 2 /nobreak >nul

echo   Starting fresh activity bridge...
start "" /min cmd.exe /c "npx tsx scripts/activity-bridge.ts"

echo   Activity bridge restarted!
echo   Agents will reconnect within 10 seconds.
timeout /t 5 /nobreak >nul
