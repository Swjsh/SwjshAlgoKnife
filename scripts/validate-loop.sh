#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# SwjshAK — Autonomous Loop Validation
# ═══════════════════════════════════════════════════════════════════════════════
# Run this AFTER deploy-gcp.sh to verify every link in the loop is working.
# Exits 0 if all critical checks pass, 1 if any fail.
#
# Usage: ./scripts/validate-loop.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -uo pipefail

APP_DIR="${HOME}/SwjshAlgoKnife"
DATA_DIR="${APP_DIR}/data"
BRAIN_DIR="${DATA_DIR}/brain"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check_pass() { ((PASS++)); echo -e "  ${GREEN}✓${NC} $1"; }
check_fail() { ((FAIL++)); echo -e "  ${RED}✗${NC} $1"; }
check_warn() { ((WARN++)); echo -e "  ${YELLOW}⚠${NC} $1"; }

echo ""
echo -e "${CYAN}═══ AUTONOMOUS LOOP VALIDATION ═══${NC}"
echo ""

# ─── 1. Services Running ─────────────────────────────────────────────────────
echo -e "${CYAN}[1/7] Service Status${NC}"

for svc in swjsh-trading swjsh-agents swjsh-watchdog openclaw-gateway; do
    if sudo systemctl is-active --quiet "$svc" 2>/dev/null; then
        check_pass "$svc is running"
    else
        check_fail "$svc is NOT running"
    fi
done

# ─── 2. API Endpoints ────────────────────────────────────────────────────────
echo -e "\n${CYAN}[2/7] API Endpoints${NC}"

# Control API
resp=$(curl -sf http://localhost:3000/api/control 2>/dev/null)
if [[ $? -eq 0 && -n "$resp" ]]; then
    check_pass "Control API responding (GET /api/control)"

    # Parse agent count from response
    agent_count=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('agents',{})))" 2>/dev/null || echo "?")
    if [[ "$agent_count" != "?" && "$agent_count" -gt 0 ]]; then
        check_pass "Control API reports $agent_count agents"
    else
        check_warn "Control API returned 0 or unparseable agents"
    fi
else
    check_fail "Control API not responding on :3000"
fi

# Control API POST
resp=$(curl -sf -X POST http://localhost:3000/api/control \
    -H "Content-Type: application/json" \
    -d '{"command":"summary"}' 2>/dev/null)
if [[ $? -eq 0 ]]; then
    check_pass "Control API accepting POST commands"
else
    check_fail "Control API POST failed"
fi

# OpenClaw gateway
if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    check_pass "OpenClaw gateway responding on :3001"
else
    check_warn "OpenClaw gateway not responding on :3001 (may use different health endpoint)"
fi

# ─── 3. Brain Files ──────────────────────────────────────────────────────────
echo -e "\n${CYAN}[3/7] Brain Integrity${NC}"

core_files=(
    "master-tracker.md"
    "strategies.md"
    "decisions-log.md"
    "daily-log.md"
    "learning-log.md"
    "performance-memory.md"
    "self-healing.md"
    "system-architecture.md"
    "environment.md"
    "roadmap.md"
)

agent_files=(
    "agents/sterling.md"
    "agents/bitcoin-bob.md"
    "agents/pivot-pete.md"
    "agents/boba.md"
    "agents/spx-sniper.md"
    "agents/professor.md"
    "agents/overseer.md"
    "agents/auditor.md"
)

for f in "${core_files[@]}"; do
    if [[ -f "$BRAIN_DIR/$f" && -s "$BRAIN_DIR/$f" ]]; then
        check_pass "brain/$f"
    else
        check_fail "brain/$f MISSING or EMPTY"
    fi
done

for f in "${agent_files[@]}"; do
    if [[ -f "$BRAIN_DIR/$f" && -s "$BRAIN_DIR/$f" ]]; then
        check_pass "brain/$f"
    else
        check_fail "brain/$f MISSING or EMPTY"
    fi
done

# ─── 4. OpenClaw Config ──────────────────────────────────────────────────────
echo -e "\n${CYAN}[4/7] OpenClaw Configuration${NC}"

if [[ -f "$HOME/.openclaw/openclaw.json" ]]; then
    check_pass "openclaw.json exists"

    # Check for Windows paths that shouldn't be there
    if grep -q 'C:\\' "$HOME/.openclaw/openclaw.json" 2>/dev/null; then
        check_fail "openclaw.json still contains Windows paths!"
    else
        check_pass "openclaw.json paths look correct (no Windows paths)"
    fi
else
    check_fail "openclaw.json not found"
fi

