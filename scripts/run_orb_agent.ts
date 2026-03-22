/**
 * ORB Agent Runner — Opening Range Breakout (Live Loop)
 * ======================================================
 * • Fetches real SPY 5m candles via yfinance (Python subprocess)
 * • Feeds candles to ORBStrategy for signal generation
 * • Fires webhook signals to the executor → Alpaca Paper
 * • Broadcasts AGENT_STATUS_UPDATE for the dashboard
 * • Continuous loop: scans every 5 minutes during market hours
 *
 * Usage: npx tsx scripts/run_orb_agent.ts [ES|NQ]
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { ORBStrategy } from '../src/lib/engine/strategies/orb';
import type { Candle, StrategyConfig } from '../src/lib/engine/types';

// ── Config ──────────────────────────────────────────────────────────────────
const SYMBOL = process.argv[2] || 'ES';
// Security: Only allow known safe proxy symbols (prevent injection)
const PROXY_MAP: Record<string, string> = { ES: 'SPY', NQ: 'QQQ' };
const PROXY = PROXY_MAP[SYMBOL] || 'SPY';
const SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const WEBHOOK_URL = 'http://localhost:3000/api/webhook/tradingview';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
  console.error('FATAL: WEBHOOK_SECRET environment variable is required');
  process.exit(1);
}
const DATA_DIR = path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'orb_agent_state.json');
const STATUS_FILE = path.join(DATA_DIR, 'orb_agent_status.json');

// ── Market Hours Check ──────────────────────────────────────────────────────
function isMarketHours(): boolean {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  if (day === 0 || day === 6) return false;
  const hour = et.getHours();
  const min = et.getMinutes();
  const totalMin = hour * 60 + min;
  return totalMin >= 570 && totalMin <= 960; // 9:30 AM - 4:00 PM ET
}

// ── Fetch Real Candles via yfinance ─────────────────────────────────────────
function fetchCandles(): Candle[] {
  try {
    // Security: Write Python script to temp file instead of using -c with interpolation
    // This prevents command injection vulnerabilities
    const tempScript = path.join(DATA_DIR, '_fetch_candles.py');
    const script = `
import yfinance as yf
import pandas as pd
import json
import sys
import os

# Get symbol from environment (safe, not interpolated)
symbol = os.environ.get('FETCH_SYMBOL', 'SPY')

data = yf.download(symbol, period='2d', interval='5m', progress=False)
if isinstance(data.columns, pd.MultiIndex):
    data.columns = data.columns.get_level_values(0)
if data.empty:
    print('[]')
    sys.exit(0)

candles = []
for ts, row in data.iterrows():
    candles.append({
        'timestamp': str(ts),
        'open': float(row['Open']),
        'high': float(row['High']),
        'low': float(row['Low']),
        'close': float(row['Close']),
        'volume': int(row['Volume']),
    })
print(json.dumps(candles))
`;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(tempScript, script);

    // Security: Use spawn-style execution with env var instead of string interpolation
    const python = process.platform === 'win32' ? 'python' : 'python3';
    const result = execSync(`${python} "${tempScript}"`, {
      encoding: 'utf-8',
      timeout: 30000,
      env: { ...process.env, FETCH_SYMBOL: PROXY },  // Pass symbol via env, not interpolation
    }).trim();

    // Find the JSON array in output (yfinance may print progress)
    const jsonStart = result.lastIndexOf('[');
    if (jsonStart === -1) return [];
    return JSON.parse(result.slice(jsonStart)) as Candle[];
  } catch (err) {
    console.error(`[ORB] Data fetch error: ${err}`);
    return [];
  }
}

// ── Fire Webhook ────────────────────────────────────────────────────────────
async function fireSignal(action: string, price: number, reason: string): Promise<boolean> {
  try {
    const resp = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        symbol: PROXY,
        action,
        price,
        strategy: 'ORB_15m_Breakout',
        notes: reason,
      }),
    });
    if (resp.ok) {
      console.log(`[ORB] Signal sent: ${action} ${PROXY} @ $${price.toFixed(2)}`);
      return true;
    }
    console.error(`[ORB] Webhook failed: ${resp.status}`);
    return false;
  } catch (err) {
    console.error(`[ORB] Webhook error: ${err}`);
    return false;
  }
}

// ── State Persistence ───────────────────────────────────────────────────────
interface ORBState {
  activeTrade: { direction: string; entryPrice: number; openedAt: string } | null;
  signalsFired: number;
  lastSessionDate: string | null;
}

function loadState(): ORBState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch {}
  return { activeTrade: null, signalsFired: 0, lastSessionDate: null };
}

function saveState(state: ORBState): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── Main Loop ───────────────────────────────────────────────────────────────
async function main() {
  console.log(`
+=================================================+
|       ORB AGENT  —  Opening Range Breakout       |
|  Symbol: ${SYMBOL} (proxy: ${PROXY})                        |
|  Scan: every 5min | Session: 9:30-16:00 EST      |
+=================================================+
`);

  const config: StrategyConfig = {
    id: 'orb_15m',
    name: 'ORB 15m Breakout',
    isActive: true,
    params: { startHour: 9, startMinute: 30, duration: 15 },
    category: 'FUTURES',
  };

  let state = loadState();
  let scanCount = 0;

  // Continuous loop
  while (true) {
    try {
      if (!isMarketHours()) {
        const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
        console.log(`[ORB] Outside market hours (${now}). Sleeping 5m...`);

        // Broadcast waiting status
        console.log(`AGENT_STATUS_UPDATE:${JSON.stringify({
          agentId: 'orb_agent', status: 'WAITING', message: 'Outside market hours',
          timestamp: new Date().toISOString(),
        })}`);

        await sleep(SCAN_INTERVAL_MS);
        continue;
      }

      scanCount++;
      console.log(`\n[${new Date().toLocaleTimeString()}] ORB scan #${scanCount}`);

      // Reset strategy for new session day
      const today = new Date().toISOString().split('T')[0];
      const strategy = new ORBStrategy(config);

      // Fetch real market data
      const candles = fetchCandles();
      if (candles.length === 0) {
        console.log('[ORB] No candles received, retrying...');
        await sleep(60_000);
        continue;
      }

      // Feed all candles to strategy (builds opening range from historical data)
      const signals = candles
        .map((c) => strategy.onCandle(c))
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
        .map((s) => ({ ...s, symbol: PROXY }));

      const lastCandle = candles[candles.length - 1];
      const currentPrice = lastCandle?.close ?? 0;

      console.log(`   ${PROXY}: $${currentPrice.toFixed(2)} | Candles: ${candles.length} | Signals: ${signals.length}`);

      // Fire any new signals
      if (signals.length > 0 && !state.activeTrade) {
        const sig = signals[signals.length - 1];
        const fired = await fireSignal(sig.action, sig.price, sig.notes || 'ORB breakout');
        if (fired) {
          state.activeTrade = {
            direction: sig.action === 'BUY' ? 'LONG' : 'SHORT',
            entryPrice: sig.price,
            openedAt: new Date().toISOString(),
          };
          state.signalsFired++;
          state.lastSessionDate = today;
          saveState(state);
        }
      }

      // Broadcast status
      const status = {
        agentId: 'orb_agent',
        status: 'ACTIVE',
        message: `${PROXY} $${currentPrice.toFixed(2)} | Signals: ${signals.length} | Trades: ${state.signalsFired}`,
        timestamp: new Date().toISOString(),
        agent: 'orb',
        mode: 'paper-live',
        symbol: SYMBOL,
        proxy: PROXY,
        candles_processed: candles.length,
        latest_price: currentPrice,
        signal_count: signals.length,
        active_trade: state.activeTrade,
        signals_fired_today: state.signalsFired,
      };

      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
      console.log(`AGENT_STATUS_UPDATE:${JSON.stringify(status)}`);

      await sleep(SCAN_INTERVAL_MS);

    } catch (err) {
      console.error(`[ORB] Error: ${err}`);
      await sleep(60_000);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(console.error);
