# Claude Autonomous Setup Handoff

> **Created**: 2026-03-20
> **Purpose**: Complete instructions for a future Claude Code session to autonomously set up the SwjshAK autonomous trading system on Contabo VPS
> **Jack Status**: SLEEPING - Do not ask questions. Make decisions autonomously.

---

## Table of Contents

1. [Mission Brief](#section-1-mission-brief)
2. [Pre-Flight Checklist](#section-2-pre-flight-checklist)
3. [Phase 1: Server Setup](#section-3-phase-1---server-setup-ssh-tasks)
4. [Phase 2: OpenClaw Configuration](#section-4-phase-2---openclaw-configuration)
5. [Phase 3: n8n Integration](#section-5-phase-3---n8n-integration)
6. [Phase 4: Discord Setup](#section-6-phase-4---discord-integration)
7. [Phase 5: Integration Testing](#section-7-phase-5---integration-testing-btsc-tdd)
8. [Verification Checklist](#section-8-verification-checklist)
9. [Troubleshooting Guide](#section-9-troubleshooting-guide)
10. [Rollback Procedures](#section-10-rollback-procedures)
11. [Success Criteria](#section-11-success-criteria)

---

## Section 1: Mission Brief

### What We Are Building

**SwjshAK** is an autonomous AI-powered algorithmic trading platform with:

- **6 Management Agents** (Discord bots via OpenClaw)
  - Chief (MGMT) - Orchestrator, CEO assistant, decision engine
  - Arbiter (GRADE) - Trade grader (A-F system), lesson extraction
  - Ops (PULSE) - System health, risk monitoring, kill switch authority
  - Hunter (INFRA) - Codebase improvements, bug fixes, tech debt
  - Cortana (LEARN) - Backlog triage, skill development, research
  - Scout (BACK) - Revenue generation, new opportunities, monetization

- **5 Trading Agents** (Python engines)
  - Sterling FX - Forex (GBP/USD, EUR/USD)
  - Bitcoin Bob - Crypto (BTC/ETH/SOL)
  - Pivot Pete - Futures (ES, NQ)
  - Boba - Options (SPY, QQQ)
  - SPX Sniper - 0DTE SPX options

- **OpenClaw** as the AI agent orchestration layer
  - Manages agent identities via SOUL.md files
  - Routes Discord messages to correct agents
  - Executes scheduled cron jobs (15 jobs defined)
  - Provides webhook endpoints for n8n integration

- **n8n** as the automation workflow engine (**18 workflows DEPLOYED**)
  - 8 Operational/Reactive workflows (standup, briefings, trade grading, incident response)
  - 10 Self-Improvement workflows (tech debt, health monitoring, strategy tuning, backlog grooming)
  - 534 total nodes across all workflows
  - Connects TradingView signals to agents
  - Orchestrates trade lifecycle
  - Collects market intelligence
  - Manages error recovery and self-healing

### Current State

**DEPLOYED**:
- n8n container running at `http://209.145.55.101:5678`
  - Username: `admin`
  - Password: `3rZsBt21c3BWck6DHm20v7JfibU0NXX7`
- SwjshAlgoKnife repo cloned at `/root/SwjshAlgoKnife`
- OpenClaw installed globally (`npm install -g openclaw@latest`)
- Config files exist at `/root/.openclaw/`

**NOT YET VERIFIED/CONFIGURED**:
- OpenClaw gateway not confirmed running
- Cron jobs not verified loaded
- Discord bot connection not verified
- ✅ n8n workflows IMPORTED (18 workflows, 534 nodes - 2026-03-20)
- n8n credentials need configuration (Jira, Discord, Anthropic API)
- n8n-to-OpenClaw integration not wired
- Agent SOUL files may need deployment

### End Goal

A fully operational autonomous trading system where:
1. Chief posts morning briefing to Discord at 8 AM ET
2. Agents scan markets and post alerts to their channels
3. Trade signals flow from TradingView through n8n to OpenClaw agents
4. Arbiter grades every closed trade
5. Ops monitors risk and can trigger kill switch
6. System Builder audits and improves the brain every 3 hours
7. Weekly Evolution Engine updates strategies based on learned patterns

---

## Section 2: Pre-Flight Checklist

### Required Credentials (verify presence, never log values)

```bash
# SSH into server
ssh root@209.145.55.101
# Password: StronkPasswerd

# Verify OpenClaw credentials exist
cat /root/.openclaw/.env 2>/dev/null | grep -c "REPLACE_ME" && echo "WARNING: Placeholders exist" || echo "Credentials populated"

# Required in /root/.openclaw/.env:
# - ANTHROPIC_API_KEY (must be real, not placeholder)
# - DISCORD_BOT_TOKEN (must be real, not placeholder)
# - OPENCLAW_GATEWAY_TOKEN (can be generated: openssl rand -hex 32)
```

### Files to Read for Context

Before starting any phase, read these files to understand current state:

1. **OpenClaw Configuration**:
   - `/root/.openclaw/openclaw.json` - Main config
   - `/root/.openclaw/cron/jobs.json` - Scheduled jobs
   - `/root/.openclaw/workspace/SOUL.md` - Chief's identity

2. **n8n Status**:
   - Run `docker ps | grep n8n` to verify container running
   - Access `http://209.145.55.101:5678` to verify UI accessible

3. **Project Structure**:
   - `/root/SwjshAlgoKnife/` - Main project directory
   - `/root/SwjshAlgoKnife/data/brain/` - AI brain files (18 markdown files)
   - `/root/SwjshAlgoKnife/journal.db` - Trade database

### SSH Connection

```bash
# Primary method
ssh root@209.145.55.101

# If prompted for password
StronkPasswerd
```

---

## Section 3: Phase 1 - Server Setup (SSH Tasks)

### Task 1.1: Verify System Prerequisites

**Objective**: Confirm all required software is installed and running

```bash
# Run these commands and verify output
uname -a                    # Should show Linux
node --version              # Should show v20+ or v22+
npm --version               # Should show 9+ or 10+
python3 --version           # Should show 3.10+
git --version               # Should show git installed
docker --version            # Should show Docker installed
docker ps                   # Should show containers (at minimum n8n)

# Verify timezone
timedatectl | grep "Time zone"  # Should show America/New_York
```

**If timezone is wrong**:
```bash
timedatectl set-timezone America/New_York
```

**Expected Output**: All tools installed, timezone set to ET.

---

### Task 1.2: Verify n8n Status

**Objective**: Confirm n8n is running and accessible

```bash
# Check container status
docker ps | grep n8n

# Expected output should include:
# n8nio/n8n:latest ... Up ... 5678->5678

# Check n8n health
curl -s http://localhost:5678/healthz && echo " - n8n healthy"

# Check n8n logs for errors
docker logs n8n --tail 20
```

**If n8n is not running**:
```bash
cd /root/n8n
docker compose up -d
sleep 10
docker ps | grep n8n
```

**If n8n directory doesn't exist**: Run the setup script from the repo:
```bash
bash /root/SwjshAlgoKnife/n8n-setup/setup_n8n_contabo.sh
```

---

### Task 1.3: Verify OpenClaw Installation

**Objective**: Confirm OpenClaw is installed and discover correct CLI commands

```bash
# Check version
openclaw --version

# Get help to discover available commands
openclaw --help

# Try common subcommand patterns
openclaw gateway --help 2>/dev/null || echo "No 'gateway' subcommand"
openclaw cron --help 2>/dev/null || echo "No 'cron' subcommand"
openclaw start --help 2>/dev/null || echo "No 'start' subcommand"
```

**Document the correct commands**: The CLI has evolved. Record which commands work:
- Start gateway: `openclaw gateway` OR `openclaw serve` OR `openclaw run`
- List cron jobs: `openclaw cron list` OR `openclaw cron:list`
- Run cron job: `openclaw cron run <jobId>` OR `openclaw cron:run <jobId>`

---

### Task 1.4: Verify OpenClaw Configuration

**Objective**: Ensure config files are valid and complete

```bash
# Check config JSON is valid
cat /root/.openclaw/openclaw.json | python3 -m json.tool > /dev/null && \
  echo "openclaw.json: VALID" || echo "openclaw.json: INVALID JSON"

# Check cron jobs JSON is valid
cat /root/.openclaw/cron/jobs.json | python3 -m json.tool > /dev/null && \
  echo "cron/jobs.json: VALID" || echo "cron/jobs.json: INVALID JSON"

# Verify gateway mode is set (REQUIRED)
grep -q '"mode": "local"' /root/.openclaw/openclaw.json && \
  echo "Gateway mode: CORRECT (local)" || echo "ERROR: Gateway mode not set to local"

# Check credentials have real values (not placeholders)
grep -c "REPLACE_ME\|YOUR_\|your-" /root/.openclaw/.env 2>/dev/null && \
  echo "WARNING: Placeholder values found in .env" || echo ".env: No placeholders found"
```

**If gateway mode is missing**: Add `"mode": "local"` to the gateway section:
```bash
# This is the most common startup failure cause
python3 -c "
import json
with open('/root/.openclaw/openclaw.json', 'r') as f:
    config = json.load(f)
if 'gateway' not in config:
    config['gateway'] = {}
config['gateway']['mode'] = 'local'
with open('/root/.openclaw/openclaw.json', 'w') as f:
    json.dump(config, f, indent=2)
print('Gateway mode set to local')
"
```

---

### Task 1.5: Deploy Agent SOUL Files

**Objective**: Copy agent identity files to OpenClaw workspace directories

```bash
# Create agent directories if they don't exist
mkdir -p /root/.openclaw/agents/{overseer,professor,auditor,sterling,bitcoin-bob,pivot-pete,boba,spx-sniper}

# Copy SOUL files from repo to OpenClaw
cp /root/SwjshAlgoKnife/openclaw-setup/agents/*/SOUL.md /root/.openclaw/agents/ 2>/dev/null || \
  echo "Attempting individual copies..."

# Copy each agent's SOUL file
for agent in overseer professor auditor sterling bitcoin-bob pivot-pete boba spx-sniper; do
  if [ -f "/root/SwjshAlgoKnife/openclaw-setup/agents/$agent/SOUL.md" ]; then
    mkdir -p "/root/.openclaw/agents/$agent"
    cp "/root/SwjshAlgoKnife/openclaw-setup/agents/$agent/SOUL.md" "/root/.openclaw/agents/$agent/"
    echo "Copied SOUL for $agent"
  else
    echo "WARNING: No SOUL.md found for $agent"
  fi
done

# Copy Chief's workspace files
cp /root/SwjshAlgoKnife/openclaw-setup/workspace/*.md /root/.openclaw/workspace/

# Verify all SOUL files exist
echo "=== SOUL File Verification ==="
ls -la /root/.openclaw/workspace/SOUL.md
for agent in overseer professor auditor sterling bitcoin-bob pivot-pete boba spx-sniper; do
  ls -la "/root/.openclaw/agents/$agent/SOUL.md" 2>/dev/null || echo "MISSING: $agent/SOUL.md"
done
```

---

### Task 1.6: Deploy Cron Jobs

**Objective**: Install the 15 scheduled cron jobs

```bash
# Create cron directory if it doesn't exist
mkdir -p /root/.openclaw/cron

# Copy Contabo-specific cron jobs
cp /root/SwjshAlgoKnife/openclaw-setup/cron-jobs-contabo.json /root/.openclaw/cron/jobs.json

# Verify jobs are valid JSON and count them
python3 -c "
import json
with open('/root/.openclaw/cron/jobs.json', 'r') as f:
    jobs = json.load(f)
print(f'Loaded {len(jobs)} cron jobs:')
for job in jobs:
    print(f\"  {job['jobId']}: {job['schedule'].get('expr', 'N/A')} ({job.get('agentId', 'chief')})\")
"
```

**Expected output**: 15 cron jobs listed including:
- `chief-decision-loop` - Every 30 min during market hours
- `system-builder` - Every 3 hours
- `morning-briefing` - 8 AM ET weekdays
- `eod-arbiter-grade` - 4:15 PM ET weekdays
- `eod-ops-audit` - 4:30 PM ET weekdays
- Plus 10 more scheduled jobs

---

### Task 1.7: Create systemd Service

**Objective**: Set up OpenClaw as a system service for auto-restart

First, determine the correct start command from Task 1.3. Then:

```bash
# Create systemd service file
# IMPORTANT: Replace 'openclaw gateway' with the correct command if different
cat > /etc/systemd/system/openclaw.service << 'EOF'
[Unit]
Description=OpenClaw AI Agent Gateway
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/.openclaw
Environment="HOME=/root"
Environment="NODE_ENV=production"
EnvironmentFile=/root/.openclaw/.env
ExecStart=/usr/bin/openclaw gateway
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
systemctl daemon-reload
systemctl enable openclaw
```

**Do NOT start the service yet** - we need to verify credentials first.

---

## Section 4: Phase 2 - OpenClaw Configuration

### Task 2.1: Verify Credentials

**Objective**: Ensure all required API keys are present (without exposing values)

```bash
# Check .env file has required keys
echo "=== Credential Check ==="
grep -q "ANTHROPIC_API_KEY=" /root/.openclaw/.env && \
  echo "ANTHROPIC_API_KEY: Present" || echo "ANTHROPIC_API_KEY: MISSING"
grep -q "DISCORD_BOT_TOKEN=" /root/.openclaw/.env && \
  echo "DISCORD_BOT_TOKEN: Present" || echo "DISCORD_BOT_TOKEN: MISSING"
grep -q "OPENCLAW_GATEWAY_TOKEN=" /root/.openclaw/.env && \
  echo "OPENCLAW_GATEWAY_TOKEN: Present" || echo "OPENCLAW_GATEWAY_TOKEN: MISSING"

# Check for placeholder values
grep "REPLACE_ME\|sk-ant-EXAMPLE\|your-token" /root/.openclaw/.env && \
  echo "WARNING: Placeholder values found - need real credentials" || \
  echo "No obvious placeholders found"

# Generate gateway token if missing
if ! grep -q "OPENCLAW_GATEWAY_TOKEN=" /root/.openclaw/.env; then
  TOKEN=$(openssl rand -hex 32)
  echo "OPENCLAW_GATEWAY_TOKEN=$TOKEN" >> /root/.openclaw/.env
  echo "Generated new gateway token"
fi
```

**If ANTHROPIC_API_KEY is missing or placeholder**: This is a BLOCKER. The system cannot function without it. Log this and proceed with other tasks.

**If DISCORD_BOT_TOKEN is missing or placeholder**: Discord integration will fail. Log this as a warning.

---

### Task 2.2: Start OpenClaw Gateway

**Objective**: Start the gateway and verify it's running

```bash
# Start the service
systemctl start openclaw

# Wait for startup
sleep 5

# Check status
systemctl status openclaw

# Check if gateway is listening on port 3001
ss -tlnp | grep 3001 || netstat -tlnp | grep 3001

# Check logs for startup success
journalctl -u openclaw --no-pager -n 30
```

**Success indicators**:
- Service shows `active (running)`
- Port 3001 is listening
- Logs show "Gateway started" or similar

**Common failures**:
- "Gateway start blocked: set gateway.mode=local" - Fix in Task 1.4
- "Invalid API key" - ANTHROPIC_API_KEY is wrong
- "Failed to connect to Discord" - DISCORD_BOT_TOKEN is wrong or bot not invited to server

---

### Task 2.3: Verify Discord Connection

**Objective**: Confirm OpenClaw connected to Discord

```bash
# Check logs for Discord connection
journalctl -u openclaw --no-pager | grep -i discord | tail -10

# Look for success messages like:
# "Connected to Discord"
# "Logged in as <bot_name>"
# "Joined guild 340322473276997632"
```

**If Discord connection fails**:
1. Verify bot token is correct
2. Verify bot has been invited to server with guild ID `340322473276997632`
3. Verify bot has Message Content Intent enabled in Discord Developer Portal
4. Check these channel IDs are accessible:
   - Chief: `1465522015095099549`
   - Forex: `1467174412615942186`
   - Crypto: `1467174512377200640`

---

### Task 2.4: Verify Cron Jobs Loaded

**Objective**: Confirm all 15 cron jobs are scheduled

```bash
# Use the correct command discovered in Task 1.3
# Try these variations:
openclaw cron list 2>/dev/null || \
openclaw cron:list 2>/dev/null || \
openclaw jobs list 2>/dev/null || \
echo "Could not find cron list command"

# Alternative: Check the jobs.json directly
python3 -c "
import json
with open('/root/.openclaw/cron/jobs.json', 'r') as f:
    jobs = json.load(f)
enabled = sum(1 for j in jobs if j.get('enabled', False))
disabled = len(jobs) - enabled
print(f'Total jobs: {len(jobs)}')
print(f'Enabled: {enabled}')
print(f'Disabled: {disabled}')
"
```

---

### Task 2.5: Test Manual Cron Trigger

**Objective**: Verify agents can execute by manually triggering a job

```bash
# Try to manually run the morning briefing
# Use the correct command discovered in Task 1.3
openclaw cron run morning-briefing 2>/dev/null || \
openclaw cron:run morning-briefing 2>/dev/null || \
echo "Could not find cron run command"

# Watch the logs for execution
journalctl -u openclaw --no-pager -n 50 | tail -20
```

**Success indicators**:
- Job starts executing
- Agent reads brain files
- Message posts to Discord #chief-main channel
- No errors in logs

---

## Section 5: Phase 3 - n8n Integration

### Task 3.1: Generate n8n API Key

**Objective**: Create API key for Claude Code to manage n8n workflows

This must be done manually in the n8n UI:

1. Open `http://209.145.55.101:5678` in browser
2. Login with: admin / 3rZsBt21c3BWck6DHm20v7JfibU0NXX7
3. Click user icon (top right) -> Settings
4. Go to API -> Create new API key
5. Name it "claude-mcp" and copy the key

**Store the API key** in `/root/.openclaw/.env`:
```bash
echo "N8N_API_KEY=<paste_key_here>" >> /root/.openclaw/.env
```

---

### Task 3.2: Create n8n Credentials for OpenClaw

**Objective**: Store OpenClaw webhook credentials in n8n

In n8n UI:
1. Go to Credentials -> Add Credential
2. Create "Header Auth" credential:
   - Name: `OpenClaw Webhook`
   - Header Name: `Authorization`
   - Header Value: `Bearer ${OPENCLAW_GATEWAY_TOKEN}` (get actual value from /root/.openclaw/.env)

---

### Task 3.3: Import Foundation Workflows

**Objective**: Deploy the critical workflows first

The workflow JSONs need to be created and imported. Key workflows for Phase 1:

**WF-001: System Heartbeat Monitor**
```json
{
  "name": "System Heartbeat Monitor",
  "nodes": [
    {
      "name": "Every 60 Seconds",
      "type": "n8n-nodes-base.scheduleTrigger",
      "parameters": {
        "rule": { "interval": [{ "field": "seconds", "secondsInterval": 60 }] }
      },
      "position": [0, 0]
    },
    {
      "name": "Check SwjshAK API",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "http://localhost:3000/api/control",
        "method": "GET"
      },
      "position": [220, 0]
    },
    {
      "name": "Check OpenClaw Gateway",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "http://localhost:3001/health",
        "method": "GET",
        "options": { "timeout": 5000 }
      },
      "position": [440, 0]
    }
  ],
  "connections": {
    "Every 60 Seconds": {
      "main": [[{ "node": "Check SwjshAK API", "type": "main", "index": 0 }]]
    },
    "Check SwjshAK API": {
      "main": [[{ "node": "Check OpenClaw Gateway", "type": "main", "index": 0 }]]
    }
  }
}
```

**Import via n8n API**:
```bash
# Get n8n API key
N8N_API_KEY=$(grep N8N_API_KEY /root/.openclaw/.env | cut -d= -f2)

# Import workflow
curl -X POST http://localhost:5678/api/v1/workflows \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/root/SwjshAlgoKnife/n8n-workflows/operational/heartbeat-monitor.json
```

---

### Task 3.4: Create TradingView Signal Router Workflow

**Objective**: Wire TradingView alerts to OpenClaw agents

This workflow:
1. Receives webhook from TradingView
2. Routes based on symbol/strategy
3. Calls OpenClaw agent via webhook

```bash
# Create the workflow JSON
cat > /tmp/tradingview-router.json << 'EOF'
{
  "name": "TradingView Signal Router",
  "nodes": [
    {
      "name": "TradingView Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "tradingview-signal",
        "httpMethod": "POST",
        "responseMode": "onReceived"
      },
      "position": [0, 0]
    },
    {
      "name": "Route by Symbol",
      "type": "n8n-nodes-base.switch",
      "parameters": {
        "rules": {
          "rules": [
            {
              "value1": "={{ $json.symbol }}",
              "operation": "contains",
              "value2": "USD"
            },
            {
              "value1": "={{ $json.symbol }}",
              "operation": "contains",
              "value2": "BTC"
            },
            {
              "value1": "={{ $json.symbol }}",
              "operation": "equal",
              "value2": "SPY"
            }
          ]
        }
      },
      "position": [220, 0]
    },
    {
      "name": "Call Sterling Agent",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "http://localhost:3001/hooks/agent",
        "method": "POST",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "body": {
          "agentId": "sterling",
          "message": "TradingView alert: {{ $json.symbol }} {{ $json.action }} at {{ $json.price }}",
          "sessionKey": "hook:tradingview:fx",
          "deliver": true,
          "channel": "discord",
          "to": "channel:1467174412615942186"
        }
      },
      "position": [440, -100]
    },
    {
      "name": "Call Bitcoin Bob",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "http://localhost:3001/hooks/agent",
        "method": "POST",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "body": {
          "agentId": "bitcoin-bob",
          "message": "TradingView alert: {{ $json.symbol }} {{ $json.action }} at {{ $json.price }}",
          "sessionKey": "hook:tradingview:crypto",
          "deliver": true,
          "channel": "discord",
          "to": "channel:1467174512377200640"
        }
      },
      "position": [440, 0]
    },
    {
      "name": "Call Boba Agent",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "http://localhost:3001/hooks/agent",
        "method": "POST",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "body": {
          "agentId": "boba",
          "message": "TradingView alert: {{ $json.symbol }} {{ $json.action }} at {{ $json.price }}",
          "sessionKey": "hook:tradingview:options",
          "deliver": true,
          "channel": "discord",
          "to": "channel:1465522015095099549"
        }
      },
      "position": [440, 100]
    }
  ],
  "connections": {
    "TradingView Webhook": {
      "main": [[{ "node": "Route by Symbol", "type": "main", "index": 0 }]]
    },
    "Route by Symbol": {
      "main": [
        [{ "node": "Call Sterling Agent", "type": "main", "index": 0 }],
        [{ "node": "Call Bitcoin Bob", "type": "main", "index": 0 }],
        [{ "node": "Call Boba Agent", "type": "main", "index": 0 }]
      ]
    }
  }
}
EOF

# Import to n8n
N8N_API_KEY=$(grep N8N_API_KEY /root/.openclaw/.env | cut -d= -f2)
curl -X POST http://localhost:5678/api/v1/workflows \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/tradingview-router.json
```

---

## Section 6: Phase 4 - Discord Integration

### Task 4.1: Verify Discord Bot Permissions

**Objective**: Ensure bot can read/write to all required channels

The Discord bot needs these permissions:
- View Channels
- Send Messages
- Read Message History
- Embed Links
- Attach Files

**Required Channel IDs**:
| Channel | ID | Purpose |
|---------|-----|---------|
| #chief-main | 1465522015095099549 | Chief orchestrator, system alerts |
| #forex | 1467174412615942186 | Sterling FX agent |
| #crypto | 1467174512377200640 | Bitcoin Bob agent |

**Guild (Server) ID**: 340322473276997632

---

### Task 4.2: Create Discord Webhooks for n8n

**Objective**: Create outbound webhooks for n8n to post to Discord

Discord webhooks are different from the bot - they allow n8n to post directly without going through OpenClaw.

In Discord:
1. For each channel, go to Settings -> Integrations -> Webhooks
2. Create a webhook named "n8n-alerts"
3. Copy the webhook URL

Store in n8n credentials:
1. Go to n8n Credentials
2. Create "Discord Webhook" credential for each channel
3. Paste the webhook URL

---

### Task 4.3: Test Discord Posting via OpenClaw

**Objective**: Verify OpenClaw can post to Discord

```bash
# Get the gateway token
OPENCLAW_TOKEN=$(grep OPENCLAW_GATEWAY_TOKEN /root/.openclaw/.env | cut -d= -f2)

# Test posting via webhook
curl -X POST http://localhost:3001/hooks/agent \
  -H "Authorization: Bearer $OPENCLAW_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test message from Claude setup script",
    "agentId": "chief",
    "deliver": true,
    "channel": "discord",
    "to": "channel:1465522015095099549"
  }'
```

**Success**: Message appears in #chief-main channel
**Failure**: Check OpenClaw logs: `journalctl -u openclaw --no-pager -n 30`

---

## Section 7: Phase 5 - Integration Testing (/btsc TDD)

### Test-Driven Verification

Use the `/btsc` skill methodology for rigorous testing. Each test follows RED -> GREEN -> REFACTOR.

---

### Test Suite 1: Health Monitoring

**Test 1.1: OpenClaw Gateway Health**

```bash
# RED: Define the test
# Gateway should respond to health check within 2 seconds

# GREEN: Execute the test
response=$(curl -s -w "%{http_code}" -o /tmp/health.txt --max-time 2 http://localhost:3001/health)
if [ "$response" == "200" ]; then
  echo "PASS: Gateway health check returned 200"
else
  echo "FAIL: Gateway health check returned $response"
fi

# REFACTOR: If failed, check logs and fix
journalctl -u openclaw --no-pager -n 20
```

**Test 1.2: n8n Health**

```bash
# RED: n8n should respond to health check
response=$(curl -s -w "%{http_code}" -o /tmp/n8n_health.txt --max-time 2 http://localhost:5678/healthz)
if [ "$response" == "200" ]; then
  echo "PASS: n8n health check returned 200"
else
  echo "FAIL: n8n health check returned $response"
fi
```

---

### Test Suite 2: Agent Communication

**Test 2.1: OpenClaw Webhook Response**

```bash
# RED: Webhook should accept valid payload
OPENCLAW_TOKEN=$(grep OPENCLAW_GATEWAY_TOKEN /root/.openclaw/.env | cut -d= -f2)

response=$(curl -s -w "%{http_code}" -o /tmp/webhook_response.txt \
  -X POST http://localhost:3001/hooks/agent \
  -H "Authorization: Bearer $OPENCLAW_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Test", "agentId": "chief"}')

if [ "$response" == "200" ]; then
  echo "PASS: Webhook accepted payload"
else
  echo "FAIL: Webhook returned $response"
  cat /tmp/webhook_response.txt
fi
```

**Test 2.2: Agent Turn Execution**

```bash
# RED: Agent should process a turn and return response
OPENCLAW_TOKEN=$(grep OPENCLAW_GATEWAY_TOKEN /root/.openclaw/.env | cut -d= -f2)

curl -s -X POST http://localhost:3001/hooks/agent \
  -H "Authorization: Bearer $OPENCLAW_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Respond with exactly: TEST_PASSED",
    "agentId": "chief",
    "timeoutSeconds": 30
  }' | grep -q "TEST_PASSED" && echo "PASS: Agent responded" || echo "FAIL: No agent response"
```

---

### Test Suite 3: Cron Job Execution

**Test 3.1: Manual Cron Trigger**

```bash
# RED: Manually triggered cron job should execute
# GREEN: Run the job and check logs

# Find the correct command
openclaw cron run brain-integrity-check 2>/dev/null || \
openclaw cron:run brain-integrity-check 2>/dev/null

# Wait for execution
sleep 10

# Check logs for execution
journalctl -u openclaw --no-pager --since "1 minute ago" | grep -i "brain-integrity" && \
  echo "PASS: Cron job executed" || echo "FAIL: No cron execution in logs"
```

---

### Test Suite 4: End-to-End Flow

**Test 4.1: Full Signal Pipeline (simulated)**

```bash
# RED: Simulate a signal flowing through the system
# This tests: Webhook -> Agent -> Discord

OPENCLAW_TOKEN=$(grep OPENCLAW_GATEWAY_TOKEN /root/.openclaw/.env | cut -d= -f2)

# Send simulated TradingView signal
curl -s -X POST http://localhost:3001/hooks/agent \
  -H "Authorization: Bearer $OPENCLAW_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "SIMULATED SIGNAL: BTC/USD BUY at $50,000. This is a test. Do NOT execute.",
    "agentId": "bitcoin-bob",
    "sessionKey": "hook:test:signal",
    "deliver": true,
    "channel": "discord",
    "to": "channel:1467174512377200640"
  }'

echo "Check Discord #crypto channel for test message"
```

---

## Section 8: Verification Checklist

Run through this checklist and mark each item:

### Infrastructure
- [ ] Server timezone is America/New_York
- [ ] Node.js v20+ installed
- [ ] Docker running
- [ ] n8n container running on port 5678
- [ ] n8n UI accessible at http://209.145.55.101:5678

### OpenClaw
- [ ] OpenClaw installed (`openclaw --version` works)
- [ ] Gateway mode set to "local" in config
- [ ] Gateway service running (`systemctl status openclaw`)
- [ ] Gateway listening on port 3001
- [ ] ANTHROPIC_API_KEY populated (not placeholder)
- [ ] DISCORD_BOT_TOKEN populated (not placeholder)
- [ ] OPENCLAW_GATEWAY_TOKEN generated

### Agents
- [ ] Chief SOUL.md deployed to /root/.openclaw/workspace/
- [ ] All 8 agent SOUL.md files deployed to /root/.openclaw/agents/*/
- [ ] All 15 cron jobs in /root/.openclaw/cron/jobs.json

### Discord
- [ ] Bot connected to guild 340322473276997632
- [ ] Bot can see channel 1465522015095099549 (#chief-main)
- [ ] Bot can see channel 1467174412615942186 (#forex)
- [ ] Bot can see channel 1467174512377200640 (#crypto)
- [ ] Test message posted successfully to Discord

### n8n Integration
- [ ] n8n API key generated and stored
- [ ] OpenClaw webhook credential created in n8n
- [ ] At least one workflow imported and active

### End-to-End
- [ ] Manual cron job trigger works
- [ ] Agent webhook call returns response
- [ ] Message delivered to Discord
- [ ] No errors in OpenClaw logs for 10+ minutes

---

## Section 9: Troubleshooting Guide

### Problem: "Gateway start blocked: set gateway.mode=local"

**Cause**: Missing or incorrect gateway mode in config

**Fix**:
```bash
python3 -c "
import json
with open('/root/.openclaw/openclaw.json', 'r') as f:
    c = json.load(f)
c.setdefault('gateway', {})['mode'] = 'local'
with open('/root/.openclaw/openclaw.json', 'w') as f:
    json.dump(c, f, indent=2)
"
systemctl restart openclaw
```

---

### Problem: Discord bot not connecting

**Symptoms**: Logs show "Failed to connect to Discord" or "Invalid token"

**Fixes**:
1. Verify token is correct (not placeholder): `grep DISCORD_BOT_TOKEN /root/.openclaw/.env`
2. Verify bot is invited to server with correct permissions
3. Verify Message Content Intent is enabled in Discord Developer Portal
4. Check channel IDs match config

---

### Problem: Cron jobs not firing

**Symptoms**: Scheduled jobs don't run at expected times

**Fixes**:
1. Verify cron is enabled in config: `grep '"enabled": true' /root/.openclaw/openclaw.json`
2. Verify jobs.json is valid: `python3 -m json.tool /root/.openclaw/cron/jobs.json`
3. Check timezone matches (America/New_York)
4. Manually trigger a job to test: `openclaw cron run <jobId>`
5. Check logs: `journalctl -u openclaw --no-pager | grep -i cron`

---

### Problem: n8n can't reach OpenClaw

**Symptoms**: HTTP requests from n8n to localhost:3001 fail

**Fixes**:
1. Verify OpenClaw is running: `ss -tlnp | grep 3001`
2. Check n8n container networking - it runs in Docker, localhost may not work
3. Use Docker host IP instead: `docker network inspect bridge` and use gateway IP
4. Or add n8n to host network: `network_mode: host` in docker-compose

---

### Problem: Webhook authentication fails (401)

**Symptoms**: Calls to /hooks/agent return 401 Unauthorized

**Fixes**:
1. Verify token in header matches OPENCLAW_GATEWAY_TOKEN in .env
2. Use header format: `Authorization: Bearer <token>`
3. Do NOT use query string token (?token=...) - this is rejected
4. Check logs for specific auth error message

---

### Problem: Agent not responding

**Symptoms**: Webhook returns 200 but no agent output

**Fixes**:
1. Check ANTHROPIC_API_KEY is valid (not placeholder, not expired)
2. Check agent workspace exists: `ls /root/.openclaw/agents/<agentId>/`
3. Check agent is defined in config: `grep <agentId> /root/.openclaw/openclaw.json`
4. Check logs for API errors: `journalctl -u openclaw | grep -i error`

---

## Section 10: Rollback Procedures

### Disable All Workflows (n8n)

```bash
# List all workflows
N8N_API_KEY=$(grep N8N_API_KEY /root/.openclaw/.env | cut -d= -f2)
curl -s http://localhost:5678/api/v1/workflows -H "X-N8N-API-KEY: $N8N_API_KEY" | \
  python3 -c "import json,sys; [print(w['id']) for w in json.load(sys.stdin)['data']]"

# Deactivate a workflow by ID
curl -X PATCH http://localhost:5678/api/v1/workflows/<ID> \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active": false}'
```

### Stop OpenClaw

```bash
systemctl stop openclaw
systemctl disable openclaw
```

### Disable Cron Jobs Without Stopping Gateway

```bash
# Edit jobs.json and set enabled: false for all jobs
python3 -c "
import json
with open('/root/.openclaw/cron/jobs.json', 'r') as f:
    jobs = json.load(f)
for job in jobs:
    job['enabled'] = False
with open('/root/.openclaw/cron/jobs.json', 'w') as f:
    json.dump(jobs, f, indent=2)
print('All cron jobs disabled')
"
# Gateway will hot-reload the changes
```

### Restore Previous State

If the repo has config backups:
```bash
# Restore OpenClaw config
cp /root/SwjshAlgoKnife/openclaw-setup/chief-vps-backup/openclaw.json /root/.openclaw/
cp /root/SwjshAlgoKnife/openclaw-setup/chief-vps-backup/cron-jobs.json /root/.openclaw/cron/jobs.json

# Restart
systemctl restart openclaw
```

---

## Section 11: Success Criteria

### Minimum Viable Setup (required)

The setup is considered SUCCESSFUL when:

1. **OpenClaw Gateway Running**
   - `systemctl status openclaw` shows `active (running)`
   - Port 3001 is listening
   - No critical errors in last 30 minutes of logs

2. **Discord Connected**
   - Bot shows online in Discord
   - At least one test message posted to #chief-main

3. **Cron Jobs Loaded**
   - `openclaw cron list` shows 15 jobs (or equivalent command)
   - At least one job can be manually triggered

4. **n8n Running**
   - Container is up
   - UI is accessible
   - API key is generated

### Extended Success (nice to have)

Additional items that indicate a fully operational system:

5. **Morning Briefing Test**
   - Manual trigger of `morning-briefing` job
   - Chief reads brain files
   - Message posts to #chief-main with correct format

6. **n8n-OpenClaw Integration**
   - At least one workflow calling OpenClaw webhook
   - Successful end-to-end test

7. **Full Cron Schedule Active**
   - All 15 jobs enabled
   - Schedule verified for ET timezone

### Final Report

When setup is complete, create a status report:

```bash
echo "=== SwjshAK Setup Status Report ===" > /tmp/setup_report.txt
echo "Date: $(date)" >> /tmp/setup_report.txt
echo "" >> /tmp/setup_report.txt

echo "OpenClaw:" >> /tmp/setup_report.txt
systemctl is-active openclaw >> /tmp/setup_report.txt 2>&1
ss -tlnp | grep 3001 >> /tmp/setup_report.txt 2>&1

echo "" >> /tmp/setup_report.txt
echo "n8n:" >> /tmp/setup_report.txt
docker ps | grep n8n >> /tmp/setup_report.txt 2>&1

echo "" >> /tmp/setup_report.txt
echo "Cron Jobs:" >> /tmp/setup_report.txt
wc -l /root/.openclaw/cron/jobs.json >> /tmp/setup_report.txt 2>&1

echo "" >> /tmp/setup_report.txt
echo "Discord Test Result:" >> /tmp/setup_report.txt
echo "[Check #chief-main channel for test message]" >> /tmp/setup_report.txt

cat /tmp/setup_report.txt
```

Post this report to Discord #chief-main when complete.

---

## Appendix A: Critical File Locations

| File | Path | Purpose |
|------|------|---------|
| OpenClaw config | `/root/.openclaw/openclaw.json` | Main gateway configuration |
| OpenClaw credentials | `/root/.openclaw/.env` | API keys (never log values) |
| Cron jobs | `/root/.openclaw/cron/jobs.json` | Scheduled job definitions |
| Chief SOUL | `/root/.openclaw/workspace/SOUL.md` | Chief's identity |
| Agent SOULs | `/root/.openclaw/agents/*/SOUL.md` | Agent identities |
| n8n docker-compose | `/root/n8n/docker-compose.yml` | n8n container config |
| n8n credentials | `/root/n8n/.env` | n8n auth credentials |
| SwjshAK project | `/root/SwjshAlgoKnife/` | Main project root |
| Brain files | `/root/SwjshAlgoKnife/data/brain/` | AI decision context |
| Trade database | `/root/SwjshAlgoKnife/journal.db` | SQLite trade log |

---

## Appendix B: Discord Channel IDs

| Channel | ID | Agent |
|---------|-----|-------|
| #chief-main | 1465522015095099549 | Chief (orchestrator) |
| #forex | 1467174412615942186 | Sterling |
| #crypto | 1467174512377200640 | Bitcoin Bob |

Guild (Server) ID: `340322473276997632`

---

## Appendix C: Cron Job Schedule Summary

| Job ID | Schedule (ET) | Agent | Purpose |
|--------|---------------|-------|---------|
| chief-decision-loop | */30 9-16 * * 1-5 | Chief | Autonomous decisions during market hours |
| system-builder | 0 */3 * * * | Chief | Audit brain vs code |
| brain-integrity-check | 0 7 * * * | Chief | Daily brain health check |
| morning-briefing | 0 8 * * 1-5 | Chief | Pre-market brief |
| market-open-check | 30 9 * * 1-5 | Chief | NYSE open status |
| midday-check | 0 12 * * 1-5 | Chief | Midday review |
| eod-brain-update | 45 16 * * 1-5 | Chief | EOD brain update |
| eod-arbiter-grade | 15 16 * * 1-5 | Arbiter | Grade day's trades |
| eod-ops-audit | 30 16 * * 1-5 | Ops | Risk audit |
| london-open | 0 3 * * 1-5 | Sterling | London session |
| ny-overlap | 30 8 * * 1-5 | Sterling | NY-London overlap |
| sterling-session-close | 0 12 * * 1-5 | Sterling | FX session close |
| sterling-forex-scan | 0 */2 * * 1-5 | Sterling | 2-hour FX scan |
| bitcoin-bob-watch | 0 */4 * * * | Bitcoin Bob | 4-hour crypto scan |
| weekly-evolution-engine | 0 18 * * 0 | Chief | Weekly brain evolution |

---

*Document created by Claude for autonomous execution. Jack is sleeping. Make decisions. Get it done.*
