import { NextRequest, NextResponse } from 'next/server';

type BrokerType = 'ALPACA' | 'OANDA' | 'IBKR' | 'TASTYTRADE' | 'TRADOVATE';

interface BrokerInfo {
  name: string;
  signupUrl: string;
  paperUrl?: string;
  docsUrl: string;
  requirements: string[];
  supportedMarkets: string[];
  features: string[];
  setupSteps: string[];
  oauthUrl?: string;
  notes?: string;
}

const BROKER_INFO: Record<BrokerType, BrokerInfo> = {
  ALPACA: {
    name: 'Alpaca',
    signupUrl: 'https://app.alpaca.markets/signup',
    paperUrl: 'https://app.alpaca.markets/paper/dashboard/overview',
    docsUrl: 'https://alpaca.markets/docs/trading/',
    requirements: ['API Key ID', 'API Secret Key'],
    supportedMarkets: ['EQUITY', 'OPTIONS', 'CRYPTO'],
    features: [
      'Commission-free stock trading',
      'Options trading (new)',
      'Crypto trading',
      'Real-time market data',
      'Paper trading environment',
      'REST & WebSocket APIs',
    ],
    setupSteps: [
      'Create a free Alpaca account',
      'Go to API Keys in your dashboard',
      'Generate new API keys (paper or live)',
      'Copy the Key ID and Secret Key',
      'Paste them below',
    ],
    notes: 'Paper trading is recommended for testing. API keys are different for paper vs live.',
  },
  OANDA: {
    name: 'OANDA',
    signupUrl: 'https://www.oanda.com/apply/fxtrademember/',
    paperUrl: 'https://www.oanda.com/demo-account/',
    docsUrl: 'https://developer.oanda.com/rest-live-v20/introduction/',
    requirements: ['API Token', 'Account ID'],
    supportedMarkets: ['FOREX'],
    features: [
      'Forex trading (70+ pairs)',
      'Tight spreads',
      'Practice account with $100k virtual funds',
      'REST API v20',
      'Real-time streaming prices',
    ],
    setupSteps: [
      'Create OANDA fxTrade account (or demo)',
      'Go to Manage API Access in account settings',
      'Generate a new API token',
      'Copy your Account ID from the dashboard',
      'Paste both below',
    ],
    notes: 'Use the Practice environment for testing. Demo accounts have $100k virtual funds.',
  },
  TASTYTRADE: {
    name: 'tastytrade',
    signupUrl: 'https://start.tastytrade.com/',
    paperUrl: 'https://trade.tastyworks.com/',
    docsUrl: 'https://developer.tastytrade.com/',
    requirements: ['Username', 'Password'],
    supportedMarkets: ['EQUITY', 'OPTIONS', 'FUTURES'],
    features: [
      'Options-focused platform',
      'Futures trading',
      'Paper trading (cert environment)',
      'Session-based authentication',
      'Real-time streaming',
    ],
    setupSteps: [
      'Create a tastytrade account',
      'Enable API access in account settings',
      'Use your login credentials',
      'Select Paper (cert) or Live environment',
      'Credentials are used to create session token',
    ],
    notes: 'Uses session-based auth. Password is used to obtain session token, not stored.',
  },
  TRADOVATE: {
    name: 'Tradovate',
    signupUrl: 'https://www.tradovate.com/',
    paperUrl: 'https://trader.tradovate.com/',
    docsUrl: 'https://api.tradovate.com/',
    requirements: ['OAuth Access Token'],
    supportedMarkets: ['FUTURES'],
    features: [
      'Futures trading',
      'Cloud-based platform',
      'Demo environment',
      'OAuth2 authentication',
      'WebSocket streaming',
    ],
    setupSteps: [
      'Create Tradovate account',
      'Register as API developer',
      'Create OAuth application',
      'Obtain access token via OAuth flow',
      'Paste access token below',
    ],
    oauthUrl: 'https://api.tradovate.com/oauth/authorize',
    notes: 'OAuth integration coming soon. For now, use developer token.',
  },
  IBKR: {
    name: 'Interactive Brokers',
    signupUrl: 'https://www.interactivebrokers.com/en/index.php?f=1338',
    docsUrl: 'https://www.interactivebrokers.com/api/doc.html',
    requirements: ['Client Portal Gateway running locally'],
    supportedMarkets: ['EQUITY', 'OPTIONS', 'FUTURES', 'FOREX', 'CRYPTO'],
    features: [
      'Access to 150+ markets worldwide',
      'All asset classes',
      'Paper trading account',
      'Client Portal Web API',
      'Local gateway for secure auth',
    ],
    setupSteps: [
      'Download Client Portal Gateway from IBKR',
      'Run: java -jar clientportal.gw.jar',
      'Open https://localhost:5000 and login',
      'Keep the gateway running',
      'Click Connect below',
    ],
    notes: 'IBKR requires the Client Portal Gateway running on your machine. You authenticate via browser.',
  },
};

