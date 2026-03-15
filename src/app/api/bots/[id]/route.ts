import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startAgent, stopAgent, pauseAgent, getAgentInfo } from '@/lib/agentManager';

/**
 * POST /api/bots/[id] - Control bot (start/stop/pause)
 * Spawns/stops Python agent processes based on action
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireUser();
        const { id } = await params;
        const body = await req.json();
        const { action } = body;

        if (!['start', 'stop', 'pause'].includes(action)) {
            return NextResponse.json(
                { error: 'Invalid action. Must be start, stop, or pause' },
                { status: 400 }
            );
        }

        // Verify ownership and get broker config
        const existingBot = await prisma.bot.findUnique({
            where: { id },
            include: { brokerConfig: true },
        });

        if (!existingBot || existingBot.userId !== user.id) {
            return NextResponse.json(
                { error: 'Bot not found' },
                { status: 404 }
            );
        }

        // Map action to status
        const statusMap = {
            start: 'RUNNING',
            stop: 'STOPPED',
            pause: 'PAUSED',
        } as const;

        const newStatus = statusMap[action as keyof typeof statusMap];

        // Execute agent control based on action
        let agentResult: { success: boolean; pid?: number; error?: string } = { success: true };

        if (action === 'start') {
            // Spawn agent process
            if (!existingBot.brokerConfigId) {
                return NextResponse.json(
                    { error: 'No broker connected to this bot' },
                    { status: 400 }
                );
            }
            agentResult = startAgent(id, existingBot.strategy, existingBot.brokerConfigId);
        } else if (action === 'stop') {
            // Kill agent process
            agentResult = stopAgent(id);
        } else if (action === 'pause') {
            // Signal agent to pause (checks DB status)
            agentResult = pauseAgent(id);
        }

        if (!agentResult.success) {
            return NextResponse.json(
                { error: agentResult.error || 'Agent control failed' },
                { status: 500 }
            );
        }

        // Update bot status in DB
        const updated = await prisma.bot.update({
            where: { id },
            data: { status: newStatus },
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                userId: user.id,
                action: `bot.${action}`,
                resourceType: 'Bot',
                resourceId: id,
                status: 'SUCCESS',
                metadata: {
                    name: updated.name,
                    newStatus,
                    pid: agentResult.pid,
                },
            },
        });

        return NextResponse.json({
            success: true,
            bot: {
                id: updated.id,
                status: updated.status,
            },
            agent: agentResult.pid ? { pid: agentResult.pid } : undefined,
        });
    } catch (error) {
        console.error('POST /api/bots/[id] error:', error);
        return NextResponse.json(
            { error: 'Failed to control bot' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/bots/[id] - Get single bot details
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireUser();
        const { id } = await params;

        const bot = await prisma.bot.findUnique({
            where: { id },
            include: {
                brokerConfig: {
                    select: {
                        id: true,
                        broker: true,
                        environment: true,
                        label: true,
                    },
                },
            },
        });

        if (!bot || bot.userId !== user.id) {
            return NextResponse.json(
                { error: 'Bot not found' },
                { status: 404 }
            );
        }

        // Get agent info if running
        const agentInfo = getAgentInfo(bot.id);

        return NextResponse.json({
            bot: {
                id: bot.id,
                name: bot.name,
                strategy: bot.strategy,
                strategyConfig: bot.strategyConfig,
                status: bot.status,
                maxPositionSize: bot.maxPositionSize.toNumber(),
                maxDailyLoss: bot.maxDailyLoss?.toNumber(),
                maxOpenPositions: bot.maxOpenPositions,
                totalTrades: bot.totalTrades,
                winningTrades: bot.winningTrades,
                losingTrades: bot.totalTrades - bot.winningTrades,
                totalPnl: bot.totalPnl.toNumber(),
                winRate: bot.totalTrades > 0
                    ? Math.round((bot.winningTrades / bot.totalTrades) * 100)
                    : 0,
                broker: bot.brokerConfig,
                agent: agentInfo,
                createdAt: bot.createdAt.toISOString(),
                updatedAt: bot.updatedAt.toISOString(),
            },
        });
    } catch (error) {
        console.error('GET /api/bots/[id] error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch bot' },
            { status: 500 }
        );
    }
}
