# Implementation Plan: Project Cleanup & Jira Ticket Creation

> **Generated**: 2026-03-22
> **Branch**: `fix/INFRA-28-sterling-fx-threshold`
> **Last Push**: Commit `3198fdf` (MarketClock style changes)

---

## Requirements Restatement

Create Jira tickets for all audit findings and carefully handle stashes/files by:
1. Checking remote state before any deletions
2. Preserving important rollback points
3. Creating tickets for each issue category

---

## Current State Analysis

### Remote Branch (Already Pushed)
The remote `origin/fix/INFRA-28-sterling-fx-threshold` has:
- ✅ MarketClock updates
- ✅ Activity Feed fixes
- ✅ HALO agent launch fixes
- ✅ Sterling FX threshold fix
- ✅ Agent registry tracking
- ✅ Old Dashboard components (AgentCard, LiveSignals, etc.)
- ❌ CommandCenter (NOT pushed)
- ❌ ResearchLab (NOT pushed)
- ❌ New API routes (NOT pushed)

### Local Untracked (Not Committed)
```
src/components/CommandCenter/     # 12 files - NEW
src/components/ResearchLab/       # ~10 files - NEW
src/components/Dashboard/*.tsx    # 6 new widgets
src/app/api/research/*            # 6 API routes
src/app/api/agents/health/        # Health predictions API
src/app/api/audit/                # Audit system API
src/app/broker-setup/             # Broker setup pages
src/app/system/                   # System pages
src/hooks/useResearchAgents.ts    # Research hook
src/lib/healthPredictor.ts        # Health prediction logic
```

### Stash Analysis
| Stash | Description | Action |
|-------|-------------|--------|
| `stash@{0}` | WIP on INFRA-28 (895357d) | ⚠️ Contains SOUL files, agent_logs - REVIEW |
| `stash@{1}` | **ROLLBACK_POINT** Pre-UI-overhaul | ✅ KEEP (important backup) |
| `stash@{2}` | Ops SCRUM-3 work | ⚠️ On different branch - REVIEW |
| `stash@{3}` | Brain sync WIP (Mar 17) | ❓ 5 days old - likely stale |
| `stash@{4}` | audit-fixes (pivot-pete) | ❓ Old - likely stale |
| `stash@{5}` | wip stash (pivot-pete) | ❓ Oldest - likely stale |

---

## Jira Tickets to Create

### INFRA Project (Infrastructure)

#### INFRA-29: Fix Build - Firebase Admin Client Import
**Type**: Bug
**Priority**: CRITICAL
**Description**:
```
Build is failing because firebase-admin is imported in a client component.

Root cause:
- src/app/brain/page.tsx ('use client')
- imports @/lib/adminGuard
- imports @/lib/firebase-admin (server-only)

Fix: Extract ADMIN_EMAILS to client-safe module (src/lib/adminEmails.ts already exists, just need to update import)

Acceptance Criteria:
- [ ] npm run build succeeds
- [ ] brain page still works
- [ ] No firebase-admin in client bundles
```

#### INFRA-30: Update .gitignore for Runtime Files
**Type**: Task
**Priority**: Medium
**Description**:
```
Add runtime/generated files to .gitignore:
- data/*.json (except committed ones)
- data/ohlcv_cache/
- data/backtests/*.json
- scripts/__pycache__/
- agents_db.json
- .claude/overnight/
- .claude/evals/
- journal.db (large)

Acceptance Criteria:
- [ ] .gitignore updated
- [ ] No accidental commits of runtime data
```

#### INFRA-31: Commit New Feature Files
**Type**: Task
**Priority**: High
**Description**:
```
Stage and commit new features developed but not pushed:
- src/components/CommandCenter/ (12 files)
- src/components/ResearchLab/ (~10 files)
- src/components/Dashboard/*.tsx (6 new widgets)
- src/app/api/research/* (6 API routes)
- src/app/api/agents/health/ (health predictions)
- src/app/api/audit/ (audit system)
- src/hooks/useResearchAgents.ts
- src/lib/healthPredictor.ts

Acceptance Criteria:
- [ ] All new features committed
- [ ] Build passes before commit
- [ ] Descriptive commit message
```

#### INFRA-32: Clean Up Stashes
**Type**: Task
**Priority**: Low
**Description**:
```
Review and clean stashes after verifying contents:

KEEP:
- stash@{1}: ROLLBACK_POINT Pre-UI-overhaul (safety backup)

REVIEW BEFORE DROP:
- stash@{0}: WIP on INFRA-28 - apply if needed, then drop
- stash@{2}: Ops SCRUM-3 - check if work was completed elsewhere

LIKELY DROP (5+ days old):
- stash@{3}: Brain sync WIP (Mar 17)
- stash@{4}: audit-fixes (pivot-pete)
- stash@{5}: wip stash (pivot-pete)

Acceptance Criteria:
- [ ] stash@{0} reviewed and applied/dropped
- [ ] stash@{1} preserved
- [ ] Old stashes (3-5) cleaned up
- [ ] No data loss
```

