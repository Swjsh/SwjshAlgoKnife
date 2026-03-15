/**
 * Account Management System
 * Tracks individual agent accounts, capital allocation, and money flow
 */

import db from './db';

// ─── Account Types ────────────────────────────────────────────────────────────

export interface Account {
    id: string;                    // 'master' | agent ID
    name: string;
    type: 'MASTER' | 'AGENT';
    initial_balance: number;       // Starting capital
    current_balance: number;       // Available cash
    allocated_capital: number;     // In active trades
    total_deposited: number;       // Lifetime deposits
    total_withdrawn: number;       // Lifetime withdrawals
    realized_pnl: number;          // Closed trades P&L
    unrealized_pnl: number;        // Open trades P&L
    total_equity: number;          // current_balance + allocated_capital + unrealized_pnl
    status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
    created_at: string;
    updated_at: string;
}

export interface Transaction {
    id: number;
    account_id: string;
    type: 'DEPOSIT' | 'WITHDRAWAL' | 'ALLOCATION' | 'RELEASE' | 'PROFIT' | 'LOSS' | 'TRANSFER';
    amount: number;                // Positive or negative
    balance_before: number;
    balance_after: number;
    related_trade_id?: number;
    related_account_id?: string;   // For transfers
    description: string;
    created_at: string;
}

// ─── Database Schema ──────────────────────────────────────────────────────────

export function initAccountTables() {
    // Accounts table
    db.exec(`
        CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            initial_balance REAL DEFAULT 0,
            current_balance REAL DEFAULT 0,
            allocated_capital REAL DEFAULT 0,
            total_deposited REAL DEFAULT 0,
            total_withdrawn REAL DEFAULT 0,
            realized_pnl REAL DEFAULT 0,
            unrealized_pnl REAL DEFAULT 0,
            total_equity REAL DEFAULT 0,
            status TEXT DEFAULT 'ACTIVE',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Transactions ledger
    db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id TEXT NOT NULL,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            balance_before REAL NOT NULL,
            balance_after REAL NOT NULL,
            related_trade_id INTEGER,
            related_account_id TEXT,
            description TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES accounts(id),
            FOREIGN KEY (related_trade_id) REFERENCES trades(id)
        )
    `);

    // Create indexes
    db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)`);
}

// ─── Account Operations ───────────────────────────────────────────────────────

/**
 * Create a new account (Master or Agent)
 */
export function createAccount(params: {
    id: string;
    name: string;
    type: 'MASTER' | 'AGENT';
    initial_balance: number;
}): Account {
    const now = new Date().toISOString();

    const stmt = db.prepare(`
        INSERT INTO accounts (
            id, name, type, initial_balance, current_balance,
            total_deposited, total_equity, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        params.id,
        params.name,
        params.type,
        params.initial_balance,
        params.initial_balance,
        params.initial_balance,
        params.initial_balance,
        now,
        now
    );

    // Record initial deposit transaction
    recordTransaction({
        account_id: params.id,
        type: 'DEPOSIT',
        amount: params.initial_balance,
        balance_before: 0,
        balance_after: params.initial_balance,
        description: 'Initial deposit'
    });

    return getAccount(params.id)!;
}

/**
 * Get account by ID
 */
export function getAccount(id: string): Account | null {
    const stmt = db.prepare('SELECT * FROM accounts WHERE id = ?');
    return stmt.get(id) as Account | null;
}

/**
 * Get all accounts
 */
export function getAllAccounts(): Account[] {
    const stmt = db.prepare('SELECT * FROM accounts ORDER BY type DESC, name ASC');
    return stmt.all() as Account[];
}

/**
 * Deposit funds into an account
 */
export function deposit(account_id: string, amount: number, description?: string): Account {
    const account = getAccount(account_id);
    if (!account) throw new Error(`Account ${account_id} not found`);
    if (amount <= 0) throw new Error('Deposit amount must be positive');

    const new_balance = account.current_balance + amount;
    const new_equity = new_balance + account.allocated_capital + account.unrealized_pnl;

    db.prepare(`
        UPDATE accounts
        SET current_balance = ?,
            total_deposited = total_deposited + ?,
            total_equity = ?,
            updated_at = ?
        WHERE id = ?
    `).run(new_balance, amount, new_equity, new Date().toISOString(), account_id);

    recordTransaction({
        account_id,
        type: 'DEPOSIT',
        amount,
        balance_before: account.current_balance,
        balance_after: new_balance,
        description: description || `Deposit of $${amount}`
    });

    return getAccount(account_id)!;
}

/**
 * Withdraw funds from an account
 */
