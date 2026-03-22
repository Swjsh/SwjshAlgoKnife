# Jira Tickets Batch Creation

> **Created**: 2026-03-22
> **Status**: Pending Manual Execution
> **Total Tickets**: 7

This document contains 7 tickets ready for creation in Jira. Run the commands below using the project's Jira client.

---

## Quick Batch Execution

Copy and run this PowerShell script to create all 7 tickets:

```powershell
cd C:\Users\jackw\Desktop\SwjshAlgoKnife

# INFRA-29: Fix Build - Firebase Admin Client Import
python scripts/jira_client.py create INFRA "Fix Build - Firebase Admin Client Import" `
  --type Bug `
  --priority Highest `
  --desc "Build failing because firebase-admin imported in client component (brain/page.tsx -> adminGuard -> firebase-admin). The firebase-admin package is server-only but is being imported into a client component via the adminGuard chain. Fix: Update import to use @/lib/adminEmails instead of directly importing from adminGuard. This will allow the build to complete successfully. Acceptance Criteria: 1) npm run build completes without firebase-admin import errors 2) Admin guard functionality still works correctly 3) No regression in brain page functionality"

# INFRA-30: Update .gitignore for Runtime Files
python scripts/jira_client.py create INFRA "Update .gitignore for Runtime Files" `
  --type Task `
  --priority Medium `
  --desc "Add runtime-generated files to .gitignore to prevent accidental commits of local state. Files to add: data/*.json, data/ohlcv_cache/, data/backtests/, scripts/__pycache__/, agents_db.json, .claude/overnight/, journal.db. These files are generated at runtime and should not be version controlled."

# INFRA-31: Commit New Feature Files
python scripts/jira_client.py create INFRA "Commit New Feature Files" `
  --type Task `
  --priority High `
  --desc "Stage and commit new feature files that have been developed but not yet committed. Files include: CommandCenter (12 files), ResearchLab (~10 files), Dashboard widgets (6 files), API routes (research, agents/health, audit), hooks, lib files. Review each file before committing to ensure no sensitive data or unfinished code is included. Create logical commit groups by feature area."

# INFRA-32: Clean Up Stashes
python scripts/jira_client.py create INFRA "Clean Up Stashes" `
  --type Task `
  --priority Low `
  --desc "Review and clean up git stashes. KEEP stash@{1} (ROLLBACK_POINT) - this is an important recovery checkpoint. Review stash@{0} and stash@{2} for any useful changes. Drop old stashes (3-5) after verification that their contents are no longer needed. Use 'git stash list' to review, 'git stash show -p stash@{N}' to inspect, and 'git stash drop stash@{N}' to remove."

# INFRA-33: Prune Merged Branches
python scripts/jira_client.py create INFRA "Prune Merged Branches" `
  --type Task `
  --priority Low `
  --desc "Clean up local and remote branches that have been merged to master. Steps: 1) Run 'git branch --merged master' to list merged branches 2) Review list to ensure no unmerged work 3) Delete only fully merged feature branches with 'git branch -d <branch>' 4) Prune remote tracking branches with 'git remote prune origin'"

# PULSE-11: Fix 8 Failing Tests
python scripts/jira_client.py create PULSE "Fix 8 Failing Tests" `
  --type Bug `
  --priority High `
  --desc "8 tests are currently failing and need to be fixed: risk.test.ts (3 failures), suppRes.test.ts (1 failure), vwapReversion.test.ts (4 failures). Steps: 1) Run 'npm test' to reproduce failures 2) Analyze each failure - is it a test issue or implementation issue? 3) Fix implementation bugs or update tests if requirements changed 4) Ensure all 8 tests pass 5) Verify no regressions in other tests"

# BACK-11: Archive Old Plan Files
python scripts/jira_client.py create BACK "Archive Old Plan Files" `
  --type Task `
  --priority Low `
  --desc "Create archive directory and move completed plan files. Steps: 1) Create .claude/plan/archive/ directory 2) Review 28 plan files in .claude/plan/ to identify completed ones 3) Move completed plan files to archive directory 4) Keep active/in-progress plans in main directory. This reduces clutter and makes it easier to find current work."
