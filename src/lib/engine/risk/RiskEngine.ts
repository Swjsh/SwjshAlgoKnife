// ═══════════════════════════════════════════════════════════════
// RISK ENGINE - The Gatekeeper
// "No trade enters without my approval."
// ═══════════════════════════════════════════════════════════════

import { KillSwitch } from './KillSwitch';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'src', 'app', 'api', 'agents', 'agents_db.json');

export interface RiskConfig {
    maxDailyLossPct: number;      // e.g., 2% = 0.02
    maxRiskPerTradePct: number;   // e.g., 1% = 0.01
    maxConcurrentTrades: number;  // e.g., 3
    maxCorrelatedExposure: number; // e.g., 2
}

export interface Trade {
    ticker: string;
    entry: number;
    stop: number;
    side: 'LONG' | 'SHORT';
    agentId: string;
}

// Correlation groups - pairs that move together
const CORRELATION_GROUPS: string[][] = [
    ['EURUSD', 'GBPUSD'],       // Euro & Pound vs Dollar
    ['USDJPY', 'USDCAD'],       // Dollar vs Yen & CAD
    ['AUDUSD', 'NZDUSD'],       // Aussie & Kiwi vs Dollar
];

// Default config - conservative
const DEFAULT_CONFIG: RiskConfig = {
    maxDailyLossPct: 0.02,       // 2% max daily drawdown
    maxRiskPerTradePct: 0.01,    // 1% risk per trade
    maxConcurrentTrades: 3,      // Max 3 open trades
    maxCorrelatedExposure: 2,    // Max 2 trades in same correlation group
};

export class RiskEngine {
    private static config: RiskConfig = DEFAULT_CONFIG;

    static setConfig(config: Partial<RiskConfig>) {
        this.config = { ...this.config, ...config };
    }

    static canOpenTrade(
        agentId: string,
        proposedTrade: Trade,
        balance: number = 10000
    ): { allowed: boolean; reason: string } {
        // 1. Kill Switch Check
        if (KillSwitch.isTriggered(agentId)) {
            return { allowed: false, reason: 'Kill Switch ACTIVE - Agent halted' };
        }

        // 2. Daily Loss Check
        const dailyPnL = this.getDailyPnL(agentId);
        const dailyLossPct = dailyPnL / balance;
        if (dailyLossPct <= -this.config.maxDailyLossPct) {
            return { allowed: false, reason: `Daily loss limit hit (${(dailyLossPct * 100).toFixed(1)}%)` };
        }

        // 3. Concurrent Trades Check
        const activeTrades = this.getActiveTrades(agentId);
        if (activeTrades.length >= this.config.maxConcurrentTrades) {
            return { allowed: false, reason: `Max concurrent trades reached (${activeTrades.length}/${this.config.maxConcurrentTrades})` };
        }

        // 4. Correlation Check
        if (!this.checkCorrelation(activeTrades, proposedTrade.ticker)) {
            return { allowed: false, reason: `Correlated exposure limit exceeded for ${proposedTrade.ticker}` };
        }

        return { allowed: true, reason: 'All checks passed' };
    }

    static calculatePositionSize(
        balance: number,
        stopLossPips: number,
        pipValue: number = 10 // $10 per pip for standard lot
    ): number {
        // Risk amount = balance * maxRiskPerTrade%
        const riskAmount = balance * this.config.maxRiskPerTradePct;

        // Lot size = riskAmount / (stopLossPips * pipValue)
        const lotSize = riskAmount / (stopLossPips * pipValue);

        // Round to 2 decimal places (mini lots)
        return Math.round(lotSize * 100) / 100;
    }

    static checkCorrelation(activeTrades: Trade[], proposedPair: string): boolean {
        // Find which group the proposed pair belongs to
        const proposedGroup = CORRELATION_GROUPS.find(group =>
            group.includes(proposedPair)
        );

        if (!proposedGroup) return true; // No correlation defined

        // Count how many active trades are in the same group
        const correlatedCount = activeTrades.filter(trade =>
            proposedGroup.includes(trade.ticker)
        ).length;

        return correlatedCount < this.config.maxCorrelatedExposure;
    }

    static getDailyPnL(agentId: string): number {
        try {
            const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
            const agent = db[agentId];
            if (!agent || !agent.closed_trades) return 0;

            // Get today's trades
            const today = new Date().toISOString().split('T')[0];
            const todaysTrades = agent.closed_trades.filter((t: any) =>
                t.closed_at && t.closed_at.startsWith(today)
            );

            // Sum PnL
            return todaysTrades.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
        } catch {
            return 0;
        }
    }

    private static getActiveTrades(agentId: string): Trade[] {
        try {
            const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
            return db[agentId]?.active_trades || [];
        } catch {
            return [];
        }
    }
}
