@echo off
title HALO DIAGNOSTIC
cd /d "%~dp0"

echo.
echo   ==========================================
echo     HALO LAUNCH DIAGNOSTICS
echo     %date% %time%
echo   ==========================================
echo.

set LOGFILE=%~dp0data\halo-diagnose.log
echo HALO DIAGNOSTIC LOG > "%LOGFILE%"
echo Date: %date% %time% >> "%LOGFILE%"
echo. >> "%LOGFILE%"

REM ─── Test 1: Can we find claude? ───
echo   [TEST 1] Checking if 'claude' is in PATH...
where claude >nul 2>nul
if %errorlevel% neq 0 (
    echo   FAIL: 'claude' not found in PATH
    echo TEST1: FAIL - claude not in PATH >> "%LOGFILE%"
    echo.
    echo   Checking npm global bin...
    for /f "tokens=*" %%i in ('npm config get prefix 2^>nul') do set NPM_PREFIX=%%i
    if defined NPM_PREFIX (
        echo   npm prefix: %NPM_PREFIX%
        echo TEST1: npm prefix = %NPM_PREFIX% >> "%LOGFILE%"
        if exist "%NPM_PREFIX%\claude.cmd" (
            echo   FOUND: %NPM_PREFIX%\claude.cmd exists but is not in PATH
            echo TEST1: claude.cmd exists at %NPM_PREFIX%\claude.cmd >> "%LOGFILE%"
        ) else (
            echo   NOT FOUND at %NPM_PREFIX%\claude.cmd
            echo TEST1: claude.cmd NOT at %NPM_PREFIX%\claude.cmd >> "%LOGFILE%"
        )
    ) else (
        echo   npm not found either
        echo TEST1: npm also not in PATH >> "%LOGFILE%"
    )
    echo.
    echo   Checking common install locations...
    if exist "%APPDATA%\npm\claude.cmd" (
        echo   FOUND: %APPDATA%\npm\claude.cmd
        echo TEST1: FOUND at %APPDATA%\npm\claude.cmd >> "%LOGFILE%"
    )
    if exist "%LOCALAPPDATA%\npm\claude.cmd" (
        echo   FOUND: %LOCALAPPDATA%\npm\claude.cmd
        echo TEST1: FOUND at %LOCALAPPDATA%\npm\claude.cmd >> "%LOGFILE%"
    )
    if exist "%USERPROFILE%\.npm-global\claude.cmd" (
        echo   FOUND: %USERPROFILE%\.npm-global\claude.cmd
        echo TEST1: FOUND at %USERPROFILE%\.npm-global\claude.cmd >> "%LOGFILE%"
    )
) else (
    echo   PASS: 'claude' found in PATH
    for /f "tokens=*" %%i in ('where claude') do (
        echo   Location: %%i
        echo TEST1: PASS - claude at %%i >> "%LOGFILE%"
    )
)
echo.

REM ─── Test 2: Claude version check ───
echo   [TEST 2] Getting claude version...
call claude --version > "%TEMP%\halo-claude-ver.txt" 2>&1
if %errorlevel% neq 0 (
    echo   FAIL: claude --version returned error %errorlevel%
    echo TEST2: FAIL - exit code %errorlevel% >> "%LOGFILE%"
    type "%TEMP%\halo-claude-ver.txt"
) else (
    set /p CLAUDE_VER=<"%TEMP%\halo-claude-ver.txt"
    echo   PASS: %CLAUDE_VER%
    echo TEST2: PASS - %CLAUDE_VER% >> "%LOGFILE%"
)
echo.

REM ─── Test 3: Windows Terminal available? ───
echo   [TEST 3] Checking Windows Terminal...
where wt >nul 2>nul
if %errorlevel% neq 0 (
    echo   FAIL: 'wt' not found
    echo TEST3: FAIL - wt not in PATH >> "%LOGFILE%"
) else (
    echo   PASS: Windows Terminal found
    for /f "tokens=*" %%i in ('where wt') do (
        echo   Location: %%i
        echo TEST3: PASS - wt at %%i >> "%LOGFILE%"
    )
)
echo.

REM ─── Test 4: Can we create launcher dir? ───
echo   [TEST 4] Creating launcher directory...
if not exist "data\halo-launchers" mkdir "data\halo-launchers"
if exist "data\halo-launchers" (
    echo   PASS: data\halo-launchers exists
    echo TEST4: PASS >> "%LOGFILE%"
) else (
    echo   FAIL: Could not create data\halo-launchers
    echo TEST4: FAIL >> "%LOGFILE%"
)
echo.

