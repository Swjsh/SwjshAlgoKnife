// ═══════════════════════════════════════════════════════════════
// FREE INTEL FEEDS — Zero-cost market intelligence
// "Knowledge is free. Ignorance costs everything."
//
// Polls publicly available APIs with no API keys required:
//   1. Fear & Greed Index   (alternative.me)
//   2. Funding Rates + OI   (Binance public API)
//   3. Market Data           (CoinGecko free tier)
//   4. Economic Calendar     (static schedule + heuristics)
//
// Auto-starts when the Intel page loads. All data is free.
// ═══════════════════════════════════════════════════════════════

import intelBus from '../bus';
import type { IntelSignal, IntelDirection } from '../types';
import { startSocialFeed, stopSocialFeed, getSocialFeedStatus } from './social';
import { startCalendarEngine, stopCalendarEngine, getCalendarState } from '../econ/calendar';

// ─── State ───────────────────────────────────────────────────────────────────

interface FeedState {
    running: boolean;
    startedAt: string | null;
    signalsPublished: number;
    /** Per-source signal counts for accurate heartbeat reporting */
    perSourceCount: Record<string, number>;
    lastPoll: Record<string, string | null>;
    errors: Record<string, string | null>;
}

const state: FeedState = {
    running: false,
    startedAt: null,
    signalsPublished: 0,
    perSourceCount: {
        // Original sources
        feargreed: 0,
        fundingoi: 0,
        marketdata: 0,
        econcalendar: 0,
        socialfeed: 0,
        // New sources (9 additional pillars)
        politiciantrades: 0,
        insiderflow: 0,
        analystratings: 0,
        etfflows: 0,
        optionsunusual: 0,
        darkpool: 0,
        macrosentiment: 0,
        technicallevels: 0,
        volatility: 0,
    },
    lastPoll: {},
    errors: {},
};

let pollTimers: ReturnType<typeof setInterval>[] = [];
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

// Previous values for delta detection
let prevFearGreed: number | null = null;
let prevFundingRates: Record<string, number> = {};
let prevOpenInterest: Record<string, number> = {};
let prevPrices: Record<string, number> = {};
let prevVolumes: Record<string, number> = {};

// ─── Config ──────────────────────────────────────────────────────────────────

const BINANCE_SYMBOLS = ['BTCUSDT', 'ETHUSDT'];
const COINGECKO_IDS = ['bitcoin', 'ethereum'];
const SYMBOL_MAP: Record<string, string> = {
    BTCUSDT: 'BTCUSD',
    ETHUSDT: 'ETHUSD',
    bitcoin: 'BTCUSD',
    ethereum: 'ETHUSD',
};

// Poll intervals (ms)
const FEAR_GREED_INTERVAL = 5 * 60 * 1000;    // 5 min (data updates daily but we check)
const FUNDING_OI_INTERVAL = 3 * 60 * 1000;    // 3 min
const MARKET_DATA_INTERVAL = 2 * 60 * 1000;   // 2 min
const ECON_CAL_INTERVAL = 15 * 60 * 1000;     // 15 min

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function safeFetch(url: string, timeoutMs = 10000): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

/** Map IntelSource to heartbeat key for per-source counting */
const SOURCE_TO_HB: Record<string, string> = {
    FEAR_GREED: 'feargreed',
    FUNDING_OI: 'fundingoi',
    MARKET_DATA: 'marketdata',
    ECON_CALENDAR: 'econcalendar',
    SOCIAL_FEED: 'socialfeed',
};

function publish(signal: Omit<IntelSignal, 'id' | 'timestamp' | 'expiresAt'>): void {
    const id = intelBus.publish(signal as IntelSignal);
    if (id !== -1) {
        // Only count if bus didn't dedup it
        state.signalsPublished++;
        const hbKey = SOURCE_TO_HB[signal.source];
        if (hbKey) state.perSourceCount[hbKey] = (state.perSourceCount[hbKey] || 0) + 1;
    }
}

// ─── 1. Fear & Greed Index ───────────────────────────────────────────────────

