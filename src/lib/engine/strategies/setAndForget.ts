/**
 * Set and Forget Strategy (FXALEXG Style)
 * 
 * A swing trading strategy based on:
 * - Top-down multi-timeframe analysis (Weekly → Daily → 4H → 30m/1H)
 * - Supply/Demand zones (Areas of Interest)
 * - Market structure (HH/HL/LH/LL)
 * - Candlestick confirmation patterns
 * 
 * See: docs/fxalexg/STRATEGY_SPEC.md for full documentation
 */

import type { Candle } from '../../broker/oanda';

// ============================================================================
// TYPES
// ============================================================================

export type MarketStructure = 'bullish' | 'bearish' | 'neutral';
export type StructurePosition = 1 | 2 | 3; // 1=at high, 2=on way to AOI, 3=at AOI

export interface SwingPoint {
  index: number;
  price: number;
  type: 'HH' | 'HL' | 'LH' | 'LL';
  time: string;
}

export interface AreaOfInterest {
  high: number;
  low: number;
  type: 'support' | 'resistance';
  strength: number; // 1-5, based on touches and rejections
  timeframe: string;
}

export interface CandlePattern {
  type: 'bullish_engulfing' | 'bearish_engulfing' | 'morning_star' | 'evening_star' | 
        'hammer' | 'shooting_star' | 'doji' | 'none';
  index: number;
  strength: number; // 1-3
}

export interface Confluence {
  rejectionCandle: boolean;
  atAOI: boolean;
  psychLevel: boolean;
  structurePoint: boolean;
  emaRejection: boolean;
  score: number; // 0-5
}

export interface StructureShift {
  detected: boolean;
  direction: 'bullish' | 'bearish';
  index: number;
  price: number;
}

export interface TradeSetup {
  valid: boolean;
  direction: 'long' | 'short';
  instrument: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  confluence: Confluence;
  reason: string;
}

// ============================================================================
// MARKET STRUCTURE DETECTION
// ============================================================================

/**
 * Find swing highs and lows in price data
 */
export function findSwingPoints(candles: Candle[], lookback: number = 5): SwingPoint[] {
  const swings: SwingPoint[] = [];
  
  for (let i = lookback; i < candles.length - lookback; i++) {
    const current = candles[i];
    let isSwingHigh = true;
    let isSwingLow = true;
    
    // Check if current candle is a swing point
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].high >= current.high || candles[i + j].high >= current.high) {
        isSwingHigh = false;
      }
      if (candles[i - j].low <= current.low || candles[i + j].low <= current.low) {
        isSwingLow = false;
      }
    }
    
    if (isSwingHigh) {
      swings.push({ index: i, price: current.high, type: 'HH', time: current.time });
    }
    if (isSwingLow) {
      swings.push({ index: i, price: current.low, type: 'HL', time: current.time });
    }
  }
  
  // Label swing points based on sequence (HH/HL for bullish, LH/LL for bearish)
  for (let i = 1; i < swings.length; i++) {
    const prev = swings[i - 1];
    const curr = swings[i];
    
    // If current is a high
    if (curr.type === 'HH' || curr.type === 'LH') {
      const lastHigh = [...swings].slice(0, i).reverse().find(s => s.type === 'HH' || s.type === 'LH');
      if (lastHigh) {
        curr.type = curr.price > lastHigh.price ? 'HH' : 'LH';
      }
    }
    
    // If current is a low
    if (curr.type === 'HL' || curr.type === 'LL') {
      const lastLow = [...swings].slice(0, i).reverse().find(s => s.type === 'HL' || s.type === 'LL');
      if (lastLow) {
        curr.type = curr.price > lastLow.price ? 'HL' : 'LL';
      }
    }
  }
  
  return swings;
}

/**
 * Determine overall market structure from swing points
 */
