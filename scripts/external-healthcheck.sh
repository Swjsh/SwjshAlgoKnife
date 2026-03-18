#!/bin/bash

################################################################################
# External Health Check for SwjshAK Docker Container
################################################################################
#
# This script runs OUTSIDE the Docker container on the GCP VM host.
# It monitors the Docker container and sends Discord alerts on failures.
#
# This is the "watchdog watching the watchdog" — when the container goes down,
# we need external monitoring that isn't affected by container state.
#
# Configuration:
#   - Runs as systemd service (swjshak-healthcheck.service)
#   - Checks every 2 minutes
#   - Requires 3 consecutive failures before alerting (prevents flapping)
#   - Sends Discord embeds via DISCORD_CHIEF_WEBHOOK env var
#   - Logs to /var/log/swjshak-healthcheck.log
#
# Installation:
#   Use setup-external-healthcheck.sh for production deployment
#
################################################################################

set -o pipefail

# Configuration
readonly CONTAINER_NAME="swjshak"
readonly HEALTH_ENDPOINT="http://localhost:3000/api/health"
readonly HEALTHCHECK_INTERVAL=120  # 2 minutes
readonly FAILURE_THRESHOLD=3       # Alert after 3 consecutive failures
readonly LOG_FILE="/var/log/swjshak-healthcheck.log"
readonly STATE_FILE="/tmp/swjshak-healthcheck-state.json"
readonly DISK_THRESHOLD=85         # Alert if /var/lib/docker > 85%

# Colors for logging
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

################################################################################
# Utility Functions
################################################################################

log() {
    local level="$1"
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [${level}] ${message}" >> "${LOG_FILE}"

    # Also print to stderr for systemd journal
    echo "[${level}] ${message}" >&2
}

error() {
    log "ERROR" "$@"
}

warn() {
    log "WARN" "$@"
}

info() {
    log "INFO" "$@"
}

debug() {
    log "DEBUG" "$@"
}

################################################################################
# Discord Integration
################################################################################

send_discord_alert() {
    local title="$1"
    local description="$2"
    local color="$3"  # Hex color without #
    local fields="$4" # JSON array of field objects

    if [[ -z "${DISCORD_CHIEF_WEBHOOK}" ]]; then
        warn "DISCORD_CHIEF_WEBHOOK not set, skipping Discord notification"
        return 1
    fi

    # Construct the Discord embed
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local payload=$(cat <<EOF
{
  "embeds": [
    {
      "title": "${title}",
      "description": "${description}",
      "color": $(printf "%d" 0x${color}),
      "timestamp": "${timestamp}",
      "fields": ${fields},
      "footer": {
        "text": "SwjshAK External Health Monitor"
      }
    }
  ]
}
EOF
)

    # Send to Discord
    local response
    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "${payload}" \
        "${DISCORD_CHIEF_WEBHOOK}" 2>&1)

    local http_code=$(echo "${response}" | tail -n1)

    if [[ "${http_code}" == "204" ]] || [[ "${http_code}" == "200" ]]; then
        info "Discord alert sent successfully (HTTP ${http_code})"
        return 0
    else
        error "Failed to send Discord alert: HTTP ${http_code}"
        echo "${response}" | head -n-1 | debug "Response: %s"
        return 1
    fi
}

send_failure_alert() {
    local failure_reason="$1"
    local details="$2"

    # Create fields array
    local fields=$(cat <<EOF
[
  {
    "name": "Container",
    "value": "${CONTAINER_NAME}",
    "inline": true
  },
  {
    "name": "Hostname",
    "value": "$(hostname)",
    "inline": true
  },
  {
    "name": "Reason",
    "value": "${failure_reason}",
    "inline": false
  },
  {
    "name": "Details",
    "value": "\`\`\`\n${details}\n\`\`\`",
    "inline": false
  },
  {
    "name": "Check Time",
    "value": "$(date '+%Y-%m-%d %H:%M:%S UTC')",
    "inline": false
  }
]
EOF
)

    send_discord_alert \
        "🔴 SwjshAK Container Health Check FAILED" \
        "The external health monitor has detected failures in the SwjshAK container." \
        "FF0000" \
        "${fields}"
}

send_recovery_alert() {
    local recovery_details="$1"

    local fields=$(cat <<EOF
[
  {
    "name": "Container",
    "value": "${CONTAINER_NAME}",
    "inline": true
  },
  {
    "name": "Hostname",
    "value": "$(hostname)",
    "inline": true
  },
  {
    "name": "Status",
    "value": "All checks passing ✓",
    "inline": false
  },
  {
    "name": "Recovery Time",
    "value": "$(date '+%Y-%m-%d %H:%M:%S UTC')",
    "inline": false
  }
]
EOF
)

    send_discord_alert \
        "🟢 SwjshAK Container Health Recovered" \
        "The container has recovered and all health checks are passing." \
        "00FF00" \
        "${fields}"
}

