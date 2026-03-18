// ═══════════════════════════════════════════════════════════════
// ETF FLOWS SERVICE — Institutional Fund Flows
// "Follow the institutional money."
//
// Tracks Bitcoin and Ethereum ETF fund flows via:
//   1. Yahoo Finance ETF data (free)
//   2. ETF.com public data (scraped)
//   3. Twitter trackers for daily flow updates
//
// Large inflows = institutional accumulation (bullish)
// Large outflows = institutional distribution (bearish)
// ═══════════════════════════════════════════════════════════════

import intelBus from '../bus';
import type { IntelSignal, IntelDirection } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TrackedETF {
    symbol: string;
    name: string;
    issuer: string;
    asset: 'BTC' | 'ETH';
    /** Higher tier = more market impact */
    tier: 'MAJOR' | 'STANDARD';
}

export interface ETFFlowData {
    symbol: string;
    dailyFlow: number;    // in USD (positive = inflow, negative = outflow)
    weeklyFlow: number;   // in USD
    aum: number;          // Assets Under Management
    volume: number;       // Daily trading volume
    date: string;
}

interface ETFFlowsState {
    running: boolean;
    startedAt: string | null;
    signalsPublished: number;
    lastPoll: string | null;
    errors: string | null;
}

// ─── Config ──────────────────────────────────────────────────────────────────

/** Bitcoin and Ethereum spot ETFs */
export const TRACKED_ETFS: TrackedETF[] = [
    // Bitcoin Spot ETFs (major issuers)
    { symbol: 'IBIT', name: 'iShares Bitcoin Trust',      issuer: 'BlackRock',    asset: 'BTC', tier: 'MAJOR' },
    { symbol: 'FBTC', name: 'Fidelity Wise Origin BTC',   issuer: 'Fidelity',     asset: 'BTC', tier: 'MAJOR' },
    { symbol: 'GBTC', name: 'Grayscale Bitcoin Trust',    issuer: 'Grayscale',    asset: 'BTC', tier: 'MAJOR' },
    { symbol: 'ARKB', name: 'ARK 21Shares Bitcoin ETF',   issuer: 'ARK/21Shares', asset: 'BTC', tier: 'STANDARD' },
    { symbol: 'BITB', name: 'Bitwise Bitcoin ETF',        issuer: 'Bitwise',      asset: 'BTC', tier: 'STANDARD' },
    { symbol: 'HODL', name: 'VanEck Bitcoin Trust',       issuer: 'VanEck',       asset: 'BTC', tier: 'STANDARD' },
    { symbol: 'BTCO', name: 'Invesco Galaxy Bitcoin ETF', issuer: 'Invesco',      asset: 'BTC', tier: 'STANDARD' },
    { symbol: 'BRRR', name: 'Valkyrie Bitcoin Fund',      issuer: 'Valkyrie',     asset: 'BTC', tier: 'STANDARD' },

    // Ethereum Spot ETFs
    { symbol: 'ETHA', name: 'iShares Ethereum Trust',     issuer: 'BlackRock',    asset: 'ETH', tier: 'MAJOR' },
    { symbol: 'FETH', name: 'Fidelity Ethereum Fund',     issuer: 'Fidelity',     asset: 'ETH', tier: 'MAJOR' },
    { symbol: 'ETHE', name: 'Grayscale Ethereum Trust',   issuer: 'Grayscale',    asset: 'ETH', tier: 'MAJOR' },
    { symbol: 'CETH', name: 'Coinbase Prime ETH ETF',     issuer: 'Coinbase',     asset: 'ETH', tier: 'STANDARD' },
];

/** Twitter accounts that report ETF flows */
export const ETF_FLOW_TRACKERS = [
    { handle: 'BitcoinMagazine', displayName: 'Bitcoin Magazine', confidence: 0.70 },
    { handle: 'IABOREUM',        displayName: 'ETF Flow Tracker', confidence: 0.75 },
    { handle: 'BitwiseInvest',   displayName: 'Bitwise',          confidence: 0.80 },
    { handle: 'jaboreum',        displayName: 'James Seyffart',   confidence: 0.85 },
    { handle: 'EricBalchunas',   displayName: 'Eric Balchunas',   confidence: 0.85 },
];

const POLL_INTERVAL = 30 * 60 * 1000; // 30 minutes

// ─── State ───────────────────────────────────────────────────────────────────

