import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { AGENTS_DB_PATH } from '@/lib/dataPaths';
import { decryptSecret } from '@/lib/encryption';
import { withCacheHeaders } from '@/lib/api-utils';

// Load static metadata — strip UTF-8 BOM if present
const PERSONAS_PATH = path.join(process.cwd(), 'scripts', 'agent_personas.json');
let PERSONAS: Record<string, Record<string, unknown>> = {};
try {
    const data = await fs.readFile(PERSONAS_PATH, 'utf8');
    PERSONAS = JSON.parse(data.replace(/^\uFEFF/, ''));
} catch {
    console.warn('Could not load agent personas');
}

// Strategy to Agent mapping
const STRATEGY_AGENT_MAP: Record<string, string> = {
    'S&R Rejection': 'crypto',
    'BB Squeeze & Breakout': 'crypto',
    'ORB 15m': 'fx',
    'NeverStoppedOut ORB': 'fx',
    'Three Ducks': 'fx',
    'Grid Trading': 'futures'
};

// Type definitions
interface AgentState {
    id?: string;
    last_updated: string;
    status: string;
    active_pairs: number;
    total_zones_found: number;
    performance: {
        win_rate: number;
        total_pnl: number;
        trades: number;
    };
    pending_orders: Array<Record<string, unknown>>;
    closed_trades: Array<Record<string, unknown>>;
    meta?: {
        name: string;
        avatar?: string;
        profile_path?: string;
        type?: string;
        strategy?: string;
        isUserBot?: boolean;
    };
    broker?: string;
    broker_live?: boolean;
    live_signals?: Array<Record<string, unknown>>;
}

