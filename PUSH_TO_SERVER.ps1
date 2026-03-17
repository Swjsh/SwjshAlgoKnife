# ═══════════════════════════════════════════════════════════════════════════════
#  SwjshAK — Push code to Oracle Cloud server
#  Run this from your project folder on Windows whenever you want to deploy
#  updated code (or for the initial deployment).
#
#  Requirements:
#    - OpenSSH client (built into Windows 10/11)
#    - Your Oracle Cloud SSH private key file (.key or .pem)
# ═══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

# ── Config — edit these once ──────────────────────────────────────────────────
# Your Oracle VM public IP (from Oracle Cloud Console → Compute → Instances)
$SERVER_IP   = ""

# Path to your SSH private key (the .key file you downloaded when creating the VM)
$SSH_KEY     = ""

# Linux username — always "ubuntu" on Oracle Cloud Ubuntu images
$SSH_USER    = "ubuntu"

# Remote project directory
$REMOTE_DIR  = "/home/ubuntu/SwjshAlgoKnife"
# ─────────────────────────────────────────────────────────────────────────────

# Prompt for missing config
if (-not $SERVER_IP) {
    $SERVER_IP = Read-Host "Enter your Oracle Cloud server IP"
}
if (-not $SSH_KEY) {
    $SSH_KEY = Read-Host "Enter path to your SSH private key (e.g. C:\Users\jackw\oracle_key.key)"
}

# Validate key file
if (-not (Test-Path $SSH_KEY)) {
    Write-Host "ERROR: SSH key not found at: $SSH_KEY" -ForegroundColor Red
    exit 1
}

# Fix key permissions (ssh requires 600)
icacls $SSH_KEY /inheritance:r /grant:r "${env:USERNAME}:(R)" 2>$null | Out-Null

$SSH_OPTS = "-i `"$SSH_KEY`" -o StrictHostKeyChecking=no -o ConnectTimeout=15"

Write-Host ""
Write-Host "SwjshAK — Deploying to $SERVER_IP" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan

# ── Step 1: Create remote directory ──────────────────────────────────────────
Write-Host ""
Write-Host "▶ Creating remote directory..." -ForegroundColor Yellow
Invoke-Expression "ssh $SSH_OPTS ${SSH_USER}@${SERVER_IP} 'mkdir -p $REMOTE_DIR/data/logs'"

# ── Step 2: Build exclusion list ──────────────────────────────────────────────
# scp doesn't support exclude patterns natively, so we use a temp rsync-style approach.
# We copy using scp with a zip — exclude large/unneeded dirs first.
$EXCLUDE_DIRS = @(
    "node_modules",
    ".next",
    "__pycache__",
    ".git",
    "backups",
    "maintenance",
    "WoodTheme",
    "openclaw-setup",
    "testsprite_tests",
    "tests",
    "theories",
    "data",      # data stays on server — don't overwrite the live DB
    "logs"
)

Write-Host ""
Write-Host "▶ Zipping project (excluding node_modules, .next, data)..." -ForegroundColor Yellow

$TEMP_ZIP = "$env:TEMP\swjsh_deploy.zip"
if (Test-Path $TEMP_ZIP) { Remove-Item $TEMP_ZIP -Force }

# Build the zip using Compress-Archive, excluding heavy dirs
$SOURCE_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$ITEMS_TO_ZIP = Get-ChildItem -Path $SOURCE_DIR |
    Where-Object { $EXCLUDE_DIRS -notcontains $_.Name }

Compress-Archive -Path ($ITEMS_TO_ZIP | Select-Object -ExpandProperty FullName) `
                 -DestinationPath $TEMP_ZIP -CompressionLevel Optimal -Force

$SIZE_MB = [math]::Round((Get-Item $TEMP_ZIP).Length / 1MB, 1)
Write-Host "  ✓ Archive created: ${SIZE_MB}MB" -ForegroundColor Green