if [[ -f "$HOME/.openclaw/cron/jobs.json" ]]; then
    check_pass "cron/jobs.json exists"

    job_count=$(python3 -c "import json; print(len(json.load(open('$HOME/.openclaw/cron/jobs.json'))))" 2>/dev/null || echo "?")
    if [[ "$job_count" != "?" ]]; then
        check_pass "Cron jobs loaded: $job_count jobs"
    fi
else
    check_fail "cron/jobs.json not found"
fi

if [[ -f "$HOME/.openclaw/.env" ]]; then
    check_pass "OpenClaw .env exists"

    for key in ANTHROPIC_API_KEY DISCORD_BOT_TOKEN OPENCLAW_GATEWAY_TOKEN; do
        if grep -q "^${key}=" "$HOME/.openclaw/.env" 2>/dev/null; then
            val=$(grep "^${key}=" "$HOME/.openclaw/.env" | cut -d= -f2)
            if [[ -n "$val" && "$val" != "REPLACE"* ]]; then
                check_pass "$key is set"
            else
                check_fail "$key has placeholder value"
            fi
        else
            check_fail "$key not found in .env"
        fi
    done
else
    check_fail "OpenClaw .env not found"
fi

# ─── 5. Data Files ───────────────────────────────────────────────────────────
echo -e "\n${CYAN}[5/7] Data Files${NC}"

if [[ -f "$DATA_DIR/agents_db.json" ]]; then
    check_pass "agents_db.json exists"
else
    check_warn "agents_db.json not found (will be created on first agent run)"
fi

if [[ -f "$DATA_DIR/journal.db" ]]; then
    check_pass "journal.db exists"

    trade_count=$(sqlite3 "$DATA_DIR/journal.db" "SELECT COUNT(*) FROM trades" 2>/dev/null || echo "?")
    if [[ "$trade_count" != "?" ]]; then
        check_pass "journal.db has $trade_count trades"
    fi
else
    check_warn "journal.db not found (will be created on first API hit)"
fi

# ─── 6. Environment Variables ─────────────────────────────────────────────────
echo -e "\n${CYAN}[6/7] Environment Variables (.env.local)${NC}"

required_vars=(WEBHOOK_SECRET APCA_API_KEY_ID APCA_API_SECRET_KEY OANDA_API_TOKEN OANDA_ACCOUNT_ID)
optional_vars=(DISCORD_CHIEF_WEBHOOK ACCOUNT_BALANCE RISK_PER_TRADE CONTROL_API_KEY)

for var in "${required_vars[@]}"; do
    if grep -q "^${var}=" "$APP_DIR/.env.local" 2>/dev/null; then
        val=$(grep "^${var}=" "$APP_DIR/.env.local" | cut -d= -f2)
        if [[ -n "$val" && "$val" != "REPLACE"* ]]; then
            check_pass "$var is set"
        else
            check_fail "$var has placeholder value"
        fi
    else
        check_fail "$var not found in .env.local"
    fi
done

for var in "${optional_vars[@]}"; do
    if grep -q "^${var}=" "$APP_DIR/.env.local" 2>/dev/null; then
        check_pass "$var is set (optional)"
    else
        check_warn "$var not set (optional)"
    fi
done

# ─── 7. Disk & Resources ─────────────────────────────────────────────────────
echo -e "\n${CYAN}[7/7] System Resources${NC}"

disk_pct=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
if [[ "$disk_pct" -lt 80 ]]; then
    check_pass "Disk usage: ${disk_pct}%"
elif [[ "$disk_pct" -lt 90 ]]; then
    check_warn "Disk usage: ${disk_pct}% (getting high)"
else
    check_fail "Disk usage: ${disk_pct}% (critical!)"
fi

mem_avail=$(free -m | awk '/Mem:/ {print $7}')
if [[ "$mem_avail" -gt 256 ]]; then
    check_pass "Available memory: ${mem_avail}MB"
else
    check_warn "Available memory: ${mem_avail}MB (low for e2-small)"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "  ═══════════════════════════════════════════════════════"
echo -e "  ${GREEN}PASSED: $PASS${NC}   ${RED}FAILED: $FAIL${NC}   ${YELLOW}WARNINGS: $WARN${NC}"
echo "  ═══════════════════════════════════════════════════════"
echo ""

if [[ "$FAIL" -eq 0 ]]; then
    echo -e "  ${GREEN}AUTONOMOUS LOOP IS READY${NC}"
    echo ""
    echo "  Next: Wake Chief to confirm he's online:"
    echo "    openclaw system event --text 'Status report — confirm all systems operational' --mode now"
    echo ""
    exit 0
else
    echo -e "  ${RED}$FAIL CRITICAL ISSUES — fix before going live${NC}"
    echo ""
    exit 1
fi
