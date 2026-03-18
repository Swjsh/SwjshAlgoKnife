import { NextResponse } from 'next/server';

// In-memory cache — 30s TTL
let cache: { data: Record<string, number>; ts: number } | null = null;
const CACHE_TTL = 30_000;

const ALPACA_HEADERS = () => ({
    'APCA-API-KEY-ID':     process.env.APCA_API_KEY_ID ?? '',
    'APCA-API-SECRET-KEY': process.env.APCA_API_SECRET_KEY ?? '',
});

// ── Crypto via Alpaca ─────────────────────────────────────────────────────────
async function fetchAlpacaCrypto(): Promise<Record<string, number>> {
    const symbols = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD', 'DOGE/USD'];
    const map: Record<string, string> = {
        'BTC/USD': 'BTC', 'ETH/USD': 'ETH', 'SOL/USD': 'SOL',
        'XRP/USD': 'XRP', 'DOGE/USD': 'DOGE',
    };
    const param = symbols.map(s => encodeURIComponent(s)).join(',');
    const res = await fetch(
        `https://data.alpaca.markets/v1beta3/crypto/us/latest/trades?symbols=${param}`,
        { headers: ALPACA_HEADERS(), next: { revalidate: 0 } }
    );
    if (!res.ok) throw new Error(`Alpaca crypto ${res.status}`);
    const { trades = {} } = await res.json();
    const prices: Record<string, number> = {};
    for (const [sym, ticker] of Object.entries(map)) {
        if ((trades as any)[sym]?.p) prices[ticker] = (trades as any)[sym].p;
    }
    return prices;
}

// ── Equities via Alpaca (last known price — fine on weekends) ─────────────────
async function fetchAlpacaEquities(): Promise<Record<string, number>> {
    const symbols = ['SPY', 'NVDA', 'QQQ'];
    const param   = symbols.join(',');
    // Try IEX first (real-time during market hours), fall back to SIP
    for (const feed of ['iex', '']) {
        const url = `https://data.alpaca.markets/v2/stocks/trades/latest?symbols=${param}${feed ? `&feed=${feed}` : ''}`;
        const res = await fetch(url, { headers: ALPACA_HEADERS(), next: { revalidate: 0 } });
        if (!res.ok) continue;
        const { trades = {} } = await res.json();
        const prices: Record<string, number> = {};
        for (const sym of symbols) {
            if ((trades as any)[sym]?.p) prices[sym] = (trades as any)[sym].p;
        }
        if (Object.keys(prices).length > 0) return prices;
    }
    throw new Error('Alpaca equities failed on all feeds');
}

// ── CoinGecko fallback — no API key required ──────────────────────────────────
async function fetchCoinGecko(): Promise<Record<string, number>> {
    const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple,dogecoin&vs_currencies=usd',
        { next: { revalidate: 0 } }
    );
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const raw = await res.json();
    const map: Record<string, string> = {
        bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', ripple: 'XRP', dogecoin: 'DOGE',
    };
    const prices: Record<string, number> = {};
    for (const [id, ticker] of Object.entries(map)) {
        if ((raw as any)[id]?.usd) prices[ticker] = (raw as any)[id].usd;
    }
    return prices;
}

// ── Yahoo Finance fallback for equities — no API key required ─────────────────
async function fetchYahooEquities(): Promise<Record<string, number>> {
    const symbols = ['SPY', 'NVDA', 'QQQ'];
    const prices: Record<string, number> = {};
    await Promise.all(symbols.map(async sym => {
        try {
            const res = await fetch(
                `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`,
                { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SwjshAK/1.0)' }, next: { revalidate: 0 } }
            );
            if (!res.ok) return;
            const data = await res.json();
            const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
            if (typeof price === 'number' && price > 0) prices[sym] = price;
        } catch { /* per-symbol failure is fine */ }
    }));
    return prices;
}

export async function GET() {
    const now = Date.now();
    if (cache && now - cache.ts < CACHE_TTL) {
        return NextResponse.json({ ...cache.data, _source: 'cache' });
    }

    const hasAlpaca = !!(process.env.APCA_API_KEY_ID && process.env.APCA_API_SECRET_KEY
        && process.env.APCA_API_KEY_ID !== 'your_alpaca_api_key_id');

    let cryptoPrices: Record<string, number> = {};
    let equityPrices: Record<string, number> = {};
    let source = 'free';

    if (hasAlpaca) {
        // ── Alpaca path (authenticated — best data quality) ────────────────────
        const [cryptoResult, equityResult] = await Promise.allSettled([
            fetchAlpacaCrypto(),
            fetchAlpacaEquities(),
        ]);
        if (cryptoResult.status === 'fulfilled') {
            cryptoPrices = cryptoResult.value;
            source = 'alpaca';
        } else {
            console.warn('[/api/prices] Alpaca crypto failed, falling back to CoinGecko:', cryptoResult.reason?.message);
            try { cryptoPrices = await fetchCoinGecko(); source = 'mixed'; } catch {}
        }
        if (equityResult.status === 'fulfilled') {
            equityPrices = equityResult.value;
        } else {
            console.warn('[/api/prices] Alpaca equities failed, falling back to Yahoo Finance:', equityResult.reason?.message);
            try { equityPrices = await fetchYahooEquities(); } catch {}
        }
    } else {
        // ── Free path (no API key needed — always works) ───────────────────────
        const [cryptoResult, equityResult] = await Promise.allSettled([
            fetchCoinGecko(),
            fetchYahooEquities(),
        ]);
        if (cryptoResult.status === 'fulfilled') {
            cryptoPrices = cryptoResult.value;
        } else {
            console.warn('[/api/prices] CoinGecko failed:', (cryptoResult as any).reason?.message);
        }
        if (equityResult.status === 'fulfilled') {
            equityPrices = equityResult.value;
        } else {
            console.warn('[/api/prices] Yahoo Finance failed:', (equityResult as any).reason?.message);
        }
    }

    const prices = { ...cryptoPrices, ...equityPrices };

    if (Object.keys(prices).length === 0) {
        if (cache) return NextResponse.json({ ...cache.data, _source: 'stale' });
        return NextResponse.json({ error: 'All price sources failed' }, { status: 503 });
    }

    cache = { data: prices, ts: now };
    return NextResponse.json({ ...prices, _source: source });
}
