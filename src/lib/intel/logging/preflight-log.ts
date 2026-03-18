// ═══════════════════════════════════════════════════════════════
// PREFLIGHT DECISION LOGGING
// Track all intel decisions to measure effectiveness
//
// Enables post-hoc analysis:
//   - "Did intel prevent this losing trade?"
//   - "Are contrarian signals working?"
//   - "What's our win rate with GO vs REDUCED?"
//
// ROI Impact: Enables continuous improvement of intel quality
// ═══════════════════════════════════════════════════════════════

import db from '../../db';

interface PreflightDecisionInput {
    agentId: string;
    symbol: string;
    direction: 'LONG' | 'SHORT';
    decision: 'GO' | 'NO_GO' | 'REDUCED';
    intelScore: number;
    sizeMultiplier: number;
    regime: string;
    sourceBreakdown: Record<string, { direction: string; confidence: number }>;
    contrarian?: boolean;
    fundingSignal?: 'OVERHEATED' | 'OVERSOLD' | 'NEUTRAL';
    confluenceBonus?: number;
    adjustments?: string[];
}

interface StoredDecision extends PreflightDecisionInput {
    id: number;
    timestamp: string;
}

// Ensure table exists
function ensureTable(): void {
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS intel_decision_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                agent_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                direction TEXT NOT NULL,
                decision TEXT NOT NULL,
                intel_score REAL,
                size_multiplier REAL,
                regime TEXT,
                source_breakdown TEXT,
                contrarian INTEGER DEFAULT 0,
                funding_signal TEXT,
                confluence_bonus REAL,
                adjustments TEXT
            )
        `);
    } catch (err) {
        // Table may already exist
    }
}

/**
 * Log a preflight decision with full intel context.
 *
 * @param decision - The preflight decision details
 * @returns The ID of the logged decision
 */
export function logPreflightDecision(decision: PreflightDecisionInput): number {
    ensureTable();

    try {
        const result = db.prepare(`
            INSERT INTO intel_decision_log
            (agent_id, symbol, direction, decision, intel_score, size_multiplier, regime, source_breakdown, contrarian, funding_signal, confluence_bonus, adjustments)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            decision.agentId,
            decision.symbol,
            decision.direction,
            decision.decision,
            decision.intelScore,
            decision.sizeMultiplier,
            decision.regime,
            JSON.stringify(decision.sourceBreakdown),
            decision.contrarian ? 1 : 0,
            decision.fundingSignal || null,
            decision.confluenceBonus || null,
            decision.adjustments ? JSON.stringify(decision.adjustments) : null,
        );

        return Number(result.lastInsertRowid);
    } catch (err) {
        console.error('[PreflightLog] Failed to log decision:', err);
        return -1;
    }
}

/**
 * Get recent decisions for an agent.
 *
 * @param agentId - The agent ID to query
 * @param limit - Maximum number of decisions to return
 * @returns Array of stored decisions
 */
export function getRecentDecisions(agentId: string, limit: number = 20): StoredDecision[] {
    ensureTable();

    try {
        const rows = db.prepare(`
            SELECT * FROM intel_decision_log
            WHERE agent_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `).all(agentId, limit) as any[];

        return rows.map(row => ({
            id: row.id,
            timestamp: row.timestamp,
            agentId: row.agent_id,
            symbol: row.symbol,
            direction: row.direction,
            decision: row.decision,
            intelScore: row.intel_score,
            sizeMultiplier: row.size_multiplier,
            regime: row.regime,
            sourceBreakdown: JSON.parse(row.source_breakdown || '{}'),
            contrarian: row.contrarian === 1,
            fundingSignal: row.funding_signal,
            confluenceBonus: row.confluence_bonus,
            adjustments: row.adjustments ? JSON.parse(row.adjustments) : [],
        }));
    } catch (err) {
        console.error('[PreflightLog] Failed to get decisions:', err);
        return [];
    }
}

/**
 * Get a single decision by ID.
 *
 * @param id - The decision ID
 * @returns The stored decision or null
 */
export function getDecisionById(id: number): StoredDecision | null {
    ensureTable();

    try {
        const row = db.prepare(`
            SELECT * FROM intel_decision_log WHERE id = ?
        `).get(id) as any;

        if (!row) return null;

        return {
            id: row.id,
            timestamp: row.timestamp,
            agentId: row.agent_id,
            symbol: row.symbol,
            direction: row.direction,
            decision: row.decision,
            intelScore: row.intel_score,
            sizeMultiplier: row.size_multiplier,
            regime: row.regime,
            sourceBreakdown: JSON.parse(row.source_breakdown || '{}'),
            contrarian: row.contrarian === 1,
            fundingSignal: row.funding_signal,
            confluenceBonus: row.confluence_bonus,
            adjustments: row.adjustments ? JSON.parse(row.adjustments) : [],
        };
    } catch (err) {
        console.error('[PreflightLog] Failed to get decision:', err);
        return null;
    }
}

/**
 * Get decision statistics for analysis.
 *
 * @param agentId - Optional agent ID filter
 * @param days - Number of days to analyze
 */
export function getDecisionStats(agentId?: string, days: number = 7): {
    total: number;
    goCount: number;
    noGoCount: number;
    reducedCount: number;
    avgSizeMultiplier: number;
    contrarianCount: number;
} {
    ensureTable();

    try {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const query = agentId
            ? `SELECT * FROM intel_decision_log WHERE agent_id = ? AND timestamp > ?`
            : `SELECT * FROM intel_decision_log WHERE timestamp > ?`;

        const params = agentId ? [agentId, cutoff] : [cutoff];
        const rows = db.prepare(query).all(...params) as any[];

        let goCount = 0, noGoCount = 0, reducedCount = 0;
        let totalMultiplier = 0;
        let contrarianCount = 0;

        for (const row of rows) {
            if (row.decision === 'GO') goCount++;
            else if (row.decision === 'NO_GO') noGoCount++;
            else if (row.decision === 'REDUCED') reducedCount++;

            totalMultiplier += row.size_multiplier || 1;
            if (row.contrarian) contrarianCount++;
        }

        return {
            total: rows.length,
            goCount,
            noGoCount,
            reducedCount,
            avgSizeMultiplier: rows.length > 0 ? totalMultiplier / rows.length : 1,
            contrarianCount,
        };
    } catch (err) {
        console.error('[PreflightLog] Failed to get stats:', err);
        return {
            total: 0,
            goCount: 0,
            noGoCount: 0,
            reducedCount: 0,
            avgSizeMultiplier: 1,
            contrarianCount: 0,
        };
    }
}

export default {
    logPreflightDecision,
    getRecentDecisions,
    getDecisionById,
    getDecisionStats,
};
