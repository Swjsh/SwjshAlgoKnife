/**
 * Trade Executor with Account Integration
 * Manages trade execution and account capital allocation
 */

import db from './db';
import {
    getAccount,
    createAccount,
    allocateCapital,
    releaseCapital,
    updateUnrealizedPnL
} from './accounts';

export interface ExecuteTradeParams {
    agent_id: string;
    symbol: string;
    direction: 'LONG' | 'SHORT';
    entry_price: number;
    size: number;
    strategy: string;
    stop_loss?: number;
    take_profit?: number;
    risk_amount?: number; // Capital to allocate for this trade
}

export interface CloseTradeParams {
    trade_id: number;
    exit_price: number;
    exit_date?: string;
}

/**
 * Execute a new trade with account management
 */
export function executeTrade(params: ExecuteTradeParams): number {
    const {
        agent_id,
        symbol,
        direction,
        entry_price,
        size,
        strategy,
        risk_amount
    } = params;

    // Ensure agent has an account
    let account = getAccount(agent_id);
    if (!account) {
        // Create agent account if it doesn't exist
        account = createAccount({
            id: agent_id,
            name: `${agent_id} Account`,
            type: 'AGENT',
            initial_balance: 0
        });
    }

    // Calculate capital allocation (default to 1% of account equity)
    const capital_to_allocate = risk_amount || account.total_equity * 0.01;

    // Check if account has sufficient funds
    if (account.current_balance < capital_to_allocate) {
        throw new Error(
            `Insufficient funds in ${agent_id} account. ` +
            `Available: $${account.current_balance.toFixed(2)}, ` +
            `Required: $${capital_to_allocate.toFixed(2)}`
        );
    }

    // Insert trade into database
    const stmt = db.prepare(`
        INSERT INTO trades (
            symbol, direction, entry_price, size, strategy, status, entry_date
        ) VALUES (?, ?, ?, ?, ?, 'OPEN', datetime('now'))
    `);

    const result = stmt.run(symbol, direction, entry_price, size, strategy);
    const trade_id = result.lastInsertRowid as number;

    // Allocate capital from agent's account
    try {
        allocateCapital(agent_id, capital_to_allocate, trade_id);
    } catch (error: any) {
        // Rollback trade if allocation fails
        db.prepare('DELETE FROM trades WHERE id = ?').run(trade_id);
        throw error;
    }

    console.log(
        `[TradeExecutor] Trade #${trade_id} opened for ${agent_id}: ` +
        `${direction} ${size} ${symbol} @ $${entry_price} ` +
        `(Capital allocated: $${capital_to_allocate.toFixed(2)})`
    );

    return trade_id;
}

/**
 * Close an existing trade with account management
 */
export function closeTrade(params: CloseTradeParams): void {
    const { trade_id, exit_price, exit_date } = params;

    // Get trade details
    const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(trade_id) as any;

    if (!trade) {
        throw new Error(`Trade #${trade_id} not found`);
    }

    if (trade.status !== 'OPEN') {
        throw new Error(`Trade #${trade_id} is already closed (status: ${trade.status})`);
    }

    // Calculate P&L
    const price_diff = trade.direction === 'LONG'
        ? exit_price - trade.entry_price
        : trade.entry_price - exit_price;

    const pnl = price_diff * trade.size;
    const status = pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BE';

    // Update trade in database
    db.prepare(`
        UPDATE trades
        SET exit_price = ?,
            exit_date = ?,
            pnl = ?,
            status = ?
        WHERE id = ?
    `).run(
        exit_price,
        exit_date || new Date().toISOString(),
        pnl,
        status,
        trade_id
    );

    // Find which agent owns this trade by looking at transaction history
    const txn = db.prepare(`
        SELECT account_id
        FROM transactions
        WHERE related_trade_id = ? AND type = 'ALLOCATION'
        LIMIT 1
    `).get(trade_id) as any;

    if (!txn) {
        console.warn(`[TradeExecutor] No allocation found for trade #${trade_id}, skipping account update`);
        return;
    }

    const agent_id = txn.account_id;

    // Get original allocated capital from transaction
    const allocation_txn = db.prepare(`
        SELECT ABS(amount) as allocated_amount
        FROM transactions
        WHERE related_trade_id = ? AND type = 'ALLOCATION'
    `).get(trade_id) as any;

    const allocated_capital = allocation_txn?.allocated_amount || 0;

    // Release capital back to agent's account
    releaseCapital(agent_id, allocated_capital, pnl, trade_id);

    console.log(
        `[TradeExecutor] Trade #${trade_id} closed for ${agent_id}: ` +
        `${trade.symbol} @ $${exit_price} | P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${status})`
    );
}

/**
 * Update unrealized P&L for all open trades of an agent
 */
export function updateAgentUnrealizedPnL(agent_id: string, current_prices: Record<string, number>): void {
    // Get all open trades for this agent
    const open_trades = db.prepare(`
        SELECT t.id, t.symbol, t.direction, t.entry_price, t.size
        FROM trades t
        JOIN transactions tx ON tx.related_trade_id = t.id
        WHERE t.status = 'OPEN' AND tx.account_id = ? AND tx.type = 'ALLOCATION'
    `).all(agent_id) as any[];

    if (open_trades.length === 0) {
        updateUnrealizedPnL(agent_id, 0);
        return;
    }

    // Calculate total unrealized P&L
    let total_unrealized_pnl = 0;

    for (const trade of open_trades) {
        const current_price = current_prices[trade.symbol];
        if (!current_price) continue;

        const price_diff = trade.direction === 'LONG'
            ? current_price - trade.entry_price
            : trade.entry_price - current_price;

        const unrealized_pnl = price_diff * trade.size;
        total_unrealized_pnl += unrealized_pnl;
    }

    updateUnrealizedPnL(agent_id, total_unrealized_pnl);
}

/**
 * Get open trades for an agent
 */
export function getAgentOpenTrades(agent_id: string): any[] {
    return db.prepare(`
        SELECT t.*, ABS(tx.amount) as allocated_capital
        FROM trades t
        JOIN transactions tx ON tx.related_trade_id = t.id
        WHERE t.status = 'OPEN' AND tx.account_id = ? AND tx.type = 'ALLOCATION'
    `).all(agent_id);
}

/**
 * Get closed trades for an agent
 */
export function getAgentClosedTrades(agent_id: string, limit = 50): any[] {
    return db.prepare(`
        SELECT t.*, ABS(tx.amount) as allocated_capital
        FROM trades t
        JOIN transactions tx ON tx.related_trade_id = t.id
        WHERE t.status IN ('WIN', 'LOSS', 'BE', 'CLOSED')
          AND tx.account_id = ?
          AND tx.type = 'ALLOCATION'
        ORDER BY t.exit_date DESC
        LIMIT ?
    `).all(agent_id, limit);
}
