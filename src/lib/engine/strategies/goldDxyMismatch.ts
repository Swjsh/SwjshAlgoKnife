/**
 * Gold-DXY Mismatch Retracement Strategy
 *
 * Core Thesis: Gold and DXY have a strong inverse correlation (~-0.7 historically).
 * When DXY makes a large move but Gold barely reacts (volume mismatch),
 * a small DXY retracement will trigger a large Gold move in the opposite direction.
 *
 * Signal Flow:
 * 1. Detect mismatch: DXY Z-score > 1.5, Gold Z-score < 0.5
 * 2. Track mismatch state (DXY direction, peak price)
 * 3. On DXY retracement (20-50%), fire Gold signal opposite to DXY direction
 * 4. Confirm with rolling correlation < -0.3 (healthy inverse relationship)
 *
 * References:
 * - Gold/DXY correlation: https://www.forexgdp.com/analysis/xauusd/gold-dxy-correlation/
 * - TradingView: DXY-GOLD Mismatch indicator pattern
 */

import { BaseStrategy, Candle, Signal, StrategyConfig, MarketCategory } from '../types';
import {
    calculateZScore,
    calculateRollingCorrelation,
    calculateReturns,
} from '../utils/correlation';

interface MismatchState {
    detected: boolean;
    dxyDirection: 'BULLISH' | 'BEARISH';
    dxyPeakPrice: number;
    dxyStartPrice: number;
    dxyMoveZScore: number;
    detectedAt: string;
    barsElapsed: number;
}

interface GoldDxyMismatchConfig {
    /** Z-score threshold for "big DXY move" */
    dxyPushThreshold: number;
    /** Z-score threshold for "Gold sideways" */
    goldSidewaysThreshold: number;
    /** Minimum retracement to trigger (0.20 = 20%) */
    retracementMin: number;
    /** Maximum retracement to trigger (0.50 = 50%) */
    retracementMax: number;
    /** Minimum inverse correlation required */
    correlationThreshold: number;
    /** Lookback period for Z-score calculation */
    lookbackPeriod: number;
    /** Maximum bars before mismatch expires */
    maxMismatchBars: number;
}

const DEFAULT_CONFIG: GoldDxyMismatchConfig = {
    dxyPushThreshold: 1.5,
    goldSidewaysThreshold: 0.5,
    retracementMin: 0.20,
    retracementMax: 0.50,
    correlationThreshold: -0.30,
    lookbackPeriod: 20,
    maxMismatchBars: 48, // ~4 hours on 5m candles
};

export class GoldDxyMismatchStrategy extends BaseStrategy {
    id = 'gold_dxy_mismatch';
    name = 'Gold-DXY Mismatch';
    description = 'Trades Gold based on DXY mismatch + retracement. When DXY makes a big move but Gold stays sideways, the retracement triggers a Gold signal.';
    category: MarketCategory = 'FOREX';

    // Price histories for correlation and z-score calculation
    private dxyPrices: number[] = [];
    private goldPrices: number[] = [];

    // Current mismatch tracking state
    private mismatchState: MismatchState | null = null;

    // Most recent prices for signal generation
    private currentDxyPrice: number = 0;
    private currentGoldPrice: number = 0;

    /**
     * Receive external DXY price updates
     * This should be called by the engine when DXY data arrives
     */
    updateDxyPrice(price: number): void {
        this.currentDxyPrice = price;
        this.dxyPrices.push(price);

        // Keep history manageable
        const maxHistory = (this.getParams().lookbackPeriod || DEFAULT_CONFIG.lookbackPeriod) * 3;
        if (this.dxyPrices.length > maxHistory) {
            this.dxyPrices = this.dxyPrices.slice(-maxHistory);
        }
    }

    /**
     * Get typed params with defaults
     */
    private getParams(): GoldDxyMismatchConfig {
        return {
            ...DEFAULT_CONFIG,
            ...this.config.params,
        };
    }

