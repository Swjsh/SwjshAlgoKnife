// ═══════════════════════════════════════════════════════════════
// ECONOMIC CALENDAR ENGINE
// "Never get caught flat-footed by a scheduled shock."
//
// Live event awareness system:
//   1. Fetches real weekly calendar from ForexFactory JSON API
//   2. Classifies events → categories, symbols, impact
//   3. Publishes pre-event / live / post-event alerts to IntelBus
//   4. Exposes CalendarState for UI and trade gating
//   5. Falls back to heuristic schedule when API is unavailable
//
// Blackout zones by impact:
//   HIGH   — 30 min before, 45 min after
//   MEDIUM — 10 min before, 20 min after
//   LOW    —  5 min before, 10 min after
// ═══════════════════════════════════════════════════════════════

import intelBus from '../bus';
import type { IntelSignal, IntelDirection } from '../types';
import type {
    EconEvent, EventWindow, CalendarState, FFEvent,
    EventImpact, WindowPhase, TradingRecommendation, RiskLevel,
} from './types';
import { IMPACT_CONFIG } from './types';
import {
    classifyEvent, getAffectedSymbols, getAffectedMarkets,
    normalizeCountry, normalizeImpact,
} from './symbolMap';
import * as crypto from 'crypto';

// ─── Config ───────────────────────────────────────────────────────────────────

const FF_API_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const FETCH_INTERVAL_MS = 6 * 60 * 60 * 1000;   // Refresh weekly calendar every 6 hours
const CHECK_INTERVAL_MS = 2 * 60 * 1000;          // Check event windows every 2 min
const CACHE_TTL_MS       = 8 * 60 * 60 * 1000;   // Cache valid for 8 hours

// Signals are published once per phase transition per event
// Track which (eventId + phase) combos have been published
const publishedPhases = new Map<string, number>(); // key → unix timestamp of publish

// ─── State ────────────────────────────────────────────────────────────────────

let cachedState: CalendarState = {
    weekEvents: [],
    todayEvents: [],
    upcomingEvents: [],
    activeWindows: [],
    nextEvent: null,
    minutesUntilNext: Infinity,
    lastFetched: null,
    source: 'FALLBACK',
    overallRecommendation: 'NORMAL',
};

let fetchTimer: ReturnType<typeof setInterval> | null = null;
let checkTimer:  ReturnType<typeof setInterval> | null = null;
let isRunning = false;

// ─── Event ID ─────────────────────────────────────────────────────────────────

function makeEventId(title: string, country: string, scheduledAt: string): string {
    return crypto.createHash('md5').update(`${title}:${country}:${scheduledAt}`).digest('hex').slice(0, 12);
}

// ─── ForexFactory Fetch ───────────────────────────────────────────────────────

