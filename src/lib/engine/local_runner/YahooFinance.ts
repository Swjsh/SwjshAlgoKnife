
import EventEmitter from 'events';

export class YahooFinance extends EventEmitter {
    private isRunning = false;
    private interval: NodeJS.Timeout | null = null;
    private symbols = [
        { yahoo: 'EURUSD=X', normalized: 'EURUSD' },
        { yahoo: 'GBPUSD=X', normalized: 'GBPUSD' },
        { yahoo: 'USDJPY=X', normalized: 'USDJPY' },
        { yahoo: 'AUDUSD=X', normalized: 'AUDUSD' },
        { yahoo: 'USDCAD=X', normalized: 'USDCAD' }
    ];

    start() {
        this.isRunning = true;
        const pairList = this.symbols.map(s => s.normalized).join(', ');
        console.log(`🌍 [YahooFinance] Starting Multi-Pair Poller for ${pairList}...`);

        // Poll every 10 seconds
        // (No immediate fetch here; keeps start/stop deterministic and avoids overlapping in tests.)
        this.interval = setInterval(() => {
            this.fetchAllPrices();
        }, 10000);
    }

    stop() {
        this.isRunning = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    private async fetchAllPrices() {
        if (!this.isRunning) return;

        // Fetch all pairs sequentially to avoid rate limiting
        for (const symbol of this.symbols) {
            if (!this.isRunning) break;
            await this.fetchPrice(symbol.yahoo, symbol.normalized);
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    private async fetchPrice(yahooSymbol: string, normalizedTicker: string) {
        if (!this.isRunning) return;

        try {
            // Using the chart API which is generally open and reliable for snapshots
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1m&range=1d`;
            const res = await fetch(url);
            const data = await res.json();

            const result = data?.chart?.result?.[0];
            const meta = result?.meta;
            const price = meta?.regularMarketPrice;
            const ts = typeof meta?.regularMarketTime === 'number' ? meta.regularMarketTime * 1000 : Date.now();

            if (typeof price === 'number') {
                this.emit('price', {
                    ticker: normalizedTicker,
                    price,
                    timestamp: ts,
                    source: 'YAHOO'
                });
            }
        } catch (error: any) {
            console.error(`❌ [YahooFinance] Fetch Error for ${normalizedTicker}:`, error.message);
        }
    }
}
