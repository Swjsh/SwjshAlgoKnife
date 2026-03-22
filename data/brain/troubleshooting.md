# Troubleshooting Guide

---
tags: #troubleshooting #debugging #errors
status: 📘 Reference
---

## Common Issues & Fixes

---

## 🚨 System Won't Start

### Symptoms
- Running `./START_SWJSH.ps1` produces errors
- Dashboard doesn't load at localhost:3000
- PM2 shows processes as "errored"

### Diagnostics
```powershell
# Check PM2 status
pm2 status

# View logs for errors
pm2 logs --lines 50

# Check if ports are in use
netstat -ano | findstr :3000
```

### Common Causes & Fixes

#### 1. Port 3000 already in use
**Error**: `EADDRINUSE: address already in use :::3000`

**Fix**:
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID)
taskkill /PID <PID> /F

# Or use different port
$env:PORT=3001; npm start
```

---

#### 2. Missing environment variables
**Error**: `WEBHOOK_SECRET is not defined`

**Fix**:
```powershell
# Check if .env exists
cat .env

# If missing, copy from template
cp .env.example .env

# Edit with your keys
notepad .env
```

**Required Variables**:
```env
WEBHOOK_SECRET=your_secret_here
ACCOUNT_BALANCE=10000
RISK_PER_TRADE=1
ALPACA_API_KEY=xxx
ALPACA_SECRET_KEY=xxx
OANDA_API_KEY=xxx
OANDA_ACCOUNT_ID=xxx
```

---

#### 3. Node modules not installed
**Error**: `Cannot find module 'next'`

**Fix**:
```powershell
npm install
```

---

#### 4. Python dependencies missing
**Error**: `ModuleNotFoundError: No module named 'pandas'`

**Fix**:
```powershell
pip install -r requirements.txt

# Or for specific agent
pip install -r scripts/requirements_pivot_pete.txt
```

---

## 🤖 Agents Not Showing Up

### Symptoms
- Dashboard shows empty agent list
- `/agents` page displays "No agents found"
- Agent cards show "Status: Unknown"

### Diagnostics
```powershell
# Check if Agent Runner is running
pm2 list | findstr agent-runner

# View Agent Runner logs
pm2 logs agent-runner --lines 100

# Check agents_db.json exists and is valid
cat src/app/api/agents/agents_db.json
```

### Fixes

#### 1. agents_db.json missing or corrupted
**Fix**:
```powershell
# Restore from backup (if exists)
cp src/app/api/agents/agents_db.json.backup src/app/api/agents/agents_db.json

# Or recreate with default structure
notepad src/app/api/agents/agents_db.json
```

**Default Structure**:
```json
{
  "pivot-pete": {
    "id": "pivot-pete",
    "name": "Pivot Pete",
    "status": "idle",
    "market": "Futures",
    "daily_pnl": 0,
    "total_pnl": 0
  }
}
```

---

#### 2. Agent Runner not spawning agents
**Symptoms**: Agent Runner running but no Python processes

**Fix**:
```powershell
# Check Python is installed
python --version

# Restart Agent Runner
pm2 restart agent-runner

# Check if Python agents are spawned
pm2 list
```

**Look for**: `pivot-pete`, `boba-trades`, `bitcoin-bob`, etc. in PM2 list

---

#### 3. Agents crashing immediately
**Symptoms**: Agents appear then disappear, crash loops

**Fix**:
```powershell
# View specific agent logs
pm2 logs pivot-pete --lines 50

# Common issues:
# - Missing env vars (ALPACA_API_KEY, etc.)
# - Python package import errors
# - Broker API connection failures
```

---

## 📊 Dashboard Shows Stale Data

### Symptoms
- Agent status not updating
- Trades not appearing after execution
- Old P&L numbers

### Diagnostics
```powershell
# Check if API routes are responding
curl http://localhost:3000/api/agents

# Check database file is writable
ls -la swjsh.db

# Check agents_db.json timestamp
ls -la src/app/api/agents/agents_db.json
```

### Fixes

#### 1. Agents not emitting status updates
**Check Python agent code**:
```python
# Should have this in agent loop
print(f"AGENT_STATUS_UPDATE:{json.dumps(status)}")
sys.stdout.flush()  # Important!
```

**Fix**: Add `sys.stdout.flush()` after print statements

---

#### 2. Agent Runner not parsing stdout
**Check Agent Runner logs**:
```powershell
pm2 logs agent-runner | findstr "AGENT_STATUS_UPDATE"
```

**If no matches**: Agent Runner isn't receiving updates

**Fix**:
```powershell
pm2 restart agent-runner
```

---

#### 3. Frontend not polling API
**Check browser console**:
- F12 → Console
- Look for errors fetching `/api/agents`

**Fix**: Clear browser cache and refresh

---

## 💥 Trades Not Executing

### Symptoms
- Signals generated but no trades in database
- Agent shows "Signal detected" but position not opened
- Broker errors in logs

### Diagnostics
```powershell
# Check signals table
sqlite3 swjsh.db "SELECT * FROM signals ORDER BY timestamp DESC LIMIT 10;"

# Check agent logs for broker errors
pm2 logs pivot-pete | findstr "error"

# Verify broker API keys
echo $ALPACA_API_KEY
echo $OANDA_API_KEY
```

### Fixes

#### 1. Kill switch active
**Check**:
```powershell
curl -X POST http://localhost:3000/api/control -H "Content-Type: application/json" -d '{"command": "status"}'
```

**If `kill_switch_active: true`**:
```powershell
curl -X POST http://localhost:3000/api/control -H "Content-Type: application/json" -d '{"command": "killswitch_reset"}'
```

---

#### 2. Invalid broker credentials
**Symptoms**: `401 Unauthorized` or `403 Forbidden` in logs

**Fix**:
```powershell
# Verify keys are correct in .env
cat .env | findstr ALPACA
cat .env | findstr OANDA

