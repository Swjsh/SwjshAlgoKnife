#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
#  SwjshAK — Oracle Cloud Bootstrap
#  Run this ONCE on a fresh Ubuntu 22.04 VM.
#
#  Usage:
#    chmod +x setup_oracle.sh && ./setup_oracle.sh
#
#  What it does:
#    1. Updates the system
#    2. Installs Node.js 20, Python 3, PM2
#    3. Installs all Python bot dependencies
#    4. Creates the data/logs folder structure
#    5. Opens port 3000 in the OS firewall
#    6. Configures PM2 to auto-start on server reboot
#    7. Prints exactly what to do next
# ═══════════════════════════════════════════════════════════════════════════════

set -e  # Exit on any error

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

step()  { echo -e "\n${CYAN}${BOLD}▶ $1${RESET}"; }
ok()    { echo -e "  ${GREEN}✓${RESET} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${RESET}  $1"; }
fatal() { echo -e "\n${RED}✗ FATAL: $1${RESET}\n"; exit 1; }

# ── Detect who we are ─────────────────────────────────────────────────────────
if [ "$EUID" -eq 0 ]; then
    SUDO=""
    HOME_DIR="/root"
else
    SUDO="sudo"
    HOME_DIR="$HOME"
fi

APP_DIR="$HOME_DIR/SwjshAlgoKnife"

echo -e "\n${BOLD}╔══════════════════════════════════════════╗"
echo -e "║      SwjshAK — Oracle Cloud Setup       ║"
echo -e "╚══════════════════════════════════════════╝${RESET}"
echo -e "  App directory: ${CYAN}$APP_DIR${RESET}"
echo -e "  Running as:    ${CYAN}$(whoami)${RESET}\n"

# ── 1. System update ──────────────────────────────────────────────────────────
step "Updating system packages"
$SUDO apt-get update -qq
$SUDO apt-get upgrade -y -qq
ok "System up to date"

# ── 2. Node.js 20 ─────────────────────────────────────────────────────────────
step "Installing Node.js 20 LTS"
if command -v node &>/dev/null && [[ $(node -v) == v20* ]]; then
    ok "Node.js 20 already installed: $(node -v)"
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash - 2>/dev/null
    $SUDO apt-get install -y -qq nodejs
    ok "Node.js installed: $(node -v)"
fi

# ── 3. Build essentials (needed for better-sqlite3 native compile) ────────────
step "Installing build tools"
$SUDO apt-get install -y -qq build-essential python3-dev git
ok "Build tools ready"

# ── 4. Python 3 ───────────────────────────────────────────────────────────────
step "Installing Python 3 + pip"
$SUDO apt-get install -y -qq python3 python3-pip

# On Ubuntu, 'python' may not exist — create symlink so PM2 ecosystem works
if ! command -v python &>/dev/null; then
    $SUDO ln -sf /usr/bin/python3 /usr/bin/python
    ok "Created python → python3 symlink"
else
    ok "python already resolves to $(python --version)"
fi

# ── 5. Python bot dependencies ────────────────────────────────────────────────
step "Installing Python dependencies (yfinance, pandas, numpy, requests)"
pip3 install --quiet --upgrade pip
pip3 install --quiet yfinance pandas numpy requests
ok "Python packages installed"

# ── 6. PM2 process manager ────────────────────────────────────────────────────
step "Installing PM2 globally"
if command -v pm2 &>/dev/null; then
    ok "PM2 already installed: $(pm2 -v)"
else
    $SUDO npm install -g pm2 --silent
    ok "PM2 installed: $(pm2 -v)"
fi

# ── 7. Create directory structure ─────────────────────────────────────────────
step "Creating directory structure"
mkdir -p "$APP_DIR/data/logs"
ok "Created $APP_DIR/data/logs"

# ── 8. OS firewall — open port 3000 ──────────────────────────────────────────
step "Configuring OS firewall (iptables — port 3000)"
# Oracle Cloud Ubuntu images use iptables directly (ufw is not enabled by default)
if $SUDO iptables -C INPUT -m state --state NEW -p tcp --dport 3000 -j ACCEPT 2>/dev/null; then
    ok "Port 3000 already open in iptables"
