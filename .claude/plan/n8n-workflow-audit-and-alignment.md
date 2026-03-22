# n8n Workflow Audit & System Alignment Plan

## Executive Summary

**Objective:** Audit all 18 n8n workflows, validate they align with SwjshAlgoKnife's actual architecture, fix endpoint URLs, and activate appropriate workflows to support HALO agents, trading bots, and the research lab.

**Current State:** 18 workflows exist but ALL are inactive with placeholder/incorrect endpoints.

**Target State:** Production-ready workflows that integrate with:
- 6 HALO agents (Chief, Arbiter, Ops, Hunter, Cortana, Scout)
- 6 Trading bots (Sterling FX, Bitcoin Bob, Pivot Pete, Boba, SPX Sniper, ORB Runner)
- 8 Research Lab agents (Improver, Backtester, Researcher, Brain Updater, Security, Integration, Intel, DevOps)
- Dashboard APIs on localhost:3000

---

## Phase 1: Workflow URL Corrections (CRITICAL)

### Current Problem
All workflows use placeholder URLs that don't match the actual API structure.

### Correct Endpoint Mappings

| Workflow Purpose | Current URL (Wrong) | Correct URL |
|-----------------|---------------------|-------------|
| System Status | `/api/control` | `http://localhost:3000/api/control` ✓ |
| Agent Health | `/api/agents/health` | `http://localhost:3000/api/agents/halo` |
| HALO Agents | N/A | `http://localhost:3000/api/agents/halo` |
| Trading Agents | N/A | `http://localhost:3000/api/agent-status` |
| Broker Positions | `/api/broker/positions` | `http://localhost:3000/api/broker/status` |
| Journal/Trades | `/api/journal` | `http://localhost:3000/api/journal` ✓ |
| Brain Freshness | `/api/brain/freshness` | `http://localhost:3000/api/brain/freshness` ✓ |
| Research Overnight | N/A | `http://localhost:3000/api/research/overnight` |
| Research Agents | N/A | `http://localhost:3000/api/research/agents` |
| Killswitch | N/A | `http://localhost:3000/api/killswitch` |
| Intel Score | N/A | `http://localhost:3000/api/intel/score` |
| Activity Feed | N/A | `http://localhost:3000/api/activity` |
| Sentinel | N/A | `http://localhost:3000/api/sentinel` |

---

## Phase 2: Workflow Restructuring

### Category A: ACTIVATE IMMEDIATELY (Core Operational)

#### 1. Daily Standup (ID: fbDNvgE4gseufY0C)
**Schedule:** 9:00 AM ET M-F
**Changes Required:**
- Fix URL: `/api/agents/halo` (not `/api/agents/health`)
- Add HALO agent status aggregation
- Add trading agent status from `/api/agent-status`
- Add activity feed summary from `/api/activity/stats`

#### 2. CEO Briefing (ID: iAGJoPPCugWMLk0B)
**Schedule:** 8:00 AM ET M-F
**Changes Required:**
- Add P&L calculation from trading agents
- Add HALO agent task summary
- Add overnight research results if available
- Format as executive summary

#### 3. Incident Response (ID: OEiChQeugkOrsFUT)
**Trigger:** Webhook `/incident`
**Changes Required:**
- Connect to actual killswitch: `POST /api/killswitch`
- Add HALO agent restart via `/api/agents/halo` POST
- Add Discord notification node (optional)
- Add severity-based routing (critical → killswitch, warning → log)

#### 5. Agent Health Monitor (ID: KXylxV7QEEvuSYLR)
**Schedule:** Every 5 minutes
**Changes Required:**
- Call `/api/agents/halo` for HALO agents
- Call `/api/agent-status` for trading agents
- Call `/api/research/agents` for research agents
- Write alerts to `/api/sentinel/command` for auto-healing

#### 7. Market Open Prep (ID: 05BhjDJC76zNAw4B)
**Schedule:** 9:25 AM ET M-F (5 min before open)
**Changes Required:**
- Check broker connection: `/api/broker/status`
- Verify all trading agents ACTIVE
- Check intel feeds: `/api/intel/free-feeds`
- Check economic calendar: `/api/intel/calendar`

#### 8. End of Day Wrap (ID: ycmlrHppIPyqsH7J)
**Schedule:** 4:15 PM ET M-F
**Changes Required:**
- Get daily summary: `POST /api/control { "command": "summary" }`
- Trigger Professor grading sync
- Update brain files via activity feed
- Generate accomplishments summary

---

### Category B: ACTIVATE WITH MODIFICATIONS (Self-Improvement)

#### 9. Tech Debt Scanner (ID: 8nGhJTRpS4SAIyLI)
**Schedule:** Sunday 6:00 AM
**Changes Required:**
- Run inside Docker container (not host commands)
- Output to `/api/research/logs` for tracking
- Use project path: `/app` (Docker) or `C:\Users\jackw\Desktop\SwjshAlgoKnife` (Windows)

