/**
 * Pivot Pete Paper-Sim Loop (TS)
 *
 * Pulls real-time ETF proxy quotes from Alpaca (SPY/QQQ/DIA), runs PivotStrategy,
 * and uses PaperTradingEngine to simulate fills.
 *
 * No live trading.
 *
 * Usage (PowerShell):
 *   npx tsx scripts/pivot-pete-paper.ts --symbol ES --iters 120 --pollSec 15
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { mkdirSync, writeFileSync, appendFileSync } from 'fs';

import { AlpacaDataProvider } from '../src/lib/data-providers/alpaca';
import { PaperTradingEngine } from '../src/lib/engine/paper-trading';
import { PivotStrategy } from '../src/lib/engine/strategies/pivot';
import type { Candle, StrategyConfig } from '../src/lib/engine/types';

type Symbol = 'ES' | 'NQ' | 'YM';

type Args = {
  symbol: Symbol;
  iters: number;
  pollSec: number;
};

function parseArgs(argv: string[]): Args {
  const get = (key: string) => {
    const idx = argv.indexOf(key);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };

  const symbol = (get('--symbol') || 'ES').toUpperCase() as Symbol;
  const iters = Number(get('--iters') || 120);
  const pollSec = Number(get('--pollSec') || 15);

  if (!['ES', 'NQ', 'YM'].includes(symbol)) throw new Error(`--symbol must be ES|NQ|YM (got ${symbol})`);
  if (!Number.isFinite(iters) || iters <= 0) throw new Error(`--iters must be > 0`);
  if (!Number.isFinite(pollSec) || pollSec <= 0) throw new Error(`--pollSec must be > 0`);

  return { symbol, iters, pollSec };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = parseArgs(process.argv);

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const runDataDir = path.join(process.cwd(), 'data', '_paper', 'pivot_pete', runId);
  mkdirSync(runDataDir, { recursive: true });

  const logsDir = path.join(process.cwd(), 'logs');
  mkdirSync(logsDir, { recursive: true });
  const logPath = path.join(logsDir, `pivot_pete_paper_${runId}.log`);
  const log = (line: string) => {
    const msg = `[${new Date().toISOString()}] ${line}`;
    appendFileSync(logPath, `${msg}\n`);
    // eslint-disable-next-line no-console
    console.log(msg);
  };

  const alpaca = new AlpacaDataProvider({
    apiKey: process.env.APCA_API_KEY_ID || '',
    secretKey: process.env.APCA_API_SECRET_KEY || '',
    baseUrl: process.env.APCA_API_BASE_URL || 'https://paper-api.alpaca.markets',
    feed: (process.env.APCA_DATA_FEED as any) || 'sip',
    useEtfProxy: true,
  });

  const sym = alpaca.resolveSymbol(args.symbol);

  const ok = await alpaca.testConnection();
  if (!ok) throw new Error('Alpaca connection failed. Set APCA_API_KEY_ID / APCA_API_SECRET_KEY in .env.local');

  const strategyConfig: StrategyConfig = {
    id: 'pivot_pete',
    name: 'Pivot Pete — Multi-Timeframe Pivot Rejection',
    isActive: true,
    params: {
      symbol: args.symbol,
      tolerancePct: 0.0008,
      minConfluence: 2,
      riskPct: 0.003,
      rr: 2,
    },
    category: 'EQUITY',
  };

  const strategy = new PivotStrategy(strategyConfig);

  const paper = new PaperTradingEngine(
    {
      accountBalance: 100000,
      slippage: { futures: 0.5, options: 0.1, fx: 1, equity: 0.01 },
      positionSize: { futures: 1, options: 1, fx: 10000, equity: 100 },
    },
    runDataDir
  );

  log(`Starting paper-sim runId=${runId} requested=${args.symbol} providerSymbol=${sym.providerSymbol} note=${sym.note || ''}`);

  for (let i = 0; i < args.iters; i++) {
    const now = new Date().toISOString();
    const px = await alpaca.getLatestQuote(args.symbol);

    const candle: Candle = {
      timestamp: now,
      open: px,
      high: px,
      low: px,
      close: px,
      volume: 0,
    };

    const s = strategy.onCandle(candle);
    if (s) {
      log(`signal action=${s.action} price=${s.price.toFixed(2)} sl=${s.stopLoss?.toFixed(2)} tp=${s.takeProfit?.toFixed(2)} notes=${s.notes || ''}`);
      await paper.executeSignal(s, strategyConfig.category);
    }

    await paper.updatePositions({ [args.symbol]: px }, now);

    const status = {
      runId,
      generated_at: now,
      args,
      data: { requestedSymbol: args.symbol, providerSymbol: sym.providerSymbol, note: sym.note || null },
      latest_price: px,
      pivots: (strategy as any).pivots || null,
      performance: paper.getPerformanceMetrics(),
      account: paper.getAccount(),
      trades: paper.getTrades().slice(-5),
      lastSignal: s || null,
    };

    writeFileSync(path.join(runDataDir, 'status.json'), JSON.stringify(status, null, 2));
    writeFileSync(path.join(process.cwd(), 'data', 'pivot_pete_paper_latest.json'), JSON.stringify(status, null, 2));

    await sleep(args.pollSec * 1000);
  }

  log('Paper-sim complete.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('❌ Pivot Pete paper-sim failed:', err);
  process.exit(1);
});
