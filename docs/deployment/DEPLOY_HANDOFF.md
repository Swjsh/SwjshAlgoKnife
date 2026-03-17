# SwjshAK Deployment Handoff — For Claude CLI

> **Purpose**: This file is a step-by-step deployment script designed to be run by Claude CLI (`claude`) in a new terminal on Jack's Windows PC. Each phase is self-contained with verification steps. Run them in order.
>
> **Context**: Jack has a GCP VM (`swjsh-server` in `us-central1-a`, project `swjsh-algo-knife`) running an e2-small. He just bought `swjsh.app` on Cloudflare. The codebase is at `C:\Users\jackw\Documents\GitHub\SwjshAlgoKnife`.

---

## PRE-FLIGHT: GCP Instance Assessment

**Current spec**: e2-small (2 vCPU, 2 GB RAM, ~$13/month)

**What it needs to run**:
- Next.js dashboard (~200-400 MB)
- Agent Runner + 5-7 Python agents with pandas/numpy (~400-700 MB)
- Watchdog (~30 MB)
- OpenClaw gateway (~100-200 MB)
- Brain sync (~negligible)
- Caddy (~20 MB)
- OS overhead (~200 MB)

**Total**: ~950 MB – 1.5 GB typical, spikes to 1.8 GB+ under load.

**Verdict**: 2 GB is tight but workable WITH swap. Without swap, you'll get OOM-killed during spikes (npm build, multiple agents starting simultaneously). Two options:

- **Option A (recommended, free)**: Add 2 GB swap file to the e2-small. Total effective memory: 4 GB. Cost: $0 extra.
- **Option B (paid)**: Upgrade to e2-medium (4 GB RAM, ~$25/month). Cleaner but costs more.

The deploy script below implements Option A (swap) automatically.

---

## PHASE 1: Cloudflare DNS Setup (Manual — Jack does this)

Jack needs to do this in the Cloudflare dashboard before anything else:

1. Go to https://dash.cloudflare.com → select `swjsh.app`
2. Navigate to **DNS → Records**
3. Add an **A record**:
   - Name: `@` (root domain)
   - IPv4: `<GCP external IP>` (get it from Phase 2 below)
   - Proxy status: **DNS only** (grey cloud) — important for Let's Encrypt
   - TTL: Auto
4. Optional: Add a **CNAME** record:
   - Name: `www`
   - Target: `swjsh.app`
   - Proxy status: DNS only
5. Navigate to **SSL/TLS → Overview**
   - Set encryption mode to **Off** (Caddy handles TLS end-to-end)
   - We'll switch to "Full (Strict)" later if we enable Cloudflare proxy

**Get the GCP external IP first**:
```powershell
gcloud compute instances describe swjsh-server --zone=us-central1-a --project=swjsh-algo-knife --format="get(networkInterfaces[0].accessConfigs[0].natIP)"
```

---

## PHASE 2: Deploy Application to GCP

Run from the repo root (`C:\Users\jackw\Documents\GitHub\SwjshAlgoKnife`).

```powershell
# Step 2.1: Verify GCP connectivity
gcloud compute instances describe swjsh-server --zone=us-central1-a --project=swjsh-algo-knife --format="get(status)"
# Expected: RUNNING (if TERMINATED, start it first)

# Step 2.2: Deploy using the hardened deploy script
.\PUSH_TO_GCP_V2.ps1
# This handles: zip → upload → extract → npm install → build → docker compose up → verify
# Expected: "Deploy Complete!" with health check passing

# Step 2.3: Verify container is running
gcloud compute ssh swjsh-server --zone=us-central1-a --project=swjsh-algo-knife --command="docker ps && echo '---' && docker compose -f ~/SwjshAlgoKnife/docker-compose.yml logs --tail=20"
```

**Checkpoint**: Container should be `Up` and `/api/health` returning 200.

---

## PHASE 3: Add Swap Space (Prevents OOM kills)

SSH into the GCP VM and add a 2 GB swap file:

