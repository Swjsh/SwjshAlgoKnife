// ═══════════════════════════════════════════════════════════════
// ORDER FLOW FEEDS — Exchange WebSocket connections
// Same pattern as MarketData.ts but focused on trade events
// with buyer/seller aggressor classification.
// ═══════════════════════════════════════════════════════════════

import WebSocket from 'ws';
import EventEmitter from 'events';
import { TradeEvent } from './types';

export class OrderFlowFeed extends EventEmitter {
    private binanceWs: WebSocket | null = null;
    private isRunning = false;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        super();
        this.setMaxListeners(10);
    }

    start(): void {
        this.isRunning = true;
        this.connectBinance();
    }

    stop(): void {
        this.isRunning = false;
        if (this.binanceWs) {
            this.binanceWs.close();
            this.binanceWs = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    // ── Binance aggTrade Stream ─────────────────────────────────

    private connectBinance(): void {
        // aggTrade = aggregated trades — combines fills at same price/time
        // Supports multiple symbols via combined stream
        const streams = ['btcusdt@aggTrade', 'ethusdt@aggTrade'].join('/');

        // Try Binance US first, fall back to global
        const urls = [
            `wss://stream.binance.us:9443/stream?streams=${streams}`,
            `wss://stream.binance.com:9443/stream?streams=${streams}`,
        ];

        this.tryConnect(urls, 0);
    }

    private tryConnect(urls: string[], index: number): void {
        if (index >= urls.length) {
            console.warn('⚠️ [OrderFlow] All Binance endpoints failed. Starting mock feed.');
            this.startMockFeed();
            return;
        }

        const url = urls[index];
        console.log(`📊 [OrderFlow] Connecting to Binance (${index === 0 ? 'US' : 'Global'})...`);

        this.binanceWs = new WebSocket(url);

        this.binanceWs.on('open', () => {
            console.log(`✅ [OrderFlow] Binance Connected (${index === 0 ? 'US' : 'Global'})`);
        });

        this.binanceWs.on('message', (data: WebSocket.Data) => {
            if (!this.isRunning) return;
            try {
                const msg = JSON.parse(data.toString());
                // Combined stream format: { stream: "btcusdt@aggTrade", data: { ... } }
                const trade = msg.data || msg;

                if (!trade.p || !trade.q) return;

                // Binance aggTrade fields:
                // p = price, q = quantity, m = isBuyerMaker
                // m === true  → taker was SELL (maker was the buyer, taker sold into bid)
                // m === false → taker was BUY  (maker was the seller, taker bought from ask)
                const symbol = this.normalizeBinanceSymbol(trade.s || msg.stream?.split('@')[0] || 'BTCUSDT');

                const event: TradeEvent = {
                    symbol,
                    price: parseFloat(trade.p),
                    quantity: parseFloat(trade.q),
                    side: trade.m ? 'SELL' : 'BUY',
                    timestamp: trade.T || Date.now(),
                    exchange: 'BINANCE',
                };

                this.emit('trade', event);
            } catch (e) {
                // Silently ignore parse errors (pings, etc.)
            }
        });

        this.binanceWs.on('error', () => {
            console.warn(`⚠️ [OrderFlow] Binance ${index === 0 ? 'US' : 'Global'} connection failed.`);
            this.binanceWs?.close();
            this.tryConnect(urls, index + 1);
        });

        this.binanceWs.on('close', () => {
            if (this.isRunning) {
                console.warn('⚠️ [OrderFlow] Binance connection closed. Reconnecting in 10s...');
                this.reconnectTimer = setTimeout(() => this.connectBinance(), 10000);
            }
        });
    }

    private normalizeBinanceSymbol(raw: string): string {
        // BTCUSDT → BTCUSD, ETHUSDT → ETHUSD
        const s = raw.toUpperCase();
        if (s.endsWith('USDT')) return s.replace('USDT', 'USD');
        if (s.endsWith('USD')) return s;
        return s;
    }

    // ── Mock Feed (fallback if Binance unavailable) ─────────────

    private mockInterval: ReturnType<typeof setInterval> | null = null;

    private startMockFeed(): void {
        console.log('🤖 [OrderFlow] Starting mock trade feed for development...');
        let btcPrice = 95000;

        this.mockInterval = setInterval(() => {
            if (!this.isRunning) return;

            // Generate 3–8 mock trades per tick
            const count = 3 + Math.floor(Math.random() * 6);
            for (let i = 0; i < count; i++) {
                btcPrice += (Math.random() - 0.48) * 15; // Slight upward bias
                const isBuy = Math.random() > 0.45; // Slight buy bias

                this.emit('trade', {
                    symbol: 'BTCUSD',
                    price: btcPrice,
                    quantity: 0.001 + Math.random() * 0.5,
                    side: isBuy ? 'BUY' : 'SELL',
                    timestamp: Date.now(),
                    exchange: 'MOCK',
                } as TradeEvent);
            }
        }, 1000); // 1 second tick
    }
}
