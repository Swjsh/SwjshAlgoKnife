# Implementation Plan: Documentation Flow Improvements

## Task Type
- [x] Backend (→ data/scripts layer)
- [x] Fullstack (→ UI + automation)

---

## Executive Summary

SwjshAK has **fragmented documentation** across 4 locations with manual sync processes that are error-prone and inconsistent. This plan consolidates the documentation architecture, introduces automated freshness checking, and enables Claude sessions to self-maintain docs.

---

## Current State Analysis

### Documentation Locations

| Location | Files | Purpose | Sync Method | Issues |
|----------|-------|---------|-------------|--------|
| **Obsidian Vault** | 30+ | Jack's source of truth | Manual edits | ✅ Well-maintained |
| **data/brain/** | 10 | AI agent runtime | `sync-brain-to-git.ps1` (6 AM daily) | ❌ Only 10 of 30+ files sync |
| **docs/** | 40+ | Project documentation | Manual | ❌ Mixed stale/current files |
| **Library/** | 16 | Setup guides | Manual | ✅ Well-maintained |
| **CLAUDE.md** | 1 | Claude session instructions | Manual | ⚠️ Instructions exist but no enforcement |

### Current Sync Flow

```
┌─────────────────┐    sync-brain-to-git.ps1    ┌────────────────┐
│ Obsidian Vault  │ ────────────────────────────► │ data/brain/   │
│ (30+ files)     │      6 AM daily              │ (10 files)    │
└─────────────────┘                              └────────────────┘
        │                                                │
        │                                                │
        ▼                                                ▼
┌─────────────────┐                              ┌────────────────┐
│ Jack edits      │                              │ AI agents read │
│ manually        │                              │ for context    │
└─────────────────┘                              └────────────────┘

        NO REVERSE SYNC (code changes → brain)
```

### Identified Gaps

1. **Selective Sync**: Only 10 of 30+ Obsidian files sync to data/brain/
2. **No Reverse Sync**: Code changes (Claude sessions) don't update Obsidian
3. **Stale docs/**: Mixed quality, no freshness tracking
4. **No Automation**: Doc generation from code (TypeDoc/JSDoc) absent
5. **Manual Updates**: Claude session handoff is manual, easy to skip

---

## Technical Solution

### Architecture: Bidirectional Sync with Freshness Tracking

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DOCUMENTATION HUB                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐     ┌──────────────┐     ┌───────────────────┐   │
│  │  Obsidian   │◄───►│  data/brain/ │◄───►│ docs/ + Library/  │   │
│  │  (Source)   │     │  (Runtime)   │     │   (Reference)     │   │
│  └─────────────┘     └──────────────┘     └───────────────────┘   │
│        ▲                    ▲                      ▲               │
│        │                    │                      │               │
│   ┌────┴────┐          ┌────┴────┐           ┌────┴────┐          │
│   │ Jack    │          │ Claude  │           │ Auto-   │          │
│   │ (manual)│          │ Sessions│           │ generate│          │
│   └─────────┘          └─────────┘           └─────────┘          │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                     FRESHNESS TRACKING                              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ data/brain/doc-freshness.json                               │   │
│  │ - Last modified timestamps                                   │   │
│  │ - Content hashes for drift detection                         │   │
│  │ - Stale file alerts                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Freshness Tracking System

**File**: `scripts/doc-freshness.ts`

**Purpose**: Track document modification times, detect stale files, generate freshness report.

**Pseudo-code**:
```typescript
interface DocFreshness {
  files: {
    [path: string]: {
      lastModified: string;
      contentHash: string;
      lastVerified: string;
      staleThresholdDays: number;
      isStale: boolean;
    }
  };
  lastScan: string;
  staleCount: number;
}

async function scanDocFreshness(): DocFreshness {
  // Scan all doc locations
  const locations = [
    'data/brain/*.md',
    'docs/**/*.md',
    'Library/**/*.md',
    'CLAUDE.md'
  ];

  for each file in locations:
    - Read file content
    - Calculate SHA-256 hash
    - Get last modified time
    - Compare against threshold (7 days for brain, 30 days for docs)
    - Flag as stale if threshold exceeded

  // Write freshness report
  writeJSON('data/brain/doc-freshness.json', report);
  return report;
}
```

**Expected Deliverable**: `scripts/doc-freshness.ts` + `data/brain/doc-freshness.json`

---

### Step 2: Expand Brain Sync to Include All Critical Files

**File**: Modify `scripts/sync-brain-to-git.ps1` and `scripts/sync-brain.sh`

**Purpose**: Sync ALL relevant Obsidian files, not just 10.

**Current file mapping** (10 files):
```
Master Tracker.md → master-tracker.md
Dashboard.md → dashboard.md
Daily Log.md → daily-log.md
Roadmap.md → roadmap.md
Strategies Overview.md → strategies.md
System Architecture.md → system-architecture.md
Current Sprint.md → current-sprint.md
Agent System.md → agent-system.md
Troubleshooting.md → troubleshooting.md
Connection Map.md → connections.md
```

**Proposed expansion** (add 10+ more):
```
# Agent profiles (for agent context)
Chief Agent.md → agents/chief.md
Arbiter Agent.md → agents/arbiter.md
Ops Agent.md → agents/ops.md
Hunter Agent.md → agents/hunter.md
Scout Agent.md → agents/scout.md
Cortana Agent.md → agents/cortana.md

