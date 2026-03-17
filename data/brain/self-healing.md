# Self-Healing Playbook

> When something breaks, Chief reads this FIRST before diagnosing.
> Known issues + proven fixes. The brain remembers what worked.
> Watchdog detects → Chief reads this → Chief applies known fix → logs result.
> If no known fix exists, Chief logs the new issue and escalates to Jack.

---

## How Self-Healing Works

1. **Watchdog detects** an issue (agent dead, service down, crash loop, etc.)
2. **Watchdog wakes Chief** via OpenClaw gateway with context
3. **Chief reads this file** — is there a known fix?
4. If YES → Chief applies the fix autonomously, logs in Remediation Log below
5. If NO → Chief logs it as a new issue, posts to Discord, escalates to Jack
6. After Jack fixes a new issue → Chief adds it here so it's handled automatically next time

---

## Known Issues & Auto-Fixes

### Agent Process Dead (no status update > 10 min)

**Symptoms:** Watchdog reports agent stale/dead. agents_db.json not updating.
**Root cause:** Python agent crashed. agent_runner.ts should auto-restart after 30s.
**Auto-fix:**
1. Wait 60 seconds (runner may be restarting)
2. Check agents_db.json again — if updating, issue resolved
3. If still dead → POST to /api/control: {"command":"restart","agentId":"<id>","reason":"Auto-heal: agent unresponsive for 10+ min"}
4. Wait 120 seconds, check again
5. If still dead → escalate to Jack: "Agent [name] failed to restart after auto-heal attempt"
**Severity:** HIGH — trading may be affected
**Max auto-retries:** 2

---

### Dashboard API Not Responding (localhost:3000)

**Symptoms:** Watchdog HTTP check fails on /api/agents
**Root cause:** Next.js process crashed or stuck
**Auto-fix:**
1. This is handled by supervisord autorestart — wait 30 seconds
2. If still down after 60s → log and post to Discord
3. Chief CANNOT restart supervisord processes directly — escalate to Jack
**Severity:** CRITICAL — Control API offline means Chief can't send commands
**Max auto-retries:** 0 (supervisord handles it)

---

### OpenClaw Gateway Not Responding (localhost:3001)

**Symptoms:** Watchdog can't wake Chief. Cron jobs not firing.
**Root cause:** OpenClaw gateway crashed or auth issue
**Auto-fix:**
1. Handled by supervisord autorestart
2. If repeated crashes → check logs at /app/data/logs/openclaw_err.log
3. Common cause: ANTHROPIC_API_KEY expired or rate-limited
4. Chief can't self-heal this (Chief IS the gateway) — escalate to Jack
**Severity:** CRITICAL — autonomous loop broken
**Max auto-retries:** 0

---

### yfinance Rate Limiting (429 errors)

**Symptoms:** Agent logs show "429 Too Many Requests" from yfinance
**Root cause:** Too many rapid data fetches
**Auto-fix:**
1. Agent runner has built-in retry with backoff (30s, 60s, 120s)
2. If persistent → pause the affected agent for 5 minutes
3. Resume after cooldown
**Severity:** LOW — temporary data feed issue
**Max auto-retries:** 3

---

### Database Locked (SQLite BUSY)

**Symptoms:** Write fails with "database is locked"
**Root cause:** Multiple processes writing to journal.db simultaneously
**Auto-fix:**
1. Retry after 2 seconds (SQLite busy timeout)
2. If persistent → one process may be holding a long transaction
3. Chief: POST to /api/control {"command":"summary"} — if this works, DB reads are fine
4. If reads also fail → escalate: "journal.db may be corrupted"
**Severity:** MEDIUM
**Max auto-retries:** 3

---

### Broker Disconnected (OANDA/Alpaca)

**Symptoms:** Agent meta shows broker status "unlinked"
**Root cause:** API token expired, network issue, or rate limit
**Auto-fix:**
1. Check .env.local — are the keys still present? (check existence, never read values)
2. If keys present → likely a temporary network issue. Wait 5 min, check again.
3. If keys missing → escalate to Jack: "Broker credentials missing from .env.local"
4. Chief CANNOT add or modify credentials — that's Jack's job
**Severity:** HIGH — agent can't trade
**Max auto-retries:** 1

---

### Webhook Signals Not Arriving

