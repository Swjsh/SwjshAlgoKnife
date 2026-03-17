import { NextRequest, NextResponse } from 'next/server';

/**
 * Cost Audit API — /api/admin/costs
 *
 * Returns the full cost breakdown for SwjshAK infrastructure.
 * Designed to be polled by the dashboard every 2 hours, and
 * eventually consumed by OpenClaw for cost monitoring.
 *
 * All costs are in USD/month unless noted.
 */

interface CostItem {
  id: string;
  name: string;
  description: string;
  category: 'subscription' | 'infrastructure' | 'api' | 'domain' | 'data' | 'broker';
  status: 'active' | 'free' | 'optional' | 'future';
  monthlyCost: number;          // 0 for free services
  annualCost: number;
  isVariable: boolean;          // true if cost fluctuates (e.g. API usage)
  costRange?: [number, number]; // [min, max] for variable costs
  notes?: string;
  lastChecked: string;          // ISO timestamp
}

interface CostAudit {
  generatedAt: string;
  nextRefresh: string;
  totalMonthly: number;
  totalAnnual: number;
  breakdown: {
    subscriptions: number;
    infrastructure: number;
    apis: number;
    domains: number;
  };
  items: CostItem[];
  freeServices: CostItem[];
  futureRisks: CostItem[];
  optimizations: {
    id: string;
    title: string;
    savings: number;      // monthly savings
    effort: 'low' | 'medium' | 'high';
    description: string;
  }[];
}

