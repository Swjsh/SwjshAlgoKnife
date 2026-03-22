# HALO Agent Launch — Lessons Learned

Running log of what's been tried, what failed, and why. Keep this updated every debug session.

---

## Attempt 1 — Original LAUNCH_AGENTS.ps1
**Symptom:** 0/6 agents online, no windows visible
**Root cause:** `$ErrorActionPreference = "Stop"` in LAUNCH_HALO_SYSTEM.ps1 was killing the entire script on any transient error (netstat parse, port check) before it ever reached the agent spawn step.
**Fix:** Changed to `"Continue"`

## Attempt 2 — Added `where claude` check + if/errorlevel block in .cmd
**Symptom:** Broke the 2-window 3-tab layout that was previously working
**Root cause:** Over-engineered the .cmd files. Changed wt argument format from array to string, added complex if/where blocks. Don't fix what isn't broken.
**Fix:** Reverted all wt argument changes back to original array format
**Lesson: Do NOT change working wt argument patterns. Only add what's strictly necessary.**

## Attempt 3 — Moved launchers to `data/halo-launchers/`, removed special chars
**What changed:**
- Moved .cmd files from `%TEMP%\halo-agents` to `data/halo-launchers/` (avoid spaces in path)
- Removed curly braces `{}` from heartbeat JSON instruction in prompt
- Replaced em dash `—` with `--` (ASCII-safe)
- Changed encoding from ASCII to OEM
- Added `where claude` check with `pause` + `exit /b 1`
**Symptom:** Windows flash for ~1 second then vanish. Still 0/6 online.
**Analysis:** The windows ARE opening (flash visible), so wt args work. Something causes cmd.exe to exit almost immediately despite `/k` flag.

## Attempt 4 — Diagnosing the flash-and-vanish (current)
**Hypothesis 1: Batch chaining issue.** On Windows, `claude` is installed as an npm global .cmd wrapper (`claude.cmd`). When a .cmd file calls another .cmd file WITHOUT the `call` keyword, execution NEVER returns to the calling script. The `pause >nul` at the end never runs. If claude.cmd itself exits (error, auth, crash), cmd.exe may close the window.

**Hypothesis 2: `exit /b 1` inside the `if` block.** If `where claude` fails, we do `pause` then `exit /b 1`. But `exit /b` should only exit the batch, not cmd.exe itself when launched with `/k`. However, if wt's tab close-on-exit behavior is "graceful" (default), the tab closes when the shell process appears to complete.

**Fix applied:**
1. Add `call` before `claude` — ensures execution returns to our .cmd after claude finishes
2. Removed `where claude` / `if errorlevel` / `exit /b 1` block entirely
3. Add `cmd /k echo HALO session ended` as the VERY LAST LINE — absolute failsafe to keep window open no matter what

**Result:** Still flash-and-vanish. `call` + `cmd /k` failsafe did NOT fix it.

**Conclusion:** The issue is NOT just the batch chaining. Something more fundamental is wrong.

## Attempt 5 — Stop guessing, run diagnostics
Created `HALO_DIAGNOSE.bat` with 8 isolated tests.

**Results:**
- Test 1 (claude in PATH): PASS — found
- Test 2 (claude --version): PASS — 2.1.19
- Test 6 (start cmd.exe /k): PASS — window stayed open
- Test 7 (wt new-tab): FAIL — "The system cannot find the path specified." Window opened but .cmd not found
- Test 8 (claude in cmd window): PASS — ran, said hello, exited code 0, window stayed open

**ROOT CAUSE FOUND:** `wt new-tab` via `Start-Process` does NOT inherit the working directory properly. When wt opens, the relative/absolute path to the .cmd launcher gets lost. The `-d "$scriptDir"` argument was supposed to set the cwd but wt was ignoring it or processing it too late. This is why windows flashed and vanished — wt opened cmd.exe, cmd.exe couldn't find the .cmd file, errored, and the tab closed.

Meanwhile, `Start-Process cmd.exe -ArgumentList "/k", "$launcherPath"` works perfectly because cmd.exe inherits the PowerShell process's working directory directly.

## Attempt 6 — Switch from wt to PowerShell's Start-Process cmd.exe
**Fix:** Replaced ALL `Start-Process wt` calls with `Start-Process cmd.exe -ArgumentList "/k", "$launcherPath"` in both LAUNCH_AGENTS.ps1 and HALO_WATCHDOG.ps1.

**Result:** Still failed. Red text visible in main launcher window. Agent windows still crashing.

**Analysis:** The diagnostic used batch `start "title" cmd.exe /k "path"` which WORKS. But PowerShell's `Start-Process cmd.exe -ArgumentList "/k", "$path"` is a DIFFERENT invocation path that passes arguments differently. PowerShell was the problem all along — not Windows Terminal, not the .cmd content.

