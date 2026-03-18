// ═══════════════════════════════════════════════════════════════
// ECONOMIC EVENT — SYMBOL & CATEGORY MAP
// "Know which markets will shake before the report drops."
//
// Maps event country codes and title keywords to:
//   - Affected trading symbols (EURUSD, BTCUSD, etc.)
//   - Event category (INFLATION, EMPLOYMENT, etc.)
//   - Short display titles for tight UI spaces
// ═══════════════════════════════════════════════════════════════

import type { EventCategory, EventCountry } from './types';

// ─── Country → Affected Symbols ──────────────────────────────────────────────

export const COUNTRY_SYMBOLS: Record<string, string[]> = {
    USD: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCAD', 'AUDUSD', 'BTCUSD', 'ETHUSD'],
    EUR: ['EURUSD'],
    GBP: ['GBPUSD'],
    JPY: ['USDJPY'],
    CAD: ['USDCAD'],
    AUD: ['AUDUSD'],
    NZD: ['NZDUSD'],
    CHF: ['USDCHF'],
};

/** HIGH impact USD events also rattle equities and futures */
export const HIGH_USD_EXTRA_SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD', 'ETHUSD'];

/** All markets affected for FOMC/Fed events */
export const FOMC_SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD', 'ETHUSD', 'USDCAD', 'AUDUSD'];

// ─── Affected Market Classes per Country ─────────────────────────────────────

export const COUNTRY_MARKETS: Record<string, ('FX' | 'CRYPTO' | 'EQUITIES' | 'FUTURES')[]> = {
    USD: ['FX', 'CRYPTO', 'EQUITIES', 'FUTURES'],
    EUR: ['FX'],
    GBP: ['FX'],
    JPY: ['FX'],
    CAD: ['FX'],
    AUD: ['FX'],
    NZD: ['FX'],
    CHF: ['FX'],
};

// ─── Title Keyword → Category ─────────────────────────────────────────────────

interface KeywordRule {
    keywords: string[];
    category: EventCategory;
    shortTitle: string;
    /** Override affected symbols regardless of country */
    symbolOverride?: string[];
}

export const KEYWORD_RULES: KeywordRule[] = [
    // ── Federal Reserve / Central Banks ──────────────────────────────────────
    {
        keywords: ['FOMC', 'Federal Open Market'],
        category: 'CENTRAL_BANK',
        shortTitle: 'FOMC',
        symbolOverride: FOMC_SYMBOLS,
    },
    {
        keywords: ['Fed Chair', 'Powell', 'Federal Reserve Chair', 'FOMC Meeting Minutes'],
        category: 'CENTRAL_BANK',
        shortTitle: 'Fed/Powell',
        symbolOverride: FOMC_SYMBOLS,
    },
    {
        keywords: ['Interest Rate Decision', 'Fed Funds Rate', 'Rate Decision'],
        category: 'CENTRAL_BANK',
        shortTitle: 'Rate Decision',
        symbolOverride: FOMC_SYMBOLS,
    },
    {
        keywords: ['ECB', 'European Central Bank', 'ECB President', 'Lagarde'],
        category: 'CENTRAL_BANK',
        shortTitle: 'ECB',
    },
    {
        keywords: ['BOE', 'Bank of England', 'BOE Governor'],
        category: 'CENTRAL_BANK',
        shortTitle: 'BOE',
    },
    {
        keywords: ['BOJ', 'Bank of Japan', 'BOJ Governor'],
        category: 'CENTRAL_BANK',
        shortTitle: 'BOJ',
    },
    {
        keywords: ['Beige Book'],
        category: 'CENTRAL_BANK',
        shortTitle: 'Beige Book',
        symbolOverride: FOMC_SYMBOLS,
    },

    // ── Inflation ─────────────────────────────────────────────────────────────
    {
        keywords: ['CPI', 'Consumer Price Index', 'Consumer Price'],
        category: 'INFLATION',
        shortTitle: 'CPI',
    },
    {
        keywords: ['PPI', 'Producer Price Index', 'Producer Price'],
        category: 'INFLATION',
        shortTitle: 'PPI',
    },
    {
        keywords: ['PCE', 'Personal Consumption Expenditures', 'Core PCE', 'Personal Spending', 'Personal Income'],
        category: 'INFLATION',
        shortTitle: 'PCE',
        symbolOverride: FOMC_SYMBOLS, // PCE is Fed's preferred inflation gauge — watch everything
    },
    {
        keywords: ['Inflation'],
        category: 'INFLATION',
        shortTitle: 'Inflation',
    },

    // ── Employment ────────────────────────────────────────────────────────────
    {
        keywords: ['Non-Farm', 'Non Farm', 'NFP', 'Nonfarm'],
        category: 'EMPLOYMENT',
        shortTitle: 'NFP',
        symbolOverride: HIGH_USD_EXTRA_SYMBOLS,
    },
    {
        keywords: ['ADP', 'ADP Non-Farm'],
        category: 'EMPLOYMENT',
        shortTitle: 'ADP',
    },
    {
        keywords: ['Unemployment', 'Unemployment Rate', 'Unemployment Claims'],
        category: 'EMPLOYMENT',
        shortTitle: 'Unemployment',
    },
    {
        keywords: ['Jobless Claims', 'Initial Jobless', 'Continuing Claims', 'Initial Claims'],
        category: 'EMPLOYMENT',
        shortTitle: 'Claims',
    },
    {
        keywords: ['JOLTS', 'Job Openings', 'Job Openings and Labor Turnover'],
        category: 'EMPLOYMENT',
        shortTitle: 'JOLTS',
    },
    {
        keywords: ['Employment Change', 'Employment Situation'],
        category: 'EMPLOYMENT',
        shortTitle: 'Employment',
    },

    // ── GDP ───────────────────────────────────────────────────────────────────
    {
        keywords: ['GDP', 'Gross Domestic Product'],
        category: 'GDP',
        shortTitle: 'GDP',
    },

    // ── PMI ───────────────────────────────────────────────────────────────────
    {
        keywords: ['ISM Manufacturing', 'ISM Non-Manufacturing', 'ISM Services', 'ISM PMI'],
        category: 'PMI',
        shortTitle: 'ISM PMI',
    },
    {
        keywords: ['PMI', 'Purchasing Managers', 'Manufacturing PMI', 'Services PMI', 'S&P Global PMI'],
        category: 'PMI',
        shortTitle: 'PMI',
    },

    // ── Retail / Consumer ─────────────────────────────────────────────────────
    {
        keywords: ['Retail Sales'],
        category: 'RETAIL',
        shortTitle: 'Retail Sales',
    },
    {
        keywords: ['Consumer Confidence', 'Consumer Sentiment', 'Michigan'],
        category: 'RETAIL',
        shortTitle: 'Consumer',
    },

    // ── Housing ───────────────────────────────────────────────────────────────
    {
        keywords: ['Housing Starts', 'Building Permits', 'Existing Home Sales', 'New Home Sales', 'Pending Home Sales'],
        category: 'HOUSING',
        shortTitle: 'Housing',
    },

    // ── Trade ─────────────────────────────────────────────────────────────────
    {
        keywords: ['Trade Balance', 'Current Account'],
        category: 'TRADE',
        shortTitle: 'Trade Balance',
    },

    // ── Treasury Auctions ─────────────────────────────────────────────────────
    {
        keywords: ['Bond Auction', '2-Year', '5-Year', '10-Year', '30-Year', 'Treasury'],
        category: 'TREASURY',
        shortTitle: 'Treasury',
    },
];

