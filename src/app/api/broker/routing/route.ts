import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

type BrokerType = 'ALPACA' | 'OANDA' | 'IBKR' | 'TASTYTRADE' | 'TRADOVATE';
type MarketType = 'EQUITY' | 'OPTIONS' | 'FUTURES' | 'FOREX' | 'CRYPTO';

interface RoutingRule {
  marketType: MarketType;
  preferredBroker: BrokerType;
  fallbackBrokers: BrokerType[];
}

interface RoutingConfig {
  rules: RoutingRule[];
  updatedAt: string;
}

// Which brokers support which markets
const BROKER_MARKETS: Record<BrokerType, MarketType[]> = {
  ALPACA: ['EQUITY', 'OPTIONS', 'CRYPTO'],
  OANDA: ['FOREX'],
  TASTYTRADE: ['EQUITY', 'OPTIONS', 'FUTURES'],
  TRADOVATE: ['FUTURES'],
  IBKR: ['EQUITY', 'OPTIONS', 'FUTURES', 'FOREX', 'CRYPTO'],
};

// Default routing when possible
const DEFAULT_ROUTING: Record<MarketType, BrokerType> = {
  EQUITY: 'ALPACA',
  OPTIONS: 'ALPACA',
  FUTURES: 'TRADOVATE',
  FOREX: 'OANDA',
  CRYPTO: 'ALPACA',
};

const ROUTING_FILE = path.join(process.cwd(), 'data', 'broker-routing.json');

function ensureDataDir() {
  const dir = path.dirname(ROUTING_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadRouting(): RoutingConfig {
  ensureDataDir();
  if (fs.existsSync(ROUTING_FILE)) {
    const data = fs.readFileSync(ROUTING_FILE, 'utf-8');
    return JSON.parse(data);
  }
  return createDefaultRouting();
}

function saveRouting(config: RoutingConfig) {
  ensureDataDir();
  fs.writeFileSync(ROUTING_FILE, JSON.stringify(config, null, 2));
}

function createDefaultRouting(): RoutingConfig {
  const markets: MarketType[] = ['EQUITY', 'OPTIONS', 'FUTURES', 'FOREX', 'CRYPTO'];
  const rules: RoutingRule[] = markets.map((market) => ({
    marketType: market,
    preferredBroker: DEFAULT_ROUTING[market],
    fallbackBrokers: (Object.keys(BROKER_MARKETS) as BrokerType[]).filter(
      (broker) =>
        BROKER_MARKETS[broker].includes(market) &&
        broker !== DEFAULT_ROUTING[market]
    ),
  }));

  return { rules, updatedAt: new Date().toISOString() };
}

function getConnectedBrokers(): BrokerType[] {
  const connected: BrokerType[] = [];

  if (process.env.APCA_API_KEY_ID && process.env.APCA_API_SECRET_KEY) {
    connected.push('ALPACA');
  }
  if (process.env.OANDA_API_TOKEN && process.env.OANDA_ACCOUNT_ID) {
    connected.push('OANDA');
  }
  if (process.env.TASTYTRADE_USERNAME && process.env.TASTYTRADE_PASSWORD) {
    connected.push('TASTYTRADE');
  }
  if (process.env.TRADOVATE_ACCESS_TOKEN) {
    connected.push('TRADOVATE');
  }
  if (process.env.IBKR_GATEWAY_URL) {
    connected.push('IBKR');
  }

  return connected;
}

function buildMarketCoverage(
  rules: RoutingRule[],
  connectedBrokers: BrokerType[]
): Record<MarketType, BrokerType | null> {
  const coverage: Record<MarketType, BrokerType | null> = {
    EQUITY: null,
    OPTIONS: null,
    FUTURES: null,
    FOREX: null,
    CRYPTO: null,
  };

  for (const rule of rules) {
    // Check if preferred broker is connected and supports this market
    if (
      connectedBrokers.includes(rule.preferredBroker) &&
      BROKER_MARKETS[rule.preferredBroker].includes(rule.marketType)
    ) {
      coverage[rule.marketType] = rule.preferredBroker;
    } else {
      // Try fallbacks
      for (const fallback of rule.fallbackBrokers) {
        if (
          connectedBrokers.includes(fallback) &&
          BROKER_MARKETS[fallback].includes(rule.marketType)
        ) {
          coverage[rule.marketType] = fallback;
          break;
        }
      }
    }
  }

  return coverage;
}

/**
 * GET /api/broker/routing
 * Returns current routing configuration
 */
export async function GET() {
  const config = loadRouting();
  const connectedBrokers = getConnectedBrokers();
  const marketCoverage = buildMarketCoverage(config.rules, connectedBrokers);

  return NextResponse.json({
    success: true,
    routing: {
      rules: config.rules,
      connectedBrokers,
      marketCoverage,
    },
  });
}

/**
 * PUT /api/broker/routing
 * Updates a single routing rule
 */
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { marketType, preferredBroker } = body;

  if (!marketType || !preferredBroker) {
    return NextResponse.json(
      { success: false, error: 'marketType and preferredBroker required' },
      { status: 400 }
    );
  }

  // Validate broker supports this market
  if (!BROKER_MARKETS[preferredBroker as BrokerType]?.includes(marketType)) {
    return NextResponse.json(
      { success: false, error: `${preferredBroker} does not support ${marketType}` },
      { status: 400 }
    );
  }

  const config = loadRouting();

  // Update the rule
  const ruleIndex = config.rules.findIndex((r) => r.marketType === marketType);
  if (ruleIndex >= 0) {
    config.rules[ruleIndex].preferredBroker = preferredBroker;
    // Update fallbacks to exclude the new preferred broker
    config.rules[ruleIndex].fallbackBrokers = (
      Object.keys(BROKER_MARKETS) as BrokerType[]
    ).filter(
      (broker) =>
        BROKER_MARKETS[broker].includes(marketType) && broker !== preferredBroker
    );
  }

  config.updatedAt = new Date().toISOString();
  saveRouting(config);

  const connectedBrokers = getConnectedBrokers();
  const marketCoverage = buildMarketCoverage(config.rules, connectedBrokers);

  return NextResponse.json({
    success: true,
    routing: {
      rules: config.rules,
      connectedBrokers,
      marketCoverage,
    },
  });
}

/**
 * POST /api/broker/routing
 * Reset routing to defaults
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body.action === 'reset') {
    const config = createDefaultRouting();
    saveRouting(config);

    const connectedBrokers = getConnectedBrokers();
    const marketCoverage = buildMarketCoverage(config.rules, connectedBrokers);

    return NextResponse.json({
      success: true,
      routing: {
        rules: config.rules,
        connectedBrokers,
        marketCoverage,
      },
    });
  }

  return NextResponse.json(
    { success: false, error: 'Invalid action' },
    { status: 400 }
  );
}
