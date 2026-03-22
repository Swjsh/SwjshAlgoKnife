# Comprehensive Project Audit — 2026-03-22

> **Generated**: 2026-03-22
> **Branch**: `fix/INFRA-28-sterling-fx-threshold`
> **Purpose**: Full system state analysis covering git, build, tests, documentation, and cleanup recommendations

---

## 1. Executive Summary

| Area | Status | Priority Action |
|------|--------|-----------------|
| **Git Status** | ⚠️ 273 untracked files, 10 modified | Needs cleanup/commit |
| **Build** | ❌ FAILING | Fix firebase-admin client import |
| **Tests** | ⚠️ 8 failing / ~100 passing | Fix 8 test failures |
| **Documentation** | ✅ Up to date | Master Tracker current |
| **Plan Files** | ⚠️ 28 plan files accumulated | Archive/cleanup old plans |
| **Stashes** | ⚠️ 6 stashes | Review and clean stashes |
| **Branches** | ⚠️ 15+ branches | Prune merged branches |

---

## 2. Build Status: CRITICAL ❌

### Problem
The build is failing due to `firebase-admin` being imported in a client component.

### Root Cause
```
src/app/brain/page.tsx (Client Component)
  → imports @/lib/adminGuard
    → imports @/lib/firebase-admin
      → firebase-admin uses node:net (server-only)
```

The `brain/page.tsx` is marked `'use client'` but imports `adminGuard.ts` which imports `firebase-admin`. Firebase Admin SDK is server-only and cannot be bundled for the browser.

### Fix Options

**Option A (Recommended)**: Extract client-safe parts
```typescript
// src/lib/adminEmails.ts (client-safe, already exists!)
export const ADMIN_EMAILS = ['jack.watergun@gmail.com'];
export function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email);
}

// src/app/brain/page.tsx
import { ADMIN_EMAILS } from '@/lib/adminEmails'; // Use this instead
```

**Option B**: Move admin check to API route
- Remove `ADMIN_EMAILS` import from brain page
- Call `/api/user/is-admin` endpoint instead

### Ask Jack?
**QUESTION**: Should I proceed with Option A (extract client-safe ADMIN_EMAILS to separate file) to fix the build? This is a minimal, low-risk change.

---

## 3. Test Status: 8 Failures ⚠️

### Summary
```
Passed: ~100 tests
Failed: 8 tests
Files: 9 test files
```

### Failing Tests

| File | Test | Issue |
|------|------|-------|
| `risk.test.ts` | JPY pairs pip size | Expected 0.01 pip size not applied |
| `risk.test.ts` | Leverage multiplier | Leverage not scaling position |
| `risk.test.ts` | Account balance scaling | FX sizing not scaling with balance |
| `suppRes.test.ts` | Identical high/low | Edge case handling |
| `vwapReversion.test.ts` | Multiple signals at same level | Signal deduplication |
| `vwapReversion.test.ts` | Default 1.5% threshold | Default value mismatch |
| `vwapReversion.test.ts` | 2 more failures | See test output |

### Root Cause Analysis
These appear to be **test expectation mismatches** where the implementation diverged from test expectations during recent strategy work.

### Ask Jack?
**QUESTION**: Should I fix these 8 test failures now, or defer to a separate ticket? Some may require updating the tests to match new behavior vs updating implementation.

---

## 4. Git Status: Needs Cleanup ⚠️

### Modified Files (10)
```
.claude/settings.local.json        # Config
Library/agent-souls/CHIEF_SOUL.md  # +136 lines (Research Lab workflow)
Library/agent-souls/OPS_SOUL.md    # +79 lines
agent_logs.json                    # Data file
journal.db                         # Database
scripts/__pycache__/*.pyc          # Python cache (should gitignore)
src/components/Layout/MarketClock.module.css
```

### Untracked Files (273 total)

**Should Commit (~70 files):**
- `src/components/CommandCenter/` — New feature
- `src/components/Dashboard/` — New widgets
- `src/components/ResearchLab/` — New feature
- `src/components/UI/` — New 21st.dev components
- `src/app/api/audit/` — Audit system API
- `src/app/api/agents/health/` — Health predictions API
- `src/app/api/research/` — Research metrics API
- `src/hooks/useResearchAgents.ts` — New hook
- `scripts/doc-freshness.ts` — Doc scanner
- `docs/ECC_AUDIT_PLAN.md` — Documentation

**Should Gitignore (~100 files):**
- `data/*.json` — Runtime data files
- `data/backtests/*.json` — Generated reports
- `data/ohlcv_cache/` — Cached market data
- `scripts/__pycache__/` — Python bytecode
- `agents_db.json` — Agent state (ephemeral)

