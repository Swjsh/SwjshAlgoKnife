// ═══════════════════════════════════════════════════════════════
// INTELLIGENCE BUS — Central hub for all intel data layers
// "All roads lead to the bus."
//
// Singleton module — survives across request lifecycles.
// Every data layer (order flow, sentiment, on-chain, whale)
// publishes IntelSignals here. The executor queries here
// before sizing trades.
// ═══════════════════════════════════════════════════════════════

import EventEmitter from 'events';
import db from '../db';
import {
    IntelSignal,
    IntelScore,
    IntelSource,
    IntelDirection,
    INTEL_TTL_MS,
    INTEL_WEIGHTS,
    ALL_INTEL_SOURCES,
    SOURCE_REGISTRY,
} from './types';

class IntelligenceBus extends EventEmitter {
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;
    /** Dedup cache: hash → timestamp. Prevents duplicate signals within a time window. */
    private dedupCache = new Map<string, number>();
    /**
     * Per-source dedup windows (ms). Sources that poll frequently need
     * a longer dedup window to avoid near-identical signals flooding the feed.
     */
    private static DEDUP_WINDOWS: Partial<Record<string, number>> = {
        FEAR_GREED:     4 * 60 * 1000,   // 4 min (polls every 5 min, data updates daily)
        FUNDING_OI:     2 * 60 * 1000,   // 2 min (polls every 3 min)
        MARKET_DATA:    90 * 1000,        // 90s (polls every 2 min)
        ECON_CALENDAR:  10 * 60 * 1000,   // 10 min (polls every 15 min)
        SOCIAL_FEED:    3 * 60 * 1000,    // 3 min (polls every 2 min, high-value tweets)
    };
    private static DEFAULT_DEDUP_MS = 60 * 1000; // 1 minute for premium sources

    constructor() {
        super();
        this.setMaxListeners(20);
        // Auto-cleanup expired signals every 5 minutes
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
        // Prune dedup cache every 2 minutes
        setInterval(() => this.pruneDedupCache(), 2 * 60 * 1000);
    }

    // ── Dedup ───────────────────────────────────────────────────

    /**
     * Generate a dedup hash from a signal's core identity.
     * Uses source+symbol+direction only — NOT summary, since minor
     * price changes shouldn't create new signals every poll cycle.
     */
    private dedupHash(signal: IntelSignal): string {
        return `${signal.source}:${signal.symbol}:${signal.direction}`;
    }

    /**
     * Check if a signal is a duplicate of a recently published one.
     * Uses per-source dedup windows for optimal sensitivity.
     */
    private isDuplicate(signal: IntelSignal): boolean {
        const hash = this.dedupHash(signal);
        const lastSeen = this.dedupCache.get(hash);
        const window = IntelligenceBus.DEDUP_WINDOWS[signal.source] || IntelligenceBus.DEFAULT_DEDUP_MS;

        if (lastSeen && (Date.now() - lastSeen) < window) {
            return true;
        }
        this.dedupCache.set(hash, Date.now());
        return false;
    }

    private pruneDedupCache(): void {
        const cutoff = Date.now() - 15 * 60 * 1000; // Keep entries for 15 min max
        for (const [hash, ts] of this.dedupCache) {
            if (ts < cutoff) this.dedupCache.delete(hash);
        }
    }

    // ── Publish ─────────────────────────────────────────────────

