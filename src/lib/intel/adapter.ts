// ═══════════════════════════════════════════════════════════════
// INTEL ADAPTER — Bridge between Intel Bus and Strategy Engine
//
// Provides real-time parameter adjustments to strategies based
// on current intel signals and market regime detection.
//
// Usage:
//   const adapter = IntelAdapter.forSymbol('BTCUSD');
//   const params = adapter.getAdaptedParams('bb_breakout');
// ═══════════════════════════════════════════════════════════════

import intelBus from './bus';
import type { IntelSignal, IntelScore, IntelDirection } from './types';
import { detectRegime } from './regime';
import type { MarketRegime } from './regime';

// Re-export so existing consumers of adapter.ts don't break
export type { MarketRegime } from './regime';

export interface IntelContext {
    /** Current market regime */
    regime: MarketRegime;
    /** Intel score for LONG */
    longScore: IntelScore;
    /** Intel score for SHORT */
    shortScore: IntelScore;
    /** Active signal count */
    signalCount: number;
    /** Fear & Greed index value (0-100) if available */
    fearGreed: number | null;
    /** Funding rate if available */
    fundingRate: number | null;
    /** Timestamp of this context snapshot */
    timestamp: string;
}

/**
 * Strategy-specific parameter adjustments recommended by intel.
 * Each strategy reads what it needs and ignores the rest.
 */
export interface StrategyAdaptations {
    /** ORB / NeverStoppedOut: bias for directional trades */
    htfBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    /** NeverStoppedOut: wide range threshold adjustment (+/- points) */
    wideRangeThresholdAdj: number;
    /** NeverStoppedOut / ORB: cooldown adjustment (+/- minutes) */
    cooldownAdj: number;
    /** Bollinger Band: squeeze threshold adjustment (+/- ratio) */
    squeezeThresholdAdj: number;
    /** VWAP: deviation threshold adjustment (+/- percentage) */
    vwapThresholdAdj: number;
    /** S/R: sensitivity adjustment (+/- ratio) */
    sensitivityAdj: number;
    /** Should trend-following strategies be preferred? */
    preferTrend: boolean;
    /** Should stops be tightened? */
    tightenStops: boolean;
    /** Overall confidence in the adaptation (0-1) */
    confidence: number;
}

const DEFAULT_ADAPTATIONS: StrategyAdaptations = {
    htfBias: 'NEUTRAL',
    wideRangeThresholdAdj: 0,
    cooldownAdj: 0,
    squeezeThresholdAdj: 0,
    vwapThresholdAdj: 0,
    sensitivityAdj: 0,
    preferTrend: false,
    tightenStops: false,
    confidence: 0,
};

export class IntelAdapter {
    private symbol: string;
    private cachedContext: IntelContext | null = null;
    private cacheExpiry = 0;
    private static CACHE_TTL_MS = 30_000; // 30s cache

    private constructor(symbol: string) {
        this.symbol = symbol;
    }

    static forSymbol(symbol: string): IntelAdapter {
        return new IntelAdapter(symbol.toUpperCase());
    }

    // ── Context ────────────────────────────────────────────────

    /**
     * Get the current intel context for this symbol.
     * Cached for 30 seconds to avoid hammering the bus on every tick.
     */
    getContext(): IntelContext {
        if (this.cachedContext && Date.now() < this.cacheExpiry) {
            return this.cachedContext;
        }

        const signals = intelBus.query(this.symbol);
        const longScore = intelBus.score(this.symbol, 'LONG');
        const shortScore = intelBus.score(this.symbol, 'SHORT');

        // Extract Fear & Greed and Funding Rate from signals
        let fearGreed: number | null = null;
        let fundingRate: number | null = null;

        for (const sig of signals) {
            if (sig.source === 'FEAR_GREED' && sig.payload?.value != null) {
                fearGreed = sig.payload.value;
            }
            if (sig.source === 'FUNDING_OI' && sig.payload?.fundingRate != null) {
                fundingRate = sig.payload.fundingRate;
            }
        }

        const regime = detectRegime(signals, fearGreed);

        this.cachedContext = {
            regime,
            longScore,
            shortScore,
            signalCount: signals.length,
            fearGreed,
            fundingRate,
            timestamp: new Date().toISOString(),
        };
        this.cacheExpiry = Date.now() + IntelAdapter.CACHE_TTL_MS;

        return this.cachedContext;
    }

