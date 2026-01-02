import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { YahooFinance } from './YahooFinance';

// Mock fetch globally
global.fetch = vi.fn();

describe('YahooFinance Multi-Pair Poller', () => {
  let yahooFx: YahooFinance;
  let emittedPrices: any[] = [];

  beforeEach(() => {
    yahooFx = new YahooFinance();
    emittedPrices = [];

    // Capture emitted price events
    yahooFx.on('price', (tick) => {
      emittedPrices.push(tick);
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    yahooFx.stop();
  });

  describe('Initialization', () => {
    it('should support 5 forex pairs', () => {
      const expectedPairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD'];

      // Access private symbols through any type for testing
      const symbols = (yahooFx as any).symbols;
      const normalizedPairs = symbols.map((s: any) => s.normalized);

      expectedPairs.forEach(pair => {
        expect(normalizedPairs).toContain(pair);
      });
    });

    it('should map yahoo symbols to normalized tickers', () => {
      const symbols = (yahooFx as any).symbols;

      expect(symbols).toContainEqual({ yahoo: 'EURUSD=X', normalized: 'EURUSD' });
      expect(symbols).toContainEqual({ yahoo: 'GBPUSD=X', normalized: 'GBPUSD' });
      expect(symbols).toContainEqual({ yahoo: 'USDJPY=X', normalized: 'USDJPY' });
      expect(symbols).toContainEqual({ yahoo: 'AUDUSD=X', normalized: 'AUDUSD' });
      expect(symbols).toContainEqual({ yahoo: 'USDCAD=X', normalized: 'USDCAD' });
    });
  });

  describe('Price Fetching', () => {
    it('should emit price events with correct ticker format', async () => {
      // Start the service first
      (yahooFx as any).isRunning = true;

      // Mock fetch response for EURUSD
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          chart: {
            result: [{
              meta: {
                regularMarketPrice: 1.0850,
                regularMarketTime: 1672531200
              }
            }]
          }
        })
      });

      // Call fetchPrice directly for testing
      await (yahooFx as any).fetchPrice('EURUSD=X', 'EURUSD');

      expect(emittedPrices.length).toBe(1);
      expect(emittedPrices[0].ticker).toBe('EURUSD');
      expect(emittedPrices[0].price).toBe(1.0850);
      expect(emittedPrices[0].source).toBe('YAHOO');
    });

    it('should handle multiple pairs sequentially', async () => {
      // Start the service first
      (yahooFx as any).isRunning = true;

      // Mock responses for multiple pairs
      const mockPairs = [
        { ticker: 'EURUSD', price: 1.0850 },
        { ticker: 'GBPUSD', price: 1.2650 },
        { ticker: 'USDJPY', price: 148.50 }
      ];

      mockPairs.forEach(pair => {
        (global.fetch as any).mockResolvedValueOnce({
          json: async () => ({
            chart: {
              result: [{
                meta: {
                  regularMarketPrice: pair.price,
                  regularMarketTime: 1672531200
                }
              }]
            }
          })
        });
      });

      // Fetch each pair
      await (yahooFx as any).fetchPrice('EURUSD=X', 'EURUSD');
      await (yahooFx as any).fetchPrice('GBPUSD=X', 'GBPUSD');
      await (yahooFx as any).fetchPrice('USDJPY=X', 'USDJPY');

      expect(emittedPrices.length).toBe(3);
      expect(emittedPrices[0].ticker).toBe('EURUSD');
      expect(emittedPrices[1].ticker).toBe('GBPUSD');
      expect(emittedPrices[2].ticker).toBe('USDJPY');
    });

    it('should handle fetch errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      // Should not throw
      await expect((yahooFx as any).fetchPrice('EURUSD=X', 'EURUSD')).resolves.not.toThrow();

      // Should not emit any prices
      expect(emittedPrices.length).toBe(0);
    });

    it('should include timestamp in emitted events', async () => {
      (yahooFx as any).isRunning = true;
      const mockTime = 1672531200;

      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          chart: {
            result: [{
              meta: {
                regularMarketPrice: 1.0850,
                regularMarketTime: mockTime
              }
            }]
          }
        })
      });

      await (yahooFx as any).fetchPrice('EURUSD=X', 'EURUSD');

      expect(emittedPrices[0].timestamp).toBe(mockTime * 1000);
    });

    it('should use fallback timestamp if not provided', async () => {
      (yahooFx as any).isRunning = true;
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          chart: {
            result: [{
              meta: {
                regularMarketPrice: 1.0850
                // No regularMarketTime
              }
            }]
          }
        })
      });

      const beforeTime = Date.now();
      await (yahooFx as any).fetchPrice('EURUSD=X', 'EURUSD');
      const afterTime = Date.now();

      expect(emittedPrices[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(emittedPrices[0].timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Start/Stop Behavior', () => {
    it('should set isRunning to true when started', () => {
      yahooFx.start();
      expect((yahooFx as any).isRunning).toBe(true);
    });

    it('should set isRunning to false when stopped', () => {
      yahooFx.start();
      yahooFx.stop();
      expect((yahooFx as any).isRunning).toBe(false);
    });

    it('should clear interval when stopped', () => {
      yahooFx.start();
      const interval = (yahooFx as any).interval;
      expect(interval).not.toBeNull();

      yahooFx.stop();
      expect((yahooFx as any).interval).toBeNull();
    });
  });

  describe('Price Validation', () => {
    it('should only emit when price is available', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          chart: {
            result: [{
              meta: {
                // No regularMarketPrice
                regularMarketTime: 1672531200
              }
            }]
          }
        })
      });

      await (yahooFx as any).fetchPrice('EURUSD=X', 'EURUSD');

      expect(emittedPrices.length).toBe(0);
    });

    it('should emit for each forex pair with correct data', async () => {
      (yahooFx as any).isRunning = true;
      const testPairs = [
        { yahoo: 'EURUSD=X', normalized: 'EURUSD', price: 1.0850 },
        { yahoo: 'GBPUSD=X', normalized: 'GBPUSD', price: 1.2650 },
        { yahoo: 'USDJPY=X', normalized: 'USDJPY', price: 148.50 },
        { yahoo: 'AUDUSD=X', normalized: 'AUDUSD', price: 0.6750 },
        { yahoo: 'USDCAD=X', normalized: 'USDCAD', price: 1.3550 }
      ];

      for (const pair of testPairs) {
        (global.fetch as any).mockResolvedValueOnce({
          json: async () => ({
            chart: {
              result: [{
                meta: {
                  regularMarketPrice: pair.price,
                  regularMarketTime: 1672531200
                }
              }]
            }
          })
        });

        await (yahooFx as any).fetchPrice(pair.yahoo, pair.normalized);
      }

      expect(emittedPrices.length).toBe(5);

      testPairs.forEach((pair, index) => {
        expect(emittedPrices[index].ticker).toBe(pair.normalized);
        expect(emittedPrices[index].price).toBe(pair.price);
        expect(emittedPrices[index].source).toBe('YAHOO');
      });
    });
  });
});