// Runtime broker status
async function getBrokerStatus(userId?: string) {
    // If user is authenticated, check their broker configs
    if (userId) {
        const brokerConfigs = await prisma.brokerConfig.findMany({
            where: { userId, isActive: true, connectionStatus: 'CONNECTED' },
        });

        const alpacaConfig = brokerConfigs.find(c => c.broker === 'ALPACA');
        // TODO: Add OANDA to BrokerType enum when OANDA broker integration is implemented
        // const oandaConfig = brokerConfigs.find(c => c.broker === 'OANDA');

        return {
            alpaca: !!alpacaConfig,
            alpacaEnvironment: alpacaConfig?.environment,
            oanda: false,
            discord: !!(process.env.DISCORD_CHIEF_WEBHOOK),
        };
    }

    // Fallback to env vars for backward compatibility
    return {
        alpaca: !!(process.env.APCA_API_KEY_ID && process.env.APCA_API_SECRET_KEY),
        oanda: !!(process.env.OANDA_API_TOKEN && process.env.OANDA_ACCOUNT_ID),
        discord: !!(process.env.DISCORD_CHIEF_WEBHOOK),
    };
}

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser();

        // 1. Fetch user's bots from database
        let userBots: Array<Record<string, unknown>> = [];
        if (user) {
            userBots = await prisma.bot.findMany({
                where: { userId: user.id },
                include: {
                    brokerConfig: { select: { broker: true, environment: true } },
                },
            });
        }

        // 2. Fetch user's trades from database
        const trades = user
            ? await prisma.trade.findMany({
                where: { userId: user.id },
                orderBy: { entryTime: 'desc' },
            })
            : [];

        const signals = user
            ? await prisma.signal.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: 'desc' },
                take: 50,
            })
            : [];

        // 3. Load legacy agent state from JSON (for backward compatibility)
        let agentsBase: Record<string, AgentState> = {};
        try {
            const data = await fs.readFile(AGENTS_DB_PATH, 'utf8');
            agentsBase = JSON.parse(data);
        } catch {
            // Ignore - file may not exist
        }

        // 4. Build processed agents
        const processedAgents: Record<string, AgentState> = { ...agentsBase };

        // Add database bots as agents
        userBots.forEach((bot: any) => {
            const botId = `bot_${bot.id}`;
            processedAgents[botId] = {
                id: bot.id,
                last_updated: bot.updatedAt.toISOString(),
                status: bot.status,
                active_pairs: 1,
                total_zones_found: 0,
                performance: {
                    win_rate: bot.winningTrades > 0 && bot.totalTrades > 0
                        ? Math.round((bot.winningTrades / bot.totalTrades) * 100)
                        : 0,
                    total_pnl: bot.totalPnl.toNumber(),
                    trades: bot.totalTrades,
                },
                pending_orders: [],
                closed_trades: [],
                meta: {
                    name: bot.name,
                    type: 'Custom',
                    strategy: bot.strategy,
                    isUserBot: true,
                },
                broker: bot.brokerConfig?.broker || 'Paper Only',
                broker_live: bot.brokerConfig?.environment === 'LIVE',
            };
        });

        // Ensure all personas have an entry (for backward compat display)
        Object.keys(PERSONAS).forEach(id => {
            const persona = PERSONAS[id];
            if (!processedAgents[id]) {
                processedAgents[id] = {
                    last_updated: new Date().toISOString(),
                    status: 'ACTIVE',
                    active_pairs: (persona.market as string) === 'Crypto' ? 1 : 0,
                    total_zones_found: 0,
                    performance: { win_rate: 0, total_pnl: 0, trades: 0 },
                    pending_orders: [],
                    closed_trades: []
                };
            }

            processedAgents[id].meta = {
                name: persona.name as string,
                avatar: persona.avatar as string | undefined,
                profile_path: persona.profile_path as string | undefined,
                type: persona.market as string | undefined
            };
        });

        // 5. Aggregate trades into agents
        trades.forEach((trade) => {
            // Try to match to a user bot first
            if (trade.botId) {
                const botId = `bot_${trade.botId}`;
                if (processedAgents[botId]) {
                    const agent = processedAgents[botId];
                    if (trade.status === 'OPEN') {
                        agent.pending_orders.push({
                            created_at: trade.entryTime.toISOString(),
                            type: trade.direction === 'LONG' ? 'DEMAND' : 'SUPPLY',
                            ticker: trade.symbol,
                            entry: trade.entryPrice.toNumber(),
                            status: 'ACTIVE'
                        });
                    } else {
                        agent.closed_trades.push({
                            closed_at: trade.exitTime?.toISOString(),
                            type: trade.direction === 'LONG' ? 'DEMAND' : 'SUPPLY',
                            ticker: trade.symbol,
                            entry: trade.entryPrice.toNumber(),
                            exit: trade.exitPrice?.toNumber(),
                            pnl: trade.realizedPnl?.toNumber(),
                            status: trade.status
                        });
                    }
                    return;
                }
            }

            // Fallback to strategy mapping
            const agentId = STRATEGY_AGENT_MAP[trade.strategy || ''] || 'fx';
            const agent = processedAgents[agentId];
            if (!agent) return;

            agent.performance.trades += 1;
            agent.performance.total_pnl += trade.realizedPnl?.toNumber() || 0;

            if ((trade.realizedPnl?.toNumber() || 0) > 0) {
                const wins = Math.round((agent.performance.win_rate / 100) * (agent.performance.trades - 1)) + 1;
                agent.performance.win_rate = Math.round((wins / agent.performance.trades) * 100);
            } else if ((trade.realizedPnl?.toNumber() || 0) < 0) {
                const wins = Math.round((agent.performance.win_rate / 100) * (agent.performance.trades - 1));
                agent.performance.win_rate = Math.round((wins / agent.performance.trades) * 100);
            }

            if (trade.status === 'OPEN') {
                agent.pending_orders.push({
                    created_at: trade.entryTime.toISOString(),
                    type: trade.direction === 'LONG' ? 'DEMAND' : 'SUPPLY',
                    ticker: trade.symbol,
                    entry: trade.entryPrice.toNumber(),
                    status: 'ACTIVE'
                });
            } else {
                agent.closed_trades.push({
                    closed_at: trade.exitTime?.toISOString(),
                    type: trade.direction === 'LONG' ? 'DEMAND' : 'SUPPLY',
                    ticker: trade.symbol,
                    entry: trade.entryPrice.toNumber(),
                    exit: trade.exitPrice?.toNumber(),
                    pnl: trade.realizedPnl?.toNumber(),
                    status: trade.status
                });
            }
        });

        // 6. Add signals
        Object.keys(processedAgents).forEach(id => {
            processedAgents[id].live_signals = signals.filter((s) => {
                if (STRATEGY_AGENT_MAP[s.strategy || ''] === id) return true;
                if (id === 'crypto' && (s.symbol.includes('BTC') || s.symbol.includes('ETH'))) return true;
                return false;
            }).map(s => ({
                ...s,
                price: s.price?.toNumber(),
                confidence: s.confidence?.toNumber(),
            }));
        });

        // 7. Broker status
        const brokers = await getBrokerStatus(user?.id);

        Object.keys(processedAgents).forEach(id => {
            const agent = processedAgents[id];

            // Skip if already set (user bots)
            if (agent.meta?.isUserBot) return;

            const marketType = (agent.meta?.type || '').toLowerCase();
            if (marketType === 'forex') {
                agent.broker = brokers.oanda ? 'OANDA Practice' : 'Paper Only';
                agent.broker_live = brokers.oanda;
            } else if (['crypto', 'equity'].includes(marketType)) {
                agent.broker = brokers.alpaca
                    ? `Alpaca ${brokers.alpacaEnvironment || 'Paper'}`
                    : 'Paper Only';
                agent.broker_live = brokers.alpaca;
            } else {
                agent.broker = 'Paper Only';
                agent.broker_live = false;
            }
        });

        const response = NextResponse.json({
            agents: processedAgents,
            system: {
                brokers,
                webhook_secret_set: !!process.env.WEBHOOK_SECRET,
                trading_mode: brokers.alpaca && brokers.alpacaEnvironment === 'LIVE' ? 'LIVE' : 'PAPER',
                last_checked: new Date().toISOString(),
                authenticated: !!user,
                userId: user?.id,
            }
        });

        return withCacheHeaders(response, 15);

    } catch (error) {
        console.error("Agents API Error:", error);
        return NextResponse.json({ error: "Failed to fetch agent data" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Authentication required', code: 'AUTH_REQUIRED' },
                { status: 401 }
            );
        }

        const body = await req.json();

        // Get user's primary broker config
        const brokerConfig = await prisma.brokerConfig.findFirst({
            where: {
                userId: user.id,
                isActive: true,
                connectionStatus: 'CONNECTED',
            },
            orderBy: { isPrimary: 'desc' },
        });

        if (!brokerConfig) {
            return NextResponse.json({
                error: 'No broker connected. Please connect a broker first.',
                code: 'NO_BROKER'
            }, { status: 400 });
        }

        // Create bot in database
        const bot = await prisma.bot.create({
            data: {
                userId: user.id,
                brokerConfigId: brokerConfig.id,
                name: body.name || `Bot ${Date.now()}`,
                strategy: body.strategy || 'Manual',
                strategyConfig: body.strategyConfig || {},
                maxPositionSize: body.capital || 1000,
                maxDailyLoss: body.maxDailyLoss,
                maxOpenPositions: body.maxOpenPositions || 1,
                status: 'STOPPED',
            },
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                userId: user.id,
                action: 'bot.create',
                resourceType: 'Bot',
                resourceId: bot.id,
                status: 'SUCCESS',
                metadata: { name: bot.name, strategy: bot.strategy },
            },
        });

        return NextResponse.json({
            success: true,
            botId: bot.id,
            bot: {
                id: bot.id,
                name: bot.name,
                strategy: bot.strategy,
                status: bot.status,
                maxPositionSize: bot.maxPositionSize.toNumber(),
            },
        });

    } catch (error) {
        console.error("Bot creation error:", error);
        return NextResponse.json({ error: "Failed to create bot" }, { status: 500 });
    }
}
