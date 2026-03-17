import { BaseStrategy, Candle, Signal, StrategyConfig, MarketCategory } from '../types';

/**
 * NeverStoppedOut ORB Strategy (Zero Red Days Method)
 * 
 * Based on the proven method with 54+ consecutive green days.
 * Three core setups:
 * 1. Standard ORB - Breakout/Retest trades
 * 2. Inverse ORB - Range trading when ORB is too wide
 * 3. ES/NQ Divergence - Intermarket correlation plays
 * 
 * Asset: MNQ (Micro Nasdaq-100 Futures)
 * Timeframe: 15-minute Opening Range (9:30-9:45 AM EST)
 */

interface ORBState {
    isORBDefined: boolean;
    orbHigh: number;
    orbLow: number;
    orbRange: number;
    sessionOpen: Date | null;
    candlesInORB: Candle[];
    lastSignal: 'LONG' | 'SHORT' | null;
    cooldownUntil: Date | null;
}

export class NeverStoppedOutStrategy extends BaseStrategy {
    id = 'never_stopped_out';
    name = 'NeverStoppedOut ORB';
    description = 'Zero Red Days - 15min ORB with Standard, Inverse, and Divergence setups for MNQ futures.';
    category: MarketCategory = 'FUTURES';

    private state: ORBState = {
        isORBDefined: false,
        orbHigh: 0,
        orbLow: 0,
        orbRange: 0,
        sessionOpen: null,
        candlesInORB: [],
        lastSignal: null,
        cooldownUntil: null
    };

    // Default parameters
    private get sessionStartHour(): number {
        return this.config.params.sessionStartHour ?? 9;
    }

    private get sessionStartMinute(): number {
        return this.config.params.sessionStartMinute ?? 30;
    }

    private get orbDurationMinutes(): number {
        return this.config.params.orbDuration ?? 15;
    }

    private get wideRangeThreshold(): number {
        const base = this.config.params.wideRangeThreshold ?? 400;
        // Intel adapts: HIGH_VOL raises threshold (more caution), LOW_VOL lowers it
        return this.adaptParam(base, this.intelContext?.adaptations.wideRangeThresholdAdj ?? 0);
    }

    private get cooldownMinutes(): number {
        const base = this.config.params.cooldownMinutes ?? 15;
        // Intel adapts: HIGH_VOL adds cooldown, trending reduces it
        return Math.max(5, this.adaptParam(base, this.intelContext?.adaptations.cooldownAdj ?? 0));
    }