    /**
     * Publish an intel signal from any data layer.
     * Deduplicates, persists to SQLite, and emits event for real-time listeners.
     */
    publish(signal: IntelSignal): number {
        // Dedup: skip if identical signal was published recently
        if (this.isDuplicate(signal)) {
            return -1;
        }

        const now = new Date().toISOString();
        const timestamp = signal.timestamp || now;

        // Calculate expiry if not provided
        const ttlMs = INTEL_TTL_MS[signal.source] || 30 * 60 * 1000;
        const expiresAt = signal.expiresAt || new Date(Date.now() + ttlMs).toISOString();

        try {
            const result = db.prepare(`
                INSERT INTO intel_signals (timestamp, source, symbol, signal_type, confidence, summary, payload, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                timestamp,
                signal.source,
                signal.symbol,
                signal.direction,
                signal.confidence,
                signal.summary || '',
                JSON.stringify(signal.payload || {}),
                expiresAt,
            );

            const id = Number(result.lastInsertRowid);

            const enriched: IntelSignal = {
                ...signal,
                id,
                timestamp,
                expiresAt,
            };

            // Emit for real-time listeners (dashboard SSE, etc.)
            this.emit('intel', enriched);

            console.log(`🧠 [Intel] ${signal.source} → ${signal.direction} ${signal.symbol} (${(signal.confidence * 100).toFixed(0)}%) — ${signal.summary}`);

            return id;
        } catch (err) {
            console.error('[Intel Bus] Failed to publish signal:', err);
            return -1;
        }
    }

    // ── Query ───────────────────────────────────────────────────

    /**
     * Get all active (non-expired) intel signals for a symbol.
     * Optionally filter by source.
     */
    query(symbol: string, source?: IntelSource): IntelSignal[] {
        const now = new Date().toISOString();

        try {
            const rows = source
                ? db.prepare(`
                    SELECT * FROM intel_signals
                    WHERE symbol = ? AND source = ? AND expires_at > ?
                    ORDER BY timestamp DESC
                    LIMIT 50
                `).all(symbol, source, now) as any[]
                : db.prepare(`
                    SELECT * FROM intel_signals
                    WHERE symbol = ? AND expires_at > ?
                    ORDER BY timestamp DESC
                    LIMIT 50
                `).all(symbol, now) as any[];

            return rows.map(row => ({
                id: row.id,
                source: row.source as IntelSource,
                symbol: row.symbol,
                direction: row.signal_type as IntelDirection,
                confidence: row.confidence,
                summary: row.summary,
                payload: JSON.parse(row.payload || '{}'),
                timestamp: row.timestamp,
                expiresAt: row.expires_at,
            }));
        } catch (err) {
            console.error('[Intel Bus] Query failed:', err);
            return [];
        }
    }

    /**
     * Get all active intel signals across all symbols.
     * Used by the /api/intel endpoint and dashboard.
     */
    queryAll(source?: IntelSource, limit: number = 100): IntelSignal[] {
        const now = new Date().toISOString();

        try {
            const rows = source
                ? db.prepare(`
                    SELECT * FROM intel_signals
                    WHERE source = ? AND expires_at > ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                `).all(source, now, limit) as any[]
                : db.prepare(`
                    SELECT * FROM intel_signals
                    WHERE expires_at > ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                `).all(now, limit) as any[];

            return rows.map(row => ({
                id: row.id,
                source: row.source as IntelSource,
                symbol: row.symbol,
                direction: row.signal_type as IntelDirection,
                confidence: row.confidence,
                summary: row.summary,
                payload: JSON.parse(row.payload || '{}'),
                timestamp: row.timestamp,
                expiresAt: row.expires_at,
            }));
        } catch (err) {
            console.error('[Intel Bus] QueryAll failed:', err);
            return [];
        }
    }

    // ── Score ───────────────────────────────────────────────────

    /**
     * Compute a weighted Intel Score for a symbol + trade direction.
     * Called by RiskEngine before every trade.
     *
     * @param symbol - The asset symbol (e.g., 'BTCUSD')
     * @param tradeDirection - 'LONG' or 'SHORT' — the proposed trade direction
     * @returns IntelScore with sizeMultiplier for position sizing
     */
    score(symbol: string, tradeDirection: 'LONG' | 'SHORT'): IntelScore {
        const signals = this.query(symbol);

        // No intel available — slight reduction (flying blind)
        if (signals.length === 0) {
            return {
                symbol,
                score: 0,
                sizeMultiplier: 0.75,
                reason: 'No active intel — reduced size (flying blind)',
                signalCount: 0,
                breakdown: {},
            };
        }

        // Map trade direction to expected intel direction
        const alignedDirection: IntelDirection = tradeDirection === 'LONG' ? 'BULLISH' : 'BEARISH';
        const opposedDirection: IntelDirection = tradeDirection === 'LONG' ? 'BEARISH' : 'BULLISH';

        let weightedSum = 0;
        let totalWeight = 0;
        const breakdown: IntelScore['breakdown'] = {};

        // Take the most recent signal per source (avoid double-counting)
        const latestBySource = new Map<IntelSource, IntelSignal>();
        for (const sig of signals) {
            if (!latestBySource.has(sig.source)) {
                latestBySource.set(sig.source, sig);
            }
        }

        for (const [source, sig] of latestBySource) {
            const weight = INTEL_WEIGHTS[source] || 0.1;
            totalWeight += weight;

            // Score: +confidence if aligned, -confidence if opposed, 0 if neutral/alert
            let signalScore = 0;
            if (sig.direction === alignedDirection) {
                signalScore = sig.confidence;
            } else if (sig.direction === opposedDirection) {
                signalScore = -sig.confidence;
            }
            // NEUTRAL and ALERT contribute 0

            weightedSum += signalScore * weight;

            breakdown[source] = {
                direction: sig.direction,
                confidence: sig.confidence,
            };
        }

        // Normalize to -1.0 to +1.0 range
        const normalizedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

        // Map score to size multiplier
        let sizeMultiplier: number;
        let reason: string;

        if (normalizedScore > 0.3) {
            sizeMultiplier = 1.0;
            reason = `Intel CONFIRMS ${tradeDirection} (score: ${normalizedScore.toFixed(2)})`;
        } else if (normalizedScore >= -0.1) {
            sizeMultiplier = 0.5;
            reason = `Intel MIXED for ${tradeDirection} — half size (score: ${normalizedScore.toFixed(2)})`;
        } else if (normalizedScore >= -0.5) {
            sizeMultiplier = 0.25;
            reason = `Intel OPPOSES ${tradeDirection} — quarter size (score: ${normalizedScore.toFixed(2)})`;
        } else {
            sizeMultiplier = 0;
            reason = `Intel VETOES ${tradeDirection} — skipping trade (score: ${normalizedScore.toFixed(2)})`;
        }

        return {
            symbol,
            score: normalizedScore,
            sizeMultiplier,
            reason,
            signalCount: latestBySource.size,
            breakdown,
        };
    }

    // ── Heartbeat ───────────────────────────────────────────────

    /**
     * Record a heartbeat from a background service.
     * Used by /api/health to monitor service status.
     */
    heartbeat(service: string, signalsPublished: number = 0): void {
        try {
            db.prepare(`
                INSERT INTO settings (key, value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
            `).run(
                `health:${service}`,
                JSON.stringify({ lastHeartbeat: new Date().toISOString(), signalsPublished }),
            );
        } catch (err) {
            console.error(`[Intel Bus] Heartbeat failed for ${service}:`, err);
        }
    }

    /**
     * Get health status for all registered services.
     */
    getHealth(): Record<string, { lastHeartbeat: string; status: string; signalsPublished: number }> {
        const services = ALL_INTEL_SOURCES.map(s => SOURCE_REGISTRY[s].healthKey);
        const health: Record<string, any> = {};

        for (const svc of services) {
            try {
                const row = db.prepare(`SELECT value, updated_at FROM settings WHERE key = ?`)
                    .get(`health:${svc}`) as any;

                if (row) {
                    const data = JSON.parse(row.value);
                    const lastBeat = new Date(data.lastHeartbeat).getTime();
                    const ageMs = Date.now() - lastBeat;

                    // Stale if no heartbeat in 5 minutes, dead if 15 minutes
                    const status = ageMs < 5 * 60 * 1000 ? 'RUNNING'
                                 : ageMs < 15 * 60 * 1000 ? 'STALE'
                                 : 'DEAD';

                    health[svc] = {
                        lastHeartbeat: data.lastHeartbeat,
                        status,
                        signalsPublished: data.signalsPublished || 0,
                    };
                } else {
                    health[svc] = { lastHeartbeat: null, status: 'NOT_STARTED', signalsPublished: 0 };
                }
            } catch {
                health[svc] = { lastHeartbeat: null, status: 'ERROR', signalsPublished: 0 };
            }
        }

        return health;
    }

    // ── Cleanup ─────────────────────────────────────────────────

    /**
     * Remove expired intel signals from the database.
     */
    cleanup(): number {
        try {
            const result = db.prepare(`
                DELETE FROM intel_signals WHERE expires_at <= ?
            `).run(new Date().toISOString());

            const deleted = result.changes;
            if (deleted > 0) {
                console.log(`🧹 [Intel Bus] Cleaned up ${deleted} expired signals`);
            }
            return deleted;
        } catch (err) {
            console.error('[Intel Bus] Cleanup failed:', err);
            return 0;
        }
    }

    /**
     * Shutdown the bus (clear intervals).
     */
    shutdown(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.removeAllListeners();
    }
}

// ── Module-level singleton ──────────────────────────────────────
// Same pattern as db.ts — survives across request lifecycles
const intelBus = new IntelligenceBus();

export default intelBus;
