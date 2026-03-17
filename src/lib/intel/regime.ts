// ═══════════════════════════════════════════════════════════════
// REGIME DETECTOR — Single source of truth for market regime
//
// Previously duplicated between adapter.ts and preflight/route.ts
// with slightly different thresholds (0.55 vs 0.60). Both consumers
// now import from here so agents and strategies always agree.
//
// Thresholds (unified):
//   - Extreme Fear/Greed (≤20 or ≥80)  → HIGH_VOL
//   - 2+ ALERT signals                  → HIGH_VOL
//   - Bullish > 2× bearish, avgConf > 0.55 → TRENDING_BULL
//   - Bearish > 2× bullish, avgConf > 0.55 → TRENDING_BEAR
//   - Neutral > all directional          → RANGING
//   - ≤2 total signals                   → LOW_VOL
//   - Fallback                           → RANGING
// ═══════════════════════════════════════════════════════════════

import type { IntelSignal } from './types';

export type MarketRegime =
    | 'TRENDING_BULL'
    | 'TRENDING_BEAR'
    | 'RANGING'
    | 'HIGH_VOL'
    | 'LOW_VOL'
    | 'UNKNOWN';

/**
 * Detect market regime from active intel signals.
 *
 * @param signals   Active IntelSignals for the symbol
 * @param fearGreed Optional Fear & Greed index (0-100). If omitted, extracted
 *                  from the signals array automatically.
 */
export function detectRegime(
    signals: IntelSignal[],
    fearGreed?: number | null,
): MarketRegime {
    if (signals.length === 0) return 'UNKNOWN';

    let bullish = 0, bearish = 0, neutral = 0, alerts = 0;
    let bullConf = 0, bearConf = 0;

    // Allow caller to pass fearGreed directly (adapter has it pre-extracted);
    // otherwise pull it from the signal payloads on the fly.
    let fgValue: number | null = fearGreed ?? null;

    for (const sig of signals) {
        switch (sig.direction) {
            case 'BULLISH': bullish++; bullConf += sig.confidence; break;
            case 'BEARISH': bearish++; bearConf += sig.confidence; break;
            case 'NEUTRAL': neutral++; break;
            case 'ALERT':   alerts++;  break;
        }
        if (fgValue === null && sig.source === 'FEAR_GREED' && sig.payload?.value != null) {
            fgValue = sig.payload.value;
        }
    }

    // ── Extreme sentiment → high volatility ───────────────────
    if (fgValue !== null && (fgValue <= 20 || fgValue >= 80)) {
        return 'HIGH_VOL';
    }

    // ── Multiple alerts → high vol ────────────────────────────
    if (alerts >= 2) return 'HIGH_VOL';

    const avgBullConf = bullish > 0 ? bullConf / bullish : 0;
    const avgBearConf = bearish > 0 ? bearConf / bearish : 0;

    // ── Strong directional consensus ──────────────────────────
    if (bullish > bearish * 2 && avgBullConf > 0.55) return 'TRENDING_BULL';
    if (bearish > bullish * 2 && avgBearConf > 0.55) return 'TRENDING_BEAR';

    // ── Mostly neutral ────────────────────────────────────────
    if (neutral > bullish + bearish) return 'RANGING';

    // ── Sparse signal set ─────────────────────────────────────
    if (signals.length <= 2) return 'LOW_VOL';

    return 'RANGING';
}
