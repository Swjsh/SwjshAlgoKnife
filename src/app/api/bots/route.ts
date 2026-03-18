import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const CreateBotSchema = z.object({
    name: z.string().min(1).max(100),
    strategy: z.string().max(100).optional(),
    strategyConfig: z.record(z.string(), z.any()).optional(),
    maxPositionSize: z.number().positive().optional(),
    maxDailyLoss: z.number().positive().optional(),
    maxOpenPositions: z.number().int().min(1).max(100).optional(),
    brokerConfigId: z.string().optional(),
});

const UpdateBotSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    strategy: z.string().max(100).optional(),
    strategyConfig: z.record(z.string(), z.any()).optional(),
    maxPositionSize: z.number().positive().optional(),
    maxDailyLoss: z.number().positive().optional(),
    maxOpenPositions: z.number().int().min(1).max(100).optional(),
    status: z.enum(['RUNNING', 'STOPPED', 'PAUSED']).optional(),
});

/**
 * GET /api/bots - List user's bots
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ bots: [] });
        }

        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');

        const where: any = { userId: user.id };
        if (status) {
            where.status = status.toUpperCase();
        }

        const bots = await prisma.bot.findMany({
            where,
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
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({
            bots: bots.map(b => ({
                id: b.id,
                name: b.name,
                strategy: b.strategy,
                strategyConfig: b.strategyConfig,
                status: b.status,
                maxPositionSize: b.maxPositionSize.toNumber(),
                maxDailyLoss: b.maxDailyLoss?.toNumber(),
                maxOpenPositions: b.maxOpenPositions,
                totalTrades: b.totalTrades,
                winningTrades: b.winningTrades,
                losingTrades: b.totalTrades - b.winningTrades,
                totalPnl: b.totalPnl.toNumber(),
                winRate: b.totalTrades > 0
                    ? Math.round((b.winningTrades / b.totalTrades) * 100)
                    : 0,
                broker: b.brokerConfig,
                createdAt: b.createdAt.toISOString(),
                updatedAt: b.updatedAt.toISOString(),
            })),
        });
    } catch (error) {
        console.error('GET /api/bots error:', error);
        return NextResponse.json({ error: 'Failed to fetch bots' }, { status: 500 });
    }
}

/**
 * POST /api/bots - Create new bot
 */
export async function POST(req: NextRequest) {
    try {
        const user = await requireUser();
        const body = await req.json();

        const parseResult = CreateBotSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json({
                error: 'Validation failed',
                details: parseResult.error.flatten()
            }, { status: 400 });
        }

        const data = parseResult.data;

        // Get or validate broker config
        let brokerConfigId = data.brokerConfigId;
        if (!brokerConfigId) {
            // Get user's primary broker
            const primaryBroker = await prisma.brokerConfig.findFirst({
                where: {
                    userId: user.id,
                    isActive: true,
                    connectionStatus: 'CONNECTED',
                },
                orderBy: { isPrimary: 'desc' },
            });

            if (!primaryBroker) {
                return NextResponse.json({
                    error: 'No broker connected. Please connect a broker first.',
                    code: 'NO_BROKER'
                }, { status: 400 });
            }

            brokerConfigId = primaryBroker.id;
        }

        const bot = await prisma.bot.create({
            data: {
                userId: user.id,
                brokerConfigId,
                name: data.name,
                strategy: data.strategy || 'Manual',
                strategyConfig: data.strategyConfig || {},
                maxPositionSize: data.maxPositionSize || 1000,
                maxDailyLoss: data.maxDailyLoss,
                maxOpenPositions: data.maxOpenPositions || 1,
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
            bot: {
                id: bot.id,
                name: bot.name,
                strategy: bot.strategy,
                status: bot.status,
                maxPositionSize: bot.maxPositionSize.toNumber(),
            },
        }, { status: 201 });
    } catch (error) {
        console.error('POST /api/bots error:', error);
        return NextResponse.json({ error: 'Failed to create bot' }, { status: 500 });
    }
}

/**
 * PUT /api/bots - Update bot
 */
export async function PUT(req: NextRequest) {
    try {
        const user = await requireUser();
        const body = await req.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Bot ID required' }, { status: 400 });
        }

        // Verify ownership
        const existingBot = await prisma.bot.findUnique({ where: { id } });
        if (!existingBot || existingBot.userId !== user.id) {
            return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
        }

        const parseResult = UpdateBotSchema.safeParse(updates);
        if (!parseResult.success) {
            return NextResponse.json({
                error: 'Validation failed',
                details: parseResult.error.flatten()
            }, { status: 400 });
        }

        const data = parseResult.data;

        const bot = await prisma.bot.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.strategy && { strategy: data.strategy }),
                ...(data.strategyConfig && { strategyConfig: data.strategyConfig }),
                ...(data.maxPositionSize && { maxPositionSize: data.maxPositionSize }),
                ...(data.maxDailyLoss !== undefined && { maxDailyLoss: data.maxDailyLoss }),
                ...(data.maxOpenPositions && { maxOpenPositions: data.maxOpenPositions }),
                ...(data.status && { status: data.status }),
            },
        });

        // Audit log for status changes
        if (data.status) {
            await prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: `bot.${data.status.toLowerCase()}`,
                    resourceType: 'Bot',
                    resourceId: bot.id,
                    status: 'SUCCESS',
                },
            });
        }

        return NextResponse.json({
            bot: {
                id: bot.id,
                name: bot.name,
                strategy: bot.strategy,
                status: bot.status,
                maxPositionSize: bot.maxPositionSize.toNumber(),
            },
        });
    } catch (error) {
        console.error('PUT /api/bots error:', error);
        return NextResponse.json({ error: 'Failed to update bot' }, { status: 500 });
    }
}

/**
 * DELETE /api/bots - Delete bot (with ID in body or query)
 */
export async function DELETE(req: NextRequest) {
    try {
        const user = await requireUser();

        const { searchParams } = new URL(req.url);
        let id = searchParams.get('id');

        if (!id) {
            try {
                const body = await req.json();
                id = body.id;
            } catch {
                // No body
            }
        }

        if (!id) {
            return NextResponse.json({ error: 'Bot ID required' }, { status: 400 });
        }

        // Verify ownership
        const existingBot = await prisma.bot.findUnique({ where: { id } });
        if (!existingBot || existingBot.userId !== user.id) {
            return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
        }

        await prisma.bot.delete({ where: { id } });

        // Audit log
        await prisma.auditLog.create({
            data: {
                userId: user.id,
                action: 'bot.delete',
                resourceType: 'Bot',
                resourceId: id,
                status: 'SUCCESS',
                metadata: { name: existingBot.name },
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/bots error:', error);
        return NextResponse.json({ error: 'Failed to delete bot' }, { status: 500 });
    }
}