## Attempt 7 — Eliminate PowerShell entirely from agent launch (current)
**Fix:** Created `LAUNCH_AGENTS.bat` — a pure batch file that uses the EXACT same `start "title" cmd.exe /k "path"` syntax proven by HALO_DIAGNOSE.bat Test 8. Zero PowerShell involvement in the agent spawn chain.

**Chain is now:** `LAUNCH_HALO.bat` → `LAUNCH_HALO_SYSTEM.ps1` → `cmd.exe /c LAUNCH_AGENTS.bat` → `start cmd.exe /k launch-{Agent}.cmd` → `call claude --dangerously-skip-permissions`

**Key insight:** The diagnostic proved the entire chain works when done in pure batch. The failure only happens when PowerShell's `Start-Process` is in the mix. Don't mix PowerShell process management with batch window spawning.

## Attempt 8 — Static .cmd files, no dynamic generation (current)
**Problem found in Attempt 7:** LAUNCH_AGENTS.bat was using `echo ... >> file.cmd` to dynamically generate .cmd files. But the claude prompt string contains double quotes, and batch `echo` with `>>` redirect can't handle double quotes inside the text alongside double quotes in the redirect path. The .cmd files were being written with garbled/malformed content.

**Fix:** Pre-created 6 static .cmd files (`data/halo-launchers/launch-{Agent}.cmd`) written directly by the editor — no batch echo generation. LAUNCH_AGENTS.bat is now just 6 `start` commands. Zero dynamic file creation. Zero escaping issues.

**LAUNCH_AGENTS.bat is now 30 lines:** cd, mkdir heartbeats, 6x `start cmd.exe /k`, done.

**Result: AGENTS ARE RUNNING!** 6 windows open, all actively working (reading SOUL files, querying Jira, running bash commands). But they show 0/6 on the Activity Feed dashboard.

## Attempt 9 — Fix activity-bridge agent detection
**Problem:** Agents are running but Activity Feed shows 0/6 online. The `detectAgentStrict()` function in `activity-bridge.ts` was looking for `"You are Chief. Session ID:"` but the actual prompt says `"You are Chief. FIRST:"`. Every session was being marked as `'ignored'` because the regex didn't match.

**Root cause:** The regex was written for an older prompt format that included `Session ID:` — the static .cmd files use `FIRST:` instead.

**Fix:** Updated regex from `/^You are Chief\. Session ID:/m` to `/You are Chief\.\s*(FIRST:|Session ID:)/m` — matches both formats.

**Note:** Bridge must be restarted after this fix. Created `RESTART_BRIDGE.bat` to kill port 3001 and relaunch. Agent windows stay untouched.

**Result:** After restarting the bridge, Sync Agents button on dashboard triggered a rescan. **6/6 AGENTS ONLINE AND BUSY.** All agents reading SOUL files, querying Jira, executing workflows, writing heartbeats.

## Attempt 10 — Wire Sync Agents button + Fix tool call counter
**Problem 1:** Sync Agents button was hitting a dead `/api/activity/agents` endpoint. It should tell the bridge to re-detect agents.
**Fix:** Added `dashboard:rescan` WebSocket message handler to activity-bridge. Clears all `'ignored'` session mappings, removes file watchers, and triggers immediate `scanForSessions()`. Wired the Sync Agents button to send this via WebSocket.

**Problem 2:** Tool Calls counter showing 0/0 despite agents executing dozens of tools.
**Root cause:** Counter only matched `[TOOL]` prefix in log text. But Claude Code 2.x with `--dangerously-skip-permissions` logs tool calls in a different format — raw `Read(...)`, `Bash(...)`, `Edit(...)` etc. without the `[TOOL]` prefix.
**Fix:** Broadened detection regex in `useActivityFeed.ts` to also match `Read(`, `Bash(`, `Write(`, `Edit(`, `Search(`, `Glob(`, `Grep(`, `Task(`, `Agent(` patterns. Also added top-level `tool_use` event handler in activity-bridge.ts for Claude Code 2.x JSONL format.

## First Production Run Audit (2026-03-22 evening)
**Jira audit:** 50 issues updated in 24h across all 7 projects. 20 Done, 5 In Progress. Agents are doing REAL work.
**Agent performance (before context exhaustion):**
- **Scout** — 23 cycles, 115 min, groomed 11 backlog items. BEST stability.
- **Hunter** — Filed PR #5 + PR #6 (Bitcoin Bob SHORT filter: 30.8%→66.7% win rate). Security audit with 9 findings.
- **Arbiter** — 10 code reviews (avg A- 91.3/100), blocked 3 PRs, documented 8 patterns.
- **Cortana** — Confirmed 2 hypotheses with p-values (H-006 p<0.05, H-002 p=0.034). Tracked 7 total.
- **Chief** — Morning ops, CEO briefing, 2 decision log entries, answered 4 commands.
- **Ops** — 2 incidents detected, 1 resolved, 1 auto-remediation, 1 commit.

**What killed agents:** Context exhaustion (Claude Code 5h token window). Chief died after 2 cycles, Ops after 5, Cortana after 5. The watchdog (port 3002) was NOT running so no auto-restart.