**Review Before Commit (~50 files):**
- `.claude/plan/*.md` — 28 plan files (archive old ones?)
- `data/brain/*.md` — Brain memory files
- `prompts/` — Prompt templates
- `skills/` — Custom skills

**Sensitive/Large Files (Do Not Commit):**
- `.claude/overnight/` — Session transcripts
- `data/commands/` — Command history
- `journal.db` — SQLite database (large)

### Stashes (6)
```
stash@{0}: WIP on fix/INFRA-28-sterling-fx-threshold
stash@{1}: ROLLBACK_POINT: Pre-UI-overhaul (important!)
stash@{2}: Ops SCRUM-3 work in progress
stash@{3}: Brain sync WIP
stash@{4}: audit-fixes-and-updates
stash@{5}: wip: stash unrelated changes
```

### Ask Jack?
**QUESTION**: Can I:
1. Update `.gitignore` to exclude runtime data files?
2. Add and commit the new feature files (CommandCenter, Dashboard widgets, etc.)?
3. Drop stashes 3-5 (old WIP stashes)?
4. Keep stash@{1} as rollback point?

---

## 5. Branch Status ⚠️

### Active Branches (15)
```
* fix/INFRA-28-sterling-fx-threshold  ← CURRENT
  master
  brain-sync
  feature/spline-integration
  fix/INFRA-17-silent-error-suppression
  fix/INFRA-8-exponential-backoff
  infra/INFRA-11-jira-client-cli
  learn/LEARN-10-historical-pattern-aggregation
  pivot-pete/backtest-harness
  pulse/PULSE-9-discord-webhook-health
  research/BACK-9-paper-trading-gaps
  scrum/SCRUM-2/jira-pr-template
  scrum/SCRUM-3/position-sync
  scrum/SCRUM-5/direct-alpaca
```

### Merged Branches (Can Delete)
Need to check which are merged into master.

### Ask Jack?
**QUESTION**: Should I run `git branch --merged master` and propose which branches to delete?

---

## 6. Documentation Status ✅

### Master Tracker
- **Last Updated**: 2026-03-22
- **Content**: Comprehensive and current
- **Session Handoff**: Properly documented
- **Priorities**: Clear and ordered

### Daily Log
- **Last Entry**: 2026-03-22
- **Content**: AutoResearch + CHIEF integration documented

### Plan Files (28 accumulated)
These should be reviewed:
- Active plans: Keep in `.claude/plan/`
- Completed plans: Move to `.claude/plan/archive/`
- Superseded plans: Delete

---

## 7. Code Quality Observations

### Positive
- TypeScript/React structure is clean
- Component organization follows Next.js conventions
- New features (CommandCenter, ResearchLab) are well-structured
- CSS modules used consistently

### Needs Attention
- Python `__pycache__` files not gitignored
- Some duplicate code across trading engines (noted in Master Tracker)
- `firebase-admin` import chain needs refactoring
- 8 failing tests need fixes

---

## 8. Recommended Actions

### Immediate (Before Next Commit)

1. **Fix Build** — Extract ADMIN_EMAILS to client-safe module
2. **Update .gitignore** — Add data files, pycache, etc.
3. **Stage New Features** — CommandCenter, Dashboard widgets, APIs

### Short-term (This Week)

4. **Fix Tests** — Address 8 failing test cases
5. **Clean Stashes** — Drop old WIP stashes, keep rollback point
6. **Archive Plans** — Move completed plans to archive folder
7. **Create PR** — Merge current branch to master

### Medium-term (Next Week)

8. **Prune Branches** — Delete merged feature branches
9. **Code Deduplication** — Extract BaseAgent for Python engines
10. **Test Coverage** — Target 80%+ coverage

---

## 9. Questions for Jack

Before proceeding, I need clarification on:

1. **Build Fix**: Proceed with extracting ADMIN_EMAILS to client-safe module?
2. **Test Failures**: Fix now or create separate ticket?
3. **Gitignore Update**: Can I add data files and pycache to .gitignore?
4. **Commit Scope**: Stage and commit new features (CommandCenter, etc.)?
5. **Stash Cleanup**: Drop old stashes (keep rollback point)?
6. **Branch Cleanup**: Identify and delete merged branches?
7. **Plan Archive**: Create archive folder for completed plans?

---

## 10. Next Steps After Approval

Depending on your answers, I will:

1. Fix the build (firebase-admin issue)
2. Update .gitignore
3. Stage new feature files
4. Create a commit with descriptive message
5. Optionally fix test failures
6. Create PR for review

---

*This audit was generated by comprehensive analysis of git status, build output, test results, and documentation. No changes have been made yet.*
