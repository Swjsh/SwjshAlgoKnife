
import fs from 'fs';
import path from 'path';
import { MarketData, PriceUpdate } from '../src/lib/engine/local_runner/MarketData';
import { StrategyLoop, Signal } from '../src/lib/engine/local_runner/StrategyLoop';
import { TheProfessor, TradeReview } from '../src/lib/engine/local_runner/TheProfessor';
import { TheAuditor, AuditReport } from '../src/lib/engine/local_runner/TheAuditor';
import { spawn } from 'child_process';

// --- OVERSEER RISK MANAGEMENT ---
import { RiskEngine, Trade } from '../src/lib/engine/risk/RiskEngine';
import { FrictionSimulator } from '../src/lib/engine/risk/FrictionSimulator';
import { RegimeDetector } from '../src/lib/engine/risk/RegimeDetector';
import { KillSwitch } from '../src/lib/engine/risk/KillSwitch';

// ─── INTELLIGENCE LAYER ──────────────────────────────────────────────────────
import { OrderFlowService } from '../src/lib/intel/orderflow/service';
import { SentimentBridge } from '../src/lib/intel/sentiment/bridge';
import { OnChainBridge } from '../src/lib/intel/onchain/bridge';
import { WhaleFlowService } from '../src/lib/intel/whale/service';
import { startFreeFeeds, stopFreeFeeds } from '../src/lib/intel/free/service';
import intelBus from '../src/lib/intel/bus';

// Intel service instances (module-level for graceful shutdown)
let _orderFlow: OrderFlowService | null = null;
let _sentiment: SentimentBridge | null = null;
let _onchain: OnChainBridge | null = null;
let _whale: WhaleFlowService | null = null;

function startIntelServices(): void {
    console.log('\n🧠 ═══ Starting Intelligence Layer ═══');

    try {
        _orderFlow = new OrderFlowService();
        _orderFlow.start();
        console.log('  ✅ Order Flow Service (CVD + Absorption) — ONLINE');
    } catch (e) {
        console.error('  ❌ Order Flow failed to start:', e);
    }

    try {
        _sentiment = new SentimentBridge();
        _sentiment.start();
        console.log('  ✅ Sentiment Bridge (News + Fear/Greed) — ONLINE');
    } catch (e) {
        console.error('  ❌ Sentiment Bridge failed to start:', e);
    }

    try {
        _onchain = new OnChainBridge();
        _onchain.start();
        console.log('  ✅ On-Chain Confluence (Etherscan Wallets) — ONLINE');
    } catch (e) {
        console.error('  ❌ On-Chain Bridge failed to start:', e);
    }

    try {
        _whale = new WhaleFlowService();
        _whale.start();
        console.log('  ✅ Whale Flow Tracker (Exchange Flows) — ONLINE');
    } catch (e) {
        console.error('  ❌ Whale Flow failed to start:', e);
    }

    // ── Free Intel Feeds (zero-cost, no API keys) ──────────────────────────
    try {
        startFreeFeeds();
        console.log('  ✅ Free Intel Feeds (Fear&Greed, Funding/OI, Market Data, Econ Cal) — ONLINE');
    } catch (e) {
        console.error('  ❌ Free Intel Feeds failed to start:', e);
    }

    console.log('🧠 ═══════════════════════════════════\n');
}

function stopIntelServices(): void {
    console.log('🧠 Shutting down intelligence services...');
    try { _orderFlow?.stop(); } catch {}
    try { _sentiment?.stop(); } catch {}
    try { _onchain?.stop(); } catch {}
    try { _whale?.stop(); } catch {}
    try { stopFreeFeeds(); } catch {}
}

// Graceful shutdown handler
process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received — shutting down all agents...');
    stopIntelServices();
    // Kill all agent child processes
    [pivotPeteProcess, bobaProcess, spxProcess, orbProcess, sterlingProcess, bitcoinBobProcess].forEach(p => {
        try { p?.kill(); } catch {}
    });
    saveDb();
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received — shutting down all agents...');
    stopIntelServices();
    // Kill all agent child processes
    [pivotPeteProcess, bobaProcess, spxProcess, orbProcess, sterlingProcess, bitcoinBobProcess].forEach(p => {
        try { p?.kill(); } catch {}
    });
    saveDb();
    process.exit(0);
});

const DATA_DIR = process.env.DATA_DIR ?? process.cwd();
const DB_PATH = process.env.AGENTS_DB_PATH ?? path.join(DATA_DIR, 'agents_db.json');
const REALITY_CHECK_PATH = path.join(process.cwd(), 'docs', 'reality_check.md');

