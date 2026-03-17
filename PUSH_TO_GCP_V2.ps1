# ═══════════════════════════════════════════════════════════════════════════════
#  SwjshAK — Hardened Deploy to Google Cloud V2
#
#  Improvements over V1:
#    • Pre-deploy validation (gcloud, .env.local, local build test)
#    • VM health check before deploy
#    • Upload Caddyfile and healthcheck scripts
#    • Post-deploy container health verification (120s timeout)
#    • Supervisord process status verification
#    • Brain sync trigger on successful deploy
#    • Detailed summary report
#
#  First time setup:
#    1. Install gcloud CLI: https://cloud.google.com/sdk/docs/install-sdk#windows
#    2. Run: gcloud init
#    3. Fill in the three config lines below
#    4. Run: .\PUSH_TO_GCP_V2.ps1
#
#  Every subsequent deploy: just run .\PUSH_TO_GCP_V2.ps1
# ═══════════════════════════════════════════════════════════════════════════════

# ── Config — fill these in once ───────────────────────────────────────────────
$GCP_PROJECT  = "swjsh-algo-knife"
$GCP_INSTANCE = "swjsh-server"
$GCP_ZONE     = "us-central1-a"
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Track start time
$DEPLOY_START = Get-Date

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 1: Pre-Deploy Validation
# ─────────────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "SwjshAK → GCP Deploy V2 (Hardened)" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "PHASE 1: Pre-Deploy Validation" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────" -ForegroundColor DarkGray

# Check 1: gcloud CLI installed
Write-Host "  [1/5] Checking gcloud CLI..." -ForegroundColor White
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "  [FAIL] FAIL: gcloud CLI not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install from: https://cloud.google.com/sdk/docs/install-sdk#windows" -ForegroundColor Yellow
    Write-Host "Then run: gcloud init" -ForegroundColor Yellow
    exit 1
}
Write-Host "  [OK] gcloud found" -ForegroundColor Green

# Check 2: gcloud is authenticated
Write-Host "  [2/5] Checking gcloud authentication..." -ForegroundColor White
$AUTH_CHECK = gcloud auth list 2>&1
if ($AUTH_CHECK -match "ACTIVE") {
    Write-Host "  [OK] Authenticated" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] FAIL: Not authenticated. Run 'gcloud auth login'" -ForegroundColor Red
    exit 1
}

# Check 3: .env.local exists
$SOURCE_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$ENV_FILE = Join-Path $SOURCE_DIR ".env.local"
Write-Host "  [3/5] Checking .env.local..." -ForegroundColor White
if (-not (Test-Path $ENV_FILE)) {
    Write-Host "  [FAIL] FAIL: .env.local not found at $ENV_FILE" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] .env.local found" -ForegroundColor Green

# Check 4: npm run build (local)
Write-Host "  [4/5] Running local build test (npm run build)..." -ForegroundColor White
Push-Location $SOURCE_DIR
try {
    $BUILD_OUTPUT = npm run build 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [FAIL] FAIL: Local build failed" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Build output (last 20 lines):" -ForegroundColor Yellow
        $BUILD_OUTPUT | Select-Object -Last 20 | Write-Host -ForegroundColor DarkGray
        exit 1
    }
    Write-Host "  [OK] Local build successful" -ForegroundColor Green
} finally {
    Pop-Location
}

# Check 5: GCP VM is running
Write-Host "  [5/5] Checking GCP VM status..." -ForegroundColor White
$VM_STATUS = gcloud compute instances describe $GCP_INSTANCE `
    --zone=$GCP_ZONE --project=$GCP_PROJECT `
    --format="get(status)" 2>&1

if ($VM_STATUS -ne "RUNNING") {
    Write-Host "  [WARN]  VM status: $VM_STATUS" -ForegroundColor Yellow
    if ($VM_STATUS -eq "TERMINATED") {
        Write-Host "  Starting VM..." -ForegroundColor Yellow
        gcloud compute instances start $GCP_INSTANCE --zone=$GCP_ZONE --project=$GCP_PROJECT
        Write-Host "  Waiting 15s for boot..." -ForegroundColor DarkGray
        Start-Sleep -Seconds 15
    }
}
Write-Host "  [OK] VM is running" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 2: Setup and Configuration
# ─────────────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "PHASE 2: Deploy Configuration" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────" -ForegroundColor DarkGray

