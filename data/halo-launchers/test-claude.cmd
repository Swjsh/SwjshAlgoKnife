@echo off 
title HALO CLAUDE TEST 
cd /d "C:\Users\jackw\Desktop\SwjshAlgoKnife\" 
echo   About to run: claude --version 
call claude --version 
echo   Exit code: %errorlevel% 
echo. 
echo   Now running claude with a simple prompt... 
call claude --dangerously-skip-permissions -p "Say hello and exit" 
echo   Claude exited with code: %errorlevel% 
cmd /k echo Done. 