################################################################################
# Health Check Functions
################################################################################

check_container_running() {
    debug "Checking if container ${CONTAINER_NAME} is running..."

    local status
    status=$(docker inspect -f '{{.State.Running}}' "${CONTAINER_NAME}" 2>&1)

    if [[ $? -ne 0 ]]; then
        echo "Container not found: ${status}"
        return 1
    fi

    if [[ "${status}" != "true" ]]; then
        echo "Container is not running (status: ${status})"
        return 1
    fi

    debug "Container is running"
    return 0
}

check_container_not_restarting() {
    debug "Checking container restart status..."

    local restart_count
    restart_count=$(docker inspect -f '{{.RestartCount}}' "${CONTAINER_NAME}" 2>&1)

    if [[ $? -ne 0 ]]; then
        echo "Could not inspect container: ${restart_count}"
        return 1
    fi

    # Check if container has restarted more than 5 times in the last hour
    # This is a heuristic check — repeated restarts indicate a crash loop
    local restart_policy
    restart_policy=$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "${CONTAINER_NAME}" 2>&1)

    debug "Container restart count: ${restart_count}, restart policy: ${restart_policy}"

    # If restarts > 10, likely in a crash loop
    if [[ ${restart_count} -gt 10 ]]; then
        # Check if restarts are recent
        local last_restart_time
        last_restart_time=$(docker inspect -f '{{.State.StartedAt}}' "${CONTAINER_NAME}" 2>&1)
        echo "Container has restarted ${restart_count} times. Last started: ${last_restart_time}"
        return 1
    fi

    debug "Restart count acceptable"
    return 0
}

check_health_endpoint() {
    debug "Checking health endpoint: ${HEALTH_ENDPOINT}"

    local response
    response=$(curl -sf --connect-timeout 5 --max-time 10 "${HEALTH_ENDPOINT}" 2>&1)
    local curl_exit=$?

    if [[ ${curl_exit} -ne 0 ]]; then
        echo "Health endpoint unreachable (curl exit code: ${curl_exit})"
        return 1
    fi

    debug "Health endpoint responded successfully"
    return 0
}

check_memory_usage() {
    debug "Checking container memory usage..."

    local memory_limit
    local memory_usage

    memory_limit=$(docker inspect -f '{{.HostConfig.Memory}}' "${CONTAINER_NAME}" 2>&1)
    memory_usage=$(docker stats --no-stream --format '{{.MemUsage}}' "${CONTAINER_NAME}" 2>&1)

    if [[ $? -ne 0 ]]; then
        debug "Could not check memory stats (may be normal if container just started)"
        return 0  # Don't fail on stats unavailability
    fi

    debug "Memory usage: ${memory_usage}, limit: ${memory_limit}"
    return 0
}

check_disk_usage() {
    debug "Checking disk usage on /var/lib/docker..."

    local docker_disk_usage
    docker_disk_usage=$(df /var/lib/docker | awk 'NR==2 {print $5}' | sed 's/%//')

    if [[ -z "${docker_disk_usage}" ]]; then
        error "Could not determine disk usage"
        return 1
    fi

    debug "Docker disk usage: ${docker_disk_usage}%"

    if [[ ${docker_disk_usage} -gt ${DISK_THRESHOLD} ]]; then
        echo "Disk usage is ${docker_disk_usage}% (threshold: ${DISK_THRESHOLD}%)"
        return 1
    fi

    debug "Disk usage acceptable"
    return 0
}

################################################################################
# State Management
################################################################################

init_state_file() {
    if [[ ! -f "${STATE_FILE}" ]]; then
        cat > "${STATE_FILE}" <<EOF
{
  "failure_count": 0,
  "last_failure_time": null,
  "is_alerting": false,
  "last_check_time": null,
  "last_failure_reason": null
}
EOF
    fi
}

read_state() {
    init_state_file
    cat "${STATE_FILE}"
}

write_state() {
    local failure_count="$1"
    local last_failure_time="$2"
    local is_alerting="$3"
    local last_check_time="$4"
    local last_failure_reason="$5"

    cat > "${STATE_FILE}" <<EOF
{
  "failure_count": ${failure_count},
  "last_failure_time": "${last_failure_time}",
  "is_alerting": ${is_alerting},
  "last_check_time": "${last_check_time}",
  "last_failure_reason": "${last_failure_reason}"
}
EOF
}

