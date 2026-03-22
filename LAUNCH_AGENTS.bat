@echo off
REM LAUNCH_AGENTS.bat - Spawns 6 HALO agent windows
REM Uses pre-built static .cmd files (no dynamic generation)
REM Uses "start cmd.exe /k" — the ONLY method proven to work

cd /d "%~dp0"

echo.
echo   ==========================================
echo     HALO AGENTS - Spawning 6 terminals
echo   ==========================================
echo.

if not exist "data\halo-heartbeats" mkdir "data\halo-heartbeats"

echo   [1/6] Chief...
start "HALO: Chief" cmd.exe /k "data\halo-launchers\launch-Chief.cmd"
timeout /t 3 /nobreak >nul

echo   [2/6] Arbiter...
start "HALO: Arbiter" cmd.exe /k "data\halo-launchers\launch-Arbiter.cmd"
timeout /t 3 /nobreak >nul

echo   [3/6] Ops...
start "HALO: Ops" cmd.exe /k "data\halo-launchers\launch-Ops.cmd"
timeout /t 3 /nobreak >nul

echo   [4/6] Hunter...
start "HALO: Hunter" cmd.exe /k "data\halo-launchers\launch-Hunter.cmd"
timeout /t 3 /nobreak >nul

echo   [5/6] Cortana...
start "HALO: Cortana" cmd.exe /k "data\halo-launchers\launch-Cortana.cmd"
timeout /t 3 /nobreak >nul

echo   [6/6] Scout...
start "HALO: Scout" cmd.exe /k "data\halo-launchers\launch-Scout.cmd"

echo.
echo   ==========================================
echo     6 HALO AGENTS DEPLOYED
echo   ==========================================
echo.
