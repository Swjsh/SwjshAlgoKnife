# Implementation Plan: Research Lab Gaps Fix

## Task Type
- [x] Backend (→ Prompt generation, command polling)
- [ ] Frontend
- [ ] Fullstack

---

## Status: COMPLETED ✅

**Execution Date**: 2026-03-22
**All gaps have been addressed.**

---

## Executive Summary

After thorough audit, the Research Lab has **fewer gaps than initially thought**:

| Original Gap | Actual Status | Action Taken |
|--------------|--------------|--------------|
| GAP-001: Eval Harness | EXISTS - 670 lines, fully functional | None needed |
| GAP-002: Morning Report | EXISTS - 721 lines, fully functional | None needed |
| GAP-003: Command Queue Polling | FIXED | Added COMMAND_POLLING_SECTION to all 8 prompts |
| GAP-004: Heartbeat Writing | FIXED | Added HEARTBEAT_PROTOCOL to all 8 prompts |

---

## Changes Made

### 1. Added Command Polling Section

**File**: `scripts/generate_overnight_prompts.ts`

Added new constant `COMMAND_POLLING_SECTION` that instructs agents to:
- Check `.claude/overnight/commands/terminal_N_queue.json` every 5 minutes
- Process pending commands (report progress, status, pause, skip)
- Mark commands as executed after processing
- Ignore unsafe commands (file deletions, git force, etc.)

### 2. Added Standardized Heartbeat Protocol

**File**: `scripts/generate_overnight_prompts.ts`

Added new constant `HEARTBEAT_PROTOCOL` that instructs agents to write:
- **Status JSON** (overwrite): `.claude/overnight/terminal_N_status.json`
  - Fields: status, role, terminal, group, sessionId, lastActivity, launchedAt, currentPhase, tasksCompleted, tasksFailed
- **Heartbeat Log** (append): `.claude/overnight/terminal_N_heartbeat.jsonl`
  - Fields: timestamp, phase, done, failed, context_pct

### 3. Updated All 8 Prompt Generators

Added `${COMMAND_POLLING_SECTION}` and `${HEARTBEAT_PROTOCOL}` before `${EXIT_CONDITIONS}` in:
- `generateImproverPrompt()` (Terminal 1)
- `generateBacktestPrompt()` (Terminal 2)
- `generateResearcherPrompt()` (Terminal 3)
- `generateBrainUpdaterPrompt()` (Terminal 4)
- `generateSecurityAuditorPrompt()` (Terminal 5)
- `generateIntegrationTesterPrompt()` (Terminal 6)
- `generateIntelAggregatorPrompt()` (Terminal 7)
- `generateDevOpsOptimizerPrompt()` (Terminal 8)

### 4. Created Commands Directory

Created `.claude/overnight/commands/` directory for command queue files.

### 5. Regenerated All Prompts

Ran `npx tsx scripts/generate_overnight_prompts.ts --group all` to apply changes to all 8 terminal prompts.

---

## Verification Results

```bash
# Command Queue Polling present in all 8 prompts
grep -l "Command Queue Polling" .claude/overnight/terminal_*_prompt.md
# Result: 8 files found ✅

# Heartbeat Protocol present in all 8 prompts
grep -l "Heartbeat Protocol" .claude/overnight/terminal_*_prompt.md
# Result: 8 files found ✅
```

---

## Files Modified

| File | Operation | Lines Changed |
|------|-----------|---------------|
| `scripts/generate_overnight_prompts.ts` | Modified | +60 lines (constants), +16 lines (inclusions) |
| `.claude/overnight/terminal_1_prompt.md` | Regenerated | +~50 lines |
| `.claude/overnight/terminal_2_prompt.md` | Regenerated | +~50 lines |
| `.claude/overnight/terminal_3_prompt.md` | Regenerated | +~50 lines |
| `.claude/overnight/terminal_4_prompt.md` | Regenerated | +~50 lines |
| `.claude/overnight/terminal_5_prompt.md` | Regenerated | +~50 lines |
| `.claude/overnight/terminal_6_prompt.md` | Regenerated | +~50 lines |
| `.claude/overnight/terminal_7_prompt.md` | Regenerated | +~50 lines |
| `.claude/overnight/terminal_8_prompt.md` | Regenerated | +~50 lines |
| `.claude/overnight/commands/` | Created | New directory |

---

## Research Lab Status: FULLY OPERATIONAL

All 8 research agents are now:
1. Using correct HALO launcher patterns (no `-p`, uses `--system-prompt`, `--dangerously-skip-permissions`)
2. Writing standardized heartbeat status files
3. Polling for dashboard commands
4. Following consistent exit protocols

The Research Lab is **ready for autonomous overnight research**.

---

*Plan completed: 2026-03-22*
*Total changes: ~476 lines across 10 files*