async function pollFearGreed(): Promise<void> {
    try {
        // alternative.me free API — no key needed
        const data = await safeFetch('https://api.alternative.me/fng/?limit=2&format=json');
        if (!data?.data?.[0]) return;

        const current = parseInt(data.data[0].value);
        const previous = data.data[1] ? parseInt(data.data[1].value) : current;
        const label = data.data[0].value_classification; // e.g. "Extreme Fear", "Greed"

        state.lastPoll.fearGreed = new Date().toISOString();
        state.errors.fearGreed = null;

        // Determine direction based on value
        // 0-25: Extreme Fear (contrarian bullish), 25-45: Fear, 45-55: Neutral,
        // 55-75: Greed, 75-100: Extreme Greed (contrarian bearish)
        let direction: IntelDirection;
        let confidence: number;
        let summary: string;

        if (current <= 20) {
            direction = 'BULLISH';
            confidence = 0.75 + (20 - current) / 80;  // 0.75-1.0
            summary = `Extreme Fear (${current}) — historically a buying zone. "${label}"`;
        } else if (current <= 35) {
            direction = 'BULLISH';
            confidence = 0.5 + (35 - current) / 60;
            summary = `Fear zone (${current}) — leaning contrarian bullish. "${label}"`;
        } else if (current <= 55) {
            direction = 'NEUTRAL';
            confidence = 0.3;
            summary = `Neutral sentiment (${current}). "${label}"`;
        } else if (current <= 75) {
            direction = 'BEARISH';
            confidence = 0.4 + (current - 55) / 80;
            summary = `Greed zone (${current}) — elevated risk. "${label}"`;
        } else {
            direction = 'BEARISH';
            confidence = 0.7 + (current - 75) / 100;
            summary = `Extreme Greed (${current}) — historically a danger zone. "${label}"`;
        }

        // Add momentum context if we have previous data
        const delta = current - previous;
        if (Math.abs(delta) >= 5) {
            summary += ` (${delta > 0 ? '↑' : '↓'}${Math.abs(delta)} from yesterday)`;
        }

        confidence = Math.min(0.95, Math.max(0.1, confidence));

        // Only publish if value changed significantly or first run
        if (prevFearGreed === null || Math.abs(current - prevFearGreed) >= 3) {
            publish({
                source: 'FEAR_GREED',
                symbol: 'BTCUSD',
                direction,
                confidence,
                summary,
                payload: { value: current, previous, label, delta },
            });

            // Also publish for ETH (correlated)
            publish({
                source: 'FEAR_GREED',
                symbol: 'ETHUSD',
                direction,
                confidence: confidence * 0.9, // slightly less confident for alts
                summary: `Crypto F&G: ${current} (${label}) — ETH correlated`,
                payload: { value: current, previous, label, delta },
            });

            prevFearGreed = current;
        }

        console.log(`😨 [Free Intel] Fear & Greed: ${current} (${label})`);
    } catch (err: any) {
        state.errors.fearGreed = err.message;
        console.error(`😨 [Free Intel] Fear & Greed error: ${err.message}`);
    }
}

// ─── 2. Funding Rates + Open Interest ────────────────────────────────────────

