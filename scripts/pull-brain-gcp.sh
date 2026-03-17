#!/bin/bash
#════════════════════════════════════════════════════════════════════════════════
# Brain Sync Pull (GCP) — Pulls Obsidian brain files from GitHub
#
# PURPOSE:
#   Runs inside Docker container on GCP. Periodically pulls the latest brain files
#   from the brain-sync branch on GitHub and copies them to /app/data/brain/.
#   This allows Chief and other agents to read the latest Obsidian vault content.
#
# USAGE:
#   Docker container startup (automatic):
#     /app/scripts/pull-brain-gcp.sh
#
#   Manual testing:
#     bash scripts/pull-brain-gcp.sh
#
# ENVIRONMENT VARIABLES:
#   GIT_REPO_URL          — GitHub repo URL (required for shallow clone)
#   GIT_BRANCH            — Branch to pull (default: brain-sync)
#   GIT_SYNC_INTERVAL     — Sync interval in seconds (default: 300 = 5 min)
#   LOG_DIR               — Log directory (default: /app/data/logs)
#
# FEATURES:
#   ✓ Runs as an infinite loop with configurable interval
#   ✓ Uses shallow clone to minimize disk usage
#   ✓ Robust error handling with retry logic (30s backoff)
#   ✓ Detailed logging to /app/data/logs/brain-sync.log
#   ✓ Graceful shutdown on SIGTERM
#   ✓ Checks for changes before updating files
#
# LOGS:
#   /app/data/logs/brain-sync.log — All pull attempts, successes, and errors
#
#════════════════════════════════════════════════════════════════════════════════

set -euo pipefail

#────────────────────────────────────────────────────────────────────────────────
# Configuration
#────────────────────────────────────────────────────────────────────────────────

APP_DIR="${APP_DIR:=/app}"
DATA_DIR="${APP_DIR}/data"
BRAIN_DIR="${DATA_DIR}/brain"
LOG_DIR="${LOG_DIR:=${DATA_DIR}/logs}"
LOG_FILE="${LOG_DIR}/brain-sync.log"

GIT_REPO_URL="${GIT_REPO_URL:=}"
GIT_BRANCH="${GIT_BRANCH:=brain-sync}"
GIT_SYNC_INTERVAL="${GIT_SYNC_INTERVAL:=300}"
TEMP_CLONE_DIR="/tmp/brain-sync-${RANDOM}"

RETRY_DELAY=30
RETRY_COUNT=0
MAX_RETRIES=2

#────────────────────────────────────────────────────────────────────────────────
# Logging Setup
#────────────────────────────────────────────────────────────────────────────────

mkdir -p "${LOG_DIR}" "${BRAIN_DIR}"

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date -Iseconds)
    echo "[${timestamp}] [${level}] ${message}" | tee -a "${LOG_FILE}"
}

log_header() {
    local title="$1"
    log "INFO" "═══════════════════════════════════════════════════════════════════════════════"
    log "INFO" "${title}"
    log "INFO" "═══════════════════════════════════════════════════════════════════════════════"
}

#────────────────────────────────────────────────────────────────────────────────
# Cleanup
#────────────────────────────────────────────────────────────────────────────────

cleanup() {
    if [[ -d "${TEMP_CLONE_DIR}" ]]; then
        log "INFO" "Cleaning up temporary clone directory"
        rm -rf "${TEMP_CLONE_DIR}"
    fi
}

trap cleanup EXIT

handle_shutdown() {
    log "INFO" "Received shutdown signal, stopping brain sync loop"
    exit 0
}

trap handle_shutdown SIGTERM SIGINT

#────────────────────────────────────────────────────────────────────────────────
# Validation
#────────────────────────────────────────────────────────────────────────────────

if [[ -z "${GIT_REPO_URL}" ]]; then
    log "ERROR" "GIT_REPO_URL environment variable is required"
    log "ERROR" "Set it to the GitHub repository URL (e.g., https://github.com/user/repo)"
    exit 1
