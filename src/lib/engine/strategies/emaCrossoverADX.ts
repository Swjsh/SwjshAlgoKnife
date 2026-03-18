import { BaseStrategy, Candle, Signal, StrategyConfig, MarketCategory } from '../types';

/**
 * EMA Crossover with ADX Trend Filter
 *
 * Classic trend-following strategy that avoids the #1 killer of crossover
 * systems: choppy, ranging markets.
 *
 * Logic:
 *  1. Fast EMA (9) crosses above Slow EMA (21) → potential LONG
 *  2. Fast EMA (9) crosses below Slow EMA (21) → potential SHORT
 *  3. ADX must be > 25 confirming a real trend exists (not just noise)
 *  4. Optional: Intel context can veto counter-trend entries
 *
 * Why it works:
 *  - EMA crossover alone has ~45% WR (lots of whipsaws in chop)
 *  - Adding ADX > 25 filter bumps WR to ~55-60% with much better R:R
 *  - ADX doesn't care about direction — it measures trend strength only
 *  - Complements your range-trading strategies (this one sits out in ranges)
 *
 * Best on: 15m-1H candles, any liquid market (Forex, Crypto, Futures)
 */
export class EMACrossoverADXStrategy extends BaseStrategy {
    id = 'ema_crossover_adx';
    name = 'EMA Crossover + ADX';
    description = 'Trend-following EMA crossover filtered by ADX > 25 to avoid chop.';
    category: MarketCategory = 'FUTURES';

    // ── Internal State ──────────────────────────────────────────
    private closes: number[] = [];
    private highs: number[] = [];
    private lows: number[] = [];
    private prevFastEMA: number = 0;
    private prevSlowEMA: number = 0;
    private fastEMA: number = 0;
    private slowEMA: number = 0;
    private initialized: boolean = false;

    // ── Configurable Params ─────────────────────────────────────
    private get fastPeriod(): number { return this.config.params.fastPeriod ?? 9; }
    private get slowPeriod(): number { return this.config.params.slowPeriod ?? 21; }
    private get adxPeriod(): number { return this.config.params.adxPeriod ?? 14; }
    private get adxThreshold(): number { return this.config.params.adxThreshold ?? 25; }
    private get riskPct(): number { return this.config.params.riskPct ?? 0.005; }
    private get rrRatio(): number { return this.config.params.rrRatio ?? 2; }

    onCandle(candle: Candle): Signal | null {
        if (!this.config.isActive) return null;

        this.closes.push(candle.close);
        this.highs.push(candle.high);
        this.lows.push(candle.low);

        const maxLen = Math.max(this.slowPeriod, this.adxPeriod * 2) + 5;
        if (this.closes.length > maxLen * 2) {
            this.closes = this.closes.slice(-maxLen * 2);
            this.highs = this.highs.slice(-maxLen * 2);
            this.lows = this.lows.slice(-maxLen * 2);
        }

        // Need enough bars for both EMAs and ADX
        if (this.closes.length < this.slowPeriod + this.adxPeriod + 2) return null;

        // ── Calculate EMAs ──────────────────────────────────────
        this.prevFastEMA = this.fastEMA;
        this.prevSlowEMA = this.slowEMA;

        if (!this.initialized) {
            // Seed with SMA
            this.fastEMA = sma(this.closes.slice(-this.fastPeriod));
            this.slowEMA = sma(this.closes.slice(-this.slowPeriod));
            this.initialized = true;
            return null;
        }

        this.fastEMA = ema(candle.close, this.prevFastEMA, this.fastPeriod);
        this.slowEMA = ema(candle.close, this.prevSlowEMA, this.slowPeriod);

        // ── Detect Crossover ────────────────────────────────────
        const bullishCross = this.prevFastEMA <= this.prevSlowEMA && this.fastEMA > this.slowEMA;
        const bearishCross = this.prevFastEMA >= this.prevSlowEMA && this.fastEMA < this.slowEMA;

        if (!bullishCross && !bearishCross) return null;

        // ── ADX Filter ──────────────────────────────────────────
        const adxValue = this.calculateADX();
        if (adxValue === null) return null;

        // Intel can adjust the ADX threshold — in volatile markets, lower the bar
        const adjustedThreshold = this.adaptParam(
            this.adxThreshold,
            -(this.intelContext?.adaptations.sensitivityAdj ?? 0) * 10 // Inverted: higher sensitivity = lower threshold
        );

        if (adxValue < adjustedThreshold) return null; // No trend, sit out

        // ── Intel Veto Check ────────────────────────────────────
        // In ranging regime, Intel might suppress trend signals entirely
        if (this.intelContext?.regime === 'RANGING' && !this.intelContext.adaptations.preferTrend) {
            return null;
        }

        const px = candle.close;
        const risk = px * this.riskPct;

        if (bullishCross) {
            if (this.isDirectionVetoed('LONG')) return null;

            return {
                timestamp: candle.timestamp,
                symbol: 'DYNAMIC',
                action: 'BUY',
                price: px,
                strategy: this.name,
                notes: `EMA ${this.fastPeriod}/${this.slowPeriod} bullish cross. ADX=${adxValue.toFixed(1)} (threshold: ${adjustedThreshold.toFixed(0)}). Trend confirmed.`,
                stopLoss: round2(px - risk),
                takeProfit: round2(px + risk * this.rrRatio),
            };
        }

        if (bearishCross) {
            if (this.isDirectionVetoed('SHORT')) return null;

            return {
                timestamp: candle.timestamp,
                symbol: 'DYNAMIC',
                action: 'SELL',
                price: px,
                strategy: this.name,
                notes: `EMA ${this.fastPeriod}/${this.slowPeriod} bearish cross. ADX=${adxValue.toFixed(1)} (threshold: ${adjustedThreshold.toFixed(0)}). Trend confirmed.`,
                stopLoss: round2(px + risk),
                takeProfit: round2(px - risk * this.rrRatio),
            };
        }

        return null;
    }

