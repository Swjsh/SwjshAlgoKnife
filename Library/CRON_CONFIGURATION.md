# SwjshAK Cron Configuration - Complete Reference

**Created**: 2026-03-20
**Purpose**: Comprehensive documentation of ALL scheduled tasks across ALL scheduling systems
**Audience**: Jack, Claude sessions, future maintainers

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Scheduling Systems Overview](#scheduling-systems-overview)
3. [OpenClaw Cron System](#openclaw-cron-system)
4. [n8n Schedule Triggers](#n8n-schedule-triggers)
5. [Windows Task Scheduler](#windows-task-scheduler)
6. [Linux System Cron](#linux-system-cron)
7. [PM2 Process Management](#pm2-process-management)
8. [Decision Matrix: What Goes Where](#decision-matrix-what-goes-where)
9. [Complete Agent Schedule](#complete-agent-schedule)
10. [Configuration Files](#configuration-files)
11. [Monitoring and Debugging](#monitoring-and-debugging)

---

## Executive Summary

SwjshAK uses **5 different scheduling systems**, each with a specific purpose:

| System | Purpose | Location | Best For |
|--------|---------|----------|----------|
| **OpenClaw Cron** | AI agent wake-ups | `~/.openclaw/cron/jobs.json` | Chief, Arbiter, trading agents |
| **n8n Schedule Triggers** | Workflow automation | n8n instance workflows | Data collection, reports, integrations |
| **Windows Task Scheduler** | Local dev tasks | Windows schtasks | Brain sync, local backups |
| **Linux System Cron** | VPS system tasks | `/etc/crontab` | System maintenance, log rotation |
| **PM2** | Process management | `ecosystem.config.js` | Keep services running (NOT scheduling) |

**Key Insight**: OpenClaw handles AI agent thinking. n8n handles data piping and integrations. System cron handles OS-level tasks. PM2 just keeps processes alive.

---

## Scheduling Systems Overview

### The Mental Model

```
                    WHAT NEEDS THINKING?
                           │
             ┌─────────────┴─────────────┐
             │                           │
        YES (AI)                    NO (Data/System)
             │                           │
             ▼                           ▼
      ┌───────────┐              ┌───────────────┐
      │ OPENCLAW  │              │ WHAT LEVEL?   │
      │  CRON     │              └───────┬───────┘
      │           │                      │
      │ • Chief   │         ┌────────────┼────────────┐
      │ • Prof    │         │            │            │
      │ • Sterling│    Application   Integration   System
      │ • Bob     │         │            │            │
      └───────────┘         ▼            ▼            ▼
                       ┌────────┐   ┌────────┐   ┌────────┐
                       │  PM2   │   │  n8n   │   │ Cron   │
                       │Process │   │Workflow│   │(Linux) │
                       │Manager │   │Triggers│   │        │
                       └────────┘   └────────┘   └────────┘
```

---

## OpenClaw Cron System

### Overview

OpenClaw's cron system triggers AI agent sessions on schedules. Each job wakes an agent with a specific prompt, optionally delivering the response to Discord.

### File Location

```
Local Windows:   C:\Users\jackw\.openclaw\cron\jobs.json
Contabo VPS:     /root/.openclaw/cron/jobs.json
```

**Important**: The `cron.jobs` key does NOT go in `openclaw.json`. Jobs are stored in a separate file managed by OpenClaw CLI.

### JSON Schema

```json
{
  "jobId": "string (stable identifier, required)",
  "name": "string (human-readable name, required)",
  "description": "string (optional)",
  "enabled": true,
  "agentId": "string (which agent to wake)",
  "schedule": {
    "kind": "cron | at | every",
    "expr": "cron expression (for kind=cron)",
    "tz": "IANA timezone (e.g., America/New_York)",
    "at": "ISO 8601 timestamp (for kind=at)",
    "everyMs": 60000 (for kind=every)
  },
  "sessionTarget": "main | isolated | session:custom-id",
  "wakeMode": "now | next-heartbeat",
  "payload": {
    "kind": "agentTurn | systemEvent",
    "message": "prompt text (for agentTurn)",
    "text": "event text (for systemEvent)",
    "lightContext": true,
    "timeoutSeconds": 300,
    "model": "provider/model (optional override)"
  },
  "delivery": {
    "mode": "announce | webhook | none | silent",
    "channel": "discord | slack | telegram",
    "to": "channel:SNOWFLAKE_ID",
    "bestEffort": false
  },
  "deleteAfterRun": false
}
```

### Schedule Types

#### 1. Cron Expression (`kind: "cron"`)

Standard 5-field cron with optional 6th field for seconds:

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-7, 0=Sunday)
│ │ │ │ │
* * * * *
```

**Examples**:
- `0 8 * * 1-5` = 8:00 AM, Mon-Fri
- `*/30 9-16 * * 1-5` = Every 30 min, 9AM-4PM, Mon-Fri
- `0 */4 * * *` = Every 4 hours
- `0 18 * * 0` = Sunday at 6 PM

#### 2. One-Shot (`kind: "at"`)

```json
{
  "kind": "at",
  "at": "2026-03-20T14:00:00Z"
}
```

#### 3. Interval (`kind: "every"`)

```json
{
  "kind": "every",
  "everyMs": 1800000
}
```

### Session Targets

| Target | Behavior | Use Case |
|--------|----------|----------|
| `"main"` | Adds to main context, waits for heartbeat | Rare, for persistent context |
| `"isolated"` | Fresh session per run, no carry-over | **Most common** - clean agent runs |
| `"session:custom-id"` | Named session, maintains context between runs | Conversation continuity |

### Delivery Modes

| Mode | Behavior |
|------|----------|
| `"announce"` | Posts agent response to channel |
| `"silent"` | Runs job but suppresses output to channel |
| `"webhook"` | POSTs response to URL |
| `"none"` | No delivery, just runs the agent |

### CLI Commands

```bash
# List all cron jobs
openclaw cron list
openclaw cron list --json

# Add a job (interactive)
openclaw cron add

# Edit existing job
openclaw cron edit <jobId>

# Enable/disable
openclaw cron enable <jobId>
openclaw cron disable <jobId>

# Manual trigger (for testing)
openclaw cron run <jobId>

# View run history
openclaw cron runs <jobId>

# Delete job
openclaw cron delete <jobId>
```

### Configuration in openclaw.json

The main config file only contains cron settings, not the jobs themselves:

```json
{
  "cron": {
    "enabled": true,
    "maxConcurrentRuns": 3,
    "sessionRetention": "48h",
    "runLog": {
      "maxBytes": "5mb",
      "keepLines": 5000
    }
  }
}
```

### Debugging Cron Jobs

```bash
# Check if jobs are loaded
openclaw cron list

# View Gateway logs
journalctl -u openclaw -f

# Check jobs.json directly
cat ~/.openclaw/cron/jobs.json | jq .

# View run history for a job
cat ~/.openclaw/cron/runs/<jobId>.jsonl
```

---

## n8n Schedule Triggers

### Overview

n8n provides visual workflow automation with schedule triggers. Unlike OpenClaw (which triggers AI thinking), n8n triggers data pipelines and integrations.

### Schedule Trigger Node

The `Schedule Trigger` node (nodes-base.scheduleTrigger) supports multiple modes:

#### Mode Options

| Mode | Description | Parameters |
|------|-------------|------------|
| `everyMinute` | Every minute | None |
| `everyHour` | Every hour | minute |
| `everyDay` | Daily | hour, minute |
| `everyWeek` | Weekly | weekday, hour, minute |
| `everyMonth` | Monthly | dayOfMonth, hour, minute |
| `everyX` | Every X minutes/hours | value, unit |
| `custom` | Cron expression | cronExpression |

#### Cron Expression in n8n

n8n uses a 6-field cron format (includes seconds):

```
┌───────────── second (0-59) [OPTIONAL]
│ ┌───────────── minute (0-59)
│ │ ┌───────────── hour (0-23)
│ │ │ ┌───────────── day of month (1-31)
│ │ │ │ ┌───────────── month (0-11) [NOTE: 0-indexed!]
│ │ │ │ │ ┌───────────── day of week (0-6)
│ │ │ │ │ │
* * * * * *
```

**Warning**: n8n months are 0-indexed (0=January, 11=December), unlike standard cron.

### Timezone Configuration

n8n uses the instance timezone or workflow timezone:

```bash
# Docker environment variable
-e GENERIC_TIMEZONE=America/New_York
```

### Example Schedule Trigger Configuration

```json
{
  "id": "schedule-trigger",
  "name": "Schedule Trigger",
  "type": "n8n-nodes-base.scheduleTrigger",
  "typeVersion": 1,
  "position": [0, 0],
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "cronExpression",
          "expression": "0 30 16 * * 1-5"
        }
      ]
    }
  }
}
```

### n8n Workflows with Schedules (Current)

From the workflow manifest, n8n has 28 cron-triggered workflows planned across categories:

| Category | Workflows | Typical Schedule |
|----------|-----------|------------------|
| Health | WF-001 to WF-005 | Every 5-15 min |
| Reports | WF-006 to WF-009 | Daily at specific times |
| Brain | WF-010 to WF-012 | Hourly or daily |
| Signals | WF-013 to WF-016 | Real-time (webhook-based) |
| Trades | WF-017 to WF-021 | Event-driven + daily |
| Risk | WF-022 to WF-025 | Every 15 min + daily |
| Intel | WF-026 to WF-033 | Hourly + pre-market |
| Recovery | WF-034 to WF-037 | Continuous + on-failure |
| Learning | WF-038 to WF-041 | Daily + weekly |
| Advanced | WF-042 to WF-047 | Various |

### n8n + OpenClaw Integration

n8n can trigger OpenClaw agents via webhook:

```json
{
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "url": "http://localhost:3001/hooks/agent",
    "method": "POST",
    "body": {
      "agentId": "professor",
      "message": "Grade trade #456: BTC-USD LONG, -$180..."
    }
  }
}
```

---

## Windows Task Scheduler

### Overview

Windows Task Scheduler handles local development tasks that don't need the VPS.

### Current Tasks

#### SwjshAK-BrainSync

Syncs Obsidian brain files to GitHub.

```powershell
# Task configuration
Task Name:    SwjshAK-BrainSync
Schedule:     Daily at 6:00 AM
Script:       scripts/sync-brain-to-git.ps1
Run Level:    Limited (user context)
Timeout:      5 minutes
```

**Setup script**: `scripts/setup-brain-sync-task.ps1`

```powershell
# Create the task
.\scripts\setup-brain-sync-task.ps1

# Verify
schtasks /query /tn SwjshAK-BrainSync /v

# Manual trigger
schtasks /run /tn SwjshAK-BrainSync
```

### Creating New Windows Tasks

```powershell
# Create trigger
$trigger = New-ScheduledTaskTrigger -Daily -At '8:00AM'

# Create action
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"C:\path\to\script.ps1`""

# Create settings
$settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries

# Register
Register-ScheduledTask -TaskName "MyTask" -Trigger $trigger -Action $action -Settings $settings
```

### Useful Commands

```powershell
# List all tasks
schtasks /query /fo LIST

# Get task details
schtasks /query /tn TaskName /v

# Run task immediately
schtasks /run /tn TaskName

# Delete task
schtasks /delete /tn TaskName /f

# Enable/disable
schtasks /change /tn TaskName /enable
schtasks /change /tn TaskName /disable
```

---

## Linux System Cron

### Overview

System cron on the Contabo VPS handles OS-level maintenance tasks.

### File Location

```
/etc/crontab           # System-wide crontab
/etc/cron.d/           # Drop-in cron files
/var/spool/cron/root   # Root user's crontab
```

### Cron Expression Format (Standard 5-field)

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-7)
│ │ │ │ │
* * * * * user command
```

### Recommended System Cron Jobs

```bash
# /etc/cron.d/swjshak

# Log rotation - daily at 3 AM
0 3 * * * root /usr/sbin/logrotate /etc/logrotate.conf

# Disk space check - every 6 hours
0 */6 * * * root df -h / | mail -s "Disk usage" admin@example.com

# Docker cleanup - weekly on Sunday at 4 AM
0 4 * * 0 root docker system prune -af --volumes

# Backup journal.db - daily at 2 AM
0 2 * * * root cp /root/SwjshAlgoKnife/journal.db /root/backups/journal_$(date +\%Y\%m\%d).db

# Certificate renewal check - monthly on the 1st at 5 AM
0 5 1 * * root certbot renew --quiet

# System updates - weekly on Saturday at 3 AM
0 3 * * 6 root apt-get update && apt-get upgrade -y
```

### Useful Commands

```bash
# Edit root's crontab
crontab -e

# List root's crontab
crontab -l

# View cron logs
grep CRON /var/log/syslog
journalctl -u cron

# Test cron expression
# Use https://crontab.guru/ for validation
```

---

## PM2 Process Management

### Overview

PM2 keeps Node.js processes running. It is NOT a scheduler - it's a process manager with auto-restart capabilities.

### Configuration

**File**: `scripts/ecosystem.config.js`

```javascript
module.exports = {
    apps: [
        {
            name: 'AK-Dashboard',
            script: 'node_modules/.bin/next',
            args: 'start',
            cwd: ROOT,
            env: { PORT: 3000 },
            autorestart: true,
            max_memory_restart: '800M'
        },
        {
            name: 'AK-Runner',
            script: 'npx',
            args: 'tsx scripts/agent_runner.ts',
            cwd: ROOT,
            autorestart: true,
            max_restarts: 50,
            restart_delay: 10000
        }
    ]
};
```

### PM2 Commands

```bash
# Start all processes
pm2 start scripts/ecosystem.config.js

# View status
pm2 status
pm2 list

# View logs
pm2 logs
pm2 logs AK-Runner

# Restart
pm2 restart AK-Runner
pm2 restart all

# Stop
pm2 stop AK-Runner
pm2 stop all

# Delete from PM2
pm2 delete AK-Runner

# Save current config for auto-start on reboot
pm2 save
pm2 startup
```

### PM2 Cron Restart (Optional)

PM2 can restart processes on a schedule, but this is rarely needed:

```javascript
{
    name: 'my-app',
    cron_restart: '0 0 * * *'  // Restart daily at midnight
}
```

**Recommendation**: Don't use PM2 for scheduling. Use OpenClaw, n8n, or system cron instead.

---

## Decision Matrix: What Goes Where

### Quick Reference

| Task Type | Best System | Why |
|-----------|-------------|-----|
| **AI agent wake-up** | OpenClaw | Designed for Claude agents with sessions |
| **Trade analysis by AI** | OpenClaw | Needs thinking, memory, Discord delivery |
| **Data collection** | n8n | Visual workflow, easy error handling |
| **API polling** | n8n | Built-in HTTP nodes, retry logic |
| **Report generation** | n8n | Data transformation, multi-step |
| **Service health check** | n8n | Can trigger self-healing workflows |
| **File backup** | System cron | Simple, reliable, no dependencies |
| **Log rotation** | System cron | OS-level, runs regardless of app state |
| **Git sync** | Windows Task / Linux cron | Simple script execution |
| **Process keep-alive** | PM2 | That's literally its purpose |

### Detailed Decision Tree

```
START: What needs to run on a schedule?
  │
  ├─► Does it require Claude/AI thinking?
  │     │
  │     YES ──► OPENCLAW CRON
  │     │       Examples:
  │     │       • Chief morning briefing
  │     │       • Arbiter grading trades
  │     │       • Sterling market analysis
  │     │       • System Builder audit
  │     │
  │     NO ──► Does it integrate multiple services?
  │             │
  │             YES ──► N8N WORKFLOW
  │             │       Examples:
  │             │       • Collect VIX → store in DB → alert if high
  │             │       • Fetch trades → calculate P&L → post to Discord
  │             │       • Check broker connection → restart if failed
  │             │
  │             NO ──► Is it a simple script/command?
  │                     │
  │                     YES ──► SYSTEM CRON
  │                     │       Examples:
  │                     │       • Backup database file
  │                     │       • Rotate logs
  │                     │       • Git pull/push
  │                     │
  │                     NO ──► Is it keeping a service running?
  │                             │
  │                             YES ──► PM2
  │                                     Examples:
  │                                     • Dashboard server
  │                                     • Agent runner
```

### Common Patterns

#### Pattern 1: AI Agent with Human-Readable Output

```
OpenClaw Cron → Agent wakes up → Reads brain files →
  Queries database → Thinks about data →
    Posts analysis to Discord
```

**Use**: OpenClaw only

#### Pattern 2: Data Pipeline

```
n8n Schedule → HTTP GET from API → Transform data →
  Store in database → Calculate metrics →
    POST to Discord webhook
```

**Use**: n8n only (no AI needed)

#### Pattern 3: AI Analysis of Collected Data

```
n8n Schedule → Collect data from APIs → Store raw data →
  OpenClaw webhook → Agent analyzes data → Posts insights
```

**Use**: n8n + OpenClaw together

#### Pattern 4: System Maintenance

```
Linux cron → Run backup script → Compress files →
  Upload to cloud storage
```

**Use**: System cron only

---

## Complete Agent Schedule

### OpenClaw Cron Jobs (Current Production)

All times in **America/New_York (ET)**

#### Chief Agent Jobs

| Job ID | Schedule | Name | Purpose |
|--------|----------|------|---------|
| `brain-integrity-check` | `0 7 * * *` | Daily brain integrity | Verify 18 brain files exist and are fresh |
| `morning-briefing` | `0 8 * * 1-5` | Pre-market brief | Read brain, check agents, post Discord |
| `market-open-check` | `30 9 * * 1-5` | Market open | Confirm agents active, check signals |
| `chief-decision-loop` | `*/30 9-16 * * 1-5` | Autonomous decisions | 30-min decision cycle during market |
| `midday-check` | `0 12 * * 1-5` | Midday status | P&L update, Sterling window closing |
| `eod-brain-update` | `45 16 * * 1-5` | EOD brain sync | Write daily log, update performance |
| `system-builder` | `0 */3 * * *` | System audit | Audit brain vs code, fill gaps |
| `weekly-evolution-engine` | `0 18 * * 0` | Weekly evolution | Pattern promotion, strategy mutations |

#### Sterling FX Jobs

| Job ID | Schedule | Name | Purpose |
|--------|----------|------|---------|
| `london-open` | `0 3 * * 1-5` | London session | Check GBP/USD structure |
| `ny-overlap` | `30 8 * * 1-5` | NY-London overlap | Peak liquidity check |
| `sterling-session-close` | `0 12 * * 1-5` | Session close | 4-hour window ending |
| `sterling-forex-scan` | `0 */2 * * 1-5` | FX scan | Every 2 hours during weekdays |

#### Bitcoin Bob Jobs

| Job ID | Schedule | Name | Purpose |
|--------|----------|------|---------|
| `bitcoin-bob-watch` | `0 */4 * * *` | 4-hour scan | Check BTC structure, impulse zones |

#### Arbiter Jobs

| Job ID | Schedule | Name | Purpose |
|--------|----------|------|---------|
| `eod-arbiter-grade` | `15 16 * * 1-5` | Trade grading | Grade closed trades, feed lessons back |

#### Ops Jobs

| Job ID | Schedule | Name | Purpose |
|--------|----------|------|---------|
| `eod-ops-audit` | `30 16 * * 1-5` | Risk audit | Daily drawdown check, kill switch |

### Scout Agent Jobs (Separate Instance)

| Job ID | Schedule | Name | Purpose |
|--------|----------|------|---------|
| `morning-scan` | `0 8 * * *` | Morning opportunity | Deep scan all categories |
| `afternoon-dive` | `0 14 * * *` | Afternoon deep dive | Research top categories |
| `evening-retro` | `0 21 * * *` | Evening retrospective | Curate daily log, prune stale leads |
| `weekend-research` | `0 10 * * 6` | Weekend research | Full week retrospective |

### Visual Timeline (Market Day)

```
3:00 AM  ┃ Sterling: London open
         ┃
7:00 AM  ┃ Chief: Brain integrity check
         ┃
8:00 AM  ┃ Chief: Morning briefing → Discord
8:30 AM  ┃ Sterling: NY-London overlap
         ┃
9:00 AM  ┃ Chief: Decision loop starts (every 30 min)
9:30 AM  ┃ Chief: Market open check
         ┃
10:00 AM ┃ Sterling: 2-hour FX scan
         ┃
12:00 PM ┃ Chief: Midday check
         ┃ Sterling: Session close
         ┃ Bitcoin Bob: 4-hour scan
         ┃
2:00 PM  ┃ Sterling: 2-hour FX scan
         ┃
4:00 PM  ┃ Chief: Decision loop ends
         ┃ Bitcoin Bob: 4-hour scan
4:15 PM  ┃ Arbiter: Trade grading
4:30 PM  ┃ Ops: Risk audit
4:45 PM  ┃ Chief: EOD brain update
         ┃
Every 3h ┃ Chief: System Builder audit
```

---

## Configuration Files

### OpenClaw Jobs (Contabo VPS)

**File**: `/root/.openclaw/cron/jobs.json`

```json
[
  {
    "jobId": "chief-decision-loop",
    "agentId": "chief",
    "name": "Chief Autonomous Decision Loop (every 30 min market hours)",
    "enabled": true,
    "schedule": {
      "kind": "cron",
      "expr": "*/30 9-16 * * 1-5",
      "tz": "America/New_York"
    },
    "sessionTarget": "isolated",
    "payload": {
      "kind": "agentTurn",
      "message": "You are Chief. This is your autonomous decision cycle...",
      "lightContext": true
    },
    "delivery": {
      "mode": "silent",
      "channel": "discord",
      "to": "channel:1465522015095099549"
    }
  },
  {
    "jobId": "system-builder",
    "agentId": "chief",
    "name": "System Builder - Audit brain vs code, identify gaps",
    "enabled": true,
    "schedule": {
      "kind": "cron",
      "expr": "0 */3 * * *",
      "tz": "America/New_York"
    },
    "sessionTarget": "isolated",
    "payload": {
      "kind": "agentTurn",
      "message": "You are Chief operating as the SYSTEM BUILDER...",
      "lightContext": true
    },
    "delivery": {
      "mode": "silent",
      "channel": "discord",
      "to": "channel:1465522015095099549"
    }
  },
  {
    "jobId": "brain-integrity-check",
    "agentId": "chief",
    "name": "Daily brain integrity check 7 AM ET",
    "enabled": true,
    "schedule": {
      "kind": "cron",
      "expr": "0 7 * * *",
      "tz": "America/New_York"
    },
    "sessionTarget": "isolated",
    "payload": {
      "kind": "agentTurn",
      "message": "You are Chief. Daily brain integrity check...",
      "lightContext": true
    },
    "delivery": {
      "mode": "silent",
      "channel": "discord",
      "to": "channel:1465522015095099549"
    }
  },
  {
    "jobId": "morning-briefing",
    "agentId": "chief",
    "name": "Pre-market morning brief 8 AM ET",
    "enabled": true,
    "schedule": {
      "kind": "cron",
      "expr": "0 8 * * 1-5",
      "tz": "America/New_York"
    },
    "sessionTarget": "isolated",
    "payload": {
      "kind": "agentTurn",
      "message": "You are Chief. 8 AM ET pre-market...",
      "lightContext": true
    },
    "delivery": {
      "mode": "announce",
      "channel": "discord",
      "to": "channel:1465522015095099549"
    }
  },
  {
    "jobId": "market-open-check",
    "agentId": "chief",
    "name": "NYSE market open 9:30 AM ET",
    "enabled": true,
    "schedule": {
      "kind": "cron",
      "expr": "30 9 * * 1-5",
      "tz": "America/New_York"
    },
    "sessionTarget": "isolated",
    "payload": {
      "kind": "agentTurn",
      "message": "Market just opened. You are Chief...",
      "lightContext": true
    },
    "delivery": {
      "mode": "announce",
      "channel": "discord",
      "to": "channel:1465522015095099549"
    }
  },
  {
    "jobId": "midday-check",
    "agentId": "chief",
    "name": "Midday check noon ET",
    "enabled": true,
    "schedule": {
      "kind": "cron",
      "expr": "0 12 * * 1-5",
      "tz": "America/New_York"
    },
    "sessionTarget": "isolated",
    "payload": {
      "kind": "agentTurn",
      "message": "Noon ET. You are Chief...",
      "lightContext": true
    },
    "delivery": {
      "mode": "announce",
      "channel": "discord",
      "to": "channel:1465522015095099549"
    }
  },
  {
    "jobId": "eod-brain-update",
    "agentId": "chief",
    "name": "EOD Brain Update - Chief writes daily log",
    "enabled": true,
    "schedule": {
      "kind": "cron",
      "expr": "45 16 * * 1-5",
      "tz": "America/New_York"
    },
    "sessionTarget": "isolated",
    "payload": {
      "kind": "agentTurn",
      "message": "4:45 PM ET. You are Chief. End-of-day brain update...",
      "lightContext": true
    },
    "delivery": {
      "mode": "silent",
      "channel": "discord",
      "to": "channel:1465522015095099549"
    }
  },
  {
    "jobId": "weekly-evolution-engine",
    "agentId": "chief",
    "name": "Sunday 6PM Evolution Engine - brain self-improvement",
    "enabled": true,
    "schedule": {
      "kind": "cron",
      "expr": "0 18 * * 0",
      "tz": "America/New_York"
    },
    "sessionTarget": "isolated",
    "payload": {
      "kind": "agentTurn",
      "message": "Sunday evening. You are Chief. This is the EVOLUTION ENGINE...",
      "lightContext": true
    },
    "delivery": {
      "mode": "announce",
      "channel": "discord",
      "to": "channel:1465522015095099549"
    }
  },
  {
    "jobId": "london-open",
    "agentId": "sterling",
    "name": "London session open 3 AM ET",
    "enabled": true,
    "schedule": {
      "kind": "cron",
      "expr": "0 3 * * 1-5",
      "tz": "America/New_York"
    },
    "sessionTarget": "isolated",
    "payload": {
      "kind": "agentTurn",
      "message": "London just opened. You are Sterling...",
      "lightContext": true
    },
    "delivery": {
      "mode": "announce",
      "channel": "discord",
      "to": "channel:1467174412615942186"
    }
  },
  {
    "jobId": "ny-overlap",
    "agentId": "sterling",
    "name": "NY-London overlap 8:30 AM ET",
    "enabled": true,
    "schedule": {
      "kind": "cron",
      "expr": "30 8 * * 1-5",
      "tz": "America/New_York"
    },
    "sessionTarget": "isolated",
    "payload": {
      "kind": "agentTurn",
      "message": "8:30 AM ET. NY-London overlap. You are Sterling...",
      "lightContext": true
    },
    "delivery": {
      "mode": "announce",
      "channel": "discord",
      "to": "channel:1467174412615942186"
    }
  },
  {
    "jobId": "sterling-session-close",
    "agentId": "sterling",
    "name": "Sterling closes set-and-forget window noon ET",
    "enabled": true,
    "schedule": {
      "kind": "cron",
      "expr": "0 12 * * 1-5",
      "tz": "America/New_York"
    },
    "sessionTarget": "isolated",
    "payload": {
      "kind": "agentTurn",
      "message": "Noon ET. You are Sterling. 4-hour window closing...",
      "lightContext": true
    },
    "delivery": {
      "mode": "announce",
      "channel": "discord",
      "to": "channel:1467174412615942186"
    }
  },
  {
    "jobId": "sterling-forex-scan",
    "agentId": "sterling",
    "name": "Sterling FX scan every 2 hours weekdays",
    "enabled": true,
    "schedule": {
      "kind": "cron",
      "expr": "0 */2 * * 1-5",
      "tz": "America/New_York"
    },
    "sessionTarget": "isolated",
    "payload": {
      "kind": "agentTurn",
      "message": "You are Sterling. 2-hour FX scan...",
      "lightContext": true
    },
    "delivery": {
      "mode": "announce",
      "channel": "discord",
      "to": "channel:1467174412615942186"
    }
  },
  {
    "jobId": "bitcoin-bob-watch",
    "agentId": "bitcoin-bob",
    "name": "Bitcoin Bob 4-hour crypto scan",
    "enabled": true,
    "schedule": {
      "kind": "cron",
      "expr": "0 */4 * * *",
      "tz": "America/New_York"
    },
    "sessionTarget": "isolated",
    "payload": {
      "kind": "agentTurn",
      "message": "You are Bitcoin Bob. 4-hour scan...",
      "lightContext": true
    },
    "delivery": {
      "mode": "announce",
      "channel": "discord",
      "to": "channel:1467174512377200640"
    }
  },
  {
    "jobId": "eod-arbiter-grade",
    "agentId": "arbiter",
    "name": "EOD trade grading 4:15 PM ET",
    "enabled": true,
    "schedule": {
      "kind": "cron",
      "expr": "15 16 * * 1-5",
      "tz": "America/New_York"
    },
    "sessionTarget": "isolated",
    "payload": {
      "kind": "agentTurn",
      "message": "Market closed. You are The Arbiter...",
      "lightContext": true
    },
    "delivery": {
      "mode": "announce",
      "channel": "discord",
      "to": "channel:1465522015095099549"
    }
  },
  {
    "jobId": "eod-ops-audit",
    "agentId": "ops",
    "name": "EOD risk audit 4:30 PM ET",
    "enabled": true,
    "schedule": {
      "kind": "cron",
      "expr": "30 16 * * 1-5",
      "tz": "America/New_York"
    },
    "sessionTarget": "isolated",
    "payload": {
      "kind": "agentTurn",
      "message": "Market closed. You are Ops...",
      "lightContext": true
    },
    "delivery": {
      "mode": "announce",
      "channel": "discord",
      "to": "channel:1465522015095099549"
    }
  }
]
```

### OpenClaw Main Config

**File**: `/root/.openclaw/openclaw.json`

```json
{
  "cron": {
    "enabled": true,
    "maxConcurrentRuns": 3,
    "sessionRetention": "48h",
    "runLog": {
      "maxBytes": "5mb",
      "keepLines": 5000
    }
  },
  "gateway": {
    "mode": "local",
    "auth": {
      "token": "${OPENCLAW_GATEWAY_TOKEN}"
    },
    "bind": "loopback",
    "port": 3001
  }
}
```

### PM2 Ecosystem Config

**File**: `scripts/ecosystem.config.js`

```javascript
module.exports = {
    apps: [
        {
            name: 'AK-Dashboard',
            script: 'node_modules/.bin/next',
            args: 'start',
            cwd: ROOT,
            env: { PORT: 3000 },
            autorestart: true,
            max_memory_restart: '800M'
        },
        {
            name: 'AK-Runner',
            script: 'npx',
            args: 'tsx scripts/agent_runner.ts',
            cwd: ROOT,
            autorestart: true,
            max_restarts: 50,
            restart_delay: 10000
        }
    ]
};
```

### Linux System Cron (Recommended)

**File**: `/etc/cron.d/swjshak`

```bash
# SwjshAK System Maintenance Cron Jobs
# All times in server timezone (America/New_York)

SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
MAILTO=root

# Backup journal.db daily at 2 AM
0 2 * * * root cp /root/SwjshAlgoKnife/journal.db /root/backups/journal_$(date +\%Y\%m\%d).db

# Cleanup old backups weekly (keep last 30 days)
0 3 * * 0 root find /root/backups -name "journal_*.db" -mtime +30 -delete

# Docker log cleanup weekly
0 4 * * 0 root truncate -s 0 /var/lib/docker/containers/*/*-json.log

# Check disk space daily
0 6 * * * root df -h / >> /var/log/disk_usage.log

# System updates check weekly (no auto-install)
0 5 * * 6 root apt-get update && apt-get --just-print upgrade >> /var/log/apt_updates.log
```

### Windows Brain Sync Task

Created via PowerShell script `scripts/setup-brain-sync-task.ps1`:

```powershell
$trigger = New-ScheduledTaskTrigger -Daily -At '6:00AM'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$SyncScript`""
Register-ScheduledTask -TaskName 'SwjshAK-BrainSync' -Trigger $trigger -Action $action
```

---

## Monitoring and Debugging

### OpenClaw Cron Debugging

```bash
# List all jobs and their status
openclaw cron list --json | jq '.'

# View next run times
openclaw cron list | grep -E "name|nextRun"

# View run history for a job
cat ~/.openclaw/cron/runs/<jobId>.jsonl | tail -10

# Watch Gateway logs in real-time
journalctl -u openclaw -f

# Manual test run
openclaw cron run <jobId>

# Check if jobs file is valid JSON
cat ~/.openclaw/cron/jobs.json | jq .
```

### n8n Debugging

```bash
# Check n8n status
docker ps | grep n8n
curl http://localhost:5678/healthz

# View recent executions
curl -X GET "http://localhost:5678/api/v1/executions?limit=10" \
  -H "X-N8N-API-KEY: $N8N_API_KEY"

# View n8n logs
docker logs n8n --tail 100 -f

# Check workflow active status
curl -X GET "http://localhost:5678/api/v1/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" | jq '.data[] | {id, name, active}'
```

### Windows Task Scheduler Debugging

```powershell
# Check task status
schtasks /query /tn SwjshAK-BrainSync /v /fo LIST

# View last run result
Get-ScheduledTaskInfo -TaskName SwjshAK-BrainSync

# Check event log for task history
Get-WinEvent -LogName Microsoft-Windows-TaskScheduler/Operational -MaxEvents 20

# Force run for testing
schtasks /run /tn SwjshAK-BrainSync
```

### Linux Cron Debugging

```bash
# Check cron service status
systemctl status cron

# View cron logs
grep CRON /var/log/syslog | tail -50

# List all cron jobs for root
crontab -l

# Test cron expression
# Use https://crontab.guru/

# Check if cron file is loaded
ls -la /etc/cron.d/
cat /etc/cron.d/swjshak
```

### PM2 Debugging

```bash
# Check process status
pm2 status
pm2 list

# View logs
pm2 logs AK-Runner --lines 100

# Check for restarts
pm2 show AK-Runner | grep restarts

# Monitor in real-time
pm2 monit
```

### Health Check Script

Create a script to check all scheduling systems:

```bash
#!/bin/bash
# /root/SwjshAlgoKnife/scripts/check-cron-health.sh

echo "=== CRON HEALTH CHECK ==="
echo ""

echo "1. OpenClaw Cron Jobs:"
openclaw cron list 2>/dev/null | head -20 || echo "OpenClaw not running"

echo ""
echo "2. n8n Status:"
curl -s http://localhost:5678/healthz 2>/dev/null || echo "n8n not reachable"

echo ""
echo "3. PM2 Processes:"
pm2 list 2>/dev/null || echo "PM2 not running"

echo ""
echo "4. System Cron Jobs:"
cat /etc/cron.d/swjshak 2>/dev/null || echo "No swjshak cron file"

echo ""
echo "5. Last Cron Executions:"
grep CRON /var/log/syslog 2>/dev/null | tail -5 || echo "No recent cron logs"

echo ""
echo "=== END HEALTH CHECK ==="
```

---

## Appendix: Cron Expression Reference

### Standard 5-Field Cron

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-7, 0 & 7 = Sunday)
│ │ │ │ │
* * * * *
```

### Special Characters

| Character | Meaning | Example |
|-----------|---------|---------|
| `*` | Any value | `* * * * *` = every minute |
| `,` | List | `1,15,30 * * * *` = at :01, :15, :30 |
| `-` | Range | `9-17 * * * *` = hours 9 through 17 |
| `/` | Step | `*/15 * * * *` = every 15 minutes |
| `L` | Last | `0 0 L * *` = last day of month (some systems) |

### Common Expressions

| Expression | Meaning |
|------------|---------|
| `0 * * * *` | Every hour at :00 |
| `*/5 * * * *` | Every 5 minutes |
| `0 9 * * 1-5` | 9 AM Mon-Fri |
| `30 8 * * 1-5` | 8:30 AM Mon-Fri |
| `0 */4 * * *` | Every 4 hours |
| `0 9-17 * * 1-5` | Every hour, 9 AM-5 PM, Mon-Fri |
| `*/30 9-16 * * 1-5` | Every 30 min, 9 AM-4 PM, Mon-Fri |
| `0 18 * * 0` | Sunday at 6 PM |
| `0 0 1 * *` | First day of month at midnight |
| `0 0 * * 0` | Every Sunday at midnight |

### n8n Month Gotcha

**Warning**: n8n uses 0-indexed months (0=January, 11=December)

| Month | Standard | n8n |
|-------|----------|-----|
| January | 1 | 0 |
| December | 12 | 11 |

---

## Sources

- [OpenClaw Cron Jobs Documentation](https://docs.openclaw.ai/automation/cron-jobs)
- [n8n Schedule Trigger Documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/)
- [Crontab Guru](https://crontab.guru/) - Cron expression validator
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)

---

*Created by Claude Opus 4.5 - 2026-03-20*