// --- REALITY CHECK LOGGER ---
// Appends trade friction data to docs/reality_check.md
function appendToRealityCheck(
    agentId: string,
    ticker: string,
    grossPnL: number,
    netPnL: number,
    cause: string
): void {
    try {
        const date = new Date().toISOString().split('T')[0];
        const gap = (grossPnL - netPnL).toFixed(2);
        const newRow = `| ${date} | ${agentId} | ${ticker} | $${grossPnL.toFixed(2)} | $${netPnL.toFixed(2)} | -$${gap} | ${cause} |\n`;

        // Read current file
        let content = fs.readFileSync(REALITY_CHECK_PATH, 'utf8');

        // Find the table and append after header row (after |------|)
        const headerEnd = content.indexOf('|------');
        if (headerEnd !== -1) {
            const insertPoint = content.indexOf('\n', headerEnd) + 1;
            content = content.slice(0, insertPoint) + newRow + content.slice(insertPoint);

            // Update cumulative stats
            const trades = (content.match(/\| \d{4}-\d{2}-\d{2} \|/g) || []).length;
            const totalFriction = parseFloat(gap);

            // Update stats section
            content = content.replace(/Total Trades: \d+/, `Total Trades: ${trades}`);
            content = content.replace(/Total Friction Cost: \$[\d.]+/, `Total Friction Cost: $${totalFriction.toFixed(2)}`);

            fs.writeFileSync(REALITY_CHECK_PATH, content);
            console.log(`📝 [REALITY CHECK] Logged trade: ${ticker} friction -$${gap}`);
        }
    } catch (e) {
        console.error('❌ [REALITY CHECK] Failed to log:', e);
    }
}

// --- State Definitions ---
interface AgentState {
    last_updated: string;
    status: string;
    active_pairs: number;
    total_zones_found: number;
    performance: { win_rate: number; total_pnl: number; trades: number };
    pending_orders: any[];
    active_trades: any[];  // NEW: Persistent active trades
    closed_trades: any[];
    reviews?: TradeReview[];
    audits?: AuditReport[];
    meta: { name: string; type: string };
}

interface DbSchema {
    fx: AgentState;
    crypto: AgentState;
    spx: AgentState;
    futures: AgentState;
    boba: AgentState;
    orb: AgentState;
    professor: AgentState;
    auditor: AgentState;
}


// --- Initial State ---
const EXAMPLE_DB: DbSchema = {
    fx: {
        last_updated: new Date().toISOString(),
        status: 'ACTIVE',
        active_pairs: 5,
        total_zones_found: 0,
        performance: { win_rate: 0, total_pnl: 0, trades: 0 },
        pending_orders: [],
        active_trades: [],
        closed_trades: [],
        meta: { name: 'Sterling', type: 'Forex' }
    },
    crypto: {
        last_updated: new Date().toISOString(),
        status: 'ACTIVE',
        active_pairs: 3,
        total_zones_found: 0,
        performance: { win_rate: 0, total_pnl: 0, trades: 0 },
        pending_orders: [],
        active_trades: [],
        closed_trades: [],
        meta: { name: 'Bitcoin Bob', type: 'Crypto' }
    },
    spx: {
        last_updated: new Date().toISOString(),
        status: 'ACTIVE',
        active_pairs: 1,
        total_zones_found: 0,
        performance: { win_rate: 0, total_pnl: 0, trades: 0 },
        pending_orders: [],
        active_trades: [],
        closed_trades: [],
        meta: { name: 'SPX Sniper', type: 'Options' }
    },
    futures: {
        last_updated: new Date().toISOString(),
        status: 'ACTIVE',
        active_pairs: 1,
        total_zones_found: 0,
        performance: { win_rate: 0, total_pnl: 0, trades: 0 },
        pending_orders: [],
        active_trades: [],
        closed_trades: [],
        meta: { name: 'Pivot Pete', type: 'Futures' }
    },
    boba: {
        last_updated: new Date().toISOString(),
        status: 'ACTIVE',
        active_pairs: 1,
        total_zones_found: 0,
        performance: { win_rate: 65, total_pnl: 0, trades: 0 },
        pending_orders: [],
        active_trades: [],
        closed_trades: [],
        meta: { name: 'Boba', type: 'Options' }
    },
    orb: {
        last_updated: new Date().toISOString(),
        status: 'ACTIVE',
        active_pairs: 1,
        total_zones_found: 0,
        performance: { win_rate: 0, total_pnl: 0, trades: 0 },
        pending_orders: [],
        active_trades: [],
        closed_trades: [],
        meta: { name: 'ORB Runner', type: 'Futures' }
    },
    professor: {

        last_updated: new Date().toISOString(),
        status: 'ONLINE',
        active_pairs: 0,
        total_zones_found: 0,
        performance: { win_rate: 100, total_pnl: 0, trades: 0 },
        pending_orders: [],
        active_trades: [],
        closed_trades: [],
        reviews: [],
        audits: [],
        meta: { name: 'The Professor', type: 'Auditor' }
    },
    auditor: {
        last_updated: new Date().toISOString(),
        status: 'ONLINE',
        active_pairs: 0,
        total_zones_found: 0,
        performance: { win_rate: 100, total_pnl: 0, trades: 0 },
        pending_orders: [],
        active_trades: [],
        closed_trades: [],
        audits: [],
        meta: { name: 'The Auditor', type: 'Oversight' }
    }
};

// --- Runtime ---
console.log('🚀 Starting Swjsh Autonomous Engine...');

// 1. Load or Create DB
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(EXAMPLE_DB, null, 2));
    console.log('Created new DB at', DB_PATH);
}
let db: DbSchema = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// --- Agent State Management ---
let lastTickTime: number = Date.now();
const pausedAgents: Set<string> = new Set();

// 1b. Start intelligence services (async, non-blocking)
startIntelServices();

// 2. Initialize Components
const market = new MarketData();
const strategy = new StrategyLoop();

// 3. Spawn Agents