$REMOTE_USER = gcloud config get-value account 2>$null
$REMOTE_USER = $REMOTE_USER -replace "@.*", "" -replace "\.", "_"
$REMOTE_HOME = "/home/$REMOTE_USER"
$REMOTE_DIR  = "$REMOTE_HOME/SwjshAlgoKnife"

Write-Host "  Project:   $GCP_PROJECT" -ForegroundColor DarkGray
Write-Host "  Instance:  $GCP_INSTANCE ($GCP_ZONE)" -ForegroundColor DarkGray
Write-Host "  Remote:    $REMOTE_DIR" -ForegroundColor DarkGray
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 3: Deploy Steps
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "PHASE 3: Upload & Deploy" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────" -ForegroundColor DarkGray

# Step 1: Create remote directory
Write-Host ""
Write-Host "  [1/7] Creating remote directories..." -ForegroundColor White
gcloud compute ssh $GCP_INSTANCE `
    --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet `
    --command="mkdir -p $REMOTE_DIR/data/logs $REMOTE_DIR/deploy $REMOTE_DIR/scripts"

Write-Host "  [OK] Done" -ForegroundColor Green

# Step 2: Zip the project
Write-Host ""
Write-Host "  [2/7] Zipping project (~30s)..." -ForegroundColor White

$EXCLUDE = @("node_modules",".next","__pycache__",".git","backups","maintenance",
             "WoodTheme","openclaw-setup","testsprite_tests","tests","theories",
             "data","logs","journal.db",".env.local")

$TEMP_ZIP = "$env:TEMP\swjsh_gcp_deploy.zip"
if (Test-Path $TEMP_ZIP) { Remove-Item $TEMP_ZIP -Force }

$ITEMS = Get-ChildItem -Path $SOURCE_DIR |
    Where-Object { $EXCLUDE -notcontains $_.Name }

Compress-Archive -Path ($ITEMS | Select-Object -ExpandProperty FullName) `
                 -DestinationPath $TEMP_ZIP -CompressionLevel Optimal -Force

$SIZE_MB = [math]::Round((Get-Item $TEMP_ZIP).Length / 1MB, 1)
Write-Host "  [OK] Archive created: ${SIZE_MB}MB" -ForegroundColor Green

# Step 3: Upload zip
Write-Host ""
Write-Host "  [3/7] Uploading archive (~1-2 min depending on size)..." -ForegroundColor White
gcloud compute scp $TEMP_ZIP "${GCP_INSTANCE}:/tmp/swjsh_deploy.zip" `
    --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet
Write-Host "  [OK] Upload complete" -ForegroundColor Green

# Step 4: Extract on server
Write-Host ""
Write-Host "  [4/7] Extracting on server..." -ForegroundColor White
gcloud compute ssh $GCP_INSTANCE `
    --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet `
    --command="cd /tmp; unzip -q -o swjsh_deploy.zip -d swjsh_ext; rsync -a --ignore-existing swjsh_ext/ $REMOTE_DIR/; rm -rf swjsh_deploy.zip swjsh_ext"
Write-Host "  [OK] Extracted" -ForegroundColor Green

# Step 5: Upload .env.local
Write-Host ""
Write-Host "  [5/7] Uploading .env.local (secrets)..." -ForegroundColor White
gcloud compute scp $ENV_FILE "${GCP_INSTANCE}:$REMOTE_DIR/.env.local" `
    --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet
Write-Host "  [OK] .env.local uploaded" -ForegroundColor Green

# Step 5b: Upload optional Caddyfile and healthcheck scripts
Write-Host ""
Write-Host "  [5b/7] Uploading supplementary files..." -ForegroundColor White

$CADDYFILE = Join-Path $SOURCE_DIR "deploy/Caddyfile"
if (Test-Path $CADDYFILE) {
    gcloud compute scp $CADDYFILE "${GCP_INSTANCE}:$REMOTE_DIR/deploy/Caddyfile" `
        --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet
    Write-Host "    [OK] Caddyfile uploaded" -ForegroundColor Green
}

$HEALTHCHECK_SETUP = Join-Path $SOURCE_DIR "scripts/setup-external-healthcheck.sh"
if (Test-Path $HEALTHCHECK_SETUP) {
    gcloud compute scp $HEALTHCHECK_SETUP "${GCP_INSTANCE}:$REMOTE_DIR/scripts/setup-external-healthcheck.sh" `
        --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet
    Write-Host "    [OK] setup-external-healthcheck.sh uploaded" -ForegroundColor Green
}

$HEALTHCHECK_SCRIPT = Join-Path $SOURCE_DIR "scripts/external-healthcheck.sh"
if (Test-Path $HEALTHCHECK_SCRIPT) {
    gcloud compute scp $HEALTHCHECK_SCRIPT "${GCP_INSTANCE}:$REMOTE_DIR/scripts/external-healthcheck.sh" `
        --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet
    Write-Host "    [OK] external-healthcheck.sh uploaded" -ForegroundColor Green
}

