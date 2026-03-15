#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# SwjshAK — Docker entrypoint
# Runs once on container start. Seeds persistent volume on first boot.
# ═══════════════════════════════════════════════════════════════════════════════
set -e

DATA_DIR="${DATA_DIR:-/app/data}"

echo "▶ SwjshAK starting up..."
echo "  DATA_DIR = $DATA_DIR"

# Ensure the data directory exists (Fly.io creates the mount point but not subdirs)
mkdir -p "$DATA_DIR/logs"

# ── Seed agents_db.json on first boot ─────────────────────────────────────────
# The bundled default lives in the image. Copy it to the volume so it persists
# between deploys. Never overwrite if it already has runtime state.
AGENTS_DB="${AGENTS_DB_PATH:-$DATA_DIR/agents_db.json}"
if [ ! -f "$AGENTS_DB" ]; then
    echo "  Seeding agents_db.json to persistent volume..."
    cp /app/src/app/api/agents/agents_db.json "$AGENTS_DB"
fi

# ── Announce which database will be used ──────────────────────────────────────
DB_FILE="${DATABASE_PATH:-$DATA_DIR/journal.db}"
echo "  SQLite  = $DB_FILE"
echo "  Agents  = $AGENTS_DB"

echo "▶ Handing off to supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/swjsh.conf