# Test Alpaca connection
curl -H "APCA-API-KEY-ID: $ALPACA_API_KEY" \
     -H "APCA-API-SECRET-KEY: $ALPACA_SECRET_KEY" \
     https://paper-api.alpaca.markets/v2/account

# If invalid, regenerate keys from broker dashboard
```

---

#### 3. Insufficient buying power
**Symptoms**: `Insufficient funds` error

**Check Account Balance**:
```powershell
# Alpaca
curl -H "APCA-API-KEY-ID: $ALPACA_API_KEY" \
     -H "APCA-API-SECRET-KEY: $ALPACA_SECRET_KEY" \
     https://paper-api.alpaca.markets/v2/account | jq .buying_power

# OANDA
curl -H "Authorization: Bearer $OANDA_API_KEY" \
     https://api-fxpractice.oanda.com/v3/accounts/$OANDA_ACCOUNT_ID | jq .account.balance
```

**Fix**: Add funds to paper trading account or reduce position size

---

#### 4. Market closed
**Symptoms**: `Market is closed` error

**Check Market Hours**:
- **Stocks**: Mon-Fri 9:30 AM - 4:00 PM ET
- **Futures**: Nearly 24/5 (Sun 6 PM - Fri 5 PM ET)
- **Forex**: 24/5 (Sun 5 PM - Fri 5 PM ET)
- **Crypto**: 24/7

**Fix**: Wait for market open or use appropriate instrument

---

## 🔌 Webhook Not Receiving Signals

### Symptoms
- TradingView alerts configured but not appearing in `signals` table
- Webhook URL returns error when tested

### Diagnostics
```powershell
# Test webhook endpoint
curl -X POST http://localhost:3000/api/webhook/tradingview \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_SECRET" \
  -d '{"symbol": "ES", "action": "buy", "price": 5850}'

# Check signals table
sqlite3 swjsh.db "SELECT * FROM signals ORDER BY timestamp DESC LIMIT 5;"
```

### Fixes

#### 1. Wrong webhook secret
**Error**: `401 Unauthorized`

**Fix**:
```powershell
# Verify secret matches TradingView alert config
cat .env | findstr WEBHOOK_SECRET

# Update TradingView alert:
# Settings → Notifications → Webhook URL
# Add header: X-Webhook-Secret: <your_secret>
```

---

#### 2. Localhost not accessible from TradingView
**Issue**: TradingView can't reach `localhost:3000`

**Fix**: Use ngrok or similar tunnel
```powershell
# Install ngrok
choco install ngrok

# Create tunnel
ngrok http 3000

# Use ngrok URL in TradingView webhook
# Example: https://abc123.ngrok.io/api/webhook/tradingview
```

---

#### 3. Malformed alert message
**Check TradingView alert format**:
```json
{
  "symbol": "{{ticker}}",
  "action": "buy",
  "price": {{close}},
  "strategy": "ORB"
}
```

---

## 🐛 Multiple Agent Instances

### Symptoms
- Same trade executed twice
- Duplicate positions
- Agent P&L doubling up

### Cause
Running Python agents directly instead of via Agent Runner

### Fix
```powershell
# Kill all Python processes
taskkill /F /IM python.exe

# Restart properly via START_SWJSH.ps1
./START_SWJSH.ps1

# Verify only one instance per agent
pm2 list
```

**Prevention**: Never run `python scripts/*_engine.py` directly

---

## 💾 Database Locked

### Symptoms
- `database is locked` error
- API routes timeout
- Trades not saving

### Cause
Multiple processes trying to write simultaneously (SQLite limitation)

### Fix
```powershell
# Check for zombie processes holding DB lock
tasklist | findstr node
tasklist | findstr python

# Kill all and restart
pm2 delete all
./START_SWJSH.ps1

# If persists, backup and recreate DB
cp swjsh.db swjsh.db.backup
rm swjsh.db
# Restart app (DB will auto-initialize)
```

---

## 🔥 Emergency: Everything is Broken

### Nuclear Option

```powershell
# 1. Stop everything
pm2 delete all
taskkill /F /IM node.exe
taskkill /F /IM python.exe

# 2. Backup critical data
cp swjsh.db backups/swjsh_emergency.db
cp src/app/api/agents/agents_db.json backups/agents_emergency.json

# 3. Clean reinstall dependencies
rm -rf node_modules
npm install
pip install -r requirements.txt

# 4. Reset database (optional - loses history)
rm swjsh.db

# 5. Verify environment
cat .env

# 6. Fresh start
./START_SWJSH.ps1

# 7. Verify
pm2 status
curl http://localhost:3000/api/agents
```

---

## 📞 Getting Help

### Before Asking for Help

1. **Check logs**:
```powershell
pm2 logs --lines 100 > debug.log
```

2. **Check system status**:
```powershell
curl -X POST http://localhost:3000/api/control \
  -H "Content-Type: application/json" \
  -d '{"command": "status"}' > status.json
```

3. **Check git branch**:
```powershell
git status
git log --oneline -5
```

### Include in Bug Report
- Logs (`debug.log`)
- System status (`status.json`)
- Environment (OS, Node version, Python version)
- Steps to reproduce
- Expected vs actual behavior

---

## Related Pages

- [[Connection Map]] - What depends on what
- [[System Architecture]] - How components connect
- [[Agent System]] - Agent orchestration
- [[Database Schema]] - Database structure
- [[Startup Commands]] - Proper startup procedure
