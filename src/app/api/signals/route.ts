import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
    try {
        // Get latest 10 signals
        const stmt = db.prepare('SELECT * FROM signals ORDER BY timestamp DESC LIMIT 10');
        const signals = stmt.all();
        return NextResponse.json(signals);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
    }
}
