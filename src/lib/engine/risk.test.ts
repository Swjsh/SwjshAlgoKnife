import { describe, it, expect } from 'vitest';
import { RiskManager, RiskParams } from './risk';

describe('RiskManager', () => {
  const defaultParams: RiskParams = {
    accountBalance: 10000,
    riskPerTradePercent: 1,
  };

  describe('calculatePositionSize', () => {
    it('should calculate position size correctly with entry and stop loss', () => {
      const size = RiskManager.calculatePositionSize(
        defaultParams,
        100, // entry price
        95   // stop loss
      );

      // Risk = 10000 * 1% = 100
      // Risk per unit = 100 - 95 = 5
      // Position size = 100 / 5 = 20
      expect(size).toBe(20);
    });

    it('should calculate position size with larger account balance', () => {
      const params: RiskParams = {
        accountBalance: 50000,
        riskPerTradePercent: 2,
      };

      const size = RiskManager.calculatePositionSize(params, 100, 98);

      // Risk = 50000 * 2% = 1000
      // Risk per unit = 100 - 98 = 2
      // Position size = 1000 / 2 = 500
      expect(size).toBe(500);
    });

    it('should return 0 when entry price equals stop loss', () => {
      const size = RiskManager.calculatePositionSize(
        defaultParams,
        100, // entry
        100  // stop loss (same)
      );

      expect(size).toBe(0);
    });

    it('should return 0 when risk per unit is zero', () => {
      const size = RiskManager.calculatePositionSize(
        defaultParams,
        100,
        100
      );

      expect(size).toBe(0);
    });

    it('should handle short positions (stop loss above entry)', () => {
      const size = RiskManager.calculatePositionSize(
        defaultParams,
        100, // entry price (short)
        105  // stop loss above
      );

      // Risk = 10000 * 1% = 100
      // Risk per unit = |100 - 105| = 5
      // Position size = 100 / 5 = 20
      expect(size).toBe(20);
    });

    it('should return 8 decimal places precision', () => {
      const size = RiskManager.calculatePositionSize(
        defaultParams,
        100.123,
        99.456
      );

      // Verify it's properly rounded to 8 decimals
      const decimalPlaces = (size.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(8);
    });

    it('should scale position size with risk percentage', () => {
      const params1: RiskParams = {
        accountBalance: 10000,
        riskPerTradePercent: 1,
      };

      const params2: RiskParams = {
        accountBalance: 10000,
        riskPerTradePercent: 2,
      };

      const size1 = RiskManager.calculatePositionSize(params1, 100, 95);
      const size2 = RiskManager.calculatePositionSize(params2, 100, 95);

      // With 2x risk, position should be 2x larger
      expect(size2).toBe(size1 * 2);
    });
  });

  describe('calculateFixedSize', () => {
    it('should return fixed size for crypto/stocks (price > 200)', () => {
      const params: RiskParams = {
        accountBalance: 10000,
        riskPerTradePercent: 1,
      };

      const size = RiskManager.calculateFixedSize(params, 250); // High price

      // Amount to risk = 10000 * 1% = 100
      // Size = 100 / 250 = 0.4
      expect(size).toBe(0.4);
    });

    it('should return fixed size for micro-cap (price < 0.5)', () => {
      const params: RiskParams = {
        accountBalance: 10000,
        riskPerTradePercent: 1,
      };

      const size = RiskManager.calculateFixedSize(params, 0.05);

      // Amount to risk = 10000 * 1% = 100
      // Size = 100 / 0.05 = 2000
      expect(size).toBe(2000);
    });

    it('should detect FX pairs and apply pip-based sizing for EUR/USD (price ~1.1)', () => {
      const params: RiskParams = {
        accountBalance: 10000,
        riskPerTradePercent: 1,
      };

      const size = RiskManager.calculateFixedSize(params, 1.1);

      // FX detected: price between 0.5 and 200
      // Amount to risk = 100
      // Not JPY (1.1 < 50), so pip = 0.0001
      // Default stop = 50 pips = 50 * 0.0001 = 0.005
      // Units = 100 / 0.005 = 20000
      // Lots = 20000 / 100000 = 0.2
      expect(size).toBe(0.2);
    });

    it('should detect JPY pairs and use 0.01 pip size (price > 50)', () => {
      const params: RiskParams = {
        accountBalance: 10000,
        riskPerTradePercent: 1,
      };

      const size = RiskManager.calculateFixedSize(params, 150); // JPY price range

      // FX detected: price between 0.5 and 200
      // Amount to risk = 100
      // JPY detected (150 > 50), so pip = 0.01
      // Default stop = 50 pips = 50 * 0.01 = 0.5
      // Units = 100 / 0.5 = 200
      // Lots = 200 / 100000 = 0.002
      expect(size).toBe(0.002);
    });

    it('should enforce minimum micro-lot size for FX (0.01)', () => {
      const params: RiskParams = {
        accountBalance: 100,
        riskPerTradePercent: 0.1, // Very small risk
      };

      const size = RiskManager.calculateFixedSize(params, 1.1);

      // Even with tiny risk, should not go below 0.01 micro-lot
      expect(size).toBeGreaterThanOrEqual(0.01);
    });

    it('should apply leverage multiplier to risk amount', () => {
      const params: RiskParams = {
        accountBalance: 10000,
        riskPerTradePercent: 1,
      };

      const sizeNoLeverage = RiskManager.calculateFixedSize(params, 100, 1);
      const sizeWith2xLeverage = RiskManager.calculateFixedSize(params, 100, 2);

      // With 2x leverage, risk doubles so size doubles
      expect(sizeWith2xLeverage).toBe(sizeNoLeverage * 2);
    });

    it('should handle edge case: price exactly at 0.5 (boundary)', () => {
      const params: RiskParams = {
        accountBalance: 10000,
        riskPerTradePercent: 1,
      };

      // At boundary, should still apply crypto/stock logic (not FX)
      const size = RiskManager.calculateFixedSize(params, 0.5);

      // Should treat as crypto/stock: 100 / 0.5 = 200
      expect(size).toBe(200);
    });

    it('should handle edge case: price exactly at 200 (boundary)', () => {
      const params: RiskParams = {
        accountBalance: 10000,
        riskPerTradePercent: 1,
      };

      // At boundary, should use crypto/stock logic
      const size = RiskManager.calculateFixedSize(params, 200);

      // Should treat as crypto/stock: 100 / 200 = 0.5
      expect(size).toBe(0.5);
    });

    it('should return proper precision for calculated sizes', () => {
      const params: RiskParams = {
        accountBalance: 10000,
        riskPerTradePercent: 1,
      };

      const size = RiskManager.calculateFixedSize(params, 123.456);

      // Verify proper rounding
      const decimalPlaces = (size.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(8);
    });
  });

  describe('Position sizing validation rules', () => {
    it('should scale with account balance', () => {
      const smallAccount: RiskParams = {
        accountBalance: 1000,
        riskPerTradePercent: 1,
      };

      const largeAccount: RiskParams = {
        accountBalance: 100000,
        riskPerTradePercent: 1,
      };

      const smallSize = RiskManager.calculatePositionSize(smallAccount, 100, 95);
      const largeSize = RiskManager.calculatePositionSize(largeAccount, 100, 95);

      // Larger account should have larger position (10x in this case)
      expect(largeSize).toBe(smallSize * 10);
    });

    it('should handle multi-tenant context with userId', () => {
      const params: RiskParams = {
        accountBalance: 10000,
        riskPerTradePercent: 1,
        userId: 'user-123',
      };

      const size = RiskManager.calculatePositionSize(params, 100, 95);

      // Should still calculate correctly with userId
      expect(size).toBe(20);
    });

    it('should handle multi-tenant context with botId', () => {
      const params: RiskParams = {
        accountBalance: 10000,
        riskPerTradePercent: 1,
        botId: 'bot-456',
      };

      const size = RiskManager.calculatePositionSize(params, 100, 95);

      // Should still calculate correctly with botId
      expect(size).toBe(20);
    });
  });
});
