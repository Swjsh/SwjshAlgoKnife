# Deployment

---
tags: #deployment #devops #production
status: 📘 Reference
updated: 2026-03-17
---

## Overview

SwjshAK runs on a **Contabo Cloud VPS** as the single production environment. All legacy deployment targets (GCP, Oracle Cloud, Fly.io) have been retired.

**Server**: Contabo Cloud VPS 10 NVMe (4 vCPU, 8GB RAM, 75GB NVMe, Ubuntu 22.04)
**Location**: St. Louis, US-central
**Timezone**: America/New_York (ET — matches market hours)

---

## Production Deployment (Contabo VPS)

### One-Shot Deploy

```bash
# SSH into the server
ssh root@<contabo-ip>

# Clone repo (if first time)
cd /root
git clone https://github.com/SwjshDev/SwjshAlgoKnife.git

# Run deployment script
cd /root/SwjshAlgoKnife
chmod +x deploy-contabo.sh
./deploy-contabo.sh
```

The script handles: prerequisites, OpenClaw install, config deployment, brain initialization, systemd service creation.

### Key Paths on Server

| What | Path |
|------|------|
| Project root | `/root/SwjshAlgoKnife` |
| OpenClaw home | `/root/.openclaw` |
| OpenClaw config | `/root/.openclaw/openclaw.json` |
| OpenClaw credentials | `/root/.openclaw/.env` |
| Cron jobs | `/root/.openclaw/cron/jobs.json` |
| Brain files | `/root/SwjshAlgoKnife/data/brain/` |
| Agent memory | `/root/SwjshAlgoKnife/data/brain/agents/` |
| Agent state | `/root/SwjshAlgoKnife/data/agents_db.json` |
| Trading database | `/root/SwjshAlgoKnife/journal.db` |

### Required Credentials

File: `/root/.openclaw/.env`

```
ANTHROPIC_API_KEY=sk-ant-...     # Powers all agents via Claude
DISCORD_BOT_TOKEN=...            # Two-way Discord integration
OPENCLAW_GATEWAY_TOKEN=...       # Internal auth (openssl rand -hex 32)
```

File: `/root/SwjshAlgoKnife/.env.local`

```
WEBHOOK_SECRET=...               # TradingView webhook auth
APCA_API_KEY_ID=...              # Alpaca paper trading
APCA_API_SECRET_KEY=...
APCA_API_BASE_URL=https://paper-api.alpaca.markets
OANDA_API_TOKEN=...              # Forex trading
OANDA_ACCOUNT_ID=...
OANDA_ENVIRONMENT=practice
ACCOUNT_BALANCE=10000
RISK_PER_TRADE=1
```

### Managing the Service

```bash
# Start/stop/restart
systemctl start openclaw
systemctl stop openclaw
systemctl restart openclaw

# Check status
systemctl status openclaw

# View logs (live)
journalctl -u openclaw -f

# View cron schedule
openclaw cron:list

# Manually trigger a job
openclaw cron:run morning-briefing
```

---

## Local Development (Windows)

For development on Jack's Windows machine:

```powershell
# Start dashboard + agents
./START_SWJSH.ps1

# Or manually
npm run dev          # Next.js on localhost:3000
npx tsx scripts/agent_runner.ts  # Agent runner
```

Uses PM2 for process management locally. OpenClaw runs separately if testing Discord integration.

---

## Architecture on Server

```
Contabo VPS (Ubuntu 22.04, 4 vCPU, 8GB RAM)
├── systemd: openclaw.service
│   ├── OpenClaw Gateway (port 3001)
│   ├── Discord Bot Connection
│   ├── 15 Cron Jobs (autonomous loop)
│   └── 9 Agents (Chief, Overseer, Professor, Auditor,
│       Sterling, Bitcoin Bob, Pivot Pete, Boba, SPX Sniper)
├── Docker (optional): SwjshAlgoKnife container
│   ├── supervisord
│   │   ├── Next.js Dashboard (port 3000)
│   │   ├── Agent Runner (spawns Python agents)
│   │   └── Watchdog (health monitoring)
│   └── SQLite (journal.db)
└── Brain: data/brain/ (18 markdown files)
```

---

## Updating the Server

```bash
ssh root@<contabo-ip>
cd /root/SwjshAlgoKnife
git pull origin master
npm install --production
systemctl restart openclaw
```

---

## Retired Deployment Targets

The following were previously documented but have been retired (March 2026):

- **GCP Compute Engine** — All scripts and configs deleted
- **Oracle Cloud** — All scripts and configs deleted
- **Fly.io** — Config deleted
- **Vercel** — Never used for full stack

Historical deployment files are preserved in git history if ever needed.
