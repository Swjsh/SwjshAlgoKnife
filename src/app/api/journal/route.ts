import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, AuthError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Schema for journal entry
const CreateJournalEntrySchema = z.object({
    date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date" }),
    dailyPnl: z.number().optional().default(0),
    mood: z.enum(['great', 'good', 'neutral', 'bad', 'terrible']).optional(),
    notes: z.string().max(5000).optional(),
    tags: z.string().max(500).optional(), // Comma-separated
});

// Schema for legacy trade creation (backward compatibility)
const CreateTradeSchema = z.object({
    symbol: z.string().min(1).max(20),
    direction: z.enum(['LONG', 'SHORT']),
    entry_price: z.union([z.string(), z.number()]).transform(val =>
        typeof val === 'string' ? parseFloat(val) : val
    ).refine(val => !isNaN(val) && val > 0, { message: "Entry price must be positive" }),
    size: z.union([z.string(), z.number()]).transform(val =>
        typeof val === 'string' ? parseFloat(val) : val
    ).refine(val => !isNaN(val) && val > 0, { message: "Size must be positive" }),
    strategy: z.string().max(100).optional(),
    entry_date: z.string().optional(),
    notes: z.string().max(1000).optional(),
});

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser();

        const { searchParams } = new URL(req.url);
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 500);
        const type = searchParams.get('type'); // 'journal' or 'trades'

        if (type === 'journal') {
            // Return journal entries
            const where: any = {};
            if (user) {
                where.userId = user.id;
            }

            const entries = await prisma.journalEntry.findMany({
                where,
                orderBy: { date: 'desc' },
                take: limit,
            });

            return NextResponse.json(
                entries.map(e => ({
                    ...e,
                    dailyPnl: e.dailyPnl.toNumber(),
                    date: e.date.toISOString().split('T')[0],
                }))
            );
        }

        // Default: Return trades (for backward compatibility)
        const where: any = {};
        if (user) {
            where.userId = user.id;
        }

        const trades = await prisma.trade.findMany({
            where,
            orderBy: { entryTime: 'desc' },
            take: limit,
        });

        return NextResponse.json(
            trades.map(t => ({
                id: t.id,
                symbol: t.symbol,
                direction: t.direction,
                entry_price: t.entryPrice.toNumber(),
                exit_price: t.exitPrice?.toNumber(),
                size: t.quantity.toNumber(),
                strategy: t.strategy,
                status: t.status,
                pnl: t.realizedPnl?.toNumber(),
                notes: t.notes,
                entry_date: t.entryTime.toISOString(),
                exit_date: t.exitTime?.toISOString(),
            }))
        );

    } catch (error) {
        console.error('Journal API error:', error);
        return NextResponse.json({ error: 'Failed to fetch journal' }, { status: 500 });
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

        // Determine if this is a journal entry or a trade (legacy)
        if (body.date && (body.mood || body.dailyPnl !== undefined || body.notes)) {
            // Journal entry
            const parseResult = CreateJournalEntrySchema.safeParse(body);
            if (!parseResult.success) {
                return NextResponse.json({
                    error: 'Validation failed',
                    details: parseResult.error.flatten()
                }, { status: 400 });
            }

            const data = parseResult.data;

            // Upsert: create or update based on date
            const entry = await prisma.journalEntry.upsert({
                where: {
                    userId_date: {
                        userId: user.id,
                        date: new Date(data.date),
                    },
                },
                update: {
                    dailyPnl: data.dailyPnl,
                    mood: data.mood,
                    notes: data.notes,
                    tags: data.tags,
                },
                create: {
                    userId: user.id,
                    date: new Date(data.date),
                    dailyPnl: data.dailyPnl,
                    mood: data.mood,
                    notes: data.notes,
                    tags: data.tags,
                },
            });

            return NextResponse.json({
                ...entry,
                dailyPnl: entry.dailyPnl.toNumber(),
                date: entry.date.toISOString().split('T')[0],
            });
        }

        // Legacy trade creation
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
                entryPrice: data.entry_price,
                quantity: data.size,
                entryTime: data.entry_date ? new Date(data.entry_date) : new Date(),
                strategy: data.strategy || 'Manual',
                notes: data.notes,
                status: 'OPEN',
            },
        });

        // Return in legacy format
        return NextResponse.json({
            id: trade.id,
            symbol: trade.symbol,
            direction: trade.direction,
            entry_price: trade.entryPrice.toNumber(),
            size: trade.quantity.toNumber(),
            strategy: trade.strategy,
            status: trade.status,
            entry_date: trade.entryTime.toISOString(),
            notes: trade.notes,
        });

    } catch (error) {
        console.error('Journal POST error:', error);
        return NextResponse.json({ error: 'Failed to save journal entry' }, { status: 500 });
    }
}
