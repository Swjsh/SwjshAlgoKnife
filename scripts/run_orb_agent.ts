import fs from 'node:fs';
import path from 'node:path';
import { ORBStrategy } from '../src/lib/engine/strategies/orb';
import type { Candle, StrategyConfig } from '../src/lib/engine/types';

function generateSyntheticCandles(now: Date): Candle[] {
  const candles: Candle[] = [];
  const session = new Date(now);
  session.setHours(9, 30, 0, 0);

  let price = 5000;
  for (let i = 0; i < 24; i++) {
    const ts = new Date(session.getTime() + i * 5 * 60 * 1000);
    const drift = i < 3 ? (Math.random() - 0.4) * 3 : (Math.random() - 0.45) * 6;
    const open = price;
    const close = Math.max(1, open + drift);
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    const volume = 500 + Math.round(Math.random() * 400);

    candles.push({
      timestamp: ts.toISOString(),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });

    price = close;
  }

  return candles;
}

function main() {
  const config: StrategyConfig = {
    id: 'orb_15m',
    name: 'ORB 15m Breakout',
    isActive: true,
    params: { startHour: 9, startMinute: 30, duration: 15 },
    category: 'FUTURES',
  };

  const strategy = new ORBStrategy(config);
  const now = new Date();
  const symbol = process.argv[2] || 'ES';

  const candles = generateSyntheticCandles(now);
  const signals = candles
    .map((candle) => strategy.onCandle(candle))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => ({ ...s, symbol }));

  const lastCandle = candles[candles.length - 1];
  const status = {
    agent: 'orb',
    mode: 'paper-sim',
    symbol,
    generated_at: now.toISOString(),
    candles_processed: candles.length,
    latest_price: lastCandle?.close ?? null,
    signal_count: signals.length,
    latest_signal: signals.length > 0 ? signals[signals.length - 1] : null,
    heartbeat: 'ORB standalone runner online (synthetic feed fallback).',
  };

  const outPath = path.join(process.cwd(), 'data', 'orb_agent_status.json');
  fs.writeFileSync(outPath, JSON.stringify(status, null, 2));

  console.log(`ORB runner processed ${candles.length} candles for ${symbol}`);
  if (status.latest_signal) {
    console.log(`Signal: ${status.latest_signal.action} @ ${status.latest_signal.price}`);
  } else {
    console.log('Signal: none');
  }
  console.log(`Status written: ${outPath}`);
  console.log(`AGENT_STATUS_UPDATE:${JSON.stringify(status)}`);
}

main();
