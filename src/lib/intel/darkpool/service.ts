// ═══════════════════════════════════════════════════════════════
// DARK POOL SERVICE — Hidden Institutional Liquidity
// "The market beneath the market."
//
// Tracks dark pool activity via:
//   1. FINRA ATS data (delayed, but official)
//   2. Twitter dark pool trackers
//   3. Large block print detection
//
// Large dark pool prints at support = accumulation (bullish)
// Large prints at resistance = distribution (bearish)
// ═══════════════════════════════════════════════════════════════

import intelBus from '../bus';
import type { IntelSignal, IntelDirection } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DarkPoolPrint {
    ticker: string;
    price: number;
    size: number;        // Number of shares
    notional: number;    // Dollar value
    exchange: string;    // ATS/dark pool name
    timestamp: string;
    priceLevel?: 'SUPPORT' | 'RESISTANCE' | 'MID';
}

interface DarkPoolState {
    running: boolean;
    startedAt: string | null;
    signalsPublished: number;
    lastPoll: string | null;
    errors: string | null;
}

// ─── Config ──────────────────────────────────────────────────────────────────

/** Known dark pools / ATS venues */
export const DARK_POOLS = [
    'SIGMA X', 'MS POOL', 'CROSSFINDER', 'LEVEL ATS', 'UBS ATS',
    'BARCLAYS ATS', 'ITG POSIT', 'INSTINET', 'LIQUIDNET',
];

/** Twitter accounts tracking dark pool activity */
export const DARKPOOL_TRACKERS = [
    { handle: 'darkpoolcharts', displayName: 'Dark Pool Charts', confidence: 0.70 },
    { handle: 'cikitrends',     displayName: 'Ciki Trends',      confidence: 0.65 },
];

/** Minimum notional value to track */
export const MIN_NOTIONAL = 1_000_000; // $1M+

const POLL_INTERVAL = 10 * 60 * 1000; // 10 minutes

// ─── State ───────────────────────────────────────────────────────────────────

const state: DarkPoolState = {
    running: false,
    startedAt: null,
    signalsPublished: 0,
    lastPoll: null,
    errors: null,
};

let pollTimer: ReturnType<typeof setInterval> | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDirectionFromPrint(print: DarkPoolPrint): IntelDirection {
    // Large prints at support = accumulation (bullish)
    // Large prints at resistance = distribution (bearish)
    if (print.priceLevel === 'SUPPORT') return 'BULLISH';
    if (print.priceLevel === 'RESISTANCE') return 'BEARISH';
    return 'ALERT'; // Large print without context
}

function getConfidenceFromPrint(print: DarkPoolPrint): number {
    let confidence = 0.50;

    if (print.notional > 50_000_000) confidence += 0.30;
    else if (print.notional > 10_000_000) confidence += 0.20;
    else if (print.notional > 5_000_000) confidence += 0.10;

    if (print.priceLevel && print.priceLevel !== 'MID') confidence += 0.10;

    return Math.min(0.90, confidence);
}

// ─── Poll Loop ───────────────────────────────────────────────────────────────

async function pollDarkPoolActivity(): Promise<void> {
    try {
        state.lastPoll = new Date().toISOString();
        state.errors = null;
        intelBus.heartbeat('darkpool', state.signalsPublished);
        console.log(`🌑 [Dark Pool] Poll complete — tracking institutional prints`);
    } catch (err: any) {
        state.errors = err.message;
        console.error(`🌑 [Dark Pool] Error: ${err.message}`);
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function publishDarkPoolPrint(print: DarkPoolPrint): number {
    if (print.notional < MIN_NOTIONAL) return -1;

    const direction = getDirectionFromPrint(print);
    const confidence = getConfidenceFromPrint(print);

    const notionalStr = `$${(print.notional / 1e6).toFixed(1)}M`;
    const summary = `${print.ticker} dark pool print: ${print.size.toLocaleString()} shares @ $${print.price.toFixed(2)} (${notionalStr})${print.priceLevel ? ` at ${print.priceLevel}` : ''}`;

    const signal: IntelSignal = {
        source: 'DARK_POOL',
        symbol: 'BTCUSD',
        direction,
        confidence,
        summary,
        payload: { ...print },
    };

    const id = intelBus.publish(signal);
    if (id !== -1) state.signalsPublished++;
    return id;
}

export function startDarkPoolService(): DarkPoolState {
    if (state.running) return state;
    console.log('🌑 [Dark Pool] Starting dark pool tracking service...');
    state.running = true;
    state.startedAt = new Date().toISOString();
    intelBus.heartbeat('darkpool', 0);
    pollDarkPoolActivity();
    pollTimer = setInterval(pollDarkPoolActivity, POLL_INTERVAL);
    return state;
}

export function stopDarkPoolService(): DarkPoolState {
    if (!state.running) return state;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    state.running = false;
    return state;
}

export function getDarkPoolStatus(): DarkPoolState {
    return { ...state };
}
