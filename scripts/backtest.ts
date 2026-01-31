/**
 * Ce's Backtester
 * 
 * Pulls OANDA historical candles, feeds through StrategyLoop,
 * simulates trades with slippage, grades everything.
 * 
 * Usage: npx tsx scripts/backtest.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { OandaClient, Candle } from '../src/lib/broker/oanda';
import { StrategyLoop, Signal } from '../src/lib/engine/local_runner/StrategyLoop';
import { PriceUpdate } from '../src/lib/engine/local_runner/MarketData';
import { TheProfessor, TradeData } from '../src/lib/engine/local_runner/TheProfessor';

// ─── Config ─────────────────────────────────────────────────
const INSTRUMENT = 'EUR_USD';
const TICKER = 'EURUSD';
const SLIPPAGE_PIPS = 0.5; // 0.5 pip slippage per side
const SLIPPAGE = SLIPPAGE_PIPS * 0.0001;
const STARTING_BALANCE = 100000;
const RISK_PER_TRADE = 0.005; // 0.5%

// ─── Types ──────────────────────────────────────────────────
interface BacktestTrade {
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  entryTime: string;
  exitTime: string;
  pnl: number;
  rr: number;
  grade: string;
  durationMin: number;
}

// ─── Main ───────────────────────────────────────────────────
async function main() {
  console.log(`\n📊 ═══════════════════════════════════════════`);
  console.log(`   Ce's Backtester — ${INSTRUMENT} 15m`);
  console.log(`   Period: Last 30 days`);
  console.log(`   Slippage: ${SLIPPAGE_PIPS} pips per side`);
  console.log(`═══════════════════════════════════════════════\n`);

  const oanda = OandaClient.fromEnv();
  await oanda.testConnection();

  // Fetch candles — OANDA max 5000 per request, 30 days of 15m = ~2880
  console.log('📥 Fetching historical candles...');
  const candles = await oanda.getCandles(INSTRUMENT, '15m', 2880);
  console.log(`   Got ${candles.length} candles (${candles[0]?.time} → ${candles[candles.length - 1]?.time})\n`);

  // Run strategy
  const strategy = new StrategyLoop();
  const completedTrades: BacktestTrade[] = [];

  interface OpenTrade {
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    entryTime: string;
  }

  let openTrade: OpenTrade | null = null;
  let balance = STARTING_BALANCE;
  let peakBalance = STARTING_BALANCE;
  let maxDrawdown = 0;

  for (const candle of candles) {
    if (!candle.complete) continue;

    // Simulate OHLC as 4 ticks per candle for more realistic fills
    const ticks: PriceUpdate[] = [
      { ticker: TICKER, price: candle.open, timestamp: new Date(candle.time).getTime(), source: 'FINNHUB' },
      { ticker: TICKER, price: candle.high, timestamp: new Date(candle.time).getTime() + 1, source: 'FINNHUB' },
      { ticker: TICKER, price: candle.low, timestamp: new Date(candle.time).getTime() + 2, source: 'FINNHUB' },
      { ticker: TICKER, price: candle.close, timestamp: new Date(candle.time).getTime() + 3, source: 'FINNHUB' },
    ];

    for (const tick of ticks) {
      // Check stops/targets on open trade
      if (openTrade) {
        const hitStop = openTrade.side === 'LONG'
          ? tick.price <= openTrade.stopLoss
          : tick.price >= openTrade.stopLoss;
        const hitTarget = openTrade.side === 'LONG'
          ? tick.price >= openTrade.takeProfit
          : tick.price <= openTrade.takeProfit;

        if (hitStop || hitTarget) {
          const exitPrice = hitStop
            ? openTrade.stopLoss + (openTrade.side === 'LONG' ? -SLIPPAGE : SLIPPAGE)
            : openTrade.takeProfit;

          const risk = Math.abs(openTrade.entryPrice - openTrade.stopLoss);
          const reward = Math.abs(exitPrice - openTrade.entryPrice);
          const rr = risk > 0 ? reward / risk : 0;
          const units = Math.floor(STARTING_BALANCE * RISK_PER_TRADE / (risk * 10000) * 100000);
          const pnl = openTrade.side === 'LONG'
            ? (exitPrice - openTrade.entryPrice) * units
            : (openTrade.entryPrice - exitPrice) * units;

          const durationMin = (tick.timestamp - new Date(openTrade.entryTime).getTime()) / 60000;

          const tradeData: TradeData = {
            ticker: TICKER,
            entry: openTrade.entryPrice,
            exit: exitPrice,
            stop_loss: openTrade.stopLoss,
            type: openTrade.side === 'LONG' ? 'DEMAND' : 'SUPPLY',
            pnl,
            duration_minutes: durationMin,
          };
          const review = TheProfessor.gradeTrade('backtest', tradeData);

          completedTrades.push({
            side: openTrade.side,
            entryPrice: openTrade.entryPrice,
            exitPrice,
            stopLoss: openTrade.stopLoss,
            takeProfit: openTrade.takeProfit,
            entryTime: openTrade.entryTime,
            exitTime: new Date(tick.timestamp).toISOString(),
            pnl,
            rr,
            grade: review.grade,
            durationMin,
          });

          balance += pnl;
          peakBalance = Math.max(peakBalance, balance);
          const dd = (peakBalance - balance) / peakBalance;
          maxDrawdown = Math.max(maxDrawdown, dd);

          openTrade = null;
        }
      }

      // Process tick through strategy
      const signal = strategy.processTick(tick);

      if (signal && signal.type === 'ENTRY' && !openTrade) {
        const entryPrice = tick.price + (signal.side === 'LONG' ? SLIPPAGE : -SLIPPAGE);
        const stopLoss = signal.meta?.stop || (signal.side === 'LONG' ? entryPrice - 0.0020 : entryPrice + 0.0020);
        const risk = Math.abs(entryPrice - stopLoss);
        const takeProfit = signal.side === 'LONG' ? entryPrice + risk * 2 : entryPrice - risk * 2;

        openTrade = {
          side: signal.side,
          entryPrice,
          stopLoss,
          takeProfit,
          entryTime: candle.time,
        };
      }
    }
  }

  // ─── Results ────────────────────────────────────────────
  const wins = completedTrades.filter(t => t.pnl > 0);
  const losses = completedTrades.filter(t => t.pnl <= 0);
  const totalPnl = completedTrades.reduce((s, t) => s + t.pnl, 0);
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const avgRR = completedTrades.length > 0
    ? completedTrades.reduce((s, t) => s + t.rr, 0) / completedTrades.length
    : 0;

  // Grade distribution
  const grades: Record<string, number> = {};
  completedTrades.forEach(t => { grades[t.grade] = (grades[t.grade] || 0) + 1; });

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  BACKTEST RESULTS — ${INSTRUMENT} 15m (30 days)`);
  console.log(`${'═'.repeat(50)}`);
  console.log(`  Total Trades:    ${completedTrades.length}`);
  console.log(`  Win Rate:        ${completedTrades.length > 0 ? ((wins.length / completedTrades.length) * 100).toFixed(1) : 0}%`);
  console.log(`  Wins / Losses:   ${wins.length} / ${losses.length}`);
  console.log(`  Total PnL:       $${totalPnl.toFixed(2)}`);
  console.log(`  Profit Factor:   ${profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)}`);
  console.log(`  Max Drawdown:    ${(maxDrawdown * 100).toFixed(2)}%`);
  console.log(`  Avg R:R:         ${avgRR.toFixed(2)}`);
  console.log(`  Final Balance:   $${balance.toFixed(2)}`);
  console.log(`  Return:          ${((balance - STARTING_BALANCE) / STARTING_BALANCE * 100).toFixed(2)}%`);
  console.log(`\n  Grade Distribution:`);
  Object.entries(grades).sort().forEach(([g, c]) => {
    console.log(`    ${g}: ${'█'.repeat(c)} (${c})`);
  });

  if (completedTrades.length > 0) {
    console.log(`\n  Recent Trades:`);
    completedTrades.slice(-5).forEach(t => {
      console.log(`    ${t.side.padEnd(5)} ${t.entryPrice.toFixed(5)} → ${t.exitPrice.toFixed(5)} | $${t.pnl.toFixed(2).padStart(8)} | ${t.grade} | ${t.durationMin.toFixed(0)}min`);
    });
  }

  console.log(`\n${'═'.repeat(50)}\n`);
}

main().catch(e => {
  console.error('💥 Backtest error:', e);
  process.exit(1);
});