export function withdraw(account_id: string, amount: number, description?: string): Account {
    const account = getAccount(account_id);
    if (!account) throw new Error(`Account ${account_id} not found`);
    if (amount <= 0) throw new Error('Withdrawal amount must be positive');
    if (account.current_balance < amount) {
        throw new Error(`Insufficient funds. Available: $${account.current_balance}, Requested: $${amount}`);
    }

    const new_balance = account.current_balance - amount;
    const new_equity = new_balance + account.allocated_capital + account.unrealized_pnl;

    db.prepare(`
        UPDATE accounts
        SET current_balance = ?,
            total_withdrawn = total_withdrawn + ?,
            total_equity = ?,
            updated_at = ?
        WHERE id = ?
    `).run(new_balance, amount, new_equity, new Date().toISOString(), account_id);

    recordTransaction({
        account_id,
        type: 'WITHDRAWAL',
        amount: -amount,
        balance_before: account.current_balance,
        balance_after: new_balance,
        description: description || `Withdrawal of $${amount}`
    });

    return getAccount(account_id)!;
}

/**
 * Allocate capital when a trade is opened
 */
export function allocateCapital(account_id: string, amount: number, trade_id?: number): Account {
    const account = getAccount(account_id);
    if (!account) throw new Error(`Account ${account_id} not found`);
    if (amount <= 0) throw new Error('Allocation amount must be positive');
    if (account.current_balance < amount) {
        throw new Error(`Insufficient funds for allocation. Available: $${account.current_balance}, Requested: $${amount}`);
    }

    const new_balance = account.current_balance - amount;
    const new_allocated = account.allocated_capital + amount;
    const new_equity = new_balance + new_allocated + account.unrealized_pnl;

    db.prepare(`
        UPDATE accounts
        SET current_balance = ?,
            allocated_capital = ?,
            total_equity = ?,
            updated_at = ?
        WHERE id = ?
    `).run(new_balance, new_allocated, new_equity, new Date().toISOString(), account_id);

    recordTransaction({
        account_id,
        type: 'ALLOCATION',
        amount: -amount,
        balance_before: account.current_balance,
        balance_after: new_balance,
        related_trade_id: trade_id,
        description: `Capital allocated to trade #${trade_id || 'N/A'}`
    });

    return getAccount(account_id)!;
}

/**
 * Release capital when a trade is closed
 */
export function releaseCapital(account_id: string, amount: number, pnl: number, trade_id?: number): Account {
    const account = getAccount(account_id);
    if (!account) throw new Error(`Account ${account_id} not found`);

    const return_amount = amount + pnl; // Original capital + profit/loss
    const new_balance = account.current_balance + return_amount;
    const new_allocated = Math.max(0, account.allocated_capital - amount);
    const new_realized_pnl = account.realized_pnl + pnl;
    const new_equity = new_balance + new_allocated + account.unrealized_pnl;

    db.prepare(`
        UPDATE accounts
        SET current_balance = ?,
            allocated_capital = ?,
            realized_pnl = ?,
            total_equity = ?,
            updated_at = ?
        WHERE id = ?
    `).run(new_balance, new_allocated, new_realized_pnl, new_equity, new Date().toISOString(), account_id);

    // Record capital release
    recordTransaction({
        account_id,
        type: 'RELEASE',
        amount: amount,
        balance_before: account.current_balance,
        balance_after: new_balance,
        related_trade_id: trade_id,
        description: `Capital released from trade #${trade_id || 'N/A'}`
    });

    // Record P&L
    if (pnl !== 0) {
        recordTransaction({
            account_id,
            type: pnl > 0 ? 'PROFIT' : 'LOSS',
            amount: pnl,
            balance_before: account.current_balance + amount,
            balance_after: new_balance,
            related_trade_id: trade_id,
            description: `${pnl > 0 ? 'Profit' : 'Loss'} from trade #${trade_id || 'N/A'}: ${pnl > 0 ? '+' : ''}$${pnl.toFixed(2)}`
        });
    }

    return getAccount(account_id)!;
}

/**
 * Transfer funds between accounts
 */