async function fetchWeeklyCalendar(): Promise<EconEvent[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    try {
        const res = await fetch(FF_API_URL, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rawEvents: FFEvent[] = await res.json();

        const events: EconEvent[] = [];
        for (const raw of rawEvents) {
            // Skip non-economic / Holiday entries if they carry no tradable impact
            const impact = normalizeImpact(raw.impact);
            if (impact === 'HOLIDAY') continue;

            const country = normalizeCountry(raw.country);
            if (country === 'OTHER') continue; // Skip exotic currencies we don't trade

            const classification = classifyEvent(raw.title);
            const symbols = getAffectedSymbols(raw.country, classification.symbolOverride);
            const markets = getAffectedMarkets(raw.country);
            const cfg = IMPACT_CONFIG[impact];

            // Parse date — FF sends ISO8601 with timezone offset
            const scheduledAt = new Date(raw.date).toISOString();

            events.push({
                id: makeEventId(raw.title, raw.country, scheduledAt),
                title: raw.title,
                shortTitle: classification.shortTitle,
                country,
                scheduledAt,
                impact,
                forecast: raw.forecast || null,
                previous: raw.previous || null,
                actual: raw.actual || null,
                source: 'FOREXFACTORY',
                affectedSymbols: symbols,
                affectedMarkets: markets,
                category: classification.category,
                blackoutBeforeMin: cfg.blackoutBeforeMin,
                blackoutAfterMin:  cfg.blackoutAfterMin,
            });
        }

        console.log(`📅 [EconCal] Fetched ${events.length} events from ForexFactory`);
        return events;
    } finally {
        clearTimeout(timer);
    }
}

// ─── Fallback Heuristics ──────────────────────────────────────────────────────
// When ForexFactory API is unavailable, generate events from known patterns.

function generateHeuristicEvents(): EconEvent[] {
    const now = new Date();
    const events: EconEvent[] = [];

    const addEvent = (
        title: string, shortTitle: string, country: string,
        impact: EventImpact, scheduledAtUTC: Date,
        category: import('./types').EventCategory, symbols?: string[]
    ) => {
        const imp = impact;
        const cfg = IMPACT_CONFIG[imp];
        const norm = normalizeCountry(country);
        const classif = classifyEvent(title);
        const sym = symbols ?? getAffectedSymbols(country, classif.symbolOverride);
        events.push({
            id: makeEventId(title, country, scheduledAtUTC.toISOString()),
            title, shortTitle,
            country: norm,
            scheduledAt: scheduledAtUTC.toISOString(),
            impact,
            forecast: null, previous: null, actual: null,
            source: 'STATIC',
            affectedSymbols: sym,
            affectedMarkets: getAffectedMarkets(country),
            category,
            blackoutBeforeMin: cfg.blackoutBeforeMin,
            blackoutAfterMin: cfg.blackoutAfterMin,
        });
    };

    const dayOfWeek  = now.getUTCDay();    // 0=Sun, 1=Mon … 6=Sat
    const dayOfMonth = now.getUTCDate();
    const hour       = now.getUTCHours();
    const year       = now.getUTCFullYear();
    const month      = now.getUTCMonth();  // 0-indexed

    // ── NFP: First Friday of month, 08:30 ET (13:30 UTC) ─────────────────────
    if (dayOfWeek === 5 && dayOfMonth <= 7) {
        const t = new Date(Date.UTC(year, month, dayOfMonth, 13, 30));
        addEvent('Non-Farm Employment Change', 'NFP', 'USD', 'HIGH', t, 'EMPLOYMENT');
        addEvent('Unemployment Rate', 'Unemployment', 'USD', 'HIGH', t, 'EMPLOYMENT');
    }

    // ── CPI: Typically 10th–13th of month, Tue/Wed, 08:30 ET ─────────────────
    if ((dayOfWeek === 2 || dayOfWeek === 3) && dayOfMonth >= 10 && dayOfMonth <= 14) {
        const t = new Date(Date.UTC(year, month, dayOfMonth, 13, 30));
        addEvent('CPI m/m', 'CPI', 'USD', 'HIGH', t, 'INFLATION');
        addEvent('Core CPI m/m', 'Core CPI', 'USD', 'HIGH', t, 'INFLATION');
    }

    // ── PPI: Usually 1 day after CPI ─────────────────────────────────────────
    if ((dayOfWeek === 2 || dayOfWeek === 3 || dayOfWeek === 4) && dayOfMonth >= 11 && dayOfMonth <= 15) {
        const t = new Date(Date.UTC(year, month, dayOfMonth, 13, 30));
        addEvent('PPI m/m', 'PPI', 'USD', 'MEDIUM', t, 'INFLATION');
    }

    // ── FOMC: 8 times per year ~ every 6 weeks ────────────────────────────────
    // Approximate: typically Wed of the 2nd or 4th week, 18:00 UTC (2pm ET)
    if (dayOfWeek === 3 && (dayOfMonth >= 25 || dayOfMonth <= 5 || (dayOfMonth >= 10 && dayOfMonth <= 22))) {
        const t = new Date(Date.UTC(year, month, dayOfMonth, 18, 0));
        addEvent('FOMC Statement', 'FOMC', 'USD', 'HIGH', t, 'CENTRAL_BANK');
        const presser = new Date(Date.UTC(year, month, dayOfMonth, 18, 30));
        addEvent('FOMC Press Conference', 'Powell', 'USD', 'HIGH', presser, 'CENTRAL_BANK');
    }

    // ── PCE: Last Thursday/Friday of month, 13:30 UTC ────────────────────────
    if ((dayOfWeek === 4 || dayOfWeek === 5) && dayOfMonth >= 28) {
        const t = new Date(Date.UTC(year, month, dayOfMonth, 13, 30));
        addEvent('Core PCE Price Index m/m', 'PCE', 'USD', 'HIGH', t, 'INFLATION');
    }

    // ── Initial Jobless Claims: Every Thursday, 13:30 UTC ────────────────────
    if (dayOfWeek === 4) {
        const t = new Date(Date.UTC(year, month, dayOfMonth, 13, 30));
        addEvent('Unemployment Claims', 'Claims', 'USD', 'MEDIUM', t, 'EMPLOYMENT');
    }

    // ── ISM PMI Manufacturing: First business day of month ───────────────────
    if (dayOfWeek >= 1 && dayOfWeek <= 3 && dayOfMonth <= 3) {
        const t = new Date(Date.UTC(year, month, dayOfMonth, 15, 0));
        addEvent('ISM Manufacturing PMI', 'ISM Mfg', 'USD', 'MEDIUM', t, 'PMI');
    }

    // ── Retail Sales: Mid-month Wed/Thu ──────────────────────────────────────
    if ((dayOfWeek === 3 || dayOfWeek === 4) && dayOfMonth >= 12 && dayOfMonth <= 17) {
        const t = new Date(Date.UTC(year, month, dayOfMonth, 13, 30));
        addEvent('Retail Sales m/m', 'Retail Sales', 'USD', 'MEDIUM', t, 'RETAIL');
    }

    // ── Session alerts (always) ───────────────────────────────────────────────
    // Only emit if they're within a 2-hour future window
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // London open: 08:00 UTC
        const london = new Date(Date.UTC(year, month, dayOfMonth, 8, 0));
        if (london.getTime() > now.getTime() && london.getTime() < now.getTime() + 2 * 60 * 60 * 1000) {
            addEvent('London Session Open', 'London Open', 'GBP', 'LOW', london, 'SESSION', ['EURUSD', 'GBPUSD']);
        }

        // London-NY overlap: 13:00 UTC
        const overlap = new Date(Date.UTC(year, month, dayOfMonth, 13, 0));
        if (overlap.getTime() > now.getTime() && overlap.getTime() < now.getTime() + 2 * 60 * 60 * 1000) {
            addEvent('London-NY Session Overlap (Peak Liquidity)', 'London-NY', 'USD', 'MEDIUM', overlap, 'SESSION', ['EURUSD', 'GBPUSD']);
        }

        // US Open: 14:30 UTC
        const usOpen = new Date(Date.UTC(year, month, dayOfMonth, 14, 30));
        if (usOpen.getTime() > now.getTime() && usOpen.getTime() < now.getTime() + 2 * 60 * 60 * 1000) {
            addEvent('US Equity Market Open', 'US Open', 'USD', 'LOW', usOpen, 'SESSION', ['BTCUSD', 'ETHUSD', 'EURUSD']);
        }
    }

    return events;
}