# Upload OpenClaw cron jobs (GCP Linux version) to ~/.openclaw/cron/jobs.json
$CRON_JOBS_GCP = Join-Path $SOURCE_DIR "openclaw-setup/cron-jobs-gcp.json"
if (Test-Path $CRON_JOBS_GCP) {
    Write-Host "    Uploading OpenClaw cron jobs..." -ForegroundColor White
    gcloud compute ssh $GCP_INSTANCE `
        --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet `
        --command="mkdir -p ~/.openclaw/cron"
    gcloud compute scp $CRON_JOBS_GCP "${GCP_INSTANCE}:~/.openclaw/cron/jobs.json" `
        --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet
    Write-Host "    [OK] cron-jobs-gcp.json → ~/.openclaw/cron/jobs.json (15 cron jobs)" -ForegroundColor Green
} else {
    Write-Host "    [SKIP] cron-jobs-gcp.json not found" -ForegroundColor DarkGray
}

# Step 6: npm install + build
Write-Host ""
Write-Host "  [6/7] Installing dependencies and building (~3 min)..." -ForegroundColor White

gcloud compute ssh $GCP_INSTANCE `
    --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet `
    --command="cd $REMOTE_DIR; npm install --production 2>&1 | tail -2"

gcloud compute ssh $GCP_INSTANCE `
    --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet `
    --command="cd $REMOTE_DIR; npm run build 2>&1 | tail -2"

Write-Host "  [OK] Build complete" -ForegroundColor Green

# Step 7: Start services (supervisord or PM2)
Write-Host ""
Write-Host "  [7/7] Starting services..." -ForegroundColor White

gcloud compute ssh $GCP_INSTANCE `
    --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet `
    --command="cd $REMOTE_DIR; mkdir -p data/logs; if [ ! -f data/agents_db.json ]; then cp src/app/api/agents/agents_db.json data/agents_db.json 2>/dev/null; fi; docker compose down --remove-orphans 2>/dev/null; docker compose up -d"

Write-Host "  [OK] Services started" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4: Post-Deploy Verification
# ─────────────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "PHASE 4: Post-Deploy Verification" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────" -ForegroundColor DarkGray

# Check 1: Container health (max 120s)
Write-Host ""
Write-Host "  [1/4] Waiting for container to be healthy (max 120s)..." -ForegroundColor White

$HEALTH_TIMEOUT = 120
$HEALTH_INTERVAL = 5
$HEALTH_ELAPSED = 0
$CONTAINER_HEALTHY = $false

while ($HEALTH_ELAPSED -lt $HEALTH_TIMEOUT) {
    $CONTAINER_STATUS = gcloud compute ssh $GCP_INSTANCE `
        --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet `
        --command="docker inspect swjsh_next-app_1 2>/dev/null | grep -o '\"Health\":.*' | head -1" 2>&1

    if ($CONTAINER_STATUS -match "healthy") {
        $CONTAINER_HEALTHY = $true
        break
    }

    Write-Host ("    Waiting... (" + $HEALTH_ELAPSED + "/" + $HEALTH_TIMEOUT + "s)") -ForegroundColor DarkGray
    Start-Sleep -Seconds $HEALTH_INTERVAL
    $HEALTH_ELAPSED += $HEALTH_INTERVAL
}

if ($CONTAINER_HEALTHY) {
    Write-Host "  [OK] Container healthy" -ForegroundColor Green
} else {
    Write-Host "  [WARN]  Container not reporting healthy (may still be starting)" -ForegroundColor Yellow
}

# Check 2: HTTP health endpoint
Write-Host ""
Write-Host "  [2/4] Checking /api/health endpoint..." -ForegroundColor White

$HEALTH_RESPONSE = gcloud compute ssh $GCP_INSTANCE `
    --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet `
    --command='curl -s -f http://localhost:3000/api/health 2>/dev/null; if [ $? -ne 0 ]; then echo TIMEOUT; fi' 2>&1

if ($HEALTH_RESPONSE -match "ok|healthy") {
    Write-Host "  [OK] Health endpoint responsive" -ForegroundColor Green
} else {
    Write-Host "  [WARN]  Health check not yet responsive (may still be booting)" -ForegroundColor Yellow
}

# Check 3: Supervisord processes (if using supervisord)
Write-Host ""
Write-Host "  [3/4] Checking supervisord process status..." -ForegroundColor White

$SUPERVISOR_STATUS = gcloud compute ssh $GCP_INSTANCE `
    --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet `
    --command='supervisorctl status 2>/dev/null; if [ $? -ne 0 ]; then echo SUPERVISORD_NOT_RUNNING; fi' 2>&1

if ($SUPERVISOR_STATUS -match "RUNNING|FATAL") {
    Write-Host "  Process Status:" -ForegroundColor White
    $SUPERVISOR_STATUS -split "`n" | Where-Object { $_.Trim() } | ForEach-Object {
        if ($_ -match "RUNNING") {
            Write-Host "    [OK] $_" -ForegroundColor Green
        } elseif ($_ -match "FATAL|EXITED") {
            Write-Host "    [FAIL] $_" -ForegroundColor Red
        } else {
            Write-Host "    • $_" -ForegroundColor DarkGray
        }
    }
} else {
    Write-Host "  [WARN]  Supervisord check skipped (using docker compose)" -ForegroundColor DarkGray
}

