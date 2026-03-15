#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# SwjshAK — GCP Compute Engine Setup
#
# Run this ONCE on a fresh GCP VM to set up the trading platform.
# After setup, the system runs autonomously — no manual intervention needed.
#
# Prerequisites:
#   - GCP Compute Engine VM (e2-medium or better, 4GB+ RAM)
#   - Ubuntu 22.04 LTS
#   - Your .env.local file with API keys ready to upload
#
# Usage:
#   1. Create a GCP VM:
#      gcloud compute instances create swjshak \
#        --zone=us-central1-a \
#        --machine-type=e2-medium \
#        --image-family=ubuntu-2204-lts \
#        --image-project=ubuntu-os-cloud \
#        --boot-disk-size=30GB \
#        --tags=http-server
#
#   2. SSH in and run:
#      curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/deploy/gcp-setup.sh | bash
#
#   3. Upload your .env.local:
#      gcloud compute scp .env.local swjshak:~/swjshak/.env.local
#
#   4. Start everything:
#      ssh swjshak 'cd ~/swjshak && docker compose up -d'
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

echo "▶ SwjshAK — GCP Setup Starting..."
echo "=================================="

# ── 1. Install Docker ─────────────────────────────────────────────────────────
echo ""
echo "▶ Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo "  ✅ Docker installed"
else
    echo "  ✅ Docker already installed"
fi

# ── 2. Install Docker Compose ────────────────────────────────────────────────
echo ""
echo "▶ Checking Docker Compose..."
if ! docker compose version &> /dev/null; then
    sudo apt-get update && sudo apt-get install -y docker-compose-plugin
    echo "  ✅ Docker Compose installed"
else
    echo "  ✅ Docker Compose already available"
fi

# ── 3. Clone repo ────────────────────────────────────────────────────────────
echo ""
echo "▶ Setting up project directory..."
PROJECT_DIR="$HOME/swjshak"
if [ ! -d "$PROJECT_DIR" ]; then
    echo "  Creating project directory at $PROJECT_DIR"
    mkdir -p "$PROJECT_DIR"
    echo "  ⚠️  You need to clone your repo or copy files to $PROJECT_DIR"
else
    echo "  ✅ Project directory exists"
fi

# ── 4. Create persistent data directory ───────────────────────────────────────
echo ""
echo "▶ Setting up persistent data..."
mkdir -p "$PROJECT_DIR/data/logs"
echo "  ✅ Data directory ready at $PROJECT_DIR/data"

# ── 5. Firewall rule for dashboard ───────────────────────────────────────────
echo ""
echo "▶ Firewall setup..."
echo "  To access the dashboard remotely, run this from your LOCAL machine:"
echo "  gcloud compute firewall-rules create swjshak-dashboard \\"
echo "    --allow tcp:3000 \\"
echo "    --target-tags=http-server \\"
echo "    --description='SwjshAK Dashboard'"
echo ""
echo "  Or use SSH tunneling (more secure, no firewall needed):"
echo "  gcloud compute ssh swjshak -- -L 3000:localhost:3000"

# ── 6. Create systemd service for auto-start on reboot ───────────────────────
echo ""
echo "▶ Setting up auto-start on boot..."
sudo tee /etc/systemd/system/swjshak.service > /dev/null << 'SYSTEMD'
[Unit]
Description=SwjshAK Trading Platform
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/USER_PLACEHOLDER/swjshak
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=USER_PLACEHOLDER
Group=docker

[Install]
WantedBy=multi-user.target
SYSTEMD

# Replace placeholder with actual user
sudo sed -i "s/USER_PLACEHOLDER/$USER/g" /etc/systemd/system/swjshak.service
sudo systemctl daemon-reload
sudo systemctl enable swjshak.service
echo "  ✅ SwjshAK will auto-start on VM reboot"

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "=================================="
echo "✅ GCP Setup Complete!"
echo ""
echo "Next steps:"
echo "  1. Copy your project files to ~/swjshak/"
echo "  2. Create .env.local with your API keys"
echo "  3. Run: cd ~/swjshak && docker compose up -d"
echo "  4. Dashboard: http://<VM_IP>:3000"
echo "  5. LLM Control API: http://<VM_IP>:3000/api/control"
echo ""
echo "Useful commands:"
echo "  docker compose logs -f           # Watch all logs"
echo "  docker compose logs -f swjshak   # Watch container logs"
echo "  docker compose restart            # Restart everything"
echo "  docker compose down               # Stop everything"
echo ""
echo "LLM Control (from any HTTP client or chat):"
echo "  GET  http://<VM_IP>:3000/api/control          # System status"
echo "  POST http://<VM_IP>:3000/api/control          # Send commands"
echo "    { \"command\": \"summary\" }                     # Daily P&L report"
echo "    { \"command\": \"pause\", \"agentId\": \"boba\" }    # Pause an agent"
echo "    { \"command\": \"killswitch\" }                   # Emergency halt"
echo ""
