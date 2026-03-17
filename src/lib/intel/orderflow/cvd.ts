// ═══════════════════════════════════════════════════════════════
// CVD CALCULATOR — Cumulative Volume Delta + Z-Score
// Detects absorption and exhaustion in real-time order flow
// ═══════════════════════════════════════════════════════════════

import { TradeEvent, CVDSnapshot, OrderFlowConfig, DEFAULT_ORDERFLOW_CONFIG } from './types';

export class CVDCalculator {
    private config: OrderFlowConfig;

    // Rolling window of raw trades per symbol
    private trades: Map<string, TradeEvent[]> = new Map();

    // Rolling history of CVD values for Z-Score computation
    private cvdHistory: Map<string, number[]> = new Map();

    // Track first/last price in window for price change calc
    private windowPrices: Map<string, { first: number; last: number }> = new Map();

    constructor(config: Partial<OrderFlowConfig> = {}) {
        this.config = { ...DEFAULT_ORDERFLOW_CONFIG, ...config };
    }

    /**
     * Ingest a raw trade event from an exchange feed.
     */
    addTrade(trade: TradeEvent): void {
        // Filter noise
        const usdValue = trade.price * trade.quantity;
        if (usdValue < this.config.minTradeSize) return;

        const trades = this.trades.get(trade.symbol) || [];
        trades.push(trade);
        this.trades.set(trade.symbol, trades);

        // Track prices
        const prices = this.windowPrices.get(trade.symbol);
        if (!prices) {
            this.windowPrices.set(trade.symbol, { first: trade.price, last: trade.price });
        } else {
            prices.last = trade.price;
        }
    }

    /**
     * Compute a CVD snapshot for a symbol.
     * Call this on a timer (every computeIntervalMs).
     */
    compute(symbol: string): CVDSnapshot | null {
        // Trim to rolling window
        const cutoff = Date.now() - this.config.rollingWindowMs;
        const allTrades = (this.trades.get(symbol) || []).filter(t => t.timestamp > cutoff);
        this.trades.set(symbol, allTrades);

        if (allTrades.length < 5) return null; // Not enough data

        // Compute volume delta
        let buyVolume = 0;
        let sellVolume = 0;
        let sellTradeCount = 0;

        for (const t of allTrades) {
            const vol = t.price * t.quantity; // USD volume
            if (t.side === 'BUY') {
                buyVolume += vol;
            } else {
                sellVolume += vol;
                sellTradeCount++;
            }
        }

        const delta = buyVolume - sellVolume;
        const cvd = delta; // CVD for this window

        // Update CVD history for Z-Score
        const history = this.cvdHistory.get(symbol) || [];
        history.push(cvd);
        if (history.length > this.config.zScoreWindowSize) {
            history.shift();
        }
        this.cvdHistory.set(symbol, history);

        // Compute Z-Score
        const cvdZScore = this.computeZScore(history, cvd);

        // Price change in window
        const prices = this.windowPrices.get(symbol);
        const priceChange = prices && prices.first > 0
            ? ((prices.last - prices.first) / prices.first) * 100
            : 0;

        // Reset window price tracking
        if (allTrades.length > 0) {
            const lastTrade = allTrades[allTrades.length - 1];
            this.windowPrices.set(symbol, { first: lastTrade.price, last: lastTrade.price });
        }

        // ── Absorption Detection ────────────────────────────────
        // High sell-side aggression (many sell trades) BUT delta stays
        // flat/positive AND price doesn't drop. Hidden buyer absorbing.
        const totalTrades = allTrades.length;
        const sellRatio = totalTrades > 0 ? sellTradeCount / totalTrades : 0;
        const absorptionDetected =
            sellRatio >= this.config.absorptionSellRatio &&  // Lots of sell-side aggression
            delta >= 0 &&                                     // But net delta is flat or positive
            priceChange >= -0.05;                             // Price didn't meaningfully drop

        // ── Exhaustion Detection ────────────────────────────────
        // Extreme one-sided CVD (Z-Score beyond threshold) suggests
        // the move has overextended and may reverse.
        let exhaustionDetected = false;
        let exhaustionSide: CVDSnapshot['exhaustionSide'] = null;

        if (history.length >= 10) { // Need enough history
            if (cvdZScore > this.config.zScoreThreshold) {
                // Extreme positive CVD — buying exhaustion (bearish reversal signal)
                exhaustionDetected = true;
                exhaustionSide = 'BULLISH_EXHAUSTION';
            } else if (cvdZScore < -this.config.zScoreThreshold) {
                // Extreme negative CVD — selling exhaustion (bullish reversal signal)
                exhaustionDetected = true;
                exhaustionSide = 'BEARISH_EXHAUSTION';
            }
        }

        return {
            symbol,
            cvd,
            cvdZScore,
            buyVolume,
            sellVolume,
            delta,
            sellTradeCount,
            priceChange,
            absorptionDetected,
            exhaustionDetected,
            exhaustionSide,
            timestamp: Date.now(),
        };
    }

    /**
     * Compute Z-Score: (value - mean) / stddev
     */
    private computeZScore(history: number[], currentValue: number): number {
        if (history.length < 3) return 0;

        const mean = history.reduce((a, b) => a + b, 0) / history.length;
        const variance = history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / history.length;
        const stddev = Math.sqrt(variance);

        if (stddev === 0) return 0;
        return (currentValue - mean) / stddev;
    }

    /**
     * Get current trade count in window (for monitoring).
     */
    getTradeCount(symbol: string): number {
        return (this.trades.get(symbol) || []).length;
    }
}
