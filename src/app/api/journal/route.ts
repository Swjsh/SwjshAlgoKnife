import { NextResponse } from 'next/server';
import { z } from 'zod';
import db, { initDB } from '@/lib/db';

// Ensure DB is ready
try {
    initDB();
} catch (e) {
    if (process.env.NODE_ENV === 'development') {
        console.error("Failed to init DB:", e);
    }
}

// Input validation schema for trade creation
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

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 500);
        const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

        const stmt = db.prepare('SELECT * FROM trades ORDER BY entry_date DESC LIMIT @limit OFFSET @offset');
        const trades = stmt.all({ limit, offset });
        return NextResponse.json(trades);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Validate input with Zod
        const parseResult = CreateTradeSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json({
                error: 'Validation failed',
                details: parseResult.error.flatten()
            }, { status: 400 });
        }

        const validated = parseResult.data;

        const stmt = db.prepare(`
      INSERT INTO trades (symbol, direction, entry_price, size, strategy, status, entry_date, notes)
      VALUES (@symbol, @direction, @entry_price, @size, @strategy, 'OPEN', @entry_date, @notes)
    `);

        const result = stmt.run({
            symbol: validated.symbol,
            direction: validated.direction,
            entry_price: validated.entry_price,
            size: validated.size,
            strategy: validated.strategy || 'Manual',
            entry_date: validated.entry_date || new Date().toISOString(),
            notes: validated.notes || ''
        });

        return NextResponse.json({ id: result.lastInsertRowid, ...validated });
    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error(error);
        }
        return NextResponse.json({ error: 'Failed to create trade' }, { status: 500 });
    }
}
