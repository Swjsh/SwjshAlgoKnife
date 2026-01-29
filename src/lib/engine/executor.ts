import db from '../db';
import { Signal } from './types';
import { RiskManager, RiskParams } from './risk';
import { db as cloudDb } from '../firebase';
import { ref, push, set, update } from "firebase/database";

const CLOUD_SYNC_ENABLED = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

export class TradeExecutor {
    private riskParams: RiskParams;

    constructor(riskParams: RiskParams = { accountBalance: 10000, riskPerTradePercent: 1 }) {
        this.riskParams = riskParams;
    }

    async processSignal(signal: Signal) {
        console.log(`[Executor] Processing signal: ${signal.action} ${signal.symbol} via ${signal.strategy}`);

        if (signal.action === 'EXIT') {
            return this.closePosition(signal);
        }

        // Logic for Entry (BUY/SELL or LONG/SHORT)
        const action = signal.action.toUpperCase();
        const direction = (action === 'BUY' || action === 'LONG') ? 'LONG' : 'SHORT';

        // Simple position sizing if no specific SL is in the signal
        // In a real scenario, TV would send 'stop_price' in the payload
        const size = RiskManager.calculateFixedSize(this.riskParams, signal.price, 1);

        try {
            const stmt = db.prepare(`
                INSERT INTO trades (symbol, direction, entry_price, size, strategy, status, entry_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            const tradeEntry = {
                symbol: signal.symbol,
                direction,
                entry_price: signal.price,
                size,
                strategy: signal.strategy,
                status: 'OPEN',
                entry_date: new Date().toISOString()
            };

            const result = stmt.run(
                tradeEntry.symbol,
                tradeEntry.direction,
                tradeEntry.entry_price,
                tradeEntry.size,
                tradeEntry.strategy,
                tradeEntry.status,
                tradeEntry.entry_date
            );

            // Cloud Sync
            if (CLOUD_SYNC_ENABLED && cloudDb) {
                const cloudRef = ref(cloudDb, `trades/${result.lastInsertRowid}`);
                set(cloudRef, { id: result.lastInsertRowid, ...tradeEntry }).catch(e => console.error("Firebase Sync Error:", e));
            }

            console.log(`[Executor] Trade Opened: ${direction} ${size} ${signal.symbol} @ ${signal.price}`);
        } catch (error) {
            console.error(`[Executor] Failed to open trade:`, error);
        }
    }

    private async closePosition(signal: Signal) {
        try {
            // Find the latest open position for this symbol/strategy
            const openTrade = db.prepare(`
                SELECT * FROM trades 
                WHERE symbol = ? AND strategy = ? AND status = 'OPEN'
                ORDER BY entry_date DESC LIMIT 1
            `).get(signal.symbol, signal.strategy) as any;

            if (!openTrade) {
                console.log(`[Executor] No open position found for ${signal.symbol} / ${signal.strategy} to close.`);
                return;
            }

            const exitPrice = signal.price;
            let pnl = 0;
            const priceDiff = openTrade.direction === 'LONG'
                ? (exitPrice - openTrade.entry_price)
                : (openTrade.entry_price - exitPrice);

            // Detect FX pairs (size is in lots, price < 200)
            const isFX = openTrade.entry_price > 0.5 && openTrade.entry_price < 200 && openTrade.size < 100;
            if (isFX) {
                // FX P&L: priceDiff * lots * 100,000 units/lot
                // For USD-quoted pairs (EURUSD, GBPUSD): P&L in USD directly
                // For JPY pairs: divide by exit price
                const isJPY = exitPrice > 50;
                const units = openTrade.size * 100000;
                pnl = isJPY
                    ? (priceDiff * units) / exitPrice
                    : priceDiff * units;
            } else {
                // Crypto/Stocks: simple price diff * size
                pnl = priceDiff * openTrade.size;
            }

            const status = pnl >= 0 ? 'WIN' : 'LOSS';

            const stmt = db.prepare(`
                UPDATE trades 
                SET exit_price = ?, exit_date = ?, status = ?, pnl = ?, notes = ?
                WHERE id = ?
            `);

            const exitDate = new Date().toISOString();
            stmt.run(
                exitPrice,
                exitDate,
                status,
                pnl,
                `Closed by signal: ${signal.notes || 'Auto-exit'}`,
                openTrade.id
            );

            // Cloud Sync
            if (CLOUD_SYNC_ENABLED && cloudDb) {
                const cloudRef = ref(cloudDb, `trades/${openTrade.id}`);
                update(cloudRef, {
                    exit_price: exitPrice,
                    exit_date: exitDate,
                    status: status,
                    pnl: pnl,
                    notes: `Closed by signal: ${signal.notes || 'Auto-exit'}`
                }).catch(e => console.error("Firebase Close Sync Error:", e));
            }

            console.log(`[Executor] Trade Closed: ${openTrade.symbol} PnL: $${pnl.toFixed(2)} (${status})`);
        } catch (error) {
            console.error(`[Executor] Failed to close trade:`, error);
        }
    }
}
