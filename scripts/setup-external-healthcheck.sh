#!/bin/bash

################################################################################
# Setup External Health Check as a Systemd Service
################################################################################
#
# This script installs the external health monitor as a systemd service
# on the GCP VM. It runs outside the Docker container and monitors the
# swjshak container health with Discord alerting.
#
# Usage:
#   ./setup-external-healthcheck.sh https://discord.com/api/webhooks/...
#
# Arguments:
#   $1 - Discord webhook URL (DISCORD_CHIEF_WEBHOOK)
#        Get this from the Discord server settings > Webhooks
#
# The script will:
#   1. Copy the health check script to /opt/swjshak/healthcheck/
#   2. Create a systemd service file
#   3. Create a systemd timer (runs every 2 minutes)
#   4. Enable and start the service
#   5. Verify installation
#
################################################################################

set -euo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly HEALTHCHECK_SCRIPT="${SCRIPT_DIR}/external-healthcheck.sh"
readonly INSTALL_DIR="/opt/swjshak/healthcheck"
readonly LOG_DIR="/var/log"
readonly SERVICE_NAME="swjshak-healthcheck"
readonly SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
readonly TIMER_FILE="/etc/systemd/system/${SERVICE_NAME}.timer"

################################################################################
# Utility Functions
################################################################################

log_error() {
    echo -e "${RED}✗ ERROR:${NC} $@" >&2
}

log_success() {
    echo -e "${GREEN}✓ $@${NC}"
}

log_info() {
    echo -e "${BLUE}ℹ $@${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠ $@${NC}"
}

die() {
    log_error "$@"
    exit 1
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        die "This script must be run as root (use sudo)"
    fi
}

check_requirements() {
    log_info "Checking requirements..."

    # Check for required commands
    local required_commands=(docker curl)
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            die "Required command not found: $cmd"
        fi
    done
    log_success "All required commands are available"

    # Check that Docker daemon is running
    if ! docker ps &> /dev/null; then
        die "Docker daemon is not running or you don't have permission to access it"
    fi
    log_success "Docker daemon is accessible"

    # Check that the healthcheck script exists
    if [[ ! -f "${HEALTHCHECK_SCRIPT}" ]]; then
        die "Healthcheck script not found at: ${HEALTHCHECK_SCRIPT}"
    fi
    log_success "Healthcheck script found"
}

validate_webhook_url() {
    local webhook_url="$1"

    if [[ -z "${webhook_url}" ]]; then
        die "Discord webhook URL is required"
    fi

    if ! [[ "${webhook_url}" =~ ^https://discord\.com/api/webhooks/ ]]; then
        die "Invalid Discord webhook URL format. Expected: https://discord.com/api/webhooks/..."
    fi

    log_success "Webhook URL format is valid"
}

test_webhook_connection() {
    local webhook_url="$1"

    log_info "Testing Discord webhook connection..."

    # Create a simple test payload
    local test_payload='{
      "embeds": [
        {
          "title": "SwjshAK Health Monitor Installation",
          "description": "Installation test message - this confirms the webhook URL is valid.",
          "color": 3066993
        }
      ]
    }'

    local response
    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "${test_payload}" \
        "${webhook_url}" 2>&1)

    local http_code
    http_code=$(echo "${response}" | tail -n1)

    if [[ "${http_code}" == "204" ]] || [[ "${http_code}" == "200" ]]; then
        log_success "Discord webhook is working (HTTP ${http_code})"
        return 0
    else
        log_warn "Discord webhook returned HTTP ${http_code} - configuration will proceed but webhook may not work"
        log_warn "Response: $(echo "${response}" | head -n-1)"
        return 0  # Don't die here, proceed with installation
    fi
}

create_install_directory() {
    log_info "Creating installation directory: ${INSTALL_DIR}"

    if [[ ! -d "${INSTALL_DIR}" ]]; then
        mkdir -p "${INSTALL_DIR}"
        chmod 755 "${INSTALL_DIR}"
        log_success "Installation directory created"
    else
        log_info "Installation directory already exists"
    fi
}

install_healthcheck_script() {
    log_info "Installing healthcheck script..."

    cp "${HEALTHCHECK_SCRIPT}" "${INSTALL_DIR}/healthcheck.sh"
    chmod 755 "${INSTALL_DIR}/healthcheck.sh"

    log_success "Healthcheck script installed to ${INSTALL_DIR}/healthcheck.sh"
}

create_service_file() {
    local webhook_url="$1"

    log_info "Creating systemd service file..."

    # Create the service file
    cat > "${SERVICE_FILE}" <<'HEREDOC'
[Unit]
Description=SwjshAK External Health Monitor
Documentation=https://github.com/swjsh-algo-knife/healthcheck
Wants=swjshak-healthcheck.timer
After=docker.service

[Service]
Type=oneshot
User=root
Group=root

# Environment variables
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
HEREDOC

    # Add the Discord webhook URL to the service file
    echo "Environment=\"DISCORD_CHIEF_WEBHOOK=${webhook_url}\"" >> "${SERVICE_FILE}"

    cat >> "${SERVICE_FILE}" <<'HEREDOC'

# Execution
ExecStart=/opt/swjshak/healthcheck/healthcheck.sh

# Restart behavior
Restart=on-failure
RestartSec=10
StartLimitInterval=300
StartLimitBurst=3

# Resource limits
MemoryLimit=256M
CPUQuota=50%

# Security
ProtectSystem=strict
ProtectHome=yes
NoNewPrivileges=yes
PrivateTmp=yes
ReadWritePaths=/var/log /tmp /var/lib/docker

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=swjshak-healthcheck

[Install]
WantedBy=multi-user.target
HEREDOC

    chmod 644 "${SERVICE_FILE}"
    log_success "Service file created at ${SERVICE_FILE}"
}

