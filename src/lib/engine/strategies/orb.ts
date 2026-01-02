import { BaseStrategy, Candle, Signal, StrategyConfig, MarketCategory } from '../types';

/**
 * Opening Range Breakout (ORB) Strategy
 * Standard implementation: First 15 mins of trading defines the range.
 * Breakout of the high/low triggers a trade.
 */
export class ORBStrategy extends BaseStrategy {
    id = 'orb_15m';
    name = 'ORB 15m Breakout';
    description = 'Trades the breakout of the first 15 minutes of the daily session.';
    category: MarketCategory = 'FUTURES';

    private openingHigh: number | null = null;
    private openingLow: number | null = null;
    private sessionDate: string | null = null;
    private isRangeSet: boolean = false;

    onCandle(candle: Candle): Signal | null {
        if (!this.config.isActive) return null;

        const candleDate = new Date(candle.timestamp);
        const dateStr = candleDate.toISOString().split('T')[0];
        const hour = candleDate.getHours();
        const minute = candleDate.getMinutes();

        // Reset for new day (assume 9:30 AM EST start for this example, adjust according to market)
        // For Crypto/24h markets, the user usually defines a specific 'start time'
        if (this.sessionDate !== dateStr) {
            this.sessionDate = dateStr;
            this.openingHigh = -Infinity;
            this.openingLow = Infinity;
            this.isRangeSet = false;
        }

        // Monitoring the first 15 mins (e.g., 09:30 - 09:45)
        // Simplified for logic: let's say the user wants the first 15 mins of THEIR session
        const sessionStartMinutes = (this.config.params.startHour || 9) * 60 + (this.config.params.startMinute || 30);
        const currentMinutes = hour * 60 + minute;
        const duration = this.config.params.duration || 15;

        if (currentMinutes >= sessionStartMinutes && currentMinutes < sessionStartMinutes + duration) {
            this.openingHigh = Math.max(this.openingHigh!, candle.high);
            this.openingLow = Math.min(this.openingLow!, candle.low);
            return null;
        }

        if (currentMinutes >= sessionStartMinutes + duration && !this.isRangeSet) {
            this.isRangeSet = true;
            console.log(`ORB Range Set for ${dateStr}: H: ${this.openingHigh} L: ${this.openingLow}`);
        }

        // After range is set, look for breakout
        if (this.isRangeSet && this.openingHigh && this.openingLow) {
            if (candle.close > this.openingHigh && this.openingHigh !== -Infinity) {
                // Breakout High -> LONG
                this.openingHigh = Infinity; // Single trigger per session for this example
                return {
                    timestamp: candle.timestamp,
                    symbol: 'DYNAMIC', // Should be passed in
                    action: 'BUY',
                    price: candle.close,
                    strategy: this.name,
                    notes: `ORB 15m Upside Breakout at ${candle.close}`
                };
            }

            if (candle.close < this.openingLow && this.openingLow !== Infinity) {
                // Breakout Low -> SHORT
                this.openingLow = -Infinity; // Single trigger
                return {
                    timestamp: candle.timestamp,
                    symbol: 'DYNAMIC',
                    action: 'SELL',
                    price: candle.close,
                    strategy: this.name,
                    notes: `ORB 15m Downside Breakout at ${candle.close}`
                };
            }
        }

        return null;
    }

    onTick(symbol: string, price: number, time: string): Signal | null {
        // Ticks can also trigger breakouts for faster execution
        return null;
    }
}