// ─── Helper: Classify an event ───────────────────────────────────────────────

export interface EventClassification {
    category: EventCategory;
    shortTitle: string;
    symbolOverride?: string[];
}

/**
 * Classify a raw event title into a category, short title, and optional symbol override.
 * Returns fallback values if no keyword matches.
 */
export function classifyEvent(title: string): EventClassification {
    const upper = title.toUpperCase();
    for (const rule of KEYWORD_RULES) {
        if (rule.keywords.some(kw => upper.includes(kw.toUpperCase()))) {
            return {
                category: rule.category,
                shortTitle: rule.shortTitle,
                symbolOverride: rule.symbolOverride,
            };
        }
    }
    return {
        category: 'OTHER',
        shortTitle: title.length > 20 ? title.slice(0, 18) + '…' : title,
    };
}

/**
 * Get the list of symbols affected by an event, given its country and optional override.
 */
export function getAffectedSymbols(country: string, symbolOverride?: string[]): string[] {
    if (symbolOverride && symbolOverride.length > 0) return symbolOverride;
    return COUNTRY_SYMBOLS[country.toUpperCase()] ?? ['EURUSD']; // default to EURUSD
}

/**
 * Get affected market classes for a given country.
 */
export function getAffectedMarkets(country: string): ('FX' | 'CRYPTO' | 'EQUITIES' | 'FUTURES')[] {
    return COUNTRY_MARKETS[country.toUpperCase()] ?? ['FX'];
}

/**
 * Normalize country string to our EventCountry type.
 */
export function normalizeCountry(raw: string): import('./types').EventCountry {
    const upper = raw.toUpperCase().trim();
    const known = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'NZD', 'CHF'];
    return known.includes(upper) ? (upper as import('./types').EventCountry) : 'OTHER';
}

/**
 * Normalize impact string from ForexFactory to our EventImpact type.
 */
export function normalizeImpact(raw: string): import('./types').EventImpact {
    const lower = raw.toLowerCase();
    if (lower === 'high')    return 'HIGH';
    if (lower === 'medium')  return 'MEDIUM';
    if (lower === 'low')     return 'LOW';
    if (lower === 'holiday') return 'HOLIDAY';
    return 'LOW'; // default non-economic events
}