REM ─── Test 5: Write a test .cmd and run it inline ───
echo   [TEST 5] Creating and running test .cmd...
echo @echo off > "data\halo-launchers\test-inline.cmd"
echo echo TEST5 SUCCESS >> "data\halo-launchers\test-inline.cmd"
call "data\halo-launchers\test-inline.cmd"
echo TEST5: Created and ran inline .cmd >> "%LOGFILE%"
echo.

REM ─── Test 6: Open a persistent cmd.exe window ───
echo   [TEST 6] Opening a test cmd.exe window (should stay open)...
echo @echo off > "data\halo-launchers\test-persist.cmd"
echo title HALO TEST - THIS SHOULD STAY OPEN >> "data\halo-launchers\test-persist.cmd"
echo echo. >> "data\halo-launchers\test-persist.cmd"
echo echo   If you can read this, the window is staying open. >> "data\halo-launchers\test-persist.cmd"
echo echo   This means cmd.exe /k works correctly. >> "data\halo-launchers\test-persist.cmd"
echo echo. >> "data\halo-launchers\test-persist.cmd"
start "HALO TEST" cmd.exe /k "data\halo-launchers\test-persist.cmd"
echo   Started. Check if a 'HALO TEST' window appeared and stayed open.
echo TEST6: Opened cmd.exe /k test-persist.cmd >> "%LOGFILE%"
echo.

REM ─── Test 7: Open via Windows Terminal ───
echo   [TEST 7] Opening test via Windows Terminal...
where wt >nul 2>nul
if %errorlevel% neq 0 (
    echo   SKIP: No Windows Terminal
    echo TEST7: SKIP >> "%LOGFILE%"
) else (
    echo @echo off > "data\halo-launchers\test-wt.cmd"
    echo title HALO WT TEST - THIS SHOULD STAY OPEN >> "data\halo-launchers\test-wt.cmd"
    echo echo. >> "data\halo-launchers\test-wt.cmd"
    echo echo   If you can read this, Windows Terminal launch works. >> "data\halo-launchers\test-wt.cmd"
    echo echo. >> "data\halo-launchers\test-wt.cmd"
    start "" wt new-tab --title "HALO WT TEST" -- cmd.exe /k "data\halo-launchers\test-wt.cmd"
    echo   Started. Check if a 'HALO WT TEST' tab appeared in Windows Terminal.
    echo TEST7: Opened wt new-tab test >> "%LOGFILE%"
)
echo.

REM ─── Test 8: Open claude in a window ───
echo   [TEST 8] Opening claude in a persistent window...
where claude >nul 2>nul
if %errorlevel% neq 0 (
    echo   SKIP: Claude not in PATH
    echo TEST8: SKIP - claude not in PATH >> "%LOGFILE%"
) else (
    echo @echo off > "data\halo-launchers\test-claude.cmd"
    echo title HALO CLAUDE TEST >> "data\halo-launchers\test-claude.cmd"
    echo cd /d "%~dp0" >> "data\halo-launchers\test-claude.cmd"
    echo echo   About to run: claude --version >> "data\halo-launchers\test-claude.cmd"
    echo call claude --version >> "data\halo-launchers\test-claude.cmd"
    echo echo   Exit code: %%errorlevel%% >> "data\halo-launchers\test-claude.cmd"
    echo echo. >> "data\halo-launchers\test-claude.cmd"
    echo echo   Now running claude with a simple prompt... >> "data\halo-launchers\test-claude.cmd"
    echo call claude --dangerously-skip-permissions -p "Say hello and exit" >> "data\halo-launchers\test-claude.cmd"
    echo echo   Claude exited with code: %%errorlevel%% >> "data\halo-launchers\test-claude.cmd"
    echo cmd /k echo Done. >> "data\halo-launchers\test-claude.cmd"
    start "HALO CLAUDE TEST" cmd.exe /k "data\halo-launchers\test-claude.cmd"
    echo   Started. Check the 'HALO CLAUDE TEST' window for results.
    echo TEST8: Opened claude test window >> "%LOGFILE%"
)
echo.

echo   ==========================================
echo     DIAGNOSTICS COMPLETE
echo     Log saved to: data\halo-diagnose.log
echo   ==========================================
echo.
echo   WHAT TO CHECK:
echo     - Test 6 window: Did a plain cmd.exe window stay open?
echo     - Test 7 window: Did a Windows Terminal tab stay open?
echo     - Test 8 window: Did claude run successfully?
echo.
echo   If Test 6 works but Test 7 doesn't = wt issue
echo   If Test 7 works but Test 8 doesn't = claude CLI issue
echo   If Test 6 doesn't work = something is closing cmd.exe
echo.
echo   Press any key to close this diagnostic window...
pause >nul