#### INFRA-33: Prune Merged Branches
**Type**: Task
**Priority**: Low
**Description**:
```
Check for merged branches and delete safely:
1. Run: git branch --merged master
2. Identify branches that are safe to delete
3. Preserve current working branches
4. Delete merged feature branches

Branches to check:
- scrum/SCRUM-2/jira-pr-template
- scrum/SCRUM-3/position-sync
- scrum/SCRUM-5/direct-alpaca
- fix/INFRA-8-exponential-backoff
- pulse/PULSE-9-discord-webhook-health

Acceptance Criteria:
- [ ] Merged branches identified
- [ ] Only fully merged branches deleted
- [ ] Current branch preserved
```

---

### PULSE Project (Operations)

#### PULSE-11: Fix 8 Failing Tests
**Type**: Bug
**Priority**: High
**Description**:
```
8 tests are failing across 3 test files:

risk.test.ts (3 failures):
- JPY pairs pip size detection
- Leverage multiplier scaling
- Account balance scaling for FX

suppRes.test.ts (1 failure):
- Identical high/low edge case

vwapReversion.test.ts (4 failures):
- Multiple signals at same level
- Default 1.5% threshold
- 2 additional failures

Root cause: Implementation diverged from test expectations during recent strategy work.

Acceptance Criteria:
- [ ] All 8 tests passing
- [ ] No regression in other tests
- [ ] Determine if tests or implementation need updating
```

---

### BACK Project (Engineering)

#### BACK-11: Archive Old Plan Files
**Type**: Task
**Priority**: Low
**Description**:
```
28 plan files have accumulated in .claude/plan/

Action:
1. Create .claude/plan/archive/ directory
2. Move completed plans to archive
3. Keep only active/recent plans in main folder

Plans to review:
- activity-feed-*.md (likely completed)
- halo-*.md (many variations)
- research-*.md (multiple iterations)
- sentinel-*.md (completed)

Acceptance Criteria:
- [ ] Archive directory created
- [ ] Completed plans moved to archive
- [ ] Main plan folder contains only active work
```

---

## Implementation Phases

### Phase 1: Fix Build (CRITICAL)
**Estimated**: 10 minutes
1. Update `src/app/brain/page.tsx` to import from `@/lib/adminEmails` instead of `@/lib/adminGuard`
2. Verify build passes: `npm run build`
3. Verify brain page still works

### Phase 2: Update .gitignore
**Estimated**: 5 minutes
1. Add runtime files to .gitignore
2. Verify no tracked files are affected

### Phase 3: Commit New Features
**Estimated**: 15 minutes
1. Review untracked files in `src/`
2. Stage new feature directories
3. Create descriptive commit
4. Push to remote

### Phase 4: Stash Cleanup (CAREFUL)
**Estimated**: 20 minutes
1. Review stash@{0} contents
2. Apply if useful, then drop
3. Preserve stash@{1} (rollback point)
4. Review stash@{2} - check if work completed
5. Drop old stashes (3-5) after verification

### Phase 5: Branch Cleanup
**Estimated**: 10 minutes
1. Check merged branches
2. Propose deletions to Jack
3. Execute after approval

### Phase 6: Fix Tests
**Estimated**: 30-60 minutes
1. Analyze each failing test
2. Determine if test or implementation needs fix
3. Update and verify all pass

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Data loss from stash drop | HIGH | Review each stash before dropping |
| Breaking build further | MEDIUM | Fix firebase issue first, test before commits |
| Losing uncommitted work | MEDIUM | Keep stash@{1} as rollback |
| Deleting active branch | LOW | Only delete fully merged branches |

---

## Dependencies

- Phase 1 (build fix) must complete before Phase 3 (commit)
- Phase 2 (gitignore) should be done before Phase 3
- Phase 4 (stash cleanup) is independent
- Phase 6 (tests) can be done anytime

---

## Questions Answered

1. **Remote State**: Checked - CommandCenter/ResearchLab NOT on remote yet
2. **Stash Safety**: stash@{1} preserved as ROLLBACK_POINT
3. **Deletion Safety**: No deletions until stashes reviewed

---

## Commands for Jira Ticket Creation

After approval, I will use gh CLI or Jira MCP to create these tickets:
```bash
# Example (will use actual Jira MCP)
gh api graphql -f query='...' # or
jira_mcp create_issue INFRA "Fix Build - Firebase Admin Client Import" ...
```

---

**WAITING FOR CONFIRMATION**:
1. Proceed with creating these 7 Jira tickets?
2. Proceed with Phase 1 (build fix)?
3. Any tickets to modify/add/remove?