async function pollFundingRates(): Promise<void> {
    try {
        for (const symbol of BINANCE_SYMBOLS) {
            const ourSymbol = SYMBOL_MAP[symbol];

            // Funding Rate — last entry
            const fundingData = await safeFetch(
                `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`
            );

            if (fundingData?.[0]) {
                const rate = parseFloat(fundingData[0].fundingRate);
                const ratePct = rate * 100;
                const prevRate = prevFundingRates[symbol] ?? null;

                // Funding rate interpretation:
                // Positive = longs pay shorts (market overleveraged long → bearish)
                // Negative = shorts pay longs (market overleveraged short → bullish)
                // Extreme: > 0.05% or < -0.05%
                let direction: IntelDirection;
                let confidence: number;
                let summary: string;

                if (rate > 0.001) {
                    direction = 'BEARISH';
                    confidence = Math.min(0.85, 0.4 + Math.abs(rate) * 300);
                    summary = `${symbol} funding +${ratePct.toFixed(4)}% — longs overleveraged, pay shorts`;
                } else if (rate > 0.0003) {
                    direction = 'BEARISH';
                    confidence = 0.35;
                    summary = `${symbol} funding +${ratePct.toFixed(4)}% — slightly long-heavy`;
                } else if (rate < -0.001) {
                    direction = 'BULLISH';
                    confidence = Math.min(0.85, 0.4 + Math.abs(rate) * 300);
                    summary = `${symbol} funding ${ratePct.toFixed(4)}% — shorts overleveraged, pay longs`;
                } else if (rate < -0.0003) {
                    direction = 'BULLISH';
                    confidence = 0.35;
                    summary = `${symbol} funding ${ratePct.toFixed(4)}% — slightly short-heavy`;
                } else {
                    direction = 'NEUTRAL';
                    confidence = 0.2;
                    summary = `${symbol} funding ${ratePct.toFixed(4)}% — balanced positioning`;
                }

                // Detect rate flips
                if (prevRate !== null) {
                    if ((prevRate > 0 && rate < 0) || (prevRate < 0 && rate > 0)) {
                        confidence = Math.min(0.9, confidence + 0.2);
                        summary += ' ⚡ RATE FLIPPED';
                    }
                }

                publish({
                    source: 'FUNDING_OI',
                    symbol: ourSymbol,
                    direction,
                    confidence,
                    summary,
                    payload: { fundingRate: rate, ratePct, previousRate: prevRate },
                });

                prevFundingRates[symbol] = rate;
            }

            // Open Interest
            const oiData = await safeFetch(
                `https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`
            );

            if (oiData?.openInterest) {
                const oi = parseFloat(oiData.openInterest);
                const prevOI = prevOpenInterest[symbol] ?? null;

                if (prevOI !== null && prevOI > 0) {
                    const oiChangePct = ((oi - prevOI) / prevOI) * 100;

                    // Significant OI changes (2%+ shift)
                    if (Math.abs(oiChangePct) >= 2) {
                        // Rising OI = new positions entering, falling OI = liquidations/closes
                        const direction: IntelDirection = Math.abs(oiChangePct) >= 8 ? (oiChangePct < 0 ? 'BEARISH' : 'BULLISH') : 'ALERT';
                        const confidence = Math.min(0.8, 0.3 + Math.abs(oiChangePct) / 20);

                        publish({
                            source: 'FUNDING_OI',
                            symbol: ourSymbol,
                            direction,
                            confidence,
                            summary: `${symbol} OI ${oiChangePct > 0 ? '↑' : '↓'}${Math.abs(oiChangePct).toFixed(1)}% — ${oiChangePct > 0 ? 'new positions opening' : 'positions closing/liquidating'}`,
                            payload: { openInterest: oi, previousOI: prevOI, changePct: oiChangePct },
                        });
                    }
                }

                prevOpenInterest[symbol] = oi;
            }

            // Rate limit between Binance calls
            await new Promise(r => setTimeout(r, 200));
        }

        state.lastPoll.fundingOI = new Date().toISOString();
        state.errors.fundingOI = null;
        console.log(`💰 [Free Intel] Funding rates & OI updated`);
    } catch (err: any) {
        state.errors.fundingOI = err.message;
        console.error(`💰 [Free Intel] Funding/OI error: ${err.message}`);
    }
}

// ─── 3. Market Data (CoinGecko) ──────────────────────────────────────────────

