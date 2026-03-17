/**
 * OANDA v20 REST API Client
 * 
 * Handles forex data and paper trading via OANDA demo account.
 * Docs: https://developer.oanda.com/rest-live-v20/introduction/
 */

export interface OandaConfig {
  accountId: string;
  apiToken: string;
  environment: 'practice' | 'live';
}

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  complete: boolean;
}

export interface Position {
  instrument: string;
  units: number;
  averagePrice: number;
  unrealizedPL: number;
}

export interface Order {
  id: string;
  instrument: string;
  units: number;
  type: 'MARKET' | 'LIMIT' | 'STOP';
  price?: number;
  stopLossOnFill?: { price: string };
  takeProfitOnFill?: { price: string };
}

export interface AccountSummary {
  id: string;
  balance: number;
  unrealizedPL: number;
  NAV: number;
  marginUsed: number;
  marginAvailable: number;
  positionValue: number;
  openTradeCount: number;
}

// Timeframe mapping: our names → OANDA granularity
export const TIMEFRAMES = {
  '1m': 'M1',
  '5m': 'M5',
  '15m': 'M15',
  '30m': 'M30',
  '1h': 'H1',
  '2h': 'H2',
  '4h': 'H4',
  '1d': 'D',
  '1w': 'W',
  '1M': 'M',
} as const;

export type Timeframe = keyof typeof TIMEFRAMES;

// Common forex pairs
export const FOREX_PAIRS = [
  'EUR_USD', 'GBP_USD', 'USD_JPY', 'USD_CHF',
  'AUD_USD', 'NZD_USD', 'USD_CAD',
  'EUR_GBP', 'EUR_JPY', 'GBP_JPY',
  'EUR_AUD', 'EUR_CAD', 'EUR_CHF',
  'AUD_JPY', 'AUD_CAD', 'AUD_NZD',
  'CAD_JPY', 'CHF_JPY', 'NZD_JPY',
  'GBP_AUD', 'GBP_CAD', 'GBP_CHF',
] as const;

export class OandaClient {
  private baseUrl: string;
  private headers: HeadersInit;
  private accountId: string;

