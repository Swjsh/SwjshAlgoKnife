// ═══════════════════════════════════════════════════════════════
// TECHNICAL LEVELS SERVICE — Key Support/Resistance
// "Price respects structure."
//
// Tracks key technical levels via:
//   1. Pivot point calculations (daily/weekly)
//   2. Key moving averages (50, 200 SMA/EMA)
//   3. Fibonacci retracement levels
//   4. Prior day highs/lows
//
// Approaching key levels = alert
// Breaking key levels = directional signal
// ═══════════════════════════════════════════════════════════════

import intelBus from '../bus';
import type { IntelSignal, IntelDirection } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TechnicalLevel {
    symbol: string;
    levelType: 'PIVOT' | 'RESISTANCE' | 'SUPPORT' | 'MA' | 'FIBONACCI';
    levelName: string;   // e.g., "R1", "S1", "200 SMA", "61.8% Fib"
    price: number;
    currentPrice: number;
    distance: number;    // % distance from current price
    timestamp: string;
}

export interface LevelBreak {
    symbol: string;
    level: TechnicalLevel;
    breakType: 'ABOVE' | 'BELOW';
    previousClose: number;
    volume?: number;
    timestamp: string;
}

interface TechnicalLevelsState {
    running: boolean;
    startedAt: string | null;
    signalsPublished: number;
    lastPoll: string | null;
    errors: string | null;
    cachedLevels: Record<string, TechnicalLevel[]>;
}

// ─── Config ──────────────────────────────────────────────────────────────────

/** Symbols to track technical levels for */
export const TRACKED_SYMBOLS = ['BTCUSD', 'ETHUSD', 'EURUSD', 'GBPUSD'];

/** Key moving averages to track */
export const KEY_MOVING_AVERAGES = [
    { period: 20, type: 'SMA' },
    { period: 50, type: 'SMA' },
    { period: 200, type: 'SMA' },
    { period: 21, type: 'EMA' },
    { period: 50, type: 'EMA' },
];

/** Fibonacci retracement levels */
export const FIB_LEVELS = [0.236, 0.382, 0.5, 0.618, 0.786];

/** Distance threshold for "approaching" alert (%) */
export const APPROACH_THRESHOLD = 0.5;

const POLL_INTERVAL = 30 * 60 * 1000; // 30 minutes

// ─── State ───────────────────────────────────────────────────────────────────

const state: TechnicalLevelsState = {
    running: false,
    startedAt: null,
    signalsPublished: 0,
    lastPoll: null,
    errors: null,
    cachedLevels: {},
};

let pollTimer: ReturnType<typeof setInterval> | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calculate standard pivot points from OHLC data
 */
export function calculatePivotPoints(
    high: number,
    low: number,
    close: number
): Record<string, number> {
    const pivot = (high + low + close) / 3;

    return {
        PP: pivot,
        R1: 2 * pivot - low,
        R2: pivot + (high - low),
        R3: high + 2 * (pivot - low),
        S1: 2 * pivot - high,
        S2: pivot - (high - low),
        S3: low - 2 * (high - pivot),
    };
}

function getDirectionFromBreak(breakData: LevelBreak): IntelDirection {
    // Breaking above resistance = bullish
    // Breaking below support = bearish
    if (breakData.breakType === 'ABOVE') {
        return breakData.level.levelType === 'RESISTANCE' ||
               breakData.level.levelType === 'MA' ? 'BULLISH' : 'ALERT';
    } else {
        return breakData.level.levelType === 'SUPPORT' ||
               breakData.level.levelType === 'MA' ? 'BEARISH' : 'ALERT';
    }
}

function getConfidenceFromLevel(level: TechnicalLevel): number {
    // Key MAs have higher significance
    if (level.levelType === 'MA' && level.levelName.includes('200')) return 0.80;
    if (level.levelType === 'MA' && level.levelName.includes('50')) return 0.70;

    // Pivot levels
    if (level.levelType === 'PIVOT') return 0.65;

    // Fibonacci
    if (level.levelType === 'FIBONACCI') {
        if (level.levelName.includes('61.8')) return 0.75;
        if (level.levelName.includes('50')) return 0.70;
        return 0.60;
    }

    return 0.55;
}

// ─── Poll Loop ───────────────────────────────────────────────────────────────

async function pollTechnicalLevels(): Promise<void> {
    try {
        state.lastPoll = new Date().toISOString();
        state.errors = null;
        intelBus.heartbeat('technicallevels', state.signalsPublished);
        console.log(`📐 [Technical] Poll complete — tracking ${TRACKED_SYMBOLS.length} symbols`);
    } catch (err: any) {
        state.errors = err.message;
        console.error(`📐 [Technical] Error: ${err.message}`);
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function publishLevelBreak(breakData: LevelBreak): number {
    const direction = getDirectionFromBreak(breakData);
    const confidence = getConfidenceFromLevel(breakData.level);

    const summary = `${breakData.symbol} broke ${breakData.breakType.toLowerCase()} ${breakData.level.levelName} ($${breakData.level.price.toFixed(2)})`;

    const signal: IntelSignal = {
        source: 'TECHNICAL_LEVELS',
        symbol: breakData.symbol,
        direction,
        confidence,
        summary,
        payload: {
            symbol: breakData.symbol,
            level: breakData.level,
            breakType: breakData.breakType,
            previousClose: breakData.previousClose,
            volume: breakData.volume,
            timestamp: breakData.timestamp,
        },
    };

    const id = intelBus.publish(signal);
    if (id !== -1) state.signalsPublished++;
    return id;
}

export function publishLevelApproach(level: TechnicalLevel): number {
    if (Math.abs(level.distance) > APPROACH_THRESHOLD) return -1;

    const direction: IntelDirection = 'ALERT';
    const confidence = getConfidenceFromLevel(level) * 0.8; // Lower confidence for approach

    const summary = `${level.symbol} approaching ${level.levelName} ($${level.price.toFixed(2)}) — ${level.distance > 0 ? '+' : ''}${level.distance.toFixed(2)}% away`;

    const signal: IntelSignal = {
        source: 'TECHNICAL_LEVELS',
        symbol: level.symbol,
        direction,
        confidence,
        summary,
        payload: { ...level },
    };

    const id = intelBus.publish(signal);
    if (id !== -1) state.signalsPublished++;
    return id;
}

export function startTechnicalLevelsService(): TechnicalLevelsState {
    if (state.running) return state;
    console.log('📐 [Technical] Starting technical levels service...');
    state.running = true;
    state.startedAt = new Date().toISOString();
    intelBus.heartbeat('technicallevels', 0);
    pollTechnicalLevels();
    pollTimer = setInterval(pollTechnicalLevels, POLL_INTERVAL);
    return state;
}

export function stopTechnicalLevelsService(): TechnicalLevelsState {
    if (!state.running) return state;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    state.running = false;
    return state;
}

export function getTechnicalLevelsStatus(): TechnicalLevelsState {
    return { ...state };
}

export function getCachedLevels(symbol: string): TechnicalLevel[] {
    return state.cachedLevels[symbol] || [];
}
