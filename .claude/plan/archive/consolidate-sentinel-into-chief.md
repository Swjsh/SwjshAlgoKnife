# Implementation Plan: Consolidate SENTINEL into CHIEF (Option B)

## Overview

**Objective**: Merge SENTINEL's monitoring capabilities into CHIEF while keeping healing delegated to OPS.

**Outcome**:
- Chief becomes the "eyes" (detection, monitoring, alerting)
- Ops keeps the "hands" (healing, playbook execution, incident response)
- Reduce from 7 agents to 6 agents

---

## Task Type
- [x] Backend (SOUL files, infrastructure scripts)
- [ ] Frontend (minor: update activity feed for 6 agents)
- [ ] Fullstack

---

## Technical Solution

### Architecture After Merge

```
                      ┌─────────────────────────────────────────┐
                      │            CHIEF (COO + Watcher)        │
                      │  - Morning briefings                    │
                      │  - Sprint planning                      │
                      │  - 30-second health checks (NEW)        │
                      │  - SOUL compliance audits (NEW)         │
                      │  - Alert routing to Ops                 │
                      └────────────────┬────────────────────────┘
                                       │ Issues detected
                                       ▼
                      ┌─────────────────────────────────────────┐
                      │              OPS (SRE + Healer)         │
                      │  - Incident response                    │
                      │  - Playbook execution (MOVED from SENT) │
                      │  - Circuit breaker management (MOVED)   │
                      │  - Auto-remediation                     │
                      └─────────────────────────────────────────┘
```

### What Moves Where

| SENTINEL Feature | Destination | Rationale |
|------------------|-------------|-----------|
| Connection health checks (34 connections) | CHIEF | Chief needs visibility to coordinate |
| SOUL compliance auditing (30 rules) | CHIEF | Chief already coordinates agents |
| Alert routing & deduplication | CHIEF | Chief already filters noise for CEO |
| Circuit breaker state management | OPS | Ops already handles service health |
| Playbook execution (15 playbooks) | OPS | Ops already does auto-remediation |
| Self-healing engine | OPS | Natural extension of incident response |

### Chief's New Cycle Structure

```
OLD (5-minute cycles):
  Morning briefing → Sprint planning → Escalation handling → Wait 5 min → Loop

NEW (dual-frequency):
  FAST LOOP (30 seconds):
    - Check 34 connections (lightweight HTTP/DB pings)
    - Update health-status.json
    - If issue detected: Route to Ops inbox
    - Broadcast heartbeat to dashboard

  SLOW LOOP (5 minutes):
    - Morning briefing (morning only)
    - Sprint planning (Monday only)
    - SOUL compliance audit (hourly)
    - Escalation handling
    - Context checkpoint
```

---

## Implementation Steps

### Phase 1: Update CHIEF_SOUL.md (~45 min)

**Step 1.1**: Add Meta-Monitoring Identity Section
```markdown
## Additional Role: System Watchdog

Chief now serves a dual purpose:
1. **COO**: Coordinate team, morning briefings, sprint planning
2. **Watchdog**: Monitor 34 system connections, audit SOUL compliance

This consolidates the former SENTINEL role. Chief detects; Ops heals.
```

**Step 1.2**: Add Primary Workflow - Health Monitoring
- Port SENTINEL's "Connection Health Monitoring" workflow
- Remove playbook execution (Ops will handle)
- Add issue routing to `data/agent-inbox/ops.json`
- Keep circuit breaker STATE tracking (read-only for Chief)

**Step 1.3**: Add Secondary Workflow - SOUL Compliance Audit
- Port SENTINEL's "SOUL Compliance Audit" workflow
- 30 rules across 6 agents (was 6 agents including SENTINEL, now 5 others)
- Create AUDIT project tickets for violations
- Route to violating agent's inbox

**Step 1.4**: Update Cycle Timing
- Change cycle from 5-minute to dual-frequency
- Fast loop: 30 seconds (health only)
- Slow loop: 5 minutes (coordination + compliance)

**Step 1.5**: Update Files I Read/Write
- Add: `data/sentinel/connection-registry.json` → `data/chief/connection-registry.json`
- Add: `data/chief/health-status.json` (write)
- Add: `data/chief/compliance-report.json` (write)
- Remove references to SENTINEL

### Phase 2: Update OPS_SOUL.md (~30 min)