// ─── Window Computation ───────────────────────────────────────────────────────

function computeWindow(event: EconEvent, now: Date): EventWindow | null {
    const eventTime = new Date(event.scheduledAt).getTime();
    const nowMs = now.getTime();
    const diffMs = eventTime - nowMs;
    const minutesUntil = diffMs / 60000;
    const minutesSince = -minutesUntil;

    const cfg = IMPACT_CONFIG[event.impact];

    // Outside all windows → no active window
    if (minutesUntil > cfg.approachingMin && minutesSince < 0) return null;
    if (minutesSince > event.blackoutAfterMin + 15) return null; // Well past post-window

    let phase: WindowPhase;
    let riskLevel: RiskLevel;
    let recommendation: TradingRecommendation;
    let statusLabel: string;

    if (minutesUntil > cfg.approachingMin) {
        phase = 'DISTANT';
        riskLevel = 'NORMAL';
        recommendation = 'NORMAL';
        statusLabel = `in ${Math.round(minutesUntil)}m`;
    } else if (minutesUntil > cfg.imminentMin) {
        phase = 'APPROACHING';
        riskLevel = event.impact === 'HIGH' ? 'ELEVATED' : 'NORMAL';
        recommendation = event.impact === 'HIGH' ? 'CAUTION' : 'NORMAL';
        statusLabel = `⚠️ ${Math.round(minutesUntil)}m away`;
    } else if (minutesUntil > cfg.criticalMin) {
        phase = 'IMMINENT';
        riskLevel = event.impact === 'HIGH' ? 'HIGH' : 'ELEVATED';
        recommendation = event.impact === 'HIGH' ? 'REDUCE_SIZE' : 'CAUTION';
        statusLabel = `⚠️ ${Math.round(minutesUntil)}m — reduce size`;
    } else if (minutesUntil > -2) {
        phase = minutesUntil > 0 ? 'CRITICAL' : 'LIVE';
        riskLevel = 'EXTREME';
        recommendation = 'NO_TRADE';
        statusLabel = minutesUntil > 0 ? `🔴 ${Math.round(minutesUntil * 60)}s — NO TRADE` : `🔴 LIVE NOW`;
    } else if (minutesSince < 15) {
        phase = 'POST_VOLATILE';
        riskLevel = 'EXTREME';
        recommendation = 'NO_TRADE';
        statusLabel = `🔴 +${Math.round(minutesSince)}m post-event`;
    } else if (minutesSince < event.blackoutAfterMin) {
        phase = 'POST_VOLATILE';
        riskLevel = event.impact === 'HIGH' ? 'HIGH' : 'ELEVATED';
        recommendation = event.impact === 'HIGH' ? 'REDUCE_SIZE' : 'CAUTION';
        statusLabel = `⚡ cooling +${Math.round(minutesSince)}m`;
    } else if (minutesSince < event.blackoutAfterMin + 15) {
        phase = 'COOLING';
        riskLevel = 'ELEVATED';
        recommendation = 'CAUTION';
        statusLabel = `✓ stabilizing`;
    } else {
        phase = 'CLEAR';
        riskLevel = 'NORMAL';
        recommendation = 'NORMAL';
        statusLabel = `✓ clear`;
    }

    return { event, phase, minutesUntil, minutesSince, riskLevel, recommendation, statusLabel };
}

