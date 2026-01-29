#!/bash/bin
# ═══════════════════════════════════════════════════════════════════
# SWJSH ALGO KNIFE - VPS DEPLOYMENT SETUP (Ubuntu 24.04)
# ═══════════════════════════════════════════════════════════════════

echo "🚀 Starting Swjsh Algo Knife Server Setup..."

# 1. Update System
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install Python 3.12 & Build Essential
sudo apt install -y python3.12 python3.12-venv python3-pip build-essential

# 4. Install Global Tools
sudo npm install -g pm2 ts-node typescript

# 5. Configure Firewall
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp
sudo ufw --force enable

# 6. Project Setup
echo "📁 Setting up project directory..."
mkdir -p ~/SwjshAlgoKnife
cd ~/SwjshAlgoKnife

echo "✅ Environment ready! Please clone your repo into ~/SwjshAlgoKnife and run 'npm install'."
echo "📌 Don't forget to set up your .env.local with FIREBASE_ADMIN_PRIVATE_KEY."
