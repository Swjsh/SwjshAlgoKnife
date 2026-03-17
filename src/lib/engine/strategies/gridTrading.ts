import { BaseStrategy, Candle, Signal, StrategyConfig, MarketCategory } from '../types';

/**
 * Grid Trading Strategy
 * Places stacked orders at fixed intervals for ranging markets.
 * Low risk, consistent compounding in sideways conditions.
 */
export class GridTradingStrategy extends BaseStrategy {
    id = 'grid_trading';
    name = 'Grid Trading';
    description = 'Stacked orders at fixed intervals for ranging markets. Low-risk compounding.';
    category: MarketCategory = 'CRYPTO';

    private lastGridLevel: number | null = null;
    private gridSize: number = 0;

    onCandle(candle: Candle): Signal | null {
        if (!this.config.isActive) return null;

        this.gridSize = this.config.params.gridSize || 0.5; // % move to trigger

        if (this.lastGridLevel === null) {
            this.lastGridLevel = candle.close;
            return null;
        }

        const priceChange = ((candle.close - this.lastGridLevel) / this.lastGridLevel) * 100;

        if (priceChange <= -this.gridSize) {
            this.lastGridLevel = candle.close;
            return {
                timestamp: candle.timestamp,
                symbol: 'DYNAMIC',
                action: 'BUY',
                price: candle.close,
                strategy: this.name,
                notes: `Grid BUY: Price dropped ${Math.abs(priceChange).toFixed(2)}%`
            };
        }

        if (priceChange >= this.gridSize) {
            this.lastGridLevel = candle.close;
            return {
                timestamp: candle.timestamp,
                symbol: 'DYNAMIC',
                action: 'SELL',
                price: candle.close,
                strategy: this.name,
                notes: `Grid SELL: Price rose ${priceChange.toFixed(2)}%`
            };
        }

        return null;
    }

    onTick(symbol: string, price: number, time: string): Signal | null {
        return null;
    }
}
