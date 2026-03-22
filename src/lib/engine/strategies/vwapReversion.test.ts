import { describe, it, expect, beforeEach } from 'vitest';
import { VWAPStrategy } from './vwapReversion';
import { Candle, StrategyConfig } from '../types';

describe('VWAP Reversion Strategy', () => {
  let strategy: VWAPStrategy;
  let config: StrategyConfig;

  beforeEach(() => {
    config = {
      id: 'vwap_reversion',
      name: 'VWAP Reversion',
      isActive: true,
      params: {
        threshold: 1.5, // 1.5% deviation
      },
      category: 'CRYPTO',
    };
    strategy = new VWAPStrategy(config);
  });

  describe('Initialization', () => {
    it('should initialize with correct properties', () => {
      expect(strategy.id).toBe('vwap_reversion');
      expect(strategy.name).toBe('VWAP Reversion');
      expect(strategy.category).toBe('CRYPTO');
      expect(strategy.description).toContain('Volume Weighted Average Price');
    });

    it('should be in CRYPTO category', () => {
      expect(strategy.getCategories()).toContain('CRYPTO');
    });
  });

  describe('VWAP Calculation', () => {
    it('should calculate VWAP correctly with single candle', () => {
      const candle: Candle = {
        timestamp: '2026-01-01T10:00:00',
        open: 100,
        high: 105,
        low: 95,
        close: 100,
        volume: 1000,
      };

      strategy.onCandle(candle);

      // After first candle, VWAP = (100 * 1000) / 1000 = 100
      // Deviation = (100 - 100) / 100 * 100 = 0%
      // Should not trigger signal
      const signal = strategy.onCandle(candle);
      expect(signal).toBeNull();
    });

    it('should accumulate VWAP over multiple candles', () => {
      const candles: Candle[] = [
        {
          timestamp: '2026-01-01T10:00:00',
          open: 100,
          high: 105,
          low: 95,
          close: 100,
          volume: 1000,
        },
        {
          timestamp: '2026-01-01T10:05:00',
          open: 100,
          high: 110,
          low: 99,
          close: 105,
          volume: 2000,
        },
        {
          timestamp: '2026-01-01T10:10:00',
          open: 105,
          high: 106,
          low: 102,
          close: 104,
          volume: 1500,
        },
      ];

      candles.forEach(candle => strategy.onCandle(candle));

      // VWAP = (100*1000 + 105*2000 + 104*1500) / (1000+2000+1500)
      // = (100000 + 210000 + 156000) / 4500 = 466000 / 4500 = 103.56
      // Close price = 104, deviation = (104 - 103.56) / 103.56 * 100 = 0.42%
      // Below threshold (1.5%), so no signal
      const signal = strategy.onCandle(candles[2]);
      expect(signal).toBeNull();
    });

    it('should reset VWAP on new trading day', () => {
      // Day 1
      const day1Candle: Candle = {
        timestamp: '2026-01-01T10:00:00',
        open: 100,
        high: 105,
        low: 95,
        close: 100,
        volume: 1000,
      };

      strategy.onCandle(day1Candle);

      // Day 2 - should reset VWAP
      const day2Candle: Candle = {
        timestamp: '2026-01-02T10:00:00',
        open: 102,
        high: 107,
        low: 98,
        close: 102,
        volume: 1500,
      };

      // First candle of new day resets, VWAP = (102 * 1500) / 1500 = 102
      // Deviation = (102 - 102) / 102 * 100 = 0%
      const signal = strategy.onCandle(day2Candle);
      expect(signal).toBeNull();
    });
  });

  describe('Below VWAP - BUY Signal (Mean Reversion Long)', () => {
    it('should generate BUY signal when price is significantly below VWAP', () => {
      // Build VWAP around 100
      const setupCandles: Candle[] = [
        {
          timestamp: '2026-01-01T10:00:00',
          open: 100,
          high: 105,
          low: 95,
          close: 100,
          volume: 2000,
        },
        {
          timestamp: '2026-01-01T10:05:00',
          open: 100,
          high: 102,
          low: 98,
          close: 101,
          volume: 2000,
        },
      ];

      setupCandles.forEach(c => strategy.onCandle(c));

      // VWAP ≈ 100.5
      // Now price drops below VWAP threshold
      const dropCandle: Candle = {
        timestamp: '2026-01-01T10:10:00',
        open: 99,
        high: 99.5,
        low: 97.8,
        close: 98, // ~2% below VWAP of ~100.5
        volume: 1000,
      };

      const signal = strategy.onCandle(dropCandle);

      expect(signal).not.toBeNull();
      expect(signal?.action).toBe('BUY');
      expect(signal?.price).toBe(98);
      expect(signal?.strategy).toBe('VWAP Reversion');
      expect(signal?.notes).toContain('below VWAP');
      expect(signal?.notes).toContain('Mean reversion LONG');
    });

    it('should not generate signal if below threshold not exceeded', () => {
      const setupCandles: Candle[] = [
        {
          timestamp: '2026-01-01T10:00:00',
          open: 100,
          high: 105,
          low: 95,
          close: 100,
          volume: 2000,
        },
      ];

      setupCandles.forEach(c => strategy.onCandle(c));

      // Price slightly below VWAP but not enough
      const slightDropCandle: Candle = {
        timestamp: '2026-01-01T10:05:00',
        open: 100,
        high: 100.5,
        low: 99.2,
        close: 99.5, // Only ~0.5% below VWAP
        volume: 1000,
      };

      const signal = strategy.onCandle(slightDropCandle);
      expect(signal).toBeNull();
    });
  });

  describe('Above VWAP - SELL Signal (Mean Reversion Short)', () => {
    it('should generate SELL signal when price is significantly above VWAP', () => {
      // Build VWAP around 100
      const setupCandles: Candle[] = [
        {
          timestamp: '2026-01-01T10:00:00',
          open: 100,
          high: 105,
          low: 95,
          close: 100,
          volume: 2000,
        },
        {
          timestamp: '2026-01-01T10:05:00',
          open: 100,
          high: 102,
          low: 98,
          close: 99,
          volume: 2000,
        },
      ];

      setupCandles.forEach(c => strategy.onCandle(c));

      // Now price spikes above VWAP
      const spikeCandle: Candle = {
        timestamp: '2026-01-01T10:10:00',
        open: 102,
        high: 103,
        low: 101.8,
        close: 102.5, // ~2.5% above VWAP
        volume: 1500,
      };

      const signal = strategy.onCandle(spikeCandle);

      expect(signal).not.toBeNull();
      expect(signal?.action).toBe('SELL');
      expect(signal?.price).toBe(102.5);
      expect(signal?.strategy).toBe('VWAP Reversion');
      expect(signal?.notes).toContain('above VWAP');
      expect(signal?.notes).toContain('Mean reversion SHORT');
    });

    it('should not trigger multiple signals at exact same level', () => {
      // Setup VWAP
      const setupCandles: Candle[] = [
        {
          timestamp: '2026-01-01T10:00:00',
          open: 100,
          high: 105,
          low: 95,
          close: 100,
          volume: 2000,
        },
      ];

      setupCandles.forEach(c => strategy.onCandle(c));

      // First spike
      const spike1: Candle = {
        timestamp: '2026-01-01T10:05:00',
        open: 101,
        high: 102,
        low: 100.8,
        close: 101.8, // ~1.8% above VWAP
        volume: 1000,
      };

      const signal1 = strategy.onCandle(spike1);
      expect(signal1?.action).toBe('SELL');

      // Second candle, still above VWAP but should generate new signal
      const spike2: Candle = {
        timestamp: '2026-01-01T10:10:00',
        open: 101.8,
        high: 102.5,
        low: 101.5,
        close: 102.3, // Still above VWAP
        volume: 1200,
      };

      const signal2 = strategy.onCandle(spike2);
      // Strategy generates signal on each cross, so this should also signal
      expect(signal2?.action).toBe('SELL');
    });
  });

  describe('Configuration', () => {
    it('should respect isActive flag', () => {
      config.isActive = false;
      const inactiveStrategy = new VWAPStrategy(config);

      const candle: Candle = {
        timestamp: '2026-01-01T10:00:00',
        open: 100,
        high: 105,
        low: 95,
        close: 50, // Severely below - would trigger if active
        volume: 1000,
      };

      const signal = inactiveStrategy.onCandle(candle);
      expect(signal).toBeNull();
    });

    it('should use custom threshold from params', () => {
      config.params.threshold = 3.0; // Higher threshold = fewer signals
      const customStrategy = new VWAPStrategy(config);

      // Build VWAP
      const setupCandles: Candle[] = [
        {
          timestamp: '2026-01-01T10:00:00',
          open: 100,
          high: 105,
          low: 95,
          close: 100,
          volume: 2000,
        },
      ];

      setupCandles.forEach(c => customStrategy.onCandle(c));

      // Price drops 2% - below default threshold but above custom 3%
      const dropCandle: Candle = {
        timestamp: '2026-01-01T10:05:00',
        open: 100,
        high: 100,
        low: 97.8,
        close: 98, // ~2% below
        volume: 1000,
      };

      const signal = customStrategy.onCandle(dropCandle);
      expect(signal).toBeNull(); // Should not trigger with 3% threshold
    });

    it('should default to 1.5% threshold if not provided', () => {
      config.params = {}; // No threshold specified
      const defaultStrategy = new VWAPStrategy(config);

      // Build VWAP
      const setupCandles: Candle[] = [
        {
          timestamp: '2026-01-01T10:00:00',
          open: 100,
          high: 105,
          low: 95,
          close: 100,
          volume: 2000,
        },
      ];

      setupCandles.forEach(c => defaultStrategy.onCandle(c));

      // Price drops 1.6% - above default threshold
      const dropCandle: Candle = {
        timestamp: '2026-01-01T10:05:00',
        open: 100,
        high: 100.1,
        low: 98.3,
        close: 98.4, // ~1.6% below VWAP of 100
        volume: 1000,
      };

      const signal = defaultStrategy.onCandle(dropCandle);
      expect(signal).not.toBeNull();
      expect(signal?.action).toBe('BUY');
    });
  });

  describe('onTick method', () => {
    it('should return null (not implemented)', () => {
      const signal = strategy.onTick('BTC', 50000, '2026-01-01T10:00:00');
      expect(signal).toBeNull();
    });
  });

  describe('Symbol and Timestamp', () => {
    it('should include correct timestamp in signal', () => {
      const setupCandles: Candle[] = [
        {
          timestamp: '2026-01-01T10:00:00',
          open: 100,
          high: 105,
          low: 95,
          close: 100,
          volume: 2000,
        },
      ];

      setupCandles.forEach(c => strategy.onCandle(c));

      const triggerCandle: Candle = {
        timestamp: '2026-01-01T10:05:30.123Z',
        open: 100,
        high: 100,
        low: 96.5,
        close: 97,
        volume: 1000,
      };

      const signal = strategy.onCandle(triggerCandle);
      expect(signal?.timestamp).toBe('2026-01-01T10:05:30.123Z');
    });

    it('should use DYNAMIC as symbol', () => {
      const setupCandles: Candle[] = [
        {
          timestamp: '2026-01-01T10:00:00',
          open: 100,
          high: 105,
          low: 95,
          close: 100,
          volume: 2000,
        },
      ];

      setupCandles.forEach(c => strategy.onCandle(c));

      const triggerCandle: Candle = {
        timestamp: '2026-01-01T10:05:00',
        open: 100,
        high: 100,
        low: 96.5,
        close: 97,
        volume: 1000,
      };

      const signal = strategy.onCandle(triggerCandle);
      expect(signal?.symbol).toBe('DYNAMIC');
    });
  });

  describe('Edge cases', () => {
    it('should handle zero volume gracefully', () => {
      const candle: Candle = {
        timestamp: '2026-01-01T10:00:00',
        open: 100,
        high: 105,
        low: 95,
        close: 100,
        volume: 0,
      };

      // Should not crash
      const signal = strategy.onCandle(candle);
      expect(signal).toBeNull(); // VWAP becomes NaN, so no signal
    });

    it('should handle very large prices', () => {
      const setupCandles: Candle[] = [
        {
          timestamp: '2026-01-01T10:00:00',
          open: 100000,
          high: 105000,
          low: 95000,
          close: 100000,
          volume: 2000,
        },
      ];

      setupCandles.forEach(c => strategy.onCandle(c));

      const dropCandle: Candle = {
        timestamp: '2026-01-01T10:05:00',
        open: 100000,
        high: 100000,
        low: 97500,
        close: 98000, // ~2% below
        volume: 1000,
      };

      const signal = strategy.onCandle(dropCandle);
      expect(signal?.action).toBe('BUY');
    });

    it('should handle very small prices', () => {
      const setupCandles: Candle[] = [
        {
          timestamp: '2026-01-01T10:00:00',
          open: 0.001,
          high: 0.0015,
          low: 0.0008,
          close: 0.001,
          volume: 2000,
        },
      ];

      setupCandles.forEach(c => strategy.onCandle(c));

      const dropCandle: Candle = {
        timestamp: '2026-01-01T10:05:00',
        open: 0.001,
        high: 0.0009,
        low: 0.00075,
        close: 0.00098, // ~2% below VWAP
        volume: 1000,
      };

      const signal = strategy.onCandle(dropCandle);
      expect(signal?.action).toBe('BUY');
    });
  });
});
