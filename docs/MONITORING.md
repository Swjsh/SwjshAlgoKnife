# System Monitoring & Watchdog

**Status:** Production-Grade Daemon | Pure Python, Zero API Cost
**Location:** `scripts/watchdog.py`
**Deployment:** Runs 24/7 on GCP VM alongside the trading platform

---

## Overview

SwjshAK uses a hierarchical four-tier monitoring system that runs continuously without invoking expensive LLM APIs for routine checks. The **Watchdog daemon** monitors 18 distinct health checks across 4 tiers, escalating to Chief (OpenClaw/Claude Sonnet) ONLY when critical thresholds are breached.

**Key Principle:** Watchdog does pure rule-based monitoring. Chief (AI) is only woken for situations requiring human judgment.

---

## Architecture

### Watchdog's Role
- Runs every 60 seconds in a main loop
- Each check has its own cadence via `AlertThrottle` (prevents alarm fatigue)
- Posts to Discord for routine alerts, human review
- Escalates to Chief via OpenClaw gateway for critical issues
- Writes error tasks to OpenClaw pipeline for AI diagnosis
- Reads from:
  - `journal.db` (SQLite trade/signal history)
  - `agents_db.json` (real-time agent state)
  - Agent data files (`*_agent_status.json`)
  - System disk usage

### Alert Escalation Path
```
Watchdog detects issue
        ↓
Rule engine evaluates severity
        ↓
If CRITICAL: Post Discord + Wake Chief
If WARNING: Post Discord only
If INFO:    Post Discord (low priority)
        ↓
Chief reads self-healing.md
        ↓
Chief applies known fix OR escalates to Jack
```

---

## Four Monitoring Tiers

### Tier 1: Critical (Every 2-3 Minutes)
Covers the highest-priority system health. Run frequency: 120-180s

| Check | Threshold | Action |
|-------|-----------|--------|
| **Agent Health** | Status != ACTIVE/ONLINE, >2 min stale, >10 min dead | Discord + Wake Chief if HALTED/DEAD |
| **Daily P&L** | Loss > 2% of account balance = kill switch | Wake Chief immediately |
| **Active Trade Count** | Total > 3 concurrent trades | Discord warning |
| **Correlation Exposure** | >2 correlated assets in same group | Discord warning |
| **Services** | Dashboard API not responding (HTTP 200) | Discord critical |
| **Disk Space** | Usage > 95% | Discord critical; > 85% = warning |

**Thresholds (from RiskEngine defaults):**
- Account balance: `$10,000` (configurable via `ACCOUNT_BALANCE` env)
- Daily loss limit: 2% = `$200`
- Daily loss warning: 1% = `$100` (50% of kill switch)
- Max concurrent trades: `3`
- Max correlated exposure: `2` symbols per group
- Agent stale time: `120s` (2 min)
- Agent dead time: `600s` (10 min)

---

### Tier 2: Trading (Every 5-10 Minutes)
Monitors active positions, signal flow, and trade health. Run frequency: 300-1800s

| Check | Threshold | Action |
|-------|-----------|--------|
| **Stale Pending Trades** | SQLite PENDING > 30 min old | Discord warning |
| **Stale Pending Orders** | agents_db pending_orders > 120 min old | Discord warning |
| **Active Trade Duration** | Open position > 240 min (4 hours) | Discord warning |
| **Sterling Noon Window** | FX positions still open after 12 PM ET | Discord warning |
| **Overnight Positions** | Trades from previous day still open at 9 AM | Discord warning |
| **Signal Pipeline** | No signals during market hours for 120 min | Discord warning |
| **Broker Connectivity** | Broker status = unlinked in agents_db | Discord warning |
| **Consecutive Losses** | Strategy has 3+ losses in 48 hours | Wake Chief + error task |

**Market Session Times (ET):**
- London: 3:00 AM - 11:30 AM
- NYSE: 9:30 AM - 4:00 PM
- Overlap: 8:00 AM - 12:00 PM

---

### Tier 3: Performance (Every 30 Minutes)
Analyzes strategy effectiveness and system efficiency. Run frequency: 1800-3600s

| Check | Threshold | Action |
|-------|-----------|--------|
| **Win Rates** | Agent win rate < 35% over 20+ trades | Discord + error task |
| **Friction Costs** | Slippage > 10% of gross P&L | Discord warning |
| **Strategy P&L Breakdown** | Daily breakdown (informational, NYSE hours only) | Discord info |
| **Intel Gating** | Block rate >60% OR <5% over 20+ trades | Discord warning/info |

---

### Tier 4: Daily (Once Per Day)
Summarizes longer-term trends and system evolution. Run frequency: 86400s

| Check | Trigger | Action |
|-------|---------|--------|
| **Professor Digest** | Daily at any time (checks last 24h of reviews) | Discord info |
| **End-of-Day Report** | 4:00-4:05 PM ET on weekdays | Discord info |