    // ── Adaptations ────────────────────────────────────────────

    /**
     * Get parameter adjustments for the current market regime.
     * Strategies should apply these as modifiers to their base params.
     */
    getAdaptations(): StrategyAdaptations {
        const ctx = this.getContext();

        if (ctx.signalCount === 0) {
            return { ...DEFAULT_ADAPTATIONS, confidence: 0 };
        }

        const confidence = Math.min(1, ctx.signalCount / 6); // More signals = higher confidence

        switch (ctx.regime) {
            case 'TRENDING_BULL':
                return {
                    htfBias: 'BULLISH',
                    wideRangeThresholdAdj: -50,        // Lower threshold = more inverse ORBs
                    cooldownAdj: -2,                     // Faster re-entry in trends
                    squeezeThresholdAdj: 0,
                    vwapThresholdAdj: +0.3,              // Don't fade the trend
                    sensitivityAdj: -0.02,               // Wider S/R zones
                    preferTrend: true,
                    tightenStops: false,
                    confidence,
                };

            case 'TRENDING_BEAR':
                return {
                    htfBias: 'BEARISH',
                    wideRangeThresholdAdj: -50,
                    cooldownAdj: -2,
                    squeezeThresholdAdj: 0,
                    vwapThresholdAdj: +0.3,
                    sensitivityAdj: -0.02,
                    preferTrend: true,
                    tightenStops: false,
                    confidence,
                };

            case 'HIGH_VOL':
                return {
                    htfBias: 'NEUTRAL',
                    wideRangeThresholdAdj: +100,         // Raise threshold — more caution
                    cooldownAdj: +5,                      // Slower re-entry
                    squeezeThresholdAdj: +0.02,          // Wider squeeze threshold
                    vwapThresholdAdj: +0.5,              // Need bigger deviation
                    sensitivityAdj: -0.03,               // Wider zones
                    preferTrend: false,
                    tightenStops: false,                  // Wider stops in vol
                    confidence,
                };

            case 'RANGING':
                return {
                    htfBias: 'NEUTRAL',
                    wideRangeThresholdAdj: 0,
                    cooldownAdj: 0,
                    squeezeThresholdAdj: -0.01,          // More sensitive to squeezes
                    vwapThresholdAdj: -0.2,              // Tighter VWAP reversion
                    sensitivityAdj: +0.02,               // Tighter S/R zones
                    preferTrend: false,
                    tightenStops: true,
                    confidence,
                };

            case 'LOW_VOL':
                return {
                    htfBias: 'NEUTRAL',
                    wideRangeThresholdAdj: -100,         // Lower threshold for more signals
                    cooldownAdj: -3,                      // Faster
                    squeezeThresholdAdj: -0.02,          // Very sensitive
                    vwapThresholdAdj: -0.3,
                    sensitivityAdj: +0.03,
                    preferTrend: false,
                    tightenStops: true,
                    confidence,
                };

            default:
                return { ...DEFAULT_ADAPTATIONS, confidence: 0 };
        }
    }

    /**
     * Check if a proposed trade direction aligns with intel.
     * Quick check for strategies that want a simple yes/no before generating signals.
     */
    isDirectionAligned(direction: 'LONG' | 'SHORT'): boolean {
        const ctx = this.getContext();
        const score = direction === 'LONG' ? ctx.longScore : ctx.shortScore;
        return score.sizeMultiplier > 0;
    }

    /**
     * Get the recommended size multiplier for a direction.
     */
    getSizeMultiplier(direction: 'LONG' | 'SHORT'): number {
        const ctx = this.getContext();
        const score = direction === 'LONG' ? ctx.longScore : ctx.shortScore;
        return score.sizeMultiplier;
    }

    /** Invalidate the cache (e.g., after a major intel event) */
    invalidateCache(): void {
        this.cachedContext = null;
        this.cacheExpiry = 0;
    }
}

export default IntelAdapter;