**Step 2.1**: Add Playbook Execution Responsibilities
```markdown
### Additional Role: Self-Healing Engine

When Chief detects unhealthy connections, Ops executes healing:
- 15 playbooks from former SENTINEL role
- Circuit breaker management (OPEN/HALF_OPEN/CLOSED transitions)
- Retry logic (max 3 attempts before escalation)
```

**Step 2.2**: Add Playbook Execution Workflow
- Port SENTINEL's "Self-Healing Execution" workflow
- Ops checks `data/agent-inbox/ops.json` for Chief alerts
- Ops executes playbook, updates circuit breaker state
- Ops reports result back to Chief

**Step 2.3**: Update Cycle Timing
- Keep 60-second cycles (unchanged)
- Add inbox check for Chief health alerts
- Priority: Health alerts > Assigned tickets > Proactive monitoring

**Step 2.4**: Update Files I Read/Write
- Add: `data/chief/health-status.json` (read)
- Add: `data/sentinel/circuit-breakers.json` → `data/ops/circuit-breakers.json` (write)
- Add: `data/sentinel/playbooks/*.yml` → `data/ops/playbooks/*.yml` (read)

### Phase 3: Migrate Data Files (~15 min)

**Step 3.1**: Rename/Move directories
```powershell
# Move connection registry to chief's domain
Move-Item data/sentinel/connection-registry.json data/chief/connection-registry.json

# Move playbooks to ops domain
Move-Item data/sentinel/playbooks data/ops/playbooks

# Move circuit breakers to ops domain
Move-Item data/sentinel/circuit-breakers.json data/ops/circuit-breakers.json

# Archive remaining sentinel data
Move-Item data/sentinel data/archive/sentinel-deprecated
```

**Step 3.2**: Create new Chief data directory structure
```
data/chief/
  connection-registry.json  (from sentinel)
  health-status.json        (new, Chief writes)
  compliance-report.json    (new, Chief writes)
```

**Step 3.3**: Create new Ops data directory structure
```
data/ops/
  playbooks/                (from sentinel)
  circuit-breakers.json     (from sentinel)
  healing-log.json          (new, Ops writes)
```

### Phase 4: Update LAUNCH_AGENTS.ps1 (~10 min)

**Step 4.1**: Remove Sentinel from agent list
```powershell
# BEFORE (7 agents)
$agents = @(
    @{ Name = "Chief";    SoulFile = "CHIEF_SOUL.md" },
    @{ Name = "Arbiter";  SoulFile = "ARBITER_SOUL.md" },
    @{ Name = "Ops";      SoulFile = "OPS_SOUL.md" },
    @{ Name = "Hunter";   SoulFile = "HUNTER_SOUL.md" },
    @{ Name = "Cortana";  SoulFile = "CORTANA_SOUL.md" },
    @{ Name = "Scout";    SoulFile = "SCOUT_SOUL.md" },
    @{ Name = "Sentinel"; SoulFile = "SENTINEL_SOUL.md" }  # REMOVE
)

# AFTER (6 agents)
$agents = @(
    @{ Name = "Chief";    SoulFile = "CHIEF_SOUL.md" },
    @{ Name = "Arbiter";  SoulFile = "ARBITER_SOUL.md" },
    @{ Name = "Ops";      SoulFile = "OPS_SOUL.md" },
    @{ Name = "Hunter";   SoulFile = "HUNTER_SOUL.md" },
    @{ Name = "Cortana";  SoulFile = "CORTANA_SOUL.md" },
    @{ Name = "Scout";    SoulFile = "SCOUT_SOUL.md" }
)
```

**Step 4.2**: Update banner/messaging
- Change "Spawning 7 Claude Terminals" → "Spawning 6 Claude Terminals"
- Update agent roster comments
- Remove Sentinel description

### Phase 5: Update Activity Feed (~15 min)

**Step 5.1**: Update AGENT_ORDER constant
```typescript
// src/components/ActivityFeed/constants.ts
// BEFORE
export const AGENT_ORDER = ['chief', 'hunter', 'ops', 'scout', 'arbiter', 'cortana', 'sentinel'];

// AFTER
export const AGENT_ORDER = ['chief', 'hunter', 'ops', 'scout', 'arbiter', 'cortana'];
```

