# SwjshAK — GCP Cloud Deployment Plan
> Hand this document to Claude CLI and say: "Execute this deployment plan step by step. Ask me for any secrets/tokens before you need them."

---

## What This Does

Deploys the full SwjshAlgoKnife trading platform + OpenClaw (Chief agent) to a Google Cloud VM so everything runs 24/7 without needing a local machine on.

**Architecture on GCP:**
```
GCP VM (e2-small, Ubuntu 22.04, us-east4)
├── SwjshAlgoKnife (Next.js dashboard + agent runner via Docker)
│   ├── journal.db  (SQLite trades/signals)
│   └── agents_db.json  (agent state)
└── OpenClaw gateway (Chief + 8 sub-agents)
    ├── Heartbeat every 30m → Discord
    └── 11 cron jobs → Discord
```

---

## Prerequisites (Claude CLI should verify these first)

```powershell
# Verify gcloud is installed and authenticated
gcloud --version
gcloud auth list

# If not authenticated:
gcloud auth login

# Verify active project (or set one)
gcloud config get-value project
# If no project, create or select one:
# gcloud projects create swjsh-trading --name="SwjshAK Trading"
# gcloud config set project swjsh-trading
```

---

## Step 1 — Enable Required GCP APIs

```powershell
gcloud services enable compute.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com
```

---

## Step 2 — Create the VM

```powershell
gcloud compute instances create swjsh-trading \
  --zone=us-east4-c \
  --machine-type=e2-small \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-standard \
  --tags=swjsh-server \
  --metadata=enable-oslogin=true
```

**Why these choices:**
- `us-east4` (Virginia) — lowest latency to NYSE/NASDAQ + Discord US servers
- `e2-small` (2 vCPU, 2GB RAM) — ~$13-15/month, handles both apps comfortably
- 30GB disk — room for SQLite growth, logs, npm modules, Docker layers

---

## Step 3 — Configure Firewall

```powershell
# Allow SSH
gcloud compute firewall-rules create allow-ssh \
  --allow=tcp:22 \
  --target-tags=swjsh-server \
  --description="SSH access"

# Allow trading dashboard (optional — only if you want to access it from browser)
# Keep commented out unless you need remote dashboard access
# gcloud compute firewall-rules create allow-dashboard \
#   --allow=tcp:3000 \
#   --target-tags=swjsh-server \
#   --source-ranges=YOUR_HOME_IP/32 \
#   --description="Trading dashboard — home IP only"
```

---

## Step 4 — SSH Into the VM

```powershell
gcloud compute ssh swjsh-trading --zone=us-east4-c
```

> All steps below run INSIDE the VM via SSH.

---

## Step 5 — Install System Dependencies (run inside VM)

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python 3 + pip
sudo apt-get install -y python3 python3-pip

# Install SQLite3 CLI (for Chief's queries)
sudo apt-get install -y sqlite3

# Install git, curl, unzip
sudo apt-get install -y git curl unzip

# Verify versions
node --version   # should be 20.x
npm --version
python3 --version
sqlite3 --version
```

---

## Step 6 — Install OpenClaw

```bash
# Install OpenClaw globally
npm install -g @openclaw/openclaw

# Verify
openclaw --version

# Init OpenClaw (creates ~/.openclaw/ directory structure)
openclaw init
```

---

## Step 7 — Copy Trading App to VM

Back on your **local Windows machine**, run:

```powershell
# Copy the entire project to the VM (run this from your local machine, not inside SSH)
gcloud compute scp --recurse "C:\Users\jackw\Desktop\SwjshAlgoKnife" swjsh-trading:~/SwjshAlgoKnife --zone=us-east4-c --compress
```

> This will take a few minutes. It copies all source files.

Then back inside the VM:

```bash
cd ~/SwjshAlgoKnife

# Install npm dependencies
npm install

# Install Python agent dependencies
pip3 install -r scripts/requirements_pivot_pete.txt --break-system-packages 2>/dev/null || true
pip3 install -r scripts/requirements_boba.txt --break-system-packages 2>/dev/null || true
pip3 install yfinance pandas requests --break-system-packages

# Build Next.js
npm run build
```

---

## Step 8 — Set Up Environment Variables (VM)

```bash
# Create the .env.local file — Claude CLI should ask Jack for each value
cat > ~/SwjshAlgoKnife/.env.local << 'EOF'
WEBHOOK_SECRET=REPLACE_WITH_WEBHOOK_SECRET
ACCOUNT_BALANCE=10000
RISK_PER_TRADE=1
APCA_API_KEY_ID=REPLACE_WITH_ALPACA_KEY
APCA_API_SECRET_KEY=REPLACE_WITH_ALPACA_SECRET
APCA_API_BASE_URL=https://paper-api.alpaca.markets
OANDA_API_TOKEN=REPLACE_WITH_OANDA_TOKEN
OANDA_ACCOUNT_ID=REPLACE_WITH_OANDA_ACCOUNT
DISCORD_CHIEF_WEBHOOK=REPLACE_WITH_CHIEF_WEBHOOK_URL
EOF