# Strategy details
Pivot Strategy.md → strategies/pivot.md
Set and Forget.md → strategies/set-and-forget.md
Grid Trading.md → strategies/grid.md

# Infrastructure
Environment Variables.md → environment.md
Deployment.md → deployment.md
```

**Expected Deliverable**: Updated sync scripts with 20+ file mappings

---

### Step 3: Create Reverse Sync Mechanism

**File**: `scripts/sync-brain-to-obsidian.ts`

**Purpose**: Push Claude session changes back to Obsidian vault (optional, for Jack's review).

**Pseudo-code**:
```typescript
async function reverseSyncBrain() {
  const brainDir = 'data/brain/';
  const obsidianVault = 'C:\\Users\\jackw\\Documents\\ObsidianVaults\\SwjshAK-Brain\\';

  // Read freshness file to find recently modified brain files
  const freshness = readJSON('data/brain/doc-freshness.json');

  for each file in brainDir:
    if file.modifiedSinceLastSync:
      // Generate diff
      const diff = generateDiff(obsidianFile, brainFile);

      // Write pending changes file (NOT auto-apply)
      appendToFile('data/brain/pending-obsidian-sync.md', {
        file: file,
        diff: diff,
        timestamp: now()
      });

  // Jack reviews pending-obsidian-sync.md and applies manually
  console.log('Pending changes written to pending-obsidian-sync.md');
}
```

**Expected Deliverable**: `scripts/sync-brain-to-obsidian.ts` + `data/brain/pending-obsidian-sync.md`

---

### Step 4: Consolidate docs/ and Library/

**Action**: Restructure documentation directories.

**Proposed structure**:
```
docs/
├── architecture/          # System design (moved from docs/)
│   ├── ARCHITECTURE.md
│   ├── AUTONOMOUS-LOOP.md
│   └── ...
├── agents/                # Agent profiles (moved from docs/agents/)
│   ├── pivot-pete.md
│   ├── boba.md
│   └── ...
├── guides/                # Setup guides (MERGED from Library/)
│   ├── jira-setup.md
│   ├── n8n-setup.md
│   └── ...
├── strategies/            # Trading strategies
│   └── ...
├── testing/               # Test documentation
│   └── ...
└── archive/               # Stale docs (clearly marked)
    └── ...
```

**Key changes**:
1. Move `Library/` contents → `docs/guides/`
2. Delete `Library/` directory (avoid duplication)
3. Move stale files to `docs/archive/`
4. Update all internal links

**Expected Deliverable**: Restructured `docs/` directory, `Library/` deprecated

---

### Step 5: Add Claude Session Auto-Update Hook

**File**: `.claude/hooks/post-session.md` or modify `CLAUDE.md`

**Purpose**: Remind Claude to update docs at session end.

**Proposed CLAUDE.md addition**:
```markdown
## Session End Checklist (AUTOMATED REMINDER)

Before ending any productive session, Claude MUST:

1. **Check doc freshness**:
   ```bash
   npx tsx scripts/doc-freshness.ts
   ```

2. **Update stale files**:
   - If any brain files are stale AND you made relevant changes, update them
   - Focus on: master-tracker.md, daily-log.md, system-architecture.md

3. **Log session summary**:
   - Add entry to daily-log.md with work completed
   - Update master-tracker.md progress percentages

4. **Commit if appropriate**:
   ```bash
   git add data/brain/ docs/
   git commit -m "docs: session update - [brief description]"
   ```
