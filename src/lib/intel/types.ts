// ═══════════════════════════════════════════════════════════════
// INTELLIGENCE TYPES — Shared across all intel data layers
// "Know before you trade."
// ═══════════════════════════════════════════════════════════════

export type IntelSource =
    | 'ORDER_FLOW'
    | 'SENTIMENT'
    | 'ONCHAIN_CONFLUENCE'
    | 'WHALE_FLOW'
    | 'FEAR_GREED'
    | 'FUNDING_OI'
    | 'MARKET_DATA'
    | 'ECON_CALENDAR'
    | 'SOCIAL_FEED';

export type IntelDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'ALERT';

/**
 * Normalized intel signal published by any data layer.
 * All sources produce this format for the Intelligence Bus.
 */
export interface IntelSignal {
    id?: number;                    // Assigned by SQLite on persist
    source: IntelSource;
    symbol: string;                 // Normalized: 'BTCUSD', 'EURUSD', 'ETH', etc.
    direction: IntelDirection;
    confidence: number;             // 0.0 – 1.0
    summary: string;                // Human-readable for Discord/UI
    payload: Record<string, any>;   // Source-specific data blob
    timestamp?: string;             // ISO 8601 — set by bus if not provided
    expiresAt?: string;             // ISO 8601 — TTL, intel goes stale
}

/**
 * Intel Score result from querying the bus for trade gating.
 * Used by RiskEngine to decide confirm/reduce/veto.
 */
export interface IntelScore {
    symbol: string;
    /** Weighted score: +1.0 = strongly confirms, -1.0 = strongly opposes, 0 = neutral */
    score: number;
    /** Position size multiplier: 1.0 = full, 0.5 = half, 0 = veto */
    sizeMultiplier: number;
    /** Human-readable reason for the decision */
    reason: string;
    /** How many active intel signals contributed */
    signalCount: number;
    /** Breakdown by source */
    breakdown: Partial<Record<IntelSource, { direction: IntelDirection; confidence: number }>>;
}

/**
 * Default TTLs per source (milliseconds).
 * Order flow is fleeting; on-chain/whale intel lasts longer.
 */
export const INTEL_TTL_MS: Record<IntelSource, number> = {
    ORDER_FLOW:          15 * 60 * 1000,  // 15 minutes
    SENTIMENT:           30 * 60 * 1000,  // 30 minutes
    ONCHAIN_CONFLUENCE:  60 * 60 * 1000,  // 1 hour
    WHALE_FLOW:          60 * 60 * 1000,  // 1 hour
    FEAR_GREED:          60 * 60 * 1000,  // 1 hour (updates daily but stays relevant)
    FUNDING_OI:          30 * 60 * 1000,  // 30 minutes (funding snapshots every 8h)
    MARKET_DATA:         20 * 60 * 1000,  // 20 minutes (price/volume shifts fast)
    ECON_CALENDAR:      120 * 60 * 1000,  // 2 hours (events are scheduled)
    SOCIAL_FEED:         30 * 60 * 1000,  // 30 minutes (tweets are time-sensitive)
};

/**
 * Default weights for computing the Intel Score.
 * Higher weight = more influence on trade sizing.
 * Overridable via env vars or settings table.
 *
 * FREE_SOURCES_ONLY=true  → rebalances weights so only the 5 live free sources
 *   carry weight (sum = 1.0).  Set this in .env while premium sources are offline
 *   so the score range is realistic and the VETO threshold (-0.5) is reachable.
 *
 * Default (full) mode weights sum to ~1.0 across all 9 sources but assume all
 *   premium sources are live.  When they're offline their weight falls out of the
 *   normalizer in bus.score() automatically, but the thresholds are calibrated for
 *   a full 9-source world.
 */
const FREE_SOURCES_ONLY = process.env.FREE_SOURCES_ONLY === 'true';