// --- Sterling FX Agent ---
let sterlingProcess: any = null;

function startSterling() {
    console.log('🇬🇧 Starting Sterling FX Agent...');
    const py = process.platform === 'win32' ? 'python' : 'python3';
    sterlingProcess = spawn(py, ['scripts/sterling_fx_engine.py'], { cwd: process.cwd() });

    sterlingProcess.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n');
        lines.forEach((line: string) => {
            if (line.includes('AGENT_STATUS_UPDATE:')) {
                try {
                    const json = JSON.parse(line.split('AGENT_STATUS_UPDATE:')[1]);
                    db.fx = { ...db.fx, ...json, last_updated: new Date().toISOString() };
                    saveDb();
                } catch {}
            }
            if (line.trim()) console.log(`[Sterling] ${line.trim()}`);
        });
    });

    sterlingProcess.stderr?.on('data', (data: Buffer) => {
        console.error(`[Sterling ERR] ${data.toString().trim()}`);
    });

    sterlingProcess.on('close', (code: number) => {
        console.log(`⚠️ Sterling exited with code ${code}`);
        if (!pausedAgents.has('fx')) {
            setTimeout(startSterling, 30000);
        }
    });
}

// startSterling() — called from the delayed launch block below

// --- Bitcoin Bob Agent ---
let bitcoinBobProcess: any = null;

function startBitcoinBob() {
    console.log('₿ Starting Bitcoin Bob Agent...');
    const py = process.platform === 'win32' ? 'python' : 'python3';
    bitcoinBobProcess = spawn(py, ['scripts/run_bitcoin_bob.py'], { cwd: process.cwd() });

    bitcoinBobProcess.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n');
        lines.forEach((line: string) => {
            if (line.includes('AGENT_STATUS_UPDATE:')) {
                try {
                    const json = JSON.parse(line.split('AGENT_STATUS_UPDATE:')[1]);
                    db.crypto = { ...db.crypto, ...json, last_updated: new Date().toISOString() };
                    saveDb();
                } catch {}
            }
            if (line.trim()) console.log(`[BitcoinBob] ${line.trim()}`);
        });
    });

    bitcoinBobProcess.stderr?.on('data', (data: Buffer) => {
        console.error(`[BitcoinBob ERR] ${data.toString().trim()}`);
    });

    bitcoinBobProcess.on('close', (code: number) => {
        console.log(`⚠️ Bitcoin Bob exited with code ${code}`);
        if (!pausedAgents.has('crypto')) {
            setTimeout(startBitcoinBob, 30000);
        }
    });
}

// startBitcoinBob() — called from the delayed launch block below

// --- Pivot Pete Python Process ---
let pivotPeteProcess: any = null;
function startPivotPete() {
    console.log('🚀 Starting Pivot Pete (Python Engine)...');
    pivotPeteProcess = spawn('python', ['scripts/run_pivot_pete.py'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe']
    });

    pivotPeteProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        const lines = output.split('\n');

        lines.forEach(line => {
            if (line.startsWith('AGENT_STATUS_UPDATE:')) {
                try {
                    const jsonStr = line.replace('AGENT_STATUS_UPDATE:', '');
                    const json = JSON.parse(jsonStr);
                    if (json.last_updated) {
                        db.futures = json as AgentState;
                        saveDb();
                    }
                } catch (e) {
                    console.error('❌ [Pivot Pete JSON Error]', e);
                }
            } else if (line) {
                // Regular log - send to terminal
                console.log(`[PIVOT PETE] ${line}`);
            }
        });
    });


    pivotPeteProcess.stderr.on('data', (data: Buffer) => {
        console.error('❌ [Pivot Pete Error]', data.toString());
    });

    pivotPeteProcess.on('close', (code: number) => {
        console.log(`⚠️ Pivot Pete process exited with code ${code}`);
        // Restart after 30 seconds, but only if not paused
        if (!pausedAgents.has('futures') && !pausedAgents.has('pivot_pete')) {
            setTimeout(startPivotPete, 30000);
        } else {
            console.log(`⏸️ Pivot Pete auto-restart suppressed (PAUSED)`);
        }
    });
}

// startPivotPete() — called from the delayed launch block below

let bobaProcess: any = null;
function startBoba() {
    console.log('🚀 Starting Boba (Python Engine)...');
    bobaProcess = spawn('python', ['scripts/run_boba.py'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe']
    });

    bobaProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        const lines = output.split('\n');

        lines.forEach(line => {
            if (line.startsWith('AGENT_STATUS_UPDATE:')) {
                try {
                    const jsonStr = line.replace('AGENT_STATUS_UPDATE:', '');
                    const json = JSON.parse(jsonStr);
                    if (json.last_updated) {
                        db.boba = json as AgentState;
                        saveDb();
                    }
                } catch (e) {
                    console.error('❌ [Boba JSON Error]', e);
                }
            } else if (line) {
                // Regular log - send to terminal
                console.log(`[BOBA] ${line}`);
            }
        });
    });


    bobaProcess.stderr.on('data', (data: Buffer) => {
        console.error('❌ [Boba Error]', data.toString());
    });

    bobaProcess.on('close', (code: number) => {
        console.log(`⚠️ Boba process exited with code ${code}`);
        if (!pausedAgents.has('boba')) {
            setTimeout(startBoba, 30000);
        } else {
            console.log(`⏸️ Boba auto-restart suppressed (PAUSED)`);
        }
    });
}

