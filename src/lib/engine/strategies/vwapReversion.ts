import { BaseStrategy, Candle, Signal, StrategyConfig, MarketCategory } from '../types';

/**
 * VWAP Mean Reversion
 * Profit from price returning to its Volume Weighted Average Price.
 */
export class VWAPStrategy extends BaseStrategy {
    id = 'vwap_reversion';
    name = 'VWAP Reversion';
    description = 'Trades price deviations from the Volume Weighted Average Price (Institutional mean).';
    category: MarketCategory = 'CRYPTO';

    private vwapSum: number = 0;
    private volumeSum: number = 0;
    private sessionDate: string | null = null;

    onCandle(candle: Candle): Signal | null {
        if (!this.config.isActive) return null;

        const date = candle.timestamp.split('T')[0];
        if (this.sessionDate !== date) {
            this.sessionDate = date;
            this.vwapSum = 0;
            this.volumeSum = 0;
        }

        // Cumulative VWAP calculation
        this.vwapSum += (candle.close * candle.volume);
        this.volumeSum += candle.volume;
        const vwap = this.vwapSum / this.volumeSum;

        const deviation = ((candle.close - vwap) / vwap) * 100;
        // Intel adapts: trending widens threshold (don't fade trends),
        // ranging tightens it (catch mean reversion sooner)
        const baseThreshold = this.config.params.threshold || 1.5;
        const threshold = this.adaptParam(baseThreshold, this.intelContext?.adaptations.vwapThresholdAdj ?? 0);

        // In a strong trend, intel may flag mean-reversion as dangerous
        if (deviation < -threshold) {
            if (this.isDirectionVetoed('LONG')) return null;
            return {
                timestamp: candle.timestamp,
                symbol: 'DYNAMIC',
                action: 'BUY',
                price: candle.close,
                strategy: this.name,
                notes: `Price ${deviation.toFixed(2)}% below VWAP. Mean reversion LONG. (thresh: ${threshold.toFixed(2)}%)`
            };
        }

        if (deviation > threshold) {
            if (this.isDirectionVetoed('SHORT')) return null;
            return {
                timestamp: candle.timestamp,
                symbol: 'DYNAMIC',
                action: 'SELL',
                price: candle.close,
                strategy: this.name,
                notes: `Price ${deviation.toFixed(2)}% above VWAP. Mean reversion SHORT. (thresh: ${threshold.toFixed(2)}%)`
            };
        }

        return null;
    }

    onTick(symbol: string, price: number, time: string): Signal | null {
        return null;
    }
}
