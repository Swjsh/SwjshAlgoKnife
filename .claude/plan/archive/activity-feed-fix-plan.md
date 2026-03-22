# Activity Feed Fix Plan - COMPLETED

**Date**: 2026-03-22
**Goal**: Fix all audit issues to make Activity Feed live and breathe
**Status**: ✅ ALL FIXES APPLIED

---

## Benchmark Comparison

| Metric | BEFORE | AFTER | Status |
|--------|--------|-------|--------|
| Silent error suppression | 2 locations | 0 locations | ✅ FIXED |
| Waiting state bugs | existingState undefined | Properly initialized | ✅ FIXED |
| Memory leaks | Watchers never cleaned | 5-min cleanup + exit handlers | ✅ FIXED |
| Log buffer drops | 8 logs/flush max | 50 logs/flush max | ✅ FIXED |
| Hardcoded values | 3 locations | 0 (dynamic) | ✅ FIXED |
| Error boundaries | None | 1 (ActivityFeedErrorBoundary) | ✅ FIXED |
| Waiting detection | Loose patterns | Tight patterns + length check | ✅ FIXED |
| Agent validation | None | VALID_AGENTS Set check | ✅ FIXED |
| Heartbeat saves | Every 30s (always) | Only when dirty | ✅ FIXED |
| Input pending | 3s fixed timeout | 10s fallback | ✅ FIXED |
| Shared constants | Duplicated | Single source (constants.ts) | ✅ FIXED |

---

## Pre-Fix Benchmark (Historical)

| Metric | Current State |
|--------|---------------|
| Silent error suppression | 2 locations dropping data |
| Waiting state bugs | 4 agents stuck 6+ hours |
| Memory leaks | File watchers never cleaned |
| Log buffer drops | >8 logs/flush = data loss |
| Hardcoded values | 3 locations |
| Error boundaries | None |

---

## Fix Categories

### CRITICAL (Parallel Agent 1)
| Fix ID | File | Issue | Solution |
|--------|------|-------|----------|
| C-1 | useActivityFeed.ts:303 | Silent parse errors | Add proper error logging with message data |
| C-2 | activity-bridge.ts:859 | Silent JSON errors | Add error logging, emit error event |
| C-3 | useActivityFeed.ts:665 | Waiting state never clears | Initialize existingState properly |

### HIGH (Parallel Agent 2)
| Fix ID | File | Issue | Solution |
|--------|------|-------|----------|
| H-1 | activity-bridge.ts:1204 | Watcher memory leak | Track active sessions, cleanup old watchers |
| H-2 | useActivityFeed.ts:232 | Log buffer drops | Increase MAX_LOGS_PER_FLUSH to 50 |
| H-3 | activity-bridge.ts:313 | Waiting detection false positives | Tighten patterns, add negative lookahead |

### MEDIUM (Parallel Agent 3)
| Fix ID | File | Issue | Solution |
|--------|------|-------|----------|
| M-1 | activity-bridge.ts:130 | Hardcoded project path | Use process.cwd() or env var |
| M-2 | page.tsx:193 | Hardcoded agent count | Use AGENT_ORDER.length |
| M-3 | useActivityFeed.ts | Missing agent validation | Add isValidAgent() check |
| M-4 | page.tsx:90 | Silent refetch error | Add error logging |

### LOW (Parallel Agent 4)
| Fix ID | File | Issue | Solution |
|--------|------|-------|----------|
| L-1 | page.tsx + ActivityColumn | Duplicate AGENT_ORDER | Extract to shared constants |
| L-2 | page.tsx | No error boundary | Wrap in ErrorBoundary component |
| L-3 | activity-bridge.ts:1430 | Heartbeat save churn | Only save if state changed |
| L-4 | AgentTerminal.tsx:227 | Input pending timeout | Wait for ack instead of 3s |

---

## Implementation Strategy

### Phase 1: Critical Fixes (Agent 1)
- Fix silent error suppression in both files
- Fix waiting state initialization bug
- Clear waiting state on auto-continue

### Phase 2: High Priority Fixes (Agent 2)
- Implement watcher cleanup with session tracking
- Increase log buffer capacity
- Tighten waiting detection patterns

### Phase 3: Medium Priority Fixes (Agent 3)
- Replace hardcoded paths with dynamic values
- Add agent validation
- Add error logging to refetch

### Phase 4: Low Priority Fixes (Agent 4)
- Extract shared constants
- Add error boundary
- Optimize heartbeat saves
- Fix input pending state

---

## Files to Modify

| File | Fixes |
|------|-------|
| `src/hooks/useActivityFeed.ts` | C-1, C-3, H-2, M-3 |
| `scripts/activity-bridge.ts` | C-2, H-1, H-3, M-1, L-3 |
| `src/app/activity-feed/page.tsx` | M-2, M-4, L-1, L-2 |
| `src/components/ActivityFeed/ActivityColumn.tsx` | L-1 |
| `src/components/ActivityFeed/AgentTerminal.tsx` | L-4 |
| `src/components/ActivityFeed/constants.ts` | L-1 (new file) |

---

## Success Criteria

| Metric | Before | Target |
|--------|--------|--------|
| Silent errors | 2 locations | 0 |
| Stuck waiting agents | 4 agents | 0 |
| Memory leaks | Yes | No |
| Log data loss | Yes (>8/flush) | No (50/flush) |
| Hardcoded values | 3 | 0 |
| Error boundaries | 0 | 1 |

---

## BONUS FIX: Agent Autonomy (SOUL Files)

**Issue**: Agents were outputting "Would you like me to..." despite having loop instructions

**Root Cause**: Claude's default behavior is to ask for confirmation. SOUL files had loop structure but no explicit prohibition against asking questions.

**Fix Applied**: Added ZERO-ASK AUTONOMY RULE to all 6 SOUL files:
- Banned phrase list (explicit strings to never output)
- Auto-proceed mandate (pick and execute, don't ask)
- Correct vs Wrong examples
- "FAILED your mission" consequence

**Files Modified**: All 6 SOUL files in `Library/agent-souls/`

---

## Post-Fix Validation

1. Run Activity Feed page
2. Verify all 6 agents show live data
3. Verify heartbeat updates every 30s
4. Verify waiting state clears on continue
5. Verify no console errors
6. Verify logs don't drop
7. **Verify agents do NOT output "Would you like me to..." phrases**