    /**
     * Main strategy evaluation on each Gold candle
     */
    onCandle(candle: Candle): Signal | null {
        if (!this.config.isActive) return null;

        // Update Gold price history
        this.currentGoldPrice = candle.close;
        this.goldPrices.push(candle.close);

        const params = this.getParams();
        const maxHistory = params.lookbackPeriod * 3;
        if (this.goldPrices.length > maxHistory) {
            this.goldPrices = this.goldPrices.slice(-maxHistory);
        }

        // Need enough data for meaningful calculation
        if (this.dxyPrices.length < params.lookbackPeriod || this.goldPrices.length < params.lookbackPeriod) {
            return null;
        }

        // Calculate returns for correlation
        const dxyReturns = calculateReturns(this.dxyPrices);
        const goldReturns = calculateReturns(this.goldPrices);

        // Ensure arrays are same length for correlation
        const minLen = Math.min(dxyReturns.length, goldReturns.length);
        if (minLen < params.lookbackPeriod - 1) {
            return null;
        }

        const dxyReturnsAligned = dxyReturns.slice(-minLen);
        const goldReturnsAligned = goldReturns.slice(-minLen);

        // Calculate rolling correlation
        const correlation = calculateRollingCorrelation(
            dxyReturnsAligned,
            goldReturnsAligned,
            params.lookbackPeriod
        );

        // Correlation health check: skip if inverse correlation has broken down
        if (correlation > params.correlationThreshold) {
            // Log warning but don't spam
            if (this.mismatchState) {
                console.log(`[GoldDxyMismatch] Correlation breakdown (${correlation.toFixed(2)}), clearing mismatch state`);
                this.mismatchState = null;
            }
            return null;
        }

        // Calculate z-scores
        const dxyZScore = calculateZScore(this.dxyPrices, params.lookbackPeriod);
        const goldZScore = calculateZScore(this.goldPrices, params.lookbackPeriod);

        // If no active mismatch, check for new mismatch
        if (!this.mismatchState) {
            return this.checkForMismatch(candle, dxyZScore, goldZScore, params);
        }

        // We have an active mismatch - check for retracement signal
        return this.checkForRetracement(candle, correlation, params);
    }

    /**
     * Check if current conditions constitute a mismatch
     */
    private checkForMismatch(
        candle: Candle,
        dxyZScore: number,
        goldZScore: number,
        params: GoldDxyMismatchConfig
    ): Signal | null {
        const isBigDxyMove = Math.abs(dxyZScore) > params.dxyPushThreshold;
        const isGoldSideways = Math.abs(goldZScore) < params.goldSidewaysThreshold;

        if (isBigDxyMove && isGoldSideways) {
            // Record the mismatch state
            this.mismatchState = {
                detected: true,
                dxyDirection: dxyZScore > 0 ? 'BULLISH' : 'BEARISH',
                dxyPeakPrice: this.currentDxyPrice,
                dxyStartPrice: this.dxyPrices[this.dxyPrices.length - params.lookbackPeriod] || this.currentDxyPrice,
                dxyMoveZScore: dxyZScore,
                detectedAt: candle.timestamp,
                barsElapsed: 0,
            };

            console.log(
                `[GoldDxyMismatch] Mismatch DETECTED: DXY ${this.mismatchState.dxyDirection} ` +
                `(z=${dxyZScore.toFixed(2)}) while Gold sideways (z=${goldZScore.toFixed(2)})`
            );
        }

        return null; // Mismatch detected, but no signal yet - wait for retracement
    }

