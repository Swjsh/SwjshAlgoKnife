/**
 * Pivot Pete Backtest Runner (TS)
 *
 * Goals:
 * - Reproducible backtest harness (same inputs => same outputs)
 * - Pluggable data source: Alpaca (stock ETF proxy) or deterministic synthetic fallback
 * - Writes JSON results into /data
 *
 * Usage (PowerShell):
 *   npx tsx scripts/pivot-pete-backtest.ts --symbol ES --from 2025-11-01 --to 2026-02-01 --tf 5Min --source alpaca
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { mkdirSync, writeFileSync, appendFileSync } from 'fs';

import { PivotStrategy } from '../src/lib/engine/strategies/pivot';
import type { Candle, MarketCategory, Signal, StrategyConfig } from '../src/lib/engine/types';
import { PaperTradingEngine } from '../src/lib/engine/paper-trading';
import { AlpacaDataProvider } from '../src/lib/data-providers/alpaca';
import { hashStringToSeed, mulberry32 } from '../src/lib/utils/prng';

type Symbol = 'ES' | 'NQ' | 'YM';

type Args = {
  symbol: Symbol;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  tf: '1Min' | '5Min' | '15Min' | '1Hour' | '1Day';
  source: 'alpaca' | 'synthetic';
  out?: string;
};

function parseArgs(argv: string[]): Args {
  const get = (key: string) => {
    const idx = argv.indexOf(key);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };

  const symbol = (get('--symbol') || 'ES').toUpperCase() as Symbol;
  const from = get('--from') || new Date(Date.now() - 30 * 24 * 3600_000).toISOString().slice(0, 10);
  const to = get('--to') || new Date().toISOString().slice(0, 10);
  const tf = (get('--tf') || '5Min') as Args['tf'];
  const source = (get('--source') || 'alpaca') as Args['source'];
  const out = get('--out');

  if (!['ES', 'NQ', 'YM'].includes(symbol)) throw new Error(`--symbol must be ES|NQ|YM (got ${symbol})`);
  if (!['1Min', '5Min', '15Min', '1Hour', '1Day'].includes(tf)) throw new Error(`--tf invalid (got ${tf})`);
  if (!['alpaca', 'synthetic'].includes(source)) throw new Error(`--source must be alpaca|synthetic (got ${source})`);

  return { symbol, from, to, tf, source, out };
}

function generateSyntheticCandles(symbol: Symbol, fromIso: string, toIso: string, tf: Args['tf']): Candle[] {
  // Deterministic synthetic fallback: seeded by symbol+range+tf.
  const seed = hashStringToSeed(`pivot-pete:${symbol}:${fromIso}:${toIso}:${tf}:v1`);
  const rng = mulberry32(seed);

  const start = new Date(`${fromIso}T00:00:00.000Z`).getTime();
  const end = new Date(`${toIso}T00:00:00.000Z`).getTime();

  const stepMs =
    tf === '1Min' ? 60_000 :
    tf === '5Min' ? 5 * 60_000 :
    tf === '15Min' ? 15 * 60_000 :
    tf === '1Hour' ? 60 * 60_000 :
    24 * 60 * 60_000;

  const basePrice = symbol === 'ES' ? 5000 : symbol === 'NQ' ? 17500 : 6500;
  let price = basePrice + (rng() - 0.5) * 100;

  const out: Candle[] = [];
  for (let t = start; t < end; t += stepMs) {
    const dt = new Date(t);

    // Light session gating for intraday: skip weekends.
    const day = dt.getUTCDay();
    if (day === 0 || day === 6) continue;

    // Drift
    const drift = (rng() - 0.5) * (symbol === 'ES' ? 6 : 15);
    const open = price;
    const close = Math.max(1, open + drift);
    const high = Math.max(open, close) + rng() * 3;
    const low = Math.min(open, close) - rng() * 3;
    const volume = 500 + Math.round(rng() * 1000);

    out.push({
      timestamp: new Date(t).toISOString(),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });

    price = close;
  }

  return out;
}

async function loadCandles(args: Args): Promise<{ candles: Candle[]; sourceUsed: string }>{
  if (args.source === 'synthetic') {
    return { candles: generateSyntheticCandles(args.symbol, args.from, args.to, args.tf), sourceUsed: 'synthetic' };
  }

  const alpaca = new AlpacaDataProvider({
    apiKey: process.env.APCA_API_KEY_ID || '',
    secretKey: process.env.APCA_API_SECRET_KEY || '',
    baseUrl: process.env.APCA_API_BASE_URL || 'https://paper-api.alpaca.markets',
    feed: (process.env.APCA_DATA_FEED as any) || 'sip',
  });

  const ok = await alpaca.testConnection();
  if (!ok) {
    return { candles: generateSyntheticCandles(args.symbol, args.from, args.to, args.tf), sourceUsed: 'synthetic (alpaca connection failed)' };
  }

  try {
    const sym = alpaca.resolveSymbol(args.symbol);
    const candles = await alpaca.getHistoricalBars(
      args.symbol,
      args.tf,
      new Date(`${args.from}T00:00:00.000Z`).toISOString(),
      new Date(`${args.to}T00:00:00.000Z`).toISOString(),
      5000
    );

    if (!candles.length) {
      return { candles: generateSyntheticCandles(args.symbol, args.from, args.to, args.tf), sourceUsed: 'synthetic (alpaca returned 0 bars)' };
    }

    return { candles, sourceUsed: `alpaca (${sym.note || sym.providerSymbol} via /v2/stocks/${sym.providerSymbol}/bars)` };
  } catch {
    return { candles: generateSyntheticCandles(args.symbol, args.from, args.to, args.tf), sourceUsed: 'synthetic (alpaca fetch error)' };
  }
}

// Strategy emits stopLoss/takeProfit; leave as-is.
function withStops(signal: Signal): Signal {
  return signal;
}

async function main() {
  const args = parseArgs(process.argv);

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = args.out || path.join(process.cwd(), 'data', `pivot_pete_backtest_${runId}.json`);

  const backtestDataDir = path.join(process.cwd(), 'data', '_backtests', 'pivot_pete', runId);
  mkdirSync(backtestDataDir, { recursive: true });

  const logsDir = path.join(process.cwd(), 'logs');
  mkdirSync(logsDir, { recursive: true });
  const logPath = path.join(logsDir, `pivot_pete_backtest_${runId}.log`);
  const log = (line: string) => appendFileSync(logPath, `[${new Date().toISOString()}] ${line}\n`);
  log(`runId=${runId} symbol=${args.symbol} from=${args.from} to=${args.to} tf=${args.tf} source=${args.source}`);

  const strategyConfig: StrategyConfig = {
    id: 'pivot_pete',
    name: 'Pivot Pete — Multi-Timeframe Pivot Rejection',
    isActive: true,
    params: {
      // Used by PivotStrategy when emitting signals
      symbol: args.symbol,
    },
    // IMPORTANT: this runner uses ETF proxy data via Alpaca stocks feed (SPY/QQQ/DIA)
    // unless/ until a true futures data source is added.
    category: 'EQUITY',
  };

  const strategy = new PivotStrategy(strategyConfig);

  const paper = new PaperTradingEngine(
    {
      accountBalance: 100000,
      slippage: { futures: 0.5, options: 0.1, fx: 1, equity: 0.01 },
      positionSize: { futures: 1, options: 1, fx: 10000, equity: 100 },
    },
    backtestDataDir
  );

  const { candles, sourceUsed } = await loadCandles(args);

  const signals: Signal[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];

    const s = strategy.onCandle(c);
    if (s) {
      const s2 = withStops(s);
      signals.push(s2);

      if (s2.action === 'BUY' || s2.action === 'SELL' || s2.action === 'FLAT') {
        await paper.executeSignal(s2, strategyConfig.category as MarketCategory);
      }
    }

    // Always update with latest close so stops/TP can trigger.
    await paper.updatePositions({ [args.symbol]: c.close });
  }

  const performance = paper.getPerformanceMetrics();
  const account = paper.getAccount();
  const pivotData = (strategy as any).pivots;

  const results = {
    runId,
    generated_at: new Date().toISOString(),
    args,
    data: {
      sourceUsed,
      candleCount: candles.length,
      first: candles[0]?.timestamp,
      last: candles[candles.length - 1]?.timestamp,
    },
    signals: {
      count: signals.length,
      latest: signals[signals.length - 1] || null,
    },
    pivots: pivotData || null,
    performance,
    account,
  };

  writeFileSync(outPath, JSON.stringify(results, null, 2));
  log(`candles=${candles.length} signals=${signals.length} trades=${performance.totalTrades} pnl=${performance.totalPnL}`);

  // eslint-disable-next-line no-console
  console.log(`\n✅ Pivot Pete backtest complete`);
  console.log(`   Data: ${sourceUsed}`);
  console.log(`   Candles: ${candles.length}`);
  console.log(`   Signals: ${signals.length}`);
  console.log(`   Trades: ${performance.totalTrades} | WinRate: ${(performance.winRate * 100).toFixed(1)}% | PnL: $${performance.totalPnL.toFixed(2)}`);
  console.log(`   Output: ${outPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('❌ Pivot Pete backtest failed:', err);
  process.exit(1);
});
