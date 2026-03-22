# 📋 Document Cleanup Plan

> **Created**: 2026-03-15
> **Purpose**: Archive/remove outdated planning documents after consolidation to Master Tracker

---

## Files to Archive

### Codebase Files (Move to `docs/archive/`)

**Outdated:**
1. `PLAN.md` - ⚠️ **OUTDATED** (Jan 2026)
   - **Why**: Phases 0-4 marked complete, but doesn't reflect current March state
   - **Action**: Move to `docs/archive/PLAN_2026-01.md`
   - **Keep?**: Yes, for historical reference

2. `docs/DESIGN_ROADMAP.md` - ⚠️ **OUTDATED** (early design)
   - **Why**: Early design document, most features implemented
   - **Action**: Move to `docs/archive/DESIGN_ROADMAP_initial.md`
   - **Keep?**: Yes, shows original vision

**Duplicates:**
3. `docs/PAPER_TRADING_WEEK_PLAN.md` - ⚠️ **DUPLICATE**
   - **Why**: Duplicate of Obsidian `Paper Trading Week Plan.md`
   - **Action**: Delete (Obsidian version is canonical)
   - **Keep?**: No

**Current (Keep in place):**
4. `MASTER_GAMEPLAN.md` - ✅ **CURRENT** (reviewed 2026-03-14)
   - **Why**: Intelligence layer plan is still active
   - **Action**: None - still relevant
   - **Update**: Add link to Master Tracker in header

5. `MIGRATION_PLAN.md` - ✅ **CURRENT**
   - **Why**: Multi-tenant migration is future work
   - **Action**: None - still relevant
   - **Update**: Add link to Master Tracker in header

---

## Actions to Take

### 1. Create Archive Directory
```bash
mkdir -p docs/archive
```

### 2. Move Outdated Files
```bash
# PLAN.md → archive with date stamp
mv PLAN.md docs/archive/PLAN_2026-01.md

# DESIGN_ROADMAP.md → archive
mv docs/DESIGN_ROADMAP.md docs/archive/DESIGN_ROADMAP_initial.md
```

### 3. Delete Duplicate
```bash
# PAPER_TRADING_WEEK_PLAN.md is duplicate - delete
rm docs/PAPER_TRADING_WEEK_PLAN.md
```

### 4. Update Current Files

Add header to `MASTER_GAMEPLAN.md`:
```markdown
> **📌 Project Planning**: See [[🎯 Master Tracker]] in Obsidian brain for daily/weekly/monthly priorities
> **Status**: Active - Intelligence Layer Plan
> **Last Reviewed**: 2026-03-14
```

Add header to `MIGRATION_PLAN.md`:
```markdown
> **📌 Project Planning**: See [[🎯 Master Tracker]] in Obsidian brain for daily/weekly/monthly priorities
> **Status**: Future Work - Multi-Tenant Migration
> **Priority**: Low (after paper trading validation)
```

---

## New Documentation Structure

### Obsidian Brain (Single Source of Truth for Planning)
```
📊 Dashboard.md              # System status overview
🎯 Master Tracker.md         # ⭐ MAIN PLANNING HUB ⭐
📅 Daily Log.md              # Daily accountability
Roadmap.md                   # Long-term strategic vision
Current Sprint.md            # Active sprint details
Technical Debt.md            # Refactoring backlog
Paper Trading Week Plan.md   # Validation plan
```

### Codebase (Technical Specs)
```
MASTER_GAMEPLAN.md           # Intelligence layer plan
MIGRATION_PLAN.md            # Multi-tenant migration spec
ARCHITECTURE.md              # System architecture
CLAUDE.md                    # AI assistant instructions

docs/
  archive/                   # Historical documents
    PLAN_2026-01.md
    DESIGN_ROADMAP_initial.md
  ACCOUNT_MANAGEMENT.md
  MASTER_GAMEPLAN.md         # Symlink? Or keep separate?
  PAPER_TRADING_WEEK_PLAN.md # (deleted - use Obsidian)
```

---

## Verification Checklist

After cleanup:
- [ ] All outdated files moved to `docs/archive/`
- [ ] Duplicate files deleted
- [ ] Current files updated with Master Tracker links
- [ ] Obsidian brain README updated
- [ ] CLAUDE.md still references Obsidian brain correctly
- [ ] No broken links in Obsidian

---

## Rollback Plan

If cleanup causes issues:
```bash
# Restore from archive
cp docs/archive/PLAN_2026-01.md PLAN.md
cp docs/archive/DESIGN_ROADMAP_initial.md docs/DESIGN_ROADMAP.md

# Recreate deleted duplicate
# (use git restore if tracked)
git restore docs/PAPER_TRADING_WEEK_PLAN.md
```

---

## Why This Matters

**Before**:
- 9 different planning documents
- Unclear which is current
- Duplicates cause confusion
- No daily accountability

**After**:
- **1 Master Tracker** = single source of truth
- **1 Daily Log** = accountability
- **1 Roadmap** = long-term vision
- Clear separation: Planning (Obsidian) vs Specs (Codebase)

---

## Next Steps

1. Execute cleanup (move/delete files)
2. Update current files with Master Tracker links
3. Test all Obsidian links still work
4. Update README.md to reference new structure
5. Commit changes: `git commit -m "Consolidate planning docs to Master Tracker"`

---

## Related Pages

- [[🎯 Master Tracker]] - New planning hub
- [[📅 Daily Log]] - Daily progress
- [[README]] - Navigation guide
