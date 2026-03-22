import { NextResponse } from 'next/server';

type BrokerType = 'ALPACA' | 'OANDA' | 'IBKR' | 'TASTYTRADE' | 'TRADOVATE';

interface ConnectionStatus {
  brokerType: BrokerType;
  connected: boolean;
  isPaper: boolean;
  supportedMarkets: string[];
  lastError?: string;
}

/**
 * GET /api/broker/status
 * Returns connection status for all configured brokers
 */
export async function GET() {
  const brokers: ConnectionStatus[] = [];

  // Check Alpaca
  if (process.env.APCA_API_KEY_ID && process.env.APCA_API_SECRET_KEY) {
    const isPaper = process.env.APCA_API_BASE_URL?.includes('paper') ?? true;
    brokers.push({
      brokerType: 'ALPACA',
      connected: true,
      isPaper,
      supportedMarkets: ['EQUITY', 'OPTIONS', 'CRYPTO'],
    });
  }

  // Check OANDA
  if (process.env.OANDA_API_TOKEN && process.env.OANDA_ACCOUNT_ID) {
    const isPaper = process.env.OANDA_ENVIRONMENT === 'practice';
    brokers.push({
      brokerType: 'OANDA',
      connected: true,
      isPaper,
      supportedMarkets: ['FOREX'],
    });
  }

  // Check Tastytrade
  if (process.env.TASTYTRADE_USERNAME && process.env.TASTYTRADE_PASSWORD) {
    const isPaper = process.env.TASTYTRADE_ENVIRONMENT === 'cert';
    brokers.push({
      brokerType: 'TASTYTRADE',
      connected: true,
      isPaper,
      supportedMarkets: ['EQUITY', 'OPTIONS', 'FUTURES'],
    });
  }

  // Check Tradovate
  if (process.env.TRADOVATE_ACCESS_TOKEN) {
    const isPaper = process.env.TRADOVATE_ENVIRONMENT === 'demo';
    brokers.push({
      brokerType: 'TRADOVATE',
      connected: true,
      isPaper,
      supportedMarkets: ['FUTURES'],
    });
  }

  // Check IBKR (just check if gateway URL is set)
  if (process.env.IBKR_GATEWAY_URL) {
    brokers.push({
      brokerType: 'IBKR',
      connected: true, // Would need actual health check
      isPaper: process.env.IBKR_ENVIRONMENT === 'paper',
      supportedMarkets: ['EQUITY', 'OPTIONS', 'FUTURES', 'FOREX', 'CRYPTO'],
    });
  }

  return NextResponse.json({ success: true, brokers });
}
