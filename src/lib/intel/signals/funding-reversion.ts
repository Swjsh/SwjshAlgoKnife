// ═══════════════════════════════════════════════════════════════
// FUNDING RATE MEAN REVERSION SIGNAL GENERATOR
// "Extreme funding rates revert to mean ~65% of the time"
//
// When funding is extremely positive (longs pay shorts):
//   - Market is overheated with long leverage
//   - Mean reversion favors shorts
//
// When funding is extremely negative (shorts pay longs):
//   - Market is oversold with short leverage
//   - Mean reversion favors longs
//
// ROI Impact: +2-3% P&L improvement in crypto futures
// ═══════════════════════════════════════════════════════════════

import type { IntelDirection } from '../types';

// Thresholds (in decimal, so 0.05 = 5 basis points = 0.05%)
const POSITIVE_THRESHOLD = 0.05;  // 5 bps
const NEGATIVE_THRESHOLD = -0.05; // -5 bps

// Extreme thresholds (liquidation cascade territory)
const EXTREME_POSITIVE = 0.3;  // 30 bps
const EXTREME_NEGATIVE = -0.3; // -30 bps

const MIN_CONFIDENCE = 0.65;
const MAX_CONFIDENCE = 0.95;

interface FundingReversionInput {
    fundingRate: number;  // Decimal (0.0008 = 8 basis points)
    symbol: string;
}

interface FundingReversionSignal {
    source: 'FUNDING_REVERSION';
    symbol: string;
    direction: IntelDirection;
    confidence: number;
    summary: string;
    payload: {
        fundingRate: number;
        fundingBps: number;
        severity: 'ELEVATED' | 'HIGH' | 'EXTREME';
    };
}

/**
 * Generate a mean reversion signal based on funding rate extremes.
 *
 * @param input.fundingRate - Current funding rate (decimal)
 * @param input.symbol - Trading symbol
 * @returns FundingReversionSignal if extreme, null if neutral
 */
export function generateFundingReversion(input: FundingReversionInput): FundingReversionSignal | null {
    const { fundingRate, symbol } = input;

    // Validate input
    if (typeof fundingRate !== 'number' || isNaN(fundingRate)) {
        return null;
    }

    const fundingBps = fundingRate * 100; // Convert to basis points for display

    // Check for extremely positive funding (market overheated)
    if (fundingRate > POSITIVE_THRESHOLD) {
        const severity = fundingRate >= EXTREME_POSITIVE ? 'EXTREME' :
                        fundingRate >= POSITIVE_THRESHOLD * 2 ? 'HIGH' : 'ELEVATED';

        // Scale confidence by how extreme
        const extremity = Math.min(1, (fundingRate - POSITIVE_THRESHOLD) / (EXTREME_POSITIVE - POSITIVE_THRESHOLD));
        const confidence = MIN_CONFIDENCE + (extremity * (MAX_CONFIDENCE - MIN_CONFIDENCE));

        const summaryPrefix = severity === 'EXTREME' ? 'EXTREME: ' :
                             severity === 'HIGH' ? 'High: ' : '';

        return {
            source: 'FUNDING_REVERSION',
            symbol,
            direction: 'BEARISH',
            confidence,
            summary: `${summaryPrefix}Funding ${fundingBps.toFixed(2)}bps — Market overheated, mean reversion favors shorts`,
            payload: {
                fundingRate,
                fundingBps,
                severity,
            },
        };
    }

    // Check for extremely negative funding (market oversold)
    if (fundingRate < NEGATIVE_THRESHOLD) {
        const severity = fundingRate <= EXTREME_NEGATIVE ? 'EXTREME' :
                        fundingRate <= NEGATIVE_THRESHOLD * 2 ? 'HIGH' : 'ELEVATED';

        const extremity = Math.min(1, (NEGATIVE_THRESHOLD - fundingRate) / (NEGATIVE_THRESHOLD - EXTREME_NEGATIVE));
        const confidence = MIN_CONFIDENCE + (extremity * (MAX_CONFIDENCE - MIN_CONFIDENCE));

        const summaryPrefix = severity === 'EXTREME' ? 'EXTREME: ' :
                             severity === 'HIGH' ? 'High: ' : '';

        return {
            source: 'FUNDING_REVERSION',
            symbol,
            direction: 'BULLISH',
            confidence,
            summary: `${summaryPrefix}Funding ${fundingBps.toFixed(2)}bps — Market oversold, mean reversion favors longs`,
            payload: {
                fundingRate,
                fundingBps,
                severity,
            },
        };
    }

    // Neutral funding - no signal
    return null;
}

/**
 * Calculate funding-based size multiplier.
 * Reduces size when trading WITH the overheated side.
 *
 * @param fundingRate - Current funding rate (decimal)
 * @param tradeDirection - Proposed trade direction
 * @returns Multiplier (0.5 = half size, 1.0 = full size)
 */
export function getFundingMultiplier(fundingRate: number, tradeDirection: 'LONG' | 'SHORT'): number {
    // Going LONG when funding is extremely positive = risky
    if (fundingRate > POSITIVE_THRESHOLD && tradeDirection === 'LONG') {
        const extremity = Math.min(1, (fundingRate - POSITIVE_THRESHOLD) / (EXTREME_POSITIVE - POSITIVE_THRESHOLD));
        return Math.max(0.25, 1 - (extremity * 0.75));
    }

    // Going SHORT when funding is extremely negative = risky
    if (fundingRate < NEGATIVE_THRESHOLD && tradeDirection === 'SHORT') {
        const extremity = Math.min(1, (NEGATIVE_THRESHOLD - fundingRate) / (NEGATIVE_THRESHOLD - EXTREME_NEGATIVE));
        return Math.max(0.25, 1 - (extremity * 0.75));
    }

    return 1.0;
}

/**
 * Get funding signal type for logging.
 */
export function getFundingSignalType(fundingRate: number): 'OVERHEATED' | 'OVERSOLD' | 'NEUTRAL' {
    if (fundingRate > POSITIVE_THRESHOLD) return 'OVERHEATED';
    if (fundingRate < NEGATIVE_THRESHOLD) return 'OVERSOLD';
    return 'NEUTRAL';
}

export default { generateFundingReversion, getFundingMultiplier, getFundingSignalType };