```

---

## Individual Ticket Details

### 1. INFRA-29: Fix Build - Firebase Admin Client Import

| Field | Value |
|-------|-------|
| **Project** | INFRA |
| **Type** | Bug |
| **Priority** | Highest (P1 - Critical) |
| **Labels** | `build-failure`, `blocking` |

**Description**:
Build failing because firebase-admin imported in client component (`brain/page.tsx` -> `adminGuard` -> `firebase-admin`).

The firebase-admin package is server-only but is being imported into a client component via the adminGuard chain.

**Fix**: Update import to use `@/lib/adminEmails` instead of directly importing from adminGuard.

**Acceptance Criteria**:
1. `npm run build` completes without firebase-admin import errors
2. Admin guard functionality still works correctly
3. No regression in brain page functionality

**Command**:
```bash
python scripts/jira_client.py create INFRA "Fix Build - Firebase Admin Client Import" --type Bug --priority Highest --desc "Build failing because firebase-admin imported in client component (brain/page.tsx -> adminGuard -> firebase-admin). Fix: Update import to use @/lib/adminEmails instead."
```

---

### 2. INFRA-30: Update .gitignore for Runtime Files

| Field | Value |
|-------|-------|
| **Project** | INFRA |
| **Type** | Task |
| **Priority** | Medium (P3) |
| **Labels** | `housekeeping`, `git` |

**Description**:
Add runtime-generated files to `.gitignore` to prevent accidental commits of local state.

**Files to add**:
- `data/*.json`
- `data/ohlcv_cache/`
- `data/backtests/`
- `scripts/__pycache__/`
- `agents_db.json`
- `.claude/overnight/`
- `journal.db`

These files are generated at runtime and should not be version controlled.

**Command**:
```bash
python scripts/jira_client.py create INFRA "Update .gitignore for Runtime Files" --type Task --priority Medium --desc "Add runtime files to .gitignore: data/*.json, data/ohlcv_cache/, data/backtests/, scripts/__pycache__/, agents_db.json, .claude/overnight/, journal.db"
```

---

### 3. INFRA-31: Commit New Feature Files

| Field | Value |
|-------|-------|
| **Project** | INFRA |
| **Type** | Task |
| **Priority** | High (P2) |
| **Labels** | `git`, `feature-commit` |

**Description**:
Stage and commit new feature files that have been developed but not yet committed.

**Files to commit**:
- CommandCenter (12 files)
- ResearchLab (~10 files)
- Dashboard widgets (6 files)
- API routes (research, agents/health, audit)
- Hooks
- Lib files

Review each file before committing to ensure no sensitive data or unfinished code is included. Create logical commit groups by feature area.

**Command**:
```bash
python scripts/jira_client.py create INFRA "Commit New Feature Files" --type Task --priority High --desc "Stage and commit: CommandCenter (12 files), ResearchLab (~10 files), Dashboard widgets (6 files), API routes (research, agents/health, audit), hooks, lib files"
```

---

### 4. INFRA-32: Clean Up Stashes

| Field | Value |
|-------|-------|
| **Project** | INFRA |
| **Type** | Task |
| **Priority** | Low (P4) |
| **Labels** | `housekeeping`, `git` |

**Description**:
Review and clean up git stashes.

**Action Plan**:
1. **KEEP** `stash@{1}` (ROLLBACK_POINT) - important recovery checkpoint
2. **Review** `stash@{0}` and `stash@{2}` for useful changes
3. **Drop** old stashes (3-5) after verification

**Commands for review**:
```bash
git stash list                    # List all stashes
git stash show -p stash@{N}       # Inspect stash content
git stash drop stash@{N}          # Remove stash
```

**Command**:
```bash
python scripts/jira_client.py create INFRA "Clean Up Stashes" --type Task --priority Low --desc "Review stashes. KEEP stash@{1} (ROLLBACK_POINT). Review stash@{0,2}. Drop old stashes (3-5) after verification."
```

---

### 5. INFRA-33: Prune Merged Branches

| Field | Value |
|-------|-------|
| **Project** | INFRA |
| **Type** | Task |
| **Priority** | Low (P4) |
| **Labels** | `housekeeping`, `git` |

**Description**:
Clean up local and remote branches that have been merged to master.

**Steps**:
1. Run `git branch --merged master` to list merged branches
2. Review list to ensure no unmerged work
3. Delete only fully merged feature branches with `git branch -d <branch>`
4. Prune remote tracking branches with `git remote prune origin`

**Command**:
```bash
python scripts/jira_client.py create INFRA "Prune Merged Branches" --type Task --priority Low --desc "Check merged branches with 'git branch --merged master'. Delete only fully merged feature branches."
```

---

### 6. PULSE-11: Fix 8 Failing Tests

| Field | Value |
|-------|-------|
| **Project** | PULSE |
| **Type** | Bug |
| **Priority** | High (P2) |
| **Labels** | `testing`, `quality` |

**Description**:
8 tests are currently failing and need to be fixed.

**Failing Tests**:
| File | Failures |
|------|----------|
| `risk.test.ts` | 3 |
| `suppRes.test.ts` | 1 |
| `vwapReversion.test.ts` | 4 |

**Steps**:
1. Run `npm test` to reproduce failures
2. Analyze each failure - is it a test issue or implementation issue?
3. Fix implementation bugs or update tests if requirements changed
4. Ensure all 8 tests pass
5. Verify no regressions in other tests

**Command**:
```bash
python scripts/jira_client.py create PULSE "Fix 8 Failing Tests" --type Bug --priority High --desc "8 tests failing in risk.test.ts (3), suppRes.test.ts (1), vwapReversion.test.ts (4). Analyze and fix."
```

---

### 7. BACK-11: Archive Old Plan Files

| Field | Value |
|-------|-------|
| **Project** | BACK |
| **Type** | Task |
| **Priority** | Low (P4) |
| **Labels** | `housekeeping`, `documentation` |

**Description**:
Create archive directory and move completed plan files.

**Steps**:
1. Create `.claude/plan/archive/` directory
2. Review 28 plan files in `.claude/plan/` to identify completed ones
3. Move completed plan files to archive directory
4. Keep active/in-progress plans in main directory

This reduces clutter and makes it easier to find current work.

**Command**:
```bash
python scripts/jira_client.py create BACK "Archive Old Plan Files" --type Task --priority Low --desc "Create .claude/plan/archive/, move 28 completed plan files to archive."
```

---

## Summary Table

| Key | Project | Type | Priority | Summary |
|-----|---------|------|----------|---------|
| INFRA-29 | INFRA | Bug | Highest | Fix Build - Firebase Admin Client Import |
| INFRA-30 | INFRA | Task | Medium | Update .gitignore for Runtime Files |
| INFRA-31 | INFRA | Task | High | Commit New Feature Files |
| INFRA-32 | INFRA | Task | Low | Clean Up Stashes |
| INFRA-33 | INFRA | Task | Low | Prune Merged Branches |
| PULSE-11 | PULSE | Bug | High | Fix 8 Failing Tests |
| BACK-11 | BACK | Task | Low | Archive Old Plan Files |

---

## Execution Notes

1. Run the batch script above in PowerShell from the project root
2. The Jira client requires credentials configured via `scripts/jira_creds.py`
3. Ticket numbers (29, 30, etc.) are estimates - actual numbers depend on Jira's sequence
4. After creation, transition critical tickets to "In Progress" if working immediately
