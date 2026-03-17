import { BaseStrategy, Candle, Signal, StrategyConfig, MarketCategory } from '../types';

/**
 * Three Ducks Strategy
 * A multi-timeframe trend following system. 
 * (In this simulation, we use different EMA lengths to proxy MTF).
 */
export class ThreeDucksStrategy extends BaseStrategy {
    id = 'three_ducks';
    name = 'Three Ducks Trend';
    description = 'Multi-timeframe trend filter for high-probability momentum.';
    category: MarketCategory = 'FOREX';

    private sma60_short: number[] = [];
    private sma60_med: number[] = [];
    private sma60_long: number[] = [];

    onCandle(candle: Candle): Signal | null {
        if (!this.config.isActive) return null;

        // We proxy "3 timeframes" using 3 different window lengths on the 1m feed
        // e.g. 60 (1hr), 240 (4hr), 1440 (Daily)
        this.updateSMA(this.sma60_short, candle.close, 60);
        this.updateSMA(this.sma60_med, candle.close, 240);
        this.updateSMA(this.sma60_long, candle.close, 1440);

        if (this.sma60_long.length < 1440) return null;

        const shortAvg = this.getAverage(this.sma60_short);
        const medAvg = this.getAverage(this.sma60_med);
        const longAvg = this.getAverage(this.sma60_long);

        // Three Ducks Condition: Price above all 3 averages for LONG
        // Intel integration: this trend strategy can be suppressed in ranging markets
        if (candle.close > shortAvg && candle.close > medAvg && candle.close > longAvg) {
            if (this.isDirectionVetoed('LONG')) return null;
            const regime = this.intelContext?.regime || 'UNKNOWN';
            return {
                timestamp: candle.timestamp,
                symbol: 'DYNAMIC',
                action: 'BUY',
                price: candle.close,
                strategy: this.name,
                notes: `Three Ducks Aligned: Strong Bullish Trend [regime: ${regime}]`
            };
        }

        if (candle.close < shortAvg && candle.close < medAvg && candle.close < longAvg) {
            if (this.isDirectionVetoed('SHORT')) return null;
            const regime = this.intelContext?.regime || 'UNKNOWN';
            return {
                timestamp: candle.timestamp,
                symbol: 'DYNAMIC',
                action: 'SELL',
                price: candle.close,
                strategy: this.name,
                notes: `Three Ducks Aligned: Strong Bearish Trend [regime: ${regime}]`
            };
        }

        return null;
    }

    private updateSMA(buffer: number[], price: number, length: number) {
        buffer.push(price);
        if (buffer.length > length) buffer.shift();
    }

    private getAverage(buffer: number[]) {
        return buffer.reduce((a, b) => a + b) / buffer.length;
    }

    onTick(symbol: string, price: number, time: string): Signal | null {
        return null;
    }
}
