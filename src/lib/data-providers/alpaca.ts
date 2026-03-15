import type { Candle } from '../engine/types';

export type AlpacaFeed = 'iex' | 'sip';

export type AlpacaConfig = {
  apiKey: string;
  secretKey: string;
  /** Trading base url; not used for market data requests, but kept for parity. */
  baseUrl?: string;
  /** Market data base url (defaults to https://data.alpaca.markets). */
  dataUrl?: string;
  feed?: AlpacaFeed;
  /** If true, maps ES/NQ/YM into SPY/QQQ/DIA. */
  useEtfProxy?: boolean;
};

const DEFAULT_DATA_URL = 'https://data.alpaca.markets';

const FUTURES_TO_ETF_PROXY: Record<string, string> = {
  ES: 'SPY',
  NQ: 'QQQ',
  YM: 'DIA',
};

function toQuery(params: Record<string, string | number | undefined>) {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return q ? `?${q}` : '';
}

export class AlpacaDataProvider {
  private cfg: Required<Pick<AlpacaConfig, 'apiKey' | 'secretKey'>> & Omit<AlpacaConfig, 'apiKey' | 'secretKey'>;

  constructor(config: AlpacaConfig) {
    this.cfg = {
      apiKey: config.apiKey,
      secretKey: config.secretKey,
      baseUrl: config.baseUrl || 'https://paper-api.alpaca.markets',
      dataUrl: config.dataUrl || process.env.APCA_DATA_URL || DEFAULT_DATA_URL,
      feed: config.feed || ((process.env.APCA_DATA_FEED as AlpacaFeed) || 'sip'),
      useEtfProxy: config.useEtfProxy ?? true,
    };
  }

  resolveSymbol(input: string): { requested: string; providerSymbol: string; note?: string } {
    const requested = input.toUpperCase();
    if (this.cfg.useEtfProxy && FUTURES_TO_ETF_PROXY[requested]) {
      return {
        requested,
        providerSymbol: FUTURES_TO_ETF_PROXY[requested],
        note: `ETF proxy (${requested}→${FUTURES_TO_ETF_PROXY[requested]})`,
      };
    }
    return { requested, providerSymbol: requested };
  }

  private headers(): Record<string, string> | undefined {
    if (!this.cfg.apiKey || !this.cfg.secretKey) return undefined;
    return {
      'APCA-API-KEY-ID': this.cfg.apiKey,
      'APCA-API-SECRET-KEY': this.cfg.secretKey,
    };
  }

  async testConnection(): Promise<boolean> {
    // Lightweight: hit market-data clock endpoint (no trading rights).
    try {
      const url = `${this.cfg.dataUrl}/v2/stocks/SPY/quotes/latest${toQuery({ feed: this.cfg.feed })}`;
      const res = await fetch(url, { headers: this.headers() });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getLatestQuote(symbol: string): Promise<number> {
    const { providerSymbol } = this.resolveSymbol(symbol);
    const url = `${this.cfg.dataUrl}/v2/stocks/${providerSymbol}/quotes/latest${toQuery({ feed: this.cfg.feed })}`;

    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`Alpaca latest quote failed (${res.status})`);
    const json: any = await res.json();

    // Alpaca schema: { quote: { ap, bp, ... } }
    const q = json?.quote;
    const mid = typeof q?.ap === 'number' && typeof q?.bp === 'number' ? (q.ap + q.bp) / 2 : undefined;
    const px = mid ?? q?.ap ?? q?.bp;
    if (typeof px !== 'number') throw new Error('Alpaca quote missing price');
    return px;
  }

  async getHistoricalBars(
    symbol: string,
    timeframe: '1Min' | '5Min' | '15Min' | '1Hour' | '1Day',
    startIso: string,
    endIso: string,
    limit = 5000
  ): Promise<Candle[]> {
    const { providerSymbol } = this.resolveSymbol(symbol);
    const url = `${this.cfg.dataUrl}/v2/stocks/${providerSymbol}/bars${toQuery({
      timeframe,
      start: startIso,
      end: endIso,
      limit,
      adjustment: 'raw',
      feed: this.cfg.feed,
    })}`;

    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Alpaca bars failed (${res.status}): ${text}`);
    }
    const json: any = await res.json();
    const bars: any[] = json?.bars || [];

    return bars.map((b) => ({
      timestamp: new Date(b.t).toISOString(),
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
      volume: b.v ?? 0,
    } satisfies Candle));
  }
}