export function identifyMarketStructure(candles: Candle[]): MarketStructure {
  const swings = findSwingPoints(candles);
  
  if (swings.length < 4) return 'neutral';
  
  // Look at the last 4 swing points
  const recent = swings.slice(-4);
  
  let hhCount = 0;
  let hlCount = 0;
  let lhCount = 0;
  let llCount = 0;
  
  for (const swing of recent) {
    if (swing.type === 'HH') hhCount++;
    if (swing.type === 'HL') hlCount++;
    if (swing.type === 'LH') lhCount++;
    if (swing.type === 'LL') llCount++;
  }
  
  // Bullish: HH + HL pattern
  if (hhCount >= 1 && hlCount >= 1 && hhCount + hlCount > lhCount + llCount) {
    return 'bullish';
  }
  
  // Bearish: LH + LL pattern
  if (lhCount >= 1 && llCount >= 1 && lhCount + llCount > hhCount + hlCount) {
    return 'bearish';
  }
  
  return 'neutral';
}

/**
 * Determine position in structure (1, 2, or 3)
 */
export function getStructurePosition(
  candles: Candle[],
  structure: MarketStructure,
  aois: AreaOfInterest[]
): StructurePosition {
  const currentPrice = candles[candles.length - 1].close;
  const swings = findSwingPoints(candles);
  
  if (swings.length < 2) return 2;
  
  const lastHigh = [...swings].reverse().find(s => s.type === 'HH' || s.type === 'LH')?.price || currentPrice;
  const lastLow = [...swings].reverse().find(s => s.type === 'HL' || s.type === 'LL')?.price || currentPrice;
  
  // Check if at a relevant AOI
  const atAOI = aois.some(aoi => {
    return currentPrice >= aoi.low && currentPrice <= aoi.high;
  });
  
  if (structure === 'bullish') {
    // Position 1: At or near recent high
    if (currentPrice >= lastHigh * 0.99) return 1;
    // Position 3: At support AOI
    if (atAOI) return 3;
    // Position 2: Between
    return 2;
  } else {
    // Position 1: At or near recent low
    if (currentPrice <= lastLow * 1.01) return 1;
    // Position 3: At resistance AOI
    if (atAOI) return 3;
    // Position 2: Between
    return 2;
  }
}

// ============================================================================
// AREA OF INTEREST (AOI) DETECTION
// ============================================================================

/**
 * Find Areas of Interest (supply/demand zones)
 */
export function findAreasOfInterest(candles: Candle[]): AreaOfInterest[] {
  const aois: AreaOfInterest[] = [];
  const swings = findSwingPoints(candles);
  
  for (const swing of swings) {
    const candle = candles[swing.index];
    
    // Create zone around swing point
    const zoneSize = Math.abs(candle.high - candle.low);
    
    if (swing.type === 'HL' || swing.type === 'LL') {
      // Support zone (demand)
      aois.push({
        high: candle.low + zoneSize * 0.5,
        low: candle.low - zoneSize * 0.2,
        type: 'support',
        strength: 1,
        timeframe: '',
      });
    } else {
      // Resistance zone (supply)
      aois.push({
        high: candle.high + zoneSize * 0.2,
        low: candle.high - zoneSize * 0.5,
        type: 'resistance',
        strength: 1,
        timeframe: '',
      });
    }
  }
  
  // Merge overlapping zones and increase strength
  const merged: AreaOfInterest[] = [];
  
  for (const aoi of aois) {
    const existing = merged.find(m => 
      m.type === aoi.type && 
      ((aoi.low >= m.low && aoi.low <= m.high) || (aoi.high >= m.low && aoi.high <= m.high))
    );
    
    if (existing) {
      existing.high = Math.max(existing.high, aoi.high);
      existing.low = Math.min(existing.low, aoi.low);
      existing.strength = Math.min(existing.strength + 1, 5);
    } else {
      merged.push({ ...aoi });
    }
  }
  
  return merged;
}

/**
 * Check if price is at a round psychological level
 */
export function isAtPsychLevel(price: number, tolerance: number = 0.001): boolean {
  // Round numbers: .000, .500, .250, .750
  const decimal = price % 1;
  const levels = [0, 0.25, 0.5, 0.75];
  
  return levels.some(level => Math.abs(decimal - level) < tolerance);
}

// ============================================================================
// CANDLESTICK PATTERN DETECTION
// ============================================================================

/**
 * Detect candlestick patterns for entry confirmation
 */
