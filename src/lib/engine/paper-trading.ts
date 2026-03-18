import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import type { MarketCategory, Signal } from './types';

export type PaperTradeConfig = {
  accountBalance: number;
  slippage: { futures: number; options: number; fx: number; equity: number };
  positionSize: { futures: number; options: number; fx: number; equity: number };
};

export type ClosedTrade = {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  qty: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: string;
  exitTime: string;
  stopLoss?: number;
  takeProfit?: number;
  pnl: number;
  reason: 'EXIT' | 'STOP' | 'TAKE_PROFIT';
};

type OpenPosition = {
  symbol: string;
  side: 'LONG' | 'SHORT';
  qty: number;
  entryPrice: number;
  entryTime: string;
  stopLoss?: number;
  takeProfit?: number;
};

export class PaperTradingEngine {
  private cfg: PaperTradeConfig;
  private balance: number;
  private equity: number;
  private open: Record<string, OpenPosition> = {};
  private trades: ClosedTrade[] = [];
  private persistDir?: string;

  constructor(cfg: PaperTradeConfig, persistDir?: string) {
    this.cfg = cfg;
    this.balance = cfg.accountBalance;
    this.equity = cfg.accountBalance;
    this.persistDir = persistDir;

    if (this.persistDir) mkdirSync(this.persistDir, { recursive: true });
  }

  private slippageFor(category: MarketCategory) {
    switch (category) {
      case 'FUTURES':
        return this.cfg.slippage.futures;
      case 'OPTIONS':
        return this.cfg.slippage.options;
      case 'FOREX':
        return this.cfg.slippage.fx;
      case 'EQUITY':
        return this.cfg.slippage.equity;
      default:
        return this.cfg.slippage.equity;
    }
  }

  private qtyFor(category: MarketCategory) {
    switch (category) {
      case 'FUTURES':
        return this.cfg.positionSize.futures;
      case 'OPTIONS':
        return this.cfg.positionSize.options;
      case 'FOREX':
        return this.cfg.positionSize.fx;
      case 'EQUITY':
        return this.cfg.positionSize.equity;
      default:
        return this.cfg.positionSize.equity;
    }
  }

  async executeSignal(signal: Signal, category: MarketCategory) {
    const symbol = signal.symbol;
    const slip = this.slippageFor(category);
    const qty = this.qtyFor(category);

    // Normalize actions.
    const action = signal.action;

    if (action === 'BUY' || action === 'SELL') {
      if (this.open[symbol]) return; // one position at a time per symbol

      const side: OpenPosition['side'] = action === 'BUY' ? 'LONG' : 'SHORT';
      const fill = action === 'BUY' ? signal.price + slip : signal.price - slip;

      this.open[symbol] = {
        symbol,
        side,
        qty,
        entryPrice: fill,
        entryTime: signal.timestamp,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
      };

      this.persist();
      return;
    }

    if (action === 'EXIT' || action === 'FLAT') {
      const pos = this.open[symbol];
      if (!pos) return;
      const exit = pos.side === 'LONG' ? signal.price - slip : signal.price + slip;
      this.closePosition(pos, exit, signal.timestamp, 'EXIT');
      return;
    }
  }

  async updatePositions(latest: Record<string, number>, nowIso?: string) {
    const t = nowIso || new Date().toISOString();

    for (const [symbol, pos] of Object.entries(this.open)) {
      const px = latest[symbol];
      if (typeof px !== 'number') continue;

      // Stop
      if (typeof pos.stopLoss === 'number') {
        const hitStop = pos.side === 'LONG' ? px <= pos.stopLoss : px >= pos.stopLoss;
        if (hitStop) {
          this.closePosition(pos, pos.stopLoss, t, 'STOP');
          continue;
        }
      }

      // TP
      if (typeof pos.takeProfit === 'number') {
        const hitTp = pos.side === 'LONG' ? px >= pos.takeProfit : px <= pos.takeProfit;
        if (hitTp) {
          this.closePosition(pos, pos.takeProfit, t, 'TAKE_PROFIT');
          continue;
        }
      }
    }

    this.recalcEquity(latest);
    this.persist();
  }

  private recalcEquity(latest: Record<string, number>) {
    let unreal = 0;
    for (const pos of Object.values(this.open)) {
      const px = latest[pos.symbol];
      if (typeof px !== 'number') continue;

      const pnl = pos.side === 'LONG' ? (px - pos.entryPrice) * pos.qty : (pos.entryPrice - px) * pos.qty;
      unreal += pnl;
    }
    this.equity = this.balance + unreal;
  }

  private closePosition(pos: OpenPosition, exitPrice: number, exitTime: string, reason: ClosedTrade['reason']) {
    const pnl = pos.side === 'LONG' ? (exitPrice - pos.entryPrice) * pos.qty : (pos.entryPrice - exitPrice) * pos.qty;
    this.balance += pnl;

    const trade: ClosedTrade = {
      id: `${pos.symbol}-${pos.entryTime}`,
      symbol: pos.symbol,
      side: pos.side,
      qty: pos.qty,
      entryPrice: pos.entryPrice,
      exitPrice,
      entryTime: pos.entryTime,
      exitTime,
      stopLoss: pos.stopLoss,
      takeProfit: pos.takeProfit,
      pnl,
      reason,
    };

    delete this.open[pos.symbol];
    this.trades.push(trade);
    this.persist();
  }

  getAccount() {
    return {
      balance: this.balance,
      equity: this.equity,
      openPositions: Object.keys(this.open).length,
      dailyPnL: 0,
    };
  }

  getTrades(): ClosedTrade[] {
    return [...this.trades];
  }

  getPerformanceMetrics() {
    const totalTrades = this.trades.length;
    const wins = this.trades.filter((t) => t.pnl > 0);
    const losses = this.trades.filter((t) => t.pnl <= 0);
    const totalPnL = this.trades.reduce((s, t) => s + t.pnl, 0);
    const winRate = totalTrades ? wins.length / totalTrades : 0;

    // Simple max drawdown calc on closed-trade equity curve
    let peak = this.cfg.accountBalance;
    let eq = this.cfg.accountBalance;
    let maxDd = 0;
    for (const t of this.trades) {
      eq += t.pnl;
      peak = Math.max(peak, eq);
      const dd = peak > 0 ? (peak - eq) / peak : 0;
      maxDd = Math.max(maxDd, dd);
    }

    return {
      totalTrades,
      winRate,
      totalPnL,
      sharpeRatio: 0,
      maxDrawdown: maxDd,
    };
  }

  private persist() {
    if (!this.persistDir) return;

    const state = {
      generated_at: new Date().toISOString(),
      account: this.getAccount(),
      open: this.open,
      trades: this.trades,
    };

    const file = path.join(this.persistDir, 'paper_state.json');
    writeFileSync(file, JSON.stringify(state, null, 2));
  }
}
