
import WebSocket from 'ws';
import EventEmitter from 'events';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import type { YahooFinance } from './YahooFinance';

// Load environment variables manually since we are in a raw script
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

export interface PriceUpdate {
    ticker: string;
    price: number;
    timestamp: number;
    source: 'BINANCE' | 'FINNHUB';
}

export class MarketData extends EventEmitter {
    private binanceWs: WebSocket | null = null;
    private finnhubWs: WebSocket | null = null;
    private isRunning = false;

    constructor() {
        super();
    }

    start() {
        this.isRunning = true;
        // Crypto feed: enabled by default.
        // Set DISABLE_CRYPTO_FEED=true to skip Binance (e.g. during FX-only sessions).
        const cryptoDisabled = process.env.DISABLE_CRYPTO_FEED === 'true';
        if (cryptoDisabled) {
            console.log('🚫 [MarketData] Crypto feed DISABLED via DISABLE_CRYPTO_FEED env var.');
        } else {
            this.connectBinance();
        }
        this.connectFinnhub();
    }

    private connectBinance() {
        // Try Binance US first (likely user location)
        this.binanceWs = new WebSocket('wss://stream.binance.us:9443/ws/btcusdt@trade');

        this.binanceWs.on('open', () => {
            console.log('✅ [MarketData] Binance US Connected');
        });

        this.binanceWs.on('message', (data: string) => {
            if (!this.isRunning) return;
            try {
                const trade = JSON.parse(data);
                this.emit('price', {
                    ticker: 'BTCUSD',
                    price: parseFloat(trade.p),
                    timestamp: Date.now(),
                    source: 'BINANCE'
                });
            } catch (e) {
                console.error('❌ [MarketData] Binance parse error:', e instanceof Error ? e.message : String(e));
                this.emit('error', { source: 'BINANCE', error: e, rawData: data.slice(0, 200) });
            }
        });

        this.binanceWs.on('error', (err) => {
            console.error('❌ [MarketData] Binance Connection Failed (Geo-block?). Switching to MOCK CRYPTO.');
            this.startMockCrypto();
        });
    }

    private connectFinnhub() {
        // Try to read key from process (loaded via dotenv)
        const apiKey = process.env.NEXT_PUBLIC_FINNHUB_KEY;

        if (!apiKey) {
            console.warn('⚠️ [MarketData] No Finnhub Key found. Running FX in MOCK MODE.');
            this.startMockFx();
            return;
        }

        this.finnhubWs = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);

        this.finnhubWs.on('open', () => {
            console.log('✅ [MarketData] Finnhub Connected');
            this.finnhubWs?.send(JSON.stringify({ type: 'subscribe', symbol: 'OANDA:EUR_USD' }));
        });

        this.finnhubWs.on('message', (data: string) => {
            if (!this.isRunning) return;
            try {
                const msg = JSON.parse(data);
                if (msg.type === 'trade' && msg.data) {
                    this.emit('price', {
                        ticker: 'EURUSD',
                        price: msg.data[0].p,
                        timestamp: Date.now(),
                        source: 'FINNHUB'
                    });
                }
            } catch (e) {
                console.error('❌ [MarketData] Finnhub parse error:', e instanceof Error ? e.message : String(e));
                this.emit('error', { source: 'FINNHUB', error: e, rawData: data.slice(0, 200) });
            }
        });

        this.finnhubWs.on('error', (err) => {
            console.warn('⚠️ [MarketData] Finnhub Error. Switching to Mock FX.');
            this.startMockFx();
        });
    }

    private yahooFx: YahooFinance | null = null;

    private startMockFx() {
        console.log('🌍 [MarketData] Switching to YAHOO FINANCE (Real Data Polling)...');
        // Lazy load the Yahoo module to avoid import errors if not needed
        import('./YahooFinance').then(({ YahooFinance }) => {
            if (!this.yahooFx) {
                this.yahooFx = new YahooFinance();
                this.yahooFx.on('price', (tick) => {
                    if (this.isRunning) this.emit('price', tick);
                });
                this.yahooFx.start();
            }
        });
    }

    private startMockCrypto() {
        console.log('🤖 [Internal] Starting Mock Crypto Feed...');
        let price = 95000.00;
        setInterval(() => {
            if (!this.isRunning) return;
            // Volatile random walk
            price += (Math.random() - 0.5) * 50;
            this.emit('price', {
                ticker: 'BTCUSD',
                price: price,
                timestamp: Date.now(),
                source: 'MOCK_CRYPTO'
            });
        }, 500);
    }
}
