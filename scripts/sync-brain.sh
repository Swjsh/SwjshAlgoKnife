#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Brain Sync — Copies key Obsidian vault files into data/brain/
#
# LOCAL USAGE (Windows/WSL):
#   bash scripts/sync-brain.sh
#
# GCP USAGE:
#   Called by git post-receive hook, or manually after scp
#
# The brain files in data/brain/ are what Chief reads on GCP.
# The Obsidian vault is the source of truth on Jack's machine.
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# Detect environment
if [[ -d "/home/jackw/SwjshAlgoKnife" ]]; then
    APP_DIR="/home/jackw/SwjshAlgoKnife"
elif [[ -d "/app" ]]; then
    APP_DIR="/app"
else
    APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
fi

BRAIN_DIR="${APP_DIR}/data/brain"
OBSIDIAN_VAULT=""

# Try to find the Obsidian vault (only works on local machine)
if [[ -d "/mnt/c/Users/jackw/Documents/ObsidianVaults/SwjshAK-Brain" ]]; then
    # WSL path
    OBSIDIAN_VAULT="/mnt/c/Users/jackw/Documents/ObsidianVaults/SwjshAK-Brain"
elif [[ -d "C:/Users/jackw/Documents/ObsidianVaults/SwjshAK-Brain" ]]; then
    # Git Bash / MSYS path
    OBSIDIAN_VAULT="C:/Users/jackw/Documents/ObsidianVaults/SwjshAK-Brain"
fi

mkdir -p "${BRAIN_DIR}"

echo "═══════════════════════════════════════════"
echo " Brain Sync — $(date -Iseconds)"
echo "═══════════════════════════════════════════"

if [[ -z "${OBSIDIAN_VAULT}" ]]; then
    echo "⚠️  Obsidian vault not found locally."
    echo "   On GCP, brain files are updated via git push or manual scp."
    echo "   To sync from Windows, use:"
    echo "   gcloud compute scp --recurse data/brain/ swjsh-trading:~/SwjshAlgoKnife/data/brain/ --zone=us-east4-c"

    # On GCP, just verify brain files exist
    if [[ -f "${BRAIN_DIR}/master-tracker.md" ]]; then
        echo "✅ Brain files present in ${BRAIN_DIR}"
        ls -la "${BRAIN_DIR}"/*.md 2>/dev/null || true
    else
        echo "❌ No brain files found. Chief will operate with defaults."
    fi
    exit 0
fi

echo "📖 Obsidian vault found: ${OBSIDIAN_VAULT}"
echo "📝 Syncing to: ${BRAIN_DIR}"

# Sync key files from Obsidian vault
# Only copy files that exist — don't fail on missing ones
sync_file() {
    local src="$1"
    local dest="$2"
    if [[ -f "${src}" ]]; then
        cp "${src}" "${dest}"
        echo "  ✅ $(basename "${dest}")"
    else
        echo "  ⚠️  Not found: $(basename "${src}")"
    fi
}

# Core planning files
sync_file "${OBSIDIAN_VAULT}/🎯 Master Tracker.md" "${BRAIN_DIR}/master-tracker.md"
sync_file "${OBSIDIAN_VAULT}/📊 Dashboard.md" "${BRAIN_DIR}/dashboard.md"
sync_file "${OBSIDIAN_VAULT}/📅 Daily Log.md" "${BRAIN_DIR}/daily-log.md"
sync_file "${OBSIDIAN_VAULT}/Roadmap.md" "${BRAIN_DIR}/roadmap.md"
sync_file "${OBSIDIAN_VAULT}/Current Sprint.md" "${BRAIN_DIR}/current-sprint.md"

# Strategy knowledge
sync_file "${OBSIDIAN_VAULT}/Strategies Overview.md" "${BRAIN_DIR}/strategies.md"
sync_file "${OBSIDIAN_VAULT}/Agent System.md" "${BRAIN_DIR}/agent-system.md"
sync_file "${OBSIDIAN_VAULT}/System Architecture.md" "${BRAIN_DIR}/architecture.md"

# Troubleshooting & operational
sync_file "${OBSIDIAN_VAULT}/Troubleshooting.md" "${BRAIN_DIR}/troubleshooting.md"
sync_file "${OBSIDIAN_VAULT}/Connection Map.md" "${BRAIN_DIR}/connections.md"

echo ""
echo "Brain sync complete. $(ls ${BRAIN_DIR}/*.md 2>/dev/null | wc -l) files synced."
echo "═══════════════════════════════════════════"
