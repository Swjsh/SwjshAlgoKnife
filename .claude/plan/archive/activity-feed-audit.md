# Implementation Plan: Activity Feed Data Hydration Audit

## Task Type
- [x] Fullstack (→ Parallel analysis needed)

## Executive Summary

This audit traces the complete data flow from the **HALO System shortcut** through to the **Activity Feed dashboard**, identifying 4 critical issues preventing accurate display of agent activity.

---

## Complete Data Flow Trace

### Step 1: Launcher Chain
```
HALO SYSTEM.lnk
  → C:\Users\jackw\Desktop\LAUNCH_HALO.bat
    → LAUNCH_HALO_SYSTEM.ps1
      → activity-bridge.ts (port 3001)
      → npm run dev (port 3000)
      → agent_runner.ts (trading bots)
      → LAUNCH_AGENTS.ps1 (6 Claude terminals)
```

### Step 2: Agent Spawning (LAUNCH_AGENTS.ps1)
Each agent runs:
```cmd
claude --dangerously-skip-permissions --system-prompt "$soulPath" "You are $agentName. Your SOUL file has been loaded..."
```

**Key observation**: Agents use `--system-prompt` which injects SOUL content but does NOT include identifiers like "Terminal 1: Chief" in the transcript. The detection patterns in activity-bridge.ts expect these identifiers.

### Step 3: JSONL Session Watching
- `activity-bridge.ts` scans `~/.claude/projects/C--Users-jackw-Desktop-SwjshAlgoKnife/*.jsonl`
- Every 10 seconds via `scanForSessions()`
- Reads new content via `fs.watch()` + `readNewContent()`

### Step 4: Agent Detection (THE CRITICAL ISSUE)
Two detection tiers attempt to identify which session belongs to which agent:

**Strict patterns** (lines 886-901):
```typescript
chief: /Terminal 1[:\s]+Chief|halo-crew[\/\\]agents[\/\\]chief[\/\\]CLAUDE\.md/i
```

**Broad patterns** (lines 847-863):
```typescript
chief: /Terminal 1.*Chief|agent-mgmt\.md|MGMT Agent|management|orchestrat/i
```

**PROBLEM**: The launch command sends:
```
"You are Chief. Your SOUL file has been loaded as system context..."
```

Neither strict nor broad patterns match this! The patterns look for:
- `Terminal 1: Chief` (never sent)
- `halo-crew/agents/chief/CLAUDE.md` (old path structure, not used)
- `agent-mgmt.md` (old naming convention)

**RESULT**: All sessions fall through to `chief` as default fallback (line 948), causing all agent output to appear in Chief's terminal.

### Step 5: Log Broadcasting
`broadcastLog()` → WebSocket message `agent:log` → Dashboard

### Step 6: Client-Side Log Buffering
`useActivityFeed.ts` buffers logs:
- 750ms flush interval
- Max 3 logs per agent per flush
- Max 500 logs retained per agent

### Step 7: Terminal Rendering
`AgentTerminal.tsx` renders buffered logs with:
- 500 char truncation per message
- ANSI color parsing
- Auto-scroll

---

## Critical Issues Identified

### Issue 1: Agent Detection Patterns Don't Match Launch Format
**Severity**: CRITICAL
**File**: `scripts/activity-bridge.ts` lines 846-902
**Impact**: All agents show in Chief's terminal

**Root Cause**: The detection patterns were written for an old launch format that no longer exists. Current `LAUNCH_AGENTS.ps1` sends "You are {Agent}..." but patterns look for "Terminal N: {Agent}".

**Fix**: Update `detectAgentStrict()` to match current launch message format:
```typescript
const strictPatterns: Record<string, RegExp> = {
  chief:   /You are Chief\.|CHIEF_SOUL\.md|Chief.*SOUL/i,
  hunter:  /You are Hunter\.|HUNTER_SOUL\.md|Hunter.*SOUL/i,
  ops:     /You are Ops\.|OPS_SOUL\.md|Ops.*SOUL/i,
  scout:   /You are Scout\.|SCOUT_SOUL\.md|Scout.*SOUL/i,
  arbiter: /You are Arbiter\.|ARBITER_SOUL\.md|Arbiter.*SOUL/i,
  cortana: /You are Cortana\.|CORTANA_SOUL\.md|Cortana.*SOUL/i,
  oracle:  /You are Oracle\.|ORACLE_SOUL\.md|Oracle.*SOUL/i,
};
```

