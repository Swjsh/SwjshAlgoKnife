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

export abstract class BaseStrategy {
    abstract id: string;
    abstract name: string;
    abstract description: string;
    abstract category: MarketCategory;

    config: StrategyConfig;

    constructor(config: StrategyConfig) {
        this.config = config;
    }

    // Get all categories this strategy supports
    getCategories(): MarketCategory[] {
        return this.config.categories || [this.config.category];
    }

    abstract onCandle(candle: Candle): Signal | null;
    abstract onTick(symbol: string, price: number, time: string): Signal | null;
}
