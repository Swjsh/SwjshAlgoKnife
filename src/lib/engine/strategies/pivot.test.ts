import { describe, expect, test } from 'vitest';
import { computePivots, PivotStrategy } from './pivot';
import type { Candle, StrategyConfig } from '../types';

describe('PivotStrategy', () => {
  test('computePivots matches classic formula (spot check)', () => {
    const p = computePivots({ open: 0, high: 110, low: 90, close: 100 });
    // P = (110+90+100)/3 = 100
    expect(p.P).toBe(100);
    // R1 = 2P - L = 110
    expect(p.R1).toBe(110);
    // S1 = 2P - H = 90
    expect(p.S1).toBe(90);
  });

  test('emits a signal after pivots are computed and confluence is met', () => {
    const cfg: StrategyConfig = {
      id: 'pivot_pete',
      name: 'Pivot Pete',
      isActive: true,
      category: 'EQUITY',
      params: { symbol: 'ES', minConfluence: 1, tolerancePct: 0.0005 },
    };

    const s = new PivotStrategy(cfg);

    // Day 1 candles (build agg)
    const day1: Candle[] = [
      { timestamp: '2026-02-01T14:30:00.000Z', open: 100, high: 110, low: 90, close: 100, volume: 1 },
      { timestamp: '2026-02-01T14:35:00.000Z', open: 100, high: 108, low: 95, close: 105, volume: 1 },
    ];

    for (const c of day1) s.onCandle(c);

    // Day 2 first candle triggers day rollover -> daily pivots computed from day1.
    s.onCandle({ timestamp: '2026-02-02T14:30:00.000Z', open: 100, high: 101, low: 99, close: 100, volume: 1 });

    // Construct a rejection candle near P~100 (wick below, bullish close)
    const sig = s.onCandle({
      timestamp: '2026-02-02T14:35:00.000Z',
      open: 101.0,
      high: 102.2,
      low: 100.8,
      close: 101.9,
      volume: 1,
    });

    expect(sig).not.toBeNull();
    expect(sig?.action).toBe('BUY');
    expect(sig?.symbol).toBe('ES');
    expect(typeof sig?.stopLoss).toBe('number');
    expect(typeof sig?.takeProfit).toBe('number');
  });
});
