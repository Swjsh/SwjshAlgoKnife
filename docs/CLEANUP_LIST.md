# SwjshAK Cleanup Candidates

**Date**: March 15, 2026
**Status**: Audit & Documentation Only (No files deleted)
**Priority**: LOW (Quick wins, non-critical refactoring)

---

## Summary

This document lists files and configurations that are candidates for removal or consolidation. None have been deleted—this is an audit to document safe cleanup opportunities.

---

## 1. Unused/Stale Configuration Files

### `postcss.config.mjs` (82 bytes)
- **Location**: `/sessions/trusting-cool-turing/mnt/SwjshAlgoKnife/postcss.config.mjs`
- **Status**: DUPLICATE
- **Reasoning**:
  - `postcss.config.js` (111 bytes) also exists at the same level
  - Modern Next.js (v15) uses TypeScript configs (`*.ts`) or JavaScript (`*.js`)
  - The `.mjs` extension is legacy and redundant
  - Only one PostCSS config is needed
- **Recommendation**: Keep `postcss.config.js`, delete `postcss.config.mjs`
- **Impact**: None - Next.js will use the first config it finds

### `ecosystem.config.js` (554 bytes)
- **Location**: `/sessions/trusting-cool-turing/mnt/SwjshAlgoKnife/ecosystem.config.js`
- **Status**: POTENTIALLY UNUSED
- **Reasoning**:
  - PM2 ecosystem config for process management on Linux/Unix
  - System now uses `START_SWJSH.ps1` (Windows) and `supervisord.conf` (Docker) for orchestration
  - The `START_SWJSH.ps1` starts the Agent Runner directly via `npx tsx`, not PM2
  - Docker deployments use `supervisord.conf` for process supervision
  - No recent references in deployment docs (DEPLOY.md, DEPLOY_GCP.md mention supervisord)
- **Recommendation**: Safe to remove if Windows + Docker are the only deployment targets
- **Impact**: None - if not actively being used for PM2-based deployments

---

## 2. Windows Artifact

### `nul` (54 bytes)
- **Location**: `/sessions/trusting-cool-turing/mnt/SwjshAlgoKnife/nul`
- **Status**: WINDOWS ARTIFACT
- **Reasoning**:
  - Created by Windows PowerShell commands (common when redirecting output to `nul`)
  - Contains what appears to be redirect noise or accidental file creation
  - Not referenced in code or documentation
  - `nul` is not a valid filename on Unix/Linux systems
- **Recommendation**: Safe to delete
- **Impact**: None - purely accidental artifact

---

## 3. Archive/Backup Files

### `scripts.tar.gz` (266 KB)
- **Location**: `/sessions/trusting-cool-turing/mnt/SwjshAlgoKnife/scripts.tar.gz`
- **Status**: STALE ARCHIVE
- **Modified**: March 15, 13:36 (recent, but check contents)
- **Reasoning**:
  - Tarball of scripts directory
  - Live `scripts/` directory contains the actual source of truth
  - Could be created by automated backup or prior Git operations
  - Consuming ~266 KB disk space
- **Recommendation**: Safe to delete if archive is confirmed stale
- **How to check before deleting**: Compare timestamp of archive to `scripts/` directory
  - If `scripts.tar.gz` is older than recent script changes, it's definitely safe
  - `tar -tzf scripts.tar.gz | head` will show contents without extracting
- **Impact**: None - live directory is maintained separately

---

## 4. Duplicate/Legacy PowerShell Scripts

### Legacy Startup Scripts
**Status**: POTENTIALLY REDUNDANT

The following are startup/deployment scripts. While all currently exist, some may be superseded:

| Script | Size | Modified | Status |
|--------|------|----------|--------|
| `START_SWJSH.ps1` | 6.0 KB | Mar 15, 09:42 | **ACTIVE** - Main startup |
| `BOB_STATUS.ps1` | 188 B | Mar 14, 11:23 | Legacy - Bitcoin Bob specific |
| `RUN_BITCOIN_BOB.ps1` | 2.9 KB | Mar 14, 11:16 | Legacy - Bitcoin Bob agent |
| `TEST_BITCOIN_BOB.ps1` | 3.3 KB | Mar 14, 11:16 | Legacy - Bitcoin Bob test |
| `TEST_WEBHOOK.ps1` | 1.5 KB | Mar 14, 10:25 | Test utility |

**Reasoning**:
- `START_SWJSH.ps1` is now the canonical startup (starts all agents via agent_runner)
- `RUN_BITCOIN_BOB.ps1` and `TEST_BITCOIN_BOB.ps1` directly launch agent processes
- **Direct agent process launching is discouraged** — agent_runner.ts is the master orchestrator
- Running individual Python agents bypasses the agent runner's restart/monitoring logic
- Old scripts may not be documented or maintained

**Recommendation**:
- Keep `START_SWJSH.ps1` (primary entry point)
- Keep `TEST_WEBHOOK.ps1` (utility for testing TradingView webhooks)
- Consider deprecating: `BOB_STATUS.ps1`, `RUN_BITCOIN_BOB.ps1`, `TEST_BITCOIN_BOB.ps1`
  - They encourage direct agent launching instead of using the orchestrator
  - If needed, update documentation to route users through `START_SWJSH.ps1`

---

## 5. Duplicate Python Script Names