// startBoba() — called from the delayed launch block below

// Start SPX Sniper
let spxProcess: any = null;
function startSPX() {
    console.log('🚀 Starting SPX Sniper (Python Engine)...');
    spxProcess = spawn('python', ['scripts/run_spx_sniper.py'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe']
    });

    spxProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        const lines = output.split('\n');

        lines.forEach(line => {
            if (line.startsWith('AGENT_STATUS_UPDATE:')) {
                try {
                    const jsonStr = line.replace('AGENT_STATUS_UPDATE:', '');
                    const json = JSON.parse(jsonStr);
                    if (json.last_updated) {
                        db.spx = json as AgentState;
                        saveDb();
                    }
                } catch (e) {
                    console.error('❌ [SPX JSON Error]', e);
                }
            } else if (line) {
                // Regular log - send to terminal
                console.log(`[SPX SNIPER] ${line}`);
            }
        });
    });

    spxProcess.stderr.on('data', (data: Buffer) => {
        console.error('❌ [SPX Error]', data.toString());
    });

    spxProcess.on('close', (code: number) => {
        console.log(`⚠️ SPX Sniper process exited with code ${code}`);
        if (!pausedAgents.has('spx')) {
            setTimeout(startSPX, 30000);
        } else {
            console.log(`⏸️ SPX Sniper auto-restart suppressed (PAUSED)`);
        }
    });
}

// startSPX() — called from the delayed launch block below

// Start ORB Runner (TypeScript Engine)
let orbProcess: any = null;
function startORB() {
    console.log('🚀 Starting ORB Runner (TypeScript Engine)...');
    orbProcess = spawn('npx', ['tsx', 'scripts/run_orb_agent.ts'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,  // Security fix: disable shell to prevent command injection
    });

    orbProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        const lines = output.split('\n');

        lines.forEach(line => {
            if (line.startsWith('AGENT_STATUS_UPDATE:')) {
                try {
                    const jsonStr = line.replace('AGENT_STATUS_UPDATE:', '');
                    const json = JSON.parse(jsonStr);
                    db.orb = {
                        ...db.orb,
                        last_updated: json.generated_at || new Date().toISOString(),
                        status: 'ACTIVE',
                        active_pairs: 1,
                        total_zones_found: json.signal_count || 0,
                        performance: db.orb.performance,
                        pending_orders: db.orb.pending_orders,
                        active_trades: db.orb.active_trades,
                        closed_trades: db.orb.closed_trades,
                        meta: db.orb.meta,
                    };
                    saveDb();
                } catch (e) {
                    console.error('❌ [ORB JSON Error]', e);
                }
            } else if (line) {
                console.log(`[ORB] ${line}`);
            }
        });
    });

    orbProcess.stderr.on('data', (data: Buffer) => {
        console.error('❌ [ORB Error]', data.toString());
    });

    orbProcess.on('close', (code: number) => {
        console.log(`⚠️ ORB process exited with code ${code}`);
        if (!pausedAgents.has('orb')) {
            setTimeout(startORB, 30000);
        } else {
            console.log(`⏸️ ORB Runner auto-restart suppressed (PAUSED)`);
        }
    });
}

// startORB() — called from the delayed launch block below

// ═══════════════════════════════════════════════════════════════════════════
// DELAYED AGENT LAUNCH — wait for Next.js dashboard to be ready
// All agents call /api/intel/preflight on their first scan. If they fire
// before Next.js is accepting requests, the preflight returns a connection
// error and the fallback (GO with 0.75x size) is used instead of real intel.
// 12 seconds gives supervisord/PM2 time to start the dashboard process first.
// ═══════════════════════════════════════════════════════════════════════════
const AGENT_STARTUP_DELAY_MS = parseInt(process.env.AGENT_STARTUP_DELAY_MS || '12000', 10);

console.log(`⏳ [RUNNER] Dashboard warm-up: agents launch in ${AGENT_STARTUP_DELAY_MS / 1000}s...`);

setTimeout(() => {
    console.log('🚀 [RUNNER] Launching all trading agents...');
    startSterling();
    startBitcoinBob();
    startPivotPete();
    startBoba();
    startSPX();
    startORB();
    console.log('✅ [RUNNER] All 6 agents launched.');
}, AGENT_STARTUP_DELAY_MS);

// 4. Load existing active trades from DB (if any)
// No longer using in-memory array - all trades persisted in DB