export function detectCandlePattern(candles: Candle[]): CandlePattern {
  if (candles.length < 3) {
    return { type: 'none', index: 0, strength: 0 };
  }
  
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const prev2 = candles[candles.length - 3];
  
  const lastBody = Math.abs(last.close - last.open);
  const prevBody = Math.abs(prev.close - prev.open);
  const lastRange = last.high - last.low;
  
  // Bullish Engulfing
  if (last.close > last.open && // Green candle
      prev.close < prev.open && // Previous red
      last.open <= prev.close && // Opens at or below prev close
      last.close >= prev.open) { // Closes at or above prev open
    return { type: 'bullish_engulfing', index: candles.length - 1, strength: lastBody > prevBody * 1.5 ? 3 : 2 };
  }
  
  // Bearish Engulfing
  if (last.close < last.open && // Red candle
      prev.close > prev.open && // Previous green
      last.open >= prev.close && // Opens at or above prev close
      last.close <= prev.open) { // Closes at or below prev open
    return { type: 'bearish_engulfing', index: candles.length - 1, strength: lastBody > prevBody * 1.5 ? 3 : 2 };
  }
  
  // Hammer (bullish reversal)
  const lowerWick = Math.min(last.open, last.close) - last.low;
  const upperWick = last.high - Math.max(last.open, last.close);
  
  if (lowerWick > lastBody * 2 && upperWick < lastBody * 0.5) {
    return { type: 'hammer', index: candles.length - 1, strength: lowerWick > lastBody * 3 ? 3 : 2 };
  }
  
  // Shooting Star (bearish reversal)
  if (upperWick > lastBody * 2 && lowerWick < lastBody * 0.5) {
    return { type: 'shooting_star', index: candles.length - 1, strength: upperWick > lastBody * 3 ? 3 : 2 };
  }
  
  // Doji
  if (lastBody < lastRange * 0.1) {
    return { type: 'doji', index: candles.length - 1, strength: 1 };
  }
  
  // Morning Star (bullish reversal) - 3 candle pattern
  if (prev2.close < prev2.open && // First: big red
      Math.abs(prev.close - prev.open) < prevBody * 0.3 && // Second: small body (doji-like)
      last.close > last.open && // Third: big green
      last.close > (prev2.open + prev2.close) / 2) { // Closes above midpoint of first
    return { type: 'morning_star', index: candles.length - 1, strength: 3 };
  }
  
  // Evening Star (bearish reversal) - 3 candle pattern
  if (prev2.close > prev2.open && // First: big green
      Math.abs(prev.close - prev.open) < prevBody * 0.3 && // Second: small body
      last.close < last.open && // Third: big red
      last.close < (prev2.open + prev2.close) / 2) { // Closes below midpoint of first
    return { type: 'evening_star', index: candles.length - 1, strength: 3 };
  }
  
  return { type: 'none', index: 0, strength: 0 };
}

// ============================================================================
// STRUCTURE SHIFT DETECTION
// ============================================================================

/**
 * Detect shift of structure on lower timeframe
 */
export function detectStructureShift(
  candles: Candle[],
  currentStructure: MarketStructure
): StructureShift {
  const swings = findSwingPoints(candles, 3); // Shorter lookback for lower TF
  
  if (swings.length < 3) {
    return { detected: false, direction: 'bullish', index: 0, price: 0 };
  }
  
  // Get recent swings
  const recentSwings = swings.slice(-6);
  
  // Look for structure break
  for (let i = recentSwings.length - 1; i >= 2; i--) {
    const current = recentSwings[i];
    const prev = recentSwings[i - 1];
    const prev2 = recentSwings[i - 2];
    
    // Bullish shift: was making LL/LH, now making HL/HH
    if (currentStructure === 'bearish' || currentStructure === 'neutral') {
      if (prev2.type === 'LL' && prev.type === 'LH' && 
          (current.type === 'HL' || current.type === 'HH')) {
        return {
          detected: true,
          direction: 'bullish',
          index: current.index,
          price: current.price,
        };
      }
    }
    
    // Bearish shift: was making HH/HL, now making LH/LL
    if (currentStructure === 'bullish' || currentStructure === 'neutral') {
      if (prev2.type === 'HH' && prev.type === 'HL' && 
          (current.type === 'LH' || current.type === 'LL')) {
        return {
          detected: true,
          direction: 'bearish',
          index: current.index,
          price: current.price,
        };
      }
    }
  }
  
  return { detected: false, direction: 'bullish', index: 0, price: 0 };
}

