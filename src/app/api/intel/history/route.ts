// ═══════════════════════════════════════════════════════════════
// INTEL HISTORY API — Sparkline data for per-symbol score history
// GET /api/intel/history?symbol=BTCUSD&hours=4
// Groups signals into 15-minute buckets and returns weighted net score.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { INTEL_WEIGHTS, type IntelSource } from '@/lib/intel/types';

export const dynamic = 'force-dynamic';

interface HistoryBucket {
    timestamp: string;
    score: number;     // Weighted net bullish/bearish score for this bucket
    signalCount: number;
    bullishCount: number;
    bearishCount: number;
}

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const symbol = url.searchParams.get('symbol');
    const hours = Math.min(Math.max(1, parseInt(url.searchParams.get('hours') || '4', 10)), 48);
    const bucketMinutes = 15; // 15-minute buckets

    if (!symbol) {
        return NextResponse.json({ error: 'Missing required param: symbol' }, { status: 400 });
    }

    try {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

        const rows = db.prepare(`
            SELECT timestamp, signal_type, confidence, source
            FROM intel_signals
            WHERE symbol = ? AND timestamp >= ?
            ORDER BY timestamp ASC
        `).all(symbol, since) as Array<{
            timestamp: string;
            signal_type: string;
            confidence: number;
            source: string;
        }>;

        // Build time buckets with weighted scoring
        const bucketMs = bucketMinutes * 60 * 1000;
        const buckets = new Map<number, {
            weightedScore: number;
            totalWeight: number;
            count: number;
            bullish: number;
            bearish: number;
        }>();

        for (const row of rows) {
            const ts = new Date(row.timestamp).getTime();
            const bucketKey = Math.floor(ts / bucketMs) * bucketMs;

            const existing = buckets.get(bucketKey) || {
                weightedScore: 0,
                totalWeight: 0,
                count: 0,
                bullish: 0,
                bearish: 0,
            };

            // Apply source weight to the score
            const sourceWeight = INTEL_WEIGHTS[row.source as IntelSource] || 0.05;

            if (row.signal_type === 'BULLISH') {
                existing.weightedScore += row.confidence * sourceWeight;
                existing.totalWeight += sourceWeight;
                existing.bullish++;
            } else if (row.signal_type === 'BEARISH') {
                existing.weightedScore -= row.confidence * sourceWeight;
                existing.totalWeight += sourceWeight;
                existing.bearish++;
            }
            // NEUTRAL / ALERT contribute 0 to score but still counted
            existing.count++;

            buckets.set(bucketKey, existing);
        }

        // Fill in empty buckets for the full time range
        const now = Date.now();
        const startMs = now - hours * 60 * 60 * 1000;
        const result: HistoryBucket[] = [];

        for (let t = Math.floor(startMs / bucketMs) * bucketMs; t <= now; t += bucketMs) {
            const data = buckets.get(t);
            // Normalize weighted score to -1..+1 range
            const normalizedScore = data && data.totalWeight > 0
                ? Math.max(-1, Math.min(1, data.weightedScore / data.totalWeight))
                : 0;

            result.push({
                timestamp: new Date(t).toISOString(),
                score: normalizedScore,
                signalCount: data?.count || 0,
                bullishCount: data?.bullish || 0,
                bearishCount: data?.bearish || 0,
            });
        }

        return NextResponse.json({
            symbol,
            hours,
            bucketMinutes,
            buckets: result,
            totalSignals: rows.length,
        });

    } catch (error: any) {
        console.error('[API /intel/history] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