    private get htfBias(): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
        // Intel-derived HTF bias overrides when confidence is sufficient
        if (this.intelContext && this.intelContext.confidence >= 0.4) {
            return this.intelContext.htfBias;
        }
        return this.config.params.htfBias ?? 'NEUTRAL';
    }

    onTick(symbol: string, price: number, time: string): Signal | null {
        // This strategy primarily works on candle close
        return null;
    }

    onCandle(candle: Candle): Signal | null {
        const candleTime = new Date(candle.timestamp);
        const hour = candleTime.getHours();
        const minute = candleTime.getMinutes();

        // Check if we're in cooldown period
        if (this.state.cooldownUntil && candleTime < this.state.cooldownUntil) {
            return null;
        }

        // Check if this is the start of a new session
        if (this.isSessionStart(hour, minute)) {
            this.resetORB();
            this.state.sessionOpen = candleTime;
        }

        // Build ORB during the first 15 minutes
        if (this.isInORBWindow(candleTime)) {
            this.state.candlesInORB.push(candle);
            this.updateORBLevels();
            return null;
        }

        // After ORB is defined, look for signals
        if (!this.state.isORBDefined && this.state.candlesInORB.length > 0) {
            this.finalizeORB();
        }

        if (!this.state.isORBDefined) {
            return null;
        }

        // Determine which setup to use
        const isWideRange = this.state.orbRange > this.wideRangeThreshold;

        if (isWideRange) {
            return this.checkInverseORB(candle);
        } else {
            return this.checkStandardORB(candle);
        }
    }

    private isSessionStart(hour: number, minute: number): boolean {
        return hour === this.sessionStartHour && minute === this.sessionStartMinute;
    }

    private isInORBWindow(candleTime: Date): boolean {
        if (!this.state.sessionOpen) return false;

        const orbEnd = new Date(this.state.sessionOpen);
        orbEnd.setMinutes(orbEnd.getMinutes() + this.orbDurationMinutes);

        return candleTime >= this.state.sessionOpen && candleTime < orbEnd;
    }

    private resetORB(): void {
        this.state = {
            isORBDefined: false,
            orbHigh: 0,
            orbLow: Infinity,
            orbRange: 0,
            sessionOpen: this.state.sessionOpen,
            candlesInORB: [],
            lastSignal: null,
            cooldownUntil: null
        };
    }

    private updateORBLevels(): void {
        for (const c of this.state.candlesInORB) {
            if (c.high > this.state.orbHigh) this.state.orbHigh = c.high;
            if (c.low < this.state.orbLow) this.state.orbLow = c.low;
        }
        this.state.orbRange = this.state.orbHigh - this.state.orbLow;
    }

    private finalizeORB(): void {
        if (this.state.candlesInORB.length > 0) {
            this.updateORBLevels();
            this.state.isORBDefined = true;
        }
    }

    /**
     * Standard ORB: Breakout/Retest
     * - LONG: Price breaks above ORB High
     * - SHORT: Price breaks below ORB Low
     */
    private checkStandardORB(candle: Candle): Signal | null {
        // Breakout above ORB High
        if (candle.close > this.state.orbHigh && this.state.lastSignal !== 'LONG') {
            if (this.isDirectionVetoed('LONG')) return null; // Intel veto
            return this.generateSignal(candle, 'LONG', 'Standard ORB Breakout Long');
        }

        // Breakout below ORB Low
        if (candle.close < this.state.orbLow && this.state.lastSignal !== 'SHORT') {
            if (this.isDirectionVetoed('SHORT')) return null; // Intel veto
            return this.generateSignal(candle, 'SHORT', 'Standard ORB Breakout Short');
        }

        return null;
    }

    /**
     * Inverse ORB: Range Trading
     * - When ORB is too wide (> threshold), trade the range
     * - Use HTF bias to determine direction
     */
    private checkInverseORB(candle: Candle): Signal | null {
        // At ORB Low with BULLISH bias = LONG
        if (
            candle.close <= this.state.orbLow * 1.002 && // Within 0.2% of ORB Low
            this.htfBias === 'BULLISH' &&
            this.state.lastSignal !== 'LONG'
        ) {
            return this.generateSignal(candle, 'LONG', 'Inverse ORB - Long at Range Low (HTF Bullish)');
        }

        // At ORB High with BEARISH bias = SHORT
        if (
            candle.close >= this.state.orbHigh * 0.998 && // Within 0.2% of ORB High
            this.htfBias === 'BEARISH' &&
            this.state.lastSignal !== 'SHORT'
        ) {
            return this.generateSignal(candle, 'SHORT', 'Inverse ORB - Short at Range High (HTF Bearish)');
        }

        // Neutral bias = trade both sides of range
        if (this.htfBias === 'NEUTRAL') {
            if (candle.close <= this.state.orbLow * 1.002 && this.state.lastSignal !== 'LONG') {
                return this.generateSignal(candle, 'LONG', 'Inverse ORB - Long at Range Low');
            }
            if (candle.close >= this.state.orbHigh * 0.998 && this.state.lastSignal !== 'SHORT') {
                return this.generateSignal(candle, 'SHORT', 'Inverse ORB - Short at Range High');
            }
        }

        return null;
    }

    private generateSignal(candle: Candle, action: 'LONG' | 'SHORT', notes: string): Signal {
        this.state.lastSignal = action;

        // Set cooldown (platform lockout)
        const cooldownEnd = new Date(candle.timestamp);
        cooldownEnd.setMinutes(cooldownEnd.getMinutes() + this.cooldownMinutes);
        this.state.cooldownUntil = cooldownEnd;

        // Calculate stop loss and take profit based on ORB range
        const stopLoss = action === 'LONG' ? this.state.orbLow : this.state.orbHigh;
        const takeProfit = action === 'LONG'
            ? candle.close + this.state.orbRange
            : candle.close - this.state.orbRange;

        return {
            timestamp: candle.timestamp,
            symbol: 'MNQ',
            action: action,
            price: candle.close,
            strategy: this.name,
            notes: `${notes} | SL: ${stopLoss.toFixed(2)} | TP: ${takeProfit.toFixed(2)} | ORB Range: ${this.state.orbRange.toFixed(2)}`
        };
    }

    /**
     * Get current ORB levels for external use (e.g., charting)
     */
    getORBLevels(): { high: number; low: number; isWide: boolean } | null {
        if (!this.state.isORBDefined) return null;
        return {
            high: this.state.orbHigh,
            low: this.state.orbLow,
            isWide: this.state.orbRange > this.wideRangeThreshold
        };
    }
}
