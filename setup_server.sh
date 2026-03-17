#!/bin/bash

# Swjsh Algo-Knife Server Setup Script
# Ubuntu 22.04 / Debian 11+ Recommended

echo "⚔️  Initializing Cyber-Deck Environment..."

# 1. Update & Essentials
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential

# 2. Install Node.js 20 (LTS)
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "✅ Node.js already installed."
fi

# 3. Install PM2 (Process Manager)
if ! command -v pm2 &> /dev/null; then
    echo "⚡ Installing PM2..."
    sudo npm install -g pm2
    pm2 startup
else
    echo "✅ PM2 already installed."
fi

# 4. Project Setup
PROJECT_DIR="~/algo-knife"
mkdir -p $PROJECT_DIR
mkdir -p $PROJECT_DIR/logs

echo "📂 Application Directory: $PROJECT_DIR"
echo "👉 Action Items:"
echo "   1. Upload your code to '$PROJECT_DIR'"
echo "   2. Run 'npm install --production' inside that folder"
echo "   3. Run 'npm run build'"
echo "   4. Start with 'pm2 start ecosystem.config.js'"
echo "   5. Save process list: 'pm2 save'"

echo "⚔️  Ready for Deployment."
