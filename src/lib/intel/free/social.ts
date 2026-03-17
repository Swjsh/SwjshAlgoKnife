// ═══════════════════════════════════════════════════════════════
// SOCIAL FEED — Free Twitter/X & News Intelligence
// "The market moves on tweets before charts."
//
// Polls free RSS proxies for high-impact social accounts:
//   - @realDonaldTrump  (tariffs, executive orders, crypto policy)
//   - @elonmusk         (Tesla, DOGE, crypto market mover)
//   - @unusual_whales   (options flow, unusual activity alerts)
//   - @faaborges (FastStockNewsNow) (breaking market news)
//   - @DeItaone          (Walter Bloomberg — fastest headlines)
//
// Uses multiple RSS proxy fallbacks:
//   1. RSSHub public instances
//   2. Nitter instances (self-hosted Twitter frontend with RSS)
//   3. RSS.app free tier
//
// Zero cost. No API keys. No Twitter/X API needed.
// ═══════════════════════════════════════════════════════════════

import intelBus from '../bus';
import type { IntelSignal, IntelDirection } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SocialAccount {
    /** Twitter/X handle (without @) */
    handle: string;
    /** Display name for logs/UI */
    displayName: string;
    /** How much weight this account's tweets carry (0-1) */
    baseConfidence: number;
    /** Which symbols this account typically moves */
    defaultSymbols: string[];
    /** Account category for keyword tuning */
    category: 'POLITICS' | 'CRYPTO' | 'OPTIONS' | 'NEWS';
}

interface ParsedTweet {
    title: string;
    link: string;
    pubDate: string;
    author: string;
}