### Issue 2: Excessive Content Truncation
**Severity**: HIGH
**Files**:
- `activity-bridge.ts` line 989: truncates to 300 chars
- `useActivityFeed.ts` line 369: truncates to 1000 chars
- `AgentTerminal.tsx` line 89: truncates to 500 chars

**Impact**: Important context lost, especially tool outputs and error messages.

**Fix**: Increase truncation limits:
- Bridge: 300 → 2000 chars
- Hook: 1000 → 3000 chars
- Terminal: 500 → 2000 chars

### Issue 3: Log Throttling Drops Messages
**Severity**: MEDIUM
**File**: `useActivityFeed.ts` lines 210-211
```typescript
const LOG_FLUSH_INTERVAL = 750;  // 750ms
const MAX_LOGS_PER_FLUSH = 3;    // Only 3 per agent
```

**Impact**: Fast-producing agents lose intermediate output. A real terminal shows all lines; this shows ~4 per second max.

**Fix**: Adjust for better fidelity:
```typescript
const LOG_FLUSH_INTERVAL = 400;  // Faster flush
const MAX_LOGS_PER_FLUSH = 8;    // More logs per flush
```

### Issue 4: Commands Never Reach Standard Halo Agents
**Severity**: MEDIUM
**Files**: `activity-bridge.ts` lines 545-569

**Impact**: Dashboard command inputs are queued to `data/commands/{agent}.json` but Halo agents (running raw `claude` CLI) never poll these files.

**Fix Options**:
A. Add instruction to SOUL files to check command queue periodically
B. (Complex) Inject commands into JSONL session files
C. (User awareness) Display warning that commands are queued but may not reach agent

---

## Implementation Steps

### Step 1: Fix Agent Detection Patterns
**File**: `scripts/activity-bridge.ts`
**Changes**:
1. Update `detectAgentStrict()` with patterns matching "You are {Agent}" launch format
2. Update `detectAgent()` broad patterns similarly
3. Add SOUL file path pattern matching for `Library/agent-souls/{AGENT}_SOUL.md`

### Step 2: Increase Truncation Limits
**Files**: `activity-bridge.ts`, `useActivityFeed.ts`, `AgentTerminal.tsx`
**Changes**:
1. Bridge: `part.text.substring(0, 300)` → `substring(0, 2000)`
2. Hook: `lineText.substring(0, 1000)` → `substring(0, 3000)`
3. Terminal: `text.length > 500` → `text.length > 2000`

### Step 3: Adjust Log Throttling
**File**: `useActivityFeed.ts`
**Changes**:
1. `LOG_FLUSH_INTERVAL`: 750 → 400
2. `MAX_LOGS_PER_FLUSH`: 3 → 8

### Step 4: Add Command Queue Warning (Optional)
**File**: `AgentTerminal.tsx`
**Changes**:
1. Add visual indicator that commands are queued but agent may not receive them
2. Consider adding SOUL file guidance for command queue polling

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `scripts/activity-bridge.ts:846-902` | Modify | Fix agent detection regex patterns |
| `scripts/activity-bridge.ts:989` | Modify | Increase assistant text truncation to 2000 |
| `src/hooks/useActivityFeed.ts:210-211` | Modify | Adjust log throttling constants |
| `src/hooks/useActivityFeed.ts:369` | Modify | Increase hook truncation to 3000 |
| `src/components/ActivityFeed/AgentTerminal.tsx:89` | Modify | Increase terminal truncation to 2000 |

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Detection patterns may not match all edge cases | Test with live agents immediately after change |
| Increased truncation limits may impact UI performance | Monitor DOM size, add CSS overflow safeguards |
| Faster log flushing may cause more re-renders | Profile React render frequency |
| Agent detection fallback to 'chief' masks errors | Add logging when falling back |

---

## Verification Steps

After implementation:
1. Launch HALO system via shortcut
2. Watch activity-bridge console for agent detection messages
3. Confirm each agent's output appears in correct terminal panel
4. Send commands from dashboard, verify queued indicator
5. Check for any truncation on long tool outputs

---

## SESSION_ID (for /ccg:execute use)

No external model sessions were used - this audit was performed with direct codebase analysis.
