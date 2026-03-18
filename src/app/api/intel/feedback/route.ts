// ═══════════════════════════════════════════════════════════════
// INTEL FEEDBACK API — Agents report trade outcomes back to intel
// POST /api/intel/feedback
//
// Closes the feedback loop: trade outcome → intel system learns
// which intel decisions correlated with wins/losses.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

interface FeedbackRequest {
    agentId: string;
    tradeId?: number;
    symbol: string;
    direction: 'LONG' | 'SHORT';
    strategy?: string;
    outcome: 'WIN' | 'LOSS' | 'BE' | 'TIMEOUT' | 'MANUAL_CLOSE';
    pnl?: number;
    durationMinutes?: number;
    intelScoreAtEntry?: number;
    intelDecisionAtEntry?: string;
    notes?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body: FeedbackRequest = await request.json();

        if (!body.agentId || !body.symbol || !body.direction || !body.outcome) {
            return NextResponse.json(
                { error: 'Missing required fields: agentId, symbol, direction, outcome' },
                { status: 400 },
            );
        }

        const validOutcomes = ['WIN', 'LOSS', 'BE', 'TIMEOUT', 'MANUAL_CLOSE'];
        if (!validOutcomes.includes(body.outcome)) {
            return NextResponse.json(
                { error: `Invalid outcome. Valid: ${validOutcomes.join(', ')}` },
                { status: 400 },
            );
        }

        const result = db.prepare(`
            INSERT INTO agent_feedback_log
            (agent_id, trade_id, symbol, direction, strategy, outcome, pnl, duration_minutes,
             intel_score_at_entry, intel_decision_at_entry, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            body.agentId,
            body.tradeId || null,
            body.symbol,
            body.direction,
            body.strategy || null,
            body.outcome,
            body.pnl ?? null,
            body.durationMinutes ?? null,
            body.intelScoreAtEntry ?? null,
            body.intelDecisionAtEntry || null,
            body.notes || null,
        );

        return NextResponse.json({
            status: 'recorded',
            id: Number(result.lastInsertRowid),
        });

    } catch (error: any) {
        console.error('[API /intel/feedback] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * GET /api/intel/feedback?agentId=pivot_pete&limit=50
 * Returns recent feedback entries with intel accuracy stats.
 */
export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agentId');
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)), 200);

    try {
        // Get feedback log
        const rows = agentId
            ? db.prepare(`
                SELECT * FROM agent_feedback_log
                WHERE agent_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            `).all(agentId, limit) as any[]
            : db.prepare(`
                SELECT * FROM agent_feedback_log
                ORDER BY timestamp DESC
                LIMIT ?
            `).all(limit) as any[];

        // Compute intel accuracy stats
        const stats = agentId ? computeIntelAccuracy(agentId) : null;

        return NextResponse.json({
            count: rows.length,
            feedback: rows,
            stats,
        });
    } catch (error: any) {
        console.error('[API /intel/feedback GET] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * Compute how well intel predictions correlated with trade outcomes.
 * Answers: "When intel said GO, did we win? When it said NO_GO, was it right to veto?"
 */
function computeIntelAccuracy(agentId: string): Record<string, any> {
    try {
        const rows = db.prepare(`
            SELECT outcome, intel_decision_at_entry, pnl
            FROM agent_feedback_log
            WHERE agent_id = ? AND intel_decision_at_entry IS NOT NULL
            ORDER BY timestamp DESC
            LIMIT 100
        `).all(agentId) as any[];

        if (rows.length === 0) return { totalSamples: 0 };

        let goWins = 0, goLosses = 0, reducedWins = 0, reducedLosses = 0;
        let totalPnlOnGo = 0, totalPnlOnReduced = 0;

        for (const row of rows) {
            const isWin = row.outcome === 'WIN' || row.outcome === 'BE';
            if (row.intel_decision_at_entry === 'GO') {
                if (isWin) goWins++; else goLosses++;
                totalPnlOnGo += row.pnl || 0;
            } else if (row.intel_decision_at_entry === 'REDUCED') {
                if (isWin) reducedWins++; else reducedLosses++;
                totalPnlOnReduced += row.pnl || 0;
            }
        }

        const goTotal = goWins + goLosses;
        const reducedTotal = reducedWins + reducedLosses;

        return {
            totalSamples: rows.length,
            goDecisions: {
                total: goTotal,
                winRate: goTotal > 0 ? (goWins / goTotal * 100).toFixed(1) + '%' : 'N/A',
                totalPnl: totalPnlOnGo,
            },
            reducedDecisions: {
                total: reducedTotal,
                winRate: reducedTotal > 0 ? (reducedWins / reducedTotal * 100).toFixed(1) + '%' : 'N/A',
                totalPnl: totalPnlOnReduced,
            },
        };
    } catch {
        return { error: 'Failed to compute stats' };
    }
}
