#!/bin/bash
# ==============================================
# SwjshAK GCP VM Deployment Script
# Run this from your local Windows terminal (PowerShell/WSL)
# after installing gcloud CLI
# ==============================================

set -e

VM_NAME="swjsh-server"
ZONE="us-central1-a"
PROJECT="swjsh-algo-knife"
APP_DIR="/home/jack_watergun/swjsh-app"

echo "=== Step 1: Clone repo on VM ==="
gcloud compute ssh $VM_NAME --zone=$ZONE --project=$PROJECT -- \
  "cd /home/jack_watergun && git clone https://github.com/Swjsh/SwjshAlgoKnife.git swjsh-app"

echo "=== Step 2: Copy .env.local to VM ==="
gcloud compute scp .env.local $VM_NAME:$APP_DIR/.env.local --zone=$ZONE --project=$PROJECT

echo "=== Step 3: Install dependencies and build ==="
gcloud compute ssh $VM_NAME --zone=$ZONE --project=$PROJECT -- \
  "cd $APP_DIR && npm install && npm run build"

echo "=== Step 4: Install Python deps for agents ==="
gcloud compute ssh $VM_NAME --zone=$ZONE --project=$PROJECT -- \
  "cd $APP_DIR && pip3 install -r scripts/requirements_futures.txt 2>/dev/null; pip3 install -r scripts/requirements_options.txt 2>/dev/null; pip3 install yfinance pandas requests 2>/dev/null || true"

echo "=== Step 5: Setup PM2 to run the app ==="
gcloud compute ssh $VM_NAME --zone=$ZONE --project=$PROJECT -- "
cd $APP_DIR

# Start the Next.js dashboard
pm2 start npm --name swjsh-dashboard -- start

# Start the agent runner
pm2 start npx --name swjsh-agents -- tsx scripts/agent_runner.ts

# Save PM2 config and setup startup
pm2 save
pm2 startup 2>/dev/null || true

echo '=== Done! PM2 Status: ==='
pm2 list
"

echo ""
echo "=== Deployment Complete! ==="
echo "Dashboard: http://$(gcloud compute instances describe $VM_NAME --zone=$ZONE --project=$PROJECT --format='get(networkInterfaces[0].accessConfigs[0].natIP)'):3000"
echo ""
echo "To enable external access, run:"
echo "gcloud compute firewall-rules create allow-dashboard --allow=tcp:3000 --target-tags=swjsh-server --source-ranges=YOUR_HOME_IP/32 --project=$PROJECT"
