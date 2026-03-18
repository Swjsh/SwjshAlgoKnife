// ═══════════════════════════════════════════════════════════════
// VOLATILITY SERVICE — VIX & Volatility Regime Tracking
// "Volatility is the market's heartbeat."
//
// Tracks volatility indicators via:
//   1. VIX (CBOE Volatility Index) via Yahoo Finance
//   2. VIX futures term structure (contango/backwardation)
//   3. BTC Realized Volatility (from price data)
//   4. DVOL (Deribit BTC Volatility Index)
//
// Low VIX + rising = complacency ending (bearish)
// High VIX + falling = fear subsiding (bullish)
// ═══════════════════════════════════════════════════════════════

import intelBus from '../bus';
import type { IntelSignal, IntelDirection } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VIXData {
    value: number;        // Current VIX value
    previousClose: number;
    change: number;       // Daily change
    changePercent: number;
    high52Week: number;
    low52Week: number;
    timestamp: string;
}

export interface VolatilityRegime {
    regime: 'EXTREME_FEAR' | 'HIGH_FEAR' | 'ELEVATED' | 'NORMAL' | 'LOW' | 'EXTREME_LOW';
    vix: number;
    percentile: number;   // Where current VIX sits in historical distribution
}

interface VolatilityState {
    running: boolean;
    startedAt: string | null;
    signalsPublished: number;
    lastPoll: string | null;
    errors: string | null;
    currentRegime: VolatilityRegime | null;
}

// ─── Config ──────────────────────────────────────────────────────────────────

/** VIX level thresholds for regime classification */
export const VIX_THRESHOLDS = {
    LOW: 12,              // < 12 = extreme complacency (contrarian bearish)
    MEDIUM: 18,           // 12-18 = normal
    HIGH: 25,             // 18-25 = elevated
    EXTREME: 35,          // 25-35 = high fear
    PANIC: 45,            // > 45 = extreme fear/panic (contrarian bullish)
};

/** Yahoo Finance endpoint for VIX data */
const YAHOO_VIX_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d';

/** Deribit DVOL API (BTC implied volatility) */
const DERIBIT_DVOL_URL = 'https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=BTC&resolution=3600&start_timestamp=';

const POLL_INTERVAL = 15 * 60 * 1000; // 15 minutes

// ─── State ───────────────────────────────────────────────────────────────────

const state: VolatilityState = {
    running: false,
    startedAt: null,
    signalsPublished: 0,
    lastPoll: null,
    errors: null,
    currentRegime: null,
};

let pollTimer: ReturnType<typeof setInterval> | null = null;

// Previous values for delta detection
let prevVIX: VIXData | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function safeFetch(url: string, timeoutMs = 10000): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'SwjshAK-Intel/1.0 (Trading Research)',
            },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

function classifyRegime(vix: number): VolatilityRegime['regime'] {
    if (vix < VIX_THRESHOLDS.LOW) return 'EXTREME_LOW';
    if (vix < VIX_THRESHOLDS.MEDIUM) return 'LOW';
    if (vix < VIX_THRESHOLDS.HIGH) return 'NORMAL';
    if (vix < VIX_THRESHOLDS.EXTREME) return 'ELEVATED';
    if (vix < VIX_THRESHOLDS.PANIC) return 'HIGH_FEAR';
    return 'EXTREME_FEAR';
}

function getDirectionFromVIX(vix: VIXData, prevVix: VIXData | null): IntelDirection {
    const regime = classifyRegime(vix.value);

    // Extreme levels are contrarian signals
    if (regime === 'EXTREME_FEAR') return 'BULLISH';      // Panic = buying opportunity
    if (regime === 'EXTREME_LOW') return 'BEARISH';       // Complacency = danger

    // VIX spike detection
    if (vix.changePercent > 20) return 'ALERT';           // Big spike = volatility event
    if (vix.changePercent > 15 && vix.value > VIX_THRESHOLDS.HIGH) return 'BEARISH';

    // Regime transitions
    if (prevVix) {
        const prevRegime = classifyRegime(prevVix.value);
        if (regime === 'HIGH_FEAR' && prevRegime !== 'HIGH_FEAR' && prevRegime !== 'EXTREME_FEAR') {
            return 'BEARISH'; // Transition to fear
        }
        if (prevRegime === 'HIGH_FEAR' && regime === 'ELEVATED') {
            return 'BULLISH'; // Fear subsiding
        }
    }

    return 'NEUTRAL';
}