function generateCostAudit(): CostAudit {
  const now = new Date();
  const nextRefresh = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2 hours

  const paidItems: CostItem[] = [
    {
      id: 'claude-max',
      name: 'Claude Max Subscription',
      description: 'Anthropic Claude Max plan — Cowork, Claude Code, general usage',
      category: 'subscription',
      status: 'active',
      monthlyCost: 200,
      annualCost: 2400,
      isVariable: false,
      notes: '86% of total spend. Covers all Claude desktop/Cowork usage.',
      lastChecked: now.toISOString(),
    },
    {
      id: 'gcp-vm',
      name: 'GCP VM (e2-small)',
      description: '2 vCPU, 2GB RAM, us-east4 — dashboard + agents 24/7',
      category: 'infrastructure',
      status: 'active',
      monthlyCost: 14,
      annualCost: 168,
      isVariable: false,
      notes: 'Could drop to e2-micro (free tier) if 1GB RAM is enough.',
      lastChecked: now.toISOString(),
    },
    {
      id: 'anthropic-api',
      name: 'Anthropic API (OpenClaw)',
      description: 'Sonnet for Chief/Overseer, Haiku for sub-agents — token billing',
      category: 'api',
      status: 'active',
      monthlyCost: 10,
      annualCost: 120,
      isVariable: true,
      costRange: [5, 30],
      notes: 'Depends on cron frequency and market activity. 13 cron jobs active.',
      lastChecked: now.toISOString(),
    },
    {
      id: 'gcp-disk',
      name: 'GCP Persistent Disk (30GB)',
      description: 'Standard disk storage for VM',
      category: 'infrastructure',
      status: 'active',
      monthlyCost: 1.20,
      annualCost: 14.40,
      isVariable: false,
      lastChecked: now.toISOString(),
    },
    {
      id: 'domain',
      name: 'swjsh.app Domain',
      description: 'Registered on Cloudflare — annual renewal',
      category: 'domain',
      status: 'active',
      monthlyCost: 1,
      annualCost: 12,
      isVariable: false,
      notes: 'Cloudflare domain, ~$10-15/yr.',
      lastChecked: now.toISOString(),
    },
    {
      id: 'gcp-network',
      name: 'GCP Network Egress',
      description: 'Outbound traffic from VM (~1GB/mo)',
      category: 'infrastructure',
      status: 'active',
      monthlyCost: 0.12,
      annualCost: 1.44,
      isVariable: true,
      costRange: [0, 1],
      lastChecked: now.toISOString(),
    },
  ];

  const freeItems: CostItem[] = [
    { id: 'alpaca', name: 'Alpaca (Paper Trading)', description: 'Stocks, options, crypto execution — paper account', category: 'broker', status: 'free', monthlyCost: 0, annualCost: 0, isVariable: false, lastChecked: now.toISOString() },
    { id: 'oanda', name: 'OANDA (Practice)', description: 'Demo forex broker — Sterling FX agent', category: 'broker', status: 'free', monthlyCost: 0, annualCost: 0, isVariable: false, lastChecked: now.toISOString() },
    { id: 'firebase', name: 'Firebase', description: 'Auth, Realtime DB, Storage — free tier', category: 'infrastructure', status: 'free', monthlyCost: 0, annualCost: 0, isVariable: false, lastChecked: now.toISOString() },
    { id: 'yfinance', name: 'yfinance', description: 'Yahoo Finance — stock/futures price feeds', category: 'data', status: 'free', monthlyCost: 0, annualCost: 0, isVariable: false, lastChecked: now.toISOString() },
    { id: 'binance-ws', name: 'Binance WebSocket', description: 'Real-time BTC/ETH/SOL streams — no account needed', category: 'data', status: 'free', monthlyCost: 0, annualCost: 0, isVariable: false, lastChecked: now.toISOString() },
    { id: 'coingecko', name: 'CoinGecko', description: 'Crypto price fallback — public API', category: 'data', status: 'free', monthlyCost: 0, annualCost: 0, isVariable: false, lastChecked: now.toISOString() },
    { id: 'finnhub', name: 'Finnhub', description: 'FX quotes via WebSocket — free tier', category: 'data', status: 'free', monthlyCost: 0, annualCost: 0, isVariable: false, lastChecked: now.toISOString() },
    { id: 'etherscan', name: 'Etherscan', description: 'Whale tracking / on-chain data — free tier', category: 'data', status: 'free', monthlyCost: 0, annualCost: 0, isVariable: false, lastChecked: now.toISOString() },
    { id: 'discord', name: 'Discord Webhooks', description: '3 channels: Chief, Forex, Crypto notifications', category: 'infrastructure', status: 'free', monthlyCost: 0, annualCost: 0, isVariable: false, lastChecked: now.toISOString() },
    { id: 'sqlite', name: 'SQLite', description: 'Local DB — trades, signals, journal entries', category: 'infrastructure', status: 'free', monthlyCost: 0, annualCost: 0, isVariable: false, lastChecked: now.toISOString() },
    { id: 'neon', name: 'Neon PostgreSQL', description: 'Cloud Postgres — free tier (optional)', category: 'infrastructure', status: 'free', monthlyCost: 0, annualCost: 0, isVariable: false, lastChecked: now.toISOString() },
    { id: 'prisma', name: 'Prisma ORM', description: 'Database toolkit — open source', category: 'infrastructure', status: 'free', monthlyCost: 0, annualCost: 0, isVariable: false, lastChecked: now.toISOString() },
  ];

  const futureItems: CostItem[] = [
    { id: 'polygon', name: 'Polygon.io', description: 'Premium market data — stocks, crypto, forex, options', category: 'data', status: 'future', monthlyCost: 199, annualCost: 2388, isVariable: false, notes: 'Not needed for paper trading. Only if going live.', lastChecked: now.toISOString() },
    { id: 'thetadata', name: 'ThetaData', description: 'Real-time options chains for Boba agent', category: 'data', status: 'future', monthlyCost: 50, annualCost: 600, isVariable: false, costRange: [25, 75], lastChecked: now.toISOString() },
    { id: 'live-broker', name: 'Live Broker Commissions', description: 'Alpaca/OANDA real accounts — per-trade fees', category: 'broker', status: 'future', monthlyCost: 0, annualCost: 0, isVariable: true, notes: 'Depends on trade volume.', lastChecked: now.toISOString() },
    { id: 'neon-paid', name: 'Neon Postgres (Paid)', description: 'If outgrow free tier', category: 'infrastructure', status: 'future', monthlyCost: 29, annualCost: 348, isVariable: false, costRange: [19, 39], lastChecked: now.toISOString() },
  ];

  const totalMonthly = paidItems.reduce((sum, item) => sum + item.monthlyCost, 0);
  const totalAnnual = paidItems.reduce((sum, item) => sum + item.annualCost, 0);

  return {
    generatedAt: now.toISOString(),
    nextRefresh: nextRefresh.toISOString(),
    totalMonthly: Math.round(totalMonthly * 100) / 100,
    totalAnnual: Math.round(totalAnnual * 100) / 100,
    breakdown: {
      subscriptions: paidItems.filter(i => i.category === 'subscription').reduce((s, i) => s + i.monthlyCost, 0),
      infrastructure: paidItems.filter(i => i.category === 'infrastructure').reduce((s, i) => s + i.monthlyCost, 0),
      apis: paidItems.filter(i => i.category === 'api').reduce((s, i) => s + i.monthlyCost, 0),
      domains: paidItems.filter(i => i.category === 'domain').reduce((s, i) => s + i.monthlyCost, 0),
    },
    items: paidItems,
    freeServices: freeItems,
    futureRisks: futureItems,
    optimizations: [
      {
        id: 'claude-downgrade',
        title: 'Evaluate Claude Plan',
        savings: 180,
        effort: 'low',
        description: 'If usage fits Pro tier ($20/mo), save $180/mo. Only if Cowork/Code usage is light.',
      },
      {
        id: 'gcp-micro',
        title: 'Switch to e2-micro (Free Tier)',
        savings: 14,
        effort: 'medium',
        description: 'GCP e2-micro (1 vCPU, 1GB) is always free. Tight on RAM but may work for paper trading.',
      },
      {
        id: 'oracle-free',
        title: 'Migrate to Oracle Cloud Free',
        savings: 15.32,
        effort: 'high',
        description: '4 ARM cores + 24GB RAM, free forever. Way more powerful. Availability can be spotty.',
      },
      {
        id: 'haiku-more',
        title: 'Use Haiku for routine crons',
        savings: 8,
        effort: 'low',
        description: 'Switch Chief routine checks from Sonnet to Haiku (~10x cheaper per token). Escalate to Sonnet only for decisions.',
      },
    ],
  };
}

export async function GET(request: NextRequest) {
  // This route is intentionally open so OpenClaw can call it.
  // The admin layout protects the UI page.
  // Optionally add API key auth here later:
  // const apiKey = request.headers.get('x-api-key');

  try {
    const audit = generateCostAudit();
    return NextResponse.json(audit, {
      headers: {
        'Cache-Control': 'public, max-age=7200, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error('[costs] Error generating cost audit:', error);
    return NextResponse.json({ error: 'Failed to generate cost audit' }, { status: 500 });
  }
}