/**
 * GET /api/broker/setup?broker=ALPACA
 * Returns setup information for a specific broker
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const broker = searchParams.get('broker') as BrokerType | null;

  if (!broker || !BROKER_INFO[broker]) {
    return NextResponse.json(
      { error: 'Invalid broker type' },
      { status: 400 }
    );
  }

  return NextResponse.json(BROKER_INFO[broker]);
}

/**
 * POST /api/broker/setup
 * Attempts to connect to a broker with provided credentials
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { brokerType, credentials, environment } = body;

  if (!brokerType || !BROKER_INFO[brokerType as BrokerType]) {
    return NextResponse.json(
      { success: false, error: 'Invalid broker type' },
      { status: 400 }
    );
  }

  try {
    // Validate credentials based on broker type
    switch (brokerType) {
      case 'ALPACA': {
        if (!credentials.apiKey || !credentials.apiSecret) {
          return NextResponse.json({
            success: false,
            error: 'API Key and Secret are required',
          });
        }

        // Test connection
        const baseUrl = environment === 'paper'
          ? 'https://paper-api.alpaca.markets'
          : 'https://api.alpaca.markets';

        const response = await fetch(`${baseUrl}/v2/account`, {
          headers: {
            'APCA-API-KEY-ID': credentials.apiKey,
            'APCA-API-SECRET-KEY': credentials.apiSecret,
          },
        });

        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({
            success: false,
            error: `Connection failed: ${error}`,
          });
        }

        const account = await response.json();
        return NextResponse.json({
          success: true,
          accountInfo: {
            id: account.id,
            balance: parseFloat(account.cash),
            equity: parseFloat(account.equity),
            buyingPower: parseFloat(account.buying_power),
          },
        });
      }

      case 'OANDA': {
        if (!credentials.accessToken || !credentials.accountId) {
          return NextResponse.json({
            success: false,
            error: 'API Token and Account ID are required',
          });
        }

        const baseUrl = environment === 'paper'
          ? 'https://api-fxpractice.oanda.com'
          : 'https://api-fxtrade.oanda.com';

        const response = await fetch(
          `${baseUrl}/v3/accounts/${credentials.accountId}/summary`,
          {
            headers: {
              Authorization: `Bearer ${credentials.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({
            success: false,
            error: `Connection failed: ${error}`,
          });
        }

        const data = await response.json();
        const account = data.account;
        return NextResponse.json({
          success: true,
          accountInfo: {
            id: account.id,
            balance: parseFloat(account.balance),
            unrealizedPnl: parseFloat(account.unrealizedPL),
            marginAvailable: parseFloat(account.marginAvailable),
          },
        });
      }

      case 'TASTYTRADE': {
        if (!credentials.apiKey || !credentials.apiSecret) {
          return NextResponse.json({
            success: false,
            error: 'Username and Password are required',
          });
        }

        const baseUrl = environment === 'paper'
          ? 'https://api.cert.tastyworks.com'
          : 'https://api.tastyworks.com';

        // Create session
        const response = await fetch(`${baseUrl}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            login: credentials.apiKey, // username
            password: credentials.apiSecret, // password
          }),
        });

        if (!response.ok) {
          return NextResponse.json({
            success: false,
            error: 'Invalid credentials or connection failed',
          });
        }

        const sessionData = await response.json();
        const sessionToken = sessionData.data['session-token'];

        // Get accounts
        const accountsRes = await fetch(`${baseUrl}/customers/me/accounts`, {
          headers: { Authorization: sessionToken },
        });

        if (!accountsRes.ok) {
          return NextResponse.json({
            success: false,
            error: 'Failed to fetch accounts',
          });
        }

        const accounts = await accountsRes.json();
        const primaryAccount = accounts.data?.items?.[0];

        return NextResponse.json({
          success: true,
          accountInfo: {
            id: primaryAccount?.['account-number'],
            balance: 0, // Would need separate balance call
          },
        });
      }

      case 'IBKR': {
        // IBKR uses local gateway - just verify it's reachable
        const gatewayUrl = process.env.IBKR_GATEWAY_URL || 'https://localhost:5000';

        try {
          const response = await fetch(`${gatewayUrl}/v1/api/iserver/auth/status`, {
            // Skip SSL verification for local gateway
            // @ts-ignore - Node.js fetch option
            rejectUnauthorized: false,
          });

          if (!response.ok) {
            return NextResponse.json({
              success: false,
              error: 'Gateway not authenticated. Please login at https://localhost:5000',
            });
          }

          const status = await response.json();
          if (!status.authenticated) {
            return NextResponse.json({
              success: false,
              error: 'Not authenticated. Please login via the gateway web interface.',
            });
          }

          return NextResponse.json({
            success: true,
            accountInfo: { id: 'ibkr-gateway' },
          });
        } catch {
          return NextResponse.json({
            success: false,
            error: 'Cannot reach IBKR Gateway. Make sure it is running on localhost:5000',
          });
        }
      }

      case 'TRADOVATE': {
        // Tradovate OAuth - not fully implemented yet
        return NextResponse.json({
          success: false,
          error: 'Tradovate OAuth integration coming soon',
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Unsupported broker type',
        });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    });
  }
}