function getConfidenceFromVIX(vix: VIXData): number {
    const regime = classifyRegime(vix.value);

    // Extreme readings have high confidence as contrarian signals
    if (regime === 'EXTREME_FEAR' || regime === 'EXTREME_LOW') return 0.85;
    if (regime === 'HIGH_FEAR') return 0.75;

    // Large moves have moderate confidence
    if (Math.abs(vix.changePercent) > 15) return 0.70;
    if (Math.abs(vix.changePercent) > 10) return 0.60;

    return 0.50;
}

// ─── Poll Loop ───────────────────────────────────────────────────────────────

async function pollVolatility(): Promise<void> {
    try {
        // Fetch VIX data from Yahoo Finance
        const data = await safeFetch(YAHOO_VIX_URL);

        if (data?.chart?.result?.[0]) {
            const result = data.chart.result[0];
            const meta = result.meta;
            const quote = result.indicators?.quote?.[0];

            if (meta && quote) {
                const latestIdx = quote.close.length - 1;
                const prevIdx = latestIdx > 0 ? latestIdx - 1 : 0;

                const vixData: VIXData = {
                    value: meta.regularMarketPrice || quote.close[latestIdx],
                    previousClose: quote.close[prevIdx] || meta.previousClose,
                    change: meta.regularMarketPrice - (quote.close[prevIdx] || meta.previousClose),
                    changePercent: ((meta.regularMarketPrice / (quote.close[prevIdx] || meta.previousClose)) - 1) * 100,
                    high52Week: meta.fiftyTwoWeekHigh || 0,
                    low52Week: meta.fiftyTwoWeekLow || 0,
                    timestamp: new Date().toISOString(),
                };

                publishVIXSignal(vixData);
                prevVIX = vixData;

                // Update current regime
                state.currentRegime = {
                    regime: classifyRegime(vixData.value),
                    vix: vixData.value,
                    percentile: 0, // Would need historical data for percentile
                };
            }
        }

        state.lastPoll = new Date().toISOString();
        state.errors = null;

        // Heartbeat
        intelBus.heartbeat('volatility', state.signalsPublished);

        console.log(`📈 [Volatility] VIX: ${state.currentRegime?.vix?.toFixed(2) || 'N/A'} (${state.currentRegime?.regime || 'UNKNOWN'})`);
    } catch (err: any) {
        state.errors = err.message;
        console.error(`📈 [Volatility] Error: ${err.message}`);
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function publishVIXSignal(vix: VIXData): number {
    const direction = getDirectionFromVIX(vix, prevVIX);
    if (direction === 'NEUTRAL') return -1;

    const confidence = getConfidenceFromVIX(vix);
    const regime = classifyRegime(vix.value);

    const changeStr = vix.change >= 0
        ? `+${vix.change.toFixed(2)} (+${vix.changePercent.toFixed(1)}%)`
        : `${vix.change.toFixed(2)} (${vix.changePercent.toFixed(1)}%)`;

    const signal: IntelSignal = {
        source: 'VOLATILITY',
        symbol: 'BTCUSD', // VIX affects all risk assets
        direction,
        confidence,
        summary: `VIX ${vix.value.toFixed(2)} ${changeStr} — ${regime.replace('_', ' ')}`,
        payload: {
            vix: vix.value,
            previousClose: vix.previousClose,
            change: vix.change,
            changePercent: vix.changePercent,
            regime,
            high52Week: vix.high52Week,
            low52Week: vix.low52Week,
            timestamp: vix.timestamp,
        },
    };

    const id = intelBus.publish(signal);
    if (id !== -1) {
        state.signalsPublished++;
    }
    return id;
}

export function startVolatilityService(): VolatilityState {
    if (state.running) return state;

    console.log('📈 [Volatility] Starting volatility tracking service...');

    state.running = true;
    state.startedAt = new Date().toISOString();

    // Initial heartbeat
    intelBus.heartbeat('volatility', 0);

    // First poll
    pollVolatility();

    // Then on interval
    pollTimer = setInterval(pollVolatility, POLL_INTERVAL);

    return state;
}

export function stopVolatilityService(): VolatilityState {
    if (!state.running) return state;

    console.log('📈 [Volatility] Stopping volatility service...');
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    state.running = false;

    return state;
}

export function getVolatilityStatus(): VolatilityState {
    return { ...state };
}

export function getCurrentRegime(): VolatilityRegime | null {
    return state.currentRegime;
}