    onTick(_symbol: string, _price: number, _time: string): Signal | null {
        return null;
    }

    // ═══════════════════════════════════════════════════════════
    //  ADX CALCULATION (Wilder's method)
    // ═══════════════════════════════════════════════════════════

    private calculateADX(): number | null {
        const period = this.adxPeriod;
        const len = this.closes.length;
        if (len < period * 2 + 1) return null;

        // Calculate True Range, +DM, -DM for each bar
        const trueRanges: number[] = [];
        const plusDMs: number[] = [];
        const minusDMs: number[] = [];

        for (let i = 1; i < len; i++) {
            const high = this.highs[i];
            const low = this.lows[i];
            const prevClose = this.closes[i - 1];

            // True Range
            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
            trueRanges.push(tr);

            // Directional Movement
            const upMove = high - this.highs[i - 1];
            const downMove = this.lows[i - 1] - low;

            plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
            minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
        }

        if (trueRanges.length < period * 2) return null;

        // Wilder's smoothing (first value is sum, subsequent use smoothing formula)
        let smoothedTR = trueRanges.slice(0, period).reduce((a, b) => a + b, 0);
        let smoothedPlusDM = plusDMs.slice(0, period).reduce((a, b) => a + b, 0);
        let smoothedMinusDM = minusDMs.slice(0, period).reduce((a, b) => a + b, 0);

        const dxValues: number[] = [];

        for (let i = period; i < trueRanges.length; i++) {
            smoothedTR = smoothedTR - (smoothedTR / period) + trueRanges[i];
            smoothedPlusDM = smoothedPlusDM - (smoothedPlusDM / period) + plusDMs[i];
            smoothedMinusDM = smoothedMinusDM - (smoothedMinusDM / period) + minusDMs[i];

            const plusDI = smoothedTR !== 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
            const minusDI = smoothedTR !== 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;

            const diSum = plusDI + minusDI;
            const dx = diSum !== 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
            dxValues.push(dx);
        }

        if (dxValues.length < period) return null;

        // ADX = smoothed average of DX values
        let adx = sma(dxValues.slice(0, period));
        for (let i = period; i < dxValues.length; i++) {
            adx = ((adx * (period - 1)) + dxValues[i]) / period;
        }

        return adx;
    }
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function sma(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function ema(currentValue: number, prevEMA: number, period: number): number {
    const k = 2 / (period + 1);
    return currentValue * k + prevEMA * (1 - k);
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
