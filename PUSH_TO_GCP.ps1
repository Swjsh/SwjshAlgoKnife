# ═══════════════════════════════════════════════════════════════════════════════
#  SwjshAK — Deploy to Google Cloud
#  Uses gcloud CLI (no SSH key management needed).
#
#  First time setup:
#    1. Install gcloud CLI: https://cloud.google.com/sdk/docs/install-sdk#windows
#    2. Run: gcloud init
#    3. Fill in the three config lines below
#    4. Run: .\PUSH_TO_GCP.ps1
#
#  Every subsequent deploy: just run .\PUSH_TO_GCP.ps1
# ═══════════════════════════════════════════════════════════════════════════════

# ── Config — fill these in once ───────────────────────────────────────────────
$GCP_PROJECT  = "swjsh-algo-knife"
$GCP_INSTANCE = "swjsh-server"
$GCP_ZONE     = "us-central1-a"
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

# ── Prompt for missing config ─────────────────────────────────────────────────
if (-not $GCP_PROJECT) {
    $GCP_PROJECT = Read-Host "Enter your GCP project ID (e.g. swjsh-algo-knife)"
}

# ── Verify gcloud is installed ────────────────────────────────────────────────
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "ERROR: gcloud CLI not found." -ForegroundColor Red
    Write-Host "Install it from: https://cloud.google.com/sdk/docs/install-sdk#windows" -ForegroundColor Yellow
    Write-Host "Then run: gcloud init" -ForegroundColor Yellow
    exit 1
}

# ── Verify VM is running ──────────────────────────────────────────────────────
$VM_STATUS = gcloud compute instances describe $GCP_INSTANCE `
    --zone=$GCP_ZONE --project=$GCP_PROJECT `
    --format="get(status)" 2>&1

if ($VM_STATUS -ne "RUNNING") {
    Write-Host ""
    Write-Host "VM '$GCP_INSTANCE' status: $VM_STATUS" -ForegroundColor Yellow
    if ($VM_STATUS -eq "TERMINATED") {
        Write-Host "Starting VM..." -ForegroundColor Yellow
        gcloud compute instances start $GCP_INSTANCE --zone=$GCP_ZONE --project=$GCP_PROJECT
        Write-Host "VM started. Waiting 10s for boot..." -ForegroundColor DarkGray
        Start-Sleep -Seconds 10
    }
}

$REMOTE_USER = gcloud config get-value account 2>$null
$REMOTE_USER = $REMOTE_USER -replace "@.*", "" -replace "\.", "_"
$REMOTE_HOME = "/home/$REMOTE_USER"
$REMOTE_DIR  = "$REMOTE_HOME/SwjshAlgoKnife"

$SOURCE_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "SwjshAK → GCP Deploy" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Project:  $GCP_PROJECT" -ForegroundColor DarkGray
Write-Host "  VM:       $GCP_INSTANCE ($GCP_ZONE)" -ForegroundColor DarkGray
Write-Host "  Remote:   $REMOTE_DIR" -ForegroundColor DarkGray

# ── Step 1: Create remote directory + data folder ────────────────────────────
Write-Host ""
Write-Host "▶ Preparing remote directory..." -ForegroundColor Yellow
gcloud compute ssh $GCP_INSTANCE `
    --zone=$GCP_ZONE --project=$GCP_PROJECT `
    --command="mkdir -p $REMOTE_DIR/data/logs" `
    --quiet

# ── Step 2: Zip the project ────────────────────────────────────────────────────
Write-Host ""
Write-Host "▶ Zipping project (excluding node_modules, .next, data)..." -ForegroundColor Yellow

$EXCLUDE = @("node_modules",".next","__pycache__",".git","backups","maintenance",
             "WoodTheme","openclaw-setup","testsprite_tests","tests","theories",
             "data","logs","journal.db")

$TEMP_ZIP = "$env:TEMP\swjsh_gcp_deploy.zip"
if (Test-Path $TEMP_ZIP) { Remove-Item $TEMP_ZIP -Force }

$ITEMS = Get-ChildItem -Path $SOURCE_DIR |
    Where-Object { $EXCLUDE -notcontains $_.Name }

Compress-Archive -Path ($ITEMS | Select-Object -ExpandProperty FullName) `
                 -DestinationPath $TEMP_ZIP -CompressionLevel Optimal -Force

$SIZE_MB = [math]::Round((Get-Item $TEMP_ZIP).Length / 1MB, 1)
Write-Host "  ✓ Archive: ${SIZE_MB}MB" -ForegroundColor Green

