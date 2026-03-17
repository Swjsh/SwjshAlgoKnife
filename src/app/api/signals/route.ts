import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, AuthError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const CreateSignalSchema = z.object({
    symbol: z.string().min(1).max(20),
    action: z.string().min(1).max(20), // BUY, SELL, EXIT, ALERT
    direction: z.enum(['LONG', 'SHORT']).optional(),
    strategy: z.string().max(100).optional(),
    price: z.number().positive().optional(),
    entryPrice: z.number().positive().optional(),
    stopLoss: z.number().positive().optional(),
    takeProfit: z.number().positive().optional(),
    confidence: z.number().min(0).max(1).optional(),
    source: z.string().max(50).optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
});

import { Prisma, SignalStatus } from '@prisma/client';

// Use Prisma's generated types for type safety
type SignalWhereInput = Prisma.SignalWhereInput;

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser();

        const { searchParams } = new URL(req.url);
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 500);
        const status = searchParams.get('status');
        const symbol = searchParams.get('symbol');

        // Build query with proper typing
        const where: SignalWhereInput = {};

        if (user) {
            where.userId = user.id;
        }

        if (status) {
            where.status = status.toUpperCase() as SignalStatus;
        }

        if (symbol) {
            where.symbol = { contains: symbol, mode: 'insensitive' };
        }

        const signals = await prisma.signal.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                bot: { select: { name: true } },
            },
        });

        return NextResponse.json(
            signals.map(s => ({
                ...s,
                price: s.price?.toNumber(),
                entryPrice: s.entryPrice?.toNumber(),
                stopLoss: s.stopLoss?.toNumber(),
                takeProfit: s.takeProfit?.toNumber(),
                confidence: s.confidence?.toNumber(),
            }))
        );

    } catch (error) {
        console.error('Signals API error:', error);
        return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
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

        // Rate limit & content-length validation: limit payload to 10KB
        const contentLength = req.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 10 * 1024) {
            return NextResponse.json(
                { error: 'Request payload too large (max 10KB)' },
                { status: 413 }
            );
        }

        const body = await req.json();
        const parseResult = CreateSignalSchema.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json({
                error: 'Validation failed',
                details: parseResult.error.flatten()
            }, { status: 400 });
        }

        const data = parseResult.data;

        const signal = await prisma.signal.create({
            data: {
                userId: user.id,
                symbol: data.symbol,
                action: data.action,
                direction: data.direction,
                strategy: data.strategy,
                price: data.price,
                entryPrice: data.entryPrice,
                stopLoss: data.stopLoss,
                takeProfit: data.takeProfit,
                confidence: data.confidence,
                source: data.source || 'manual',
                payload: (data.payload || {}) as object,
                status: 'PENDING',
                processed: false,
            },
        });

        return NextResponse.json({
            ...signal,
            price: signal.price?.toNumber(),
            entryPrice: signal.entryPrice?.toNumber(),
            stopLoss: signal.stopLoss?.toNumber(),
            takeProfit: signal.takeProfit?.toNumber(),
            confidence: signal.confidence?.toNumber(),
        }, { status: 201 });

    } catch (error) {
        console.error('Create signal error:', error);
        return NextResponse.json({ error: 'Failed to create signal' }, { status: 500 });
    }
}
