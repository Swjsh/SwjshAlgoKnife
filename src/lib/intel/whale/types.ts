// ═══════════════════════════════════════════════════════════════
// WHALE FLOW TRACKER — Type Definitions
// ═══════════════════════════════════════════════════════════════

export interface WhaleTransfer {
    hash: string;
    chain: string;
    from: string;
    to: string;
    token: string;
    amountUsd: number;
    timestamp: number;         // Unix ms
    fromLabel: string;
    toLabel: string;
    flowType: WhaleFlowType;
}

export type WhaleFlowType =
    | 'EXCHANGE_INFLOW'      // Tokens moving TO exchange (potential sell pressure)
    | 'EXCHANGE_OUTFLOW'     // Tokens moving FROM exchange (accumulation)
    | 'WHALE_TO_WHALE'       // Large transfer between non-exchange wallets
    | 'UNKNOWN';

export interface WhaleFlowSnapshot {
    symbol: string;
    windowMs: number;
    netFlowUsd: number;      // Positive = net exchange inflows (bearish), Negative = outflows (bullish)
    inflowUsd: number;
    outflowUsd: number;
    transferCount: number;
    largestTransferUsd: number;
    panicScore: number;       // 0-1, based on velocity and magnitude of inflows
    timestamp: number;
}

export interface WhaleFlowConfig {
    /** Rolling window for flow aggregation */
    windowMs: number;
    /** Minimum transfer size in USD to track */
    minTransferUsd: number;
    /** Net flow threshold (USD) to emit a signal */
    signalThresholdUsd: number;
    /** Panic threshold — triggers kill switch if exceeded */
    panicThresholdUsd: number;
    /** How often to recompute snapshots */
    computeIntervalMs: number;
    /** Polling interval for Whale Alert / Etherscan */
    pollIntervalMs: number;
}

export const DEFAULT_WHALE_CONFIG: WhaleFlowConfig = {
    windowMs: 30 * 60 * 1000,           // 30 min rolling window
    minTransferUsd: 500_000,             // $500K minimum
    signalThresholdUsd: 5_000_000,       // $5M net flow to emit signal
    panicThresholdUsd: 50_000_000,       // $50M net inflow → panic / kill switch
    computeIntervalMs: 30 * 1000,        // Recompute every 30s
    pollIntervalMs: 5 * 60 * 1000,       // Poll APIs every 5 min
};

/** Known exchange deposit addresses for flow classification. */
export const KNOWN_EXCHANGE_ADDRESSES: Set<string> = new Set([
    // Binance
    '0x28c6c06298d514db089934071355e5743bf21d60',
    '0x21a31ee1afc51d94c2efccaa2092ad1028285549',
    '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8',
    // Coinbase
    '0x71660c4005ba85c37ccec55d0c4493e66fe775d3',
    '0x503828976d22510aad0201ac7ec88293211d23da',
    // Kraken
    '0x2910543af39aba0cd09dbb2d50200b3e800a63d2',
    // Bitfinex
    '0x56eddb7aa87536c09ccc2793473599fd21a8b17f',
    // OKX
    '0x6cc5f688a315f3dc28a7781717a9a798a59fda7b',
]);