**Step 5.2**: Update activity-bridge.ts
```typescript
// scripts/activity-bridge.ts
// BEFORE
const ALL_AGENT_IDS = ['chief', 'hunter', 'ops', 'scout', 'arbiter', 'cortana', 'oracle', 'sentinel'];

// AFTER
const ALL_AGENT_IDS = ['chief', 'hunter', 'ops', 'scout', 'arbiter', 'cortana', 'oracle'];
```

**Step 5.3**: Remove Sentinel-specific detection pattern
```typescript
// detectAgentStrict() - remove sentinel pattern
// BEFORE
sentinel: /You are Sentinel\b|SENTINEL_SOUL\.md|agent-souls[\/\\]SENTINEL_SOUL\.md/i,

// AFTER (delete line)
```

### Phase 6: Archive SENTINEL_SOUL.md (~5 min)

**Step 6.1**: Move to archive
```powershell
New-Item -ItemType Directory -Path "Library/agent-souls/archive" -Force
Move-Item "Library/agent-souls/SENTINEL_SOUL.md" "Library/agent-souls/archive/SENTINEL_SOUL.md.deprecated"
```

**Step 6.2**: Add deprecation header to archived file
```markdown
# DEPRECATED - SENTINEL_SOUL.md
> **This file is DEPRECATED as of 2026-03-22**
> SENTINEL capabilities have been merged:
> - Monitoring → CHIEF_SOUL.md
> - Healing → OPS_SOUL.md
>
> This file is preserved for historical reference only.
```

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `Library/agent-souls/CHIEF_SOUL.md` | Modify | Add monitoring workflows from SENTINEL |
| `Library/agent-souls/OPS_SOUL.md` | Modify | Add playbook execution from SENTINEL |
| `Library/agent-souls/SENTINEL_SOUL.md` | Archive | Move to archive/deprecated |
| `LAUNCH_AGENTS.ps1:L55-63` | Modify | Remove Sentinel from agents array |
| `LAUNCH_AGENTS.ps1:L21,65,261,277` | Modify | Update counts from 7→6 |
| `scripts/activity-bridge.ts:L232` | Modify | Remove sentinel from ALL_AGENT_IDS |
| `src/components/ActivityFeed/constants.ts` | Modify | Remove sentinel from AGENT_ORDER |
| `data/sentinel/` | Move | Reorganize to data/chief/ and data/ops/ |

---

## Risks and Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| Chief context bloat from 30-sec monitoring | MEDIUM | Compact health data; log only anomalies; use separate fast/slow loops |
| Chief becomes single point of failure | LOW | Ops still does independent health checks; graceful degradation |
| Lost playbook execution context | LOW | Ops already has incident response; playbooks are self-documenting |
| Activity Feed layout breaks with 6 agents | LOW | Grid is flexible; 6 agents = 2 rows of 3 |
| SENTINEL data migration errors | LOW | Archive don't delete; verify paths before launch |

---

## Context Budget Analysis

### Chief Context Impact

**Before**: ~15KB base SOUL + 5-minute coordination work
**After**: ~25KB base SOUL + 30-second health checks + 5-minute coordination

**Mitigation strategies**:
1. Health check output is terse (connection_id: status)
2. Only log anomalies in detail
3. Compliance audit runs hourly, not every cycle
4. Compact at 70% context as usual

### Expected context growth per hour:
- 120 health check cycles × ~100 bytes = 12KB
- 1 compliance audit × ~5KB = 5KB
- Coordination work = ~10KB
- **Total**: ~27KB/hour (manageable with compaction)

---

## Validation Checklist

After implementation, verify:

- [ ] Chief successfully runs 30-second health checks
- [ ] Chief detects connection failures and routes to Ops
- [ ] Ops receives health alerts in inbox
- [ ] Ops executes playbooks on health alerts
- [ ] SOUL compliance audit runs hourly
- [ ] Activity Feed shows 6 agents (no Sentinel)
- [ ] LAUNCH_AGENTS.ps1 spawns 6 terminals
- [ ] No references to "sentinel" in active code paths
- [ ] data/chief/ contains connection-registry.json
- [ ] data/ops/ contains playbooks/ and circuit-breakers.json

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: N/A (codeagent not available)
- GEMINI_SESSION: N/A (codeagent not available)

---

## Execution Command

When ready to implement:

```
/ccg:execute .claude/plan/consolidate-sentinel-into-chief.md
```

Or execute manually following the steps above.
