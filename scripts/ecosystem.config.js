// ─── SwjshAK — PM2 Ecosystem ─────────────────────────────────────────────────
// TWO processes only. The Runner is the master brain — it spawns and manages
// all Python/TS trading agents internally, handles tick processing, risk gating,
// trade grading, and the intelligence layer.
//
// Start everything:  pm2 start scripts/ecosystem.config.js
// View logs:         pm2 logs
// Restart runner:    pm2 restart AK-Runner
// ═══════════════════════════════════════════════════════════════════════════════

const path  = require('path');
const isWin = process.platform === 'win32';

// Project root — works whether this file is run from root OR scripts/
const ROOT  = process.cwd().replace(/[\\\/]scripts$/, '');
const DATA    = path.join(ROOT, 'data');

// Common env injected into every process
// Optional overrides (uncomment and set values to activate):
//   CONTROL_API_KEY   — API key required on X-Control-Key header for /api/control
//   INTEL_API_BASE    — Override intel API URL for split-host deployments
//   DISABLE_CRYPTO_FEED — Set to 'true' to skip Binance WebSocket (FX-only sessions)
//   AGENT_STARTUP_DELAY_MS — ms to wait before spawning agents (default: 12000)
const commonEnv = {
    NODE_ENV:       'production',
    DATA_DIR:       DATA,
    DATABASE_PATH:  path.join(DATA, 'journal.db'),
    AGENTS_DB_PATH: path.join(DATA, 'agents_db.json'),
};

module.exports = {
    apps: [
        // ── Next.js Dashboard + all API routes (incl. LLM Control API) ──────
        {
            name: 'AK-Dashboard',
            script: 'node_modules/.bin/next',
            args: 'start',
            cwd: ROOT,
            env: { ...commonEnv, PORT: 3000 },
            watch: false,
            autorestart: true,
            max_memory_restart: '800M',
            restart_delay: 5000,
            out_file: path.join(DATA, 'logs', 'dashboard_out.log'),
            error_file: path.join(DATA, 'logs', 'dashboard_err.log'),
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
        },

        // ── Agent Runner — THE master orchestrator ──────────────────────────
        // Spawns ALL trading agents (Python + TS) as child processes.
        // Handles: tick processing, risk gating, intel layer, trade grading,
        // health watchdog, and the control API server (port 3001).
        // Individual agents auto-restart if they crash (30s delay).
        // DO NOT add individual agents as separate PM2 processes — Runner owns them.
        {
            name: 'AK-Runner',
            script: 'npx',
            args: 'tsx scripts/agent_runner.ts',
            cwd: ROOT,
            interpreter: 'none',
            env: { ...commonEnv },
            watch: false,
            autorestart: true,
            max_restarts: 50,
            restart_delay: 10000,
            max_memory_restart: '1G',
            kill_timeout: 10000,   // Give agents time to gracefully shut down
            out_file: path.join(DATA, 'logs', 'runner_out.log'),
            error_file: path.join(DATA, 'logs', 'runner_err.log'),
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
        },
    ],
};