# ── Step 3: Upload the zip ────────────────────────────────────────────────────
Write-Host ""
Write-Host "▶ Uploading to server (this takes ~1-2 min on first run)..." -ForegroundColor Yellow
Invoke-Expression "scp $SSH_OPTS `"$TEMP_ZIP`" ${SSH_USER}@${SERVER_IP}:/tmp/swjsh_deploy.zip"
Write-Host "  ✓ Upload complete" -ForegroundColor Green

# ── Step 4: Unzip on server ───────────────────────────────────────────────────
Write-Host ""
Write-Host "▶ Extracting on server..." -ForegroundColor Yellow
$REMOTE_CMDS = @(
    "cd /tmp && unzip -q -o swjsh_deploy.zip -d swjsh_extracted",
    "rsync -a --ignore-existing /tmp/swjsh_extracted/ $REMOTE_DIR/",
    "rm -rf /tmp/swjsh_deploy.zip /tmp/swjsh_extracted"
) -join " && "
Invoke-Expression "ssh $SSH_OPTS ${SSH_USER}@${SERVER_IP} '$REMOTE_CMDS'"
Write-Host "  ✓ Files extracted" -ForegroundColor Green

# ── Step 5: Upload .env.local ─────────────────────────────────────────────────
$ENV_FILE = Join-Path $SOURCE_DIR ".env.local"
if (Test-Path $ENV_FILE) {
    Write-Host ""
    Write-Host "▶ Uploading .env.local (secrets)..." -ForegroundColor Yellow
    Invoke-Expression "scp $SSH_OPTS `"$ENV_FILE`" ${SSH_USER}@${SERVER_IP}:$REMOTE_DIR/.env.local"
    Write-Host "  ✓ .env.local uploaded" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "  ⚠  .env.local not found — you'll need to create it on the server manually" -ForegroundColor Yellow
    Write-Host "     ssh -i `"$SSH_KEY`" ${SSH_USER}@${SERVER_IP}" -ForegroundColor DarkGray
    Write-Host "     nano $REMOTE_DIR/.env.local" -ForegroundColor DarkGray
}

# ── Step 6: Install deps + build + restart ────────────────────────────────────
Write-Host ""
Write-Host "▶ Installing Node dependencies (compiling native modules)..." -ForegroundColor Yellow
Write-Host "  (this takes 2-3 minutes on first run)" -ForegroundColor DarkGray
Invoke-Expression "ssh $SSH_OPTS ${SSH_USER}@${SERVER_IP} 'cd $REMOTE_DIR && npm install 2>&1 | tail -5'"
Write-Host "  ✓ npm install done" -ForegroundColor Green

Write-Host ""
Write-Host "▶ Building Next.js production bundle..." -ForegroundColor Yellow
Write-Host "  (this takes ~1-2 minutes)" -ForegroundColor DarkGray
Invoke-Expression "ssh $SSH_OPTS ${SSH_USER}@${SERVER_IP} 'cd $REMOTE_DIR && npm run build 2>&1 | tail -5'"
Write-Host "  ✓ Build complete" -ForegroundColor Green

# ── Step 7: Start or restart PM2 ─────────────────────────────────────────────
Write-Host ""
Write-Host "▶ Starting/restarting processes via PM2..." -ForegroundColor Yellow

$PM2_CMD = @"
cd $REMOTE_DIR
# Create data dirs if they don't exist
mkdir -p data/logs
# Seed agents_db.json to data/ if not already there
if [ ! -f data/agents_db.json ]; then cp src/app/api/agents/agents_db.json data/agents_db.json; fi
# Start or reload PM2
if pm2 list 2>/dev/null | grep -q 'AK-Dashboard'; then
    pm2 reload scripts/ecosystem.config.js --update-env
else
    pm2 start scripts/ecosystem.config.js
fi
pm2 save
"@

# Escape for single ssh command
$PM2_CMD_ONELINE = $PM2_CMD -replace "`n", " && " -replace "# .*?&&", "&&"
Invoke-Expression "ssh $SSH_OPTS ${SSH_USER}@${SERVER_IP} 'bash -c ""cd $REMOTE_DIR && mkdir -p data/logs && if [ ! -f data/agents_db.json ]; then cp src/app/api/agents/agents_db.json data/agents_db.json 2>/dev/null || true; fi && if pm2 list 2>/dev/null | grep -q AK-Dashboard; then pm2 reload scripts/ecosystem.config.js --update-env; else pm2 start scripts/ecosystem.config.js; fi && pm2 save""'"

Write-Host "  ✓ PM2 started" -ForegroundColor Green

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✓  Deployment complete!" -ForegroundColor Green
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard:  http://$SERVER_IP:3000" -ForegroundColor Cyan
Write-Host "  Trades:     http://$SERVER_IP:3000/trades" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Watch live logs:" -ForegroundColor White
Write-Host "  ssh -i `"$SSH_KEY`" ${SSH_USER}@${SERVER_IP} 'pm2 logs'" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  NOTE: If the dashboard isn't loading, make sure you've opened" -ForegroundColor Yellow
Write-Host "  port 3000 in Oracle Cloud Console → Networking → Security Lists" -ForegroundColor Yellow
Write-Host ""

# Cleanup
if (Test-Path $TEMP_ZIP) { Remove-Item $TEMP_ZIP -Force }