```powershell
gcloud compute ssh swjsh-server --zone=us-central1-a --project=swjsh-algo-knife --command="
    # Check if swap already exists
    if swapon --show | grep -q swapfile; then
        echo 'Swap already configured:'
        swapon --show
        free -h
    else
        echo 'Adding 2GB swap...'
        sudo fallocate -l 2G /swapfile
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        # Make persistent across reboots
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
        # Tune swappiness (10 = only swap under pressure)
        sudo sysctl vm.swappiness=10
        echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
        echo 'Done. Memory status:'
        free -h
    fi
"
```

**Checkpoint**: `free -h` should show ~2 GB RAM + 2 GB swap.

---

## PHASE 4: Install Caddy + HTTPS for swjsh.app

```powershell
# Step 4.1: Upload the Caddyfile and setup script
gcloud compute scp deploy/Caddyfile swjsh-server:~/SwjshAlgoKnife/deploy/Caddyfile --zone=us-central1-a --project=swjsh-algo-knife
gcloud compute scp deploy/setup-caddy-gcp.sh swjsh-server:~/SwjshAlgoKnife/deploy/setup-caddy-gcp.sh --zone=us-central1-a --project=swjsh-algo-knife

# Step 4.2: Run the Caddy setup (installs, configures firewall, starts service)
gcloud compute ssh swjsh-server --zone=us-central1-a --project=swjsh-algo-knife --command="sudo bash ~/SwjshAlgoKnife/deploy/setup-caddy-gcp.sh --auto"

# Step 4.3: Wait 30 seconds for Let's Encrypt cert provisioning, then verify
# (Let's Encrypt needs time to issue the cert on first run)
Start-Sleep -Seconds 30

# Step 4.4: Test from your local machine
Invoke-RestMethod -Uri "https://swjsh.app/api/health" -Method GET
# Expected: JSON with status "ok" or similar
```

**Checkpoint**: `https://swjsh.app` loads the dashboard with a valid TLS cert (no browser warnings).

