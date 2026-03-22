@echo off
title Research: RESEARCHER (T3) [overnight-2026-03-22-162529]
cd /d "C:\Users\jackw\Desktop\SwjshAlgoKnife"
echo.
echo ========================================
echo   RESEARCH AGENT: RESEARCHER
echo   Terminal 3 of 8 (Group 1: Internal Improvement)
echo   Session: overnight-2026-03-22-162529
echo   Mode: INTERACTIVE (persistent)
echo ========================================
echo.
echo Prompt file: C:\Users\jackw\Desktop\SwjshAlgoKnife\.claude\overnight\terminal_3_prompt.md
echo.
echo Starting Claude Code in interactive mode...
echo.
claude --dangerously-skip-permissions --system-prompt "C:\Users\jackw\Desktop\SwjshAlgoKnife\.claude\overnight\terminal_3_prompt.md" "You are RESEARCHER. Begin your PRIMARY WORKFLOW now. Execute all tasks autonomously. Do NOT ask questions. Do NOT wait for user input. Proceed immediately with your mission."
echo.
echo ========================================
echo   [Session ended - press any key to close]
echo ========================================
pause >nul