# Lock permissions
chmod 600 ~/SwjshAlgoKnife/.env.local
```

---

## Step 9 — Create systemd Service for Watchdog (Replaces Chief Heartbeat)

The watchdog runs 24/7 at zero LLM cost. It handles all routine monitoring and only
wakes Chief (Sonnet) when something genuinely needs AI judgment.

```bash
sudo tee /etc/systemd/system/swjsh-watchdog.service << 'EOF'
[Unit]
Description=SwjshAK Watchdog Monitor
After=network.target swjsh-trading.service

[Service]
Type=simple
User=jackw
WorkingDirectory=/home/jackw/SwjshAlgoKnife
ExecStart=/usr/bin/python3 scripts/watchdog.py
Restart=always
RestartSec=15
Environment=APP_DIR=/home/jackw/SwjshAlgoKnife
Environment=OPENCLAW_GATEWAY=http://127.0.0.1:3001
EnvironmentFile=/home/jackw/.openclaw/.env
EnvironmentFile=/home/jackw/SwjshAlgoKnife/.env.local

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable swjsh-watchdog
sudo systemctl start swjsh-watchdog
sudo systemctl status swjsh-watchdog
```

---

## Step 10 — Create systemd Service for Trading App

```bash
sudo tee /etc/systemd/system/swjsh-trading.service << 'EOF'
[Unit]
Description=SwjshAK Trading Platform
After=network.target

[Service]
Type=simple
User=jackw
WorkingDirectory=/home/jackw/SwjshAlgoKnife
ExecStart=/usr/bin/node node_modules/.bin/next start -p 3000
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/home/jackw/SwjshAlgoKnife/.env.local

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable swjsh-trading
sudo systemctl start swjsh-trading

# Verify it started
sudo systemctl status swjsh-trading
```

---

## Step 10 — Create systemd Service for Agent Runner

```bash
sudo tee /etc/systemd/system/swjsh-agents.service << 'EOF'
[Unit]
Description=SwjshAK Agent Runner
After=network.target swjsh-trading.service

[Service]
Type=simple
User=jackw
WorkingDirectory=/home/jackw/SwjshAlgoKnife
ExecStart=/usr/bin/npx tsx scripts/agent_runner.ts
Restart=always
RestartSec=30
EnvironmentFile=/home/jackw/SwjshAlgoKnife/.env.local

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable swjsh-agents
sudo systemctl start swjsh-agents

# Verify
sudo systemctl status swjsh-agents
```

---

## Step 11 — Deploy OpenClaw Config

```bash
# Create OpenClaw directory structure
mkdir -p ~/.openclaw/workspace
mkdir -p ~/.openclaw/cron
mkdir -p ~/.openclaw/agents/{overseer,professor,auditor,sterling,bitcoin-bob,pivot-pete,boba,spx-sniper}
```

**On your local Windows machine**, copy the OpenClaw config files:

```powershell
# Copy openclaw.json (you will need to edit it after — see Step 12)
gcloud compute scp "C:\Users\jackw\Desktop\SwjshAlgoKnife\openclaw-setup\openclaw.json" swjsh-trading:~/.openclaw/openclaw.json --zone=us-east4-c

# Copy workspace files
gcloud compute scp "C:\Users\jackw\Desktop\SwjshAlgoKnife\openclaw-setup\workspace\SOUL.md" swjsh-trading:~/.openclaw/workspace/SOUL.md --zone=us-east4-c
gcloud compute scp "C:\Users\jackw\Desktop\SwjshAlgoKnife\openclaw-setup\workspace\HEARTBEAT.md" swjsh-trading:~/.openclaw/workspace/HEARTBEAT.md --zone=us-east4-c
gcloud compute scp "C:\Users\jackw\Desktop\SwjshAlgoKnife\openclaw-setup\workspace\TOOLS.md" swjsh-trading:~/.openclaw/workspace/TOOLS.md --zone=us-east4-c
gcloud compute scp "C:\Users\jackw\Desktop\SwjshAlgoKnife\openclaw-setup\workspace\AGENTS.md" swjsh-trading:~/.openclaw/workspace/AGENTS.md --zone=us-east4-c
gcloud compute scp "C:\Users\jackw\Desktop\SwjshAlgoKnife\openclaw-setup\workspace\MEMORY.md" swjsh-trading:~/.openclaw/workspace/MEMORY.md --zone=us-east4-c
gcloud compute scp "C:\Users\jackw\Desktop\SwjshAlgoKnife\openclaw-setup\workspace\USER.md" swjsh-trading:~/.openclaw/workspace/USER.md --zone=us-east4-c