export const INTEL_WEIGHTS: Record<IntelSource, number> = FREE_SOURCES_ONLY
    ? {
        // Premium sources zeroed out — weight redistributed to free sources (sum = 1.0)
        ORDER_FLOW:          parseFloat(process.env.INTEL_WEIGHT_ORDERFLOW  || '0'),
        SENTIMENT:           parseFloat(process.env.INTEL_WEIGHT_SENTIMENT  || '0'),
        ONCHAIN_CONFLUENCE:  parseFloat(process.env.INTEL_WEIGHT_ONCHAIN    || '0'),
        WHALE_FLOW:          parseFloat(process.env.INTEL_WEIGHT_WHALE      || '0'),
        FEAR_GREED:          parseFloat(process.env.INTEL_WEIGHT_FEARGREED  || '0.25'),  // crypto sentiment anchor
        FUNDING_OI:          parseFloat(process.env.INTEL_WEIGHT_FUNDINGOI  || '0.22'),  // leverage positioning
        MARKET_DATA:         parseFloat(process.env.INTEL_WEIGHT_MARKETDATA || '0.20'),  // price/volume momentum
        ECON_CALENDAR:       parseFloat(process.env.INTEL_WEIGHT_ECONCAL    || '0.13'),  // event risk
        SOCIAL_FEED:         parseFloat(process.env.INTEL_WEIGHT_SOCIAL     || '0.20'),  // headline risk
    }
    : {
        // Full mode — all 9 sources active (premium + free)
        ORDER_FLOW:          parseFloat(process.env.INTEL_WEIGHT_ORDERFLOW  || '0.25'),
        SENTIMENT:           parseFloat(process.env.INTEL_WEIGHT_SENTIMENT  || '0.10'),
        ONCHAIN_CONFLUENCE:  parseFloat(process.env.INTEL_WEIGHT_ONCHAIN    || '0.20'),
        WHALE_FLOW:          parseFloat(process.env.INTEL_WEIGHT_WHALE      || '0.15'),
        FEAR_GREED:          parseFloat(process.env.INTEL_WEIGHT_FEARGREED  || '0.08'),
        FUNDING_OI:          parseFloat(process.env.INTEL_WEIGHT_FUNDINGOI  || '0.10'),
        MARKET_DATA:         parseFloat(process.env.INTEL_WEIGHT_MARKETDATA || '0.07'),
        ECON_CALENDAR:       parseFloat(process.env.INTEL_WEIGHT_ECONCAL    || '0.05'),
        SOCIAL_FEED:         parseFloat(process.env.INTEL_WEIGHT_SOCIAL     || '0.12'),
    };

/**
 * Service health heartbeat record.
 * Each background service writes this to the settings table periodically.
 */
export interface ServiceHeartbeat {
    service: string;
    lastHeartbeat: string;       // ISO timestamp
    status: 'RUNNING' | 'STALE' | 'DEAD';
    signalsPublished: number;    // Total signals published since start
}

// ═══════════════════════════════════════════════════════════════
// SOURCE REGISTRY — Single source of truth for all intel sources
// Update HERE, not in page.tsx, SignalCard.tsx, IntelHUD.tsx, etc.
// ═══════════════════════════════════════════════════════════════

export interface SourceMeta {
    label: string;
    color: string;
    emoji: string;
    /** Key used in health heartbeat/settings table */
    healthKey: string;
    /** true = zero-cost, no API key required */
    free: boolean;
}

export const SOURCE_REGISTRY: Record<IntelSource, SourceMeta> = {
    ORDER_FLOW:         { label: 'Order Flow',   color: '#06B6D4', emoji: '📊', healthKey: 'orderflow',     free: false },
    SENTIMENT:          { label: 'Sentiment',    color: '#10B981', emoji: '📰', healthKey: 'sentiment',     free: false },
    ONCHAIN_CONFLUENCE: { label: 'On-Chain',     color: '#F59E0B', emoji: '⛓️', healthKey: 'onchain',       free: false },
    WHALE_FLOW:         { label: 'Whale Flow',   color: '#EF4444', emoji: '🐋', healthKey: 'whale',         free: false },
    FEAR_GREED:         { label: 'Fear & Greed', color: '#8B5CF6', emoji: '😨', healthKey: 'feargreed',     free: true },
    FUNDING_OI:         { label: 'Funding/OI',   color: '#EC4899', emoji: '💰', healthKey: 'fundingoi',     free: true },
    MARKET_DATA:        { label: 'Market Data',  color: '#14B8A6', emoji: '📈', healthKey: 'marketdata',    free: true },
    ECON_CALENDAR:      { label: 'Econ Cal',     color: '#F97316', emoji: '📅', healthKey: 'econcalendar',  free: true },
    SOCIAL_FEED:        { label: 'Social Feed',  color: '#1DA1F2', emoji: '🐦', healthKey: 'socialfeed',   free: true },
};

/** All 9 source keys */
export const ALL_INTEL_SOURCES: IntelSource[] = Object.keys(SOURCE_REGISTRY) as IntelSource[];

/** Premium (paid/self-hosted) sources */
export const PREMIUM_SOURCES: IntelSource[] = ALL_INTEL_SOURCES.filter(s => !SOURCE_REGISTRY[s].free);

/** Free (zero-cost) sources */
export const FREE_SOURCES: IntelSource[] = ALL_INTEL_SOURCES.filter(s => SOURCE_REGISTRY[s].free);

/** Symbols the Intel Center tracks */
export const WATCHED_SYMBOLS = ['BTCUSD', 'ETHUSD', 'EURUSD', 'GBPUSD'];

/** All valid IntelSource strings for input validation */
export const VALID_SOURCES = new Set<string>(ALL_INTEL_SOURCES);

/** All valid IntelDirection strings for input validation */
export const VALID_DIRECTIONS = new Set<string>(['BULLISH', 'BEARISH', 'NEUTRAL', 'ALERT']);

/** Health key → source lookup (reverse map) */
export const HEALTH_KEY_TO_SOURCE: Record<string, IntelSource> = Object.fromEntries(
    ALL_INTEL_SOURCES.map(s => [SOURCE_REGISTRY[s].healthKey, s])
) as Record<string, IntelSource>;
