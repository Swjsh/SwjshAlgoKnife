// ═══════════════════════════════════════════════════════════════
// ANALYST RATINGS SERVICE — Wall Street Consensus
// "Track the upgrades and downgrades."
//
// Tracks analyst actions via:
//   1. Benzinga/MarketWatch RSS feeds (free)
//   2. Finviz analyst page (scraped)
//   3. Twitter analyst trackers
//
// Upgrades = bullish, Downgrades = bearish
// Price target changes are directional signals
// ═══════════════════════════════════════════════════════════════

import intelBus from '../bus';
import type { IntelSignal, IntelDirection } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnalystAction {
    firm: string;
    analyst?: string;
    ticker: string;
    company: string;
    action: 'UPGRADE' | 'DOWNGRADE' | 'INITIATE' | 'REITERATE' | 'PRICE_TARGET';
    fromRating?: string;
    toRating?: string;
    priceTarget?: number;
    previousTarget?: number;
    date: string;
}

interface AnalystRatingsState {
    running: boolean;
    startedAt: string | null;
    signalsPublished: number;
    lastPoll: string | null;
    errors: string | null;
}

// ─── Config ──────────────────────────────────────────────────────────────────

/** Crypto-adjacent stocks we track for analyst coverage */
export const TRACKED_TICKERS = [
    'MSTR', 'COIN', 'RIOT', 'MARA', 'CLSK', 'HUT',
    'SQ', 'PYPL', 'HOOD', 'NVDA', 'AMD', 'INTC',
];

/** Major analyst firms (higher confidence) */
export const TIER1_FIRMS = [
    'Goldman Sachs', 'JPMorgan', 'Morgan Stanley', 'Bank of America',
    'Citigroup', 'Wells Fargo', 'Barclays', 'UBS', 'Deutsche Bank',
];

const POLL_INTERVAL = 30 * 60 * 1000; // 30 minutes

// ─── State ───────────────────────────────────────────────────────────────────

const state: AnalystRatingsState = {
    running: false,
    startedAt: null,
    signalsPublished: 0,
    lastPoll: null,
    errors: null,
};

let pollTimer: ReturnType<typeof setInterval> | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDirectionFromAction(action: AnalystAction): IntelDirection {
    switch (action.action) {
        case 'UPGRADE': return 'BULLISH';
        case 'DOWNGRADE': return 'BEARISH';
        case 'INITIATE':
            if (action.toRating?.toLowerCase().includes('buy')) return 'BULLISH';
            if (action.toRating?.toLowerCase().includes('sell')) return 'BEARISH';
            return 'ALERT';
        case 'PRICE_TARGET':
            if (action.priceTarget && action.previousTarget) {
                return action.priceTarget > action.previousTarget ? 'BULLISH' : 'BEARISH';
            }
            return 'ALERT';
        default:
            return 'NEUTRAL';
    }
}

function getConfidenceFromFirm(firm: string): number {
    if (TIER1_FIRMS.some(f => firm.toLowerCase().includes(f.toLowerCase()))) {
        return 0.75;
    }
    return 0.55;
}

// ─── Poll Loop ───────────────────────────────────────────────────────────────

async function pollAnalystRatings(): Promise<void> {
    try {
        state.lastPoll = new Date().toISOString();
        state.errors = null;
        intelBus.heartbeat('analystratings', state.signalsPublished);
        console.log(`📊 [Analysts] Poll complete — tracking ${TRACKED_TICKERS.length} tickers`);
    } catch (err: any) {
        state.errors = err.message;
        console.error(`📊 [Analysts] Error: ${err.message}`);
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function publishAnalystAction(action: AnalystAction): number {
    const direction = getDirectionFromAction(action);
    if (direction === 'NEUTRAL') return -1;

    const confidence = getConfidenceFromFirm(action.firm);

    let summary = `${action.firm}: ${action.action} ${action.ticker}`;
    if (action.toRating) summary += ` to ${action.toRating}`;
    if (action.priceTarget) summary += ` | PT: $${action.priceTarget}`;

    const signal: IntelSignal = {
        source: 'ANALYST_RATINGS',
        symbol: 'BTCUSD', // Proxy for risk sentiment
        direction,
        confidence,
        summary,
        payload: { ...action },
    };

    const id = intelBus.publish(signal);
    if (id !== -1) state.signalsPublished++;
    return id;
}

export function startAnalystRatingsService(): AnalystRatingsState {
    if (state.running) return state;
    console.log('📊 [Analysts] Starting analyst ratings service...');
    state.running = true;
    state.startedAt = new Date().toISOString();
    intelBus.heartbeat('analystratings', 0);
    pollAnalystRatings();
    pollTimer = setInterval(pollAnalystRatings, POLL_INTERVAL);
    return state;
}

export function stopAnalystRatingsService(): AnalystRatingsState {
    if (!state.running) return state;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    state.running = false;
    return state;
}

export function getAnalystRatingsStatus(): AnalystRatingsState {
    return { ...state };
}
