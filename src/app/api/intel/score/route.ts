// ═══════════════════════════════════════════════════════════════
// INTEL SCORE API — Per-symbol composite score endpoint
// GET /api/intel/score?symbol=BTCUSD&direction=LONG
// Returns weighted intel score + raw contributing signals.
// Used by IntelHUD and trade attribution.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import intelBus from '@/lib/intel/bus';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const symbol = url.searchParams.get('symbol');
    const direction = (url.searchParams.get('direction') || 'LONG').toUpperCase() as 'LONG' | 'SHORT';

    if (!symbol) {
        return NextResponse.json({ error: 'Missing required param: symbol' }, { status: 400 });
    }

    if (!['LONG', 'SHORT'].includes(direction)) {
        return NextResponse.json({ error: 'direction must be LONG or SHORT' }, { status: 400 });
    }

    const score = intelBus.score(symbol, direction);
    const signals = intelBus.query(symbol);

    return NextResponse.json({
        symbol,
        direction,
        score,
        signals,
        timestamp: new Date().toISOString(),
    });
}
