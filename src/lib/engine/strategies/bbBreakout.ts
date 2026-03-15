import { BaseStrategy, Candle, Signal, StrategyConfig, MarketCategory } from '../types';

/**
 * Bollinger Band Squeeze & Breakout
 * Detects low volatility (squeeze) and enters on the subsequent breakout.
 */
export class BollingerBandStrategy extends BaseStrategy {
    id = 'bb_breakout';
    name = 'BB Squeeze & Breakout';
    description = 'Detects volatility squeezes and trades the explosive breakout.';
    category: MarketCategory = 'CRYPTO';

    private prices: number[] = [];
    private isSqueezed: boolean = false;

    onCandle(candle: Candle): Signal | null {
        if (!this.config.isActive) return null;

        this.prices.push(candle.close);
        const period = this.config.params.period || 20;
        if (this.prices.length > period) this.prices.shift();
        if (this.prices.length < period) return null;

        const sma = this.prices.reduce((a, b) => a + b) / period;
        const variance = this.prices.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
        const stdDev = Math.sqrt(variance);

        const upperBand = sma + (stdDev * 2);
        const lowerBand = sma - (stdDev * 2);
        const bandwidth = (upperBand - lowerBand) / sma;

        // Intel adapts: ranging/low-vol tightens threshold (more sensitive),
        // high-vol widens it (fewer false signals)
        const baseThreshold = this.config.params.squeezeThreshold || 0.05;
        const squeezeThreshold = this.adaptParam(baseThreshold, this.intelContext?.adaptations.squeezeThresholdAdj ?? 0);

        if (bandwidth < squeezeThreshold) {
            this.isSqueezed = true;
        }

        if (this.isSqueezed) {
            if (candle.close > upperBand) {
                if (this.isDirectionVetoed('LONG')) { this.isSqueezed = false; return null; }
                this.isSqueezed = false;
                return {
                    timestamp: candle.timestamp,
                    symbol: 'DYNAMIC',
                    action: 'BUY',
                    price: candle.close,
                    strategy: this.name,
                    notes: `Post-Squeeze Bullish Breakout! (sqz: ${squeezeThreshold.toFixed(3)})`
                };
            }
            if (candle.close < lowerBand) {
                if (this.isDirectionVetoed('SHORT')) { this.isSqueezed = false; return null; }
                this.isSqueezed = false;
                return {
                    timestamp: candle.timestamp,
                    symbol: 'DYNAMIC',
                    action: 'SELL',
                    price: candle.close,
                    strategy: this.name,
                    notes: `Post-Squeeze Bearish Breakout! (sqz: ${squeezeThreshold.toFixed(3)})`
                };
            }
        }

        return null;
    }

    onTick(symbol: string, price: number, time: string): Signal | null {
        return null;
    }
}
