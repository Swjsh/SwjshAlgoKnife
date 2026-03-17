import { Candle } from './types';

/**
 * ⚠️  UI-ONLY MARKET SIMULATOR — NOT FOR BACKTESTING OR STRATEGY VALIDATION
 *
 * This simulator generates SYNTHETIC (fake) price data for dashboard UI
 * initialization only — populating charts with placeholder data before real
 * feeds connect.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  NEVER use this for backtesting, strategy development, or any  ║
 * ║  form of performance measurement. Results would be meaningless ║
 * ║  and misleading.                                                ║
 * ║                                                                 ║
 * ║  For backtesting, use:                                          ║
 * ║    python scripts/universal_backtest.py --source yfinance       ║
 * ║    python scripts/universal_backtest.py --source alpaca         ║
 * ║                                                                 ║
 * ║  For live/paper data feeds, use:                                ║
 * ║    - Alpaca WebSocket (equities/crypto)                         ║
 * ║    - OANDA Streaming API (forex)                                ║
 * ║    - Binance WebSocket (crypto)                                 ║
 * ║    See: scripts/data_feeds.py                                   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
export class MarketSimulator {
    private lastPrice: number;
    private symbol: string;

    constructor(symbol: string, startPrice: number) {
        this.symbol = symbol;
        this.lastPrice = startPrice;
        console.warn(
            '⚠️  [Simulator] Using SYNTHETIC price data for UI only. ' +
            'Do NOT use for backtesting — use real data via universal_backtest.py'
        );
    }

    /**
     * Generate a single synthetic tick (UI placeholder only).
     * For real ticks, use AlpacaDataProvider, OANDA streaming, or Binance WS.
     */
    generateTick() {
        const volatility = this.lastPrice * 0.0005; // 0.05% max move per tick
        const change = (Math.random() - 0.5) * 2 * volatility;
        this.lastPrice += change;
        return {
            symbol: this.symbol,
            price: this.lastPrice,
            timestamp: new Date().toISOString(),
            _synthetic: true, // Flag so consumers know this is fake data
        };
    }

    /**
     * Generate placeholder candles for chart initialization (UI only).
     * For real historical candles, use:
     *   - AlpacaDataProvider.getHistoricalBars()
     *   - OandaClient.getCandles()
     *   - python scripts/universal_backtest.py --source yfinance
     */
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