interface SocialFeedState {
    running: boolean;
    startedAt: string | null;
    signalsPublished: number;
    lastPoll: string | null;
    errors: string | null;
    /** Track last seen tweet per account to avoid reprocessing */
    lastSeenId: Record<string, string>;
    /** RSS proxy health: which proxies are working */
    proxyHealth: Record<string, 'OK' | 'FAIL' | 'UNTESTED'>;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ACCOUNTS: SocialAccount[] = [
    {
        handle: 'realDonaldTrump',
        displayName: 'Donald Trump',
        baseConfidence: 0.75,
        defaultSymbols: ['BTCUSD', 'ETHUSD', 'EURUSD'],
        category: 'POLITICS',
    },
    {
        handle: 'elikiark',  // Elon's active account
        displayName: 'Elon Musk',
        baseConfidence: 0.65,
        defaultSymbols: ['BTCUSD', 'ETHUSD'],
        category: 'CRYPTO',
    },
    {
        handle: 'unusual_whales',
        displayName: 'Unusual Whales',
        baseConfidence: 0.70,
        defaultSymbols: ['BTCUSD', 'ETHUSD'],
        category: 'OPTIONS',
    },
    {
        handle: 'FastStockNewsN',
        displayName: 'Fast Stock News',
        baseConfidence: 0.60,
        defaultSymbols: ['BTCUSD', 'ETHUSD', 'EURUSD', 'GBPUSD'],
        category: 'NEWS',
    },
    {
        handle: 'DeItaone',
        displayName: 'Walter Bloomberg',
        baseConfidence: 0.65,
        defaultSymbols: ['BTCUSD', 'ETHUSD', 'EURUSD', 'GBPUSD'],
        category: 'NEWS',
    },
];

/** RSS proxy URL generators for Twitter/X — tried in order, first success wins */
const RSS_PROXIES = [
    (handle: string) => `https://rsshub.app/twitter/user/${handle}`,
    (handle: string) => `https://nitter.privacydev.net/${handle}/rss`,
    (handle: string) => `https://nitter.poast.org/${handle}/rss`,
    (handle: string) => `https://twiiit.com/${handle}/rss`,
];

// ─── Direct RSS Channels (no proxy needed) ───────────────────────────────────
// Reddit and SEC EDGAR are public feeds with stable URLs.

interface RSSChannel {
    /** Unique key for dedup tracking and state */
    name: string;
    /** Feed URL — fetched directly, no Twitter proxy needed */
    url: string;
    /** Display label for logs/UI */
    displayName: string;
    baseConfidence: number;
    defaultSymbols: string[];
    category: 'SOCIAL' | 'NEWS' | 'FILINGS';
    /** Custom request headers */
    headers: Record<string, string>;
}

const RSS_CHANNELS: RSSChannel[] = [
    {
        name: 'reddit_wsb',
        // Public Reddit RSS — no auth, no key, 60 req/min generous limit
        url: 'https://www.reddit.com/r/wallstreetbets/new/.rss',
        displayName: 'Reddit r/WallStreetBets',
        baseConfidence: 0.45,
        defaultSymbols: ['BTCUSD', 'ETHUSD'],   // crypto correlation via sentiment
        category: 'SOCIAL',
        headers: { 'User-Agent': 'SwjshAK-Intel/1.0 (research bot)' },
    },
    {
        name: 'sec_edgar_8k',
        // SEC EDGAR public Atom feed — all 8-K corporate filings, no key required
        url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&dateb=&owner=include&count=40&search_text=&output=atom',
        displayName: 'SEC EDGAR 8-K',
        baseConfidence: 0.55,
        defaultSymbols: [],  // keywords determine relevant symbols below
        category: 'FILINGS',
        headers: { 'User-Agent': 'SwjshAK-Intel/1.0 (research bot)' },
    },
];

const POLL_INTERVAL = 2 * 60 * 1000; // 2 minutes

// ─── Keyword Dictionaries ─────────────────────────────────────────────────────
// Market-moving keywords with direction hints and confidence boosters

interface KeywordRule {
    pattern: RegExp;
    direction: IntelDirection;
    confidenceBoost: number;
    /** Override default symbols for this keyword */
    symbols?: string[];
    /** Human-readable tag */
    tag: string;
}

const KEYWORD_RULES: KeywordRule[] = [
    // ── Crypto-specific ──
    { pattern: /\bbitcoin\b/i,                    direction: 'ALERT',   confidenceBoost: 0.1,  symbols: ['BTCUSD'], tag: 'Bitcoin' },
    { pattern: /\b(btc|crypto)\b/i,               direction: 'ALERT',   confidenceBoost: 0.1,  symbols: ['BTCUSD', 'ETHUSD'], tag: 'Crypto' },
    { pattern: /\bethereum\b|\beth\b/i,            direction: 'ALERT',   confidenceBoost: 0.1,  symbols: ['ETHUSD'], tag: 'Ethereum' },
    { pattern: /\bdoge(coin)?\b/i,                 direction: 'ALERT',   confidenceBoost: 0.15, symbols: ['BTCUSD'], tag: 'DOGE' },
    { pattern: /\bcrypto.*(ban|crack|regulate)/i,  direction: 'BEARISH', confidenceBoost: 0.25, symbols: ['BTCUSD', 'ETHUSD'], tag: 'Crypto Regulation' },
    { pattern: /\bcrypto.*(adopt|reserve|legal)/i, direction: 'BULLISH', confidenceBoost: 0.25, symbols: ['BTCUSD', 'ETHUSD'], tag: 'Crypto Adoption' },
    { pattern: /\bstrategic.*reserve\b/i,          direction: 'BULLISH', confidenceBoost: 0.3,  symbols: ['BTCUSD'], tag: 'Strategic Reserve' },

    // ── Macro / Fed ──
    { pattern: /\b(rate cut|dovish|easing)\b/i,          direction: 'BULLISH', confidenceBoost: 0.2, tag: 'Dovish' },
    { pattern: /\b(rate hike|hawkish|tightening)\b/i,    direction: 'BEARISH', confidenceBoost: 0.2, tag: 'Hawkish' },
    { pattern: /\bfed(eral reserve)?\b/i,                 direction: 'ALERT',   confidenceBoost: 0.15, tag: 'Fed' },
    { pattern: /\bfomc\b/i,                               direction: 'ALERT',   confidenceBoost: 0.2,  tag: 'FOMC' },
    { pattern: /\binflation\b/i,                           direction: 'ALERT',   confidenceBoost: 0.15, tag: 'Inflation' },
    { pattern: /\bcpi\b/i,                                 direction: 'ALERT',   confidenceBoost: 0.2,  tag: 'CPI' },

    // ── Tariffs & Trade War ──
    { pattern: /\btariff/i,                       direction: 'BEARISH', confidenceBoost: 0.25, tag: 'Tariff' },
    { pattern: /\btrade war\b/i,                  direction: 'BEARISH', confidenceBoost: 0.25, tag: 'Trade War' },
    { pattern: /\bsanction/i,                     direction: 'BEARISH', confidenceBoost: 0.2,  tag: 'Sanctions' },
    { pattern: /\btrade deal\b/i,                 direction: 'BULLISH', confidenceBoost: 0.2,  tag: 'Trade Deal' },

    // ── Geopolitical ──
    { pattern: /\b(war|invasion|attack|missile|bomb)/i,   direction: 'BEARISH', confidenceBoost: 0.3, tag: 'Geopolitical Risk' },
    { pattern: /\bceasefire\b|peace\s*deal/i,              direction: 'BULLISH', confidenceBoost: 0.2, tag: 'Peace Signal' },

    // ── Options flow (Unusual Whales style) ──
    { pattern: /\bbullish\b.*\b(sweep|flow|call)/i,  direction: 'BULLISH', confidenceBoost: 0.2, tag: 'Bullish Flow' },
    { pattern: /\bbearish\b.*\b(sweep|flow|put)/i,   direction: 'BEARISH', confidenceBoost: 0.2, tag: 'Bearish Flow' },
    { pattern: /\b(unusual|large)\b.*\b(call|put)/i,  direction: 'ALERT',   confidenceBoost: 0.15, tag: 'Unusual Activity' },
    { pattern: /\bdark pool\b/i,                       direction: 'ALERT',   confidenceBoost: 0.15, tag: 'Dark Pool' },

    // ── Market events ──
    { pattern: /\bcrash(ing|ed)?\b/i,             direction: 'BEARISH', confidenceBoost: 0.3,  tag: 'Crash' },
    { pattern: /\b(pump(ing)?|moon|rally)\b/i,    direction: 'BULLISH', confidenceBoost: 0.15, tag: 'Pump/Rally' },
    { pattern: /\b(dump(ing)?|plunge|tank)\b/i,   direction: 'BEARISH', confidenceBoost: 0.2,  tag: 'Dump/Plunge' },
    { pattern: /\bhalt(ed)?\b/i,                   direction: 'ALERT',   confidenceBoost: 0.25, tag: 'Halt' },
    { pattern: /\bliquidat/i,                      direction: 'BEARISH', confidenceBoost: 0.2,  symbols: ['BTCUSD', 'ETHUSD'], tag: 'Liquidation' },
    { pattern: /\bshort squeeze\b/i,               direction: 'BULLISH', confidenceBoost: 0.25, tag: 'Short Squeeze' },

    // ── Company / Equity (crosses into crypto correlation) ──
    { pattern: /\btesla\b/i,                       direction: 'ALERT',   confidenceBoost: 0.1,  tag: 'Tesla' },
    { pattern: /\bsec\b.*\b(sue|charge|fine)/i,   direction: 'BEARISH', confidenceBoost: 0.2,  symbols: ['BTCUSD', 'ETHUSD'], tag: 'SEC Action' },
    { pattern: /\betf\b.*\bapprov/i,               direction: 'BULLISH', confidenceBoost: 0.3,  symbols: ['BTCUSD', 'ETHUSD'], tag: 'ETF Approval' },

    // ── ECB / EUR (EURUSD-specific) ──────────────────────────
    // These rules always resolve to ['EURUSD'] regardless of account's defaultSymbols.
    { pattern: /\becb\b|\beuropean central bank\b/i,                     direction: 'ALERT',   confidenceBoost: 0.20, symbols: ['EURUSD'], tag: 'ECB' },
    { pattern: /\blagarde\b/i,                                            direction: 'ALERT',   confidenceBoost: 0.15, symbols: ['EURUSD'], tag: 'ECB President' },
    { pattern: /\beuroz/i,                                                direction: 'ALERT',   confidenceBoost: 0.15, symbols: ['EURUSD'], tag: 'Eurozone' },
    { pattern: /\beur.*(rate|decision|cut|hike|hold)\b/i,                direction: 'ALERT',   confidenceBoost: 0.20, symbols: ['EURUSD'], tag: 'EUR Rate' },
    { pattern: /\beuro.*(cut|hike|dovish|hawkish|decision)\b/i,          direction: 'ALERT',   confidenceBoost: 0.20, symbols: ['EURUSD'], tag: 'EUR Policy' },
    { pattern: /\bgrexit\b/i,                                             direction: 'BEARISH', confidenceBoost: 0.30, symbols: ['EURUSD'], tag: 'Eurozone Risk' },

    // ── BOE / GBP (GBPUSD-specific) ──────────────────────────
    { pattern: /\bboe\b|\bbank of england\b/i,                            direction: 'ALERT',   confidenceBoost: 0.20, symbols: ['GBPUSD'], tag: 'BOE' },
    { pattern: /\bbailey\b/i,                                             direction: 'ALERT',   confidenceBoost: 0.15, symbols: ['GBPUSD'], tag: 'BOE Governor' },
    { pattern: /\bgbp.*(rate|cut|hike|decision|hold)\b/i,                direction: 'ALERT',   confidenceBoost: 0.20, symbols: ['GBPUSD'], tag: 'GBP Rate' },
    { pattern: /\bbrexit\b/i,                                             direction: 'ALERT',   confidenceBoost: 0.20, symbols: ['GBPUSD'], tag: 'Brexit' },
    { pattern: /\bpound sterling\b|\bsterling.*(weak|fall|rise|strong)\b/i, direction: 'ALERT', confidenceBoost: 0.15, symbols: ['GBPUSD'], tag: 'Sterling' },
    { pattern: /\buk.*(inflation|cpi|gdp|recession|interest rate)\b/i,   direction: 'ALERT',   confidenceBoost: 0.20, symbols: ['GBPUSD'], tag: 'UK Macro' },

    // ── SEC EDGAR / Corporate crypto-adjacent events ──────────
    { pattern: /\bcoinbase\b|\bkraken\b|\bgemini\b/i,                    direction: 'ALERT',   confidenceBoost: 0.20, symbols: ['BTCUSD', 'ETHUSD'], tag: 'Crypto Exchange' },
    { pattern: /\bmicrostrategy\b|\bstrategy.*bitcoin\b/i,               direction: 'ALERT',   confidenceBoost: 0.20, symbols: ['BTCUSD'], tag: 'MicroStrategy' },
    { pattern: /\b(bitcoin|ethereum|crypto).*(treasury|holding|reserve)\b/i, direction: 'BULLISH', confidenceBoost: 0.25, symbols: ['BTCUSD', 'ETHUSD'], tag: 'Corp Crypto Treasury' },
    { pattern: /\bblockchain.*\b(acquisition|merger|deal)\b/i,           direction: 'BULLISH', confidenceBoost: 0.15, symbols: ['BTCUSD'], tag: 'Blockchain M&A' },
];

// ─── State ────────────────────────────────────────────────────────────────────

const socialState: SocialFeedState = {
    running: false,
    startedAt: null,
    signalsPublished: 0,
    lastPoll: null,
    errors: null,
    lastSeenId: {},
    proxyHealth: {},
};

let pollTimer: ReturnType<typeof setInterval> | null = null;
let rssChannelTimer: ReturnType<typeof setInterval> | null = null;

const RSS_CHANNEL_INTERVAL = 5 * 60 * 1000; // 5 minutes (EDGAR/Reddit refresh rate)

// ─── RSS Parsing ──────────────────────────────────────────────────────────────

/**
 * Minimal XML/RSS parser — extracts <item> elements from RSS feed.
 * No external XML library needed. Works with RSS 2.0 and Atom feeds
 * from RSSHub/Nitter.
 */
function parseRSS(xml: string): ParsedTweet[] {
    const items: ParsedTweet[] = [];

    // Match <item>...</item> blocks (RSS 2.0)
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1];

