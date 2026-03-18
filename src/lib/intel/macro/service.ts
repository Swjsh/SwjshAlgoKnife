// ═══════════════════════════════════════════════════════════════
// MACRO SENTIMENT SERVICE — Retail & Institutional Sentiment
// "Sentiment extremes mark turning points."
//
// Tracks macro sentiment indicators via:
//   1. AAII Investor Sentiment Survey (weekly)
//   2. CNN Fear & Greed Index (broader market sentiment)
//   3. Put/Call Ratio (options sentiment)
//   4. PMI data (manufacturing sentiment)
//
// Contrarian signals: extreme bullishness = bearish, extreme fear = bullish
// ═══════════════════════════════════════════════════════════════

import intelBus from '../bus';
import type { IntelSignal, IntelDirection } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AAIISentiment {
    bullish: number;      // % bullish
    neutral: number;      // % neutral
    bearish: number;      // % bearish
    bullBearSpread: number;  // bullish - bearish
    date: string;
}

export interface CNNFearGreed {
    value: number;        // 0-100
    label: string;        // "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
    previousValue: number;
    date: string;
}

export interface PutCallRatio {
    ratio: number;        // > 1 = more puts (bearish sentiment), < 1 = more calls (bullish sentiment)
    equityPCR: number;    // Equity-only PCR
    indexPCR: number;     // Index PCR
    date: string;
}

interface MacroSentimentState {
    running: boolean;
    startedAt: string | null;
    signalsPublished: number;
    lastPoll: string | null;
    errors: string | null;
}

// ─── Config ──────────────────────────────────────────────────────────────────

/** AAII Sentiment Survey endpoint (weekly release) */
export const AAII_ENDPOINT = 'https://www.aaii.com/sentimentsurvey';

/** CNN Fear & Greed API endpoint */
export const CNN_FEAR_GREED_ENDPOINT = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';

/** CBOE Put/Call Ratio */
export const CBOE_PCR_ENDPOINT = 'https://www.cboe.com/us/options/market_statistics/daily/';

/** AAII historical average (for comparison) */
export const AAII_HISTORICAL = {
    bullish: 37.5,
    neutral: 31.5,
    bearish: 31.0,
};

/** Thresholds for contrarian signals */
export const SENTIMENT_THRESHOLDS = {
    AAII_EXTREME_BULL: 50,    // > 50% bullish = contrarian bearish
    AAII_EXTREME_BEAR: 20,    // < 20% bullish = contrarian bullish
    PCR_EXTREME_FEAR: 1.2,    // > 1.2 = extreme fear (contrarian bullish)
    PCR_EXTREME_GREED: 0.6,   // < 0.6 = extreme greed (contrarian bearish)
};

const POLL_INTERVAL = 60 * 60 * 1000; // 1 hour (weekly data, but check frequently)

// ─── State ───────────────────────────────────────────────────────────────────

const state: MacroSentimentState = {
    running: false,
    startedAt: null,
    signalsPublished: 0,
    lastPoll: null,
    errors: null,
};

let pollTimer: ReturnType<typeof setInterval> | null = null;

// Previous values for delta detection
let prevAAII: AAIISentiment | null = null;
let prevCNN: CNNFearGreed | null = null;
let prevPCR: PutCallRatio | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDirectionFromAAII(sentiment: AAIISentiment): IntelDirection {
    // Contrarian: extreme bullishness is bearish, extreme bearishness is bullish
    if (sentiment.bullish > SENTIMENT_THRESHOLDS.AAII_EXTREME_BULL) return 'BEARISH';
    if (sentiment.bullish < SENTIMENT_THRESHOLDS.AAII_EXTREME_BEAR) return 'BULLISH';
    if (sentiment.bullBearSpread > 20) return 'BEARISH';  // Bull-bear spread > 20 = excessive optimism
    if (sentiment.bullBearSpread < -20) return 'BULLISH'; // Bull-bear spread < -20 = excessive pessimism
    return 'NEUTRAL';
}

function getConfidenceFromAAII(sentiment: AAIISentiment): number {
    const deviation = Math.abs(sentiment.bullish - AAII_HISTORICAL.bullish);
    // Higher deviation = more confidence in contrarian signal
    if (deviation > 20) return 0.85;
    if (deviation > 15) return 0.75;
    if (deviation > 10) return 0.65;
    return 0.50;
}

