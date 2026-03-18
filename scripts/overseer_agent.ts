// ═══════════════════════════════════════════════════════════════
// OVERSEER AGENT - The Guardian Daemon
// "I watch the watchers. No trade escapes my scrutiny."
// ═══════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { KillSwitch } from '../src/lib/engine/risk/KillSwitch';
import { RiskEngine } from '../src/lib/engine/risk/RiskEngine';

const DB_PATH = path.join(process.cwd(), 'src', 'app', 'api', 'agents', 'agents_db.json');
const OVERSEER_LOG_PATH = path.join(process.cwd(), 'logs', 'overseer.log');
const CHECK_INTERVAL_MS = 10000; // 10 seconds

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

interface OverseerConfig {
    maxDailyDrawdownPct: number;     // Trigger global halt if exceeded
    maxConsecutiveLosses: number;    // Halt agent after N consecutive losses
    maxTradeFrequency: number;       // Max trades per hour per agent
    emergencyContactEnabled: boolean; // Future: webhook/email alerts
}

const CONFIG: OverseerConfig = {
    maxDailyDrawdownPct: 0.05,        // 5% daily drawdown = global halt
    maxConsecutiveLosses: 5,          // 5 losses in a row = halt agent
    maxTradeFrequency: 10,            // Max 10 trades/hour
    emergencyContactEnabled: false,    // Enable when Oraclo ready
};

function log(message: string, level: 'INFO' | 'WARN' | 'CRITICAL' = 'INFO') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'CRITICAL' ? '🚨' : level === 'WARN' ? '⚠️' : '👁️';
    const logLine = `[${timestamp}] ${prefix} [OVERSEER] ${message}`;

    console.log(logLine);

    // Append to log file
    fs.appendFileSync(OVERSEER_LOG_PATH, logLine + '\n');
}

function loadDb(): any {
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (e) {
        log(`Failed to read database: ${e}`, 'WARN');
        return null;
    }
}

// Check 1: Daily Drawdown Monitor
function checkDailyDrawdown(db: any): void {
    const agents = ['fx', 'crypto', 'spx', 'futures', 'boba'];
    let totalDrawdown = 0;
    const startingBalance = 10000; // TODO: Make configurable

    agents.forEach(agentId => {
        const agent = db[agentId];
        if (!agent) return;

        const dailyPnL = RiskEngine.getDailyPnL(agentId);
        totalDrawdown += dailyPnL;
    });

    const drawdownPct = Math.abs(totalDrawdown) / startingBalance;

    if (totalDrawdown < 0 && drawdownPct >= CONFIG.maxDailyDrawdownPct) {
        log(`DAILY DRAWDOWN EXCEEDED: ${(drawdownPct * 100).toFixed(2)}% - TRIGGERING GLOBAL HALT`, 'CRITICAL');
        KillSwitch.globalHalt(`Daily drawdown ${(drawdownPct * 100).toFixed(2)}% exceeded ${(CONFIG.maxDailyDrawdownPct * 100)}% limit`);
    }
}

// Check 2: Consecutive Loss Monitor
function checkConsecutiveLosses(db: any): void {
    const agents = ['fx', 'crypto', 'spx', 'futures', 'boba'];

    agents.forEach(agentId => {
        const agent = db[agentId];
        if (!agent || !agent.closed_trades || agent.status === 'KILLED') return;

        // Count consecutive losses from most recent
        let consecutiveLosses = 0;
        for (const trade of agent.closed_trades) {
            if (trade.status === 'LOSS' || (trade.pnl && trade.pnl < 0)) {
                consecutiveLosses++;
            } else {
                break; // Hit a win, stop counting
            }
        }

        if (consecutiveLosses >= CONFIG.maxConsecutiveLosses) {
            log(`Agent ${agentId} has ${consecutiveLosses} consecutive losses - TRIGGERING KILL SWITCH`, 'CRITICAL');
            KillSwitch.trigger(agentId, `${consecutiveLosses} consecutive losses`, 'OVERSEER');
        }
    });
}

// Check 3: Trade Frequency Monitor (anti-overtrading)
function checkTradeFrequency(db: any): void {
    const agents = ['fx', 'crypto', 'spx', 'futures', 'boba'];
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

    agents.forEach(agentId => {
        const agent = db[agentId];
        if (!agent || !agent.closed_trades || agent.status === 'KILLED') return;

        // Count trades in last hour
        const recentTrades = agent.closed_trades.filter((t: any) =>
            t.closed_at && t.closed_at > oneHourAgo
        ).length;

        if (recentTrades >= CONFIG.maxTradeFrequency) {
            log(`Agent ${agentId} has ${recentTrades} trades in last hour (max: ${CONFIG.maxTradeFrequency}) - Cooling down`, 'WARN');
            // Don't kill, just warn - could implement cooldown state
        }
    });
}

// Check 4: Stale Agent Monitor
function checkStaleAgents(db: any): void {
    const agents = ['fx', 'crypto', 'spx', 'futures', 'boba'];
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    agents.forEach(agentId => {
        const agent = db[agentId];
        if (!agent || agent.status === 'KILLED') return;

        const lastUpdate = new Date(agent.last_updated).getTime();
        const now = Date.now();

        if (now - lastUpdate > staleThreshold) {
            log(`Agent ${agentId} has not updated in ${Math.round((now - lastUpdate) / 1000)}s - May be unresponsive`, 'WARN');
        }
    });
}

// Check 5: Anomaly Detection (unusual trade sizes, prices)
function checkAnomalies(db: any): void {
    const agents = ['fx', 'crypto', 'spx', 'futures', 'boba'];

    agents.forEach(agentId => {
        const agent = db[agentId];
        if (!agent || !agent.active_trades) return;

        agent.active_trades.forEach((trade: any) => {
            // Check for obviously wrong prices (likely data errors)
            if (trade.ticker === 'BTCUSD' && (trade.entry < 1000 || trade.entry > 1000000)) {
                log(`ANOMALY: ${agentId} has suspicious BTC entry price: $${trade.entry}`, 'CRITICAL');
            }

            if (trade.ticker.includes('USD') && !trade.ticker.includes('BTC') && trade.entry > 50) {
                log(`ANOMALY: ${agentId} has suspicious FX entry price: ${trade.entry}`, 'CRITICAL');
            }
        });
    });
}

// Main monitoring loop
async function runOverseerLoop(): Promise<void> {
    log('Overseer Agent Started - Monitoring all trading activity');

    while (true) {
        const db = loadDb();

        if (db) {
            // Run all checks
            checkDailyDrawdown(db);
            checkConsecutiveLosses(db);
            checkTradeFrequency(db);
            checkStaleAgents(db);
            checkAnomalies(db);
        }

        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    log('Overseer Agent shutting down gracefully');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('Overseer Agent terminated');
    process.exit(0);
});

// Start the daemon
runOverseerLoop().catch(err => {
    log(`Fatal error: ${err}`, 'CRITICAL');
    process.exit(1);
});