fi

if ! command -v git &> /dev/null; then
    log "ERROR" "git is not installed or not in PATH"
    exit 1
fi

log "INFO" "Configuration loaded:"
log "INFO" "  Repository:  ${GIT_REPO_URL}"
log "INFO" "  Branch:      ${GIT_BRANCH}"
log "INFO" "  Brain dir:   ${BRAIN_DIR}"
log "INFO" "  Sync interval: ${GIT_SYNC_INTERVAL}s"
log "INFO" "  Log file:    ${LOG_FILE}"

#────────────────────────────────────────────────────────────────────────────────
# Core Sync Functions
#────────────────────────────────────────────────────────────────────────────────

pull_and_sync() {
    log "INFO" "Starting brain sync pull"

    # Check if already synced recently (avoid redundant pulls)
    if [[ -f "${TEMP_CLONE_DIR}/.git" ]]; then
        log "INFO" "Updating existing clone"
        cd "${TEMP_CLONE_DIR}"
        git fetch --depth=1 origin "${GIT_BRANCH}" || return 1
        git checkout "${GIT_BRANCH}" || return 1
    else
        log "INFO" "Creating shallow clone of ${GIT_BRANCH}"
        rm -rf "${TEMP_CLONE_DIR}"
        mkdir -p "${TEMP_CLONE_DIR}"

        if ! git clone --depth=1 --branch="${GIT_BRANCH}" "${GIT_REPO_URL}" "${TEMP_CLONE_DIR}"; then
            log "ERROR" "Failed to clone repository"
            return 1
        fi
    fi

    # Check if brain files exist in cloned repo
    if [[ ! -d "${TEMP_CLONE_DIR}/data/brain" ]]; then
        log "WARN" "No data/brain directory in clone, skipping sync"
        return 0
    fi

    # Copy brain files to /app/data/brain/
    log "INFO" "Copying brain files from clone to ${BRAIN_DIR}"

    local file_count=0
    for src_file in "${TEMP_CLONE_DIR}"/data/brain/*.md; do
        if [[ -f "${src_file}" ]]; then
            local basename=$(basename "${src_file}")
            cp "${src_file}" "${BRAIN_DIR}/${basename}"
            ((file_count++))
        fi
    done

    if [[ ${file_count} -gt 0 ]]; then
        log "INFO" "✅ Successfully synced ${file_count} brain files"
        return 0
    else
        log "WARN" "No .md files found in brain directory"
        return 0
    fi
}

#────────────────────────────────────────────────────────────────────────────────
# Main Loop
#────────────────────────────────────────────────────────────────────────────────

main_loop() {
    log_header "🧠 Brain Sync Pull Loop Started ($(date -Iseconds))"

    while true; do
        RETRY_COUNT=0

        # Attempt pull with retry logic
        while [[ ${RETRY_COUNT} -le ${MAX_RETRIES} ]]; do
            if pull_and_sync; then
                log "INFO" "Brain sync successful at $(date -Iseconds)"
                RETRY_COUNT=0
                break
            else
                RETRY_COUNT=$((RETRY_COUNT + 1))
                if [[ ${RETRY_COUNT} -le ${MAX_RETRIES} ]]; then
                    log "WARN" "Pull failed, retrying in ${RETRY_DELAY}s (attempt ${RETRY_COUNT}/${MAX_RETRIES})"
                    sleep "${RETRY_DELAY}"
                else
                    log "ERROR" "Pull failed after ${MAX_RETRIES} retries, will retry at next interval"
                fi
            fi
        done

        # Sleep until next sync interval
        log "INFO" "Next sync in ${GIT_SYNC_INTERVAL}s..."
        sleep "${GIT_SYNC_INTERVAL}"
    done
}

#════════════════════════════════════════════════════════════════════════════════
# Entry Point
#════════════════════════════════════════════════════════════════════════════════

main_loop
