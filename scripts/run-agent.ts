/**
 * Ce's Autonomous Trading Agent Runner
 * 
 * Connects to live market data, processes through StrategyLoop,
 * executes trades on OANDA practice account, grades results.
 * 
 * Usage: npx tsx scripts/run-agent.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env before anything else
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { MarketData, PriceUpdate } from '../src/lib/engine/local_runner/MarketData';
import { StrategyLoop, Signal } from '../src/lib/engine/local_runner/StrategyLoop';
import { TheProfessor, TradeData } from '../src/lib/engine/local_runner/TheProfessor';
import { TheAuditor } from '../src/lib/engine/local_runner/TheAuditor';
import { OandaClient } from '../src/lib/broker/oanda';
import { RiskEngine } from '../src/lib/engine/risk/RiskEngine';

// ─── SQLite Setup ───────────────────────────────────────────
const Database = require('better-sqlite3');
const DB_PATH = path.join(process.cwd(), 'agent-trades.db');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS agent_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    side TEXT NOT NULL,
    entry_price REAL NOT NULL,
    exit_price REAL,
    stop_loss REAL,
    take_profit REAL,
    units INTEGER,
    oanda_trade_id TEXT,
    pnl REAL,
    grade TEXT,
    audit_verdict TEXT,
    reason TEXT,
    status TEXT DEFAULT 'OPEN',
    entry_time TEXT NOT NULL,
    exit_time TEXT,
    duration_minutes REAL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

const insertTrade = db.prepare(`
  INSERT INTO agent_trades (ticker, side, entry_price, stop_loss, take_profit, units, oanda_trade_id, reason, status, entry_time)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)
`);

const closeTrade = db.prepare(`
  UPDATE agent_trades SET exit_price=?, pnl=?, grade=?, audit_verdict=?, status=?, exit_time=?, duration_minutes=?
  WHERE id=?
`);

const getOpenTrades = db.prepare(`SELECT * FROM agent_trades WHERE status='OPEN'`);

// ─── State ──────────────────────────────────────────────────
interface ActiveTrade {
  dbId: number;
  ticker: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  units: number;
  oandaTradeId: string;
  entryTime: Date;
}

const activeTrades: Map<string, ActiveTrade> = new Map();
let tickCount = 0;
let signalCount = 0;
let tradeCount = 0;

// ─── Core Components ────────────────────────────────────────
const AGENT_ID = 'ce-fx-agent';
const marketData = new MarketData();
const strategy = new StrategyLoop();
let oanda: OandaClient;

try {
  oanda = OandaClient.fromEnv();
} catch (e) {
  console.error('❌ Failed to init OANDA client:', e);
  process.exit(1);
}

// ─── Trade Execution ────────────────────────────────────────
async function handleSignal(signal: Signal) {
  signalCount++;

  if (signal.type === 'ZONE_FOUND') {
    console.log(`🎯 Zone found: ${signal.side} ${signal.ticker} @ ${signal.price?.toFixed(5)} — ${signal.reason}`);
    return;
  }

  if (signal.type === 'ENTRY') {
    await handleEntry(signal);
  }

  if (signal.type === 'EXIT') {
    await handleExit(signal);
  }
}

async function handleEntry(signal: Signal) {
  const ticker = signal.ticker;
  const oandaInstrument = ticker === 'EURUSD' ? 'EUR_USD' : ticker;

  // Already in a trade for this ticker?
  if (activeTrades.has(ticker)) {
    console.log(`⏭️ Already in ${ticker} trade, skipping entry`);
    return;
  }

  // Risk check
  let balance = 100000;
  try {
    const summary = await oanda.getAccountSummary();
    balance = summary.balance;
  } catch (e) {
    console.warn('⚠️ Could not fetch balance, using default $100K');
  }

  const riskCheck = RiskEngine.canOpenTrade(AGENT_ID, {
    ticker,
    entry: signal.price!,
    stop: signal.meta?.stop || signal.price! - 0.0020,
    side: signal.side,
    agentId: AGENT_ID,
  }, balance);

  if (!riskCheck.allowed) {
    console.log(`🚫 Risk Engine blocked trade: ${riskCheck.reason}`);
    return;
  }

  // Calculate position size
  const stopLoss = signal.meta?.stop || (signal.side === 'LONG' ? signal.price! - 0.0020 : signal.price! + 0.0020);
  const riskPips = Math.abs(signal.price! - stopLoss) * 10000;
  const units = oanda.calculatePositionSize(balance, 0.5, signal.price!, stopLoss);
  const signedUnits = signal.side === 'LONG' ? units : -units;

  // Take profit at 2R
  const risk = Math.abs(signal.price! - stopLoss);
  const takeProfit = signal.side === 'LONG' ? signal.price! + risk * 2 : signal.price! - risk * 2;

  console.log(`\n🔥 ═══ ENTRY SIGNAL ═══`);
  console.log(`   ${signal.side} ${oandaInstrument} @ ${signal.price!.toFixed(5)}`);
  console.log(`   SL: ${stopLoss.toFixed(5)} | TP: ${takeProfit.toFixed(5)} | Units: ${signedUnits}`);
  console.log(`   Risk: ${riskPips.toFixed(1)} pips | Reason: ${signal.reason}`);

  try {
    const result = await oanda.placeMarketOrder(oandaInstrument, signedUnits, stopLoss, takeProfit);
    console.log(`   ✅ Order filled — Trade ID: ${result.tradeId}`);

    const dbResult = insertTrade.run(
      ticker, signal.side, signal.price!, stopLoss, takeProfit, Math.abs(signedUnits),
      result.tradeId, signal.reason, new Date().toISOString()
    );

    activeTrades.set(ticker, {
      dbId: dbResult.lastInsertRowid as number,
      ticker,
      side: signal.side,
      entryPrice: signal.price!,
      stopLoss,
      takeProfit,
      units: Math.abs(signedUnits),
      oandaTradeId: result.tradeId,
      entryTime: new Date(),
    });

    tradeCount++;
  } catch (e: any) {
    console.error(`   ❌ Order failed: ${e.message}`);
  }
}

async function handleExit(signal: Signal) {
  const trade = activeTrades.get(signal.ticker);
  if (!trade) return;

  await closeTradeFull(trade, signal.price!);
}

async function checkStopsAndTargets(tick: PriceUpdate) {
  const trade = activeTrades.get(tick.ticker);
  if (!trade) return;

  const hitStop = trade.side === 'LONG'
    ? tick.price <= trade.stopLoss
    : tick.price >= trade.stopLoss;

  const hitTarget = trade.side === 'LONG'
    ? tick.price >= trade.takeProfit
    : tick.price <= trade.takeProfit;

  if (hitStop || hitTarget) {
    await closeTradeFull(trade, tick.price);
  }
}

async function closeTradeFull(trade: ActiveTrade, exitPrice: number) {
  const oandaInstrument = trade.ticker === 'EURUSD' ? 'EUR_USD' : trade.ticker;
  const pnl = trade.side === 'LONG'
    ? (exitPrice - trade.entryPrice) * trade.units
    : (trade.entryPrice - exitPrice) * trade.units;

  const durationMin = (Date.now() - trade.entryTime.getTime()) / 60000;
  const status = pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BE';

  console.log(`\n💰 ═══ TRADE CLOSED ═══`);
  console.log(`   ${trade.side} ${trade.ticker} | PnL: $${pnl.toFixed(2)} | ${status}`);
  console.log(`   Entry: ${trade.entryPrice.toFixed(5)} → Exit: ${exitPrice.toFixed(5)}`);
  console.log(`   Duration: ${durationMin.toFixed(1)} min`);

  // Close on OANDA
  try {
    if (trade.oandaTradeId) {
      await oanda.closeTrade(trade.oandaTradeId);
    }
  } catch (e: any) {
    console.warn(`   ⚠️ OANDA close failed (may already be closed): ${e.message}`);
  }

  // Grade the trade
  const tradeData: TradeData = {
    ticker: trade.ticker,
    entry: trade.entryPrice,
    exit: exitPrice,
    stop_loss: trade.stopLoss,
    type: trade.side === 'LONG' ? 'DEMAND' : 'SUPPLY',
    pnl,
    duration_minutes: durationMin,
  };

  const review = TheProfessor.gradeTrade(AGENT_ID, tradeData);
  const audit = TheAuditor.auditReview(review);

  console.log(`   📝 Grade: ${review.grade} → Audit: ${audit.verdict} (Final: ${audit.final_grade})`);
  console.log(`   💬 ${review.critique}`);
  console.log(`   📋 Action: ${review.action_item}`);

  // Persist
  closeTrade.run(exitPrice, pnl, audit.final_grade, audit.verdict, status, new Date().toISOString(), durationMin, trade.dbId);

  activeTrades.delete(trade.ticker);
}

// ─── Main Loop ──────────────────────────────────────────────
async function main() {
  console.log(`\n🤖 ═══════════════════════════════════════════`);
  console.log(`   Ce's Autonomous Trading Agent`);
  console.log(`   Mode: PAPER (OANDA Practice)`);
  console.log(`   Instrument: EUR/USD`);
  console.log(`═══════════════════════════════════════════════\n`);

  // Test OANDA connection
  const connected = await oanda.testConnection();
  if (!connected) {
    console.error('❌ Cannot connect to OANDA. Exiting.');
    process.exit(1);
  }

  // Start market data
  marketData.start();

  marketData.on('price', async (tick: PriceUpdate) => {
    tickCount++;

    // Process through strategy
    const signal = strategy.processTick(tick);

    // Check stops/targets on active trades
    await checkStopsAndTargets(tick);

    // Handle new signals
    if (signal) {
      await handleSignal(signal);
    }

    // Status log every 100 ticks
    if (tickCount % 100 === 0) {
      const zones = strategy.getActiveZones();
      console.log(`\n📊 Status: ${tickCount} ticks | ${signalCount} signals | ${tradeCount} trades | ${zones.length} active zones | ${activeTrades.size} open positions`);
    }
  });

  console.log('🟢 Agent running. Press Ctrl+C to stop.\n');
}

// ─── Graceful Shutdown ──────────────────────────────────────
async function shutdown() {
  console.log('\n\n🛑 Shutting down...');

  // Close all open trades
  for (const [ticker, trade] of activeTrades) {
    console.log(`   Closing ${ticker} position...`);
    try {
      const price = await oanda.getPrice(ticker === 'EURUSD' ? 'EUR_USD' : ticker);
      await closeTradeFull(trade, trade.side === 'LONG' ? price.bid : price.ask);
    } catch (e: any) {
      console.error(`   ❌ Failed to close ${ticker}: ${e.message}`);
    }
  }

  console.log(`\n📊 Session Summary:`);
  console.log(`   Ticks processed: ${tickCount}`);
  console.log(`   Signals generated: ${signalCount}`);
  console.log(`   Trades executed: ${tradeCount}`);
  console.log('\n👋 Ce signing off.\n');

  db.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch(e => {
  console.error('💥 Fatal error:', e);
  process.exit(1);
});