    /**
     * Check if DXY has retraced enough to trigger a Gold signal
     */
    private checkForRetracement(
        candle: Candle,
        correlation: number,
        params: GoldDxyMismatchConfig
    ): Signal | null {
        if (!this.mismatchState) return null;

        this.mismatchState.barsElapsed++;

        // Check expiration
        if (this.mismatchState.barsElapsed > params.maxMismatchBars) {
            console.log(`[GoldDxyMismatch] Mismatch expired after ${params.maxMismatchBars} bars`);
            this.mismatchState = null;
            return null;
        }

        // Calculate retracement
        const moveSize = Math.abs(this.mismatchState.dxyPeakPrice - this.mismatchState.dxyStartPrice);
        if (moveSize === 0) {
            this.mismatchState = null;
            return null;
        }

        const retraceSize = Math.abs(this.mismatchState.dxyPeakPrice - this.currentDxyPrice);
        const retracement = retraceSize / moveSize;

        // Check if retracement is in the valid range
        if (retracement >= params.retracementMin && retracement <= params.retracementMax) {
            // DXY has retraced! Generate Gold signal opposite to DXY direction
            const direction: 'LONG' | 'SHORT' = this.mismatchState.dxyDirection === 'BULLISH'
                ? 'LONG'  // DXY was bullish (strong dollar), now retracing → Gold goes UP
                : 'SHORT'; // DXY was bearish (weak dollar), now retracing → Gold goes DOWN

            // Check intel veto
            if (this.isDirectionVetoed(direction)) {
                console.log(`[GoldDxyMismatch] Direction ${direction} vetoed by intel`);
                this.mismatchState = null;
                return null;
            }

            // Calculate stop and take profit
            const atr = this.calculateSimpleATR();
            const stopDistance = atr * 1.5;
            const tpDistance = atr * 2.5;

            const stopLoss = direction === 'LONG'
                ? candle.close - stopDistance
                : candle.close + stopDistance;

            const takeProfit = direction === 'LONG'
                ? candle.close + tpDistance
                : candle.close - tpDistance;

            const signal: Signal = {
                timestamp: candle.timestamp,
                symbol: 'XAUUSD',
                action: direction === 'LONG' ? 'BUY' : 'SELL',
                price: candle.close,
                strategy: this.name,
                notes: `DXY mismatch (${this.mismatchState.dxyDirection}) + ${(retracement * 100).toFixed(0)}% retrace | Corr: ${correlation.toFixed(2)} | Z: ${this.mismatchState.dxyMoveZScore.toFixed(2)}`,
                stopLoss,
                takeProfit,
            };

            console.log(
                `[GoldDxyMismatch] SIGNAL: ${signal.action} XAUUSD @ ${candle.close.toFixed(2)} | ` +
                `DXY retrace ${(retracement * 100).toFixed(0)}% | Corr: ${correlation.toFixed(2)}`
            );

            // Clear mismatch state after signal
            this.mismatchState = null;

            return signal;
        }

        // Update peak price if DXY continues in same direction (extends the move)
        if (this.mismatchState.dxyDirection === 'BULLISH' && this.currentDxyPrice > this.mismatchState.dxyPeakPrice) {
            this.mismatchState.dxyPeakPrice = this.currentDxyPrice;
        } else if (this.mismatchState.dxyDirection === 'BEARISH' && this.currentDxyPrice < this.mismatchState.dxyPeakPrice) {
            this.mismatchState.dxyPeakPrice = this.currentDxyPrice;
        }

        return null;
    }

    /**
     * Simple ATR calculation for stop/TP placement
     */
    private calculateSimpleATR(period: number = 14): number {
        if (this.goldPrices.length < period + 1) {
            // Default ATR based on typical Gold volatility (~$20-30/day)
            return 25;
        }

        let atrSum = 0;
        for (let i = this.goldPrices.length - period; i < this.goldPrices.length; i++) {
            const prev = this.goldPrices[i - 1];
            const curr = this.goldPrices[i];
            atrSum += Math.abs(curr - prev);
        }

        return atrSum / period;
    }

    /**
     * Tick-level processing (not used for this strategy - we use candle-based logic)
     */
    onTick(symbol: string, price: number, time: string): Signal | null {
        // This strategy works on candle closes, not ticks
        // However, we can use ticks to update DXY price if symbol matches
        if (symbol === 'DXY') {
            this.updateDxyPrice(price);
        }
        return null;
    }

    /**
     * Get current strategy state for debugging/display
     */
    getState(): {
        dxyPriceCount: number;
        goldPriceCount: number;
        currentDxyPrice: number;
        currentGoldPrice: number;
        mismatchActive: boolean;
        mismatchState: MismatchState | null;
    } {
        return {
            dxyPriceCount: this.dxyPrices.length,
            goldPriceCount: this.goldPrices.length,
            currentDxyPrice: this.currentDxyPrice,
            currentGoldPrice: this.currentGoldPrice,
            mismatchActive: this.mismatchState !== null,
            mismatchState: this.mismatchState,
        };
    }

    /**
     * Reset strategy state (useful for backtesting)
     */
    reset(): void {
        this.dxyPrices = [];
        this.goldPrices = [];
        this.mismatchState = null;
        this.currentDxyPrice = 0;
        this.currentGoldPrice = 0;
    }
}