export function transfer(from_account_id: string, to_account_id: string, amount: number, description?: string): void {
    const from = getAccount(from_account_id);
    const to = getAccount(to_account_id);

    if (!from) throw new Error(`Source account ${from_account_id} not found`);
    if (!to) throw new Error(`Destination account ${to_account_id} not found`);
    if (amount <= 0) throw new Error('Transfer amount must be positive');
    if (from.current_balance < amount) {
        throw new Error(`Insufficient funds in ${from.name}. Available: $${from.current_balance}, Requested: $${amount}`);
    }

    // Deduct from source
    withdraw(from_account_id, amount, description || `Transfer to ${to.name}`);

    // Add to destination
    deposit(to_account_id, amount, description || `Transfer from ${from.name}`);

    // Record transfer transactions with related_account_id
    const now = new Date().toISOString();
    db.prepare(`
        UPDATE transactions
        SET related_account_id = ?, type = 'TRANSFER'
        WHERE account_id = ? AND created_at = ?
    `).run(to_account_id, from_account_id, now);

    db.prepare(`
        UPDATE transactions
        SET related_account_id = ?, type = 'TRANSFER'
        WHERE account_id = ? AND created_at = ?
    `).run(from_account_id, to_account_id, now);
}

/**
 * Update unrealized P&L for open positions
 */
export function updateUnrealizedPnL(account_id: string, unrealized_pnl: number): Account {
    const account = getAccount(account_id);
    if (!account) throw new Error(`Account ${account_id} not found`);

    const new_equity = account.current_balance + account.allocated_capital + unrealized_pnl;

    db.prepare(`
        UPDATE accounts
        SET unrealized_pnl = ?,
            total_equity = ?,
            updated_at = ?
        WHERE id = ?
    `).run(unrealized_pnl, new_equity, new Date().toISOString(), account_id);

    return getAccount(account_id)!;
}

/**
 * Freeze/unfreeze account (risk management)
 */
export function setAccountStatus(account_id: string, status: 'ACTIVE' | 'FROZEN' | 'CLOSED'): Account {
    db.prepare(`UPDATE accounts SET status = ?, updated_at = ? WHERE id = ?`)
        .run(status, new Date().toISOString(), account_id);

    recordTransaction({
        account_id,
        type: 'DEPOSIT', // Using DEPOSIT as a general event type
        amount: 0,
        balance_before: getAccount(account_id)!.current_balance,
        balance_after: getAccount(account_id)!.current_balance,
        description: `Account status changed to ${status}`
    });

    return getAccount(account_id)!;
}

// ─── Transaction Helpers ──────────────────────────────────────────────────────

function recordTransaction(params: Omit<Transaction, 'id' | 'created_at'>): void {
    const stmt = db.prepare(`
        INSERT INTO transactions (
            account_id, type, amount, balance_before, balance_after,
            related_trade_id, related_account_id, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        params.account_id,
        params.type,
        params.amount,
        params.balance_before,
        params.balance_after,
        params.related_trade_id || null,
        params.related_account_id || null,
        params.description
    );
}

export function getAccountTransactions(account_id: string, limit = 100): Transaction[] {
    const stmt = db.prepare(`
        SELECT * FROM transactions
        WHERE account_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    `);
    return stmt.all(account_id, limit) as Transaction[];
}

export function getAllTransactions(limit = 500): Transaction[] {
    const stmt = db.prepare(`
        SELECT t.*, a.name as account_name
        FROM transactions t
        LEFT JOIN accounts a ON t.account_id = a.id
        ORDER BY t.created_at DESC
        LIMIT ?
    `);
    return stmt.all(limit) as Transaction[];
}

// ─── Initialization ───────────────────────────────────────────────────────────

/**
 * Initialize the account system with a master account and agent accounts
 */
export function initializeAccountSystem(master_balance = 100000) {
    initAccountTables();

    // Create master account if it doesn't exist
    if (!getAccount('master')) {
        createAccount({
            id: 'master',
            name: 'Master Account',
            type: 'MASTER',
            initial_balance: master_balance
        });
    }

    // Agent accounts will be created on-demand when agents are deployed
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export function getSystemSummary() {
    const accounts = getAllAccounts();
    const master = accounts.find(a => a.type === 'MASTER');
    const agents = accounts.filter(a => a.type === 'AGENT');

    const total_equity = accounts.reduce((sum, a) => sum + a.total_equity, 0);
    const total_allocated = accounts.reduce((sum, a) => sum + a.allocated_capital, 0);
    const total_available = accounts.reduce((sum, a) => sum + a.current_balance, 0);
    const total_realized_pnl = accounts.reduce((sum, a) => sum + a.realized_pnl, 0);
    const total_unrealized_pnl = accounts.reduce((sum, a) => sum + a.unrealized_pnl, 0);

    return {
        master_account: master,
        agent_count: agents.length,
        total_equity,
        total_allocated,
        total_available,
        total_realized_pnl,
        total_unrealized_pnl,
        accounts,
        utilization_rate: total_equity > 0 ? (total_allocated / total_equity) * 100 : 0
    };
}