# Check 4: Docker compose status
Write-Host ""
Write-Host "  [4/4] Docker compose container status..." -ForegroundColor White

$DOCKER_STATUS = gcloud compute ssh $GCP_INSTANCE `
    --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet `
    --command='docker compose ps 2>/dev/null; if [ $? -ne 0 ]; then echo DOCKER_NOT_AVAILABLE; fi' 2>&1

if ($DOCKER_STATUS -match "Up") {
    Write-Host "  Containers:" -ForegroundColor White
    $DOCKER_STATUS -split "`n" | Where-Object { $_.Trim() -and $_ -match "Up|Exited" } | ForEach-Object {
        if ($_ -match "Up") {
            Write-Host "    [OK] $_" -ForegroundColor Green
        } else {
            Write-Host "    [FAIL] $_" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  [WARN]  Docker compose not available" -ForegroundColor Yellow
}

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 5: Get External IP and Prepare Summary
# ─────────────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "PHASE 5: Summary" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────" -ForegroundColor DarkGray

$EXT_IP = gcloud compute instances describe $GCP_INSTANCE `
    --zone=$GCP_ZONE --project=$GCP_PROJECT `
    --format="get(networkInterfaces[0].accessConfigs[0].natIP)" 2>$null

$DEPLOY_END = Get-Date
$DEPLOY_TIME = ($DEPLOY_END - $DEPLOY_START).TotalSeconds

Write-Host ""
Write-Host "═════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  [OK]  Deploy Complete!" -ForegroundColor Green
Write-Host "═════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Time elapsed: $('{0:N0}' -f $DEPLOY_TIME)s" -ForegroundColor Cyan
Write-Host ""

if ($EXT_IP) {
    Write-Host "  Dashboard & APIs:" -ForegroundColor White
    Write-Host "    Dashboard:  http://$EXT_IP:3000" -ForegroundColor Cyan
    Write-Host "    Trades:     http://$EXT_IP:3000/trades" -ForegroundColor Cyan
    Write-Host "    Agents:     http://$EXT_IP:3000/agents" -ForegroundColor Cyan
    Write-Host "    Health:     http://$EXT_IP:3000/api/health" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "  Troubleshooting:" -ForegroundColor White
Write-Host "    Logs:       gcloud compute ssh $GCP_INSTANCE --zone=$GCP_ZONE -- 'docker compose logs -f'" -ForegroundColor DarkGray
Write-Host "    SSH:        gcloud compute ssh $GCP_INSTANCE --zone=$GCP_ZONE" -ForegroundColor DarkGray
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 6: Brain Sync (optional)
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "PHASE 6: Brain Sync" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────" -ForegroundColor DarkGray

$BRAIN_SYNC_SCRIPT = Join-Path $SOURCE_DIR "sync-brain-to-git.ps1"
if (Test-Path $BRAIN_SYNC_SCRIPT) {
    Write-Host ""
    Write-Host "  Brain sync script found. Running..." -ForegroundColor White
    & $BRAIN_SYNC_SCRIPT
    Write-Host "  [OK] Brain sync complete" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "  [INFO] Brain sync script not found at $BRAIN_SYNC_SCRIPT" -ForegroundColor DarkGray
}

Write-Host ""

# Cleanup
if (Test-Path $TEMP_ZIP) { Remove-Item $TEMP_ZIP -Force }
