#!/bin/bash
################################################################################
# SwjshAK Caddy Setup for GCP VM — swjsh.app
#
# Installs Caddy, copies Caddyfile, opens firewall, starts service.
# Caddy auto-provisions Let's Encrypt certs for swjsh.app.
#
# PREREQUISITES:
#   1. Cloudflare DNS: A record swjsh.app → GCP external IP (proxy OFF / grey cloud)
#   2. GCP VM running Ubuntu 22.04 with Docker container on :3000
#   3. Run as root (sudo)
#
# Usage:
#   sudo bash deploy/setup-caddy-gcp.sh
#   sudo bash deploy/setup-caddy-gcp.sh --auto    # Skip confirmations
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

AUTO_MODE="${1:-}"
CADDY_CONFIG="/etc/caddy/Caddyfile"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_CADDYFILE="${SCRIPT_DIR}/Caddyfile"

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

confirm() {
    [[ "$AUTO_MODE" == "--auto" ]] && return 0
    read -p "$(echo -e ${YELLOW}$1${NC}) (y/N): " r
    [[ "$r" == "y" || "$r" == "Y" ]]
}

# ── Validation ───────────────────────────────────────────────────────────────

if [[ "$EUID" -ne 0 ]]; then
    log_error "Run as root: sudo bash $0"
    exit 1
fi

if [[ ! -f "$SOURCE_CADDYFILE" ]]; then
    log_error "Caddyfile not found at $SOURCE_CADDYFILE"
    exit 1
fi

# Verify DNS is pointing to this server
EXTERNAL_IP=$(curl -sf http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip -H "Metadata-Flavor: Google" 2>/dev/null || echo "")
if [[ -z "$EXTERNAL_IP" ]]; then
    EXTERNAL_IP=$(curl -sf https://ifconfig.me 2>/dev/null || echo "unknown")
fi

log_info "SwjshAK Caddy Setup — swjsh.app"
log_info "Server external IP: $EXTERNAL_IP"
echo ""

# Check DNS resolution
RESOLVED_IP=$(dig +short swjsh.app 2>/dev/null | head -1)
if [[ -z "$RESOLVED_IP" ]]; then
    log_warn "Could not resolve swjsh.app — make sure Cloudflare DNS A record is set"
    log_warn "A record: swjsh.app -> $EXTERNAL_IP (proxy OFF / grey cloud)"
    if ! confirm "Continue anyway?"; then exit 1; fi
elif [[ "$RESOLVED_IP" != "$EXTERNAL_IP" ]]; then
    log_warn "swjsh.app resolves to $RESOLVED_IP but this server is $EXTERNAL_IP"
    log_warn "Let's Encrypt cert provisioning will fail unless DNS points here"
    if ! confirm "Continue anyway?"; then exit 1; fi
else
    log_success "swjsh.app resolves to $EXTERNAL_IP (correct)"
fi

# ── Step 1: Install Caddy ────────────────────────────────────────────────────

log_info "Step 1: Installing Caddy..."

if command -v caddy &>/dev/null; then
    log_warn "Caddy already installed: $(caddy version)"
else
    apt-get update -qq
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
    apt-get update -qq
    apt-get install -y -qq caddy
    log_success "Caddy installed: $(caddy version)"
fi

# Install dig if not available (for DNS checks)
if ! command -v dig &>/dev/null; then
    apt-get install -y -qq dnsutils
fi

# ── Step 2: GCP Firewall ─────────────────────────────────────────────────────

log_info "Step 2: Configuring GCP firewall..."

if command -v gcloud &>/dev/null; then
    PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")
    if [[ -n "$PROJECT_ID" ]]; then
        RULE_NAME="allow-https-swjsh"
        if gcloud compute firewall-rules describe "$RULE_NAME" --project="$PROJECT_ID" &>/dev/null; then
            log_warn "Firewall rule '$RULE_NAME' already exists"
        else
            gcloud compute firewall-rules create "$RULE_NAME" \
                --project="$PROJECT_ID" \
                --allow=tcp:80,tcp:443 \
                --source-ranges=0.0.0.0/0 \
                --target-tags="http-server,https-server" \
                --description="Allow HTTP/HTTPS for swjsh.app" 2>/dev/null
            log_success "Firewall rule created: $RULE_NAME"
        fi
    else
        log_warn "GCP project not set — create firewall rule manually"
    fi
else
    log_warn "gcloud not available on this VM — create firewall rule manually"
    echo "  gcloud compute firewall-rules create allow-https-swjsh --allow=tcp:80,tcp:443 --source-ranges=0.0.0.0/0"
fi

# ── Step 3: Install Caddyfile ─────────────────────────────────────────────────

log_info "Step 3: Installing Caddyfile..."

mkdir -p /etc/caddy
cp "$SOURCE_CADDYFILE" "$CADDY_CONFIG"
chown root:root "$CADDY_CONFIG"
chmod 644 "$CADDY_CONFIG"
log_success "Caddyfile installed to $CADDY_CONFIG"

# ── Step 4: Validate ─────────────────────────────────────────────────────────

log_info "Step 4: Validating Caddy config..."

if caddy validate --config "$CADDY_CONFIG" --adapter caddyfile 2>/dev/null; then
    log_success "Config is valid"
else
    log_error "Config validation failed. Check: caddy validate --config $CADDY_CONFIG --adapter caddyfile"
    exit 1
fi

# ── Step 5: Start ─────────────────────────────────────────────────────────────

log_info "Step 5: Starting Caddy..."

systemctl enable caddy
systemctl restart caddy
sleep 3

if systemctl is-active --quiet caddy; then
    log_success "Caddy is running"
else
    log_error "Caddy failed to start. Check: journalctl -u caddy -n 50"
    exit 1
fi

# ── Step 6: Verify ────────────────────────────────────────────────────────────

log_info "Step 6: Testing HTTPS..."

sleep 5  # Give Caddy time to provision cert

HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" --connect-timeout 10 "https://swjsh.app/api/health" 2>/dev/null || echo "000")

if [[ "$HTTP_CODE" == "200" ]]; then
    log_success "https://swjsh.app/api/health returned 200"
elif [[ "$HTTP_CODE" == "000" ]]; then
    log_warn "Could not reach https://swjsh.app — cert may still be provisioning (wait 1-2 min)"
    log_info "Test manually: curl -v https://swjsh.app/api/health"
else
    log_warn "Got HTTP $HTTP_CODE from https://swjsh.app/api/health"
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "================================================================"
echo -e "${GREEN}  Caddy setup complete for swjsh.app${NC}"
echo "================================================================"
echo ""
echo "  Dashboard:   https://swjsh.app"
echo "  Agents:      https://swjsh.app/agents"
echo "  Health:      https://swjsh.app/api/health"
echo "  Control API: https://swjsh.app/api/control"
echo ""
echo "  Useful commands:"
echo "    sudo journalctl -u caddy -f          # Live Caddy logs"
echo "    sudo systemctl reload caddy          # Reload config"
echo "    sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile"
echo ""
echo "  To enable Cloudflare proxy (DDoS protection) later:"
echo "    1. Generate Origin Certificate in Cloudflare dashboard"
echo "    2. Save to /etc/caddy/origin.pem and /etc/caddy/origin-key.pem"
echo "    3. Uncomment the tls line in /etc/caddy/Caddyfile"
echo "    4. Set Cloudflare SSL mode to 'Full (Strict)'"
echo "    5. Enable proxy (orange cloud) on the A record"
echo "    6. sudo systemctl reload caddy"
echo ""
echo "================================================================"