// 4. Live Loop
market.on('price', (tick: PriceUpdate) => {
    // Update last tick timestamp for watchdog
    lastTickTime = Date.now();

    // Feed price to Regime Detector for market state classification
    RegimeDetector.addPrice(tick.ticker, tick.price);

    // A. Update Strategy
    const signal = strategy.processTick(tick);

    // B. Handle New Signals
    if (signal && signal.type === 'ZONE_FOUND') {
        const agentId = (tick.ticker === 'BTCUSD' ? 'crypto' : 'fx') as keyof DbSchema;
        console.log(`💡 [${agentId.toUpperCase()}] New Zone Found: ${tick.ticker} @ ${signal.price}`);

        // Add to Pending
        const newOrder = {
            created_at: new Date().toISOString(),
            type: signal.side === 'LONG' ? 'DEMAND' : 'SUPPLY',
            ticker: signal.ticker,
            entry: signal.price,
            stop_loss: signal.meta.stop,
            status: 'PENDING'
        };
        db[agentId].pending_orders.push(newOrder);
        db[agentId].total_zones_found++;
        saveDb();
    }

    if (signal && signal.type === 'ENTRY') {
        const agentId = (tick.ticker === 'BTCUSD' ? 'crypto' : 'fx') as keyof DbSchema;

        // --- OVERSEER RISK CHECK ---
        const proposedTrade: Trade = {
            ticker: signal.ticker,
            entry: signal.price || tick.price,
            stop: signal.meta.stop,
            side: signal.side,
            agentId,
        };

        const riskCheck = RiskEngine.canOpenTrade(agentId, proposedTrade);
        if (!riskCheck.allowed) {
            console.log(`🛡️ [RISK] Trade DENIED for ${agentId}: ${riskCheck.reason}`);
            return; // Do not open trade
        }

        // --- REGIME CHECK ---
        const regime = RegimeDetector.classifyRegime(signal.ticker);
        const strategyType = 'IMPULSE'; // Default - could be dynamic based on signal source
        if (regime !== 'UNKNOWN' && !RegimeDetector.shouldTradeInRegime(regime, strategyType)) {
            console.log(`📊 [REGIME] Trade SKIPPED: ${RegimeDetector.getRegimeDescription(regime)} - Not suitable for ${strategyType}`);
            return; // Skip trade in unfavorable regime
        }
        console.log(`📊 [REGIME] ${RegimeDetector.getRegimeDescription(regime)} - Proceeding...`);

        // Apply slippage to entry price
        const slippedEntry = FrictionSimulator.applySlippage(
            signal.price || tick.price,
            signal.side,
            signal.ticker
        );

        console.log(`⚡ [${agentId.toUpperCase()}] ORDER FILLED: ${tick.ticker} @ ${slippedEntry.toFixed(5)} (slipped from ${signal.price})`);

        // Move from Pending to Active
        db[agentId].pending_orders = db[agentId].pending_orders.filter(o => o.ticker !== signal.ticker);

        // Snapshot intel state at moment of entry so TheProfessor can grade alignment later
        let intelSnapshot = null;
        try {
            intelSnapshot = intelBus.score(signal.ticker, signal.side);
        } catch (e) {
            console.warn(`⚠️ [INTEL] Could not capture snapshot for ${signal.ticker}:`, e);
        }

        // Add to persistent active_trades in DB
        db[agentId].active_trades.push({
            ticker: signal.ticker,
            entry: slippedEntry,
            idealEntry: signal.price, // Track for friction logging
            stop: signal.meta.stop,
            side: signal.side,
            agentId,
            startTime: Date.now(),
            entry_time: new Date().toISOString(),
            intel_snapshot: intelSnapshot  // 📸 Locked in at entry for Professor grading
        });
        saveDb();
    }

    // C. Monitor Active Trades (TP/SL) - Iterate through all agents
    ['fx', 'crypto'].forEach((agentKey) => {
        const agentId = agentKey as keyof DbSchema;
        const agent = db[agentId];

        agent.active_trades = agent.active_trades.filter(trade => {
            const currentPrice = tick.price;
            let pnl = 0;
            let close = false;
            let status = '';

            if (trade.ticker !== tick.ticker) return true; // Keep checking other symbols

            // 1. STOP LOSS CHECK
            if ((trade.side === 'LONG' && currentPrice <= trade.stop) ||
                (trade.side === 'SHORT' && currentPrice >= trade.stop)) {
                close = true;
                status = 'LOSS';
                pnl = -1 * Math.abs(trade.entry - trade.stop) * (trade.ticker === 'BTCUSD' ? 1 : 100000); // Rough PnL calc
            }

            // 2. TAKE PROFIT CHECK (2R Target)
            const risk = Math.abs(trade.entry - trade.stop);
            const target = trade.side === 'LONG' ? trade.entry + (risk * 2) : trade.entry - (risk * 2);

            if ((trade.side === 'LONG' && currentPrice >= target) ||
                (trade.side === 'SHORT' && currentPrice <= target)) {
                close = true;
                status = 'WIN';
                pnl = Math.abs(trade.entry - target) * (trade.ticker === 'BTCUSD' ? 1 : 100000);
            }

            if (close) {
                // Apply friction to get NET PnL
                const lotSize = 0.1; // Mini lot for paper trading
                const grossPnL = pnl;
                const netPnL = FrictionSimulator.calculateNetPnL(grossPnL, lotSize, trade.ticker);
                const frictionCost = grossPnL - netPnL;

                console.log(`💰 [${agentId.toUpperCase()}] Trade Closed: ${status}`);
                console.log(`   Gross: $${grossPnL.toFixed(2)} | Friction: -$${frictionCost.toFixed(2)} | Net: $${netPnL.toFixed(2)}`);

                // Add directly to closed trades (with friction data)
                const closedTrade = {
                    closed_at: new Date().toISOString(),
                    type: trade.side === 'LONG' ? 'DEMAND' : 'SUPPLY',
                    ticker: trade.ticker,
                    entry: trade.entry,
                    idealEntry: trade.idealEntry || trade.entry,
                    exit: currentPrice,
                    grossPnL: grossPnL,
                    netPnL: netPnL,
                    frictionCost: frictionCost,
                    pnl: netPnL, // Use NET PnL for stats
                    status: status
                };
                agent.closed_trades.unshift(closedTrade);

                // Update Performance (using NET PnL)
                const stats = agent.performance;
                stats.trades++;
                stats.total_pnl += netPnL;
                const wins = agent.closed_trades.filter((t: any) => t.status === 'WIN').length;
                stats.win_rate = Math.round((wins / stats.trades) * 100);

                // --- LOG TO REALITY CHECK ---
                appendToRealityCheck(
                    agentId,
                    trade.ticker,
                    grossPnL,
                    netPnL,
                    status === 'WIN' ? 'TP Hit' : 'SL Hit'
                );

                // Invoke The Professor (with full intel + timing context)
                const review = TheProfessor.gradeTrade(agent.meta.name, {
                    ticker: trade.ticker,
                    entry: trade.entry,
                    exit: currentPrice,
                    stop_loss: trade.stop,
                    type: trade.side === 'LONG' ? 'DEMAND' : 'SUPPLY',
                    pnl: pnl,
                    duration_minutes: (Date.now() - trade.startTime) / 60000,
                    entry_time: trade.entry_time,           // For econ event window lookup
                    intel_snapshot: trade.intel_snapshot    // 📸 Entry snapshot for alignment grading
                });

                if (db.professor.reviews) {
                    db.professor.reviews.unshift(review);
                    console.log(`🎓 [PROFESSOR] Graded ${agentId}: ${review.grade}`);

                    // Invoke The Auditor (Fact Check)
                    const audit = TheAuditor.auditReview(review);
                    if (!db.professor.audits) db.professor.audits = [];
                    db.professor.audits.unshift(audit);
                    console.log(`⚖️ [AUDITOR] Verdict: ${audit.verdict} (${audit.evidence})`);
                }

                saveDb();
                return false; // Remove from active
            }
            return true;
        });
    });

    // Heartbeat update occasionally
    if (Math.random() > 0.995) {
        db.fx.last_updated = new Date().toISOString();
        db.crypto.last_updated = new Date().toISOString();
        db.professor.last_updated = new Date().toISOString();
        saveDb();
    }
});

