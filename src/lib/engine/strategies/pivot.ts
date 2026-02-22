import { BaseStrategy } from '../types';
import type { Candle, Signal, StrategyConfig } from '../types';

/**
 * Pivot Pete (ETF-proxy capable): multi-timeframe pivot rejection.
 *
 * Notes:
 * - Pivots are computed from prior period OHLC.
 * - Strategy emits BUY/SELL signals when candle wicks a pivot and closes back away.
 * - Designed to be used on intraday candles (e.g., 5Min).
 */
export class PivotStrategy extends BaseStrategy {
  id = 'pivot_pete';
  name = 'Pivot Pete';
  description = 'Multi-timeframe pivot rejection (daily/weekly/monthly pivots)';
  category = this.config.category;

  // Exposed for reporting
  pivots: {
    daily?: PivotSet;
    weekly?: PivotSet;
    monthly?: PivotSet;
    lastComputed?: string;
  } = {};

  private tolerancePct: number;
  private minConfluence: number;

  private currentDay?: string;
  private currentWeek?: string;
  private currentMonth?: string;

  private dayAgg?: Agg;
  private weekAgg?: Agg;
  private monthAgg?: Agg;

  constructor(config: StrategyConfig) {
    super(config);

    // Tunables (sane defaults)
    this.tolerancePct = Number(config.params?.tolerancePct ?? 0.0008); // 0.08%
    this.minConfluence = Number(config.params?.minConfluence ?? 1);
  }

  onTick(symbol: string, price: number, time: string): Signal | null {
    // Pivot Pete is candle-driven for now.
    void symbol;
    void price;
    void time;
    return null;
  }

  onCandle(candle: Candle): Signal | null {
    const t = new Date(candle.timestamp);
    const dayKey = t.toISOString().slice(0, 10);
    const weekKey = isoWeekKey(t);
    const monthKey = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`;

    // Initialize agg buckets.
    if (!this.currentDay) {
      this.currentDay = dayKey;
      this.currentWeek = weekKey;
      this.currentMonth = monthKey;
      this.dayAgg = newAgg(candle);
      this.weekAgg = newAgg(candle);
      this.monthAgg = newAgg(candle);
      return null;
    }

    // Period rollovers: when key changes, compute pivot from prior agg and reset.
    if (dayKey !== this.currentDay && this.dayAgg) {
      this.pivots.daily = computePivots(this.dayAgg);
      this.currentDay = dayKey;
      this.dayAgg = newAgg(candle);
      this.pivots.lastComputed = candle.timestamp;
    } else if (this.dayAgg) {
      updateAgg(this.dayAgg, candle);
    }

    if (weekKey !== this.currentWeek && this.weekAgg) {
      this.pivots.weekly = computePivots(this.weekAgg);
      this.currentWeek = weekKey;
      this.weekAgg = newAgg(candle);
      this.pivots.lastComputed = candle.timestamp;
    } else if (this.weekAgg) {
      updateAgg(this.weekAgg, candle);
    }

    if (monthKey !== this.currentMonth && this.monthAgg) {
      this.pivots.monthly = computePivots(this.monthAgg);
      this.currentMonth = monthKey;
      this.monthAgg = newAgg(candle);
      this.pivots.lastComputed = candle.timestamp;
    } else if (this.monthAgg) {
      updateAgg(this.monthAgg, candle);
    }

    // Need at least daily pivots to trade.
    const pivotSets: PivotSet[] = [];
    if (this.pivots.daily) pivotSets.push(this.pivots.daily);
    if (this.pivots.weekly) pivotSets.push(this.pivots.weekly);
    if (this.pivots.monthly) pivotSets.push(this.pivots.monthly);
    if (!pivotSets.length) return null;

    const levels = pivotSets.flatMap((p) => pivotLevels(p));

    const px = candle.close;
    const tol = Math.max(0.01, px * this.tolerancePct);

    const nearLevels = levels.filter((lvl) => Math.abs(lvl - px) <= tol || (candle.low <= lvl && candle.high >= lvl));
    if (nearLevels.length < this.minConfluence) return null;

    const bullish = candle.low <= min(nearLevels) && candle.close > candle.open;
    const bearish = candle.high >= max(nearLevels) && candle.close < candle.open;

    if (!bullish && !bearish) return null;

    const action: Signal['action'] = bullish ? 'BUY' : 'SELL';

    // Bracket: fixed percent of price (works for ETF proxies).
    const riskPct = Number(this.config.params?.riskPct ?? 0.003); // 0.30%
    const rr = Number(this.config.params?.rr ?? 2);
    const risk = px * riskPct;

    const stopLoss = bullish ? px - risk : px + risk;
    const takeProfit = bullish ? px + risk * rr : px - risk * rr;

    return {
      timestamp: candle.timestamp,
      symbol: String(this.config.params?.symbol || 'ES'),
      action,
      price: px,
      strategy: this.id,
      notes: `Pivot rejection confluence=${nearLevels.length} tol=${tol.toFixed(2)}`,
      stopLoss: round2(stopLoss),
      takeProfit: round2(takeProfit),
    };
  }
}

type Agg = { open: number; high: number; low: number; close: number };

function newAgg(c: Candle): Agg {
  return { open: c.open, high: c.high, low: c.low, close: c.close };
}

function updateAgg(a: Agg, c: Candle) {
  a.high = Math.max(a.high, c.high);
  a.low = Math.min(a.low, c.low);
  a.close = c.close;
}

export type PivotSet = {
  P: number;
  R1: number;
  R2: number;
  R3: number;
  S1: number;
  S2: number;
  S3: number;
};

export function computePivots(prev: Agg): PivotSet {
  const P = (prev.high + prev.low + prev.close) / 3;
  const R1 = 2 * P - prev.low;
  const S1 = 2 * P - prev.high;
  const R2 = P + (prev.high - prev.low);
  const S2 = P - (prev.high - prev.low);
  const R3 = prev.high + 2 * (P - prev.low);
  const S3 = prev.low - 2 * (prev.high - P);

  return {
    P: round2(P),
    R1: round2(R1),
    R2: round2(R2),
    R3: round2(R3),
    S1: round2(S1),
    S2: round2(S2),
    S3: round2(S3),
  };
}

function pivotLevels(p: PivotSet): number[] {
  return [p.P, p.R1, p.R2, p.R3, p.S1, p.S2, p.S3];
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function min(xs: number[]) {
  return xs.reduce((a, b) => Math.min(a, b), Number.POSITIVE_INFINITY);
}

function max(xs: number[]) {
  return xs.reduce((a, b) => Math.max(a, b), Number.NEGATIVE_INFINITY);
}

function isoWeekKey(d: Date) {
  // ISO week-year and week number
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Thursday in current week decides year.
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