// ============================================================================
// CONFLUENCE SCORING
// ============================================================================

/**
 * Calculate confluence score for a potential setup
 */
export function calculateConfluence(
  candles: Candle[],
  aois: AreaOfInterest[],
  ema200?: number[]
): Confluence {
  const currentPrice = candles[candles.length - 1].close;
  const pattern = detectCandlePattern(candles);
  const swings = findSwingPoints(candles);
  
  const confluence: Confluence = {
    rejectionCandle: false,
    atAOI: false,
    psychLevel: false,
    structurePoint: false,
    emaRejection: false,
    score: 0,
  };
  
  // Check for rejection candle
  if (pattern.type !== 'none' && pattern.type !== 'doji') {
    confluence.rejectionCandle = true;
    confluence.score += 1;
  }
  
  // Check if at AOI
  const atAOI = aois.some(aoi => 
    currentPrice >= aoi.low && currentPrice <= aoi.high
  );
  if (atAOI) {
    confluence.atAOI = true;
    confluence.score += 1;
  }
  
  // Check psychological level
  if (isAtPsychLevel(currentPrice)) {
    confluence.psychLevel = true;
    confluence.score += 1;
  }
  
  // Check if at structure point
  const recentSwings = swings.slice(-3);
  const atStructure = recentSwings.some(s => 
    Math.abs(s.price - currentPrice) / currentPrice < 0.002
  );
  if (atStructure) {
    confluence.structurePoint = true;
    confluence.score += 1;
  }
  
  // Check EMA rejection
  if (ema200 && ema200.length > 0) {
    const currentEma = ema200[ema200.length - 1];
    if (Math.abs(currentPrice - currentEma) / currentPrice < 0.005) {
      confluence.emaRejection = true;
      confluence.score += 1;
    }
  }
  
  return confluence;
}

// ============================================================================
// MAIN STRATEGY ANALYSIS
// ============================================================================

export interface MultiTimeframeData {
  weekly: Candle[];
  daily: Candle[];
  h4: Candle[];
  h1: Candle[];
  m30: Candle[];
}

/**
 * Analyze a forex pair and generate trade setup if valid
 */