function saveDb() {
    // Security fix: Use atomic file write (write to temp, then rename)
    // This prevents data corruption if process crashes during write
    const tempPath = DB_PATH + '.tmp';
    try {
        fs.writeFileSync(tempPath, JSON.stringify(db, null, 2));
        fs.renameSync(tempPath, DB_PATH);
    } catch (err) {
        console.error('[Agent Runner] Failed to save db:', err);
        // Clean up temp file if rename failed
        try { fs.unlinkSync(tempPath); } catch {}
    }
}

// --- Unified Audit Loop (The Watcher) ---
// Ensures ALL trades across ALL agents get graded, even Python agents
function runAuditSync() {
    const allAgents: (keyof DbSchema)[] = ['fx', 'crypto', 'futures', 'boba', 'spx', 'orb'];

    allAgents.forEach(agentKey => {
        const agent = db[agentKey];
        if (!agent || !agent.closed_trades) return;

        // Check each closed trade
        agent.closed_trades.forEach((trade: any) => {
            // Skip if already reviewed (check if a review exists for this trade)
            const existingReview = db.professor.reviews?.find(r =>
                r.target_agent === agent.meta.name &&
                r.timestamp === trade.closed_at
            );

            if (existingReview) return; // Already graded

            // Trade needs grading!
            console.log(`🔍 [WATCHER] Found ungraded trade from ${agent.meta.name} - Grading now...`);

            const review = TheProfessor.gradeTrade(agent.meta.name, {
                ticker: trade.ticker,
                entry: trade.entry,
                exit: trade.exit,
                stop_loss: trade.stop_loss || trade.entry * 0.99, // Fallback if no stop
                type: trade.type || (trade.side === 'LONG' ? 'DEMAND' : 'SUPPLY'),
                pnl: trade.pnl || 0,
                duration_minutes: trade.duration_minutes || 15 // Fallback
            });

            if (!db.professor.reviews) db.professor.reviews = [];
            db.professor.reviews.unshift(review);
            console.log(`🎓 [PROFESSOR] Graded ${agentKey}: ${review.grade}`);

            // Invoke The Auditor
            const audit = TheAuditor.auditReview(review);
            if (!db.professor.audits) db.professor.audits = [];
            db.professor.audits.unshift(audit);
            console.log(`⚖️ [AUDITOR] Verdict: ${audit.verdict}`);

            saveDb();
        });
    });
}

// Run Watcher every 30 seconds
setInterval(runAuditSync, 30000);
console.log('👁️ [WATCHER] Audit Sync Loop Started (30s interval)');

