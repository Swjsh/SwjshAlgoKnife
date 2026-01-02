import { Candle } from './types';

export class MarketSimulator {
    private lastPrice: number;
    private symbol: string;

    constructor(symbol: string, startPrice: number) {
        this.symbol = symbol;
        this.lastPrice = startPrice;
    }

    generateTick() {
        const volatility = this.lastPrice * 0.0005; // 0.05% max move per tick
        const change = (Math.random() - 0.5) * 2 * volatility;
        this.lastPrice += change;
        return {
            symbol: this.symbol,
            price: this.lastPrice,
            timestamp: new Date().toISOString()
        };
    }

    // Helper to generate a batch of historical candles for chart init
    generateHistory(count: number): Candle[] {
        const candles: Candle[] = [];
        let price = this.lastPrice;
        let time = Date.now() - (count * 60000); // Minutes ago

        for (let i = 0; i < count; i++) {
            const open = price;
            const high = open + Math.random() * (open * 0.002);
            const low = open - Math.random() * (open * 0.002);
            const close = low + Math.random() * (high - low);

            candles.push({
                timestamp: new Date(time).toISOString(),
                open,
                high,
                low,
                close,
                volume: Math.random() * 100
            });

            price = close;
            time += 60000;
        }
        return candles;
    }
}