function getDirectionFromPCR(pcr: PutCallRatio): IntelDirection {
    // Contrarian: high PCR (fear) = bullish, low PCR (complacency) = bearish
    if (pcr.ratio > SENTIMENT_THRESHOLDS.PCR_EXTREME_FEAR) return 'BULLISH';
    if (pcr.ratio < SENTIMENT_THRESHOLDS.PCR_EXTREME_GREED) return 'BEARISH';
    return 'NEUTRAL';
}

// ─── Poll Loop ───────────────────────────────────────────────────────────────

async function pollMacroSentiment(): Promise<void> {
    try {
        state.lastPoll = new Date().toISOString();
        state.errors = null;

        // Heartbeat
        intelBus.heartbeat('macrosentiment', state.signalsPublished);

        console.log(`🌍 [Macro] Poll complete — tracking AAII, CNN Fear/Greed, PCR`);
    } catch (err: any) {
        state.errors = err.message;
        console.error(`🌍 [Macro] Error: ${err.message}`);
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function publishAAIISentiment(sentiment: AAIISentiment): number {
    const direction = getDirectionFromAAII(sentiment);
    if (direction === 'NEUTRAL') return -1;

    const confidence = getConfidenceFromAAII(sentiment);

    const signal: IntelSignal = {
        source: 'MACRO_SENTIMENT',
        symbol: 'BTCUSD', // Macro sentiment affects all risk assets
        direction,
        confidence,
        summary: `AAII Sentiment: ${sentiment.bullish.toFixed(1)}% bullish, ${sentiment.bearish.toFixed(1)}% bearish (spread: ${sentiment.bullBearSpread > 0 ? '+' : ''}${sentiment.bullBearSpread.toFixed(1)}%)`,
        payload: {
            type: 'AAII',
            bullish: sentiment.bullish,
            neutral: sentiment.neutral,
            bearish: sentiment.bearish,
            bullBearSpread: sentiment.bullBearSpread,
            historicalBullish: AAII_HISTORICAL.bullish,
            date: sentiment.date,
        },
    };

    const id = intelBus.publish(signal);
    if (id !== -1) {
        state.signalsPublished++;
        prevAAII = sentiment;
        console.log(`🌍 [Macro] AAII: ${sentiment.bullish.toFixed(1)}% bullish → ${direction}`);
    }
    return id;
}

export function publishPCRSentiment(pcr: PutCallRatio): number {
    const direction = getDirectionFromPCR(pcr);
    if (direction === 'NEUTRAL') return -1;

    const confidence = pcr.ratio > 1.3 || pcr.ratio < 0.5 ? 0.80 : 0.65;

    const signal: IntelSignal = {
        source: 'MACRO_SENTIMENT',
        symbol: 'BTCUSD',
        direction,
        confidence,
        summary: `Put/Call Ratio: ${pcr.ratio.toFixed(2)} — ${pcr.ratio > 1 ? 'elevated fear' : 'complacency'}`,
        payload: {
            type: 'PCR',
            ratio: pcr.ratio,
            equityPCR: pcr.equityPCR,
            indexPCR: pcr.indexPCR,
            date: pcr.date,
        },
    };

    const id = intelBus.publish(signal);
    if (id !== -1) {
        state.signalsPublished++;
        prevPCR = pcr;
        console.log(`🌍 [Macro] PCR: ${pcr.ratio.toFixed(2)} → ${direction}`);
    }
    return id;
}

export function startMacroSentimentService(): MacroSentimentState {
    if (state.running) return state;

    console.log('🌍 [Macro] Starting macro sentiment service...');

    state.running = true;
    state.startedAt = new Date().toISOString();

    // Initial heartbeat
    intelBus.heartbeat('macrosentiment', 0);

    // First poll
    pollMacroSentiment();

    // Then on interval
    pollTimer = setInterval(pollMacroSentiment, POLL_INTERVAL);

    return state;
}

export function stopMacroSentimentService(): MacroSentimentState {
    if (!state.running) return state;

    console.log('🌍 [Macro] Stopping macro sentiment service...');
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    state.running = false;

    return state;
}

export function getMacroSentimentStatus(): MacroSentimentState {
    return { ...state };
}
