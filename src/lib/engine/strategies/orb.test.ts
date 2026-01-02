import { describe, it, expect, beforeEach } from 'vitest';
import { ORBStrategy } from './orb';
import { Candle, StrategyConfig } from '../types';

describe('ORB Strategy', () => {
  let strategy: ORBStrategy;
  let config: StrategyConfig;

  beforeEach(() => {
    config = {
      id: 'orb_15m',
      name: 'ORB 15m Breakout',
      isActive: true,
      params: {
        startHour: 9,
        startMinute: 30,
        duration: 15
      },
      category: 'FUTURES'
    };
    strategy = new ORBStrategy(config);
  });

  describe('Initialization', () => {
    it('should initialize with correct properties', () => {
      expect(strategy.id).toBe('orb_15m');
      expect(strategy.name).toBe('ORB 15m Breakout');
      expect(strategy.category).toBe('FUTURES');
      expect(strategy.description).toBe('Trades the breakout of the first 15 minutes of the daily session.');
    });

    it('should be in FUTURES category', () => {
      expect(strategy.getCategories()).toContain('FUTURES');
    });
  });

  describe('Opening Range Detection', () => {
    it('should track opening range during first 15 minutes', () => {
      // First candle at 9:30 (local time)
      const candle1: Candle = {
        timestamp: '2026-01-01T09:30:00',
        open: 5000,
        high: 5005,
        low: 4995,
        close: 5003,
        volume: 1000
      };

      const signal1 = strategy.onCandle(candle1);
      expect(signal1).toBeNull(); // No signal during range formation

      // Second candle at 9:35 EST (14:35 UTC)
      const candle2: Candle = {
        timestamp: '2026-01-01T09:35:00',
        open: 5003,
        high: 5010,
        low: 4990,
        close: 5008,
        volume: 1200
      };

      const signal2 = strategy.onCandle(candle2);
      expect(signal2).toBeNull(); // Still building range

      // Third candle at 9:40 EST (14:40 UTC)
      const candle3: Candle = {
        timestamp: '2026-01-01T09:40:00',
        open: 5008,
        high: 5012,
        low: 5000,
        close: 5011,
        volume: 1100
      };

      const signal3 = strategy.onCandle(candle3);
      expect(signal3).toBeNull(); // Still within range period
    });

    it('should set range after duration completes', () => {
      // Build range over 3 candles (9:30, 9:35, 9:40)
      const candles: Candle[] = [
        {
          timestamp: '2026-01-01T09:30:00',
          open: 5000,
          high: 5010,
          low: 4990,
          close: 5005,
          volume: 1000
        },
        {
          timestamp: '2026-01-01T09:35:00',
          open: 5005,
          high: 5015,
          low: 4995,
          close: 5010,
          volume: 1200
        },
        {
          timestamp: '2026-01-01T09:40:00',
          open: 5010,
          high: 5012,
          low: 5008,
          close: 5011,
          volume: 1100
        }
      ];

      candles.forEach(candle => strategy.onCandle(candle));

      // At 9:45, range should be set (High: 5015, Low: 4990)
      const candle945: Candle = {
        timestamp: '2026-01-01T09:45:00',
        open: 5011,
        high: 5014,
        low: 5009,
        close: 5012,
        volume: 1000
      };

      const signal = strategy.onCandle(candle945);
      // No signal yet, as price is within range
      expect(signal).toBeNull();
    });
  });

  describe('Breakout Detection - Upside', () => {
    it('should generate BUY signal on upside breakout', () => {
      // Build opening range
      const rangeCandlesForUp: Candle[] = [
        {
          timestamp: '2026-01-01T09:30:00',
          open: 5000,
          high: 5010,
          low: 4990,
          close: 5005,
          volume: 1000
        },
        {
          timestamp: '2026-01-01T09:35:00',
          open: 5005,
          high: 5015,
          low: 4995,
          close: 5010,
          volume: 1200
        },
        {
          timestamp: '2026-01-01T09:40:00',
          open: 5010,
          high: 5012,
          low: 5008,
          close: 5011,
          volume: 1100
        }
      ];

      rangeCandlesForUp.forEach(candle => strategy.onCandle(candle));

      // Breakout candle - closes above high (5015)
      const breakoutCandle: Candle = {
        timestamp: '2026-01-01T10:00:00',
        open: 5014,
        high: 5025,
        low: 5013,
        close: 5020,
        volume: 2000
      };

      const signal = strategy.onCandle(breakoutCandle);

      expect(signal).not.toBeNull();
      expect(signal?.action).toBe('BUY');
      expect(signal?.price).toBe(5020);
      expect(signal?.strategy).toBe('ORB 15m Breakout');
      expect(signal?.notes).toContain('ORB 15m Upside Breakout');
    });

    it('should not trigger multiple upside breakouts in same session', () => {
      // Build opening range
      const rangeCandles: Candle[] = [
        {
          timestamp: '2026-01-01T09:30:00',
          open: 5000,
          high: 5010,
          low: 4990,
          close: 5005,
          volume: 1000
        },
        {
          timestamp: '2026-01-01T09:35:00',
          open: 5005,
          high: 5015,
          low: 4995,
          close: 5010,
          volume: 1200
        },
        {
          timestamp: '2026-01-01T09:40:00',
          open: 5010,
          high: 5012,
          low: 5008,
          close: 5011,
          volume: 1100
        }
      ];

      rangeCandles.forEach(candle => strategy.onCandle(candle));

      // First breakout
      const breakout1: Candle = {
        timestamp: '2026-01-01T10:00:00',
        open: 5014,
        high: 5025,
        low: 5013,
        close: 5020,
        volume: 2000
      };

      const signal1 = strategy.onCandle(breakout1);
      expect(signal1?.action).toBe('BUY');

      // Second breakout attempt
      const breakout2: Candle = {
        timestamp: '2026-01-01T11:00:00',
        open: 5020,
        high: 5030,
        low: 5019,
        close: 5028,
        volume: 1800
      };

      const signal2 = strategy.onCandle(breakout2);
      expect(signal2).toBeNull(); // Should not trigger again
    });
  });

  describe('Breakout Detection - Downside', () => {
    it('should generate SELL signal on downside breakout', () => {
      // Build opening range
      const rangeCandlesForDown: Candle[] = [
        {
          timestamp: '2026-01-01T09:30:00',
          open: 5000,
          high: 5010,
          low: 4990,
          close: 5005,
          volume: 1000
        },
        {
          timestamp: '2026-01-01T09:35:00',
          open: 5005,
          high: 5015,
          low: 4995,
          close: 5010,
          volume: 1200
        },
        {
          timestamp: '2026-01-01T09:40:00',
          open: 5010,
          high: 5012,
          low: 5008,
          close: 5011,
          volume: 1100
        }
      ];

      rangeCandlesForDown.forEach(candle => strategy.onCandle(candle));

      // Breakout candle - closes below low (4990)
      const breakoutCandle: Candle = {
        timestamp: '2026-01-01T10:00:00',
        open: 4995,
        high: 4996,
        low: 4980,
        close: 4985,
        volume: 2000
      };

      const signal = strategy.onCandle(breakoutCandle);

      expect(signal).not.toBeNull();
      expect(signal?.action).toBe('SELL');
      expect(signal?.price).toBe(4985);
      expect(signal?.strategy).toBe('ORB 15m Breakout');
      expect(signal?.notes).toContain('ORB 15m Downside Breakout');
    });

    it('should not trigger multiple downside breakouts in same session', () => {
      // Build opening range
      const rangeCandles: Candle[] = [
        {
          timestamp: '2026-01-01T09:30:00',
          open: 5000,
          high: 5010,
          low: 4990,
          close: 5005,
          volume: 1000
        },
        {
          timestamp: '2026-01-01T09:35:00',
          open: 5005,
          high: 5015,
          low: 4995,
          close: 5010,
          volume: 1200
        },
        {
          timestamp: '2026-01-01T09:40:00',
          open: 5010,
          high: 5012,
          low: 5008,
          close: 5011,
          volume: 1100
        }
      ];

      rangeCandles.forEach(candle => strategy.onCandle(candle));

      // First breakout
      const breakout1: Candle = {
        timestamp: '2026-01-01T10:00:00',
        open: 4995,
        high: 4996,
        low: 4980,
        close: 4985,
        volume: 2000
      };

      const signal1 = strategy.onCandle(breakout1);
      expect(signal1?.action).toBe('SELL');

      // Second breakout attempt
      const breakout2: Candle = {
        timestamp: '2026-01-01T11:00:00',
        open: 4985,
        high: 4986,
        low: 4970,
        close: 4975,
        volume: 1800
      };

      const signal2 = strategy.onCandle(breakout2);
      expect(signal2).toBeNull(); // Should not trigger again
    });
  });

  describe('Session Reset', () => {
    it('should reset range for new trading day', () => {
      // Day 1 - Build range and breakout
      const day1Candles: Candle[] = [
        {
          timestamp: '2026-01-01T09:30:00',
          open: 5000,
          high: 5010,
          low: 4990,
          close: 5005,
          volume: 1000
        },
        {
          timestamp: '2026-01-01T09:35:00',
          open: 5005,
          high: 5015,
          low: 4995,
          close: 5010,
          volume: 1200
        }
      ];

      day1Candles.forEach(candle => strategy.onCandle(candle));

      // Day 2 - Should reset and build new range
      const day2Candle1: Candle = {
        timestamp: '2026-01-02T09:30:00',
        open: 5100,
        high: 5110,
        low: 5095,
        close: 5105,
        volume: 1000
      };

      const signal = strategy.onCandle(day2Candle1);
      expect(signal).toBeNull(); // Building new range, no signal

      const day2Candle2: Candle = {
        timestamp: '2026-01-02T09:35:00',
        open: 5105,
        high: 5120,
        low: 5100,
        close: 5115,
        volume: 1200
      };

      strategy.onCandle(day2Candle2);

      // Breakout on day 2
      const day2Breakout: Candle = {
        timestamp: '2026-01-02T10:00:00',
        open: 5115,
        high: 5130,
        low: 5114,
        close: 5125,
        volume: 2000
      };

      const breakoutSignal = strategy.onCandle(day2Breakout);
      expect(breakoutSignal?.action).toBe('BUY');
      expect(breakoutSignal?.price).toBe(5125);
    });
  });

  describe('Configuration', () => {
    it('should respect isActive flag', () => {
      config.isActive = false;
      const inactiveStrategy = new ORBStrategy(config);

      const candle: Candle = {
        timestamp: '2026-01-01T09:30:00',
        open: 5000,
        high: 5010,
        low: 4990,
        close: 5005,
        volume: 1000
      };

      const signal = inactiveStrategy.onCandle(candle);
      expect(signal).toBeNull();
    });

    it('should use custom start time from params', () => {
      config.params.startHour = 8;
      config.params.startMinute = 0;
      const customStrategy = new ORBStrategy(config);

      const candle: Candle = {
        timestamp: '2026-01-01T08:00:00',
        open: 5000,
        high: 5010,
        low: 4990,
        close: 5005,
        volume: 1000
      };

      // Should process this candle as part of opening range
      const signal = customStrategy.onCandle(candle);
      expect(signal).toBeNull(); // Building range
    });

    it('should use custom duration from params', () => {
      config.params.duration = 30; // 30 minute opening range
      const customStrategy = new ORBStrategy(config);

      const candles: Candle[] = [
        {
          timestamp: '2026-01-01T09:30:00',
          open: 5000,
          high: 5010,
          low: 4990,
          close: 5005,
          volume: 1000
        },
        {
          timestamp: '2026-01-01T09:45:00', // Still within 30 min range
          open: 5005,
          high: 5015,
          low: 4995,
          close: 5010,
          volume: 1200
        },
        {
          timestamp: '2026-01-01T09:55:00', // Still within 30 min range
          open: 5010,
          high: 5020,
          low: 5008,
          close: 5018,
          volume: 1100
        }
      ];

      candles.forEach(candle => customStrategy.onCandle(candle));

      // After 30 minutes, breakout should trigger
      const breakout: Candle = {
        timestamp: '2026-01-01T10:05:00',
        open: 5018,
        high: 5030,
        low: 5017,
        close: 5025,
        volume: 2000
      };

      const signal = customStrategy.onCandle(breakout);
      expect(signal?.action).toBe('BUY');
    });
  });

  describe('onTick method', () => {
    it('should return null (not implemented)', () => {
      const signal = strategy.onTick('ES', 5000, '2026-01-01T10:00:00');
      expect(signal).toBeNull();
    });
  });
});
