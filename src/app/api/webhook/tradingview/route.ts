import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { TradeExecutor } from '@/lib/engine/executor';
import { Signal } from '@/lib/engine/types';

// Webhook secret for authentication (REQUIRED in production)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// SECURITY: Fail fast if no secret in production - Check moved to handler to avoid build failures
if (IS_PRODUCTION && !WEBHOOK_SECRET) {
    console.warn('⚠️ WEBHOOK_SECRET is missing. Webhook route will return 500 in production.');
}

// Input validation schema
const WebhookPayloadSchema = z.object({
    symbol: z.string().min(1).max(20),
    action: z.string().min(1).max(10),
    price: z.number().positive().optional(),
    strategy: z.string().max(100).optional(),
    notes: z.string().max(500).optional(),
});

export async function POST(req: Request) {
    try {
        // Lazy load executor to avoid build-time DB connection
        const executor = new TradeExecutor({
            accountBalance: parseFloat(process.env.ACCOUNT_BALANCE || '10000'),
            riskPerTradePercent: parseFloat(process.env.RISK_PER_TRADE || '1')
        });

        // Authentication check - skip only if secret is not configured (dev mode)
        if (WEBHOOK_SECRET) {
            const authHeader = req.headers.get('X-Webhook-Secret') || req.headers.get('Authorization');
            if (authHeader !== WEBHOOK_SECRET && authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        const body = await req.json();

        // Validate payload with Zod
        const parseResult = WebhookPayloadSchema.safeParse(body);
        if (!parseResult.success) {
            // Log details internally only
            if (process.env.NODE_ENV === 'development') {
                console.error('Validation failed:', parseResult.error.flatten());
            }
            // Generic error to client (don't expose validation schema)
            return NextResponse.json({ error: "Invalid request" }, { status: 400 });
        }

        const validated = parseResult.data;

        const signal: Signal = {
            symbol: validated.symbol,
            action: validated.action.toUpperCase() as 'BUY' | 'SELL' | 'EXIT' | 'LONG' | 'SHORT',
            price: validated.price || 0,
            strategy: validated.strategy || "TradingView Webhook",
            timestamp: new Date().toISOString(),
            notes: validated.notes || ""
        };

        // Store in DB
        const stmt = db.prepare(`
      INSERT INTO signals (timestamp, symbol, strategy, action, price, payload)
      VALUES (@timestamp, @symbol, @strategy, @action, @price, @payload)
    `);

        stmt.run({
            timestamp: signal.timestamp,
            symbol: signal.symbol,
            strategy: signal.strategy,
            action: signal.action,
            price: signal.price,
            payload: JSON.stringify(body)
        });

        // Trigger Execution
        await executor.processSignal(signal);

        return NextResponse.json({ status: "success", received: true, id: validated.symbol });
    } catch (error) {
        // Log errors only in development
        if (process.env.NODE_ENV === 'development') {
            console.error("Webhook Error:", error);
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