async function pollMarketData(): Promise<void> {
    try {
        const ids = COINGECKO_IDS.join(',');
        const data = await safeFetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_market_cap=true`
        );

        if (!data) return;

        for (const id of COINGECKO_IDS) {
            const coin = data[id];
            if (!coin) continue;

            const symbol = SYMBOL_MAP[id];
            const price = coin.usd;
            const change24h = coin.usd_24h_change ?? 0;
            const volume = coin.usd_24h_vol ?? 0;
            const marketCap = coin.usd_market_cap ?? 0;

            const prevPrice = prevPrices[id] ?? null;
            const prevVol = prevVolumes[id] ?? null;

            // Price momentum signal
            let direction: IntelDirection;
            let confidence: number;
            let summary: string;

            if (change24h > 5) {
                direction = 'BULLISH';
                confidence = Math.min(0.8, 0.4 + change24h / 30);
                summary = `${id.toUpperCase()} +${change24h.toFixed(1)}% (24h) — strong momentum at $${price.toLocaleString()}`;
            } else if (change24h > 2) {
                direction = 'BULLISH';
                confidence = 0.35 + change24h / 20;
                summary = `${id.toUpperCase()} +${change24h.toFixed(1)}% (24h) — positive at $${price.toLocaleString()}`;
            } else if (change24h < -5) {
                direction = 'BEARISH';
                confidence = Math.min(0.8, 0.4 + Math.abs(change24h) / 30);
                summary = `${id.toUpperCase()} ${change24h.toFixed(1)}% (24h) — heavy selling at $${price.toLocaleString()}`;
            } else if (change24h < -2) {
                direction = 'BEARISH';
                confidence = 0.35 + Math.abs(change24h) / 20;
                summary = `${id.toUpperCase()} ${change24h.toFixed(1)}% (24h) — selling pressure at $${price.toLocaleString()}`;
            } else {
                direction = 'NEUTRAL';
                confidence = 0.2;
                summary = `${id.toUpperCase()} ${change24h >= 0 ? '+' : ''}${change24h.toFixed(1)}% (24h) — ranging at $${price.toLocaleString()}`;
            }

            publish({
                source: 'MARKET_DATA',
                symbol,
                direction,
                confidence: Math.min(0.9, Math.max(0.1, confidence)),
                summary,
                payload: {
                    price,
                    change24h,
                    volume24h: volume,
                    marketCap,
                },
            });

            // Volume spike detection
            if (prevVol !== null && prevVol > 0) {
                const volRatio = volume / prevVol;
                if (volRatio > 1.5) {
                    publish({
                        source: 'MARKET_DATA',
                        symbol,
                        direction: 'ALERT',
                        confidence: Math.min(0.85, 0.4 + (volRatio - 1) * 0.3),
                        summary: `${id.toUpperCase()} volume spike: ${volRatio.toFixed(1)}x average — $${(volume / 1e9).toFixed(1)}B (24h)`,
                        payload: { volume24h: volume, previousVolume: prevVol, volumeRatio: volRatio },
                    });
                }
            }

            prevPrices[id] = price;
            prevVolumes[id] = volume;
        }

        // BTC Dominance (global data)
        try {
            const globalData = await safeFetch('https://api.coingecko.com/api/v3/global');
            if (globalData?.data?.market_cap_percentage?.btc) {
                const btcDom = globalData.data.market_cap_percentage.btc;
                const ethDom = globalData.data.market_cap_percentage.eth || 0;
                const totalMcap = globalData.data.total_market_cap?.usd || 0;
                const mcapChange = globalData.data.market_cap_change_percentage_24h_usd || 0;

                // BTC dominance rising = capital flowing to BTC (risk-off in crypto)
                // BTC dominance falling = capital flowing to alts (risk-on)
                let domDirection: IntelDirection = 'NEUTRAL';
                let domConfidence = 0.25;
                let domSummary = `BTC dominance: ${btcDom.toFixed(1)}% | ETH: ${ethDom.toFixed(1)}% | Total MCap: $${(totalMcap / 1e12).toFixed(2)}T`;

                if (btcDom > 60) {
                    domDirection = 'BEARISH';
                    domConfidence = 0.4;
                    domSummary += ' — high BTC dominance, alt weakness';
                } else if (btcDom < 45) {
                    domDirection = 'BULLISH';
                    domConfidence = 0.4;
                    domSummary += ' — alt season signal, risk-on';
                }

                if (Math.abs(mcapChange) > 3) {
                    domSummary += ` | Total MCap ${mcapChange > 0 ? '↑' : '↓'}${Math.abs(mcapChange).toFixed(1)}%`;
                }

                publish({
                    source: 'MARKET_DATA',
                    symbol: 'BTCUSD',
                    direction: domDirection,
                    confidence: domConfidence,
                    summary: domSummary,
                    payload: { btcDominance: btcDom, ethDominance: ethDom, totalMarketCap: totalMcap, mcapChange24h: mcapChange },
                });
            }
        } catch {
            // Global endpoint sometimes rate-limits — non-critical
        }

        state.lastPoll.marketData = new Date().toISOString();
        state.errors.marketData = null;
        console.log(`📈 [Free Intel] Market data updated`);
    } catch (err: any) {
        state.errors.marketData = err.message;
        console.error(`📈 [Free Intel] Market data error: ${err.message}`);
    }
}

// ─── 4. Economic Calendar ────────────────────────────────────────────────────
// Delegated to the full EconCalendarEngine in src/lib/intel/econ/calendar.ts
// That engine fetches live data from ForexFactory and publishes pre/post-event
// signals to the Intel Bus directly. We just start/stop it here and sync stats.

function syncEconCalendarStats(): void {
    try {
        const calState = getCalendarState();
        state.lastPoll.econCalendar = new Date().toISOString();
        state.errors.econCalendar = null;
        // Update per-source count with how many calendar signals are active
        state.perSourceCount.econcalendar = calState.activeWindows.length;
        console.log(`📅 [Free Intel] EconCal sync — ${calState.todayEvents.length} events today, ${calState.activeWindows.length} active windows`);
    } catch (err: any) {
        state.errors.econCalendar = err.message;
        console.error(`📅 [Free Intel] EconCal sync error: ${err.message}`);
    }
}

// ─── Service Control ─────────────────────────────────────────────────────────

export function startFreeFeeds(): FeedState {
    if (state.running) return state;

    console.log('🆓 [Free Intel] Starting free intelligence feeds...');
    state.running = true;
    state.startedAt = new Date().toISOString();

    // Run all feeds immediately on start
    pollFearGreed();
    pollFundingRates();
    pollMarketData();

    // Start the full economic calendar engine (fetches ForexFactory, publishes pre/post-event signals)
    startCalendarEngine().catch(err => console.error('[FreeFeeds] Calendar engine error:', err));

    // Set up intervals for the simpler feeds
    pollTimers.push(setInterval(pollFearGreed, FEAR_GREED_INTERVAL));
    pollTimers.push(setInterval(pollFundingRates, FUNDING_OI_INTERVAL));
    pollTimers.push(setInterval(pollMarketData, MARKET_DATA_INTERVAL));
    pollTimers.push(setInterval(syncEconCalendarStats, ECON_CAL_INTERVAL));

    // Heartbeats for all free feed services — per-source counts
    heartbeatTimer = setInterval(() => {
        intelBus.heartbeat('feargreed', state.perSourceCount.feargreed || 0);
        intelBus.heartbeat('fundingoi', state.perSourceCount.fundingoi || 0);
        intelBus.heartbeat('marketdata', state.perSourceCount.marketdata || 0);
        intelBus.heartbeat('econcalendar', state.perSourceCount.econcalendar || 0);
    }, 60 * 1000);

    // Initial heartbeats
    intelBus.heartbeat('feargreed', 0);
    intelBus.heartbeat('fundingoi', 0);
    intelBus.heartbeat('marketdata', 0);
    intelBus.heartbeat('econcalendar', 0);
    // Sync calendar stats after a short delay to let the engine initialize
    setTimeout(syncEconCalendarStats, 3000);

    // Start social feed (separate module with its own polling)
    startSocialFeed();

    return state;
}

export function stopFreeFeeds(): FeedState {
    if (!state.running) return state;

    console.log('🆓 [Free Intel] Stopping free intelligence feeds...');
    pollTimers.forEach(t => clearInterval(t));
    pollTimers = [];
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    state.running = false;

    // Stop social feed and calendar engine
    stopSocialFeed();
    stopCalendarEngine();

    return state;
}

export function getFreeFeedStatus(): FeedState & { social: ReturnType<typeof getSocialFeedStatus> } {
    return { ...state, social: getSocialFeedStatus() };
}

// Re-export social feed utilities for direct access
export { getSocialFeedStatus, getSocialAccounts } from './social';