        const title = extractTag(block, 'title') || extractTag(block, 'description') || '';
        const link = extractTag(block, 'link') || extractTag(block, 'guid') || '';
        const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'dc:date') || '';
        const author = extractTag(block, 'dc:creator') || extractTag(block, 'author') || '';

        if (title.trim()) {
            items.push({
                title: decodeHTMLEntities(title.trim()),
                link: link.trim(),
                pubDate: pubDate.trim(),
                author: author.trim(),
            });
        }
    }

    // Also try Atom <entry> format (some Nitter instances use this)
    if (items.length === 0) {
        const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
        while ((match = entryRegex.exec(xml)) !== null) {
            const block = match[1];
            const title = extractTag(block, 'title') || extractTag(block, 'summary') || '';
            const linkMatch = block.match(/<link[^>]*href="([^"]*)"[^>]*\/>/);
            const link = linkMatch ? linkMatch[1] : '';
            const pubDate = extractTag(block, 'published') || extractTag(block, 'updated') || '';

            if (title.trim()) {
                items.push({
                    title: decodeHTMLEntities(title.trim()),
                    link: link.trim(),
                    pubDate: pubDate.trim(),
                    author: '',
                });
            }
        }
    }

    return items;
}

function extractTag(xml: string, tag: string): string | null {
    // Handle CDATA sections
    const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
    const cdataMatch = xml.match(cdataRegex);
    if (cdataMatch) return cdataMatch[1];

    // Standard tag
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
    const m = xml.match(regex);
    return m ? m[1] : null;
}