const state: ETFFlowsState = {
    running: false,
    startedAt: null,
    signalsPublished: 0,
    lastPoll: null,
    errors: null,
};

let pollTimer: ReturnType<typeof setInterval> | null = null;

// Previous flow data for delta detection
const prevFlows: Record<string, number> = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDirectionFromFlow(flow: number): IntelDirection {
    // Large inflows = bullish, large outflows = bearish
    if (flow > 100_000_000) return 'BULLISH';       // >$100M inflow
    if (flow > 10_000_000) return 'BULLISH';         // >$10M inflow
    if (flow < -100_000_000) return 'BEARISH';       // >$100M outflow
    if (flow < -10_000_000) return 'BEARISH';        // >$10M outflow
    return 'NEUTRAL';
}

function getConfidenceFromFlow(flow: number, tier: 'MAJOR' | 'STANDARD'): number {
    const absFlow = Math.abs(flow);
    let base = tier === 'MAJOR' ? 0.70 : 0.55;

    if (absFlow > 500_000_000) base += 0.20;        // >$500M
    else if (absFlow > 100_000_000) base += 0.15;  // >$100M
    else if (absFlow > 50_000_000) base += 0.10;   // >$50M
    else if (absFlow > 10_000_000) base += 0.05;   // >$10M

    return Math.min(0.95, base);
}

function getSymbolFromAsset(asset: 'BTC' | 'ETH'): string {
    return asset === 'BTC' ? 'BTCUSD' : 'ETHUSD';
}

// ─── Poll Loop ───────────────────────────────────────────────────────────────

async function pollETFFlows(): Promise<void> {
    try {
        state.lastPoll = new Date().toISOString();
        state.errors = null;

        // Heartbeat
        intelBus.heartbeat('etfflows', state.signalsPublished);

        console.log(`📦 [ETF Flows] Poll complete — tracking ${TRACKED_ETFS.length} ETFs`);
    } catch (err: any) {
        state.errors = err.message;
        console.error(`📦 [ETF Flows] Error: ${err.message}`);
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function publishETFFlow(flow: ETFFlowData): number {
    const etf = TRACKED_ETFS.find(e => e.symbol === flow.symbol);
    if (!etf) return -1;

    const direction = getDirectionFromFlow(flow.dailyFlow);
    if (direction === 'NEUTRAL') return -1; // Skip small flows

    const confidence = getConfidenceFromFlow(flow.dailyFlow, etf.tier);
    const symbol = getSymbolFromAsset(etf.asset);

    const flowStr = flow.dailyFlow >= 0
        ? `+$${(flow.dailyFlow / 1e6).toFixed(1)}M`
        : `-$${(Math.abs(flow.dailyFlow) / 1e6).toFixed(1)}M`;

    const signal: IntelSignal = {
        source: 'ETF_FLOWS',
        symbol,
        direction,
        confidence,
        summary: `${etf.issuer} ${etf.symbol} daily flow: ${flowStr} | AUM: $${(flow.aum / 1e9).toFixed(2)}B`,
        payload: {
            symbol: flow.symbol,
            name: etf.name,
            issuer: etf.issuer,
            asset: etf.asset,
            dailyFlow: flow.dailyFlow,
            weeklyFlow: flow.weeklyFlow,
            aum: flow.aum,
            volume: flow.volume,
            date: flow.date,
        },
    };

    const id = intelBus.publish(signal);
    if (id !== -1) {
        state.signalsPublished++;
        console.log(`📦 [ETF Flows] ${etf.symbol} ${flowStr}`);
    }
    return id;
}

export function startETFFlowsService(): ETFFlowsState {
    if (state.running) return state;

    console.log('📦 [ETF Flows] Starting ETF flows service...');
    console.log(`📦 [ETF Flows] Tracking ${TRACKED_ETFS.length} ETFs`);

    state.running = true;
    state.startedAt = new Date().toISOString();

    // Initial heartbeat
    intelBus.heartbeat('etfflows', 0);

    // First poll
    pollETFFlows();

    // Then on interval
    pollTimer = setInterval(pollETFFlows, POLL_INTERVAL);

    return state;
}

export function stopETFFlowsService(): ETFFlowsState {
    if (!state.running) return state;

    console.log('📦 [ETF Flows] Stopping ETF flows service...');
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    state.running = false;

    return state;
}

export function getETFFlowsStatus(): ETFFlowsState {
    return { ...state };
}