# Copy cron jobs
gcloud compute scp "C:\Users\jackw\Desktop\SwjshAlgoKnife\openclaw-setup\cron-jobs.json" swjsh-trading:~/.openclaw/cron/jobs.json --zone=us-east4-c

# Copy all agent SOUL.md files
gcloud compute scp "C:\Users\jackw\Desktop\SwjshAlgoKnife\openclaw-setup\agents\overseer\SOUL.md" swjsh-trading:~/.openclaw/agents/overseer/SOUL.md --zone=us-east4-c
gcloud compute scp "C:\Users\jackw\Desktop\SwjshAlgoKnife\openclaw-setup\agents\professor\SOUL.md" swjsh-trading:~/.openclaw/agents/professor/SOUL.md --zone=us-east4-c
gcloud compute scp "C:\Users\jackw\Desktop\SwjshAlgoKnife\openclaw-setup\agents\auditor\SOUL.md" swjsh-trading:~/.openclaw/agents/auditor/SOUL.md --zone=us-east4-c
gcloud compute scp "C:\Users\jackw\Desktop\SwjshAlgoKnife\openclaw-setup\agents\sterling\SOUL.md" swjsh-trading:~/.openclaw/agents/sterling/SOUL.md --zone=us-east4-c
gcloud compute scp "C:\Users\jackw\Desktop\SwjshAlgoKnife\openclaw-setup\agents\bitcoin-bob\SOUL.md" swjsh-trading:~/.openclaw/agents/bitcoin-bob/SOUL.md --zone=us-east4-c
gcloud compute scp "C:\Users\jackw\Desktop\SwjshAlgoKnife\openclaw-setup\agents\pivot-pete\SOUL.md" swjsh-trading:~/.openclaw/agents/pivot-pete/SOUL.md --zone=us-east4-c
gcloud compute scp "C:\Users\jackw\Desktop\SwjshAlgoKnife\openclaw-setup\agents\boba\SOUL.md" swjsh-trading:~/.openclaw/agents/boba/SOUL.md --zone=us-east4-c
gcloud compute scp "C:\Users\jackw\Desktop\SwjshAlgoKnife\openclaw-setup\agents\spx-sniper\SOUL.md" swjsh-trading:~/.openclaw/agents/spx-sniper/SOUL.md --zone=us-east4-c
```

---

## Step 12 — Update Paths in OpenClaw Config (CRITICAL)

All file paths in the config files were written for Windows (`C:\Users\jackw\Desktop\...`). They must be updated to Linux paths on the GCP VM.

Run these **inside the VM**:

```bash
LINUX_APP_PATH="/home/jackw/SwjshAlgoKnife"

# Fix paths in openclaw.json
sed -i 's|C:\\\\Users\\\\jackw\\\\Desktop\\\\SwjshAlgoKnife|'"$LINUX_APP_PATH"'|g' ~/.openclaw/openclaw.json
sed -i 's|C:\\\\Users\\\\jackw\\\\.openclaw|/home/jackw/.openclaw|g' ~/.openclaw/openclaw.json

# Fix paths in cron jobs.json (double-escaped Windows paths in JSON strings)
sed -i 's|C:\\\\Users\\\\jackw\\\\Desktop\\\\SwjshAlgoKnife|'"$LINUX_APP_PATH"'|g' ~/.openclaw/cron/jobs.json

# Fix paths in SOUL.md and TOOLS.md
sed -i 's|C:\\\\Users\\\\jackw\\\\Desktop\\\\SwjshAlgoKnife|'"$LINUX_APP_PATH"'|g' ~/.openclaw/workspace/SOUL.md
sed -i 's|C:\\Users\\jackw\\Desktop\\SwjshAlgoKnife|'"$LINUX_APP_PATH"'|g' ~/.openclaw/workspace/SOUL.md
sed -i 's|C:\\\\Users\\\\jackw\\\\Desktop\\\\SwjshAlgoKnife|'"$LINUX_APP_PATH"'|g' ~/.openclaw/workspace/TOOLS.md
sed -i 's|C:\\Users\\jackw\\Desktop\\SwjshAlgoKnife|'"$LINUX_APP_PATH"'|g' ~/.openclaw/workspace/TOOLS.md
sed -i 's|C:\\\\Users\\\\jackw\\\\Desktop\\\\SwjshAlgoKnife|'"$LINUX_APP_PATH"'|g' ~/.openclaw/workspace/HEARTBEAT.md
sed -i 's|C:\\Users\\jackw\\Desktop\\SwjshAlgoKnife|'"$LINUX_APP_PATH"'|g' ~/.openclaw/workspace/HEARTBEAT.md