  constructor(config: OandaConfig) {
    this.accountId = config.accountId;
    this.baseUrl = config.environment === 'practice'
      ? 'https://api-fxpractice.oanda.com/v3'
      : 'https://api-fxtrade.oanda.com/v3';
    
    this.headers = {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create client from environment variables
   */
  static fromEnv(): OandaClient {
    const accountId = process.env.OANDA_ACCOUNT_ID;
    const apiToken = process.env.OANDA_API_TOKEN;
    const environment = (process.env.OANDA_ENVIRONMENT || 'practice') as 'practice' | 'live';

    if (!accountId || !apiToken) {
      throw new Error('OANDA_ACCOUNT_ID and OANDA_API_TOKEN must be set in environment');
    }

    return new OandaClient({ accountId, apiToken, environment });
  }

  /**
   * Get account summary (balance, margin, P&L)
   */
  async getAccountSummary(): Promise<AccountSummary> {
    const response = await fetch(
      `${this.baseUrl}/accounts/${this.accountId}/summary`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`OANDA API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const account = data.account;

    return {
      id: account.id,
      balance: parseFloat(account.balance),
      unrealizedPL: parseFloat(account.unrealizedPL),
      NAV: parseFloat(account.NAV),
      marginUsed: parseFloat(account.marginUsed),
      marginAvailable: parseFloat(account.marginAvailable),
      positionValue: parseFloat(account.positionValue),
      openTradeCount: account.openTradeCount,
    };
  }

  /**
   * Get candlestick data for an instrument
   */
  async getCandles(
    instrument: string,
    timeframe: Timeframe,
    count: number = 100
  ): Promise<Candle[]> {
    const granularity = TIMEFRAMES[timeframe];
    const params = new URLSearchParams({
      granularity,
      count: count.toString(),
      price: 'M', // Midpoint prices
    });

    const response = await fetch(
      `${this.baseUrl}/instruments/${instrument}/candles?${params}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`OANDA API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    
    return data.candles.map((c: any) => ({
      time: c.time,
      open: parseFloat(c.mid.o),
      high: parseFloat(c.mid.h),
      low: parseFloat(c.mid.l),
      close: parseFloat(c.mid.c),
      volume: c.volume,
      complete: c.complete,
    }));
  }

  /**
   * Get candles for multiple timeframes at once
   */
  async getMultiTimeframeCandles(
    instrument: string,
    timeframes: Timeframe[],
    count: number = 100
  ): Promise<Record<Timeframe, Candle[]>> {
    const results = await Promise.all(
      timeframes.map(async (tf) => {
        const candles = await this.getCandles(instrument, tf, count);
        return [tf, candles] as const;
      })
    );

    return Object.fromEntries(results) as Record<Timeframe, Candle[]>;
  }

  /**
   * Get current price for an instrument
   */
  async getPrice(instrument: string): Promise<{ bid: number; ask: number; spread: number }> {
    const response = await fetch(
      `${this.baseUrl}/accounts/${this.accountId}/pricing?instruments=${instrument}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`OANDA API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const price = data.prices[0];

    const bid = parseFloat(price.bids[0].price);
    const ask = parseFloat(price.asks[0].price);

    return {
      bid,
      ask,
      spread: ask - bid,
    };
  }

  /**
   * Get all open positions
   */
  async getOpenPositions(): Promise<Position[]> {
    const response = await fetch(
      `${this.baseUrl}/accounts/${this.accountId}/openPositions`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`OANDA API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    
    return data.positions.map((p: any) => ({
      instrument: p.instrument,
      units: parseInt(p.long.units) || parseInt(p.short.units),
      averagePrice: parseFloat(p.long.averagePrice || p.short.averagePrice),
      unrealizedPL: parseFloat(p.unrealizedPL),
    }));
  }

  /**
   * Place a market order with optional SL/TP
   */
  async placeMarketOrder(
    instrument: string,
    units: number, // Positive = buy, negative = sell
    stopLoss?: number,
    takeProfit?: number
  ): Promise<{ orderId: string; tradeId: string }> {
    const order: any = {
      type: 'MARKET',
      instrument,
      units: units.toString(),
      timeInForce: 'FOK', // Fill or kill
    };

    if (stopLoss) {
      order.stopLossOnFill = { price: stopLoss.toFixed(5) };
    }

    if (takeProfit) {
      order.takeProfitOnFill = { price: takeProfit.toFixed(5) };
    }

    const response = await fetch(
      `${this.baseUrl}/accounts/${this.accountId}/orders`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ order }),
      }
    );

    if (!response.ok) {
      throw new Error(`OANDA API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    
    return {
      orderId: data.orderCreateTransaction?.id || '',
      tradeId: data.orderFillTransaction?.tradeOpened?.tradeID || '',
    };
  }

  /**
   * Close a position (all units)
   */
  async closePosition(instrument: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/accounts/${this.accountId}/positions/${instrument}/close`,
      {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify({ longUnits: 'ALL', shortUnits: 'ALL' }),
      }
    );

    if (!response.ok) {
      throw new Error(`OANDA API error: ${response.status} ${await response.text()}`);
    }
  }

  /**
   * Close a specific trade by ID
   */
  async closeTrade(tradeId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/accounts/${this.accountId}/trades/${tradeId}/close`,
      {
        method: 'PUT',
        headers: this.headers,
      }
    );

    if (!response.ok) {
      throw new Error(`OANDA API error: ${response.status} ${await response.text()}`);
    }
  }

  /**
   * Calculate position size based on risk percentage
   */
  calculatePositionSize(
    accountBalance: number,
    riskPercent: number,
    entryPrice: number,
    stopLossPrice: number,
    instrument?: string
  ): number {
    const riskAmount = accountBalance * (riskPercent / 100);
    const stopDistance = Math.abs(entryPrice - stopLossPrice);

    // Dynamic pip value based on instrument type
    // JPY pairs: 1 pip = 0.01, pip value per standard lot ≈ 1000/rate
    // All others: 1 pip = 0.0001, pip value per standard lot ≈ 10 (for USD quote pairs)
    const isJPY = instrument
      ? instrument.toUpperCase().includes('JPY')
      : entryPrice > 50; // Heuristic: JPY pair prices are > 50

    let units: number;
    if (isJPY) {
      // JPY pairs: pip = 0.01, pip value = (0.01 / rate) * 100,000 ≈ 1000/rate
      const pipSize = 0.01;
      const pipsAtRisk = stopDistance / pipSize;
      const pipValuePerUnit = pipSize / entryPrice; // In USD per unit
      units = riskAmount / (pipsAtRisk * pipValuePerUnit);
    } else {
      // Standard pairs: pip = 0.0001
      const pipSize = 0.0001;
      const pipsAtRisk = stopDistance / pipSize;
      // For USD quote pairs (EUR/USD, GBP/USD): pipValue per unit = 0.0001
      // For USD base pairs (USD/CHF, USD/CAD): pipValue = 0.0001 / rate
      const pipValuePerUnit = instrument && instrument.toUpperCase().startsWith('USD')
        ? pipSize / entryPrice
        : pipSize;
      units = riskAmount / (pipsAtRisk * pipValuePerUnit);
    }

    // Return whole units (OANDA accepts fractional lots via units)
    return Math.floor(units);
  }

  /**
   * Test connection to OANDA API
   */
  async testConnection(): Promise<boolean> {
    try {
      const summary = await this.getAccountSummary();
      console.log(`✅ OANDA connected: Account ${summary.id}, Balance: $${summary.balance.toFixed(2)}`);
      return true;
    } catch (error) {
      console.error('❌ OANDA connection failed:', error);
      return false;
    }
  }
}

// Singleton instance for app-wide use
let clientInstance: OandaClient | null = null;

export function getOandaClient(): OandaClient {
  if (!clientInstance) {
    clientInstance = OandaClient.fromEnv();
  }
  return clientInstance;
}

export default OandaClient;