```

**Expected Deliverable**: Updated `CLAUDE.md` with automated checklist

---

### Step 6: Create Doc Freshness Dashboard Widget

**File**: `src/components/Dashboard/DocFreshnessWidget.tsx`

**Purpose**: Show doc freshness status in the UI.

**Pseudo-code**:
```tsx
function DocFreshnessWidget() {
  const [freshness, setFreshness] = useState<DocFreshness | null>(null);

  useEffect(() => {
    fetch('/api/brain/freshness')
      .then(res => res.json())
      .then(setFreshness);
  }, []);

  return (
    <GlowHoverCard>
      <h3>Documentation Health</h3>
      <div className="stats">
        <PulseIndicator status={freshness?.staleCount === 0 ? 'live' : 'warning'} />
        <span>{freshness?.files.length} files tracked</span>
        <span>{freshness?.staleCount} stale</span>
      </div>
      {freshness?.staleCount > 0 && (
        <ul className="stale-files">
          {Object.entries(freshness.files)
            .filter(([_, f]) => f.isStale)
            .map(([path, f]) => (
              <li key={path}>{path} - {f.lastModified}</li>
            ))}
        </ul>
      )}
    </GlowHoverCard>
  );
}
```

**Expected Deliverable**: Dashboard widget + `/api/brain/freshness` endpoint

---

### Step 7: Add Scheduled Freshness Check Job

**System**: OpenClaw cron OR n8n workflow

**Option A: OpenClaw Cron Job** (if Chief should act on stale docs)
```json
{
  "jobId": "doc-freshness-check",
  "agentId": "chief",
  "name": "Weekly Documentation Freshness Check",
  "schedule": {
    "kind": "cron",
    "expr": "0 10 * * 1",
    "tz": "America/New_York"
  },
  "payload": {
    "kind": "agentTurn",
    "message": "Run documentation freshness check. List any stale files. For each stale file, determine if it needs updating based on recent code changes. Create Jira tickets for major documentation gaps."
  }
}
```

**Option B: n8n Workflow** (if just data collection)
```json
{
  "name": "WF-DOC-FRESHNESS",
  "trigger": "Schedule Trigger (weekly Monday 10 AM)",
  "nodes": [
    "Execute Command (npx tsx scripts/doc-freshness.ts)",
    "Read JSON (data/brain/doc-freshness.json)",
    "IF (staleCount > 0)",
    "Discord Webhook (post stale file list)",
    "Jira Create Issue (if critical docs stale)"
  ]
}
```

**Expected Deliverable**: OpenClaw job OR n8n workflow (choose based on whether AI analysis needed)

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `scripts/doc-freshness.ts` | Create | Freshness tracking script |
| `data/brain/doc-freshness.json` | Create | Freshness report data |
| `scripts/sync-brain-to-git.ps1` | Modify | Expand to 20+ file mappings |
| `scripts/sync-brain.sh` | Modify | Expand to 20+ file mappings |
| `scripts/sync-brain-to-obsidian.ts` | Create | Reverse sync mechanism |
| `CLAUDE.md` | Modify | Add session end checklist |
| `docs/` | Restructure | Consolidate with Library/ |
| `src/components/Dashboard/DocFreshnessWidget.tsx` | Create | UI widget |
| `src/app/api/brain/freshness/route.ts` | Create | API endpoint |
| `Library/CRON_CONFIGURATION.md` | Modify | Add doc-freshness job |

---

## Risks and Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| Obsidian path varies on different machines | Medium | Use environment variable `OBSIDIAN_VAULT_PATH` |
| Sync conflicts (Jack + Claude edit same file) | Medium | pending-obsidian-sync.md for manual review |
| Breaking existing sync scripts | High | Add new mappings incrementally, test first |
| Claude sessions skipping doc updates | Medium | Add CI check for doc freshness in PRs |
| docs/ restructure breaks links | Medium | Create redirect map, update all internal links |

---

## Do We Need Scheduled Jobs?

**YES**, but sparingly:

| Task | Schedule | System | Rationale |
|------|----------|--------|-----------|
| Brain sync (Obsidian → data/brain/) | Daily 6 AM | Windows Task Scheduler | ✅ Already exists |
| Doc freshness scan | Weekly Monday 10 AM | n8n or OpenClaw | NEW - catch stale docs |
| Reverse sync report | On-demand | Manual script | NOT scheduled - Jack reviews |

**NOT recommended**:
- Auto-generating docs from code (TypeDoc) — overkill for this project
- Real-time Obsidian sync — too complex, Jack prefers daily

---

## File Structure Improvements

### Current (Problematic)
```
SwjshAlgoKnife/
├── docs/                  # Mixed quality, stale files
├── Library/               # Duplicates some docs/ content
├── data/brain/            # Partial sync from Obsidian
└── CLAUDE.md              # Instructions exist but not enforced
```

### Proposed (Clean)
```
SwjshAlgoKnife/
├── docs/                  # ALL project documentation
│   ├── architecture/
│   ├── agents/
│   ├── guides/            # Former Library/ content
│   ├── strategies/
│   ├── testing/
│   └── archive/           # Clearly marked stale docs
├── data/brain/            # Full sync from Obsidian (20+ files)
│   ├── agents/            # Agent-specific context
│   ├── strategies/        # Strategy-specific context
│   └── doc-freshness.json # Freshness tracking
└── CLAUDE.md              # Enhanced with automated checklist
```

---

## Decision Points for Jack

1. **Reverse sync**: Should Claude session changes auto-push to Obsidian, or just create a "pending changes" file for Jack to review?
   - Recommendation: Pending changes file (safer)

2. **docs/ restructure**: Should we deprecate Library/ and merge into docs/guides/?
   - Recommendation: Yes, single source of truth

3. **Freshness threshold**: 7 days for brain files, 30 days for docs/?
   - Recommendation: Yes, brain files are more critical

4. **Dashboard widget**: Add to main dashboard or separate "System Health" page?
   - Recommendation: Add to main dashboard (visibility)

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: N/A (wrapper unavailable)
- GEMINI_SESSION: N/A (wrapper unavailable)

---

*Plan generated by Claude Opus 4.5 — 2026-03-22*