else
    $SUDO iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
    ok "Port 3000 opened in iptables"
fi

# Persist iptables rules across reboots
if command -v netfilter-persistent &>/dev/null; then
    $SUDO netfilter-persistent save
    ok "iptables rules persisted"
else
    $SUDO apt-get install -y -qq iptables-persistent netfilter-persistent
    $SUDO netfilter-persistent save
    ok "iptables-persistent installed + rules saved"
fi

# ── 9. PM2 startup hook (auto-start on reboot) ───────────────────────────────
step "Configuring PM2 auto-start on server reboot"
# Generate the startup command for the current user/OS
STARTUP_CMD=$(pm2 startup systemd -u $(whoami) --hp "$HOME_DIR" 2>&1 | grep "sudo env" | head -1)
if [ -n "$STARTUP_CMD" ]; then
    eval "$SUDO $STARTUP_CMD" 2>/dev/null || eval "$STARTUP_CMD" 2>/dev/null || true
    ok "PM2 startup configured"
else
    warn "Could not auto-configure PM2 startup. Run 'pm2 startup' manually after deploying."
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo -e "\n${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗"
echo -e "║  ✓  Server bootstrapped successfully!                       ║"
echo -e "╚══════════════════════════════════════════════════════════════╝${RESET}\n"

SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo -e "${BOLD}Next steps:${RESET}\n"

echo -e "${CYAN}── Step 1: Upload your project from Windows ────────────────────${RESET}"
echo -e "  Run this in PowerShell on your Windows machine:"
echo -e "  ${YELLOW}  ./PUSH_TO_SERVER.ps1${RESET}"
echo -e "  (it's in your project folder — it copies everything to this server)\n"

echo -e "${CYAN}── Step 2: Install Node deps + build ───────────────────────────${RESET}"
echo -e "  ${YELLOW}  cd ~/SwjshAlgoKnife${RESET}"
echo -e "  ${YELLOW}  npm install${RESET}"
echo -e "  ${YELLOW}  npm run build${RESET}\n"

echo -e "${CYAN}── Step 3: Add your API keys ────────────────────────────────────${RESET}"
echo -e "  ${YELLOW}  nano ~/SwjshAlgoKnife/.env.local${RESET}"
echo -e "  (paste the contents of your local .env.local file)\n"

echo -e "${CYAN}── Step 4: Start everything ─────────────────────────────────────${RESET}"
echo -e "  ${YELLOW}  cd ~/SwjshAlgoKnife${RESET}"
echo -e "  ${YELLOW}  pm2 start scripts/ecosystem.config.js${RESET}"
echo -e "  ${YELLOW}  pm2 save${RESET}\n"

echo -e "${CYAN}── Step 5: Open Oracle Cloud firewall ───────────────────────────${RESET}"
echo -e "  In the Oracle Cloud Console:"
echo -e "  Networking → Virtual Cloud Networks → [your VCN]"
echo -e "  → Security Lists → Default Security List"
echo -e "  → Add Ingress Rule:"
echo -e "    Source CIDR: 0.0.0.0/0"
echo -e "    Protocol: TCP"
echo -e "    Destination Port: 3000\n"

echo -e "${CYAN}── Your dashboard URL (after Step 5) ───────────────────────────${RESET}"
echo -e "  ${BOLD}http://$SERVER_IP:3000${RESET}\n"

echo -e "${CYAN}── Useful commands once running ────────────────────────────────${RESET}"
echo -e "  pm2 list                        # see all processes"
echo -e "  pm2 logs                        # live logs from all 3 processes"
echo -e "  pm2 logs AK-BitcoinBob          # Bob's logs only"
echo -e "  pm2 logs AK-Sterling            # Sterling's logs only"
echo -e "  pm2 restart AK-BitcoinBob       # restart a specific process"
echo -e "  pm2 restart all                 # restart everything"
echo -e "  tail -f data/logs/dashboard_err.log   # errors from Next.js\n"

echo -e "${CYAN}── To update code in the future ────────────────────────────────${RESET}"
echo -e "  (from your Windows machine, run ./PUSH_TO_SERVER.ps1 again)\n"