function decodeHTMLEntities(str: string): string {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/<[^>]+>/g, ' ')  // Strip HTML tags
        .replace(/\s+/g, ' ')
        .trim();
}

// ─── Tweet Analysis ───────────────────────────────────────────────────────────

interface TweetAnalysis {
    direction: IntelDirection;
    confidence: number;
    matchedTags: string[];
    symbols: string[];
}

/**
 * Analyze tweet text against keyword rules to determine
 * market direction and confidence.
 */
function analyzeTweet(text: string, account: SocialAccount): TweetAnalysis {
    let bestDirection: IntelDirection = 'ALERT';
    let totalBoost = 0;
    const matchedTags: string[] = [];
    const symbolSet = new Set<string>(account.defaultSymbols);

    for (const rule of KEYWORD_RULES) {
        if (rule.pattern.test(text)) {
            matchedTags.push(rule.tag);
            totalBoost += rule.confidenceBoost;

            // Directional rules override ALERT
            if (rule.direction !== 'ALERT') {
                bestDirection = rule.direction;
            }

            // Add rule-specific symbols
            if (rule.symbols) {
                rule.symbols.forEach(s => symbolSet.add(s));
            }
        }
    }

    // If no keywords matched, this tweet is probably not market-relevant
    if (matchedTags.length === 0) {
        return {
            direction: 'NEUTRAL',
            confidence: 0,
            matchedTags: [],
            symbols: [],
        };
    }

    const confidence = Math.min(0.95, account.baseConfidence + totalBoost);

    return {
        direction: bestDirection,
        confidence,
        matchedTags,
        symbols: Array.from(symbolSet),
    };
}

