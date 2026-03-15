import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, AuthError } from '@/lib/auth';
import { withCacheHeaders } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// Input validation schema for trade creation
const CreateTradeSchema = z.object({
    symbol: z.string().min(1).max(20),
    direction: z.enum(['LONG', 'SHORT']),
    entryPrice: z.union([z.string(), z.number()]).transform(val =>
        typeof val === 'string' ? parseFloat(val) : val
    ).refine(val => !isNaN(val) && val > 0, { message: "Entry price must be positive" }),
    quantity: z.union([z.string(), z.number()]).transform(val =>
        typeof val === 'string' ? parseFloat(val) : val
    ).refine(val => !isNaN(val) && val > 0, { message: "Quantity must be positive" }),
    strategy: z.string().max(100).optional(),
    entryTime: z.string().optional(),
    notes: z.string().max(1000).optional(),
    botId: z.string().optional(),
    brokerConfigId: z.string().optional(),
});

import { Prisma, TradeStatus } from '@prisma/client';

// Use Prisma's generated types for type safety
type TradeWhereInput = Prisma.TradeWhereInput;

// Types for trade update data using Prisma's update input
type TradeUpdateData = Prisma.TradeUncheckedUpdateInput;

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser();

        const { searchParams } = new URL(req.url);
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100'), 1), 500);
        const status = searchParams.get('status'); // OPEN, CLOSED, all
        const strategy = searchParams.get('strategy');

        // Build query conditions with Prisma types
        const where: TradeWhereInput = {};

        // Multi-tenant: filter by user if authenticated
        if (user) {
            where.userId = user.id;
        }

        if (status && status !== 'all') {
            where.status = status.toUpperCase() as TradeStatus;
        }
        if (strategy) {
            where.strategy = { contains: strategy, mode: 'insensitive' };
        }

        // Fetch trades with relations
        const tradesInclude = {
            bot: { select: { name: true, strategy: true } },
            brokerConfig: { select: { broker: true, environment: true } },
        } as const;

        const trades = await prisma.trade.findMany({
            where,
            orderBy: { entryTime: 'desc' },
            take: limit,
            include: tradesInclude,
        });

        // Aggregate stats (for authenticated users only)
        if (user) {
            // Use Prisma aggregates instead of loading all trades into memory
            const totalPnlResult = await prisma.trade.aggregate({
                where: { userId: user.id, status: 'CLOSED' },
                _sum: { realizedPnl: true },
                _count: true,
            });

            const closedTradesCount = await prisma.trade.count({
                where: { userId: user.id, status: 'CLOSED' },
            });

            const openTradesCount = await prisma.trade.count({
                where: { userId: user.id, status: 'OPEN' },
            });

            const winsCount = await prisma.trade.count({
                where: {
                    userId: user.id,
                    status: 'CLOSED',
                    realizedPnl: { gt: 0 },
                },
            });

            const lossesCount = await prisma.trade.count({
                where: {
                    userId: user.id,
                    status: 'CLOSED',
                    realizedPnl: { lt: 0 },
                },
            });

            const allTrades = await prisma.trade.count({
                where: { userId: user.id },
            });

            // Get closed trades for advanced stats
            const closedTrades = await prisma.trade.findMany({
                where: { userId: user.id, status: 'CLOSED' },
            });

            const totalPnl = totalPnlResult._sum.realizedPnl?.toNumber() || 0;
            const winRate = closedTradesCount > 0 ? (winsCount / closedTradesCount) * 100 : 0;

            const wins = closedTrades.filter(t => (t.realizedPnl?.toNumber() || 0) > 0);
            const losses = closedTrades.filter(t => (t.realizedPnl?.toNumber() || 0) < 0);

            const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.realizedPnl?.toNumber() || 0), 0) / wins.length : 0;
            const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.realizedPnl?.toNumber() || 0), 0) / losses.length) : 0;
            const expectancy = avgLoss > 0 ? ((winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss) : 0;
            const profitFactor = avgLoss > 0 && losses.length > 0
                ? Math.abs(wins.reduce((s, t) => s + (t.realizedPnl?.toNumber() || 0), 0)) / Math.abs(losses.reduce((s, t) => s + (t.realizedPnl?.toNumber() || 0), 0))
                : 0;

            // Per-Strategy Breakdown
            const strategyMap: Record<string, { wins: number; losses: number; pnl: number; trades: number }> = {};
            closedTrades.forEach((t) => {
                const strat = t.strategy || 'Unknown';
                if (!strategyMap[strat]) strategyMap[strat] = { wins: 0, losses: 0, pnl: 0, trades: 0 };
                strategyMap[strat].trades += 1;
                strategyMap[strat].pnl += t.realizedPnl?.toNumber() || 0;
                if ((t.realizedPnl?.toNumber() || 0) > 0) strategyMap[strat].wins += 1;
                if ((t.realizedPnl?.toNumber() || 0) < 0) strategyMap[strat].losses += 1;
            });

            const strategies = Object.entries(strategyMap).map(([name, s]) => ({
                name,
                trades: s.trades,
                wins: s.wins,
                losses: s.losses,
                winRate: s.trades > 0 ? Math.round((s.wins / s.trades) * 100) : 0,
                pnl: Math.round(s.pnl * 100) / 100,
            })).sort((a, b) => b.pnl - a.pnl);

            // Equity Curve (limit to last 200 closed trades)
            const sortedClosed = [...closedTrades].sort((a, b) =>
                new Date(a.exitTime || a.entryTime).getTime() - new Date(b.exitTime || b.entryTime).getTime()
            ).slice(-200);
            let runningPnl = 0;
            const equityCurve = sortedClosed.map((t) => {
                runningPnl += t.realizedPnl?.toNumber() || 0;
                return {
                    date: t.exitTime?.toISOString() || t.entryTime.toISOString(),
                    pnl: Math.round(runningPnl * 100) / 100,
                    symbol: t.symbol,
                    status: t.status,
                };
            });

            // Recent Signals
            const signals = await prisma.signal.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: 'desc' },
                take: 20,
            });

            const response = NextResponse.json({
                trades: trades.map(t => ({
                    id: t.id,
                    symbol: t.symbol,
                    direction: t.direction,
                    status: t.status,
                    strategy: t.strategy,
                    notes: t.notes,
                    entryPrice: t.entryPrice.toNumber(),
                    exitPrice: t.exitPrice?.toNumber(),
                    quantity: t.quantity.toNumber(),
                    realizedPnl: t.realizedPnl?.toNumber(),
                    fees: t.fees.toNumber(),
                    entryOrderId: t.entryOrderId,
                    exitOrderId: t.exitOrderId,
                    exitReason: t.exitReason,
                    entryTime: t.entryTime.toISOString(),
                    exitTime: t.exitTime?.toISOString(),
                    intelSnapshot: t.intelSnapshot,
                    bot: t.bot,
                    brokerConfig: t.brokerConfig,
                })),
                stats: {
                    total: allTrades,
                    open: openTradesCount,
                    closed: closedTradesCount,
                    wins: winsCount,
                    losses: lossesCount,
                    winRate: Math.round(winRate * 10) / 10,
                    totalPnl: Math.round(totalPnl * 100) / 100,
                    avgWin: Math.round(avgWin * 100) / 100,
                    avgLoss: Math.round(avgLoss * 100) / 100,
                    expectancy: Math.round(expectancy * 100) / 100,
                    profitFactor: Math.round(profitFactor * 100) / 100,
                },
                strategies,
                equityCurve,
                signals,
                generatedAt: new Date().toISOString(),
            });

            return withCacheHeaders(response, 30);
        }

        // For unauthenticated requests, return basic response
        const response = NextResponse.json({
            trades: trades.map(t => ({
                id: t.id,
                symbol: t.symbol,
                direction: t.direction,
                status: t.status,
                strategy: t.strategy,
                notes: t.notes,
                entryPrice: t.entryPrice.toNumber(),
                exitPrice: t.exitPrice?.toNumber(),
                quantity: t.quantity.toNumber(),
                realizedPnl: t.realizedPnl?.toNumber(),
                fees: t.fees.toNumber(),
                entryOrderId: t.entryOrderId,
                exitOrderId: t.exitOrderId,
                exitReason: t.exitReason,
                entryTime: t.entryTime.toISOString(),
                exitTime: t.exitTime?.toISOString(),
                intelSnapshot: t.intelSnapshot,
                bot: t.bot,
                brokerConfig: t.brokerConfig,
            })),
            stats: null,
            strategies: [],
            equityCurve: [],
            signals: [],
            generatedAt: new Date().toISOString(),
        });

        return withCacheHeaders(response, 30);

    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json(
                { error: error.message, code: error.code },
                { status: error.status }
            );
        }
        console.error('Trades API error:', error);
        return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
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
        const parseResult = CreateTradeSchema.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json({
                error: 'Validation failed',
                details: parseResult.error.flatten()
            }, { status: 400 });
        }

        const data = parseResult.data;

        const trade = await prisma.trade.create({
            data: {
                userId: user.id,
                symbol: data.symbol,
                direction: data.direction,
                entryPrice: data.entryPrice,
                quantity: data.quantity,
                entryTime: data.entryTime ? new Date(data.entryTime) : new Date(),
                strategy: data.strategy || 'Manual',
                notes: data.notes,
                status: 'OPEN',
                botId: data.botId,
                brokerConfigId: data.brokerConfigId,
            },
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                userId: user.id,
                action: 'trade.create',
                resourceType: 'Trade',
                resourceId: trade.id,
                status: 'SUCCESS',
                metadata: { symbol: data.symbol, direction: data.direction },
            },
        });

        return NextResponse.json({
            ...trade,
            entryPrice: trade.entryPrice.toNumber(),
            quantity: trade.quantity.toNumber(),
        });

    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json(
                { error: error.message, code: error.code },
                { status: error.status }
            );
        }
        console.error('Create trade error:', error);
        return NextResponse.json({ error: 'Failed to create trade' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Authentication required', code: 'AUTH_REQUIRED' },
                { status: 401 }
            );
        }

        const body = await req.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Trade ID required' }, { status: 400 });
        }

        // Verify ownership
        const existingTrade = await prisma.trade.findUnique({ where: { id } });
        if (!existingTrade || existingTrade.userId !== user.id) {
            return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
        }

        // Build update data
        const updateData: TradeUpdateData = {};
        if (updates.exitPrice !== undefined) updateData.exitPrice = updates.exitPrice;
        if (updates.exitTime !== undefined) updateData.exitTime = new Date(updates.exitTime);
        if (updates.status !== undefined) updateData.status = updates.status as TradeStatus;
        if (updates.notes !== undefined) updateData.notes = updates.notes;
        if (updates.exitReason !== undefined) updateData.exitReason = updates.exitReason;

        // Calculate realizedPnl server-side from entry/exit price and quantity if exitPrice is provided
        if (updates.exitPrice !== undefined) {
            const exitPrice = updates.exitPrice;
            const entryPrice = existingTrade.entryPrice.toNumber();
            const quantity = existingTrade.quantity.toNumber();
            const direction = existingTrade.direction;

            if (direction === 'LONG') {
                updateData.realizedPnl = (exitPrice - entryPrice) * quantity;
            } else {
                // SHORT direction
                updateData.realizedPnl = (entryPrice - exitPrice) * quantity;
            }
        }

        const trade = await prisma.trade.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({
            ...trade,
            entryPrice: trade.entryPrice.toNumber(),
            exitPrice: trade.exitPrice?.toNumber(),
            quantity: trade.quantity.toNumber(),
            realizedPnl: trade.realizedPnl?.toNumber(),
        });

    } catch (error) {
        console.error('Update trade error:', error);
        return NextResponse.json({ error: 'Failed to update trade' }, { status: 500 });
    }
}