#### 10. Strategy Tuner (ID: FKsmgRZYdmJUp8Fi)
**Schedule:** Saturday 5:00 AM (after week's trading)
**Changes Required:**
- Read backtest results from `data/backtests/`
- Analyze strategy performance from `/api/journal`
- Compare against KPIs in brain files
- Output recommendations to Jira

#### 13. Documentation Updater (ID: holPgxaJSfDAsGJl)
**Schedule:** Sunday 8:00 AM
**Changes Required:**
- Check `/api/brain/freshness` for stale docs
- Trigger Brain Updater research agent if needed
- Update Master Tracker with status

#### 18. Learning Extractor (ID: UvVVko35i62qIj2g)
**Schedule:** Friday 10:00 PM
**Changes Required:**
- Aggregate accomplishments from `/api/accomplishments`
- Extract patterns from activity feed
- Update `data/brain/learning-log.md`
- Create Jira ticket for confirmed patterns

---

### Category C: NEW WORKFLOWS NEEDED (Gap Analysis)

The current 18 workflows are missing critical HALO-support functionality:

#### NEW: HALO Agent Nudge (Every 15 min)
- Check each HALO agent's heartbeat staleness
- If stale > 10 min, send nudge command
- If stale > 30 min, trigger restart
- Log to activity feed

#### NEW: Research Lab Orchestrator (Overnight trigger)
- Launch research agents via `/api/research/overnight`
- Monitor progress via `/api/research/status`
- Aggregate results at morning
- Generate morning report

#### NEW: Trading Agent Recovery (Every 10 min)
- Check trading agent status
- If agent crashed, restart via control commands
- If broker disconnected, reconnect
- Escalate to Ops HALO agent if repeated failures

#### NEW: Intel Aggregation (Every 30 min during market hours)
- Fetch intel from `/api/intel/free-feeds`
- Calculate composite score
- Store history for Cortana analysis
- Alert on significant regime changes

#### NEW: Jira Sync (Every 30 min)
- Sync HALO agent tasks with Jira
- Create tickets for blockers
- Update ticket status from agent completions
- Feed Scout agent's backlog

---

## Phase 3: Workflow Updates (Implementation Steps)

### Step 3.1: Update Workflow 1 (Daily Standup)

```json
{
  "operations": [
    {
      "type": "updateNode",
      "nodeName": "Get Agent Health",
      "parameters": {
        "url": "http://localhost:3000/api/agents/halo"
      }
    },
    {
      "type": "addNode",
      "node": {
        "name": "Get Trading Agents",
        "type": "n8n-nodes-base.httpRequest",
        "parameters": {
          "url": "http://localhost:3000/api/agent-status",
          "method": "GET"
        },
        "position": [440, 100]
      }
    },
    {
      "type": "addNode",
      "node": {
        "name": "Get Activity Stats",
        "type": "n8n-nodes-base.httpRequest",
        "parameters": {
          "url": "http://localhost:3000/api/activity/stats",
          "method": "GET"
        },
        "position": [440, 200]
      }
    }
  ]
}
```

### Step 3.2: Update Workflow 3 (Incident Response)

```json
{
  "operations": [
    {
      "type": "updateNode",
      "nodeName": "Emergency Killswitch",
      "parameters": {
        "url": "http://localhost:3000/api/killswitch",
        "method": "POST",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            { "name": "active", "value": "true" },
            { "name": "reason", "value": "={{ $json.reason || 'n8n incident response' }}" }
          ]
        }
      }
    }
  ]
}
```

### Step 3.3: Update Workflow 5 (Agent Health Monitor)

This is the most critical workflow for HALO support:

```json
{
  "operations": [
    {
      "type": "updateNode",
      "nodeName": "Check All Agents",
      "parameters": {
        "url": "http://localhost:3000/api/agents/halo"
      }
    },
    {
      "type": "addNode",
      "node": {
        "name": "Check Trading Agents",
        "type": "n8n-nodes-base.httpRequest",
        "parameters": {
          "url": "http://localhost:3000/api/agent-status",
          "method": "GET"
        }
      }
    },
    {
      "type": "addNode",
      "node": {
        "name": "Check Research Agents",
        "type": "n8n-nodes-base.httpRequest",
        "parameters": {
          "url": "http://localhost:3000/api/research/agents",
          "method": "GET"
        }
      }
    },
    {
      "type": "updateNode",
      "nodeName": "Evaluate Health",
      "parameters": {
        "jsCode": "const halo = $('Check All Agents').first().json;\nconst trading = $('Check Trading Agents').first().json;\nconst research = $('Check Research Agents').first().json;\n\nconst deadHalo = Object.entries(halo.agents || {}).filter(([,a]) => a.status === 'dead').map(([id]) => id);\nconst staleTrading = Object.entries(trading || {}).filter(([,a]) => a.status === 'STALE').map(([id]) => id);\n\nconst alerts = [];\nif (deadHalo.length > 0) alerts.push(`HALO agents dead: ${deadHalo.join(', ')}`);\nif (staleTrading.length > 0) alerts.push(`Trading agents stale: ${staleTrading.join(', ')}`);\n\nreturn [{\n  json: {\n    timestamp: new Date().toISOString(),\n    type: 'health_check',\n    halo: { total: 6, online: halo.system?.totalOnline || 0, dead: halo.system?.totalDead || 0 },\n    trading: trading,\n    research: research,\n    alerts,\n    all_healthy: alerts.length === 0\n  }\n}];"
      }
    }
  ]
}
```

---

## Phase 4: Activation Sequence

### Priority 1: ACTIVATE NOW (Core Health)
1. **5. Agent Health Monitor** - Every 5 min health checks
2. **3. Incident Response** - Emergency killswitch webhook
3. **7. Market Open Prep** - Daily market readiness

### Priority 2: ACTIVATE AFTER TESTING
4. **1. Daily Standup** - Morning briefing
5. **2. CEO Briefing** - Executive summary
6. **8. End of Day Wrap** - EOD summary

### Priority 3: ACTIVATE WEEKLY
7. **4. Trade Journal Summary** - Daily trade analysis
8. **6. Position Sync** - Broker reconciliation (may need Docker network fix)

### Priority 4: ACTIVATE ON SCHEDULE
9. **9-18. Self-Improvement workflows** - Weekend/overnight runs

---

## Phase 5: New HALO-Support Workflows

### Workflow 19: HALO Nudge Loop
```yaml
Name: "19. HALO Nudge Loop"
Schedule: Every 15 min during 6 AM - 11 PM ET
Nodes:
  1. Schedule Trigger (cron: */15 6-23 * * *)
  2. GET /api/agents/halo
  3. Filter: status === 'dead'
  4. For each dead agent:
     - POST /api/agents/halo { action: 'restart', agent: <id> }
  5. Log to activity feed
```

### Workflow 20: Research Lab Monitor
```yaml
Name: "20. Research Lab Monitor"
Schedule: Every 30 min during overnight sessions
Nodes:
  1. Schedule Trigger (cron: */30 22-6 * * *)
  2. GET /api/research/agents
  3. Aggregate metrics (experiments run, kept, discarded)
  4. Check for stuck agents (no progress in 30 min)
  5. POST nudge commands to stuck agents
```

### Workflow 21: Trading Recovery
```yaml
Name: "21. Trading Recovery"
Schedule: Every 10 min during market hours
Nodes:
  1. Schedule Trigger (cron: */10 9-16 * * 1-5)
  2. GET /api/agent-status
  3. Filter crashed agents
  4. POST control commands to restart
  5. Alert Ops HALO if repeated failures
```

### Workflow 22: Intel Aggregation
```yaml
Name: "22. Intel Aggregation"
Schedule: Every 30 min during market hours
Nodes:
  1. Schedule Trigger (cron: */30 9-16 * * 1-5)
  2. GET /api/intel/free-feeds
  3. Calculate composite fear/greed score
  4. POST /api/intel/history to store
  5. Alert on regime change (BULLISH→BEARISH etc)
```

---

## Phase 6: Docker/Network Considerations

### n8n runs at: `http://100.85.126.53:5678`
### Dashboard runs at: `http://localhost:3000`

**Problem:** n8n may not reach localhost:3000 if running in Docker on different host.

**Solutions:**
1. **If n8n and Dashboard on same machine:** Use `host.docker.internal:3000`
2. **If n8n on Contabo, Dashboard local:** Use Tailscale IP or expose via ngrok
3. **Current Tailscale IP for n8n:** `100.85.126.53`

**Recommendation:** Update all workflow URLs to use environment variable `{{$env.DASHBOARD_URL}}` with fallback to localhost.

---

## Execution Checklist

- [ ] **Step 1:** Update all 8 operational workflows with correct URLs
- [ ] **Step 2:** Validate each workflow with n8n_validate_workflow
- [ ] **Step 3:** Test each workflow manually (n8n_test_workflow)
- [ ] **Step 4:** Activate Priority 1 workflows (5, 3, 7)
- [ ] **Step 5:** Monitor for 1 hour
- [ ] **Step 6:** Activate Priority 2 workflows (1, 2, 8)
- [ ] **Step 7:** Create 4 new HALO-support workflows (19-22)
- [ ] **Step 8:** Activate Priority 3 & 4 workflows
- [ ] **Step 9:** Update Master Tracker with n8n integration status

---

## SESSION_ID (for /ccg:execute use)
- N/A (planning only, no external model calls needed for this execution)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| n8n can't reach localhost | Use Tailscale IP or host.docker.internal |
| Killswitch triggered accidentally | Add confirmation step in Incident Response |
| Agent restart loops | Add cooldown (max 3 restarts per hour) |
| Overnight agents overload | Rate limit research agent commands |

---

**Plan Status:** READY FOR EXECUTION
**Estimated Steps:** 22 workflow updates + 4 new workflows
**Dependencies:** Dashboard running on localhost:3000, n8n accessible
