# Startup Commands

---
tags: #operations #startup #commands
status: 📘 Reference
---

## Quick Start

**One command to start everything**:

```powershell
./START_SWJSH.ps1
```

This launches:
1. Next.js Dashboard (port 3000)
2. Agent Runner (spawns all Python agents)
3. PM2 process manager for monitoring

---

## Prerequisites

Before starting, ensure:

- [ ] Node.js installed (`node --version`)
- [ ] Python installed (`python --version`)
- [ ] Dependencies installed (`npm install`)
- [ ] Python packages installed (`pip install -r requirements.txt`)
- [ ] Environment configured (`.env` file exists with API keys)

---

## Startup Methods

### Method 1: PowerShell Script (Recommended)

```powershell
# Windows - Full startup
./START_SWJSH.ps1

# What it does:
# 1. Loads environment variables from .env
# 2. Starts PM2 with ecosystem config
# 3. Launches dashboard + agent runner
# 4. Opens browser to localhost:3000
```

### Method 2: PM2 Directly

```bash
# Start with ecosystem config
pm2 start scripts/ecosystem.config.js

# Or individual processes
pm2 start npm --name "dashboard" -- start
pm2 start npx --name "agent-runner" -- tsx scripts/agent_runner.ts
```

### Method 3: Manual (Development)

```bash
# Terminal 1: Dashboard
npm run dev

# Terminal 2: Agent Runner
npx tsx scripts/agent_runner.ts
```

### Method 4: Docker

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

---

## PM2 Ecosystem Config

**File**: `scripts/ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: 'dashboard',
      script: 'npm',
      args: 'start',
      cwd: './',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'agent-runner',
      script: 'npx',
      args: 'tsx scripts/agent_runner.ts',
      cwd: './',
      restart_delay: 30000,  // 30s delay on crash
      max_restarts: 10
    }
  ]
};
```

---

## Verification

### Check System Status

```powershell
# PM2 process list
pm2 list

# Should show:
# ┌─────────────────┬─────────┬─────────┬
# │ name            │ status  │ cpu     │
# ├─────────────────┼─────────┼─────────┼
# │ dashboard       │ online  │ 2%      │
# │ agent-runner    │ online  │ 5%      │
# └─────────────────┴─────────┴─────────┴
```

### Check Dashboard

```powershell
# Should return HTML
curl http://localhost:3000

# Or open in browser
start http://localhost:3000
```

### Check API

```powershell
# Get system status
curl -X POST http://localhost:3000/api/control `
  -H "Content-Type: application/json" `
  -d '{"command": "status"}'
```

### Check Agents

```powershell
# Get agent status
curl http://localhost:3000/api/agents
```

---

## Common Commands

### Start/Stop/Restart

```powershell
# Stop all
pm2 stop all

# Start all
pm2 start all

# Restart all
pm2 restart all

# Restart specific
pm2 restart dashboard
pm2 restart agent-runner
```

### View Logs

```powershell
# All logs
pm2 logs

# Specific process
pm2 logs dashboard
pm2 logs agent-runner

# Last 100 lines
pm2 logs --lines 100

# Clear logs
pm2 flush
```

### Monitor

```powershell
# Interactive monitor
pm2 monit

# Shows:
# - CPU/Memory usage
# - Log output
# - Process metrics
```

---

## Shutdown

### Graceful Shutdown

```powershell
# Stop all processes
pm2 stop all

# Remove from PM2
pm2 delete all
```

### Emergency Stop

```powershell
# Kill switch via API
curl -X POST http://localhost:3000/api/control `
  -H "Content-Type: application/json" `
  -d '{"command": "killswitch"}'

# Or forcefully kill all
pm2 kill
```

---

## Development Mode

For active development with hot reloading:

### Terminal 1: Dashboard (with hot reload)

```bash
npm run dev
```

### Terminal 2: Agent Runner (with watch)

```bash
npx tsx watch scripts/agent_runner.ts
```

---

## Production Mode

### Build and Start

```bash
# Build Next.js
npm run build

# Start production server
npm start

# Or via PM2
pm2 start scripts/ecosystem.config.js --env production
```

### Persist Across Reboots

```powershell
# Save PM2 process list
pm2 save

# Generate startup script (Windows)
pm2 startup

# Follow the output instructions
```

---

## Individual Agent Control

⚠️ **Warning**: Don't run agents directly - use Agent Runner to avoid duplicates.

### If You Must (Debugging Only)

```powershell
# Start specific agent manually (NOT RECOMMENDED)
python scripts/pivot_pete_engine.py

# Stop specific agent
pm2 stop pivot-pete
```

### Proper Way

```powershell
# Pause agent via API
curl -X POST http://localhost:3000/api/control `
  -H "Content-Type: application/json" `
  -d '{"command": "pause", "agentId": "pivot-pete"}'

# Resume agent
curl -X POST http://localhost:3000/api/control `
  -H "Content-Type: application/json" `
  -d '{"command": "resume", "agentId": "pivot-pete"}'
```

---

## Troubleshooting Startup

### Port 3000 Already in Use

```powershell
# Find process using port
netstat -ano | findstr :3000

# Kill it (replace PID)
taskkill /PID 12345 /F

# Or use different port
$env:PORT=3001; npm start
```

### PM2 Not Found

```powershell
# Install globally
npm install -g pm2
```

### Python Agents Not Starting

```powershell
# Check Python
python --version

# Check dependencies
pip install -r requirements.txt

# Check agent logs
pm2 logs agent-runner --lines 50
```

### Environment Variables Not Loading

```powershell
# Check .env exists
cat .env

# Verify values
echo $env:ALPACA_API_KEY
```

---

## Scheduled Tasks (Cron)

### Linux/Mac Cron

```bash
# Start at boot
@reboot cd /path/to/SwjshAlgoKnife && pm2 start ecosystem.config.js

# Daily restart at 5 AM
0 5 * * * pm2 restart all
```

### Windows Task Scheduler

```powershell
# Create scheduled task
$action = New-ScheduledTaskAction -Execute "powershell" `
  -Argument "-File C:\Users\jackw\Desktop\SwjshAlgoKnife\START_SWJSH.ps1"

$trigger = New-ScheduledTaskTrigger -AtStartup

Register-ScheduledTask -TaskName "SwjshAK" -Action $action -Trigger $trigger
```

---

## Related Pages

- [[Deployment]] - Production deployment
- [[Environment Variables]] - Configuration
- [[Agent System]] - Agent architecture
- [[Troubleshooting]] - Common issues
- [[LLM Control API]] - Remote control
