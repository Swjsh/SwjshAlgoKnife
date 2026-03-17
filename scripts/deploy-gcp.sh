#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# SwjshAK — GCP Deployment Script (Brain + Autonomous Loop)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Run this ON THE GCP VM after pulling the latest code.
#
# Prerequisites:
#   1. Code is at ~/SwjshAlgoKnife (git pull or scp'd)
#   2. npm install && npm run build already done
#   3. Python deps installed (yfinance, pandas, requests)
#   4. .env.local exists with broker keys
#   5. ~/.openclaw/.env exists with ANTHROPIC_API_KEY, DISCORD_BOT_TOKEN, OPENCLAW_GATEWAY_TOKEN
#   6. OpenClaw installed (npm install -g @openclaw/openclaw && openclaw init)
#
# What this script does:
#   - Copies GCP-ready OpenClaw configs to ~/.openclaw/
#   - Creates/updates systemd services for all 4 processes
#   - Creates log directory
#   - Starts everything
#   - Runs health checks
#
# Usage:
#   chmod +x scripts/deploy-gcp.sh
#   ./scripts/deploy-gcp.sh
#
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

APP_DIR="${HOME}/SwjshAlgoKnife"
DATA_DIR="${APP_DIR}/data"
BRAIN_DIR="${DATA_DIR}/brain"
OPENCLAW_DIR="${HOME}/.openclaw"
LOG_DIR="${DATA_DIR}/logs"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${CYAN}[DEPLOY]${NC} $1"; }
ok()   { echo -e "${GREEN}  ✓${NC} $1"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $1"; }
fail() { echo -e "${RED}  ✗${NC} $1"; exit 1; }

# ─── Preflight checks ─────────────────────────────────────────────────────────
log "Running preflight checks..."

[[ -d "$APP_DIR" ]]            || fail "App directory not found: $APP_DIR"
[[ -f "$APP_DIR/.env.local" ]] || fail ".env.local not found — create it first (see environment.md)"
[[ -d "$BRAIN_DIR" ]]          || fail "Brain directory not found: $BRAIN_DIR — did you pull latest?"
[[ -f "$APP_DIR/openclaw-setup/openclaw-gcp.json" ]] || fail "openclaw-gcp.json not found — pull latest code"
[[ -f "$APP_DIR/openclaw-setup/cron-jobs-gcp.json" ]] || fail "cron-jobs-gcp.json not found — pull latest code"

command -v node    >/dev/null 2>&1 || fail "node not installed"
command -v python3 >/dev/null 2>&1 || fail "python3 not installed"
command -v npx     >/dev/null 2>&1 || fail "npx not installed"

# Check if Next.js is built
[[ -d "$APP_DIR/.next" ]] || fail "Next.js not built — run 'npm run build' first"

ok "All preflight checks passed"

# ─── Create directories ───────────────────────────────────────────────────────
log "Creating directories..."
mkdir -p "$LOG_DIR"
mkdir -p "$OPENCLAW_DIR/workspace"
mkdir -p "$OPENCLAW_DIR/cron"
mkdir -p "$OPENCLAW_DIR/agents"/{overseer,professor,auditor,sterling,bitcoin-bob,pivot-pete,boba,spx-sniper}
ok "Directories ready"

# ─── Deploy OpenClaw configs ──────────────────────────────────────────────────
log "Deploying OpenClaw GCP configs..."

cp "$APP_DIR/openclaw-setup/openclaw-gcp.json"  "$OPENCLAW_DIR/openclaw.json"
cp "$APP_DIR/openclaw-setup/cron-jobs-gcp.json"  "$OPENCLAW_DIR/cron/jobs.json"

# Workspace files (GCP versions with Linux paths)
if [[ -d "$APP_DIR/openclaw-setup/workspace-gcp" ]]; then
    cp "$APP_DIR/openclaw-setup/workspace-gcp/"*.md "$OPENCLAW_DIR/workspace/"
    ok "Workspace files (GCP) deployed"
else
    warn "No workspace-gcp directory — copying from workspace/ and fixing paths"
    cp "$APP_DIR/openclaw-setup/workspace/"*.md "$OPENCLAW_DIR/workspace/"
    # Fix Windows paths to Linux
    find "$OPENCLAW_DIR/workspace/" -name "*.md" -exec sed -i \
        -e 's|C:\\Users\\jackw\\Desktop\\SwjshAlgoKnife|'"$APP_DIR"'|g' \
        -e 's|C:\\\\Users\\\\jackw\\\\Desktop\\\\SwjshAlgoKnife|'"$APP_DIR"'|g' {} +
    ok "Workspace files deployed (paths fixed)"
fi

# Agent SOUL.md files
if [[ -d "$APP_DIR/openclaw-setup/agents" ]]; then
    for agent_dir in "$APP_DIR/openclaw-setup/agents"/*/; do
        agent_name=$(basename "$agent_dir")
        if [[ -f "${agent_dir}SOUL.md" ]]; then
            cp "${agent_dir}SOUL.md" "$OPENCLAW_DIR/agents/$agent_name/SOUL.md"
        fi
    done
    ok "Agent SOUL files deployed"
fi

# Verify OpenClaw .env exists
if [[ -f "$OPENCLAW_DIR/.env" ]]; then
    ok "OpenClaw .env found"
else
    warn "~/.openclaw/.env not found — create it with ANTHROPIC_API_KEY, DISCORD_BOT_TOKEN, OPENCLAW_GATEWAY_TOKEN"
fi

# ─── Check if openclaw is installed ──────────────────────────────────────────
if command -v openclaw >/dev/null 2>&1; then
    ok "OpenClaw installed: $(openclaw --version 2>/dev/null || echo 'version unknown')"
else
    warn "OpenClaw not installed — run: npm install -g @openclaw/openclaw && openclaw init"
fi

# ─── Create/update systemd services ──────────────────────────────────────────
log "Installing systemd services..."

# 1. Next.js Dashboard + API
sudo tee /etc/systemd/system/swjsh-trading.service > /dev/null << EOF
[Unit]
Description=SwjshAK Trading Dashboard + API
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${APP_DIR}
ExecStart=$(which node) node_modules/.bin/next start -p 3000
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=DATA_DIR=${DATA_DIR}
Environment=AGENTS_DB_PATH=${DATA_DIR}/agents_db.json
Environment=DATABASE_PATH=${DATA_DIR}/journal.db
EnvironmentFile=${APP_DIR}/.env.local

[Install]
WantedBy=multi-user.target
EOF
ok "swjsh-trading.service"

# 2. Agent Runner
sudo tee /etc/systemd/system/swjsh-agents.service > /dev/null << EOF
[Unit]
Description=SwjshAK Agent Runner (master orchestrator)
After=network.target swjsh-trading.service
Requires=swjsh-trading.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${APP_DIR}
ExecStart=$(which npx) tsx scripts/agent_runner.ts
Restart=always
RestartSec=30
Environment=NODE_ENV=production
Environment=DATA_DIR=${DATA_DIR}
Environment=AGENTS_DB_PATH=${DATA_DIR}/agents_db.json
Environment=DATABASE_PATH=${DATA_DIR}/journal.db
EnvironmentFile=${APP_DIR}/.env.local

[Install]
WantedBy=multi-user.target
EOF
ok "swjsh-agents.service"

# 3. Watchdog
sudo tee /etc/systemd/system/swjsh-watchdog.service > /dev/null << EOF
[Unit]
Description=SwjshAK Watchdog Monitor (zero LLM cost)
After=network.target swjsh-trading.service swjsh-agents.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${APP_DIR}
ExecStart=$(which python3) scripts/watchdog.py
Restart=always
RestartSec=15
Environment=APP_DIR=${APP_DIR}
Environment=OPENCLAW_GATEWAY=http://127.0.0.1:3001
Environment=DATA_DIR=${DATA_DIR}
Environment=AGENTS_DB_PATH=${DATA_DIR}/agents_db.json
Environment=DATABASE_PATH=${DATA_DIR}/journal.db
EnvironmentFile=${APP_DIR}/.env.local

[Install]
WantedBy=multi-user.target
EOF
ok "swjsh-watchdog.service"

# 4. OpenClaw Gateway
sudo tee /etc/systemd/system/openclaw-gateway.service > /dev/null << EOF
[Unit]
Description=OpenClaw Gateway (Chief + 8 sub-agents)
After=network.target swjsh-trading.service swjsh-agents.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${APP_DIR}
ExecStart=$(which openclaw 2>/dev/null || echo "/usr/local/bin/openclaw") gateway start
Restart=always
RestartSec=15
EnvironmentFile=${HOME}/.openclaw/.env

[Install]
WantedBy=multi-user.target
EOF
ok "openclaw-gateway.service"

# Reload systemd
sudo systemctl daemon-reload
ok "systemd daemon reloaded"

# ─── Enable and start services ────────────────────────────────────────────────
log "Enabling and starting services..."

# Enable all
sudo systemctl enable swjsh-trading swjsh-agents swjsh-watchdog openclaw-gateway 2>/dev/null

# Start in order (dependencies handle ordering but let's be explicit)
sudo systemctl restart swjsh-trading
sleep 3

sudo systemctl restart swjsh-agents
sleep 2

sudo systemctl restart swjsh-watchdog
sleep 1

sudo systemctl restart openclaw-gateway
sleep 5

ok "All services started"

# ─── Health checks ────────────────────────────────────────────────────────────
log "Running health checks..."

echo ""
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │              SERVICE STATUS                         │"
echo "  ├─────────────────────────────────────────────────────┤"

for svc in swjsh-trading swjsh-agents swjsh-watchdog openclaw-gateway; do
    status=$(sudo systemctl is-active "$svc" 2>/dev/null || echo "inactive")
    if [[ "$status" == "active" ]]; then
        printf "  │  %-22s ${GREEN}%-20s${NC}     │\n" "$svc" "RUNNING"
    else
        printf "  │  %-22s ${RED}%-20s${NC}     │\n" "$svc" "$status"
    fi
done

echo "  └─────────────────────────────────────────────────────┘"
echo ""

# API health check
log "Checking API endpoints..."
sleep 2

if curl -sf http://localhost:3000/api/control > /dev/null 2>&1; then
    ok "Control API responding on :3000"
else
    warn "Control API not responding yet (may still be starting)"
fi

if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    ok "OpenClaw gateway responding on :3001"
else
    warn "OpenClaw gateway not responding yet (may still be starting)"
fi

# Brain file check
log "Verifying brain files..."
brain_count=$(find "$BRAIN_DIR" -name "*.md" | wc -l)
if [[ "$brain_count" -ge 18 ]]; then
    ok "Brain intact: $brain_count files found"
else
    warn "Expected 18+ brain files, found $brain_count"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "  ═══════════════════════════════════════════════════════"
echo "  DEPLOYMENT COMPLETE"
echo "  ═══════════════════════════════════════════════════════"
echo ""
echo "  Dashboard:     http://localhost:3000"
echo "  Control API:   http://localhost:3000/api/control"
echo "  OpenClaw GW:   http://localhost:3001"
echo ""
echo "  Logs:"
echo "    sudo journalctl -fu swjsh-trading"
echo "    sudo journalctl -fu swjsh-agents"
echo "    sudo journalctl -fu swjsh-watchdog"
echo "    sudo journalctl -fu openclaw-gateway"
echo ""
echo "  Quick commands:"
echo "    sudo systemctl status swjsh-trading swjsh-agents swjsh-watchdog openclaw-gateway"
echo "    curl -s http://localhost:3000/api/control | python3 -m json.tool"
echo ""
echo "  To wake Chief manually:"
echo "    openclaw system event --text 'Status report' --mode now"
echo ""
