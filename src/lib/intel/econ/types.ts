// ═══════════════════════════════════════════════════════════════
// ECONOMIC CALENDAR TYPES
// "Trade blind and the market will remind you."
//
// Typed definitions for live economic event tracking,
// pre/post-event windows, and trade blackout zones.
// ═══════════════════════════════════════════════════════════════

export type EventImpact = 'HIGH' | 'MEDIUM' | 'LOW' | 'HOLIDAY';

export type EventCountry = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | 'NZD' | 'CHF' | 'OTHER';

export type EventCategory =
    | 'CENTRAL_BANK'    // FOMC, Fed speeches, ECB, BOE, Powell
    | 'INFLATION'       // CPI, PPI, PCE, Core PCE
    | 'EMPLOYMENT'      // NFP, ADP, Jobless Claims, JOLTS
    | 'GDP'             // GDP releases (Advance, Preliminary, Final)
    | 'PMI'             // ISM PMI Manufacturing, Services, Markit
    | 'RETAIL'          // Retail Sales, Consumer Confidence, UMich Sentiment
    | 'HOUSING'         // Existing/New Home Sales, Housing Starts, Building Permits
    | 'TRADE'           // Trade Balance, Current Account
    | 'TREASURY'        // Bond auctions (2y, 5y, 10y, 30y) — impact on USD
    | 'SESSION'         // Market open/close, London-NY overlap, weekly timing
    | 'OTHER';

/** Phase of proximity to an event */
export type WindowPhase =
    | 'DISTANT'         // > 60 min away — no alert
    | 'APPROACHING'     // 30–60 min — warning issued
    | 'IMMINENT'        // 5–30 min — strong warning, reduce size
    | 'CRITICAL'        // 0–5 min before — no new trades
    | 'LIVE'            // ±2 min of event time — event firing
    | 'POST_VOLATILE'   // 0–30 min after — post-event volatility window
    | 'COOLING'         // 30–60 min after — market digesting
    | 'CLEAR';          // > 60 min after — back to normal

/** Trade recommendation for current event proximity */
export type TradingRecommendation =
    | 'NORMAL'          // No restrictions
    | 'CAUTION'         // Reduced size, tighter risk
    | 'REDUCE_SIZE'     // Cut position size 50%
    | 'HOLD_NEW'        // Don't open new trades
    | 'NO_TRADE';       // Full blackout — close or hold existing only

/** Risk level classification */
export type RiskLevel = 'EXTREME' | 'HIGH' | 'ELEVATED' | 'NORMAL';

// ─── Core Event Object ────────────────────────────────────────────────────────

export interface EconEvent {
    /** Unique identifier (hash of title+country+date) */
    id: string;
    /** Full event name, e.g. "Non-Farm Employment Change" */
    title: string;
    /** Short display name for tight spaces, e.g. "NFP" */
    shortTitle: string;
    /** Issuing country/currency */
    country: EventCountry;
    /** ISO 8601 timestamp (UTC) */
    scheduledAt: string;
    /** Impact classification */
    impact: EventImpact;
    /** Analyst consensus forecast */
    forecast: string | null;
    /** Prior period's value */
    previous: string | null;
    /** Actual released value (null = not yet released) */
    actual: string | null;
    /** Data source */
    source: 'FOREXFACTORY' | 'STATIC';
    /** Directly impacted trading symbols */
    affectedSymbols: string[];
    /** Which market classes are most affected */
    affectedMarkets: ('FX' | 'CRYPTO' | 'EQUITIES' | 'FUTURES')[];
    /** What type of economic data this is */
    category: EventCategory;
    /** Pre-event blackout window in minutes (before scheduledAt) */
    blackoutBeforeMin: number;
    /** Post-event volatile window in minutes (after scheduledAt) */
    blackoutAfterMin: number;
}

// ─── Active Event Window ──────────────────────────────────────────────────────

export interface EventWindow {
    event: EconEvent;
    /** Current phase relative to event time */
    phase: WindowPhase;
    /** Minutes until event (negative = already happened) */
    minutesUntil: number;
    /** Minutes since event fired (0 = hasn't fired yet) */
    minutesSince: number;
    /** Computed risk level for current phase */
    riskLevel: RiskLevel;
    /** What traders should do right now */
    recommendation: TradingRecommendation;
    /** Human-readable status string */
    statusLabel: string;
}

// ─── Calendar State ───────────────────────────────────────────────────────────

export interface CalendarState {
    /** All events for this week */
    weekEvents: EconEvent[];
    /** Today's events only */
    todayEvents: EconEvent[];
    /** Events for next 24h */
    upcomingEvents: EconEvent[];
    /** Currently active event windows (blackout zones) */
    activeWindows: EventWindow[];
    /** Next scheduled event */
    nextEvent: EconEvent | null;
    /** Minutes until next event */
    minutesUntilNext: number;
    /** When calendar was last fetched */
    lastFetched: string | null;
    /** Data quality */
    source: 'LIVE' | 'CACHE' | 'FALLBACK';
    /** Current trade recommendation across all active windows */
    overallRecommendation: TradingRecommendation;
}

// ─── ForexFactory API Response ────────────────────────────────────────────────

/** Raw structure returned by ForexFactory calendar JSON endpoint */
export interface FFEvent {
    title: string;
    country: string;
    date: string;       // ISO 8601
    impact: string;     // "High" | "Medium" | "Low" | "Holiday" | "Non-Economic"
    forecast: string;
    previous: string;
    actual: string;
}

// ─── Phase Config ─────────────────────────────────────────────────────────────

/** Thresholds and behavior for each impact level */
export const IMPACT_CONFIG: Record<EventImpact, {
    blackoutBeforeMin: number;
    blackoutAfterMin: number;
    approachingMin: number;
    imminentMin: number;
    criticalMin: number;
}> = {
    HIGH: {
        blackoutBeforeMin: 30,   // Start warning 30min before
        blackoutAfterMin:  45,   // Volatile for 45min after
        approachingMin:    60,   // APPROACHING phase starts 60min before
        imminentMin:       20,   // IMMINENT starts 20min before
        criticalMin:        5,   // CRITICAL starts 5min before
    },
    MEDIUM: {
        blackoutBeforeMin: 10,
        blackoutAfterMin:  20,
        approachingMin:    30,
        imminentMin:       10,
        criticalMin:        3,
    },
    LOW: {
        blackoutBeforeMin:  5,
        blackoutAfterMin:  10,
        approachingMin:    15,
        imminentMin:        5,
        criticalMin:        2,
    },
    HOLIDAY: {
        blackoutBeforeMin:  0,
        blackoutAfterMin:   0,
        approachingMin:     0,
        imminentMin:        0,
        criticalMin:        0,
    },
};