// ─── Signal Publishing ────────────────────────────────────────────────────────

function publishWindowSignal(window: EventWindow): void {
    const { event, phase, minutesUntil, minutesSince } = window;
    const phaseKey = `${event.id}:${phase}`;

    // Each phase is published once (until it resets after 3 hours)
    const lastPublished = publishedPhases.get(phaseKey);
    const now = Date.now();
    if (lastPublished && (now - lastPublished) < 3 * 60 * 60 * 1000) return;
    publishedPhases.set(phaseKey, now);

    // Only publish signals for phases worth notifying about
    const notifiablePhases: WindowPhase[] = ['APPROACHING', 'IMMINENT', 'CRITICAL', 'LIVE', 'POST_VOLATILE'];
    if (!notifiablePhases.includes(phase)) return;

    let direction: IntelDirection = 'ALERT';
    let confidence: number;
    let summary: string;

    if (phase === 'LIVE' || phase === 'CRITICAL') {
        confidence = event.impact === 'HIGH' ? 0.95 : 0.8;
        summary = `🔴 ${event.shortTitle} ${phase === 'LIVE' ? 'LIVE NOW' : 'in <5 min'} — NO NEW TRADES. ${event.title} (${event.country}) — ${event.impact} impact.`;
    } else if (phase === 'POST_VOLATILE') {
        confidence = event.impact === 'HIGH' ? 0.85 : 0.65;
        summary = `⚡ ${event.shortTitle} just released (+${Math.round(minutesSince)}m). Post-event volatility window. Actual: ${event.actual ?? 'pending'}. Forecast: ${event.forecast ?? 'N/A'}.`;
    } else if (phase === 'IMMINENT') {
        confidence = event.impact === 'HIGH' ? 0.8 : 0.55;
        summary = `⚠️ ${event.shortTitle} in ${Math.round(minutesUntil)}m — REDUCE POSITION SIZE. ${event.title} (${event.country}). Forecast: ${event.forecast ?? 'N/A'}, Prev: ${event.previous ?? 'N/A'}.`;
    } else if (phase === 'APPROACHING') {
        confidence = event.impact === 'HIGH' ? 0.65 : 0.4;
        summary = `📅 ${event.shortTitle} approaching in ${Math.round(minutesUntil)}m — plan around it. ${event.title} (${event.country}).`;
    } else {
        return;
    }

    for (const symbol of event.affectedSymbols) {
        intelBus.publish({
            source: 'ECON_CALENDAR',
            symbol,
            direction,
            confidence,
            summary,
            payload: {
                eventId:     event.id,
                eventTitle:  event.title,
                shortTitle:  event.shortTitle,
                country:     event.country,
                impact:      event.impact,
                category:    event.category,
                phase,
                minutesUntil: Math.round(minutesUntil),
                minutesSince: Math.round(minutesSince),
                scheduledAt: event.scheduledAt,
                forecast:    event.forecast,
                previous:    event.previous,
                actual:      event.actual,
                blackoutBeforeMin: event.blackoutBeforeMin,
                blackoutAfterMin:  event.blackoutAfterMin,
            },
        } as IntelSignal);
    }

    const emoji = event.impact === 'HIGH' ? '🔴' : event.impact === 'MEDIUM' ? '🟠' : '🟡';
    console.log(`📅 [EconCal] Published ${phase} signal for ${event.shortTitle} (${event.country}) ${emoji}`);
}

