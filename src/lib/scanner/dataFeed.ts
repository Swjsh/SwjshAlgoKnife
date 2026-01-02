import { Asset } from './types';

/**
 * Mock data feed for development
 * In production, replace with real API calls (Yahoo Finance, Alpha Vantage, etc.)
 */
export class MockDataFeed {

    static generateMockWatchlist(): Asset[] {
        return [
            {
                symbol: 'SLV',
                price: 71.12,
                volume: 139161200,
                avgVolume: 45000000,
                dailyReturn: 0.0485,
                high: 71.225,
                low: 67.345,
                open: 67.83,
                resistance: 71.00,
                consolidationPeriod: 8
            },
            {
                symbol: 'GLD',
                price: 246.50,
                volume: 12500000,
                avgVolume: 10000000,
                dailyReturn: 0.012,
                high: 247.20,
                low: 245.80,
                open: 246.00,
                resistance: 248.00,
                consolidationPeriod: 5
            },
            {
                symbol: 'SPY',
                price: 580.25,
                volume: 85000000,
                avgVolume: 75000000,
                dailyReturn: 0.008,
                high: 581.50,
                low: 578.90,
                open: 579.50,
                consolidationPeriod: 3
            },
            {
                symbol: 'TSLA',
                price: 245.30,
                volume: 95000000,
                avgVolume: 120000000,
                dailyReturn: -0.015,
                high: 248.00,
                low: 244.50,
                open: 247.00,
                consolidationPeriod: 2
            },
            {
                symbol: 'NVDA',
                price: 485.60,
                volume: 52000000,
                avgVolume: 48000000,
                dailyReturn: 0.025,
                high: 488.20,
                low: 482.30,
                open: 483.50,
                resistance: 490.00,
                consolidationPeriod: 6
            }
        ];
    }

    /**
     * Simulate live price updates
     */
    static updateAsset(asset: Asset): Asset {
        const volatility = 0.002; // 0.2% random movement
        const change = (Math.random() - 0.5) * 2 * volatility;

        return {
            ...asset,
            price: asset.price * (1 + change),
            volume: asset.volume + Math.floor(Math.random() * 100000)
        };
    }
}
