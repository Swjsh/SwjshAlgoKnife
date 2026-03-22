// ═══════════════════════════════════════════════════════════════
// INTELLIGENCE TYPES — Shared across all intel data layers
// "Know before you trade."
// ═══════════════════════════════════════════════════════════════

export type IntelSource =
    // Original 9 sources (Premium + Free)
    | 'ORDER_FLOW'
    | 'SENTIMENT'
    | 'ONCHAIN_CONFLUENCE'
    | 'WHALE_FLOW'
    | 'FEAR_GREED'
    | 'FUNDING_OI'
    | 'MARKET_DATA'
    | 'ECON_CALENDAR'
    | 'SOCIAL_FEED'
    // New 9 sources (Free tier - all zero-cost APIs)
    | 'POLITICIAN_TRADES'    // Congressional stock trades (Capitol Trades, Quiver)
    | 'INSIDER_FLOW'         // SEC Form 4 insider transactions
    | 'ANALYST_RATINGS'      // Wall Street upgrades/downgrades
    | 'ETF_FLOWS'            // BTC/ETH ETF fund flows
    | 'OPTIONS_UNUSUAL'      // Unusual options activity
    | 'DARK_POOL'            // Dark pool prints
    | 'MACRO_SENTIMENT'      // AAII, CNN Fear/Greed, PMI
    | 'TECHNICAL_LEVELS'     // Key S/R, pivots, moving averages
    | 'VOLATILITY';          // VIX regime tracking

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
    // Original sources
    ORDER_FLOW:          15 * 60 * 1000,  // 15 minutes
    SENTIMENT:           30 * 60 * 1000,  // 30 minutes
    ONCHAIN_CONFLUENCE:  60 * 60 * 1000,  // 1 hour
    WHALE_FLOW:          60 * 60 * 1000,  // 1 hour
    FEAR_GREED:          60 * 60 * 1000,  // 1 hour (updates daily but stays relevant)
    FUNDING_OI:          30 * 60 * 1000,  // 30 minutes (funding snapshots every 8h)
    MARKET_DATA:         20 * 60 * 1000,  // 20 minutes (price/volume shifts fast)
    ECON_CALENDAR:      120 * 60 * 1000,  // 2 hours (events are scheduled)
    SOCIAL_FEED:         30 * 60 * 1000,  // 30 minutes (tweets are time-sensitive)
    // New sources
    POLITICIAN_TRADES:  240 * 60 * 1000,  // 4 hours (STOCK Act filings)
    INSIDER_FLOW:       120 * 60 * 1000,  // 2 hours (Form 4 filings)
    ANALYST_RATINGS:    120 * 60 * 1000,  // 2 hours (upgrades/downgrades)
    ETF_FLOWS:           60 * 60 * 1000,  // 1 hour (daily flows, check frequently)
    OPTIONS_UNUSUAL:     30 * 60 * 1000,  // 30 minutes (time-sensitive)
    DARK_POOL:           45 * 60 * 1000,  // 45 minutes (large prints)
    MACRO_SENTIMENT:    180 * 60 * 1000,  // 3 hours (weekly surveys)
    TECHNICAL_LEVELS:    60 * 60 * 1000,  // 1 hour (pivot points, S/R)
    VOLATILITY:          30 * 60 * 1000,  // 30 minutes (VIX changes quickly)
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
        ORDER_FLOW:          parseFloat(process.env.INTEL_WEIGHT_ORDERFLOW       || '0'),
        SENTIMENT:           parseFloat(process.env.INTEL_WEIGHT_SENTIMENT       || '0'),
        ONCHAIN_CONFLUENCE:  parseFloat(process.env.INTEL_WEIGHT_ONCHAIN         || '0'),
        WHALE_FLOW:          parseFloat(process.env.INTEL_WEIGHT_WHALE           || '0'),
        FEAR_GREED:          parseFloat(process.env.INTEL_WEIGHT_FEARGREED       || '0.10'),  // crypto sentiment anchor
        FUNDING_OI:          parseFloat(process.env.INTEL_WEIGHT_FUNDINGOI       || '0.10'),  // leverage positioning
        MARKET_DATA:         parseFloat(process.env.INTEL_WEIGHT_MARKETDATA      || '0.10'),  // price/volume momentum
        ECON_CALENDAR:       parseFloat(process.env.INTEL_WEIGHT_ECONCAL         || '0.06'),  // event risk
        SOCIAL_FEED:         parseFloat(process.env.INTEL_WEIGHT_SOCIAL          || '0.10'),  // headline risk
        // New free sources (redistributed weight)
        POLITICIAN_TRADES:   parseFloat(process.env.INTEL_WEIGHT_POLITICIAN      || '0.10'),  // follow the money
        INSIDER_FLOW:        parseFloat(process.env.INTEL_WEIGHT_INSIDER         || '0.08'),  // insider buying/selling
        ANALYST_RATINGS:     parseFloat(process.env.INTEL_WEIGHT_ANALYST         || '0.06'),  // Wall Street consensus
        ETF_FLOWS:           parseFloat(process.env.INTEL_WEIGHT_ETFFLOWS        || '0.08'),  // institutional flows
        OPTIONS_UNUSUAL:     parseFloat(process.env.INTEL_WEIGHT_OPTIONS         || '0.07'),  // smart money bets
        DARK_POOL:           parseFloat(process.env.INTEL_WEIGHT_DARKPOOL        || '0.05'),  // hidden liquidity
        MACRO_SENTIMENT:     parseFloat(process.env.INTEL_WEIGHT_MACRO           || '0.06'),  // retail sentiment
        TECHNICAL_LEVELS:    parseFloat(process.env.INTEL_WEIGHT_TECHNICAL       || '0.07'),  // key levels
        VOLATILITY:          parseFloat(process.env.INTEL_WEIGHT_VOLATILITY      || '0.07'),  // regime detection
    }
    : {
        // Full mode — all 18 sources active (premium + free)
        ORDER_FLOW:          parseFloat(process.env.INTEL_WEIGHT_ORDERFLOW       || '0.15'),
        SENTIMENT:           parseFloat(process.env.INTEL_WEIGHT_SENTIMENT       || '0.08'),
        ONCHAIN_CONFLUENCE:  parseFloat(process.env.INTEL_WEIGHT_ONCHAIN         || '0.12'),
        WHALE_FLOW:          parseFloat(process.env.INTEL_WEIGHT_WHALE           || '0.10'),
        FEAR_GREED:          parseFloat(process.env.INTEL_WEIGHT_FEARGREED       || '0.05'),
        FUNDING_OI:          parseFloat(process.env.INTEL_WEIGHT_FUNDINGOI       || '0.06'),
        MARKET_DATA:         parseFloat(process.env.INTEL_WEIGHT_MARKETDATA      || '0.05'),
        ECON_CALENDAR:       parseFloat(process.env.INTEL_WEIGHT_ECONCAL         || '0.04'),
        SOCIAL_FEED:         parseFloat(process.env.INTEL_WEIGHT_SOCIAL          || '0.06'),
        // New free sources
        POLITICIAN_TRADES:   parseFloat(process.env.INTEL_WEIGHT_POLITICIAN      || '0.06'),
        INSIDER_FLOW:        parseFloat(process.env.INTEL_WEIGHT_INSIDER         || '0.05'),
        ANALYST_RATINGS:     parseFloat(process.env.INTEL_WEIGHT_ANALYST         || '0.04'),
        ETF_FLOWS:           parseFloat(process.env.INTEL_WEIGHT_ETFFLOWS        || '0.05'),
        OPTIONS_UNUSUAL:     parseFloat(process.env.INTEL_WEIGHT_OPTIONS         || '0.04'),
        DARK_POOL:           parseFloat(process.env.INTEL_WEIGHT_DARKPOOL        || '0.03'),
        MACRO_SENTIMENT:     parseFloat(process.env.INTEL_WEIGHT_MACRO           || '0.04'),
        TECHNICAL_LEVELS:    parseFloat(process.env.INTEL_WEIGHT_TECHNICAL       || '0.04'),
        VOLATILITY:          parseFloat(process.env.INTEL_WEIGHT_VOLATILITY      || '0.04'),
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
    // Original 9 sources
    ORDER_FLOW:         { label: 'Order Flow',       color: '#06B6D4', emoji: '📊', healthKey: 'orderflow',         free: false },
    SENTIMENT:          { label: 'Sentiment',        color: '#10B981', emoji: '📰', healthKey: 'sentiment',         free: false },
    ONCHAIN_CONFLUENCE: { label: 'On-Chain',         color: '#F59E0B', emoji: '⛓️', healthKey: 'onchain',           free: false },
    WHALE_FLOW:         { label: 'Whale Flow',       color: '#EF4444', emoji: '🐋', healthKey: 'whale',             free: false },
    FEAR_GREED:         { label: 'Fear & Greed',     color: '#8B5CF6', emoji: '😨', healthKey: 'feargreed',         free: true },
    FUNDING_OI:         { label: 'Funding/OI',       color: '#EC4899', emoji: '💰', healthKey: 'fundingoi',         free: true },
    MARKET_DATA:        { label: 'Market Data',      color: '#14B8A6', emoji: '📈', healthKey: 'marketdata',        free: true },
    ECON_CALENDAR:      { label: 'Econ Cal',         color: '#F97316', emoji: '📅', healthKey: 'econcalendar',      free: true },
    SOCIAL_FEED:        { label: 'Social Feed',      color: '#1DA1F2', emoji: '🐦', healthKey: 'socialfeed',       free: true },
    // New 9 sources (all free tier)
    POLITICIAN_TRADES:  { label: 'Politician Trades', color: '#9333EA', emoji: '🏛️', healthKey: 'politiciantrades', free: true },
    INSIDER_FLOW:       { label: 'Insider Flow',      color: '#DC2626', emoji: '👔', healthKey: 'insiderflow',      free: true },
    ANALYST_RATINGS:    { label: 'Analyst Ratings',   color: '#2563EB', emoji: '📊', healthKey: 'analystratings',   free: true },
    ETF_FLOWS:          { label: 'ETF Flows',         color: '#059669', emoji: '📦', healthKey: 'etfflows',         free: true },
    OPTIONS_UNUSUAL:    { label: 'Unusual Options',   color: '#D97706', emoji: '🎯', healthKey: 'optionsunusual',   free: true },
    DARK_POOL:          { label: 'Dark Pool',         color: '#374151', emoji: '🌑', healthKey: 'darkpool',         free: true },
    MACRO_SENTIMENT:    { label: 'Macro Sentiment',   color: '#7C3AED', emoji: '🌍', healthKey: 'macrosentiment',   free: true },
    TECHNICAL_LEVELS:   { label: 'Technical Levels',  color: '#0891B2', emoji: '📐', healthKey: 'technicallevels',  free: true },
    VOLATILITY:         { label: 'Volatility',        color: '#E11D48', emoji: '📈', healthKey: 'volatility',       free: true },
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