**If cert provisioning fails** (usually because DNS isn't pointed yet):
```powershell
# Check Caddy logs for ACME errors
gcloud compute ssh swjsh-server --zone=us-central1-a --project=swjsh-algo-knife --command="sudo journalctl -u caddy -n 30"

# Verify DNS is correct
nslookup swjsh.app
# Should return the GCP external IP
```

---

## PHASE 5: Install External Health Monitor

This runs on the VM host (outside Docker) and alerts Discord if the container dies.

```powershell
# Step 5.1: Upload scripts
gcloud compute scp scripts/external-healthcheck.sh swjsh-server:~/SwjshAlgoKnife/scripts/external-healthcheck.sh --zone=us-central1-a --project=swjsh-algo-knife
gcloud compute scp scripts/setup-external-healthcheck.sh swjsh-server:~/SwjshAlgoKnife/scripts/setup-external-healthcheck.sh --zone=us-central1-a --project=swjsh-algo-knife

# Step 5.2: Install as systemd service
# Replace the webhook URL with your actual Discord Chief webhook
gcloud compute ssh swjsh-server --zone=us-central1-a --project=swjsh-algo-knife --command="sudo bash ~/SwjshAlgoKnife/scripts/setup-external-healthcheck.sh"

# Step 5.3: Verify it's running
gcloud compute ssh swjsh-server --zone=us-central1-a --project=swjsh-algo-knife --command="
    systemctl status swjshak-healthcheck 2>/dev/null || echo 'Service not found'
    echo '---'
    cat /var/log/swjshak-healthcheck.log 2>/dev/null | tail -5 || echo 'No logs yet'
"
```

**Checkpoint**: Service should be `active (running)` and logs showing successful health checks.

---

## PHASE 6: Setup Brain Sync Pipeline

This creates the automated Obsidian → Git → GCP brain sync.

### 6a: Local side (Windows — push brain to git)

```powershell
# Step 6a.1: Create the brain-sync branch if it doesn't exist
cd C:\Users\jackw\Documents\GitHub\SwjshAlgoKnife
git checkout -b brain-sync 2>$null; git checkout brain-sync

# Step 6a.2: Run the sync once manually to verify
.\scripts\sync-brain-to-git.ps1

# Step 6a.3: Setup the Windows Scheduled Task (runs every 5 min)
powershell -ExecutionPolicy Bypass -File scripts\setup-brain-sync-task.ps1

# Step 6a.4: Verify the task was created
schtasks /query /tn SwjshAK-BrainSync /v | Select-String "Status|Next Run"

# Step 6a.5: Switch back to main branch for normal development
git checkout main
```

### 6b: GCP side (Docker pulls brain from git)

The brain-sync process is already in `supervisord.conf` (added in the previous session). It just needs the `GIT_REPO_URL` environment variable set in the Docker container.

```powershell
# Step 6b.1: Set the repo URL in the Docker environment
# Add to .env.local: GIT_REPO_URL=https://github.com/jackwatergun/SwjshAlgoKnife.git
# (Or whatever your GitHub repo URL is)

gcloud compute ssh swjsh-server --zone=us-central1-a --project=swjsh-algo-knife --command="
    cd ~/SwjshAlgoKnife
    grep -q GIT_REPO_URL .env.local || echo 'GIT_REPO_URL=https://github.com/jackwatergun/SwjshAlgoKnife.git' >> .env.local
    echo 'GIT_REPO_URL set. Restarting container...'
    docker compose down && docker compose up -d
"

# Step 6b.2: Verify brain-sync is running inside the container
Start-Sleep -Seconds 30
gcloud compute ssh swjsh-server --zone=us-central1-a --project=swjsh-algo-knife --command="
    docker exec swjshak supervisorctl status brain-sync 2>/dev/null || echo 'brain-sync not found in supervisord'
    echo '---'
    docker exec swjshak cat /app/data/logs/brain-sync.log 2>/dev/null | tail -5 || echo 'No brain-sync logs yet'
"
```

**Checkpoint**: `brain-sync` process should show `RUNNING` in supervisord status.

---

## PHASE 7: Setup Claude → GCP Bridge Scripts

These let you (or a Claude CLI session) query GCP status from your local machine.

```powershell
# Test the status bridge
.\scripts\gcp-status.ps1

# Test with quick mode (just container + processes)
.\scripts\gcp-status.ps1 --Quick

# Test sending a command (get system summary)
.\scripts\gcp-command.ps1 -Command "summary"
```

**Checkpoint**: Status script returns live data from GCP. Command script can pause/resume agents.

---

## PHASE 8: Final Verification Checklist

Run these checks to confirm everything is working end-to-end:

```powershell
Write-Host "=== FINAL VERIFICATION ===" -ForegroundColor Cyan

# 1. Dashboard accessible via HTTPS
Write-Host "`n[1/6] Dashboard HTTPS..." -ForegroundColor Yellow
try {
    $r = Invoke-RestMethod -Uri "https://swjsh.app/api/health" -TimeoutSec 10
    Write-Host "  PASS: $($r | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Host "  FAIL: $_" -ForegroundColor Red
}

# 2. TradingView webhook endpoint accessible (should accept POST)
Write-Host "`n[2/6] Webhook endpoint..." -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "https://swjsh.app/api/webhook/tradingview" -Method POST -Body '{}' -ContentType "application/json" -TimeoutSec 10
    Write-Host "  PASS: HTTP $($r.StatusCode)" -ForegroundColor Green
} catch {
    # 401/403 is expected (missing webhook secret), anything else is a problem
    if ($_.Exception.Response.StatusCode.value__ -in 400,401,403) {
        Write-Host "  PASS: HTTP $($_.Exception.Response.StatusCode.value__) (auth required, expected)" -ForegroundColor Green
    } else {
        Write-Host "  FAIL: $_" -ForegroundColor Red
    }
}

# 3. Control API accessible
Write-Host "`n[3/6] Control API..." -ForegroundColor Yellow
try {
    $r = Invoke-RestMethod -Uri "https://swjsh.app/api/control" -TimeoutSec 10
    Write-Host "  PASS: Got control response" -ForegroundColor Green
} catch {
    Write-Host "  FAIL: $_" -ForegroundColor Red
}

