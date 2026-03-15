import { BaseStrategy, Candle, Signal, StrategyConfig, MarketCategory } from '../types';

/**
 * Support & Resistance Rejection Strategy
 * Detects price levels where price has historically reversed.
 */
export class SupportResistanceStrategy extends BaseStrategy {
    id = 'supp_res';
    name = 'S&R Rejection';
    description = 'Detects major S&R zones and trades reversals.';
    category: MarketCategory = 'CRYPTO';

    private pivotPoints: { level: number; type: 'SUPP' | 'RES' }[] = [];
    private lastAction: string | null = null;

    onCandle(candle: Candle): Signal | null {
        if (!this.config.isActive) return null;

        // Simplified S&R detection: Keep track of high/low pivots
        // In a real scenario, we'd use a fractal or volume-profile based detection
        this.updatePivots(candle);

        // Intel adapts: ranging tightens zones (more signals), trending widens them
        const baseSensitivity = this.config.params.sensitivity || 0.1;
        const sensitivity = Math.max(0.02, this.adaptParam(baseSensitivity, this.intelContext?.adaptations.sensitivityAdj ?? 0));

        for (const pivot of this.pivotPoints) {
            const diff = Math.abs(candle.close - pivot.level) / pivot.level * 100;

            if (diff <= sensitivity) {
                if (pivot.type === 'SUPP' && this.lastAction !== 'BUY') {
                    if (this.isDirectionVetoed('LONG')) continue; // Intel veto
                    this.lastAction = 'BUY';
                    return {
                        timestamp: candle.timestamp,
                        symbol: 'DYNAMIC',
                        action: 'BUY',
                        price: candle.close,
                        strategy: this.name,
                        notes: `Support Rejection at ${pivot.level.toFixed(2)} (sens: ${sensitivity.toFixed(3)})`
                    };
                }

                if (pivot.type === 'RES' && this.lastAction !== 'SELL') {
                    if (this.isDirectionVetoed('SHORT')) continue; // Intel veto
                    this.lastAction = 'SELL';
                    return {
                        timestamp: candle.timestamp,
                        symbol: 'DYNAMIC',
                        action: 'SELL',
                        price: candle.close,
                        strategy: this.name,
                        notes: `Resistance Rejection at ${pivot.level.toFixed(2)} (sens: ${sensitivity.toFixed(3)})`
                    };
                }
            }
        }

        return null;
    }

    private updatePivots(candle: Candle) {
        // Very basic: just store extreme wick values as potential zones
        // Ideally we'd look for clusters
        if (this.pivotPoints.length < (this.config.params.zones || 5)) {
            this.pivotPoints.push({ level: candle.high, type: 'RES' });
            this.pivotPoints.push({ level: candle.low, type: 'SUPP' });
        }
    }

    onTick(symbol: string, price: number, time: string): Signal | null {
        return null;
    }
}
