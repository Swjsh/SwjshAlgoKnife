// Market Categories for organizing strategies
export type MarketCategory = 'OPTIONS' | 'CRYPTO' | 'FOREX' | 'FUTURES' | 'EQUITY';

export type MarketType = 'CRYPTO' | 'FOREX' | 'OPTIONS' | 'FUTURES' | 'EQUITY';

export interface Signal {
    id?: number;
    timestamp: string;
    symbol: string;
    /** BUY/SELL open positions; EXIT/FLAT close positions. */
    action: 'BUY' | 'SELL' | 'EXIT' | 'FLAT' | 'LONG' | 'SHORT';
    price: number;
    strategy: string;
    notes?: string;
    /** Optional bracket for paper-sim/backtests. */
    stopLoss?: number;
    takeProfit?: number;
}

export interface Candle {
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface StrategyConfig {
    id: string;
    name: string;
    isActive: boolean;
    params: Record<string, any>;
    category: MarketCategory;  // Required market category
    categories?: MarketCategory[];  // Optional: strategy works on multiple markets
}

// ── Intel Integration Types ──────────────────────────────────

export interface IntelStrategyContext {
    /** Current market regime from IntelAdapter */
    regime: string;
    /** HTF bias derived from intel: BULLISH, BEARISH, or NEUTRAL */
    htfBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    /** Parameter adjustments recommended by intel */
    adaptations: {
        squeezeThresholdAdj: number;
        vwapThresholdAdj: number;
        sensitivityAdj: number;
        wideRangeThresholdAdj: number;
        cooldownAdj: number;
        preferTrend: boolean;
        tightenStops: boolean;
    };
    /** Confidence in the intel data (0-1, higher = more signals) */
    confidence: number;
    /** Size multiplier for LONG */
    longMultiplier: number;
    /** Size multiplier for SHORT */
    shortMultiplier: number;
}

export abstract class BaseStrategy {
    abstract id: string;
    abstract name: string;
    abstract description: string;
    abstract category: MarketCategory;

    config: StrategyConfig;

    /** Intel context injected by the EngineManager on each strategy loop tick */
    protected intelContext: IntelStrategyContext | null = null;

    constructor(config: StrategyConfig) {
        this.config = config;
    }

    // Get all categories this strategy supports
    getCategories(): MarketCategory[] {
        return this.config.categories || [this.config.category];
    }

    /**
     * Called by EngineManager before each strategy evaluation tick.
     * Provides the strategy with current intel data for adaptive parameters.
     */
    setIntelContext(context: IntelStrategyContext): void {
        this.intelContext = context;
    }

    /**
     * Helper: get adapted parameter value.
     * Returns base + (adjustment * confidence) so adaptations scale
     * with how much intel data we actually have.
     */
    protected adaptParam(baseValue: number, adjustment: number): number {
        const conf = this.intelContext?.confidence ?? 0;
        return baseValue + (adjustment * conf);
    }

    /**
     * Helper: check if intel suggests skipping a direction entirely.
     * Returns true if the direction's sizeMultiplier is 0 (vetoed).
     */
    protected isDirectionVetoed(direction: 'LONG' | 'SHORT'): boolean {
        if (!this.intelContext) return false; // No intel = no veto
        return direction === 'LONG'
            ? this.intelContext.longMultiplier === 0
            : this.intelContext.shortMultiplier === 0;
    }

    abstract onCandle(candle: Candle): Signal | null;
    abstract onTick(symbol: string, price: number, time: string): Signal | null;
}