# 4. Container processes (via SSH)
Write-Host "`n[4/6] Supervisord processes..." -ForegroundColor Yellow
$procs = gcloud compute ssh swjsh-server --zone=us-central1-a --project=swjsh-algo-knife --quiet --command="docker exec swjshak supervisorctl status 2>/dev/null" 2>&1
$procs | ForEach-Object {
    if ($_ -match "RUNNING") { Write-Host "  PASS: $_" -ForegroundColor Green }
    elseif ($_ -match "FATAL|EXITED") { Write-Host "  FAIL: $_" -ForegroundColor Red }
    else { Write-Host "  INFO: $_" -ForegroundColor DarkGray }
}

# 5. External healthcheck service
Write-Host "`n[5/6] External health monitor..." -ForegroundColor Yellow
$hc = gcloud compute ssh swjsh-server --zone=us-central1-a --project=swjsh-algo-knife --quiet --command="systemctl is-active swjshak-healthcheck 2>/dev/null || echo 'not-installed'" 2>&1
if ($hc -match "active") { Write-Host "  PASS: Health monitor running" -ForegroundColor Green }
else { Write-Host "  WARN: $hc" -ForegroundColor Yellow }

# 6. Brain sync (local side)
Write-Host "`n[6/6] Brain sync task..." -ForegroundColor Yellow
$task = schtasks /query /tn SwjshAK-BrainSync 2>&1
if ($task -match "Ready|Running") { Write-Host "  PASS: Brain sync task is active" -ForegroundColor Green }
else { Write-Host "  WARN: Brain sync task not found or not ready" -ForegroundColor Yellow }

Write-Host "`n=== DONE ===" -ForegroundColor Cyan
```

---

## TROUBLESHOOTING

### Caddy won't start / cert error
```powershell
gcloud compute ssh swjsh-server --zone=us-central1-a --project=swjsh-algo-knife --command="sudo journalctl -u caddy -n 50"
```
Common cause: DNS not pointing to GCP IP yet. Verify with `nslookup swjsh.app`.

### Container OOM-killed
```powershell
gcloud compute ssh swjsh-server --zone=us-central1-a --project=swjsh-algo-knife --command="dmesg | grep -i oom | tail -10 && free -h"
```
Fix: Ensure swap is enabled (Phase 3).

### Brain sync not pulling
```powershell
gcloud compute ssh swjsh-server --zone=us-central1-a --project=swjsh-algo-knife --command="docker exec swjshak cat /app/data/logs/brain-sync.log | tail -20"
```
Common cause: `GIT_REPO_URL` not set, or repo is private (needs auth token in URL).

### Agents not starting
```powershell
gcloud compute ssh swjsh-server --zone=us-central1-a --project=swjsh-algo-knife --command="docker exec swjshak cat /app/data/logs/runner.log | tail -30"
```

---

## POST-DEPLOYMENT: Update TradingView Webhooks

If you have TradingView alerts configured, update the webhook URL:
- Old: `http://<GCP-IP>:3000/api/webhook/tradingview`
- New: `https://swjsh.app/api/webhook/tradingview`

Same `X-Webhook-Secret` header, just the URL changes.

---

## FUTURE UPGRADES

### Enable Cloudflare Proxy (DDoS protection + CDN)
1. Cloudflare Dashboard → SSL/TLS → Origin Server → Create Certificate
2. Download cert + key, SCP to server as `/etc/caddy/origin.pem` and `/etc/caddy/origin-key.pem`
3. Edit `/etc/caddy/Caddyfile` — uncomment the `tls` line
4. Cloudflare Dashboard → SSL/TLS → set mode to "Full (Strict)"
5. Cloudflare DNS → change A record to proxy ON (orange cloud)
6. `sudo systemctl reload caddy`

### Upgrade to e2-medium (if swap isn't enough)
```powershell
gcloud compute instances stop swjsh-server --zone=us-central1-a
gcloud compute instances set-machine-type swjsh-server --zone=us-central1-a --machine-type=e2-medium
gcloud compute instances start swjsh-server --zone=us-central1-a
```
Cost: ~$12/month more. Worth it if you see frequent OOM kills.
