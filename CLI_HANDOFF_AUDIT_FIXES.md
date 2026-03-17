# CLI Handoff — Post-Audit Server-Side Fixes

> **Context**: The March 16, 2026 Systems Audit found 4 CRITICAL, 7 HIGH, and 14 MEDIUM issues.
> All codebase fixes have been applied locally. This handoff covers tasks that require SSH server access,
> env var configuration, or Docker rebuild on the Contabo VPS.

> **Server**: Use `python scripts/server_creds.py retrieve` for connection details.

---

## HANDOFF PROMPT — Copy to Claude CLI

```
You are completing post-audit fixes on the SwjshAlgoKnife Contabo VPS.
Server credentials: run `python scripts/server_creds.py ssh` locally for the connection command.

All codebase fixes have been applied and committed to the repo. Your tasks are:

## TASK 1: PULL UPDATED CODE AND REBUILD (10 min)

SSH into the server, then:

cd /home/jackw/SwjshAlgoKnife
git pull origin main

# Rebuild Docker image with all security fixes
docker compose build --no-cache
docker compose down
docker compose up -d

# Verify container health
docker compose logs -f --tail=30
# Wait for all 4 supervisord processes to show RUNNING
docker exec swjshak supervisorctl status


## TASK 2: FILL IN ALL MISSING ENV VARS (CRITICAL — caused 31-day outage)

The following env vars MUST be present in .env.local on the server.
Check the current state:

cat /home/jackw/SwjshAlgoKnife/.env.local

Ensure ALL of these are present and NOT set to "FILL_IN":

### REQUIRED (system won't function without these):
- WEBHOOK_SECRET         — Any strong random string (openssl rand -hex 32)
- ANTHROPIC_API_KEY      — sk-ant-... from console.anthropic.com
- ACCOUNT_BALANCE=10000  — MUST be 10000, NOT 100000 (audit found 10x mismatch)
- RISK_PER_TRADE=1       — 1% per trade
- CONTROL_API_KEY        — Generate with: openssl rand -hex 32 (NEW — secures /api/control)

### REQUIRED FOR TRADING:
- APCA_API_KEY_ID        — From Alpaca dashboard
- APCA_API_SECRET_KEY    — From Alpaca dashboard
- APCA_API_BASE_URL=https://paper-api.alpaca.markets
- OANDA_API_TOKEN        — From OANDA practice account
- OANDA_ACCOUNT_ID       — OANDA account number (NOT the placeholder "your_demo_account_id")

### REQUIRED FOR NOTIFICATIONS:
- DISCORD_BOT_TOKEN      — From Discord developer portal
- DISCORD_CHANNEL_ID     — Channel snowflake ID
- DISCORD_CHIEF_WEBHOOK  — Webhook URL for #chief-main channel

### REQUIRED FOR OPENCLAW:
- OPENCLAW_GATEWAY_TOKEN — Generate with: openssl rand -hex 32

If any value says "FILL_IN" or is a placeholder, ASK JACK for the real value.
Do NOT proceed with deployment until all required vars are set.

After filling in, restart the container:
docker compose restart


## TASK 3: CONFIGURE CONTROL_API_KEY (NEW — from audit)

The audit added authentication to the Control API. Generate a key:

export CONTROL_KEY=$(openssl rand -hex 32)
echo "CONTROL_API_KEY=$CONTROL_KEY" >> /home/jackw/SwjshAlgoKnife/.env.local
echo "Save this key — OpenClaw cron jobs need it for /api/control calls."

Also add it to the OpenClaw environment:
echo "CONTROL_API_KEY=$CONTROL_KEY" >> /root/.openclaw/.env

Restart services:
docker compose restart
systemctl restart openclaw


## TASK 4: VERIFY SECURITY FIXES ACTIVE

After restart, verify each audit fix is working:

### 4.1 Webhook now REQUIRES secret
curl -s -X POST http://localhost:3000/api/webhook/tradingview \
  -H "Content-Type: application/json" \
  -d '{"symbol":"TEST","action":"BUY","price":100}' | python3 -m json.tool
# EXPECTED: {"error":"Unauthorized"} with status 401 (no secret = rejected)

### 4.2 Control API now requires key
curl -s http://localhost:3000/api/control | python3 -m json.tool
# In production: EXPECTED: {"error":"Control API is not configured..."} with status 503 (if no key)
# OR: {"error":"Unauthorized..."} with status 401 (if key set but not provided)

### 4.3 Brain API blocks path traversal
curl -s "http://localhost:3000/api/brain?file=../../../etc/passwd" | python3 -m json.tool
# EXPECTED: null or empty response (NOT the contents of /etc/passwd)

### 4.4 Agent chat requires auth
curl -s http://localhost:3000/api/agents/chat | python3 -m json.tool
# EXPECTED: {"error":"Unauthorized: No session cookie"} with status 401

### 4.5 Watchdog Tier 0 pipeline check active
docker exec swjshak grep -c "Tier 0" /app/data/logs/watchdog.log
# EXPECTED: At least 1 (pipeline health check is running)

### 4.6 Trade status includes PENDING and REJECTED
docker exec swjshak python3 -c "
import sqlite3
conn = sqlite3.connect('/app/data/journal.db')
schema = conn.execute('SELECT sql FROM sqlite_master WHERE name=\"trades\"').fetchone()
print(schema[0] if schema else 'NO TRADES TABLE')
conn.close()
"
# EXPECTED: Schema should include PENDING and REJECTED in CHECK constraint


## TASK 5: RECONCILE ACCOUNT BALANCE (CRITICAL)

The audit found the DB was initialized with $100,000 but brain docs say $10,000.
This could cause 10x position sizing errors.

Check current DB balance:
docker exec swjshak python3 -c "
import sqlite3
conn = sqlite3.connect('/app/data/journal.db')
try:
    row = conn.execute('SELECT value FROM settings WHERE key=\"account_balance\"').fetchone()
    print(f'DB balance: {row[0] if row else \"NOT SET\"}')
except:
    print('settings table not found or empty')
# Also check accounts table
try:
    row = conn.execute('SELECT initial_capital, current_capital FROM accounts LIMIT 1').fetchone()
    print(f'Account capital: initial={row[0]}, current={row[1]}' if row else 'No accounts')
except:
    print('accounts table not found')
conn.close()
"

If it shows 100000, fix it:
docker exec swjshak python3 -c "
import sqlite3
conn = sqlite3.connect('/app/data/journal.db')
conn.execute('UPDATE settings SET value=\"10000\" WHERE key=\"account_balance\"')
conn.execute('UPDATE accounts SET initial_capital=10000, current_capital=10000 WHERE id=1')
conn.commit()
print('Balance corrected to 10000')
conn.close()
"


## TASK 6: OPENCLAW PATH FIXES

Verify OpenClaw config has correct paths (root, not jackw):
grep -c "/root/.openclaw" /root/.openclaw/openclaw.json
# Should show multiple matches

If it still says /home/jackw/.openclaw:
sed -i 's|/home/jackw/.openclaw|/root/.openclaw|g' /root/.openclaw/openclaw.json

Verify cron jobs loaded:
curl -s -H "Authorization: Bearer $(grep OPENCLAW_GATEWAY_TOKEN /root/.openclaw/.env | cut -d= -f2)" \
  http://127.0.0.1:3001/api/cron/jobs 2>/dev/null | python3 -m json.tool | head -10


## TASK 7: VERIFY FULL AUTONOMOUS LOOP

Run the 7-point check:

echo "=== AUTONOMOUS LOOP VERIFICATION ==="

# 1. Dashboard
echo -n "1. Dashboard: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health
echo ""

# 2. Agent Runner
echo -n "2. Agent Runner: "
docker exec swjshak supervisorctl status runner | awk '{print $2}'

# 3. Watchdog
echo -n "3. Watchdog: "
docker exec swjshak supervisorctl status watchdog | awk '{print $2}'

# 4. agents_db.json
echo -n "4. Agents DB: "
docker exec swjshak python3 -c "import json; d=json.load(open('/app/data/agents_db.json')); print(f'{len(d)} agents tracked')"

# 5. Brain files
echo -n "5. Brain files: "
ls /home/jackw/SwjshAlgoKnife/data/brain/*.md 2>/dev/null | wc -l
echo " core files"

# 6. OpenClaw gateway
echo -n "6. OpenClaw: "
systemctl is-active openclaw

# 7. Cron jobs
echo -n "7. Cron jobs: "
curl -s http://127.0.0.1:3001/api/cron/jobs 2>/dev/null | python3 -c "import sys,json; print(f'{len(json.load(sys.stdin))} jobs')" 2>/dev/null || echo "Cannot query"

echo "=== DONE ==="

ALL 7 checks should pass. If any fail, investigate and fix before considering deployment complete.


## TASK 8: DELETE OLD GCP VMS (After Contabo confirmed working)

Only after ALL above tasks pass:

# List GCP instances
gcloud compute instances list --project=swjsh-algo-knife
gcloud compute instances list --project=ethoscanorg

# If both Contabo is working, delete:
gcloud compute instances delete swjsh-server --zone=us-central1-a --project=swjsh-algo-knife --quiet
gcloud compute instances delete swjsh-trading --zone=us-east4-c --project=ethoscanorg --quiet

ONLY do this after Jack confirms Contabo is stable for 48+ hours.
```