# Verify the paths look right
grep -n "SwjshAlgoKnife" ~/.openclaw/openclaw.json
grep -n "SwjshAlgoKnife" ~/.openclaw/cron/jobs.json | head -5
```

---

## Step 13 — Set OpenClaw Environment Variables

```bash
# Create OpenClaw .env file
cat > ~/.openclaw/.env << 'EOF'
ANTHROPIC_API_KEY=REPLACE_WITH_ANTHROPIC_API_KEY
DISCORD_BOT_TOKEN=REPLACE_WITH_DISCORD_BOT_TOKEN
OPENCLAW_GATEWAY_TOKEN=REPLACE_WITH_GATEWAY_TOKEN
EOF

chmod 600 ~/.openclaw/.env

# Export for current session so openclaw can pick them up
export ANTHROPIC_API_KEY="$(grep ANTHROPIC_API_KEY ~/.openclaw/.env | cut -d= -f2)"
export DISCORD_BOT_TOKEN="$(grep DISCORD_BOT_TOKEN ~/.openclaw/.env | cut -d= -f2)"
export OPENCLAW_GATEWAY_TOKEN="$(grep OPENCLAW_GATEWAY_TOKEN ~/.openclaw/.env | cut -d= -f2)"
```

---

## Step 14 — Create systemd Service for OpenClaw Gateway

```bash
sudo tee /etc/systemd/system/openclaw-gateway.service << 'EOF'
[Unit]
Description=OpenClaw Gateway (Chief Agent)
After=network.target swjsh-trading.service

[Service]
Type=simple
User=jackw
ExecStart=/usr/local/bin/openclaw gateway start
Restart=always
RestartSec=15
EnvironmentFile=/home/jackw/.openclaw/.env

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable openclaw-gateway
sudo systemctl start openclaw-gateway

# Wait 10 seconds then check status
sleep 10
sudo systemctl status openclaw-gateway
```

---

## Step 15 — Verify Everything is Running

```bash
# Check all 3 services
sudo systemctl is-active swjsh-trading
sudo systemctl is-active swjsh-agents
sudo systemctl is-active openclaw-gateway

# Check trading app is responding
curl -s http://localhost:3000/api/agents | head -c 200

# Check OpenClaw gateway
openclaw gateway status

# Check cron jobs loaded
openclaw cron list

# Check agent list
openclaw agents list
```

---

## Step 16 — Wake Chief and Confirm

```bash
# Send Chief a startup event to announce he's live on GCP
openclaw system event --text "You are Chief, now running 24/7 on Google Cloud. Send a status report to Discord #chief-main confirming: (1) you are live on GCP, (2) all 9 agents are configured, (3) heartbeat is active every 30 minutes, (4) cron jobs are scheduled. Keep it to one clean embed. Title: Chief Online — GCP 24/7" --mode now
```

---

## Step 17 — Set Up Log Monitoring (optional but recommended)

```bash
# Tail all three services together
sudo journalctl -f -u swjsh-trading -u swjsh-agents -u openclaw-gateway

# Or check individual logs
sudo journalctl -u openclaw-gateway -n 50 --no-pager
sudo journalctl -u swjsh-trading -n 50 --no-pager
```

---

## Keeping the Trading App in Sync

When you update SwjshAlgoKnife locally and want to push to GCP:

```powershell
# From your local Windows machine — sync changed files
gcloud compute scp --recurse "C:\Users\jackw\Desktop\SwjshAlgoKnife\src" swjsh-trading:~/SwjshAlgoKnife/src --zone=us-east4-c --compress
gcloud compute scp --recurse "C:\Users\jackw\Desktop\SwjshAlgoKnife\scripts" swjsh-trading:~/SwjshAlgoKnife/scripts --zone=us-east4-c --compress

# Then rebuild and restart on the VM
gcloud compute ssh swjsh-trading --zone=us-east4-c --command="cd ~/SwjshAlgoKnife && npm run build && sudo systemctl restart swjsh-trading swjsh-agents"
```

---

## Cost Estimate

| Resource | Spec | Monthly Cost |
|----------|------|-------------|
| VM (e2-small) | 2 vCPU, 2GB RAM | ~$13-15 |
| Persistent disk | 30GB standard | ~$1.20 |
| Network egress | ~1GB/mo (API calls, Discord) | ~$0.12 |
| **Total** | | **~$15/month** |

> Anthropic API costs are separate — with Haiku on 7 agents and Sonnet on Chief/Overseer, heartbeat + cron jobs should run ~$5-15/month depending on trade volume.

---

## Troubleshooting

```bash
# Gateway won't start — check config
openclaw doctor

# Cron jobs not firing — check cron is enabled
openclaw cron list

# Trading app crash loop — check logs
sudo journalctl -u swjsh-trading -n 100 --no-pager

# Chief not posting to Discord — check bot token and channel IDs
openclaw agents list
```