// --- HEALTH WATCHDOG ---
// Monitors agent freshness and market connectivity
function runHealthWatchdog() {
    const now = Date.now();
    const allAgents: (keyof DbSchema)[] = ['fx', 'crypto', 'futures', 'boba', 'spx', 'orb'];
    let staleCount = 0;

    // Check each agent's last update timestamp
    allAgents.forEach(agentKey => {
        const agent = db[agentKey];
        if (!agent) return;

        const lastUpdate = new Date(agent.last_updated).getTime();
        const timeSinceUpdate = (now - lastUpdate) / 1000 / 60; // minutes

        if (timeSinceUpdate > 10) {
            staleCount++;
            console.log(`⚠️ [WATCHDOG] Agent ${agent.meta.name} is STALE (last update: ${timeSinceUpdate.toFixed(1)}m ago)`);
            agent.status = 'STALE';
            saveDb();
        }
    });

    // Check market WebSocket connectivity via lastTickTime
    const timeSinceLastTick = (now - lastTickTime) / 1000 / 60; // minutes
    if (timeSinceLastTick > 5) {
        console.log(`⚠️ [WATCHDOG] Market WebSocket appears disconnected (no ticks for ${timeSinceLastTick.toFixed(1)}m)`);
    }

    // Log summary
    const activeCount = allAgents.filter(k => db[k].status === 'ACTIVE').length;
    console.log(`📊 [WATCHDOG] System Health: ${activeCount}/${allAgents.length} agents active | Market tick age: ${timeSinceLastTick.toFixed(1)}m | Stale agents: ${staleCount}`);
}

setInterval(runHealthWatchdog, 60000);
console.log('⏥ [WATCHDOG] Health Watchdog Started (60s interval)');

// --- LOG ROTATION ---
// Keeps agent_logs.json from growing unbounded.
// Retains the most recent LOG_MAX_ENTRIES entries; older entries are dropped.
const LOG_MAX_ENTRIES = 500;

function rotateAgentLogs() {
    const logsPath = path.join(DATA_DIR, 'agent_logs.json');
    if (!fs.existsSync(logsPath)) return;
    try {
        const raw = fs.readFileSync(logsPath, 'utf8');
        const logs: any[] = JSON.parse(raw);
        if (logs.length > LOG_MAX_ENTRIES) {
            const trimmed = logs.slice(-LOG_MAX_ENTRIES);
            fs.writeFileSync(logsPath, JSON.stringify(trimmed, null, 2));
            console.log(`🔄 [LOGS] Rotated agent_logs.json: trimmed from ${logs.length} to ${trimmed.length} entries`);
        }
    } catch (e) {
        // Non-fatal: log file may be empty or mid-write from a Python agent
    }
}

// Run rotation every 10 minutes
setInterval(rotateAgentLogs, 10 * 60 * 1000);
console.log('🔄 [LOGS] Log Rotation Started (10m interval, max 500 entries)');