---

## Summary of What Was Fixed in Code (Already Committed)

| # | Severity | Fix | File |
|---|----------|-----|------|
| 1 | CRITICAL | Path traversal blocked with whitelist + resolve check | `src/app/api/brain/route.ts` |
| 2 | CRITICAL | Trade entry uses PENDING status, broker errors mark REJECTED (not LOSS) | `src/lib/engine/executor.ts` |
| 3 | CRITICAL | DB schema now includes PENDING and REJECTED statuses | `src/lib/db.ts` |
| 4 | HIGH | Timing-safe comparison fixed (no preceding === leak) | `src/app/api/webhook/tradingview/route.ts` |
| 5 | HIGH | Webhook now REJECTS all requests if WEBHOOK_SECRET is unset | `src/app/api/webhook/tradingview/route.ts` |
| 6 | HIGH | userId in webhook payload validated against onboarded users | `src/app/api/webhook/tradingview/route.ts` |
| 7 | HIGH | Authentication added to /api/agents/chat | `src/app/api/agents/chat/route.ts` |
| 8 | HIGH | Mock DB now throws at runtime (only mocks during build) | `src/lib/db.ts` |
| 9 | HIGH | Control API uses timing-safe key comparison + warns in dev | `src/app/api/control/route.ts` |
| 10 | HIGH | Server IP removed from version-controlled files | `CONTABO_SERVER_SETUP.md` |
| 11 | MEDIUM | OANDA pip value now dynamic (JPY, USD-base, USD-quote) | `src/lib/broker/oanda.ts` |
| 12 | MEDIUM | Account balance reads from ACCOUNT_BALANCE env (not hardcoded $100k) | `src/lib/db.ts` |
| 13 | MEDIUM | PBKDF2 iterations upgraded 100k → 600k (OWASP 2024) | `scripts/server_creds.py` |
| 14 | MEDIUM | Watchdog Tier 0 pipeline health checks added | `scripts/watchdog.py` |
| 15 | LEGACY | 4 ghost agents moved to scripts/archive/ | `scripts/archive/` |
| 16 | LEGACY | Legacy .env renamed to .env.LEGACY_BACKUP | `.env.LEGACY_BACKUP` |