export function analyzeSetup(
  instrument: string,
  data: MultiTimeframeData
): TradeSetup {
  const invalidSetup: TradeSetup = {
    valid: false,
    direction: 'long',
    instrument,
    entry: 0,
    stopLoss: 0,
    takeProfit: 0,
    riskReward: 0,
    confluence: { rejectionCandle: false, atAOI: false, psychLevel: false, structurePoint: false, emaRejection: false, score: 0 },
    reason: '',
  };

  // =========================================
  // BOX 1: Weekly Analysis
  // =========================================
  const weeklyStructure = identifyMarketStructure(data.weekly);
  const weeklyAOIs = findAreasOfInterest(data.weekly);
  const weeklyPosition = getStructurePosition(data.weekly, weeklyStructure, weeklyAOIs);
  
  // Must be at position 3 (at AOI) to consider trades
  if (weeklyPosition !== 3) {
    return { ...invalidSetup, reason: `Weekly not at position 3 (currently ${weeklyPosition})` };
  }

  // =========================================
  // BOX 2: Daily Analysis
  // =========================================
  const dailyStructure = identifyMarketStructure(data.daily);
  const dailyAOIs = findAreasOfInterest(data.daily);
  const dailyConfluence = calculateConfluence(data.daily, dailyAOIs);
  
  // Need at least 2 confluence factors on daily
  if (dailyConfluence.score < 2) {
    return { ...invalidSetup, reason: `Daily confluence too low (${dailyConfluence.score}/5)` };
  }

  // =========================================
  // BOX 3: 4H Setup
  // =========================================
  const h4Structure = identifyMarketStructure(data.h4);
  const h4Swings = findSwingPoints(data.h4);
  
  // Determine trade direction based on weekly structure
  const direction = weeklyStructure === 'bullish' ? 'long' : 'short';
  
  // For longs: need potential HL forming on 4H
  // For shorts: need potential LH forming on 4H
  const lastH4Swing = h4Swings[h4Swings.length - 1];
  
  if (direction === 'long') {
    // 4H should be bearish (for reversal) or at a HL
    if (h4Structure === 'bullish' && lastH4Swing?.type !== 'HL') {
      return { ...invalidSetup, reason: '4H not forming higher low for long entry' };
    }
  } else {
    // 4H should be bullish (for reversal) or at a LH
    if (h4Structure === 'bearish' && lastH4Swing?.type !== 'LH') {
      return { ...invalidSetup, reason: '4H not forming lower high for short entry' };
    }
  }

  // =========================================
  // BOX 4: Structure Shift (30m/1H)
  // =========================================
  const h1Shift = detectStructureShift(data.h1, h4Structure);
  const m30Shift = detectStructureShift(data.m30, h4Structure);
  
  // Use whichever shows a cleaner shift
  const shift = h1Shift.detected ? h1Shift : m30Shift;
  
  if (!shift.detected) {
    return { ...invalidSetup, reason: 'No structure shift detected on 30m/1H' };
  }
  
  // Shift must be in our trade direction
  if ((direction === 'long' && shift.direction !== 'bullish') ||
      (direction === 'short' && shift.direction !== 'bearish')) {
    return { ...invalidSetup, reason: `Structure shift direction (${shift.direction}) doesn't match trade direction (${direction})` };
  }

  // =========================================
  // BOX 5: Entry Confirmation
  // =========================================
  const h1Pattern = detectCandlePattern(data.h1);
  const h4Pattern = detectCandlePattern(data.h4);
  
  // Use higher TF pattern if available (stronger)
  const pattern = h4Pattern.type !== 'none' ? h4Pattern : h1Pattern;
  
  // Must have bullish pattern for longs, bearish for shorts
  const bullishPatterns = ['bullish_engulfing', 'morning_star', 'hammer'];
  const bearishPatterns = ['bearish_engulfing', 'evening_star', 'shooting_star'];
  
  if (direction === 'long' && !bullishPatterns.includes(pattern.type)) {
    return { ...invalidSetup, reason: `No bullish confirmation pattern (got ${pattern.type})` };
  }
  
  if (direction === 'short' && !bearishPatterns.includes(pattern.type)) {
    return { ...invalidSetup, reason: `No bearish confirmation pattern (got ${pattern.type})` };
  }

  // =========================================
  // CALCULATE ENTRY, SL, TP
  // =========================================
  const currentPrice = data.h1[data.h1.length - 1].close;
  
  // Stop loss: below/above structure shift + buffer
  const slBuffer = currentPrice * 0.0007; // ~7 pips
  const stopLoss = direction === 'long' 
    ? shift.price - slBuffer 
    : shift.price + slBuffer;
  
  // Take profit: at daily structure point
  const dailySwings = findSwingPoints(data.daily);
  const targetSwing = direction === 'long'
    ? dailySwings.find(s => s.type === 'HH' && s.price > currentPrice)
    : dailySwings.find(s => s.type === 'LL' && s.price < currentPrice);
  
  const takeProfit = targetSwing?.price || (direction === 'long' 
    ? currentPrice * 1.03 // Default 3% target
    : currentPrice * 0.97);
  
  // Calculate risk:reward
  const risk = Math.abs(currentPrice - stopLoss);
  const reward = Math.abs(takeProfit - currentPrice);
  const riskReward = reward / risk;
  
  // Must have at least 1:2 R:R
  if (riskReward < 2) {
    return { ...invalidSetup, reason: `R:R too low (${riskReward.toFixed(1)}:1)` };
  }

  // =========================================
  // VALID SETUP!
  // =========================================
  return {
    valid: true,
    direction,
    instrument,
    entry: currentPrice,
    stopLoss,
    takeProfit,
    riskReward,
    confluence: dailyConfluence,
    reason: `${direction.toUpperCase()} setup: Weekly ${weeklyStructure} @ AOI, Daily conf ${dailyConfluence.score}/5, ${shift.direction} shift on ${h1Shift.detected ? '1H' : '30m'}, ${pattern.type} confirmation`,
  };
}

export default {
  findSwingPoints,
  identifyMarketStructure,
  getStructurePosition,
  findAreasOfInterest,
  isAtPsychLevel,
  detectCandlePattern,
  detectStructureShift,
  calculateConfluence,
  analyzeSetup,
};