// ─── State Updater ────────────────────────────────────────────────────────────

function rebuildState(allEvents: EconEvent[]): void {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const todayEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));
    const next24h    = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const todayEvents = allEvents
        .filter(e => {
            const t = new Date(e.scheduledAt);
            return t >= todayStart && t <= todayEnd && e.impact !== 'HOLIDAY';
        })
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    const upcomingEvents = allEvents
        .filter(e => {
            const t = new Date(e.scheduledAt);
            return t > now && t <= next24h && e.impact !== 'HOLIDAY';
        })
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
        .slice(0, 10);

    // Compute active windows
    const activeWindows: EventWindow[] = [];
    for (const event of todayEvents) {
        const w = computeWindow(event, now);
        if (w && w.phase !== 'DISTANT' && w.phase !== 'CLEAR') {
            activeWindows.push(w);
            publishWindowSignal(w);
        }
    }

    // Also check upcoming (next 24h) for approaching windows
    for (const event of upcomingEvents.filter(e => !todayEvents.find(te => te.id === e.id))) {
        const w = computeWindow(event, now);
        if (w && w.phase === 'APPROACHING') {
            activeWindows.push(w);
            publishWindowSignal(w);
        }
    }

    // Sort windows by urgency
    activeWindows.sort((a, b) => {
        const phaseOrder: Record<WindowPhase, number> = {
            LIVE: 0, CRITICAL: 1, POST_VOLATILE: 2, IMMINENT: 3,
            APPROACHING: 4, COOLING: 5, DISTANT: 6, CLEAR: 7,
        };
        return phaseOrder[a.phase] - phaseOrder[b.phase];
    });

    // Next upcoming event
    const futureEvents = allEvents
        .filter(e => new Date(e.scheduledAt) > now && e.impact !== 'HOLIDAY')
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    const nextEvent = futureEvents[0] ?? null;
    const minutesUntilNext = nextEvent
        ? (new Date(nextEvent.scheduledAt).getTime() - now.getTime()) / 60000
        : Infinity;

    // Overall recommendation: worst active window
    const recOrder: TradingRecommendation[] = ['NO_TRADE', 'HOLD_NEW', 'REDUCE_SIZE', 'CAUTION', 'NORMAL'];
    let overallRecommendation: TradingRecommendation = 'NORMAL';
    for (const w of activeWindows) {
        const wi = recOrder.indexOf(w.recommendation);
        const oi = recOrder.indexOf(overallRecommendation);
        if (wi < oi) overallRecommendation = w.recommendation;
    }

    cachedState = {
        ...cachedState,
        weekEvents: allEvents,
        todayEvents,
        upcomingEvents,
        activeWindows,
        nextEvent,
        minutesUntilNext,
        overallRecommendation,
    };
}

// ─── Fetch & Refresh ──────────────────────────────────────────────────────────