// --- CONTROL COMMAND POLLER ---
// Reads and processes control commands from data/control_commands.json
function pollControlCommands() {
    // Use the same DATA_DIR as the top-level constant (line 107)
    const commandsPath = path.join(DATA_DIR, 'control_commands.json');

    // Skip if file doesn't exist
    if (!fs.existsSync(commandsPath)) {
        return;
    }

    try {
        const raw = JSON.parse(fs.readFileSync(commandsPath, 'utf8'));
        // Support both { commands: [...] } and flat [...] formats
        let commands: any[] = Array.isArray(raw) ? raw : (raw.commands || []);
        const isWrapped = !Array.isArray(raw) && raw.commands;

        let updated = false;

        commands.forEach((cmd: any, idx: number) => {
            if (cmd.status !== 'pending') return;

            const agentId = (cmd.agentId || cmd.agent || '').toLowerCase();
            const action = (cmd.command || '').toLowerCase();
            let handled = false;

            console.log(`⚙️ [CONTROL] Processing: ${action} for agent ${agentId}`);

            switch (action) {
                case 'pause':
                    pausedAgents.add(agentId);
                    if (agentId === 'futures' || agentId === 'pivot_pete') {
                        if (pivotPeteProcess) pivotPeteProcess.kill();
                        db.futures.status = 'PAUSED';
                    } else if (agentId === 'boba') {
                        if (bobaProcess) bobaProcess.kill();
                        db.boba.status = 'PAUSED';
                    } else if (agentId === 'spx') {
                        if (spxProcess) spxProcess.kill();
                        db.spx.status = 'PAUSED';
                    } else if (agentId === 'orb') {
                        if (orbProcess) orbProcess.kill();
                        db.orb.status = 'PAUSED';
                    } else if (agentId === 'fx' || agentId === 'sterling') {
                        if (sterlingProcess) sterlingProcess.kill();
                        db.fx.status = 'PAUSED';
                    } else if (agentId === 'crypto' || agentId === 'bitcoin_bob') {
                        if (bitcoinBobProcess) bitcoinBobProcess.kill();
                        db.crypto.status = 'PAUSED';
                    }
                    console.log(`⏸️ [CONTROL] Agent ${agentId} PAUSED`);
                    handled = true;
                    break;

                case 'resume':
                    pausedAgents.delete(agentId);
                    if (agentId === 'futures' || agentId === 'pivot_pete') {
                        if (!pivotPeteProcess || pivotPeteProcess.killed) {
                            startPivotPete();
                        }
                        db.futures.status = 'ACTIVE';
                    } else if (agentId === 'boba') {
                        if (!bobaProcess || bobaProcess.killed) {
                            startBoba();
                        }
                        db.boba.status = 'ACTIVE';
                    } else if (agentId === 'spx') {
                        if (!spxProcess || spxProcess.killed) {
                            startSPX();
                        }
                        db.spx.status = 'ACTIVE';
                    } else if (agentId === 'orb') {
                        if (!orbProcess || orbProcess.killed) {
                            startORB();
                        }
                        db.orb.status = 'ACTIVE';
                    } else if (agentId === 'fx' || agentId === 'sterling') {
                        if (!sterlingProcess || sterlingProcess.killed) {
                            startSterling();
                        }
                        db.fx.status = 'ACTIVE';
                    } else if (agentId === 'crypto' || agentId === 'bitcoin_bob') {
                        if (!bitcoinBobProcess || bitcoinBobProcess.killed) {
                            startBitcoinBob();
                        }
                        db.crypto.status = 'ACTIVE';
                    }
                    console.log(`▶️ [CONTROL] Agent ${agentId} RESUMED`);
                    handled = true;
                    break;

                case 'restart':
                    pausedAgents.delete(agentId);
                    if (agentId === 'futures' || agentId === 'pivot_pete') {
                        if (pivotPeteProcess) pivotPeteProcess.kill();
                        setTimeout(startPivotPete, 1000);
                        db.futures.status = 'ACTIVE';
                    } else if (agentId === 'boba') {
                        if (bobaProcess) bobaProcess.kill();
                        setTimeout(startBoba, 1000);
                        db.boba.status = 'ACTIVE';
                    } else if (agentId === 'spx') {
                        if (spxProcess) spxProcess.kill();
                        setTimeout(startSPX, 1000);
                        db.spx.status = 'ACTIVE';
                    } else if (agentId === 'orb') {
                        if (orbProcess) orbProcess.kill();
                        setTimeout(startORB, 1000);
                        db.orb.status = 'ACTIVE';
                    } else if (agentId === 'fx' || agentId === 'sterling') {
                        if (sterlingProcess) sterlingProcess.kill();
                        setTimeout(startSterling, 1000);
                        db.fx.status = 'ACTIVE';
                    } else if (agentId === 'crypto' || agentId === 'bitcoin_bob') {
                        if (bitcoinBobProcess) bitcoinBobProcess.kill();
                        setTimeout(startBitcoinBob, 1000);
                        db.crypto.status = 'ACTIVE';
                    }
                    console.log(`🔄 [CONTROL] Agent ${agentId} RESTARTING`);
                    handled = true;
                    break;

                case 'killswitch':
                    {
                        const reason = cmd.reason || 'Manual killswitch activated';
                        KillSwitch.globalHalt(reason);
                        if (pivotPeteProcess) pivotPeteProcess.kill();
                        if (bobaProcess) bobaProcess.kill();
                        if (spxProcess) spxProcess.kill();
                        if (orbProcess) orbProcess.kill();
                        if (sterlingProcess) sterlingProcess.kill();
                        if (bitcoinBobProcess) bitcoinBobProcess.kill();
                        db.futures.status = 'HALTED';
                        db.boba.status = 'HALTED';
                        db.spx.status = 'HALTED';
                        db.orb.status = 'HALTED';
                        db.fx.status = 'HALTED';
                        db.crypto.status = 'HALTED';
                        pausedAgents.clear();
                        ['futures', 'boba', 'spx', 'orb', 'fx', 'crypto'].forEach(a => pausedAgents.add(a));
                        console.log(`🛑 [CONTROL] GLOBAL KILLSWITCH ACTIVATED: ${reason}`);
                        handled = true;
                    }
                    break;

                case 'killswitch_reset':
                    {
                        KillSwitch.resetGlobalHalt();
                        pausedAgents.clear();
                        // Restart all agents
                        if (!pivotPeteProcess || pivotPeteProcess.killed) startPivotPete();
                        if (!bobaProcess || bobaProcess.killed) startBoba();
                        if (!spxProcess || spxProcess.killed) startSPX();
                        if (!orbProcess || orbProcess.killed) startORB();
                        if (!sterlingProcess || sterlingProcess.killed) startSterling();
                        if (!bitcoinBobProcess || bitcoinBobProcess.killed) startBitcoinBob();
                        db.futures.status = 'ACTIVE';
                        db.boba.status = 'ACTIVE';
                        db.spx.status = 'ACTIVE';
                        db.orb.status = 'ACTIVE';
                        db.fx.status = 'ACTIVE';
                        db.crypto.status = 'ACTIVE';
                        console.log(`✅ [CONTROL] Global killswitch RESET - All agents resuming`);
                        handled = true;
                    }
                    break;
            }

            if (handled) {
                // Mark command as completed
                commands[idx].status = 'completed';
                commands[idx].completed_at = new Date().toISOString();
                updated = true;
            }
        });

        // Write updated commands file if anything was processed
        if (updated) {
            const output = isWrapped ? { commands } : commands;
            fs.writeFileSync(commandsPath, JSON.stringify(output, null, 2));
            saveDb();
        }
    } catch (e) {
        console.error(`❌ [CONTROL] Error reading/processing commands:`, e);
    }
}

setInterval(pollControlCommands, 5000);
console.log('⚙️ [CONTROL] Command Poller Started (5s interval)');

// Start
market.start();
console.log('waiting for ticks...');
