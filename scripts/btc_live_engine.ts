/**
 * BTC Live Trading Engine
 * 
 * Trades BTC at Support/Resistance and Liquidity levels
 * Uses Binance public API (free, no auth needed)
 * Writes to SQLite database for the web UI
 * 
 * Run: npx tsx scripts/btc_live_engine.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.local') });

import Database from 'better-sqlite3';
import path from 'path';

// ============================================================================
// CONFIG
// ============================================================================

const SYMBOL = 'XBTUSD';
const KRAKEN_API = 'https://api.kraken.com/0/public';
const DB_PATH = path.join(__dirname, '..', 'journal.db');
const POLL_INTERVAL = 10000; // 10 seconds
const RISK_PER_TRADE = 0.02; // 2%
const STARTING_CAPITAL = 10000;

// ============================================================================
// DATABASE
// ============================================================================

const db = new Database(DB_PATH);

// Tables should already exist from db.ts - just verify
try {
  db.prepare('SELECT 1 FROM trades LIMIT 1').get();
  db.prepare('SELECT 1 FROM signals LIMIT 1').get();
  console.log('Database tables verified');
} catch (e) {
  console.error('Database tables not found - run the web app first to initialize');
  process.exit(1);
}

// ============================================================================
// BINANCE API (Public, no auth needed)
// ============================================================================

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Ticker {
  symbol: string;
  price: number;
  change24h: number;
}

async function fetchPrice(): Promise<number> {
  const res = await fetch(`${KRAKEN_API}/Ticker?pair=XBTUSD`);
  const data = await res.json();
  // Kraken returns last trade price in 'c' array [price, lot volume]
  return parseFloat(data.result.XXBTZUSD.c[0]);
}

async function fetchCandles(interval: string = '60', limit: number = 100): Promise<Candle[]> {
  // Kraken intervals: 1, 5, 15, 30, 60, 240, 1440, 10080, 21600
  // Map common intervals
  const intervalMap: Record<string, string> = {
    '1m': '1', '5m': '5', '15m': '15', '30m': '30',
    '1h': '60', '4h': '240', '1d': '1440',
    '60': '60', '240': '240'
  };
  const krakenInterval = intervalMap[interval] || '60';
  
  const res = await fetch(`${KRAKEN_API}/OHLC?pair=XBTUSD&interval=${krakenInterval}`);
  const data = await res.json();
  
  if (data.error && data.error.length > 0) {
    console.error('Kraken error:', data.error);
    return [];
  }
  
  const ohlc = data.result.XXBTZUSD || [];
  
  return ohlc.slice(-limit).map((k: any[]) => ({
    time: k[0] * 1000, // Convert to ms
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[6]),
  }));
}

// ============================================================================
// S&R LEVEL DETECTION
// ============================================================================

interface Level {
  price: number;
  type: 'support' | 'resistance';
  strength: number;
  touches: number;
}

function findSRLevels(candles: Candle[], tolerance: number = 0.005): Level[] {
  const levels: Level[] = [];
  
  // Find swing highs and lows
  for (let i = 2; i < candles.length - 2; i++) {
    const c = candles[i];
    
    // Swing high (resistance)
    if (c.high > candles[i-1].high && c.high > candles[i-2].high &&
        c.high > candles[i+1].high && c.high > candles[i+2].high) {
      levels.push({
        price: c.high,
        type: 'resistance',
        strength: 1,
        touches: 1,
      });
    }
    
    // Swing low (support)
    if (c.low < candles[i-1].low && c.low < candles[i-2].low &&
        c.low < candles[i+1].low && c.low < candles[i+2].low) {
      levels.push({
        price: c.low,
        type: 'support',
        strength: 1,
        touches: 1,
      });
    }
  }
  
  // Merge nearby levels and count touches
  const merged: Level[] = [];
  
  for (const level of levels) {
    const existing = merged.find(m => 
      m.type === level.type && 
      Math.abs(m.price - level.price) / m.price < tolerance
    );
    
    if (existing) {
      existing.price = (existing.price + level.price) / 2;
      existing.touches++;
      existing.strength = Math.min(existing.touches / 3, 1);
    } else {
      merged.push({ ...level });
    }
  }
  
  // Sort by strength
  return merged
    .filter(l => l.touches >= 2)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 10);
}

function findLiquidityLevels(candles: Candle[]): Level[] {
  // Liquidity = areas with lots of wicks (stop hunts)
  const levels: Level[] = [];
  
  for (let i = 5; i < candles.length; i++) {
    const c = candles[i];
    const wickUp = c.high - Math.max(c.open, c.close);
    const wickDown = Math.min(c.open, c.close) - c.low;
    const body = Math.abs(c.close - c.open);
    
    // Long upper wick = liquidity above
    if (wickUp > body * 2 && wickUp > 50) {
      levels.push({
        price: c.high,
        type: 'resistance',
        strength: 0.7,
        touches: 1,
      });
    }
    
    // Long lower wick = liquidity below
    if (wickDown > body * 2 && wickDown > 50) {
      levels.push({
        price: c.low,
        type: 'support',
        strength: 0.7,
        touches: 1,
      });
    }
  }
  
  return levels.slice(-5);
}

// ============================================================================
// TRADING LOGIC
// ============================================================================

interface Trade {
  id?: number;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  quantity: number;
  status: 'OPEN' | 'WIN' | 'LOSS';
}

let activeTrade: Trade | null = null;
let capital = STARTING_CAPITAL;
let dailyPnL = 0;
let tradesCount = 0;

function recordSignal(type: string, price: number, notes: string) {
  db.prepare(`
    INSERT INTO signals (symbol, strategy, action, price, timestamp, payload, processed)
    VALUES (?, ?, ?, ?, datetime('now'), ?, 0)
  `).run(
    'BTCUSD',
    'S&R Rejection',
    type,
    price,
    JSON.stringify({ notes, level_type: type })
  );
  console.log(`📍 Signal: ${type} @ $${price.toFixed(2)} - ${notes}`);
}

function openTrade(direction: 'LONG' | 'SHORT', entry: number, level: Level) {
  // Calculate position size
  const riskAmount = capital * RISK_PER_TRADE;
  const stopDistance = entry * 0.01; // 1% stop
  const quantity = riskAmount / stopDistance;
  
  const stopLoss = direction === 'LONG' 
    ? entry - stopDistance
    : entry + stopDistance;
  
  const takeProfit = direction === 'LONG'
    ? entry + (stopDistance * 2) // 1:2 R:R
    : entry - (stopDistance * 2);
  
  // Insert into database (matching existing schema)
  const result = db.prepare(`
    INSERT INTO trades (symbol, strategy, direction, entry_price, size, status, entry_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
  `).run(
    'BTCUSD',
    'S&R Rejection',
    direction,
    entry,
    quantity,
    'OPEN',
    `SL: ${stopLoss.toFixed(2)} | TP: ${takeProfit.toFixed(2)} | Level: ${level.type} (${level.strength.toFixed(2)})`
  );
  
  activeTrade = {
    id: result.lastInsertRowid as number,
    symbol: SYMBOL,
    direction,
    entry,
    stopLoss,
    takeProfit,
    quantity,
    status: 'OPEN',
  };
  
  tradesCount++;
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`⚡ ${direction} BTC @ $${entry.toFixed(2)}`);
  console.log(`   Level: ${level.type} (${level.touches} touches)`);
  console.log(`   SL: $${stopLoss.toFixed(2)} | TP: $${takeProfit.toFixed(2)}`);
  console.log(`   Size: ${quantity.toFixed(4)} BTC`);
  console.log(`${'='.repeat(50)}\n`);
}

function closeTrade(exitPrice: number, reason: string) {
  if (!activeTrade) return;
  
  const pnl = activeTrade.direction === 'LONG'
    ? (exitPrice - activeTrade.entry) * activeTrade.quantity
    : (activeTrade.entry - exitPrice) * activeTrade.quantity;
  
  const status = pnl > 0 ? 'WIN' : 'LOSS';
  
  // Update database
  db.prepare(`
    UPDATE trades 
    SET exit_price = ?, pnl = ?, status = ?, exit_date = datetime('now'), notes = notes || ?
    WHERE id = ?
  `).run(
    exitPrice,
    pnl,
    status,
    ` | Exit: ${reason}`,
    activeTrade.id
  );
  
  capital += pnl;
  dailyPnL += pnl;
  
  const emoji = pnl > 0 ? '✅' : '❌';
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${emoji} CLOSED ${activeTrade.direction} @ $${exitPrice.toFixed(2)}`);
  console.log(`   Entry: $${activeTrade.entry.toFixed(2)}`);
  console.log(`   P&L: $${pnl.toFixed(2)}`);
  console.log(`   Reason: ${reason}`);
  console.log(`   Capital: $${capital.toFixed(2)} | Daily: $${dailyPnL.toFixed(2)}`);
  console.log(`${'='.repeat(50)}\n`);
  
  activeTrade = null;
}

function checkTradeExit(currentPrice: number) {
  if (!activeTrade) return;
  
  // Check stop loss
  if (activeTrade.direction === 'LONG' && currentPrice <= activeTrade.stopLoss) {
    closeTrade(currentPrice, 'Stop Loss Hit');
    return;
  }
  if (activeTrade.direction === 'SHORT' && currentPrice >= activeTrade.stopLoss) {
    closeTrade(currentPrice, 'Stop Loss Hit');
    return;
  }
  
  // Check take profit
  if (activeTrade.direction === 'LONG' && currentPrice >= activeTrade.takeProfit) {
    closeTrade(currentPrice, 'Take Profit Hit');
    return;
  }
  if (activeTrade.direction === 'SHORT' && currentPrice <= activeTrade.takeProfit) {
    closeTrade(currentPrice, 'Take Profit Hit');
    return;
  }
}

function checkEntry(currentPrice: number, levels: Level[]) {
  if (activeTrade) return; // Already in a trade
  if (tradesCount >= 4) return; // Max 4 trades per day
  
  // Check if price is near a level
  for (const level of levels) {
    const distance = Math.abs(currentPrice - level.price) / currentPrice;
    
    if (distance < 0.003) { // Within 0.3%
      if (level.type === 'support') {
        // Price at support = potential long
        recordSignal('DEMAND', level.price, 'Price touching support level');
        openTrade('LONG', currentPrice, level);
        return;
      } else {
        // Price at resistance = potential short
        recordSignal('SUPPLY', level.price, 'Price touching resistance level');
        openTrade('SHORT', currentPrice, level);
        return;
      }
    }
  }
}

// ============================================================================
// MAIN LOOP
// ============================================================================

async function runEngine() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              BTC LIVE ENGINE - S&R Trading                    ║
╠═══════════════════════════════════════════════════════════════╣
║  Symbol: BTCUSDT                                              ║
║  Strategy: Support/Resistance + Liquidity Levels              ║
║  Data: Binance Public API (real-time)                         ║
║  Mode: Paper Trading                                          ║
╚═══════════════════════════════════════════════════════════════╝
`);

  console.log(`Starting capital: $${capital.toFixed(2)}\n`);
  
  let iteration = 0;
  
  while (true) {
    try {
      iteration++;
      const now = new Date().toLocaleTimeString();
      
      // Fetch data
      const [price, candles1h, candles4h] = await Promise.all([
        fetchPrice(),
        fetchCandles('60', 100),  // 1h = 60 min
        fetchCandles('240', 50),  // 4h = 240 min
      ]);
      
      // Find levels
      const sr1h = findSRLevels(candles1h);
      const sr4h = findSRLevels(candles4h);
      const liquidity = findLiquidityLevels(candles1h);
      
      const allLevels = [...sr4h, ...sr1h, ...liquidity]
        .sort((a, b) => Math.abs(price - a.price) - Math.abs(price - b.price))
        .slice(0, 10);
      
      // Status
      console.log(`[${now}] Scan #${iteration}`);
      console.log(`  💰 BTC: $${price.toFixed(2)}`);
      console.log(`  📊 S&R Levels: ${allLevels.length}`);
      
      // Show nearest levels
      const nearest = allLevels.slice(0, 3);
      nearest.forEach(l => {
        const dist = ((l.price - price) / price * 100).toFixed(2);
        const arrow = l.type === 'support' ? '↓' : '↑';
        console.log(`     ${arrow} ${l.type}: $${l.price.toFixed(2)} (${dist}%)`);
      });
      
      // Check for exits
      if (activeTrade) {
        console.log(`  📈 Position: ${activeTrade.direction} @ $${activeTrade.entry.toFixed(2)}`);
        const unrealizedPnL = activeTrade.direction === 'LONG'
          ? (price - activeTrade.entry) * activeTrade.quantity
          : (activeTrade.entry - price) * activeTrade.quantity;
        console.log(`     Unrealized: $${unrealizedPnL.toFixed(2)}`);
        checkTradeExit(price);
      } else {
        console.log(`  📍 No position - watching levels`);
        checkEntry(price, allLevels);
      }
      
      console.log(`  💵 Capital: $${capital.toFixed(2)} | Daily: $${dailyPnL.toFixed(2)}`);
      console.log('');
      
      // Wait
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      
    } catch (error) {
      console.error('Error:', error);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down...');
  if (activeTrade) {
    console.log('⚠️  Active trade will remain open in database');
  }
  console.log(`Final capital: $${capital.toFixed(2)}`);
  console.log(`Daily P&L: $${dailyPnL.toFixed(2)}`);
  console.log(`Trades: ${tradesCount}`);
  process.exit(0);
});

runEngine().catch(console.error);