create_timer_file() {
    log_info "Creating systemd timer file..."

    cat > "${TIMER_FILE}" <<'HEREDOC'
[Unit]
Description=SwjshAK External Health Monitor Timer
Documentation=https://github.com/swjsh-algo-knife/healthcheck
Requires=swjshak-healthcheck.service

[Timer]
# Run every 2 minutes
OnBootSec=30sec
OnUnitActiveSec=2min

# Run immediately if the system was powered down during a scheduled time
Persistent=yes

# Run with 30 second jitter to avoid thundering herd
RandomizedDelaySec=30sec

# High accuracy timer (fires as close to the time as possible)
AccuracySec=1s

[Install]
WantedBy=timers.target
HEREDOC

    chmod 644 "${TIMER_FILE}"
    log_success "Timer file created at ${TIMER_FILE}"
}

create_log_file() {
    log_info "Creating log file..."

    local log_file="${LOG_DIR}/swjshak-healthcheck.log"

    if [[ ! -f "${log_file}" ]]; then
        touch "${log_file}"
    fi

    chmod 644 "${log_file}"
    chown root:root "${log_file}"

    log_success "Log file configured at ${log_file}"
}

reload_systemd() {
    log_info "Reloading systemd daemon..."

    systemctl daemon-reload

    log_success "Systemd daemon reloaded"
}

enable_and_start_service() {
    log_info "Enabling and starting the service..."

    # Enable the timer
    systemctl enable "${SERVICE_NAME}.timer"

    # Start the timer
    systemctl start "${SERVICE_NAME}.timer"

    log_success "Timer enabled and started"
}

verify_installation() {
    log_info "Verifying installation..."

    # Check if timer is active
    local timer_status
    timer_status=$(systemctl is-active "${SERVICE_NAME}.timer" 2>&1)

    if [[ "${timer_status}" != "active" ]]; then
        log_error "Timer is not active (status: ${timer_status})"
        return 1
    fi
    log_success "Timer is active"

    # Check if service file exists
    if [[ ! -f "${SERVICE_FILE}" ]]; then
        log_error "Service file does not exist at ${SERVICE_FILE}"
        return 1
    fi
    log_success "Service file exists"

    # Check if timer file exists
    if [[ ! -f "${TIMER_FILE}" ]]; then
        log_error "Timer file does not exist at ${TIMER_FILE}"
        return 1
    fi
    log_success "Timer file exists"

    # Show next scheduled run
    local next_run
    next_run=$(systemctl list-timers "${SERVICE_NAME}.timer" --no-pager 2>&1 | grep "${SERVICE_NAME}")

    if [[ -n "${next_run}" ]]; then
        log_info "Next scheduled run:"
        echo "  ${next_run}"
    fi

    return 0
}

print_summary() {
    local webhook_url="$1"

    echo ""
    echo "========================================================================"
    echo "                 Installation Summary"
    echo "========================================================================"
    echo ""
    log_success "SwjshAK External Health Monitor has been successfully installed!"
    echo ""
    echo "Service Details:"
    echo "  - Service Name:        ${SERVICE_NAME}"
    echo "  - Service File:        ${SERVICE_FILE}"
    echo "  - Timer File:          ${TIMER_FILE}"
    echo "  - Healthcheck Script:  ${INSTALL_DIR}/healthcheck.sh"
    echo "  - Log File:            ${LOG_DIR}/swjshak-healthcheck.log"
    echo ""
    echo "Configuration:"
    echo "  - Check Interval:      2 minutes"
    echo "  - Failure Threshold:   3 consecutive failures"
    echo "  - Discord Webhook:     ${webhook_url:0:50}..."
    echo ""
    echo "Useful Commands:"
    echo "  - View logs:           journalctl -u ${SERVICE_NAME}.service -f"
    echo "  - Timer status:        systemctl status ${SERVICE_NAME}.timer"
    echo "  - Service status:      systemctl status ${SERVICE_NAME}.service"
    echo "  - Trigger manually:    systemctl start ${SERVICE_NAME}.service"
    echo "  - View next runs:      systemctl list-timers ${SERVICE_NAME}.timer"
    echo "  - Disable service:     systemctl disable ${SERVICE_NAME}.timer"
    echo "  - Uninstall:           See setup-external-healthcheck-uninstall.sh"
    echo ""
    echo "========================================================================"
    echo ""
}

################################################################################
# Main Installation Flow
################################################################################

main() {
    echo ""
    echo "=========================================="
    echo "  SwjshAK External Health Monitor Setup"
    echo "=========================================="
    echo ""

    # Check root privileges
    check_root

    # Get webhook URL from argument or environment
    local webhook_url="${1:-${DISCORD_CHIEF_WEBHOOK:-}}"

    if [[ -z "${webhook_url}" ]]; then
        die "Discord webhook URL is required. Provide as argument or DISCORD_CHIEF_WEBHOOK environment variable"
    fi

    # Validate webhook URL
    validate_webhook_url "${webhook_url}"

    # Check all requirements
    check_requirements

    # Test webhook connection
    test_webhook_connection "${webhook_url}"

    # Create directories
    create_install_directory

    # Install scripts
    install_healthcheck_script

    # Create systemd files
    create_log_file
    create_service_file "${webhook_url}"
    create_timer_file

    # Reload systemd and start
    reload_systemd
    enable_and_start_service

    # Verify installation
    if ! verify_installation; then
        die "Installation verification failed. Please check the systemd logs."
    fi

    # Print summary
    print_summary "${webhook_url}"

    log_success "Installation complete!"
}

# Run main function
main "$@"
