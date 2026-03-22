@echo off
title HALO System Launcher
color 0B

cd /d "%~dp0"

echo.
echo   ============================================
echo      H A L O   S Y S T E M
echo      Launching Full Stack + 6 Agents
echo   ============================================
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0LAUNCH_HALO_SYSTEM.ps1"

if %errorlevel% neq 0 (
    echo.
    echo   ERROR: Launch failed with code %errorlevel%
    echo   Press any key to close...
    pause >nul
)
