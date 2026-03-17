# SwjshAK — Cloud Deployment Guide

One command deploys everything: Next.js dashboard, Bitcoin Bob, and Sterling FX.
No more PowerShell windows. The server runs 24/7 even when your laptop is off.

---

## Option A — Fly.io (~$4/month, easiest)

Fly.io gives you $5/month credit. One VM running everything costs ~$3.83/month.
**Effectively free** for this workload.

### One-time setup (10 minutes)

**1. Install flyctl**
```powershell
# Windows PowerShell (one-liner)
iwr https://fly.io/install.ps1 -useb | iex
```

**2. Create account + login**
```powershell
fly auth signup   # or: fly auth login
```

**3. Create the app (only do this ONCE)**
```powershell
# From your project folder:
cd C:\Users\jackw\Desktop\SwjshAlgoKnife

fly launch --no-deploy --name swjsh-ak --region iad
# Answer: Yes to using existing fly.toml
# Answer: No to creating a Postgres DB
# Answer: No to creating a Redis DB
```

**4. Create the persistent volume for SQLite (only ONCE)**
```powershell
fly volumes create swjsh_data --region iad --size 1
```

**5. Set your secrets (API keys) — paste these one at a time**
```powershell
fly secrets set WEBHOOK_SECRET="swjshak-tv-webhook-2026"
fly secrets set OANDA_API_TOKEN="4755faf2a5634827034f5c0743be9609-4bfe2ec07692b00710da22bb1c69ff0f"
fly secrets set OANDA_ACCOUNT_ID="101-001-38356376-001"
fly secrets set APCA_API_KEY_ID="PKD6IYBN5PE5NKUZGVEJBOF7AF"
fly secrets set APCA_API_SECRET_KEY="Ec2KmMbkepoPNhRx3H44if9F5BXAQYPj4fnbobUaA26X"
fly secrets set APCA_API_BASE_URL="https://paper-api.alpaca.markets"
fly secrets set DISCORD_CHIEF_WEBHOOK="https://discord.com/api/webhooks/1475146342027362316/DfjqAfF6TCfXPzW2GgHN_LOHi5IbArxJd3QcUMMvSFC2q9G1oTo91LYLJRPmbIK98m8u"
fly secrets set DISCORD_FOREX_WEBHOOK="https://discord.com/api/webhooks/1482388052063289397/S4RLj1unO-OJ7wC_AHCKK_0ihdUUDiDTvtr6dRAv7M_CL1cffsT5WwIcWYZVtX-OT_KE"
fly secrets set DISCORD_CRYPTO_WEBHOOK="https://discord.com/api/webhooks/1482388813908021453/G7mUWj9BwrBmst13rQkRynTnEcgc3me9CBTGbS-qVB6fWZWzzBknsluABrtgihq7-05f"
fly secrets set FINNHUB_KEY="d5ulhkpr01qr4f89ldi0d5ulhkpr01qr4f89ldig"
fly secrets set NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyCIgootNcxn_3Y-JA-Fq_lzkHynK3ufQdE"
fly secrets set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="swjshak.firebaseapp.com"
fly secrets set NEXT_PUBLIC_FIREBASE_PROJECT_ID="swjshak"
```

**6. Deploy**
```powershell
fly deploy
# Takes ~3-4 minutes to build and start
```

**7. Open your live dashboard**
```powershell
fly open
# Or visit: https://swjsh-ak.fly.dev
```

---

### Ongoing commands

```powershell
# Redeploy after code changes
fly deploy

# Watch live logs from all 3 processes
fly logs

# Watch just the bots
fly logs --app swjsh-ak | findstr "Bob\|Sterling"

# SSH into the running container
fly ssh console

# Check process status inside the container
fly ssh console -C "supervisorctl status"

# Restart a specific process
fly ssh console -C "supervisorctl restart bitcoin_bob"
fly ssh console -C "supervisorctl restart sterling"
fly ssh console -C "supervisorctl restart nextjs"

# View tail of a log file
fly ssh console -C "tail -f /app/data/logs/bitcoin_bob.log"
fly ssh console -C "tail -f /app/data/logs/sterling.log"

# Check your monthly spend
fly billing
```

---

## Option B — Oracle Cloud (Truly Free Forever)

Oracle Cloud's **Always Free Tier** gives you a real Ubuntu VM at no cost forever.
More setup, but $0/month permanently.

**What you get**: AMD VM, 1 OCPU, 1GB RAM, 50GB storage, 10TB bandwidth/month

**Steps:**

1. Create account at https://cloud.oracle.com (requires credit card for verification, never charged on Always Free tier)

2. Create an Ubuntu 22.04 Compute instance (choose **VM.Standard.E2.1.Micro** — this is the Always Free shape)

3. SSH into your VM:
   ```bash
   ssh ubuntu@<your-vm-ip>
   ```

4. Run the bootstrap script:
   ```bash
   # Install Node.js 20
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs git python3 python3-pip

   # Install PM2 globally
   sudo npm install -g pm2

   # Clone your repo
   git clone https://github.com/YOUR_USERNAME/SwjshAlgoKnife.git
   cd SwjshAlgoKnife

   # Install Python dependencies
   pip3 install yfinance pandas numpy requests

   # Install Node dependencies and build
   npm install
   npm run build

   # Create .env.local with your secrets (copy from your local .env.local)
   nano .env.local

   # Start everything via PM2 (the ecosystem.config.js already defines all processes)
   pm2 start scripts/ecosystem.config.js

   # Save process list + auto-start on reboot
   pm2 save
   pm2 startup
   # (copy and run the command it prints)
   ```

5. Open port 3000 in Oracle's firewall:
   - Oracle Cloud Console → Networking → Virtual Cloud Networks → Security Lists
   - Add Ingress rule: TCP port 3000

6. Your dashboard is live at `http://<your-vm-ip>:3000`

---

## Which should I pick?

| | Fly.io | Oracle Cloud |
|---|---|---|
| Cost | ~$4/mo (within free credits) | $0 forever |
| Setup time | 10 minutes | 30-45 minutes |
| HTTPS | Automatic ✅ | Manual setup needed |
| Logs | `fly logs` | `pm2 logs` |
| Redeploy | `fly deploy` | `git pull && npm run build && pm2 restart all` |
| Best for | Getting running fast | Truly free, long-term |

**Recommendation**: Start with Fly.io. If you want to go fully free later, migrate to Oracle Cloud.

---

## After deploying

Your Discord will start receiving notifications as soon as the bots find and enter zones.

The live dashboard is at your Fly.io URL (or VM IP). The `/trades` page auto-refreshes every 10 seconds showing every trade the bots make, their Professor grades, and the running equity curve.

To update the app after making code changes:
```powershell
git add . && git commit -m "update"
fly deploy
```
Takes ~3 minutes. Zero downtime.
