@echo off
title SwjshAK - Localhost Toggle
color 0D

:: ═══════════════════════════════════════════════════════════════
::   SwjshAK — Double-Click Localhost Toggle
::   If running  → kills the dev server
::   If stopped  → starts dev server + opens browser
:: ═══════════════════════════════════════════════════════════════

cd /d "%~dp0"

:: Check if something is already running on port 3000
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1

if %errorlevel%==0 (
    echo.
    echo   ================================
    echo    SwjshAK is RUNNING — shutting down...
    echo   ================================
    echo.

    :: Kill all processes on port 3000
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
        taskkill /F /PID %%a >nul 2>&1
    )

    :: Also kill any lingering node processes from this folder
    taskkill /F /IM node.exe >nul 2>&1

    echo   Server stopped.
    echo.
    timeout /t 3
) else (
    echo.
    echo   ========================================
    echo    SwjshAK — Starting Dev Server...
    echo   ========================================
    echo.
    echo   Starting on http://localhost:3000
    echo   Close this window to stop the server.
    echo.

    :: Open browser after a short delay (in background)
    start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:3000"

    :: Start the dev server (this keeps the window open)
    npm run dev
)
