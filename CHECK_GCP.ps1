# ═══════════════════════════════════════════════════════════════
#  SwjshAK — GCP Discovery Script
#  Run this from PowerShell to find out what's actually running.
#
#  Usage: .\CHECK_GCP.ps1
#
#  If gcloud isn't found, install it first:
#    https://cloud.google.com/sdk/docs/install-sdk#windows
#  Then run: gcloud init
# ═══════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "=== SwjshAK GCP Discovery ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if gcloud is installed
Write-Host "[1/6] Checking gcloud CLI..." -ForegroundColor Yellow
try {
    $ver = gcloud --version 2>&1 | Select-Object -First 1
    Write-Host "  OK: $ver" -ForegroundColor Green
} catch {
    Write-Host "  FAIL: gcloud not found." -ForegroundColor Red
    Write-Host "  Install from: https://cloud.google.com/sdk/docs/install-sdk#windows" -ForegroundColor Gray
    Write-Host "  Then run: gcloud init" -ForegroundColor Gray
    exit 1
}

# Step 2: Check active project
Write-Host ""
Write-Host "[2/6] Checking active GCP project..." -ForegroundColor Yellow
$project = gcloud config get-value project 2>&1
Write-Host "  Active project: $project" -ForegroundColor Cyan

# Step 3: List ALL projects you have access to
Write-Host ""
Write-Host "[3/6] Listing all GCP projects..." -ForegroundColor Yellow
gcloud projects list --format="table(projectId,name,projectNumber)" 2>&1 | ForEach-Object { Write-Host "  $_" }

# Step 4: Check for VMs in the known configs
Write-Host ""
Write-Host "[4/6] Searching for VMs..." -ForegroundColor Yellow

# Try Config A (the likely real one)
Write-Host ""
Write-Host "  --- Config A: swjsh-server / us-central1-a / swjsh-algo-knife ---" -ForegroundColor Cyan
$vmA = gcloud compute instances describe swjsh-server --zone=us-central1-a --project=swjsh-algo-knife --format="table(name,status,machineType.basename(),networkInterfaces[0].accessConfigs[0].natIP,creationTimestamp)" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  FOUND:" -ForegroundColor Green
    $vmA | ForEach-Object { Write-Host "    $_" -ForegroundColor Green }
} else {
    Write-Host "  NOT FOUND (or no access)" -ForegroundColor Red
    Write-Host "    $vmA" -ForegroundColor Gray
}

# Try Config B (the planned one)
Write-Host ""
Write-Host "  --- Config B: swjsh-trading / us-east4-c / swjsh-trading ---" -ForegroundColor Cyan
$vmB = gcloud compute instances describe swjsh-trading --zone=us-east4-c --project=swjsh-trading 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  FOUND:" -ForegroundColor Green
    $vmB | ForEach-Object { Write-Host "    $_" -ForegroundColor Green }
} else {
    Write-Host "  NOT FOUND (or no access)" -ForegroundColor Red
    Write-Host "    $vmB" -ForegroundColor Gray
}

# Also try Config B with Config A's project (in case instance name differs but project is same)
Write-Host ""
Write-Host "  --- Hybrid: swjsh-trading / us-east4-c / swjsh-algo-knife ---" -ForegroundColor Cyan
$vmC = gcloud compute instances describe swjsh-trading --zone=us-east4-c --project=swjsh-algo-knife 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  FOUND:" -ForegroundColor Green
    $vmC | ForEach-Object { Write-Host "    $_" -ForegroundColor Green }
} else {
    Write-Host "  NOT FOUND" -ForegroundColor Red
}

# Step 5: List ALL VMs across all zones (catches anything we missed)
Write-Host ""
Write-Host "[5/6] Listing ALL VMs in project '$project'..." -ForegroundColor Yellow
$allVMs = gcloud compute instances list --project=$project --format="table(name,zone.basename(),status,machineType.basename(),networkInterfaces[0].accessConfigs[0].natIP)" 2>&1
if ($allVMs) {
    $allVMs | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host "  No VMs found in project '$project'" -ForegroundColor Red
}

# Also check the other project if different
if ($project -ne "swjsh-algo-knife") {
    Write-Host ""
    Write-Host "  Also checking project 'swjsh-algo-knife'..." -ForegroundColor Yellow
    $allVMs2 = gcloud compute instances list --project=swjsh-algo-knife --format="table(name,zone.basename(),status,machineType.basename(),networkInterfaces[0].accessConfigs[0].natIP)" 2>&1
    if ($allVMs2) {
        $allVMs2 | ForEach-Object { Write-Host "  $_" }
    } else {
        Write-Host "  No VMs found (or no access to project)" -ForegroundColor Gray
    }
}

# Step 6: If a VM was found, test SSH connectivity
Write-Host ""
Write-Host "[6/6] Quick connectivity test..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  To SSH into your server, run ONE of these:" -ForegroundColor Cyan
Write-Host ""
Write-Host "    # Config A (most likely):" -ForegroundColor Green
Write-Host '    gcloud compute ssh swjsh-server --zone=us-central1-a --project=swjsh-algo-knife' -ForegroundColor White
Write-Host ""
Write-Host "    # Config B (if it exists):" -ForegroundColor Yellow
Write-Host '    gcloud compute ssh swjsh-trading --zone=us-east4-c --project=swjsh-trading' -ForegroundColor White
Write-Host ""

# Summary
Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "  Your codebase has TWO different GCP configs." -ForegroundColor Yellow
Write-Host "  Config A (swjsh-server/us-central1-a) is used by all deploy scripts." -ForegroundColor White
Write-Host "  Config B (swjsh-trading/us-east4-c) is used by OpenClaw deploy plan." -ForegroundColor White
Write-Host "  Run the SSH command above to confirm which one is real." -ForegroundColor White
Write-Host "  Then tell Claude which config is correct so we can fix the other." -ForegroundColor Cyan
Write-Host ""
