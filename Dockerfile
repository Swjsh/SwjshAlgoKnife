# ═══════════════════════════════════════════════════════════════════════════════
# SwjshAK — Production Dockerfile
# Multi-stage build for Next.js + Python trading agents
# ═══════════════════════════════════════════════════════════════════════════════

FROM node:20-bookworm-slim AS base

# ── Stage 1: Dependencies ─────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# ── Stage 3: Production Runtime ───────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

# Install runtime dependencies: Python + supervisor
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    supervisor \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create Python venv and install agent dependencies
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir \
    requests \
    pandas \
    yfinance \
    python-dotenv \
    websocket-client

# Copy production deps from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy built app from builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

# Copy source files needed at runtime
COPY scripts ./scripts
COPY src ./src
COPY docker-entrypoint.sh ./
COPY ecosystem.config.js ./

# Create supervisord config
RUN mkdir -p /etc/supervisor/conf.d /app/data/logs

COPY <<'EOF' /etc/supervisor/conf.d/swjsh.conf
[supervisord]
nodaemon=true
logfile=/app/data/logs/supervisord.log
pidfile=/var/run/supervisord.pid
user=root

[program:nextjs]
command=node_modules/.bin/next start -p 3000
directory=/app
autostart=true
autorestart=true
stdout_logfile=/app/data/logs/nextjs.log
stderr_logfile=/app/data/logs/nextjs.err
environment=NODE_ENV="production"

[program:watchdog]
command=/opt/venv/bin/python3 scripts/watchdog.py
directory=/app
autostart=true
autorestart=true
stdout_logfile=/app/data/logs/watchdog.log
stderr_logfile=/app/data/logs/watchdog.err
EOF

RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
