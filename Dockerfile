# ═══════════════════════════════════════════════════════════════════════════════
# SwjshAK — Dockerfile
# Single container: Next.js dashboard + Agent Runner (master orchestrator)
# Process manager: supervisord (2 processes only)
# Persistent data: /app/data (mount a GCP persistent disk or Docker volume here)
#
# The Agent Runner spawns and manages ALL trading agents (Python + TS) internally.
# DO NOT run individual Python agents as separate processes.
# ═══════════════════════════════════════════════════════════════════════════════

FROM node:20-bullseye

# ── System deps ───────────────────────────────────────────────────────────────
# python3 / pip3: for the trading bots (spawned by agent_runner.ts)
# supervisor: process manager (runs Dashboard + Runner)
# build-essential / python-is-python3: needed to compile better-sqlite3 native module
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python-is-python3 \
    supervisor \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── Python deps ───────────────────────────────────────────────────────────────
# All Python agents share these. Install before copying source for Docker cache.
RUN pip3 install --no-cache-dir \
    yfinance \
    pandas \
    numpy \
    requests

# ── Node deps + build ─────────────────────────────────────────────────────────
WORKDIR /app

# Copy manifests first (cache layer — only invalidated when deps change)
COPY package.json package-lock.json ./

# Install ALL deps including devDeps (needed for TypeScript build + tsx runtime)
# better-sqlite3 compiles a native .node binary here for the Linux target
RUN npm ci

# Copy full source
COPY . .

# Generate Prisma client (if using Prisma)
RUN npx prisma generate 2>/dev/null || true

# Build Next.js production bundle
RUN npm run build

# ── Persistent data directory ─────────────────────────────────────────────────
# /app/data is where GCP mounts the persistent disk.
# On first boot the entrypoint seeds required files here.
RUN mkdir -p /app/data/logs

# ── Supervisor config ─────────────────────────────────────────────────────────
COPY supervisord.conf /etc/supervisor/conf.d/swjsh.conf

# ── Entrypoint ────────────────────────────────────────────────────────────────
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# ── Health check ─────────────────────────────────────────────────────────────
# GCP and Docker health checks — verifies both dashboard and runner are alive
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
