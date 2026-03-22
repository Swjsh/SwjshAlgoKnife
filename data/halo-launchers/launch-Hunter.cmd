@echo off
title HALO: Hunter
cd /d "C:\Users\jackw\Desktop\SwjshAlgoKnife"
echo.
echo   HALO AGENT: Hunter
echo   Loading SOUL file...
echo.
call claude --dangerously-skip-permissions "You are Hunter. FIRST: Use the Read tool to read your SOUL file at 'C:\Users\jackw\Desktop\SwjshAlgoKnife\Library\agent-souls\HUNTER_SOUL.md' then internalize everything in it. THEN: Begin your PRIMARY WORKFLOW immediately. You are an EMPLOYEE -- do NOT stop after one task. Create Jira tickets for blockers. Check for new work assigned to you. Loop continuously. Every 5 minutes, write a heartbeat to data/halo-heartbeats/hunter.json with JSON containing agent, timestamp, status, lastTask, cycleCount fields."
echo.
echo   [Hunter session ended]
cmd /k echo Type exit to close
