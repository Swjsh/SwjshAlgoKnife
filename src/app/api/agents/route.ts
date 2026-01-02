import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import db from '@/lib/db';

// Load static metadata
const PERSONAS_PATH = path.join(process.cwd(), 'scripts', 'agent_personas.json');
const PERSONAS = JSON.parse(fs.readFileSync(PERSONAS_PATH, 'utf8'));

export async function GET() {
    try {
        // 1. Fetch all trades from SQL
        const trades = db.prepare('SELECT * FROM trades').all();
        const signals = db.prepare('SELECT * FROM signals ORDER BY timestamp DESC LIMIT 50').all();

        // 2. Load the base agent state (status/active_pairs) from the JSON store
        // We use the JSON store for "user-toggled" state like status
        const DB_PATH = path.join(process.cwd(), 'src', 'app', 'api', 'agents', 'agents_db.json');
        let agentsBase = {};
        if (fs.existsSync(DB_PATH)) {
            agentsBase = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        }

        // 3. Map strategies to Agent IDs
        // Mapping: Strategy Name (from Engine) -> Agent ID (from PERSONAS)
        const stratMap: Record<string, string> = {
            'S&R Rejection': 'crypto',
            'BB Squeeze & Breakout': 'crypto',
            'ORB 15m': 'fx',
            'NeverStoppedOut ORB': 'fx',
            'Three Ducks': 'fx',
            'Grid Trading': 'futures'
        };

        // 4. Aggregate Performance from SQLite
        const processedAgents: any = { ...agentsBase };

        // Ensure all personas have an entry
        Object.keys(PERSONAS).forEach(id => {
            if (!processedAgents[id]) {
                processedAgents[id] = {
                    last_updated: new Date().toISOString(),
                    status: 'ACTIVE',
                    active_pairs: PERSONAS[id].market === 'Crypto' ? 1 : 0,
                    total_zones_found: 0,
                    performance: { win_rate: 0, total_pnl: 0, trades: 0 },
                    pending_orders: [],
                    closed_trades: []
                };
            }

            // Sync metadata
            processedAgents[id].meta = {
                name: PERSONAS[id].name,
                avatar: PERSONAS[id].avatar,
                profile_path: PERSONAS[id].profile_path,
                type: PERSONAS[id].market
            };
        });

        // Loop through trades to calculate stats
        trades.forEach((trade: any) => {
            const agentId = stratMap[trade.strategy] || 'fx'; // Default to fx if unknown
            const agent = processedAgents[agentId];
            if (!agent) return;

            agent.performance.trades += 1;
            agent.performance.total_pnl += trade.pnl || 0;

            if (trade.status === 'WIN') {
                const wins = Math.round((agent.performance.win_rate / 100) * (agent.performance.trades - 1)) + 1;
                agent.performance.win_rate = Math.round((wins / agent.performance.trades) * 100);
            } else if (trade.status === 'LOSS') {
                const wins = Math.round((agent.performance.win_rate / 100) * (agent.performance.trades - 1));
                agent.performance.win_rate = Math.round((wins / agent.performance.trades) * 100);
            }

            if (trade.status === 'OPEN') {
                agent.pending_orders.push({
                    created_at: trade.entry_date,
                    type: trade.direction === 'LONG' ? 'DEMAND' : 'SUPPLY',
                    ticker: trade.symbol,
                    entry: trade.entry_price,
                    status: 'ACTIVE'
                });
            } else {
                agent.closed_trades.push({
                    closed_at: trade.exit_date,
                    type: trade.direction === 'LONG' ? 'DEMAND' : 'SUPPLY',
                    ticker: trade.symbol,
                    entry: trade.entry_price,
                    exit: trade.exit_price,
                    pnl: trade.pnl,
                    status: trade.status
                });
            }
        });

        // Add raw signals for "Tactical Live Signals" table
        // We can inject these into the response for the frontend to consume
        Object.keys(processedAgents).forEach(id => {
            // Filter signals that might belong to this agent's strategy or market
            processedAgents[id].live_signals = signals.filter((s: any) => {
                if (stratMap[s.strategy] === id) return true;
                if (id === 'crypto' && (s.symbol.includes('BTC') || s.symbol.includes('ETH'))) return true;
                return false;
            });
        });

        return NextResponse.json(processedAgents);
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: "Failed to fetch dynamic agent data" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const DB_PATH = path.join(process.cwd(), 'src', 'app', 'api', 'agents', 'agents_db.json');

        let agents = {};
        if (fs.existsSync(DB_PATH)) {
            agents = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        }

        const agentId = body.id || `custom_${Date.now()}`;

        const newAgent = {
            last_updated: new Date().toISOString(),
            status: 'ACTIVE',
            active_pairs: 1,
            total_zones_found: 0,
            performance: {
                win_rate: 0,
                total_pnl: 0,
                trades: 0
            },
            pending_orders: [],
            active_trades: [],
            closed_trades: [],
            meta: {
                name: body.name,
                type: body.market,
                strategy: body.strategy,
                capital: body.capital,
                risk: body.risk
            }
        };

        // @ts-ignore
        agents[agentId] = newAgent;
        fs.writeFileSync(DB_PATH, JSON.stringify(agents, null, 2));

        return NextResponse.json({ success: true, agentId });
    } catch (error) {
        console.error("POST Error:", error);
        return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
    }
}

