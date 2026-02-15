
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

const DB_PATH = path.join(process.cwd(), 'src', 'app', 'api', 'agents', 'agents_db.json');
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
        meta: { name: 'Swjsh FX', type: 'Forex' }
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

// 2. Initialize Components
const market = new MarketData();
const strategy = new StrategyLoop();

// 3. Spawn Pivot Pete Python Process
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
        // Restart after 30 seconds
        setTimeout(startPivotPete, 30000);
    });
}

// Start Python Engines
startPivotPete();

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
        setTimeout(startBoba, 30000);
    });
}

startBoba();

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
        setTimeout(startSPX, 30000);
    });
}

startSPX();

// Start ORB Runner (TypeScript Engine)
let orbProcess: any = null;
function startORB() {
    console.log('🚀 Starting ORB Runner (TypeScript Engine)...');
    orbProcess = spawn('npx', ['tsx', 'scripts/run_orb_agent.ts'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
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
        setTimeout(startORB, 30000);
    });
}

startORB();

// 4. Load existing active trades from DB (if any)
// No longer using in-memory array - all trades persisted in DB

// 4. Live Loop
market.on('price', (tick: PriceUpdate) => {
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

        // Add to persistent active_trades in DB
        db[agentId].active_trades.push({
            ticker: signal.ticker,
            entry: slippedEntry,
            idealEntry: signal.price, // Track for friction logging
            stop: signal.meta.stop,
            side: signal.side,
            agentId,
            startTime: Date.now()
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

                // Invoke The Professor
                const review = TheProfessor.gradeTrade(agent.meta.name, {
                    ticker: trade.ticker,
                    entry: trade.entry,
                    exit: currentPrice,
                    stop_loss: trade.stop,
                    type: trade.side === 'LONG' ? 'DEMAND' : 'SUPPLY',
                    pnl: pnl,
                    duration_minutes: (Date.now() - trade.startTime) / 60000
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
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// --- Unified Audit Loop (The Watcher) ---
// Ensures ALL trades across ALL agents get graded, even Python agents
function runAuditSync() {
    const allAgents: (keyof DbSchema)[] = ['fx', 'crypto', 'futures', 'boba', 'spx'];

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

// Start
market.start();
console.log('waiting for ticks...');