Includes:
- Grade distribution (A, B, C, D, F) from closed trades
- Agent status rollup
- Today's win/loss count and P&L
- Disk usage snapshot

---

## Agent Registry

Watchdog monitors these agents with health checks:

### Trading Agents

| Key | Name | Market | Health File |
|-----|------|--------|-------------|
| `fx` | Sterling | Forex | `fx_agent_status.json` |
| `crypto` | Bitcoin Bob | Crypto | `crypto_agent_status.json` |
| `futures` | Pivot Pete | Futures | `futures_agent_status.json` |
| `boba` | Boba | Options | (none) |
| `spx` | SPX Sniper | Options | `spx_agent_status.json` |
| `orb` | ORB Runner | Futures | (none) |

### Oversight Agents

| Key | Name | Role |
|-----|------|------|
| `professor` | The Professor | Grades closed trades A-F |
| `auditor` | The Auditor | Fact-checks Professor's work |

---

## Correlation Groups

Used to detect over-exposure to correlated assets (max 2 per group):

```python
CORRELATION_GROUPS = {
    "EUR_GBP":  ["EURUSD", "GBPUSD", "EURGBP", "GBPJPY", "EURJPY"],
    "USD_JPY":  ["USDJPY", "EURJPY", "GBPJPY"],
    "INDICES":  ["ES", "NQ", "SPY", "QQQ", "SPXW"],
    "CRYPTO":   ["BTC-USD", "ETH-USD", "SOL-USD"],
}
```

If 3+ trades are open in the same group, Discord warning is posted.

---

## Configuration & Environment

**Env Variables** (read from system or `.env`):

```bash
APP_DIR                    # Root of SwjshAlgoKnife (default: /home/jackw/SwjshAlgoKnife)
DATABASE_PATH              # Path to journal.db (default: $APP_DIR/journal.db)
AGENTS_DB_PATH             # Path to agents_db.json (default: $APP_DIR/data/agents_db.json)
DATA_DIR                   # Data directory (default: $APP_DIR/data)
PIPELINE_DIR               # OpenClaw pipeline (default: ~/.openclaw/pipeline)
OPENCLAW_GATEWAY           # Gateway URL (default: http://127.0.0.1:3001)
OPENCLAW_GATEWAY_TOKEN     # Bearer token for Chief (required to wake Chief)
DISCORD_CHIEF_WEBHOOK      # Discord webhook URL (required for alerts)
ACCOUNT_BALANCE            # Account size in dollars (default: 10000)
```

**Hardcoded Risk Thresholds** (match RiskEngine.ts):

```python
MAX_DAILY_LOSS_PCT = 0.02              # 2% of account balance
DAILY_LOSS_WARN = 0.5 * MAX_DAILY_LOSS # 1% = warning threshold
DAILY_LOSS_KILL = MAX_DAILY_LOSS_PCT   # 2% = kill switch
MAX_CONCURRENT_TRADES = 3              # per RiskEngine default
MAX_CORRELATED_EXPOSURE = 2            # per RiskEngine default
```

---

## How to Check System Health

### 1. Via LLM Control API (Recommended)

```bash
# Get full system status
curl -s http://localhost:3000/api/control | jq .

# Send commands
curl -X POST http://localhost:3000/api/control \
  -H "Content-Type: application/json" \
  -d '{"command": "summary"}'

# Available commands:
# { "command": "summary" }              → Daily P&L report
# { "command": "pause", "agentId": "fx" } → Pause a specific agent
# { "command": "resume", "agentId": "fx" } → Resume an agent
# { "command": "killswitch" }           → Emergency halt all
# { "command": "killswitch_reset" }     → Resume after halt
```

### 2. Via SQLite Queries

```sql
-- Check today's P&L
SELECT COUNT(*) as total,
       SUM(CASE WHEN status='WIN' THEN 1 ELSE 0 END) as wins,
       ROUND(SUM(pnl), 2) as daily_pnl
FROM trades
WHERE date(exit_date) = date('now') AND status IN ('WIN', 'LOSS');

-- Check for stale pending trades
SELECT id, symbol, entry_date,
       CAST((julianday('now') - julianday(entry_date)) * 1440 AS INTEGER) as mins_pending
FROM trades
WHERE status = 'PENDING' AND datetime(entry_date) < datetime('now', '-30 minutes');

-- Check recent signals
SELECT timestamp, source, symbol, action
FROM signals
ORDER BY timestamp DESC LIMIT 20;
```

### 3. Via agents_db.json

```bash
# Check agent state
cat data/agents_db.json | jq '.fx | {status, last_updated, active_trades, performance}'

# Check pending orders
cat data/agents_db.json | jq '.boba.pending_orders[]'

# Check active trades per agent
cat data/agents_db.json | jq '.[] | {status, active_count: (.active_trades | length)}'
```

