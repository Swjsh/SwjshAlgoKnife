// ═══════════════════════════════════════════════════════════════
// INTEL PREFLIGHT API — Go/No-Go decision for proposed trades
// POST /api/intel/preflight
//
// Called by agents BEFORE placing a trade. Returns:
//   - decision: GO | NO_GO | REDUCED
//   - sizeMultiplier: 0..1
//   - reasons: human-readable list of why
//   - regime: current market regime detection
//   - signals: active intel signals considered
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import intelBus from '@/lib/intel/bus';
import type { IntelScore } from '@/lib/intel/types';
import { detectRegime } from '@/lib/intel/regime';

export const dynamic = 'force-dynamic';

interface PreflightRequest {
    agentId: string;
    symbol: string;
    direction: 'LONG' | 'SHORT';
    strategy?: string;
    /** Optional: agent can pass entry price for context */
    entryPrice?: number;
    /** Optional: agent can pass stop loss for R:R context */
    stopLoss?: number;
}

interface PreflightResponse {
    decision: 'GO' | 'NO_GO' | 'REDUCED';
    sizeMultiplier: number;
    intelScore: number;
    regime: string;
    reasons: string[];
    signalCount: number;
    signals: Array<{
        source: string;
        direction: string;
        confidence: number;
        summary: string;
    }>;
    /** Recommended parameter adjustments for the strategy */
    adaptations: Record<string, any>;
    timestamp: string;
}


/**
 * Generate parameter adaptation suggestions based on regime and intel.
 */
function getAdaptations(regime: string, strategy?: string): Record<string, any> {
    const adaptations: Record<string, any> = { regime };

    switch (regime) {
        case 'TRENDING_BULL':
        case 'TRENDING_BEAR':
            adaptations.preferTrend = true;
            adaptations.tightenStops = false;
            adaptations.squeezeThresholdAdj = 0;        // No BB adjustment needed
            adaptations.vwapThresholdAdj = +0.3;         // Widen VWAP — don't fade trends
            adaptations.orbBias = regime === 'TRENDING_BULL' ? 'BULLISH' : 'BEARISH';
            adaptations.sensitivityAdj = -0.02;           // Looser S/R triggers in trends
            break;

        case 'HIGH_VOL':
            adaptations.preferTrend = false;
            adaptations.tightenStops = false;             // Wider stops in vol
            adaptations.squeezeThresholdAdj = +0.02;     // Raise squeeze threshold
            adaptations.vwapThresholdAdj = +0.5;          // Wider VWAP deviation needed
            adaptations.orbBias = 'NEUTRAL';
            adaptations.cooldownAdj = +5;                 // Extra cooldown minutes
            adaptations.sensitivityAdj = -0.03;           // Wider zones
            break;

        case 'RANGING':
            adaptations.preferTrend = false;
            adaptations.tightenStops = true;
            adaptations.squeezeThresholdAdj = -0.01;     // Tighter squeeze = more signals
            adaptations.vwapThresholdAdj = -0.2;          // Tighter VWAP = catch mean reversion
            adaptations.orbBias = 'NEUTRAL';
            adaptations.sensitivityAdj = +0.02;           // Tighter S/R zones
            break;

        case 'LOW_VOL':
            adaptations.preferTrend = false;
            adaptations.tightenStops = true;
            adaptations.squeezeThresholdAdj = -0.02;     // Lower BB threshold for quiet markets
            adaptations.vwapThresholdAdj = -0.3;          // Tighter
            adaptations.orbBias = 'NEUTRAL';
            adaptations.sensitivityAdj = +0.03;           // Tighter zones
            break;

        default:
            // UNKNOWN — no adjustments
            break;
    }

    return adaptations;
}

export async function POST(request: NextRequest) {
    const startMs = Date.now();

    try {
        const body: PreflightRequest = await request.json();

        if (!body.agentId || !body.symbol || !body.direction) {
            return NextResponse.json(
                { error: 'Missing required fields: agentId, symbol, direction' },
                { status: 400 },
            );
        }

        if (!['LONG', 'SHORT'].includes(body.direction)) {
            return NextResponse.json(
                { error: 'direction must be LONG or SHORT' },
                { status: 400 },
            );
        }

        // 1. Query intel bus for the symbol
        const activeSignals = intelBus.query(body.symbol);

        // 2. Compute intel score
        const intel: IntelScore = intelBus.score(body.symbol, body.direction);

        // 3. Detect market regime
        const regime = detectRegime(activeSignals);

        // 4. Map to decision
        let decision: 'GO' | 'NO_GO' | 'REDUCED';
        if (intel.sizeMultiplier === 0) {
            decision = 'NO_GO';
        } else if (intel.sizeMultiplier < 1.0) {
            decision = 'REDUCED';
        } else {
            decision = 'GO';
        }

        // 5. Build reasons list
        const reasons: string[] = [intel.reason];
        if (regime !== 'UNKNOWN') {
            reasons.push(`Market regime: ${regime}`);
        }
        if (activeSignals.length === 0) {
            reasons.push('No active intel signals — operating blind');
        }

        // 6. Get strategy-specific adaptations
        const adaptations = getAdaptations(regime, body.strategy);

        // 7. Log the preflight decision
        const latencyMs = Date.now() - startMs;
        try {
            db.prepare(`
                INSERT INTO intel_preflight_log
                (agent_id, symbol, direction, strategy, decision, intel_score, size_multiplier, reason, signals_snapshot, regime, latency_ms)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                body.agentId,
                body.symbol,
                body.direction,
                body.strategy || null,
                decision,
                intel.score,
                intel.sizeMultiplier,
                reasons.join(' | '),
                JSON.stringify(activeSignals.slice(0, 20)), // Cap snapshot size
                regime,
                latencyMs,
            );
        } catch (logErr) {
            console.error('[Preflight] Failed to log decision:', logErr);
        }

        // 8. Build response
        const response: PreflightResponse = {
            decision,
            sizeMultiplier: intel.sizeMultiplier,
            intelScore: intel.score,
            regime,
            reasons,
            signalCount: activeSignals.length,
            signals: activeSignals.slice(0, 10).map(s => ({
                source: s.source,
                direction: s.direction,
                confidence: s.confidence,
                summary: s.summary,
            })),
            adaptations,
            timestamp: new Date().toISOString(),
        };

        return NextResponse.json(response);

    } catch (error: any) {
        console.error('[API /intel/preflight] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * GET /api/intel/preflight?agentId=pivot_pete&limit=20
 * Returns recent preflight decisions for an agent.
 */
export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agentId');
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)), 100);

    try {
        const rows = agentId
            ? db.prepare(`
                SELECT * FROM intel_preflight_log
                WHERE agent_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            `).all(agentId, limit)
            : db.prepare(`
                SELECT * FROM intel_preflight_log
                ORDER BY timestamp DESC
                LIMIT ?
            `).all(limit);

        return NextResponse.json({ count: (rows as any[]).length, decisions: rows });
    } catch (error: any) {
        console.error('[API /intel/preflight GET] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
