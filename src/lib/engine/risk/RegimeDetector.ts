// ═══════════════════════════════════════════════════════════════
// REGIME DETECTOR - Market State Classifier
// "Don't trade impulse strategies in a dead market."
// ═══════════════════════════════════════════════════════════════

export type MarketRegime = 'TRENDING' | 'RANGING' | 'VOLATILE' | 'DEAD' | 'UNKNOWN';

export interface RegimeConfig {
    atrPeriod: number;           // e.g., 14
    volatilityThreshold: number; // e.g., 0.001 for FX
    trendThreshold: number;      // e.g., 0.7 ADX-like
}

const DEFAULT_CONFIG: RegimeConfig = {
    atrPeriod: 14,
    volatilityThreshold: 0.0005, // 5 pips for FX
    trendThreshold: 0.6,
};

export class RegimeDetector {
    private static config: RegimeConfig = DEFAULT_CONFIG;
    private static priceHistory: Map<string, number[]> = new Map();

    static setConfig(config: Partial<RegimeConfig>) {
        this.config = { ...this.config, ...config };
    }

    /**
     * Add a price to history for a ticker.
     */
    static addPrice(ticker: string, price: number) {
        const history = this.priceHistory.get(ticker) || [];
        history.push(price);

        // Keep last 100 prices
        if (history.length > 100) {
            history.shift();
        }

        this.priceHistory.set(ticker, history);
    }

    /**
     * Classify the current market regime based on recent prices.
     */
    static classifyRegime(ticker: string): MarketRegime {
        const prices = this.priceHistory.get(ticker);

        if (!prices || prices.length < this.config.atrPeriod) {
            return 'UNKNOWN';
        }

        const recentPrices = prices.slice(-this.config.atrPeriod);

        // Calculate ATR-like volatility
        const atr = this.calculateATR(recentPrices);
        const avgPrice = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
        const volatilityRatio = atr / avgPrice;

        // Calculate trend strength (simple directional movement)
        const trendStrength = this.calculateTrendStrength(recentPrices);

        // Classification logic
        if (volatilityRatio < this.config.volatilityThreshold * 0.5) {
            return 'DEAD'; // Very low volatility
        }

        if (volatilityRatio > this.config.volatilityThreshold * 2) {
            if (trendStrength > this.config.trendThreshold) {
                return 'TRENDING'; // High volatility + clear direction
            } else {
                return 'VOLATILE'; // High volatility + no direction (choppy)
            }
        }

        if (trendStrength > this.config.trendThreshold) {
            return 'TRENDING';
        }

        return 'RANGING';
    }

    /**
     * Determine if a strategy should trade in the current regime.
     */
    static shouldTradeInRegime(regime: MarketRegime, strategyType: 'IMPULSE' | 'MEAN_REVERSION' | 'BREAKOUT'): boolean {
        const rules: Record<string, MarketRegime[]> = {
            'IMPULSE': ['TRENDING', 'VOLATILE'],      // Needs movement
            'MEAN_REVERSION': ['RANGING'],            // Needs chop
            'BREAKOUT': ['TRENDING', 'RANGING'],      // Needs defined levels
        };

        const allowedRegimes = rules[strategyType] || [];
        return allowedRegimes.includes(regime);
    }

    /**
     * Calculate simplified ATR (Average True Range).
     */
    private static calculateATR(prices: number[]): number {
        if (prices.length < 2) return 0;

        let totalRange = 0;
        for (let i = 1; i < prices.length; i++) {
            totalRange += Math.abs(prices[i] - prices[i - 1]);
        }

        return totalRange / (prices.length - 1);
    }

    /**
     * Calculate trend strength (0 to 1).
     * 1 = Perfect trend, 0 = No trend.
     */
    private static calculateTrendStrength(prices: number[]): number {
        if (prices.length < 2) return 0;

        const first = prices[0];
        const last = prices[prices.length - 1];
        const netMove = Math.abs(last - first);

        // Sum of all individual moves
        let totalMove = 0;
        for (let i = 1; i < prices.length; i++) {
            totalMove += Math.abs(prices[i] - prices[i - 1]);
        }

        if (totalMove === 0) return 0;

        // Ratio: net move / total move
        // 1 = all moves in same direction (strong trend)
        // 0 = moves cancel out (no trend)
        return netMove / totalMove;
    }

    /**
     * Get human-readable regime description.
     */
    static getRegimeDescription(regime: MarketRegime): string {
        const descriptions: Record<MarketRegime, string> = {
            'TRENDING': '📈 Trending - Strong directional movement',
            'RANGING': '↔️ Ranging - Sideways consolidation',
            'VOLATILE': '⚡ Volatile - High activity, no clear direction',
            'DEAD': '💀 Dead - Minimal movement, avoid trading',
            'UNKNOWN': '❓ Unknown - Insufficient data',
        };

        return descriptions[regime];
    }
}
