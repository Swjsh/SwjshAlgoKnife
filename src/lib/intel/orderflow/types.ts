// ═══════════════════════════════════════════════════════════════
// ORDER FLOW TYPES — CVD, Z-Score, Absorption/Exhaustion
// ═══════════════════════════════════════════════════════════════

export interface TradeEvent {
    symbol: string;
    price: number;
    quantity: number;
    side: 'BUY' | 'SELL';       // Taker (aggressor) side
    timestamp: number;
    exchange: string;
}

export interface CVDSnapshot {
    symbol: string;
    cvd: number;                 // Running cumulative volume delta
    cvdZScore: number;           // Z-score vs rolling mean
    buyVolume: number;           // Total buy volume in window
    sellVolume: number;          // Total sell volume in window
    delta: number;               // buyVolume - sellVolume in window
    sellTradeCount: number;      // Number of sell-aggressor trades
    priceChange: number;         // Price change over window (%)
    absorptionDetected: boolean;
    exhaustionDetected: boolean;
    exhaustionSide: 'BULLISH_EXHAUSTION' | 'BEARISH_EXHAUSTION' | null;
    timestamp: number;
}

export interface OrderFlowConfig {
    rollingWindowMs: number;     // Window for CVD computation (default: 5 min)
    zScoreWindowSize: number;    // How many CVD samples for Z-Score (default: 60)
    zScoreThreshold: number;     // Z-Score for exhaustion detection (default: 2.0)
    minTradeSize: number;        // Filter noise: min trade size in USD (default: 100)
    absorptionSellRatio: number; // Sell trade count ratio for absorption (default: 0.65)
    computeIntervalMs: number;   // How often to compute snapshot (default: 10s)
}

export const DEFAULT_ORDERFLOW_CONFIG: OrderFlowConfig = {
    rollingWindowMs:     5 * 60 * 1000,  // 5 minutes
    zScoreWindowSize:    60,              // 60 snapshots (~10 min at 10s intervals)
    zScoreThreshold:     2.0,
    minTradeSize:        100,             // $100 minimum
    absorptionSellRatio: 0.65,           // 65% sell-side trades
    computeIntervalMs:   10 * 1000,      // every 10 seconds
};