**Symptoms:** signals table has no new entries during market hours for > 2 hours
**Root cause:** TradingView alerts stopped, WEBHOOK_SECRET mismatch, or endpoint down
**Auto-fix:**
1. Verify dashboard API is up (GET /api/agents)
2. Check .env.local for WEBHOOK_SECRET presence
3. If both present → likely TradingView side. Chief can't fix external services.
4. Post to Discord: "Signal drought — check TradingView alert configuration"
**Severity:** MEDIUM — agents scan independently but won't get TV alerts
**Max auto-retries:** 0

---

### Disk Space Warning (>85%)

**Symptoms:** Watchdog disk check fires
**Auto-fix:**
1. Identify largest log files: check /app/data/logs/ sizes
2. If logs > 100MB → log rotation should handle it (supervisord logfile_maxbytes)
3. If data/ directory growing → old agent status files may be accumulating
4. Chief CAN delete: old log files in /app/data/logs/*.log.* (rotated backups)
5. Chief CANNOT delete: journal.db, agents_db.json, brain files, .env files
6. If disk > 95% → escalate to Jack immediately
**Severity:** MEDIUM at 85%, CRITICAL at 95%
**Max auto-retries:** 1

---

### Agent Crash Loop (3+ restarts in 1 hour)

**Symptoms:** Watchdog detects rapid restart pattern
**Root cause:** Code bug, dependency issue, or corrupt state
**Auto-fix:**
1. Pause the agent via Control API — stop the crash loop
2. Read the last 50 lines of the agent's error log
3. Post to Discord: "Agent [name] in crash loop. Paused. Error: [last error line]"
4. Write to pipeline outbox/errors/ for detailed diagnosis
5. Do NOT auto-resume — wait for Jack or next Evolution Engine cycle
**Severity:** HIGH
**Max auto-retries:** 0 (pause and wait)

---

## Remediation Log

> Chief logs every auto-heal action here. This is the self-healing audit trail.
> Format: [timestamp] ISSUE: ... | FIX: ... | RESULT: success/failed | ESCALATED: yes/no

<!-- Chief appends entries here -->

---

## New Issues Queue

> When Chief encounters an issue NOT in this playbook, log it here.
> Jack reviews and adds the fix, so it's handled automatically next time.
> The brain learns from every outage.

### [2026-03-17] Issue: agents_db.json stale — Python agents not emitting status updates
- **Symptoms:** agents_db.json `last_updated` timestamps frozen at Feb 2026. All 5+ Python agents showing ACTIVE but not updating. Intel layer generating intel_signals (Node.js alive) but no AGENT_STATUS_UPDATE events received.
- **Context:** System Builder audit detected during morning audit run. No crash loop detected in watchdog. App process appears healthy (API endpoints responding). Only Python agent subprocess updates are missing.
- **Likely causes:**
  1. `agent_runner.ts` is not running (PM2/supervisord process may have stopped)
  2. Python agents are running but stdout is not being captured (pipe broken)
  3. agents_db.json write permission issue
  4. Agent runner running but Python agents crashing silently before emitting status
- **Diagnostic steps for Jack:**
  1. `pm2 list` or `supervisorctl status` — confirm runner process is ONLINE
  2. `pm2 logs runner --lines 50` — check for errors
  3. `python scripts/bitcoin_bob_engine.py` directly (one-shot) — does it emit AGENT_STATUS_UPDATE?
  4. Check data permissions: `ls -la data/agents_db.json`
- **Jack's fix:** [to be filled in after resolution]
- **Auto-fix added:** [ ] not yet — need Jack's resolution to build the auto-fix

### [2026-03-17] Issue: /api/control returns `agents: {}` instead of agent data
- **Symptoms:** GET /api/control returns `"agents": {}`. GET /api/agents returns correct 7-agent structure.
- **Context:** Both routes should read from agents_db.json. Control API has diverged.
- **Likely cause:** /api/control/route.ts does not import or read agents_db.json — it may only return system health metrics from DB, not agent state from the JSON file.
- **Diagnostic steps for Jack:** Review `src/app/api/control/route.ts` — compare agents data source vs `src/app/api/agents/route.ts`.
- **Jack's fix:** [to be filled in after resolution]
- **Auto-fix added:** [ ] not yet