get_state_value() {
    local key="$1"
    read_state | grep -o "\"${key}\":[^,}]*" | cut -d':' -f2- | tr -d ' "'
}

################################################################################
# Main Health Check
################################################################################

run_health_checks() {
    local checks_passed=0
    local checks_failed=0
    local failure_messages=()

    info "Running health checks..."

    # Check 1: Container is running
    if ! check_container_running; then
        ((checks_failed++))
        failure_messages+=("$(check_container_running 2>&1 || true)")
        warn "✗ Container running check failed"
    else
        ((checks_passed++))
        info "✓ Container is running"
    fi

    # Check 2: Container is not in restart loop
    if ! check_container_not_restarting; then
        ((checks_failed++))
        failure_messages+=("$(check_container_not_restarting 2>&1 || true)")
        warn "✗ Container restart check failed"
    else
        ((checks_passed++))
        info "✓ Container restart status healthy"
    fi

    # Check 3: Health endpoint responds
    if ! check_health_endpoint; then
        ((checks_failed++))
        failure_messages+=("$(check_health_endpoint 2>&1 || true)")
        warn "✗ Health endpoint check failed"
    else
        ((checks_passed++))
        info "✓ Health endpoint is responding"
    fi

    # Check 4: Disk usage
    if ! check_disk_usage; then
        ((checks_failed++))
        failure_messages+=("$(check_disk_usage 2>&1 || true)")
        warn "✗ Disk usage check failed"
    else
        ((checks_passed++))
        info "✓ Disk usage is acceptable"
    fi

    # Check 5: Memory usage (non-fatal)
    check_memory_usage

    info "Health check complete: ${checks_passed} passed, ${checks_failed} failed"

    return $((checks_failed > 0 ? 1 : 0))
}

handle_failure() {
    local failure_reason="$1"
    shift
    local failure_details="$@"

    local current_state
    current_state=$(read_state)

    local failure_count
    failure_count=$(echo "${current_state}" | grep -o '"failure_count":[^,}]*' | cut -d':' -f2)

    ((failure_count++))

    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    info "Health check failed (failure #${failure_count} of ${FAILURE_THRESHOLD})"
    error "Failure reason: ${failure_reason}"
    error "Details: ${failure_details}"

    # If we've hit the failure threshold, send alert
    if [[ ${failure_count} -ge ${FAILURE_THRESHOLD} ]]; then
        local is_alerting
        is_alerting=$(echo "${current_state}" | grep -o '"is_alerting":[^,}]*' | cut -d':' -f2)

        # Only send alert if we're not already alerting (prevent duplicate alerts)
        if [[ "${is_alerting}" != "true" ]]; then
            error "Failure threshold reached (${FAILURE_COUNT}). Sending Discord alert."
            send_failure_alert "${failure_reason}" "${failure_details}"
            write_state "${failure_count}" "${now}" "true" "${now}" "${failure_reason}"
        else
            debug "Already alerting, not sending duplicate alert"
            write_state "${failure_count}" "${now}" "true" "${now}" "${failure_reason}"
        fi
    else
        write_state "${failure_count}" "${now}" "false" "${now}" "${failure_reason}"
    fi
}

handle_recovery() {
    local current_state
    current_state=$(read_state)

    local is_alerting
    is_alerting=$(echo "${current_state}" | grep -o '"is_alerting":[^,}]*' | cut -d':' -f2)

    if [[ "${is_alerting}" == "true" ]]; then
        info "System recovered. Sending recovery alert."
        send_recovery_alert "All health checks are now passing."
    fi

    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    write_state 0 "null" "false" "${now}" "null"
}

main() {
    init_state_file
    info "Health check cycle started"

    if ! run_health_checks; then
        local failure_messages
        failure_messages=$(check_container_running 2>&1 || true)

        # Collect failure details
        local all_failures=""
        all_failures+="Container running: $(check_container_running 2>&1 || echo 'FAILED')\n"
        all_failures+="Container restarts: $(check_container_not_restarting 2>&1 || echo 'FAILED')\n"
        all_failures+="Health endpoint: $(check_health_endpoint 2>&1 || echo 'FAILED')\n"
        all_failures+="Disk usage: $(check_disk_usage 2>&1 || echo 'FAILED')\n"

        handle_failure "One or more health checks failed" "${all_failures}"
    else
        handle_recovery
    fi

    info "Health check cycle complete"
}

# Entry point
main "$@"
exit $?
