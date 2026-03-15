# Account Management System

## Overview

The Account Management System provides strict oversight of capital allocation across all trading agents, treating paper trading with the same rigor as real money. Each agent has its own isolated account with full transaction history and real-time balance tracking.

## Architecture

### Database Tables

**`accounts`**
- Stores individual agent and master account data
- Tracks current balance, allocated capital, P&L, and total equity
- Supports ACTIVE, FROZEN, and CLOSED statuses

**`transactions`**
- Complete ledger of all money movements
- Types: DEPOSIT, WITHDRAWAL, ALLOCATION, RELEASE, PROFIT, LOSS, TRANSFER
- Links transactions to trades and related accounts

### Account Types

**Master Account**
- Central treasury holding total system capital
- Distributes funds to agent accounts
- Monitors system-wide utilization

**Agent Accounts**
- One per trading agent (Sterling, Boba, Pivot Pete, etc.)
- Receives allocated capital from master
- Tracks individual agent performance

## Core Concepts

### Capital Allocation Flow

```
Master Account ($100,000)
    │
    ├─> Transfer to Sterling ($10,000)
    ├─> Transfer to Boba ($5,000)
    └─> Transfer to Pivot Pete ($10,000)

Sterling Account ($10,000 available)
    │
    ├─> Trade Opened: EURUSD LONG
    │   └─> Allocate $1,000 (moves from available → allocated)
    │
    └─> Trade Closed: +$300 profit
        └─> Release $1,300 back to available
            (original $1,000 + $300 profit)
```

### Transaction Types

- **DEPOSIT**: Add funds to account
- **WITHDRAWAL**: Remove funds from account
- **ALLOCATION**: Lock capital when opening trade
- **RELEASE**: Free capital when closing trade
- **PROFIT/LOSS**: Record trade P&L
- **TRANSFER**: Move funds between accounts

### Account States

- **Available Cash**: Free capital ready for new trades
- **Allocated Capital**: Locked in active trades
- **Realized P&L**: Total profit/loss from closed trades
- **Unrealized P&L**: Current profit/loss on open trades
- **Total Equity**: `available + allocated + unrealized`

## Usage

### Initializing the System

The system auto-initializes on first run with a $100,000 master account:

```typescript
import { initializeAccountSystem } from '@/lib/accounts';

// Initialize with custom starting balance
initializeAccountSystem(250000); // $250k
```

### Creating Agent Accounts

```typescript
import { createAccount, transfer } from '@/lib/accounts';

// Create agent account
const agent = createAccount({
    id: 'sterling',
    name: 'Sterling (Forex)',
    type: 'AGENT',
    initial_balance: 0
});

// Fund agent from master account
transfer('master', 'sterling', 10000, 'Initial allocation');
```

### Executing Trades with Account Integration

```typescript
import { executeTrade, closeTrade } from '@/lib/tradeExecutor';

// Open trade (automatically allocates capital)
const trade_id = executeTrade({
    agent_id: 'sterling',
    symbol: 'EURUSD',
    direction: 'LONG',
    entry_price: 1.0850,
    size: 10000,
    strategy: 'Three Ducks',
    risk_amount: 1000 // Optional, defaults to 1% of equity
});

// Close trade (automatically releases capital + P&L)
closeTrade({
    trade_id: trade_id,
    exit_price: 1.0880
});
```

### Manual Account Operations

```typescript
import { deposit, withdraw, getAccount } from '@/lib/accounts';

// Deposit funds
deposit('sterling', 5000, 'Additional funding');

// Withdraw funds
withdraw('sterling', 2000, 'Profit withdrawal');

// Check account balance
const account = getAccount('sterling');
console.log(account.current_balance); // Available cash
console.log(account.total_equity);    // Total account value
```

### Viewing Transaction History

```typescript
import { getAccountTransactions } from '@/lib/accounts';

// Get last 100 transactions for Sterling
const txns = getAccountTransactions('sterling', 100);

txns.forEach(txn => {
    console.log(
        `${txn.type}: $${txn.amount} | ` +
        `Balance: $${txn.balance_before} → $${txn.balance_after}`
    );
});
```

### System-Wide Analytics

```typescript
import { getSystemSummary } from '@/lib/accounts';

const summary = getSystemSummary();

console.log('Total System Equity:', summary.total_equity);
console.log('Capital Utilization:', summary.utilization_rate, '%');
console.log('Active Agents:', summary.agent_count);
console.log('Total P&L:', summary.total_realized_pnl);
```

