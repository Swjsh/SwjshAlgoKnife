# Contabo VPS — Claude Handoff Prompt

> **Copy-paste this entire section into Claude Code on the Contabo server.**
> It will diagnose the current state, clone/pull the repo, and run the deployment script.

---

## The Prompt (copy everything below the line)

---

You are setting up the SwjshAK autonomous trading platform on this Contabo VPS. Follow these steps exactly. Report what you find at each step before proceeding.

## STEP 1: Diagnose Current State

Run these commands and report the results:

```bash
# System info
uname -a
cat /etc/os-release | head -3
free -h
df -h /

# Check installed tools
node --version 2>/dev/null || echo "Node.js: NOT INSTALLED"
python3 --version 2>/dev/null || echo "Python3: NOT INSTALLED"
git --version 2>/dev/null || echo "Git: NOT INSTALLED"
npm --version 2>/dev/null || echo "npm: NOT INSTALLED"
openclaw --version 2>/dev/null || echo "OpenClaw: NOT INSTALLED"

# Check if repo exists
ls -la /root/SwjshAlgoKnife/CLAUDE.md 2>/dev/null || echo "Repo: NOT CLONED"

# Check if OpenClaw is configured
ls -la /root/.openclaw/openclaw.json 2>/dev/null || echo "OpenClaw config: NOT DEPLOYED"
ls -la /root/.openclaw/.env 2>/dev/null || echo "OpenClaw .env: NOT DEPLOYED"

# Check timezone
timedatectl show --property=Timezone 2>/dev/null || date +%Z
```

## STEP 2: Install Missing Prerequisites

If Node.js is not installed:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

If Python3 is not installed:
```bash
apt-get update && apt-get install -y python3 python3-pip
```

If Git is not installed:
```bash
apt-get install -y git
```

## STEP 3: Clone or Update Repository

If repo is NOT cloned:
```bash
cd /root
git clone https://github.com/SwjshDev/SwjshAlgoKnife.git
cd SwjshAlgoKnife
```

If repo EXISTS but may be outdated:
```bash
cd /root/SwjshAlgoKnife
git fetch origin
git status
git pull origin master
```

## STEP 4: Run the Deployment Script

```bash
cd /root/SwjshAlgoKnife
chmod +x deploy-contabo.sh
./deploy-contabo.sh
```

This script handles everything:
- Verifies prerequisites
- Sets timezone to ET
- Installs OpenClaw
- Creates directory structure
- Deploys Contabo-specific config (Linux paths, correct Discord channels)
- Deploys 15 cron jobs
- Copies workspace + agent SOUL files
- Creates/checks .env file
- Installs project deps
- Initializes brain (18 files)
- Creates systemd service

## STEP 5: Configure Credentials

If the script created a template .env, fill in the real values:

```bash
nano /root/.openclaw/.env
```

Required values:
- `ANTHROPIC_API_KEY` — Your Anthropic API key (sk-ant-...)
- `DISCORD_BOT_TOKEN` — Your Discord bot token
- `OPENCLAW_GATEWAY_TOKEN` — Generate with: `openssl rand -hex 32`

Also ensure the trading app .env exists:
```bash
ls /root/SwjshAlgoKnife/.env.local
```

If missing, create from example:
```bash
cp /root/SwjshAlgoKnife/.env.local.example /root/SwjshAlgoKnife/.env.local
nano /root/SwjshAlgoKnife/.env.local
```

## STEP 6: Start OpenClaw

```bash
systemctl start openclaw
systemctl status openclaw
```

Check it's running:
```bash
journalctl -u openclaw --no-pager -n 50
```

Verify cron jobs:
```bash
openclaw cron:list
```

## STEP 7: Verify Discord Connection

After OpenClaw starts, it should connect to Discord. Check the logs for:
- "Connected to Discord" or similar
- No authentication errors
- Gateway connection established

If there are Discord errors:
1. Verify bot token is correct in /root/.openclaw/.env
2. Verify bot has been invited to the server with correct permissions
3. Verify channel IDs match (check openclaw.json)

## STEP 8: Test a Cron Job Manually

Trigger the morning briefing to test the full pipeline:
```bash
openclaw cron:run morning-briefing
```

This should:
1. Chief reads the brain files
2. Checks agent status
3. Posts a morning brief to Discord #chief channel

## STEP 9: Verify Brain Directory

```bash
ls -la /root/SwjshAlgoKnife/data/brain/
ls -la /root/SwjshAlgoKnife/data/brain/agents/
```

Should see 10 core files + 8 agent memory files = 18 total.

## STEP 10: Final Status Report

Report back:
- [ ] Node.js version
- [ ] Python version
- [ ] OpenClaw version
- [ ] Repo status (branch, last commit)
- [ ] OpenClaw service status
- [ ] Number of cron jobs loaded
- [ ] Discord connection status
- [ ] Brain file count
- [ ] Any errors encountered

---

## What Happens After Deployment

Once running, the autonomous loop operates on this schedule (all times ET):

| Time | What Happens |
|------|-------------|
| 3:00 AM | Sterling checks London open |
| 7:00 AM | Brain integrity check |
| 8:00 AM | Morning briefing → Discord |
| 8:30 AM | Sterling NY-London overlap |
| 9:30 AM | Market open check |
| 9:30-4:00 PM | Chief decision loop (every 30 min) |
| Every 3h | System Builder audits brain vs code |
| 12:00 PM | Midday check + Sterling session close |
| 4:15 PM | Professor grades trades |
| 4:30 PM | Overseer risk audit |
| 4:45 PM | EOD brain update |
| Every 4h | Bitcoin Bob crypto scan |
| Every 2h | Sterling FX scan |
| Sunday 6 PM | Weekly Evolution Engine |

The System Builder (every 3h) is what drives continuous improvement — it audits the codebase against the brain, identifies gaps, updates documentation, and queues code changes.