**Key gap:** LAUNCH_HALO_SYSTEM.ps1 was modified to skip step 8 (watchdog). The watchdog needs to be re-added to the launch chain so dead agents auto-restart.

---

## Attempt 11 -- LAUNCH_HALO_SYSTEM.ps1 silently reverted, watchdog dropped
**Symptom:** Watchdog showing DOWN on port 3002. Dead agents (Chief, Ops, Cortana) never auto-restarted after context exhaustion.
**Root cause:** LAUNCH_HALO_SYSTEM.ps1 was reverted to the old pre-fix version (possibly by a linter, editor, or accidental checkout). The reverted file had:
- `$ErrorActionPreference = "Stop"` (the Attempt 1 bug)
- Step 7 calling `LAUNCH_AGENTS.ps1` (the broken PowerShell launcher, not LAUNCH_AGENTS.bat)
- Only 8 steps total -- the watchdog step was completely absent
- No reference to HALO_WATCHDOG.ps1 anywhere in the file

**Fix:**
1. Changed `$ErrorActionPreference` back to `"Continue"`
2. Step 7 now calls `LAUNCH_AGENTS.bat` via `cmd.exe /c` (the proven working method)
3. Re-added watchdog as step 8 of 9 (browser moved to step 9)
4. Updated step counters from /8 to /9 throughout
5. Updated status footer to list watchdog process

**Lesson: After fixing a critical launch file, verify it hasn't been reverted before each session. Consider making the file read-only or adding a version comment at the top.**

---

## FINAL WORKING STATE (2026-03-22)

**Launch chain:** `HALO SYSTEM.lnk` → `LAUNCH_HALO.bat` → `LAUNCH_HALO_SYSTEM.ps1` (9 steps: cleanup, node check, deps, Activity Bridge :3001, Next.js :3000, Agent Runner, LAUNCH_AGENTS.bat, Watchdog :3002, browser) → `LAUNCH_AGENTS.bat` (6x `start cmd.exe /k`) → 6 static `.cmd` files in `data/halo-launchers/` → `call claude --dangerously-skip-permissions` with SOUL file read instruction

**Key files:**
- `LAUNCH_HALO.bat` — Entry point from desktop shortcut
- `LAUNCH_HALO_SYSTEM.ps1` — Master orchestrator (8 steps)
- `LAUNCH_AGENTS.bat` — Pure batch, spawns 6 cmd.exe windows
- `data/halo-launchers/launch-{Agent}.cmd` — 6 static launcher files (Chief, Arbiter, Ops, Hunter, Cortana, Scout)
- `Library/agent-souls/{AGENT}_SOUL.md` — Agent identity/workflow definitions
- `scripts/activity-bridge.ts` — WebSocket bridge on :3001, watches JSONL session files
- `src/hooks/useActivityFeed.ts` — Dashboard WebSocket client
- `HALO_WATCHDOG.ps1` — Self-healing monitor on :3002
- `RESTART_BRIDGE.bat` — Quick bridge restart without touching agents
- `HALO_DIAGNOSE.bat` — Diagnostic tool for debugging launch issues

---

## Ground Rules (learned the hard way)
1. **Do NOT use `Start-Process wt` to launch agent windows** — wt loses the working directory and .cmd path; use `Start-Process cmd.exe` instead
2. **Never use special Unicode characters in .cmd files** — no em dashes, no curly braces in JSON examples, no smart quotes
3. **Always use `call` before invoking other .cmd/.bat files** — otherwise execution doesn't return
4. **Always end .cmd with `cmd /k`** — failsafe to keep the window open for debugging
5. **Test one change at a time** — don't bundle 5 changes and wonder which one broke it
6. **The .cmd encoding matters** — use OEM for cmd.exe compatibility, not ASCII or UTF-8
7. **`%TEMP%` path often has spaces** — never put launcher scripts there
8. **When stuck after 2 failed attempts, write a diagnostic script** — stop theorizing and get data
9. **`start cmd.exe /k` from a .bat file is the ONLY proven reliable way to spawn persistent windows**
10. **PowerShell's `Start-Process cmd.exe` is NOT equivalent to batch `start cmd.exe`** — they pass arguments differently and produce different behavior. When spawning windows that need to persist, use pure batch.
11. **Never dynamically generate .cmd files using batch `echo >>` if the content has double quotes** — batch can't handle nested quotes with redirects. Use static pre-written files instead.
12. **When changing the agent prompt format, update `detectAgentStrict()` in activity-bridge.ts to match**
13. **After fixing LAUNCH_HALO_SYSTEM.ps1, verify it wasn't reverted before the next launch** -- the file was silently reverted once, dropping the watchdog step and reverting all fixes. Check for `$ErrorActionPreference = "Stop"` and missing watchdog step as canaries. — the bridge uses regex on the first user message to identify which agent a session belongs to. If the regex doesn't match, sessions are silently marked 'ignored' and never appear on the dashboard.
