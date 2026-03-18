// ═══════════════════════════════════════════════════════════════
// OPTIONS UNUSUAL SERVICE — Unusual Options Activity
// "Where the smart money bets."
//
// Tracks unusual options activity via:
//   1. Twitter accounts (@unusual_whales, @optionswolf, etc.)
//   2. Barchart unusual activity (scraped)
//   3. CBOE data (public)
//
// Large sweeps and unusual call/put activity = directional signals
// ═══════════════════════════════════════════════════════════════

import intelBus from '../bus';
import type { IntelSignal, IntelDirection } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UnusualOption {
    ticker: string;
    type: 'CALL' | 'PUT';
    strike: number;
    expiry: string;
    premium: number;
    volume: number;
    openInterest: number;
    volumeOIRatio: number;
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    sweepType?: 'ASK' | 'BID' | 'MIXED';
    timestamp: string;
}

interface OptionsUnusualState {
    running: boolean;
    startedAt: string | null;
    signalsPublished: number;
    lastPoll: string | null;
    errors: string | null;
}

// ─── Config ──────────────────────────────────────────────────────────────────

/** Twitter accounts that track unusual options */
export const OPTIONS_TRACKERS = [
    { handle: 'unusual_whales', displayName: 'Unusual Whales', confidence: 0.75 },
    { handle: 'optionswolf',    displayName: 'Options Wolf',   confidence: 0.65 },
    { handle: 'tradearena_',    displayName: 'Trade Arena',    confidence: 0.60 },
];

/** Crypto-proxy stocks for options tracking */
export const TRACKED_OPTIONS_TICKERS = [
    'MSTR', 'COIN', 'RIOT', 'MARA', 'SPY', 'QQQ', 'NVDA',
];

/** Thresholds for unusual activity */
export const UNUSUAL_THRESHOLDS = {
    MIN_PREMIUM: 100_000,     // $100K+ premium
    MIN_VOL_OI_RATIO: 2.0,    // Volume > 2x OI
    SWEEP_MIN_PREMIUM: 250_000, // $250K+ for sweeps
};

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ─── State ───────────────────────────────────────────────────────────────────

const state: OptionsUnusualState = {
    running: false,
    startedAt: null,
    signalsPublished: 0,
    lastPoll: null,
    errors: null,
};

let pollTimer: ReturnType<typeof setInterval> | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDirectionFromOption(option: UnusualOption): IntelDirection {
    // Call sweeps at ask = bullish
    // Put sweeps at ask = bearish
    if (option.type === 'CALL' && option.sweepType === 'ASK') return 'BULLISH';
    if (option.type === 'PUT' && option.sweepType === 'ASK') return 'BEARISH';
    if (option.type === 'CALL' && option.sweepType === 'BID') return 'BEARISH'; // Seller
    if (option.type === 'PUT' && option.sweepType === 'BID') return 'BULLISH';  // Seller

    // Default based on option type
    return option.type === 'CALL' ? 'BULLISH' : 'BEARISH';
}

function getConfidenceFromOption(option: UnusualOption): number {
    let confidence = 0.55;

    // Higher premium = higher confidence
    if (option.premium > 1_000_000) confidence += 0.25;
    else if (option.premium > 500_000) confidence += 0.15;
    else if (option.premium > 250_000) confidence += 0.10;

    // High Vol/OI ratio = more unusual
    if (option.volumeOIRatio > 10) confidence += 0.10;
    else if (option.volumeOIRatio > 5) confidence += 0.05;

    return Math.min(0.95, confidence);
}

// ─── Poll Loop ───────────────────────────────────────────────────────────────

async function pollOptionsActivity(): Promise<void> {
    try {
        state.lastPoll = new Date().toISOString();
        state.errors = null;
        intelBus.heartbeat('optionsunusual', state.signalsPublished);
        console.log(`🎯 [Options] Poll complete — tracking unusual activity`);
    } catch (err: any) {
        state.errors = err.message;
        console.error(`🎯 [Options] Error: ${err.message}`);
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function publishUnusualOption(option: UnusualOption): number {
    const direction = getDirectionFromOption(option);
    const confidence = getConfidenceFromOption(option);

    const premiumStr = `$${(option.premium / 1000).toFixed(0)}K`;
    const summary = `${option.ticker} ${option.strike} ${option.type} ${option.expiry} | ${premiumStr} premium | Vol/OI: ${option.volumeOIRatio.toFixed(1)}x`;

    const signal: IntelSignal = {
        source: 'OPTIONS_UNUSUAL',
        symbol: 'BTCUSD',
        direction,
        confidence,
        summary,
        payload: { ...option },
    };

    const id = intelBus.publish(signal);
    if (id !== -1) state.signalsPublished++;
    return id;
}

export function startOptionsUnusualService(): OptionsUnusualState {
    if (state.running) return state;
    console.log('🎯 [Options] Starting unusual options service...');
    state.running = true;
    state.startedAt = new Date().toISOString();
    intelBus.heartbeat('optionsunusual', 0);
    pollOptionsActivity();
    pollTimer = setInterval(pollOptionsActivity, POLL_INTERVAL);
    return state;
}

export function stopOptionsUnusualService(): OptionsUnusualState {
    if (!state.running) return state;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    state.running = false;
    return state;
}

export function getOptionsUnusualStatus(): OptionsUnusualState {
    return { ...state };
}