// ─── Fetch with Proxy Fallback ────────────────────────────────────────────────

async function fetchRSS(handle: string): Promise<string | null> {
    for (const proxyFn of RSS_PROXIES) {
        const url = proxyFn(handle);
        const proxyKey = url.split('/')[2]; // domain as key

        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'SwjshAK-Intel/1.0 (Trading Bot)',
                    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                },
            });

            clearTimeout(timer);

            if (!res.ok) {
                socialState.proxyHealth[proxyKey] = 'FAIL';
                continue;
            }

            const text = await res.text();
            if (!text.includes('<item') && !text.includes('<entry')) {
                socialState.proxyHealth[proxyKey] = 'FAIL';
                continue;
            }

            socialState.proxyHealth[proxyKey] = 'OK';
            return text;
        } catch {
            socialState.proxyHealth[proxyKey] = 'FAIL';
            continue;
        }
    }

    return null; // All proxies failed
}

// ─── Direct RSS Fetcher ───────────────────────────────────────────────────────
// Used for channels that don't need Twitter proxy fallback (Reddit, SEC EDGAR).

async function fetchDirectRSS(
    url: string,
    headers: Record<string, string> = {},
): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml, */*',
                ...headers,
            },
        });

        clearTimeout(timer);
        if (!res.ok) return null;

        const text = await res.text();
        if (!text.includes('<item') && !text.includes('<entry')) return null;

        return text;
    } catch {
        return null;
    }
}

// ─── Direct RSS Channel Poll Loop ────────────────────────────────────────────

async function pollRSSChannels(): Promise<void> {
    // 1-hour lookback — filings and posts stay relevant longer than tweets
    const cutoffMs = 60 * 60 * 1000;
    const now = Date.now();
    let totalNew = 0;

    for (const channel of RSS_CHANNELS) {
        try {
            const xml = await fetchDirectRSS(channel.url, channel.headers);
            if (!xml) {
                console.log(`📡 [Social] No feed data for ${channel.displayName} — skipping`);
                continue;
            }

            const items = parseRSS(xml);
            const lastSeen = socialState.lastSeenId[channel.name] || '';
            let newLastSeen = lastSeen;

            for (const item of items) {
                const itemId = item.link || item.title.substring(0, 60);
                if (itemId === lastSeen) break;

                if (!newLastSeen || newLastSeen === lastSeen) {
                    newLastSeen = itemId;
                }

                if (item.pubDate) {
                    const itemTime = new Date(item.pubDate).getTime();
                    if (now - itemTime > cutoffMs) continue;
                }

                // Re-use analyzeTweet by passing a minimal SocialAccount-shaped object
                const pseudoAccount: SocialAccount = {
                    handle: channel.name,
                    displayName: channel.displayName,
                    baseConfidence: channel.baseConfidence,
                    defaultSymbols: channel.defaultSymbols,
                    category: channel.category === 'FILINGS' ? 'NEWS' : 'NEWS',
                };

                const analysis = analyzeTweet(item.title, pseudoAccount);
                if (analysis.matchedTags.length === 0) continue;

                for (const symbol of analysis.symbols) {
                    const id = intelBus.publish({
                        source: 'SOCIAL_FEED',
                        symbol,
                        direction: analysis.direction,
                        confidence: analysis.confidence,
                        summary: `[${channel.displayName}] "${item.title.substring(0, 120)}${item.title.length > 120 ? '...' : ''}" [${analysis.matchedTags.join(', ')}]`,
                        payload: {
                            channel: channel.name,
                            displayName: channel.displayName,
                            category: channel.category,
                            url: item.link,
                            matchedKeywords: analysis.matchedTags,
                            rawText: item.title.substring(0, 280),
                            pubDate: item.pubDate,
                        },
                    } as IntelSignal);

                    if (id !== -1) {
                        socialState.signalsPublished++;
                        totalNew++;
                    }
                }
            }

            socialState.lastSeenId[channel.name] = newLastSeen;
            await new Promise(r => setTimeout(r, 500));

        } catch (err: any) {
            console.error(`📡 [Social] Error polling ${channel.displayName}: ${err.message}`);
        }
    }

    if (totalNew > 0) {
        console.log(`📡 [Social] Published ${totalNew} new signals from RSS channels`);
    } else {
        console.log(`📡 [Social] RSS channels polled — no new market-relevant items`);
    }
}

// ─── Core Poll Loop ───────────────────────────────────────────────────────────

async function pollSocialFeeds(): Promise<void> {
    try {
        const cutoffMs = 30 * 60 * 1000; // Only process tweets from last 30 min
        const now = Date.now();
        let totalNew = 0;

        for (const account of ACCOUNTS) {
            try {
                const xml = await fetchRSS(account.handle);
                if (!xml) {
                    console.log(`🐦 [Social] No RSS data for @${account.handle} (all proxies failed)`);
                    continue;
                }

                const tweets = parseRSS(xml);
                const lastSeen = socialState.lastSeenId[account.handle] || '';
                let newLastSeen = lastSeen;

                for (const tweet of tweets) {
                    // Skip already-processed tweets
                    const tweetId = tweet.link || tweet.title.substring(0, 60);
                    if (tweetId === lastSeen) break; // RSS is ordered newest first

                    // Track the newest tweet we've seen
                    if (!newLastSeen || newLastSeen === lastSeen) {
                        newLastSeen = tweetId;
                    }

                    // Skip old tweets (beyond cutoff window)
                    if (tweet.pubDate) {
                        const tweetTime = new Date(tweet.pubDate).getTime();
                        if (now - tweetTime > cutoffMs) continue;
                    }

                    // Analyze for market relevance
                    const analysis = analyzeTweet(tweet.title, account);

                    // Skip non-market tweets (no keyword matches)
                    if (analysis.matchedTags.length === 0) continue;

                    // Publish signal for each relevant symbol
                    for (const symbol of analysis.symbols) {
                        const id = intelBus.publish({
                            source: 'SOCIAL_FEED',
                            symbol,
                            direction: analysis.direction,
                            confidence: analysis.confidence,
                            summary: `@${account.handle}: "${tweet.title.substring(0, 120)}${tweet.title.length > 120 ? '...' : ''}" [${analysis.matchedTags.join(', ')}]`,
                            payload: {
                                handle: account.handle,
                                displayName: account.displayName,
                                category: account.category,
                                tweetUrl: tweet.link,
                                matchedKeywords: analysis.matchedTags,
                                rawText: tweet.title.substring(0, 280),
                                pubDate: tweet.pubDate,
                            },
                        } as IntelSignal);

                        if (id !== -1) {
                            socialState.signalsPublished++;
                            totalNew++;
                        }
                    }
                }

                socialState.lastSeenId[account.handle] = newLastSeen;

                // Small delay between accounts to be nice to proxies
                await new Promise(r => setTimeout(r, 500));
            } catch (err: any) {
                console.error(`🐦 [Social] Error polling @${account.handle}: ${err.message}`);
            }
        }

        socialState.lastPoll = new Date().toISOString();
        socialState.errors = null;

        // Heartbeat
        intelBus.heartbeat('socialfeed', socialState.signalsPublished);

        if (totalNew > 0) {
            console.log(`🐦 [Social] Published ${totalNew} new social signals`);
        } else {
            console.log(`🐦 [Social] Poll complete — no new market-relevant tweets`);
        }
    } catch (err: any) {
        socialState.errors = err.message;
        console.error(`🐦 [Social] Feed error: ${err.message}`);
    }
}

// ─── Service Control ──────────────────────────────────────────────────────────

export function startSocialFeed(): SocialFeedState {
    if (socialState.running) return socialState;

    console.log('🐦 [Social] Starting social intelligence feed...');
    console.log(`🐦 [Social] Watching: ${ACCOUNTS.map(a => '@' + a.handle).join(', ')}`);
    console.log(`📡 [Social] RSS channels: ${RSS_CHANNELS.map(c => c.displayName).join(', ')}`);

    socialState.running = true;
    socialState.startedAt = new Date().toISOString();

    // Initial heartbeat
    intelBus.heartbeat('socialfeed', 0);

    // First polls immediately
    pollSocialFeeds();
    pollRSSChannels();

    // Then on interval
    pollTimer = setInterval(pollSocialFeeds, POLL_INTERVAL);
    rssChannelTimer = setInterval(pollRSSChannels, RSS_CHANNEL_INTERVAL);

    return socialState;
}

export function stopSocialFeed(): SocialFeedState {
    if (!socialState.running) return socialState;

    console.log('🐦 [Social] Stopping social feed...');
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    if (rssChannelTimer) {
        clearInterval(rssChannelTimer);
        rssChannelTimer = null;
    }
    socialState.running = false;

    return socialState;
}

export function getSocialFeedStatus(): SocialFeedState {
    return { ...socialState };
}

export function getSocialAccounts(): SocialAccount[] {
    return [...ACCOUNTS];
}
