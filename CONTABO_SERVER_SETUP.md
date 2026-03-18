# Contabo VPS Full Server Setup

> **SUPERSEDED**: The deployment is now automated. Use `deploy-contabo.sh` instead of following this manual guide.
> For the Claude handoff prompt, see `CONTABO_CLAUDE_HANDOFF.md`.
>
> **SECURITY**: Server IP is stored in encrypted vault (`scripts/server_creds.py retrieve`). Never commit IPs to version control.

## Server Details
- **IP**: (see encrypted vault — `python scripts/server_creds.py retrieve`)
- **Type**: Cloud VPS 10 NVMe (4 vCPU, 8GB RAM, 75GB NVMe)
- **Location**: St. Louis (US-central)
- **OS**: Ubuntu 22.04
- **User**: root
- **SSH**: `ssh root@${SERVER_IP}`

---

## HANDOFF PROMPT — Copy this entire block to Claude CLI

```
You are deploying the SwjshAlgoKnife autonomous trading platform to a fresh Contabo VPS.
Server: root@${SERVER_IP} (Ubuntu 22.04, 4 vCPU, 8GB RAM, 75GB NVMe)

This is a COMPLETE autonomous trading system with:
- Next.js dashboard + API (port 3000)
- Agent Runner (master orchestrator spawning 5-6 Python trading agents)
- Watchdog (Python monitoring daemon, zero LLM cost)
- OpenClaw Gateway (Chief AI agent + 8 sub-agents + 15 cron jobs via Discord)
- Brain directory (self-healing, learning, decision logging)
- SQLite database for trades/signals/journal

## PHASE 1: SSH AND SECURE THE SERVER

SSH into the server:
ssh root@${SERVER_IP}

Run these commands in sequence:

### 1.1 System Update + Security Basics
apt update && apt upgrade -y
apt install -y ufw fail2ban curl wget git unzip htop

### 1.2 Firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp      # SSH
ufw allow 3000/tcp    # Dashboard
ufw --force enable

### 1.3 Create non-root user (optional but recommended)
adduser jackw
usermod -aG sudo jackw
# Copy SSH keys if set up
mkdir -p /home/jackw/.ssh
cp ~/.ssh/authorized_keys /home/jackw/.ssh/ 2>/dev/null || true
chown -R jackw:jackw /home/jackw/.ssh

### 1.4 Set timezone
timedatectl set-timezone America/New_York

## PHASE 2: INSTALL DEPENDENCIES

### 2.1 Docker (required)
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

### 2.2 Docker Compose (v2)
# Already included with modern Docker install, verify:
docker compose version

### 2.3 Node.js 20 (for running outside Docker if needed)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

### 2.4 Python 3 + pip
apt install -y python3 python3-pip python-is-python3
pip3 install --break-system-packages yfinance pandas numpy requests

### 2.5 OpenClaw binary
# Check latest release and install:
curl -fsSL https://get.openclaw.ai | sh
# Verify:
openclaw --version

## PHASE 3: CLONE AND CONFIGURE THE CODEBASE

### 3.1 Clone the repo
cd /home/jackw
git clone https://github.com/YOUR_REPO/SwjshAlgoKnife.git
cd SwjshAlgoKnife

### 3.2 Create .env.local
# IMPORTANT: User must fill in actual values. Create the file with placeholders:
cat > .env.local << 'ENVEOF'
# ============================================
# CORE
# ============================================
NODE_ENV=production
PORT=3000
WEBHOOK_SECRET=FILL_IN

# ============================================
# DATABASE
# ============================================
DATABASE_PATH=/app/data/journal.db
AGENTS_DB_PATH=/app/data/agents_db.json
DATA_DIR=/app/data

# ============================================
# ALPACA (Paper Trading)
# ============================================
APCA_API_KEY_ID=FILL_IN
APCA_API_SECRET_KEY=FILL_IN
APCA_API_BASE_URL=https://paper-api.alpaca.markets
APCA_DATA_URL=https://data.alpaca.markets
APCA_DATA_FEED=iex

# ============================================
# OANDA (Forex - Demo Account)
# ============================================
OANDA_API_TOKEN=FILL_IN
OANDA_ACCOUNT_ID=FILL_IN
OANDA_ENVIRONMENT=practice

# ============================================
# DISCORD (Agent Notifications)
# ============================================
DISCORD_BOT_TOKEN=FILL_IN
DISCORD_CHANNEL_ID=FILL_IN
DISCORD_CHIEF_WEBHOOK=FILL_IN

# ============================================
# OPENCLAW (AI Agent Orchestration)
# ============================================
ANTHROPIC_API_KEY=FILL_IN
OPENCLAW_GATEWAY_TOKEN=FILL_IN

# ============================================
# TRADING PARAMETERS
# ============================================
ACCOUNT_BALANCE=10000
RISK_PER_TRADE=1
ENVEOF

echo ">>> STOP HERE. Fill in all FILL_IN values with your actual API keys."
echo ">>> Use: nano .env.local"
echo ">>> Then continue to Phase 4."

## PHASE 4: CONFIGURE OPENCLAW

### 4.1 Create OpenClaw directory structure
mkdir -p /root/.openclaw/cron
mkdir -p /root/.openclaw/workspace
mkdir -p /root/.openclaw/agents/{overseer,professor,auditor,sterling,bitcoin-bob,pivot-pete,boba,spx-sniper}

### 4.2 Copy the GCP (Linux) config
cp /home/jackw/SwjshAlgoKnife/openclaw-setup/openclaw-gcp.json /root/.openclaw/openclaw.json

### 4.3 CRITICAL: Fix workspace paths in openclaw.json
# The GCP config uses /home/jackw paths. Update defaults.workspace and all agent workspaces:
sed -i 's|/home/jackw/.openclaw|/root/.openclaw|g' /root/.openclaw/openclaw.json

### 4.4 Create OpenClaw .env (secrets for the gateway)
cat > /root/.openclaw/.env << 'OCENVEOF'
ANTHROPIC_API_KEY=FILL_IN
DISCORD_BOT_TOKEN=FILL_IN
OPENCLAW_GATEWAY_TOKEN=FILL_IN
OCENVEOF
# Fill these in with the SAME values from .env.local

### 4.5 Deploy cron jobs (Linux paths version)
cp /home/jackw/SwjshAlgoKnife/openclaw-setup/cron-jobs-gcp.json /root/.openclaw/cron/jobs.json

### 4.6 CRITICAL: Fix cron job paths to match actual server layout
# The cron jobs reference /home/jackw/SwjshAlgoKnife but Docker mounts data at /app/data
# The agents access files via Docker paths (/app/...), but OpenClaw runs on the HOST
# So cron jobs need HOST paths:
sed -i 's|/home/jackw/SwjshAlgoKnife/data|/var/lib/docker/volumes/swjshalgoknifedata/_data|g' /root/.openclaw/cron/jobs.json
# OR if using bind mount instead of named volume, paths stay as /home/jackw/SwjshAlgoKnife/data

### 4.7 Verify OpenClaw config
openclaw config validate
# Should output: Configuration valid

## PHASE 5: SET UP THE BRAIN DIRECTORY

### 5.1 Create brain structure
mkdir -p /home/jackw/SwjshAlgoKnife/data/brain/agents
mkdir -p /home/jackw/SwjshAlgoKnife/data/logs

### 5.2 Seed brain files (Chief reads/writes these for self-healing & learning)
cat > /home/jackw/SwjshAlgoKnife/data/brain/master-tracker.md << 'BRAINEOF'
# Chief Master Tracker (Server Brain)
## Last Updated: auto

## Current Directives
- Paper trading ONLY. No live trading.
- Wave 1 agents: SPX Sniper, Boba, Sterling FX
- Max daily loss: $200 (2% of $10k)
- Max per-trade risk: $100
- Max concurrent trades: 3
- Kill switch triggers at 3 consecutive losses OR daily limit breach

## Agent Status
Updated by Chief decision loop and Watchdog.

## Priorities
1. Monitor agent health and P&L
2. Enforce risk rules
3. Log all decisions to decisions-log.md
4. Update learning-log.md when patterns confirmed over 5+ occurrences
BRAINEOF

cat > /home/jackw/SwjshAlgoKnife/data/brain/decisions-log.md << 'BRAINEOF'
# Chief Decision Log
## Format: [ISO timestamp] DECISION: <what> | REASON: <why> | ACTION: <what was done>
BRAINEOF

cat > /home/jackw/SwjshAlgoKnife/data/brain/learning-log.md << 'BRAINEOF'
# Confirmed Patterns (5+ occurrences minimum)
## Format: [date confirmed] PATTERN: <description> | EVIDENCE: <data> | ENFORCEMENT: <rule>
BRAINEOF

cat > /home/jackw/SwjshAlgoKnife/data/brain/performance-memory.md << 'BRAINEOF'
# Cumulative Performance Memory
## Updated daily by EOD brain update cron job

### Strategy Performance
(Populated automatically after first trading day)

### Evolution Triggers
- Win rate < 35% over 20 trades → flag strategy for review
- 3 consecutive losses → auto-pause agent
- Daily PnL < -$200 → kill switch
- Friction > 10% of gross PnL → flag execution quality
BRAINEOF

cat > /home/jackw/SwjshAlgoKnife/data/brain/strategies.md << 'BRAINEOF'
# Strategy Rules & Adjustment Triggers

## ORB (Opening Range Breakout)
- Timeframe: First 15 min of session
- Agents: Pivot Pete, SPX Sniper
- Adjustment trigger: 3 false breakouts in a row → widen range to 30 min

## Set-and-Forget FX
- Agent: Sterling
- Window: 8 AM - 12 PM ET
- Threshold: 0.4 (impulse detection)
- Adjustment trigger: Win rate < 40% over 10 trades → reduce position size 50%

## Impulse Pullback (Crypto)
- Agent: Bitcoin Bob
- Scans every 4 hours
- Impulse candle: 2.5x ATR on 1H or 4H
- Adjustment trigger: 2 consecutive stops → skip next impulse, wait for confirmation
BRAINEOF

cat > /home/jackw/SwjshAlgoKnife/data/brain/self-healing.md << 'BRAINEOF'
# Self-Healing Protocols

## Auto-Recovery Rules
1. Agent crash → Agent Runner auto-restarts after 30s (up to 3x/hour)
2. 3+ crash-restarts in 1 hour → Watchdog flags as CRASH_LOOP, wakes Chief
3. Chief evaluates: if config issue → fix and restart. If code issue → pause and alert Jack.
4. Database lock → retry 3x with backoff. If persistent → restart Agent Runner.
5. OpenClaw gateway down → Watchdog posts directly to Discord webhook (bypass gateway)
6. Daily loss limit → Watchdog triggers kill switch directly (no Chief needed)

## Escalation Chain
Watchdog (auto) → Chief (AI judgment) → Discord alert to Jack (human override)
BRAINEOF

## PHASE 6: MODIFY DOCKER-COMPOSE FOR CONTABO

### 6.1 Update docker-compose.yml for proper volume mounts
# The brain and data need to be accessible to both Docker AND OpenClaw (which runs on host)
# Edit docker-compose.yml to use bind mounts instead of named volumes:

cd /home/jackw/SwjshAlgoKnife

cat > docker-compose.override.yml << 'DCEOF'
# Contabo-specific overrides
services:
  swjshak:
    volumes:
      - /home/jackw/SwjshAlgoKnife/data:/app/data          # Bind mount (accessible by host OpenClaw)
      - /root/.openclaw:/root/.openclaw                     # OpenClaw config
    environment:
      - NODE_ENV=production
      - DATA_DIR=/app/data
      - DATABASE_PATH=/app/data/journal.db
      - AGENTS_DB_PATH=/app/data/agents_db.json
DCEOF

### 6.2 Fix cron job paths now that we're using bind mounts
# With bind mounts, the host path IS /home/jackw/SwjshAlgoKnife/data
# So cron jobs should reference /home/jackw/SwjshAlgoKnife/ for everything
# The cron-jobs-gcp.json already has these paths — verify:
grep -c "home/jackw" /root/.openclaw/cron/jobs.json
# Should show many matches — that's correct

## PHASE 7: BUILD AND LAUNCH

### 7.1 Build the Docker image
cd /home/jackw/SwjshAlgoKnife
docker compose build

### 7.2 Start the container (Next.js + Agent Runner + Watchdog)
docker compose up -d

### 7.3 Verify container health
docker compose logs -f --tail=50
# Wait for "SwjshAK starting up..." and "Handing off to supervisord..."
# Ctrl+C when you see all 4 programs started

### 7.4 Check process health inside container
docker exec swjshak supervisorctl status
# Should show:
#   nextjs    RUNNING   pid XXXX, uptime 0:00:XX
#   runner    RUNNING   pid XXXX, uptime 0:00:XX
#   watchdog  RUNNING   pid XXXX, uptime 0:00:XX
#   openclaw  RUNNING   pid XXXX, uptime 0:00:XX

### 7.5 Test dashboard
curl http://localhost:3000/api/health
# Should return 200 OK

### 7.6 Test from outside
# From your local machine:
# curl http://${SERVER_IP}:3000/api/health

## PHASE 8: START OPENCLAW ON HOST (if not running inside Docker)

NOTE: OpenClaw gateway is configured in supervisord.conf to run INSIDE Docker.
If it fails there (binary not in Docker image), run it on the host instead:

### 8.1 Install OpenClaw on host
curl -fsSL https://get.openclaw.ai | sh

### 8.2 Create systemd service for OpenClaw
cat > /etc/systemd/system/openclaw.service << 'SVCEOF'
[Unit]
Description=OpenClaw Gateway - SwjshAK Chief AI Agent
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/home/jackw/SwjshAlgoKnife
ExecStart=/usr/local/bin/openclaw gateway start
Restart=always
RestartSec=15
Environment=HOME=/root

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable openclaw
systemctl start openclaw

### 8.3 Verify OpenClaw
systemctl status openclaw
# Check logs:
journalctl -u openclaw -f --no-pager -n 50

### 8.4 Verify cron jobs loaded
curl -s http://127.0.0.1:3001/api/cron/jobs | python3 -m json.tool | head -20
# Should list 15 cron jobs

## PHASE 9: VERIFY THE FULL AUTONOMOUS LOOP

### 9.1 Dashboard accessible
curl -s http://localhost:3000/api/health

### 9.2 Agent Runner alive
docker exec swjshak supervisorctl status runner
# RUNNING

### 9.3 Agents spawning
docker exec swjshak cat /app/data/agents_db.json | python3 -m json.tool | head -30
# Should show agent statuses

### 9.4 Watchdog monitoring
docker exec swjshak tail -20 /app/data/logs/watchdog.log
# Should show tier checks running

### 9.5 OpenClaw gateway responding
curl -s http://127.0.0.1:3001/health
# Should return OK

### 9.6 Brain directory populated
ls -la /home/jackw/SwjshAlgoKnife/data/brain/
# Should show: master-tracker.md, decisions-log.md, learning-log.md, performance-memory.md, strategies.md, self-healing.md

### 9.7 Control API works
curl -s -X POST http://localhost:3000/api/control \
  -H "Content-Type: application/json" \
  -d '{"command":"summary"}' | python3 -m json.tool

## PHASE 10: SET UP AUTO-RECOVERY

### 10.1 Docker auto-restart is already configured (restart: unless-stopped)

### 10.2 Create server-level watchdog cron (belt + suspenders)
cat > /etc/cron.d/swjshak-health << 'CRONEOF'
# Check Docker container health every 5 minutes
*/5 * * * * root docker inspect swjshak --format='{{.State.Health.Status}}' | grep -q healthy || (docker compose -f /home/jackw/SwjshAlgoKnife/docker-compose.yml restart && echo "$(date) SwjshAK auto-restarted" >> /var/log/swjshak-recovery.log)

# Check OpenClaw every 5 minutes
*/5 * * * * root systemctl is-active --quiet openclaw || (systemctl restart openclaw && echo "$(date) OpenClaw auto-restarted" >> /var/log/swjshak-recovery.log)

# Clean old logs weekly
0 3 * * 0 root find /home/jackw/SwjshAlgoKnife/data/logs -name "*.log" -mtime +30 -delete
CRONEOF

chmod 644 /etc/cron.d/swjshak-health

### 10.3 Set up log rotation
cat > /etc/logrotate.d/swjshak << 'LOGEOF'
/home/jackw/SwjshAlgoKnife/data/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    copytruncate
}
LOGEOF

## DONE!

After completing all phases, the autonomous loop is:
1. Agent Runner spawns 5-6 Python trading agents
2. Agents scan markets and execute paper trades → SQLite
3. Watchdog monitors health (zero cost, every 1-3 min)
4. OpenClaw Chief runs 15 cron jobs (decision loop, grading, auditing, weekly review)
5. Chief reads/writes brain directory for learning and self-improvement
6. Watchdog wakes Chief for critical issues → Chief takes action via Control API
7. Everything auto-restarts on crash (Docker + systemd + cron health checks)

The system is self-healing, self-monitoring, and self-improving via the brain directory.
```

---

## Quick Reference After Setup

| Action | Command |
|--------|---------|
| SSH in | `ssh root@${SERVER_IP}` |
| View logs | `docker compose logs -f --tail=100` |
| Container status | `docker exec swjshak supervisorctl status` |
| OpenClaw status | `systemctl status openclaw` |
| Dashboard | `http://${SERVER_IP}:3000` |
| Control API | `curl http://${SERVER_IP}:3000/api/control` |
| Kill switch | `curl -X POST http://${SERVER_IP}:3000/api/control -H "Content-Type: application/json" -d '{"command":"killswitch"}'` |
| Restart everything | `docker compose restart && systemctl restart openclaw` |
| Watchdog logs | `docker exec swjshak tail -50 /app/data/logs/watchdog.log` |
| Brain status | `ls -la /home/jackw/SwjshAlgoKnife/data/brain/` |
