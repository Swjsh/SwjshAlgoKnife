/**
 * Correlation Analysis and Z-Score Utilities
 *
 * Provides statistical functions for quantitative analysis including:
 * - Z-score calculation for mean reversion signals
 * - Rolling correlation for pair trading and regime detection
 * - Returns calculation for momentum analysis
 * - Series normalization for cross-asset comparison
 */

const DEFAULT_LOOKBACK = 20;

/**
 * Calculate the mean of an array of numbers
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate the standard deviation of an array of numbers
 */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map((val) => (val - avg) ** 2);
  return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length);
}

/**
 * Calculate Z-score of the latest value compared to rolling mean/stddev.
 *
 * The Z-score measures how many standard deviations the current value
 * is from the rolling mean. Useful for mean reversion strategies.
 *
 * @param values - Array of numeric values (most recent value last)
 * @param lookback - Number of periods for rolling window (default: 20)
 * @returns Z-score of the latest value, or 0 if calculation is not possible
 *
 * @example
 * ```ts
 * const prices = [100, 102, 101, 103, 105, 104, 106, 108, 107, 109];
 * const zscore = calculateZScore(prices, 5);
 * // Returns z-score of 109 relative to last 5 values
 * ```
 */
export function calculateZScore(values: number[], lookback: number = DEFAULT_LOOKBACK): number {
  if (values.length === 0) return 0;

  // Use available data if shorter than lookback
  const effectiveLookback = Math.min(lookback, values.length);
  const window = values.slice(-effectiveLookback);

  const avg = mean(window);
  const std = stdDev(window);

  // Handle constant values (stddev = 0)
  if (std === 0) return 0;

  const latestValue = values[values.length - 1];
  return (latestValue - avg) / std;
}

/**
 * Calculate Pearson correlation coefficient between two series.
 *
 * Correlation ranges from -1 (perfect negative) to +1 (perfect positive).
 * Used for pair trading, hedge ratio calculation, and regime detection.
 *
 * @param seriesA - First numeric series
 * @param seriesB - Second numeric series (must be same length as seriesA)
 * @param lookback - Number of periods for rolling window (default: 20)
 * @returns Pearson correlation coefficient, or 0 if calculation is not possible
 *
 * @example
 * ```ts
 * const gold = [1800, 1810, 1805, 1820, 1815];
 * const silver = [24, 24.5, 24.2, 25, 24.8];
 * const correlation = calculateRollingCorrelation(gold, silver, 5);
 * // Returns correlation between gold and silver prices
 * ```
 */
export function calculateRollingCorrelation(
  seriesA: number[],
  seriesB: number[],
  lookback: number = DEFAULT_LOOKBACK
): number {
  // Need at least 2 data points and matching lengths
  if (seriesA.length === 0 || seriesB.length === 0) return 0;
  if (seriesA.length !== seriesB.length) return 0;

  // Use available data if shorter than lookback
  const effectiveLookback = Math.min(lookback, seriesA.length);
  const windowA = seriesA.slice(-effectiveLookback);
  const windowB = seriesB.slice(-effectiveLookback);

  if (effectiveLookback < 2) return 0;

  const meanA = mean(windowA);
  const meanB = mean(windowB);
  const stdA = stdDev(windowA);
  const stdB = stdDev(windowB);

  // Handle constant values in either series
  if (stdA === 0 || stdB === 0) return 0;

  // Calculate covariance
  let covariance = 0;
  for (let i = 0; i < effectiveLookback; i++) {
    covariance += (windowA[i] - meanA) * (windowB[i] - meanB);
  }
  covariance /= effectiveLookback;

  // Pearson correlation = covariance / (stdA * stdB)
  return covariance / (stdA * stdB);
}

/**
 * Calculate percentage returns from a price series.
 *
 * Returns are calculated as (price[i] - price[i-1]) / price[i-1].
 * The output array has length n-1 where n is the input length.
 *
 * @param prices - Array of prices (oldest first)
 * @returns Array of percentage returns (as decimals, not percentages)
 *
 * @example
 * ```ts
 * const prices = [100, 102, 101, 105];
 * const returns = calculateReturns(prices);
 * // Returns [0.02, -0.0098, 0.0396]
 * ```
 */
export function calculateReturns(prices: number[]): number[] {
  if (prices.length < 2) return [];

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prevPrice = prices[i - 1];
    // Handle division by zero
    if (prevPrice === 0) {
      returns.push(0);
    } else {
      returns.push((prices[i] - prevPrice) / prevPrice);
    }
  }

  return returns;
}

/**
 * Normalize an entire series to Z-scores.
 *
 * Each value is transformed to represent how many standard deviations
 * it is from the series mean. Useful for comparing assets with different
 * price scales or volatility profiles.
 *
 * @param values - Array of numeric values to normalize
 * @returns Array of Z-scores with same length as input
 *
 * @example
 * ```ts
 * const prices = [100, 102, 98, 105, 101];
 * const normalized = normalizeToZScores(prices);
 * // Returns Z-score for each price relative to full series statistics
 * ```
 */
export function normalizeToZScores(values: number[]): number[] {
  if (values.length === 0) return [];

  const avg = mean(values);
  const std = stdDev(values);

  // Handle constant values (stddev = 0)
  if (std === 0) {
    return values.map(() => 0);
  }

  return values.map((val) => (val - avg) / std);
}
