#!/usr/bin/env bash
# ============================================================================
# SwjshAK — Contabo VPS Deployment Script
# One-shot: installs everything, configures OpenClaw, starts autonomous loop
#
# Prerequisites:
#   - Ubuntu 22.04 VPS with root SSH access
#   - Git, Node.js 20+, Python 3.10+ installed
#   - SwjshAlgoKnife repo cloned to /root/SwjshAlgoKnife
#
# Usage:
#   chmod +x deploy-contabo.sh && ./deploy-contabo.sh
#
# This script is idempotent — safe to re-run.
# ============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_DIR="/root/SwjshAlgoKnife"
OPENCLAW_HOME="/root/.openclaw"
SETUP_DIR="${PROJECT_DIR}/openclaw-setup"

log() { echo -e "${CYAN}[DEPLOY]${NC} $1"; }
ok()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn(){ echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ============================================================================
# PHASE 1: Verify Prerequisites
# ============================================================================
log "Phase 1: Checking prerequisites..."

[[ -d "$PROJECT_DIR" ]] || err "Project not found at $PROJECT_DIR. Clone it first:\n  git clone <repo-url> $PROJECT_DIR"
[[ -f "$PROJECT_DIR/CLAUDE.md" ]] || err "Not a SwjshAlgoKnife project directory"

command -v node >/dev/null 2>&1 || err "Node.js not installed. Run: curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs"
command -v python3 >/dev/null 2>&1 || err "Python3 not installed. Run: apt-get install -y python3 python3-pip"
command -v git >/dev/null 2>&1 || err "Git not installed. Run: apt-get install -y git"

NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
[[ "$NODE_VER" -ge 18 ]] || err "Node.js 18+ required (got v${NODE_VER})"

ok "Prerequisites verified: Node $(node --version), Python $(python3 --version | cut -d' ' -f2), Git $(git --version | cut -d' ' -f3)"

# ============================================================================
# PHASE 2: Set Timezone
# ============================================================================
log "Phase 2: Setting timezone to America/New_York (cron jobs use ET)..."
timedatectl set-timezone America/New_York 2>/dev/null || ln -sf /usr/share/zoneinfo/America/New_York /etc/localtime
ok "Timezone: $(date +%Z) ($(date))"

# ============================================================================
# PHASE 3: Install OpenClaw
# ============================================================================
log "Phase 3: Installing OpenClaw..."

if command -v openclaw >/dev/null 2>&1; then
    ok "OpenClaw already installed: $(openclaw --version 2>/dev/null || echo 'version unknown')"
else
    log "Installing openclaw globally via npm..."
    npm install -g openclaw@latest
    ok "OpenClaw installed: $(openclaw --version 2>/dev/null || echo 'installed')"
fi

# ============================================================================
# PHASE 4: Create OpenClaw Directory Structure
# ============================================================================
log "Phase 4: Creating OpenClaw directory structure..."

mkdir -p "${OPENCLAW_HOME}/workspace/memory"
mkdir -p "${OPENCLAW_HOME}/cron"

AGENTS=(overseer professor sterling bitcoin-bob pivot-pete boba spx-sniper main)
for agent in "${AGENTS[@]}"; do
    mkdir -p "${OPENCLAW_HOME}/agents/${agent}"
done

ok "Directory structure created at ${OPENCLAW_HOME}"

# ============================================================================
# PHASE 5: Deploy OpenClaw Config
# ============================================================================
log "Phase 5: Deploying OpenClaw configuration..."

# Main config (Contabo-specific with Linux paths)
cp "${SETUP_DIR}/openclaw-contabo.json" "${OPENCLAW_HOME}/openclaw.json"
ok "Config: openclaw.json deployed"

# Cron jobs (Contabo-specific with Linux paths)
cp "${SETUP_DIR}/cron-jobs-contabo.json" "${OPENCLAW_HOME}/cron/jobs.json"
ok "Cron jobs: 15 autonomous jobs deployed"

# Workspace files (Chief's brain context)
if [[ -d "${SETUP_DIR}/workspace" ]]; then
    cp -r "${SETUP_DIR}/workspace/"* "${OPENCLAW_HOME}/workspace/" 2>/dev/null || true
    ok "Workspace files deployed"
fi

# Agent SOUL files
for agent in "${AGENTS[@]}"; do
    if [[ -f "${SETUP_DIR}/agents/${agent}/SOUL.md" ]]; then
        cp "${SETUP_DIR}/agents/${agent}/SOUL.md" "${OPENCLAW_HOME}/agents/${agent}/SOUL.md"
    fi
done
ok "Agent SOUL files deployed"

# ============================================================================
# PHASE 6: Environment Variables
# ============================================================================
log "Phase 6: Checking environment variables..."

ENV_FILE="${OPENCLAW_HOME}/.env"

if [[ -f "$ENV_FILE" ]]; then
    ok ".env file exists at ${ENV_FILE}"
    # Validate required vars are present (not their values)
    REQUIRED_VARS=("ANTHROPIC_API_KEY" "DISCORD_BOT_TOKEN" "OPENCLAW_GATEWAY_TOKEN")
    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "^${var}=" "$ENV_FILE"; then
            ok "  ${var} = set"
        else
            warn "  ${var} = MISSING — add it to ${ENV_FILE}"
        fi
    done
else
    warn ".env not found. Creating template at ${ENV_FILE}"
    cat > "$ENV_FILE" << 'ENVEOF'
# SwjshAK OpenClaw — Contabo VPS Environment
# Fill in ALL values before starting OpenClaw

# Anthropic API (powers all agents via Claude)
ANTHROPIC_API_KEY=sk-ant-REPLACE_ME

# Discord Bot (two-way: agents listen + respond in Discord)
DISCORD_BOT_TOKEN=REPLACE_ME

# OpenClaw Gateway Token (internal auth, generate with: openssl rand -hex 32)
OPENCLAW_GATEWAY_TOKEN=REPLACE_ME
ENVEOF
    err ".env template created at ${ENV_FILE}. Fill in your credentials and re-run this script."
fi

# ============================================================================
# PHASE 7: Install Project Dependencies
# ============================================================================
log "Phase 7: Installing project dependencies..."

cd "$PROJECT_DIR"

if [[ -f "package-lock.json" ]] && [[ -d "node_modules" ]]; then
    ok "Node modules already installed"
else
    npm install --production
    ok "Node modules installed"
fi

# Python deps
if [[ -f "scripts/requirements.txt" ]]; then
    pip3 install -r scripts/requirements.txt --break-system-packages -q 2>/dev/null || true
    ok "Python dependencies installed"
fi

# ============================================================================
# PHASE 8: Initialize Brain Directory
# ============================================================================
log "Phase 8: Verifying brain directory..."

BRAIN_DIR="${PROJECT_DIR}/data/brain"
AGENT_MEM_DIR="${BRAIN_DIR}/agents"

mkdir -p "$AGENT_MEM_DIR"

BRAIN_FILES=(
    "master-tracker.md" "strategies.md" "decisions-log.md" "daily-log.md"
    "learning-log.md" "performance-memory.md" "self-healing.md"
    "system-architecture.md" "environment.md" "roadmap.md"
)
AGENT_FILES=(
    "sterling.md" "bitcoin-bob.md" "pivot-pete.md" "boba.md"
    "spx-sniper.md" "professor.md" "auditor.md" "overseer.md"
)

MISSING=0
for f in "${BRAIN_FILES[@]}"; do
    if [[ ! -f "${BRAIN_DIR}/${f}" ]]; then
        warn "Missing brain file: ${f}"
        echo "# ${f}" > "${BRAIN_DIR}/${f}"
        MISSING=$((MISSING+1))
    fi
done
for f in "${AGENT_FILES[@]}"; do
    if [[ ! -f "${AGENT_MEM_DIR}/${f}" ]]; then
        warn "Missing agent memory: ${f}"
        echo "# ${f}" > "${AGENT_MEM_DIR}/${f}"
        MISSING=$((MISSING+1))
    fi
done

if [[ $MISSING -eq 0 ]]; then
    ok "All 18 brain files present"
else
    warn "${MISSING} brain files were missing (stubs created)"
fi

# ============================================================================
# PHASE 9: Create systemd Service for OpenClaw
# ============================================================================
log "Phase 9: Creating systemd service for OpenClaw..."

cat > /etc/systemd/system/openclaw.service << SVCEOF
[Unit]
Description=SwjshAK OpenClaw Autonomous Trading System
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${PROJECT_DIR}
Environment=HOME=/root
EnvironmentFile=${OPENCLAW_HOME}/.env
ExecStart=$(which openclaw) start
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable openclaw
ok "systemd service created and enabled"

# ============================================================================
# PHASE 10: Validate Configuration
# ============================================================================
log "Phase 10: Validating configuration..."

# Validate JSON configs
python3 -m json.tool "${OPENCLAW_HOME}/openclaw.json" > /dev/null 2>&1 && ok "openclaw.json: valid JSON" || err "openclaw.json: INVALID JSON"
python3 -m json.tool "${OPENCLAW_HOME}/cron/jobs.json" > /dev/null 2>&1 && ok "cron/jobs.json: valid JSON" || err "cron/jobs.json: INVALID JSON"

# Count cron jobs
JOB_COUNT=$(python3 -c "import json; print(len(json.load(open('${OPENCLAW_HOME}/cron/jobs.json'))))")
ok "Cron jobs configured: ${JOB_COUNT}"

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}  SwjshAK Deployment Complete${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""
echo -e "  Project:    ${PROJECT_DIR}"
echo -e "  OpenClaw:   ${OPENCLAW_HOME}"
echo -e "  Brain:      ${BRAIN_DIR} (18 files)"
echo -e "  Cron Jobs:  ${JOB_COUNT} autonomous jobs"
echo -e "  Service:    openclaw.service (systemd)"
echo ""
echo -e "${GREEN}To start the autonomous loop:${NC}"
echo -e "  systemctl start openclaw"
echo ""
echo -e "${GREEN}To check status:${NC}"
echo -e "  systemctl status openclaw"
echo -e "  journalctl -u openclaw -f"
echo ""
echo -e "${GREEN}To verify cron schedule:${NC}"
echo -e "  openclaw cron:list"
echo ""
echo -e "${YELLOW}IMPORTANT: Make sure .env has real credentials before starting!${NC}"
echo -e "  ${OPENCLAW_HOME}/.env"
echo ""
