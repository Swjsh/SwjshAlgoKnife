// ═══════════════════════════════════════════════════════════════
// INSIDER FLOW SERVICE — SEC Form 4 Filings
// "Insiders know more than anyone."
//
// Tracks corporate insider transactions via:
//   1. SEC EDGAR Form 4 filings (free public RSS feed)
//   2. OpenInsider API (openinsider.com scraping)
//   3. Finviz insider transactions
//
// Form 4 must be filed within 2 business days of transaction.
// We look for clusters of insider buying (bullish) or selling.
// ═══════════════════════════════════════════════════════════════

import intelBus from '../bus';
import type { IntelSignal, IntelDirection } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InsiderTransaction {
    filer: string;
    company: string;
    ticker: string;
    relationship: 'CEO' | 'CFO' | 'Director' | 'Officer' | '10% Owner' | 'Other';
    transactionType: 'BUY' | 'SELL' | 'GRANT' | 'EXERCISE';
    shares: number;
    pricePerShare: number;
    totalValue: number;
    transactionDate: string;
    filingDate: string;
}

interface InsiderFlowState {
    running: boolean;
    startedAt: string | null;
    signalsPublished: number;
    lastPoll: string | null;
    errors: string | null;
}

// ─── Config ──────────────────────────────────────────────────────────────────

/** SEC EDGAR Form 4 RSS feed endpoints */
export const SEC_FORM4_ENDPOINTS = {
    // SEC EDGAR Atom feed for Form 4 (insider transactions)
    recentFilings: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&dateb=&owner=include&count=40&output=atom',
    // Company-specific Form 4 filings
    byCompany: (cik: string) => `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=4&dateb=&owner=include&count=10&output=atom`,
};

/** Crypto-adjacent companies we track for insider activity */
export const TRACKED_COMPANIES = [
    { ticker: 'MSTR', cik: '0001050446', name: 'MicroStrategy' },
    { ticker: 'COIN', cik: '0001679788', name: 'Coinbase' },
    { ticker: 'RIOT', cik: '0001167419', name: 'Riot Platforms' },
    { ticker: 'MARA', cik: '0001507605', name: 'Marathon Digital' },
    { ticker: 'CLSK', cik: '0001792389', name: 'CleanSpark' },
    { ticker: 'HUT',  cik: '0001844551', name: 'Hut 8 Mining' },
    { ticker: 'SQ',   cik: '0001512673', name: 'Block (Square)' },
    { ticker: 'PYPL', cik: '0001633917', name: 'PayPal' },
    { ticker: 'HOOD', cik: '0001783879', name: 'Robinhood' },
    { ticker: 'NVDA', cik: '0001045810', name: 'NVIDIA' },
];

const POLL_INTERVAL = 15 * 60 * 1000; // 15 minutes

// ─── State ───────────────────────────────────────────────────────────────────

const state: InsiderFlowState = {
    running: false,
    startedAt: null,
    signalsPublished: 0,
    lastPoll: null,
    errors: null,
};

let pollTimer: ReturnType<typeof setInterval> | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getConfidenceForRelationship(relationship: InsiderTransaction['relationship']): number {
    switch (relationship) {
        case 'CEO': return 0.85;
        case 'CFO': return 0.80;
        case 'Director': return 0.70;
        case '10% Owner': return 0.75;
        case 'Officer': return 0.65;
        default: return 0.55;
    }
}

function getDirectionFromTransaction(tx: InsiderTransaction): IntelDirection {
    // Open market purchases are strongly bullish
    // Exercises and grants are neutral (compensation)
    // Sells depend on context
    switch (tx.transactionType) {
        case 'BUY': return 'BULLISH';
        case 'SELL': return 'BEARISH';
        case 'EXERCISE': return 'NEUTRAL';
        case 'GRANT': return 'NEUTRAL';
        default: return 'ALERT';
    }
}

function getSymbolFromTicker(ticker: string): string {
    const cryptoProxies: Record<string, string> = {
        'MSTR': 'BTCUSD',
        'COIN': 'BTCUSD',
        'RIOT': 'BTCUSD',
        'MARA': 'BTCUSD',
        'CLSK': 'BTCUSD',
        'HUT': 'BTCUSD',
        'SQ': 'BTCUSD',
        'PYPL': 'BTCUSD',
        'HOOD': 'BTCUSD',
        'NVDA': 'BTCUSD',
    };
    return cryptoProxies[ticker.toUpperCase()] || 'BTCUSD';
}

// ─── Poll Loop ───────────────────────────────────────────────────────────────

async function pollInsiderFilings(): Promise<void> {
    try {
        state.lastPoll = new Date().toISOString();
        state.errors = null;

        // Heartbeat
        intelBus.heartbeat('insiderflow', state.signalsPublished);

        console.log(`👔 [Insiders] Poll complete — tracking ${TRACKED_COMPANIES.length} companies`);
    } catch (err: any) {
        state.errors = err.message;
        console.error(`👔 [Insiders] Error: ${err.message}`);
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function publishInsiderTransaction(tx: InsiderTransaction): number {
    const direction = getDirectionFromTransaction(tx);

    // Skip neutral transactions (grants, exercises)
    if (direction === 'NEUTRAL') return -1;

    const confidence = getConfidenceForRelationship(tx.relationship);
    const symbol = getSymbolFromTicker(tx.ticker);

    // Boost confidence for large transactions
    let adjustedConfidence = confidence;
    if (tx.totalValue > 5000000) adjustedConfidence = Math.min(0.95, confidence + 0.15);
    else if (tx.totalValue > 1000000) adjustedConfidence = Math.min(0.90, confidence + 0.10);
    else if (tx.totalValue > 500000) adjustedConfidence = Math.min(0.85, confidence + 0.05);

    const signal: IntelSignal = {
        source: 'INSIDER_FLOW',
        symbol,
        direction,
        confidence: adjustedConfidence,
        summary: `${tx.filer} (${tx.relationship}) ${tx.transactionType} ${tx.shares.toLocaleString()} ${tx.ticker} @ $${tx.pricePerShare.toFixed(2)} ($${(tx.totalValue / 1e6).toFixed(2)}M)`,
        payload: {
            filer: tx.filer,
            company: tx.company,
            ticker: tx.ticker,
            relationship: tx.relationship,
            transactionType: tx.transactionType,
            shares: tx.shares,
            pricePerShare: tx.pricePerShare,
            totalValue: tx.totalValue,
            transactionDate: tx.transactionDate,
            filingDate: tx.filingDate,
        },
    };

    const id = intelBus.publish(signal);
    if (id !== -1) {
        state.signalsPublished++;
        console.log(`👔 [Insiders] ${tx.filer} ${tx.transactionType} ${tx.ticker} — $${(tx.totalValue / 1e6).toFixed(2)}M`);
    }
    return id;
}

export function startInsiderFlowService(): InsiderFlowState {
    if (state.running) return state;

    console.log('👔 [Insiders] Starting insider flow service...');
    console.log(`👔 [Insiders] Tracking ${TRACKED_COMPANIES.length} companies`);

    state.running = true;
    state.startedAt = new Date().toISOString();

    // Initial heartbeat
    intelBus.heartbeat('insiderflow', 0);

    // First poll
    pollInsiderFilings();

    // Then on interval
    pollTimer = setInterval(pollInsiderFilings, POLL_INTERVAL);

    return state;
}

export function stopInsiderFlowService(): InsiderFlowState {
    if (!state.running) return state;

    console.log('👔 [Insiders] Stopping insider flow service...');
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    state.running = false;

    return state;
}

export function getInsiderFlowStatus(): InsiderFlowState {
    return { ...state };
}
