# Environment & Deployment — Operational Reference

> Chief reads this when verifying system health or diagnosing credential issues.
> NEVER log, print, or expose actual credential values. Check PRESENCE only.

---

## GCP VM

- **Instance:** swjsh-trading (e2-small, us-east4-c)
- **OS:** Ubuntu 22.04 LTS
- **User:** jackw
- **Project root:** /home/jackw/SwjshAlgoKnife
- **Data dir:** /home/jackw/SwjshAlgoKnife/data
- **Brain dir:** /home/jackw/SwjshAlgoKnife/data/brain
- **OpenClaw config:** ~/.openclaw/openclaw.json
- **OpenClaw cron:** ~/.openclaw/cron/jobs.json
- **OpenClaw workspace:** ~/.openclaw/workspace/

---

## Required Environment Variables (.env.local)

> ⚠️ Updated 2026-03-17 via system audit — actual .env.local has more vars than originally documented.

| Variable | Purpose | Used By | Check |
|----------|---------|---------|-------|
| WEBHOOK_SECRET | TradingView webhook auth | /api/webhook/tradingview | If missing → all TV signals silently return 401 |
| APCA_API_KEY_ID | Alpaca paper trading key | Trade Executor | If missing → equity/crypto trades fail |
| APCA_API_SECRET_KEY | Alpaca secret | Trade Executor | Paired with above |
| APCA_API_BASE_URL | Alpaca base URL | Trade Executor | Should be https://paper-api.alpaca.markets |
| OANDA_API_TOKEN | OANDA practice account | Sterling (FX) | If missing → FX trades fail |
| OANDA_ACCOUNT_ID | OANDA account identifier | Sterling (FX) | Required for order placement |
| OANDA_ENVIRONMENT | OANDA environment flag | Sterling (FX) | Should be "practice" |
| DISCORD_CHIEF_WEBHOOK | One-way webhook → #chief-main | discord.ts | If missing → trade notifications silent |
| DISCORD_FOREX_WEBHOOK | One-way webhook → #forex | discord.ts | Sterling-specific alerts |
| DISCORD_CRYPTO_WEBHOOK | One-way webhook → #crypto | discord.ts | Bitcoin Bob-specific alerts |
| NEXT_PUBLIC_FINNHUB_KEY | Market data (free tier) | Frontend + agents | For quote lookups |
| ACCOUNT_BALANCE | Base for risk calculations | RiskEngine | Default: 10000 |
| RISK_PER_TRADE | Percentage risk per trade | RiskEngine | Default: 1 |
| CONTROL_API_KEY | Optional auth for Control API | /api/control | If unset → API is open (localhost) — currently unset |

### Firebase Variables (Auth / Multi-user)
> These power the auth system. Not required for trading — only for dashboard login.

| Variable | Purpose |
|---|---|
| NEXT_PUBLIC_FIREBASE_API_KEY | Firebase project key |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | Auth domain |
| NEXT_PUBLIC_FIREBASE_DATABASE_URL | Realtime DB URL |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | Project ID |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET | Storage bucket |
| NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | FCM sender |
| NEXT_PUBLIC_FIREBASE_APP_ID | App ID |
| NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID | Analytics ID |

**All variables confirmed PRESENT as of 2026-03-17 audit.** ✅

---

## OpenClaw Environment (~/.openclaw/.env)

| Variable | Purpose |
|----------|---------|
| ANTHROPIC_API_KEY | Sonnet/Haiku API calls for Chief + agents |
| DISCORD_BOT_TOKEN | Two-way Discord bot (read + write) |
| OPENCLAW_GATEWAY_TOKEN | Auth for watchdog → gateway wake_chief() calls |

---

## Supervisord Environment Variables

Set in supervisord.conf per process:
- NODE_ENV=production
- DATA_DIR=/app/data (or /home/jackw/SwjshAlgoKnife/data)
- AGENTS_DB_PATH=/app/data/agents_db.json
- DATABASE_PATH=/app/data/journal.db
- APP_DIR=/app (for watchdog)
- OPENCLAW_GATEWAY=http://127.0.0.1:3001 (for watchdog)

---

## Health Check Procedure

Chief runs this when verifying system health:

```
1. curl -s http://localhost:3000/api/health     → Dashboard up?
2. curl -s http://localhost:3000/api/control     → Control API up?
3. Check .env.local key presence (ls -la, not cat)
4. Check agents_db.json freshness (last_updated timestamps)
5. Check journal.db accessibility (simple SELECT COUNT(*) FROM trades)
6. Check OpenClaw gateway: curl -s http://localhost:3001/health
7. Check supervisorctl status → all 4 processes RUNNING?
8. Check disk: df -h /
9. Check logs for errors: tail -20 data/logs/*_err.log
```

---

## Deployment Commands

```bash
# SSH to GCP
gcloud compute ssh swjsh-trading --zone=us-east4-c

# Push code to GCP
gcloud compute scp --recurse . swjsh-trading:~/SwjshAlgoKnife/ --zone=us-east4-c

# Sync brain to GCP
gcloud compute scp --recurse data/brain/ swjsh-trading:~/SwjshAlgoKnife/data/brain/ --zone=us-east4-c

# Restart all services
sudo supervisorctl restart all

# View live logs
tail -f data/logs/runner.log
tail -f data/logs/watchdog.log
tail -f data/logs/openclaw.log

# Check all processes
sudo supervisorctl status
```