async function refreshCalendar(): Promise<void> {
    try {
        const events = await fetchWeeklyCalendar();
        cachedState.weekEvents = events;
        cachedState.lastFetched = new Date().toISOString();
        cachedState.source = 'LIVE';
        rebuildState(events);
        console.log(`📅 [EconCal] Calendar refreshed — ${events.length} events loaded`);
    } catch (err: any) {
        console.error(`📅 [EconCal] Fetch failed, falling back to heuristics: ${err.message}`);
        if (cachedState.weekEvents.length === 0) {
            // Only use fallback if we have no cached data
            const heuristic = generateHeuristicEvents();
            cachedState.source = 'FALLBACK';
            rebuildState(heuristic);
        } else {
            cachedState.source = 'CACHE';
            rebuildState(cachedState.weekEvents);
        }
    }
}

// ─── Periodic Window Check ────────────────────────────────────────────────────

function checkWindows(): void {
    if (cachedState.weekEvents.length > 0) {
        rebuildState(cachedState.weekEvents);
    } else {
        const heuristic = generateHeuristicEvents();
        rebuildState(heuristic);
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Start the calendar engine — fetch, then poll for window transitions */
export async function startCalendarEngine(): Promise<void> {
    if (isRunning) return;
    isRunning = true;
    console.log('📅 [EconCal] Starting economic calendar engine...');

    await refreshCalendar();

    fetchTimer = setInterval(refreshCalendar, FETCH_INTERVAL_MS);
    checkTimer  = setInterval(checkWindows, CHECK_INTERVAL_MS);
}

/** Stop the calendar engine */
export function stopCalendarEngine(): void {
    if (!isRunning) return;
    if (fetchTimer) clearInterval(fetchTimer);
    if (checkTimer)  clearInterval(checkTimer);
    fetchTimer = null;
    checkTimer  = null;
    isRunning = false;
    console.log('📅 [EconCal] Calendar engine stopped.');
}

/** Get the current calendar state (for API routes and UI) */
export function getCalendarState(): CalendarState {
    return { ...cachedState };
}

/** Get the current trade recommendation across all active windows */
export function getCalendarRecommendation(): TradingRecommendation {
    return cachedState.overallRecommendation;
}

/**
 * Check if a trade in a given symbol should be blocked or reduced based on
 * active event windows. Returns the most restrictive recommendation.
 */
export function getSymbolRecommendation(symbol: string): {
    recommendation: TradingRecommendation;
    reason: string;
    windows: EventWindow[];
} {
    const relevantWindows = cachedState.activeWindows.filter(w =>
        w.event.affectedSymbols.includes(symbol)
    );

    if (relevantWindows.length === 0) {
        return { recommendation: 'NORMAL', reason: 'No active event windows for this symbol', windows: [] };
    }

    const recOrder: TradingRecommendation[] = ['NO_TRADE', 'HOLD_NEW', 'REDUCE_SIZE', 'CAUTION', 'NORMAL'];
    let worst: TradingRecommendation = 'NORMAL';
    let worstWindow: EventWindow | null = null;

    for (const w of relevantWindows) {
        const wi = recOrder.indexOf(w.recommendation);
        const oi = recOrder.indexOf(worst);
        if (wi < oi) {
            worst = w.recommendation;
            worstWindow = w;
        }
    }

    const reason = worstWindow
        ? `${worstWindow.event.shortTitle} (${worstWindow.event.impact}) — ${worstWindow.statusLabel}`
        : 'Active event window';

    return { recommendation: worst, reason, windows: relevantWindows };
}

/**
 * Quick check: is a trade right now in a blackout zone?
 * Returns true if NO_TRADE or HOLD_NEW is active for this symbol.
 */
export function isInBlackout(symbol: string): boolean {
    const { recommendation } = getSymbolRecommendation(symbol);
    return recommendation === 'NO_TRADE' || recommendation === 'HOLD_NEW';
}

/** Force an immediate calendar refresh (for on-demand use) */
export async function forceRefresh(): Promise<CalendarState> {
    await refreshCalendar();
    return getCalendarState();
}

/** Get today's HIGH impact events only */
export function getTodayHighImpact(): EconEvent[] {
    return cachedState.todayEvents.filter(e => e.impact === 'HIGH');
}

/** Get all events within the next N minutes */
export function getEventsWithinMinutes(minutes: number): EconEvent[] {
    const now = new Date();
    const cutoff = new Date(now.getTime() + minutes * 60000);
    return cachedState.weekEvents.filter(e => {
        const t = new Date(e.scheduledAt);
        return t > now && t <= cutoff;
    });
}

export type { CalendarState, EconEvent, EventWindow };