# ── Step 3: Upload via gcloud compute scp ─────────────────────────────────────
Write-Host ""
Write-Host "▶ Uploading via gcloud compute scp..." -ForegroundColor Yellow

gcloud compute scp $TEMP_ZIP "${GCP_INSTANCE}:/tmp/swjsh_deploy.zip" `
    --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet

Write-Host "  ✓ Upload complete" -ForegroundColor Green

# ── Step 4: Extract on server ─────────────────────────────────────────────────
Write-Host ""
Write-Host "▶ Extracting on server..." -ForegroundColor Yellow

gcloud compute ssh $GCP_INSTANCE `
    --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet `
    --command="cd /tmp && unzip -q -o swjsh_deploy.zip -d swjsh_ext && rsync -a --ignore-existing swjsh_ext/ $REMOTE_DIR/ && rm -rf swjsh_deploy.zip swjsh_ext"

Write-Host "  ✓ Extracted" -ForegroundColor Green

# ── Step 5: Upload .env.local ─────────────────────────────────────────────────
$ENV_FILE = Join-Path $SOURCE_DIR ".env.local"
if (Test-Path $ENV_FILE) {
    Write-Host ""
    Write-Host "▶ Uploading .env.local (secrets)..." -ForegroundColor Yellow
    gcloud compute scp $ENV_FILE "${GCP_INSTANCE}:$REMOTE_DIR/.env.local" `
        --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet
    Write-Host "  ✓ .env.local uploaded" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "  ⚠  .env.local not found locally. Create it on the server:" -ForegroundColor Yellow
    Write-Host "     gcloud compute ssh $GCP_INSTANCE --zone=$GCP_ZONE -- 'nano $REMOTE_DIR/.env.local'" -ForegroundColor DarkGray
}

# ── Step 6: npm install + build ───────────────────────────────────────────────
Write-Host ""
Write-Host "▶ Installing Node dependencies (first run ~3 min)..." -ForegroundColor Yellow
gcloud compute ssh $GCP_INSTANCE `
    --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet `
    --command="cd $REMOTE_DIR && npm install 2>&1 | tail -3"
Write-Host "  ✓ npm install done" -ForegroundColor Green

Write-Host ""
Write-Host "▶ Building Next.js (~1-2 min)..." -ForegroundColor Yellow
gcloud compute ssh $GCP_INSTANCE `
    --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet `
    --command="cd $REMOTE_DIR && npm run build 2>&1 | tail -3"
Write-Host "  ✓ Build complete" -ForegroundColor Green

# ── Step 7: Seed data dir + start/reload PM2 ──────────────────────────────────
Write-Host ""
Write-Host "▶ Starting processes via PM2..." -ForegroundColor Yellow

gcloud compute ssh $GCP_INSTANCE `
    --zone=$GCP_ZONE --project=$GCP_PROJECT --quiet `
    --command="cd $REMOTE_DIR && mkdir -p data/logs && if [ ! -f data/agents_db.json ]; then cp src/app/api/agents/agents_db.json data/agents_db.json 2>/dev/null || true; fi && if pm2 list 2>/dev/null | grep -q 'AK-Dashboard'; then pm2 reload scripts/ecosystem.config.js --update-env --silent; else pm2 start scripts/ecosystem.config.js; fi && pm2 save --silent"

Write-Host "  ✓ PM2 running" -ForegroundColor Green

# ── Get external IP ────────────────────────────────────────────────────────────
$EXT_IP = gcloud compute instances describe $GCP_INSTANCE `
    --zone=$GCP_ZONE --project=$GCP_PROJECT `
    --format="get(networkInterfaces[0].accessConfigs[0].natIP)" 2>$null

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✓  Deployed successfully!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
if ($EXT_IP) {
    Write-Host "  Dashboard:  http://$EXT_IP:3000" -ForegroundColor Cyan
    Write-Host "  Trades:     http://$EXT_IP:3000/trades" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "  Live logs:" -ForegroundColor White
Write-Host "  gcloud compute ssh $GCP_INSTANCE --zone=$GCP_ZONE -- 'pm2 logs'" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Process status:" -ForegroundColor White
Write-Host "  gcloud compute ssh $GCP_INSTANCE --zone=$GCP_ZONE -- 'pm2 list'" -ForegroundColor DarkGray
Write-Host ""

# Cleanup
if (Test-Path $TEMP_ZIP) { Remove-Item $TEMP_ZIP -Force }