### `run_pete.py` vs `run_pivot_pete.py`
- **Location**: `scripts/run_pete.py` and `scripts/run_pivot_pete.py`
- **Status**: LIKELY DUPLICATE
- **Reasoning**:
  - Both likely wrap the same `pivot_pete_engine.py`
  - Naming convention inconsistency (pete vs pivot_pete)
  - Agent runner should be the entry point via `agent_runner.ts`
- **Recommendation**:
  - Keep only `run_pivot_pete.py` (matches market agent naming: `run_boba.py`, `run_spx_sniper.py`)
  - Delete `run_pete.py` if confirmed to be alias/duplicate
- **How to verify**: Compare file contents with `diff run_pete.py run_pivot_pete.py`

---

## 6. Cache Directories (Safe to Clean Anytime)

### `scripts/__pycache__/` directory
- **Status**: NORMAL CACHE
- **Reasoning**:
  - Python bytecode compilation cache
  - Regenerated automatically on next Python run
  - Safe to delete, but will be recreated
- **Recommendation**: Can be cleaned periodically
- **Command**: `find scripts/ -type d -name __pycache__ -exec rm -rf {} +`

---

## 7. Documentation/Configuration Files Worth Archiving

The following are comprehensive audit/documentation files that could be archived if needed to reduce root directory clutter:

| File | Size | Purpose | Keep? |
|------|------|---------|-------|
| `AGENT_AUDIT.html` | 24 KB | Audit report (snapshot) | Archive to `docs/archive/` |
| `SwjshAK_Full_Audit_March2026.pptx` | 917 KB | Strategic review presentation | Archive to `docs/archive/` |
| `SwjshAK_Strategic_Review.pptx` | 226 KB | Earlier review presentation | Archive to `docs/archive/` |
| `SwjshAK_System_Audit.docx` | 18 KB | System audit document | Archive to `docs/archive/` |

**Recommendation**: These are valuable but take up space in the root. Consider organizing:
```
docs/
├── CLEANUP_LIST.md (new)
├── archive/
│   ├── AGENT_AUDIT.html
│   ├── SwjshAK_Full_Audit_March2026.pptx
│   ├── SwjshAK_Strategic_Review.pptx
│   └── SwjshAK_System_Audit.docx
└── [other live docs]
```

---

## Cleanup Priority Matrix

| File/Group | Effort | Impact | Priority | Action |
|------------|--------|--------|----------|--------|
| `postcss.config.mjs` | 0 min | None | HIGH | Delete immediately |
| `nul` | 0 min | None | HIGH | Delete immediately |
| `scripts.tar.gz` | 0 min | Disk space | MEDIUM | Verify staleness, then delete |
| `ecosystem.config.js` | 5 min | None if unused | LOW | Delete if PM2 not in use |
| Legacy `.ps1` scripts | 10 min | Docs needed | MEDIUM | Deprecate + document routing to START_SWJSH.ps1 |
| `run_pete.py` | 2 min | None if duplicate | LOW | Verify duplication, delete if confirmed |
| Archive presentations | 10 min | Better org | LOW | Move to `docs/archive/` |

---

## Recommended Cleanup Sequence

**Phase 1 (Immediate - 0 effort)**:
1. Delete `nul`
2. Delete `postcss.config.mjs`

**Phase 2 (Quick - 5-10 min)**:
3. Verify `scripts.tar.gz` is stale, delete if confirmed
4. Verify `run_pete.py` is duplicate of `run_pivot_pete.py`, delete if confirmed
5. Update documentation to discourage direct agent launching (point to `START_SWJSH.ps1`)

**Phase 3 (Nice-to-have - 10 min)**:
6. Create `docs/archive/` directory
7. Move presentation/audit files to archive
8. Consider deprecating `ecosystem.config.js` if Docker/Windows are only deployment targets

---

## CSS Refactoring (COMPLETED)

The following CSS files have been updated to use design system variables instead of hardcoded colors:

### Fixed Files:
1. **`src/app/accounts/Accounts.module.css`**
   - Replaced `#10b981` (success) → `var(--status-success)`
   - Replaced `#ef4444` (danger) → `var(--status-danger)`
   - Replaced `#f59e0b` (warning) → `var(--status-warning)`
   - Fixed: 10 occurrences across profit/loss/status badges and transaction icons

2. **`src/app/dashboard/Dashboard.module.css`**
   - Replaced status color hardcodes with variables
   - Fixed spinner and status badges
   - Fixed: 6 occurrences of `#10b981`, `#ef4444`, `#f59e0b`, `#8b5cf6`

3. **`src/app/bots/Bots.module.css`**
   - Replaced all status color hardcodes
   - Fixed action button colors (start/pause/stop/danger)
   - Fixed: 12+ occurrences

### Design System Variables (Defined in `src/app/globals.css`):
```css
--status-success: #10b981;    /* Green */
--status-danger: #ef4444;     /* Red */
--status-warning: #f59e0b;    /* Amber */
--brand-primary: #a855f7;     /* Purple */
```

### Benefits:
- **Consistency**: All status colors now centralized
- **Maintainability**: Change colors in one place (globals.css)
- **Light Mode Support**: Can override variables in `[data-theme='light']` selector
- **Single Source of Truth**: No more hunting for hardcoded hex values

---

## Notes for Next Session

- Before deleting any files, verify usage with: `git log --all -- <filename>`
- Consider adding this cleanup checklist to CI/CD lint rules to prevent new unused files
- Review and update `CLAUDE.md` documentation to mention the preferred agent launch method