### 4. Via Watchdog Logs

```bash
# Tail watchdog output (if running directly)
# Output includes [WATCHDOG] timestamps and structured messages

# Or check Discord #watchdog channel for alerts
```

---

## Process Management

### Local Windows (PM2)
```powershell
# Defined in ecosystem.config.js
pm2 start "npx tsx scripts/agent_runner.ts" --name "agent-runner"
pm2 start "python3 scripts/watchdog.py" --name "watchdog"
```

### Docker / GCP (supervisord)
```ini
; supervisord.conf
[program:agent-runner]
command=npx tsx /app/scripts/agent_runner.ts

[program:watchdog]
command=python3 /app/scripts/watchdog.py
```

**Key:** The Watchdog is a sibling process to agent_runner; they run independently and communicate through shared files (journal.db, agents_db.json).

---

## Alert Handling Workflow

### When Watchdog Posts Discord

1. **INFO level (blue):** Routine metrics (daily breakdown, digest)
2. **WARN level (amber):** Degraded but operational (stale trades, high friction, low win rate)
3. **CRITICAL level (red):** System threat (agent halted, daily loss limit, disk full)
4. **SUCCESS level (green):** Watchdog online confirmation, test messages

### When Watchdog Wakes Chief

**Chief is only woken for:**
1. Agent HALTED or DEAD (no status update >10 min)
2. Daily loss breaches 2% limit (kill switch)
3. Strategy has 3+ losses in 48 hours (loss streak)
4. Critical system failures (API down, etc.)

**Chief's Protocol:**
```
1. Read data/brain/self-healing.md
2. Check "Known Issues Queue" for matching problem
3. If known fix exists:
   a. Apply it (modify config, restart agent, etc.)
   b. Log result to "Remediation Log"
   c. Post success to Discord #chief-main
4. If unknown issue:
   a. Add to "New Issues Queue" with analysis
   b. Post to Discord #chief-main with recommendation
   c. Escalate to Jack if urgent
5. Update data/brain/decisions-log.md
```

---

## Error Task Pipeline

Watchdog can write structured error tasks to OpenClaw pipeline for async processing:

```json
{
  "taskId": "kill-switch-20260315",
  "created": "2026-03-15T16:30:00Z",
  "source": "watchdog",
  "severity": "critical|high|medium|low",
  "title": "Kill switch triggered: $-250 daily loss",
  "description": "Daily loss of $-250 exceeded 2% limit on $10,000 account."
}
```

Written to: `~/.openclaw/pipeline/outbox/errors/{taskId}.json`

---

## Troubleshooting

### Watchdog Not Running
```bash
# Check if process is alive
ps aux | grep watchdog

# Restart it
python3 scripts/watchdog.py &

# Check logs for errors
tail -f logs/watchdog.log
```

### Discord Not Posting Alerts
1. Verify `DISCORD_CHIEF_WEBHOOK` env var is set
2. Test webhook manually:
   ```bash
   curl -X POST $DISCORD_CHIEF_WEBHOOK \
     -H "Content-Type: application/json" \
     -d '{"embeds":[{"title":"Test","description":"Hello from Watchdog","color":16744448}]}'
   ```
3. Check Discord server permissions (webhook app has write access)

### Chief Not Waking
1. Check `OPENCLAW_GATEWAY` is running: `curl http://127.0.0.1:3001/health`
2. Verify `OPENCLAW_GATEWAY_TOKEN` is set
3. Check OpenClaw logs for auth errors
4. Watchdog will still post to Discord if Chief is unavailable

### False Alarms
Use `AlertThrottle` thresholds to adjust cadence:
- Reduce `cooldown_secs` for faster re-alerts
- Increase for less noise
- Throttle keys are in `run_cycle()` function (e.g., `"agent_health"`, `"daily_pnl"`)

---

## Key Files & Locations

| File | Purpose |
|------|---------|
| `scripts/watchdog.py` | Main watchdog daemon (18 checks) |
| `journal.db` | SQLite database with trades/signals |
| `data/agents_db.json` | Agent state (read-only by watchdog) |
| `data/*_agent_status.json` | Per-market health files |
| `data/brain/self-healing.md` | Known issues + fixes (Chief reads) |
| `~/.openclaw/pipeline/outbox/errors/` | Error task queue |

---

## Performance Notes

- **Memory:** Minimal (~50-100 MB Python process)
- **CPU:** Negligible, runs every 60 seconds
- **Network:** Only to Discord (10 reqs/min max) and OpenClaw (if waking Chief)
- **Database:** Read-only SQLite queries, typically <100ms each

No external API calls for market data. Pure monitoring = minimal cost.
