// ═══════════════════════════════════════════════════════════════
// ORDER FLOW SERVICE — Orchestrates feeds → CVD → Intel Bus
// "Read the tape, not the chart."
// ═══════════════════════════════════════════════════════════════

import { OrderFlowFeed } from './feeds';
import { CVDCalculator } from './cvd';
import { OrderFlowConfig, DEFAULT_ORDERFLOW_CONFIG, CVDSnapshot } from './types';
import intelBus from '../bus';
import { notifyIntelSignal } from '../../notifications/discord';
import type { IntelSignal } from '../types';

export class OrderFlowService {
    private feed: OrderFlowFeed;
    private cvd: CVDCalculator;
    private config: OrderFlowConfig;
    private computeInterval: ReturnType<typeof setInterval> | null = null;
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private signalsPublished = 0;
    private symbols: string[] = ['BTCUSD', 'ETHUSD'];

    constructor(config: Partial<OrderFlowConfig> = {}) {
        this.config = { ...DEFAULT_ORDERFLOW_CONFIG, ...config };
        this.feed = new OrderFlowFeed();
        this.cvd = new CVDCalculator(this.config);
    }

    start(): void {
        console.log('📊 [OrderFlow Service] Starting...');
        console.log(`   Window: ${this.config.rollingWindowMs / 1000}s | Z-Score threshold: ${this.config.zScoreThreshold}`);
        console.log(`   Compute interval: ${this.config.computeIntervalMs / 1000}s`);

        // Pipe trade events into CVD calculator
        this.feed.on('trade', (trade) => {
            this.cvd.addTrade(trade);
        });

        // Start exchange feeds
        this.feed.start();

        // Start periodic CVD computation
        this.computeInterval = setInterval(() => {
            for (const symbol of this.symbols) {
                this.processSnapshot(symbol);
            }
        }, this.config.computeIntervalMs);

        // Heartbeat every 60 seconds
        this.heartbeatInterval = setInterval(() => {
            intelBus.heartbeat('orderflow', this.signalsPublished);
        }, 60 * 1000);

        // Initial heartbeat
        intelBus.heartbeat('orderflow', 0);
    }

    stop(): void {
        this.feed.stop();
        if (this.computeInterval) clearInterval(this.computeInterval);
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        console.log('📊 [OrderFlow Service] Stopped.');
    }

    private processSnapshot(symbol: string): void {
        const snapshot = this.cvd.compute(symbol);
        if (!snapshot) return;

        const tradeCount = this.cvd.getTradeCount(symbol);
        console.log(
            `📊 [CVD] ${symbol}: delta=$${snapshot.delta.toFixed(0)} ` +
            `z=${snapshot.cvdZScore.toFixed(2)} ` +
            `buy=$${snapshot.buyVolume.toFixed(0)} sell=$${snapshot.sellVolume.toFixed(0)} ` +
            `trades=${tradeCount} ` +
            `${snapshot.absorptionDetected ? '🟢ABSORPTION ' : ''}` +
            `${snapshot.exhaustionDetected ? '⚡EXHAUSTION ' : ''}`
        );

        // Publish intel signals for detected patterns
        if (snapshot.absorptionDetected) {
            this.publishAbsorption(snapshot);
        }

        if (snapshot.exhaustionDetected) {
            this.publishExhaustion(snapshot);
        }
    }

    private publishAbsorption(snapshot: CVDSnapshot): void {
        // Absorption = hidden buyer absorbing sell pressure → BULLISH
        const confidence = Math.min(0.9, 0.6 + (snapshot.sellTradeCount / 100) * 0.1);

        const signal: IntelSignal = {
            source: 'ORDER_FLOW',
            symbol: snapshot.symbol,
            direction: 'BULLISH',
            confidence,
            summary: `Absorption detected: ${snapshot.sellTradeCount} sell trades but delta +$${snapshot.delta.toFixed(0)}, price ${snapshot.priceChange >= 0 ? 'holding' : 'stable'}`,
            payload: {
                type: 'ABSORPTION',
                cvd: snapshot.cvd,
                zScore: snapshot.cvdZScore,
                buyVolume: snapshot.buyVolume,
                sellVolume: snapshot.sellVolume,
                sellTradeCount: snapshot.sellTradeCount,
                priceChange: snapshot.priceChange,
            },
        };

        intelBus.publish(signal);
        this.signalsPublished++;

        notifyIntelSignal({
            source: signal.source,
            symbol: signal.symbol,
            direction: signal.direction,
            confidence: signal.confidence,
            summary: signal.summary,
        }).catch(() => {});
    }

    private publishExhaustion(snapshot: CVDSnapshot): void {
        // Exhaustion = extreme one-sided flow, likely reversal
        // BULLISH_EXHAUSTION (too much buying) → BEARISH signal
        // BEARISH_EXHAUSTION (too much selling) → BULLISH signal
        const direction = snapshot.exhaustionSide === 'BULLISH_EXHAUSTION' ? 'BEARISH' : 'BULLISH';
        const confidence = Math.min(0.85, 0.5 + Math.abs(snapshot.cvdZScore) * 0.1);

        const signal: IntelSignal = {
            source: 'ORDER_FLOW',
            symbol: snapshot.symbol,
            direction,
            confidence,
            summary: `${snapshot.exhaustionSide}: Z-Score ${snapshot.cvdZScore.toFixed(2)} — potential reversal`,
            payload: {
                type: 'EXHAUSTION',
                exhaustionSide: snapshot.exhaustionSide,
                cvd: snapshot.cvd,
                zScore: snapshot.cvdZScore,
                buyVolume: snapshot.buyVolume,
                sellVolume: snapshot.sellVolume,
            },
        };

        intelBus.publish(signal);
        this.signalsPublished++;

        notifyIntelSignal({
            source: signal.source,
            symbol: signal.symbol,
            direction: signal.direction,
            confidence: signal.confidence,
            summary: signal.summary,
        }).catch(() => {});
    }
}