## API Endpoints

### GET /api/accounts

**Get all accounts:**
```bash
GET /api/accounts
```

**Get specific account with transactions:**
```bash
GET /api/accounts?id=sterling&transactions=true
```

**Get system summary:**
```bash
GET /api/accounts?summary=true
```

### POST /api/accounts

**Create account:**
```json
{
    "action": "create",
    "id": "new_agent",
    "name": "New Agent",
    "type": "AGENT",
    "initial_balance": 10000
}
```

**Deposit funds:**
```json
{
    "action": "deposit",
    "account_id": "sterling",
    "amount": 5000,
    "description": "Monthly funding"
}
```

**Transfer between accounts:**
```json
{
    "action": "transfer",
    "from_account_id": "master",
    "to_account_id": "sterling",
    "amount": 10000,
    "description": "Initial allocation"
}
```

## UI Pages

### /accounts

Web interface showing:
- System-wide capital overview
- Master account status
- All agent account balances
- Recent transaction history
- Real-time equity calculations

### /command-center

Live monitoring showing:
- Which agents are in trading windows
- Active trades and capital allocation
- Real-time P&L tracking

## Risk Management

### Account Freezing

```typescript
import { setAccountStatus } from '@/lib/accounts';

// Freeze account (no new trades allowed)
setAccountStatus('sterling', 'FROZEN');

// Unfreeze
setAccountStatus('sterling', 'ACTIVE');

// Permanently close
setAccountStatus('sterling', 'CLOSED');
```

### Capital Utilization Limits

```typescript
import { getAccount } from '@/lib/accounts';

const account = getAccount('sterling');
const utilization = (account.allocated_capital / account.total_equity) * 100;

if (utilization > 80) {
    console.warn('WARNING: Sterling is over-leveraged!');
    // Trigger risk protocols
}
```

### Insufficient Funds Protection

The system automatically prevents trades if:
- Account has insufficient available cash
- Requested allocation exceeds current balance
- Account status is FROZEN or CLOSED

## Integration with Existing Code

### Update Agent Runner

```typescript
// scripts/agent_runner.ts
import { executeTrade, closeTrade } from '@/lib/tradeExecutor';

// When agent generates a signal
const trade_id = executeTrade({
    agent_id: 'sterling',
    symbol: signal.symbol,
    direction: signal.action,
    entry_price: signal.price,
    size: calculatePositionSize(signal),
    strategy: 'Three Ducks'
});
```

### Update Dashboard Components

```typescript
// components/Dashboard/AgentCard.tsx
import { getAccount } from '@/lib/accounts';

const account = getAccount(agent.id);

return (
    <div>
        <h3>{agent.name}</h3>
        <p>Available: ${account.current_balance.toLocaleString()}</p>
        <p>In Trades: ${account.allocated_capital.toLocaleString()}</p>
        <p>Total Equity: ${account.total_equity.toLocaleString()}</p>
    </div>
);
```

## Best Practices

1. **Always use tradeExecutor** instead of directly inserting trades
2. **Monitor utilization rates** to prevent over-leverage
3. **Freeze accounts** before making configuration changes
4. **Review transaction history** to audit all money movement
5. **Set realistic risk amounts** (typically 1-2% of equity per trade)
6. **Keep master account funded** to support agent allocations
7. **Use transfers** to rebalance capital between agents

## Transition to Live Trading

When ready for real money:

1. **Verify all paper trading accounts balance correctly**
2. **Review transaction ledger for accuracy**
3. **Implement additional safety checks** (max daily loss, drawdown limits)
4. **Connect real broker APIs** (OANDA, Alpaca, etc.)
5. **Start with minimal capital** ($1k-$5k) per agent
6. **Monitor closely** for first 2 weeks
7. **Scale up gradually** based on proven performance

The account system architecture is identical for paper and live trading - only the broker execution layer changes.

## Troubleshooting

**Account balance doesn't match:**
- Check transaction history for all money movements
- Verify trades are using tradeExecutor, not raw SQL
- Run system summary to reconcile totals

**Trade execution fails:**
- Ensure agent account exists and is ACTIVE
- Verify sufficient available cash
- Check for locked capital in open trades

**Unrealized P&L not updating:**
- Call `updateAgentUnrealizedPnL()` with current prices
- Verify open trades are properly linked in transactions table
