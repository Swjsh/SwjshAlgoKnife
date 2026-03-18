import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, AuthError } from '@/lib/auth';

// For backward compatibility, also import legacy SQLite functions
let legacyAccounts: any = null;
try {
    legacyAccounts = require('@/lib/accounts');
} catch {
    // SQLite not available
}

const CreateAccountSchema = z.object({
    accountId: z.string().min(1).max(50),
    name: z.string().min(1).max(100),
    accountType: z.enum(['MASTER', 'AGENT']).default('AGENT'),
    initialBalance: z.number().min(0).default(0),
});

const TransactionSchema = z.object({
    action: z.enum(['deposit', 'withdraw', 'transfer', 'allocate', 'release']),
    accountId: z.string(),
    amount: z.number().positive(),
    description: z.string().optional(),
    toAccountId: z.string().optional(), // For transfers
    tradeId: z.string().optional(),
});

// GET /api/accounts
export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser();

        const { searchParams } = new URL(req.url);
        const accountId = searchParams.get('id');
        const summary = searchParams.get('summary');
        const transactions = searchParams.get('transactions');

        // Multi-tenant: filter by user
        if (user) {
            // Get system summary
            if (summary === 'true') {
                const accounts = await prisma.agentAccount.findMany({
                    where: { userId: user.id },
                });

                const master = accounts.find(a => a.accountType === 'MASTER');
                const agents = accounts.filter(a => a.accountType === 'AGENT');

                const totalEquity = accounts.reduce((sum, a) => sum + a.totalEquity.toNumber(), 0);
                const totalAllocated = accounts.reduce((sum, a) => sum + a.allocatedCapital.toNumber(), 0);
                const totalAvailable = accounts.reduce((sum, a) => sum + a.currentBalance.toNumber(), 0);
                const totalRealizedPnl = accounts.reduce((sum, a) => sum + a.realizedPnl.toNumber(), 0);
                const totalUnrealizedPnl = accounts.reduce((sum, a) => sum + a.unrealizedPnl.toNumber(), 0);

                return NextResponse.json({
                    master_account: master ? {
                        ...master,
                        initialBalance: master.initialBalance.toNumber(),
                        currentBalance: master.currentBalance.toNumber(),
                        allocatedCapital: master.allocatedCapital.toNumber(),
                        realizedPnl: master.realizedPnl.toNumber(),
                        unrealizedPnl: master.unrealizedPnl.toNumber(),
                        totalEquity: master.totalEquity.toNumber(),
                    } : null,
                    agent_count: agents.length,
                    total_equity: totalEquity,
                    total_allocated: totalAllocated,
                    total_available: totalAvailable,
                    total_realized_pnl: totalRealizedPnl,
                    total_unrealized_pnl: totalUnrealizedPnl,
                    utilization_rate: totalEquity > 0 ? (totalAllocated / totalEquity) * 100 : 0,
                    accounts: accounts.map(a => ({
                        ...a,
                        initialBalance: a.initialBalance.toNumber(),
                        currentBalance: a.currentBalance.toNumber(),
                        allocatedCapital: a.allocatedCapital.toNumber(),
                        realizedPnl: a.realizedPnl.toNumber(),
                        unrealizedPnl: a.unrealizedPnl.toNumber(),
                        totalEquity: a.totalEquity.toNumber(),
                    })),
                });
            }

            // Get transactions for an account
            if (transactions && accountId) {
                const account = await prisma.agentAccount.findFirst({
                    where: { userId: user.id, accountId },
                });
                if (!account) {
                    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
                }

                const txns = await prisma.accountTransaction.findMany({
                    where: { accountId: account.id },
                    orderBy: { createdAt: 'desc' },
                    take: 100,
                });

                return NextResponse.json({
                    transactions: txns.map(t => ({
                        ...t,
                        amount: t.amount.toNumber(),
                        balanceBefore: t.balanceBefore.toNumber(),
                        balanceAfter: t.balanceAfter.toNumber(),
                    })),
                });
            }

            // Get all transactions
            if (transactions === 'all') {
                const userAccounts = await prisma.agentAccount.findMany({
                    where: { userId: user.id },
                    select: { id: true },
                });
                const accountIds = userAccounts.map(a => a.id);

                const txns = await prisma.accountTransaction.findMany({
                    where: { accountId: { in: accountIds } },
                    orderBy: { createdAt: 'desc' },
                    take: 500,
                    include: { account: { select: { name: true } } },
                });

                return NextResponse.json({
                    transactions: txns.map(t => ({
                        ...t,
                        amount: t.amount.toNumber(),
                        balanceBefore: t.balanceBefore.toNumber(),
                        balanceAfter: t.balanceAfter.toNumber(),
                        account_name: t.account.name,
                    })),
                });
            }

            // Get specific account
            if (accountId) {
                const account = await prisma.agentAccount.findFirst({
                    where: { userId: user.id, accountId },
                });
                if (!account) {
                    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
                }

                const txns = await prisma.accountTransaction.findMany({
                    where: { accountId: account.id },
                    orderBy: { createdAt: 'desc' },
                    take: 50,
                });

                return NextResponse.json({
                    account: {
                        ...account,
                        initialBalance: account.initialBalance.toNumber(),
                        currentBalance: account.currentBalance.toNumber(),
                        allocatedCapital: account.allocatedCapital.toNumber(),
                        realizedPnl: account.realizedPnl.toNumber(),
                        unrealizedPnl: account.unrealizedPnl.toNumber(),
                        totalEquity: account.totalEquity.toNumber(),
                    },
                    transactions: txns.map(t => ({
                        ...t,
                        amount: t.amount.toNumber(),
                        balanceBefore: t.balanceBefore.toNumber(),
                        balanceAfter: t.balanceAfter.toNumber(),
                    })),
                });
            }

            // Get all accounts
            const accounts = await prisma.agentAccount.findMany({
                where: { userId: user.id },
                orderBy: [{ accountType: 'desc' }, { name: 'asc' }],
            });

            return NextResponse.json({
                accounts: accounts.map(a => ({
                    ...a,
                    id: a.accountId, // For backward compat
                    type: a.accountType,
                    initial_balance: a.initialBalance.toNumber(),
                    current_balance: a.currentBalance.toNumber(),
                    allocated_capital: a.allocatedCapital.toNumber(),
                    realized_pnl: a.realizedPnl.toNumber(),
                    unrealized_pnl: a.unrealizedPnl.toNumber(),
                    total_equity: a.totalEquity.toNumber(),
                })),
            });
        }

        // Fallback to legacy SQLite for backward compatibility
        if (legacyAccounts) {
            legacyAccounts.initializeAccountSystem();

            if (summary === 'true') {
                return NextResponse.json(legacyAccounts.getSystemSummary());
            }
            if (transactions && accountId) {
                return NextResponse.json({ transactions: legacyAccounts.getAccountTransactions(accountId, 100) });
            }
            if (transactions === 'all') {
                return NextResponse.json({ transactions: legacyAccounts.getAllTransactions(500) });
            }
            if (accountId) {
                const account = legacyAccounts.getAccount(accountId);
                if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
                return NextResponse.json({ account, transactions: legacyAccounts.getAccountTransactions(accountId, 50) });
            }
            return NextResponse.json({ accounts: legacyAccounts.getAllAccounts() });
        }

        return NextResponse.json({ accounts: [] });

    } catch (error: any) {
        console.error('[Accounts API] GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/accounts
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            // Fallback to legacy for backward compat
            if (legacyAccounts) {
                const body = await req.json();
                const { action, ...params } = body;

                switch (action) {
                    case 'create':
                        const newAccount = legacyAccounts.createAccount({
                            id: params.id,
                            name: params.name,
                            type: params.type || 'AGENT',
                            initial_balance: params.initial_balance || 0
                        });
                        return NextResponse.json({ success: true, account: newAccount });
                    case 'deposit':
                        return NextResponse.json({ success: true, account: legacyAccounts.deposit(params.account_id, params.amount, params.description) });
                    case 'withdraw':
                        return NextResponse.json({ success: true, account: legacyAccounts.withdraw(params.account_id, params.amount, params.description) });
                    case 'transfer':
                        legacyAccounts.transfer(params.from_account_id, params.to_account_id, params.amount, params.description);
                        return NextResponse.json({ success: true });
                    default:
                        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
                }
            }

            return NextResponse.json(
                { error: 'Authentication required', code: 'AUTH_REQUIRED' },
                { status: 401 }
            );
        }

        const body = await req.json();

        // Handle 'create' action separately
        if (body.action === 'create') {
            const parseResult = CreateAccountSchema.safeParse(body);
            if (!parseResult.success) {
                return NextResponse.json({ error: 'Validation failed', details: parseResult.error.flatten() }, { status: 400 });
            }

            const data = parseResult.data;

            // Check if account already exists
            const existing = await prisma.agentAccount.findFirst({
                where: { userId: user.id, accountId: data.accountId },
            });
            if (existing) {
                return NextResponse.json({ error: 'Account already exists' }, { status: 409 });
            }

            const account = await prisma.agentAccount.create({
                data: {
                    userId: user.id,
                    accountId: data.accountId,
                    name: data.name,
                    accountType: data.accountType,
                    initialBalance: data.initialBalance,
                    currentBalance: data.initialBalance,
                    totalDeposited: data.initialBalance,
                    totalEquity: data.initialBalance,
                },
            });

            // Record initial deposit transaction
            if (data.initialBalance > 0) {
                await prisma.accountTransaction.create({
                    data: {
                        accountId: account.id,
                        type: 'DEPOSIT',
                        amount: data.initialBalance,
                        balanceBefore: 0,
                        balanceAfter: data.initialBalance,
                        description: 'Initial deposit',
                    },
                });
            }

            return NextResponse.json({
                success: true,
                account: {
                    ...account,
                    initialBalance: account.initialBalance.toNumber(),
                    currentBalance: account.currentBalance.toNumber(),
                    totalEquity: account.totalEquity.toNumber(),
                },
            });
        }

        // Handle other actions
        const parseResult = TransactionSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json({ error: 'Validation failed', details: parseResult.error.flatten() }, { status: 400 });
        }

        const { action, accountId, amount, description, toAccountId, tradeId } = parseResult.data;

        // Find account
        const account = await prisma.agentAccount.findFirst({
            where: { userId: user.id, accountId },
        });
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const currentBalance = account.currentBalance.toNumber();
        let newBalance = currentBalance;

        switch (action) {
            case 'deposit':
                newBalance = currentBalance + amount;
                await prisma.agentAccount.update({
                    where: { id: account.id },
                    data: {
                        currentBalance: newBalance,
                        totalDeposited: { increment: amount },
                        totalEquity: { increment: amount },
                    },
                });
                await prisma.accountTransaction.create({
                    data: {
                        accountId: account.id,
                        type: 'DEPOSIT',
                        amount,
                        balanceBefore: currentBalance,
                        balanceAfter: newBalance,
                        description,
                    },
                });
                break;

            case 'withdraw':
                if (currentBalance < amount) {
                    return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 });
                }
                newBalance = currentBalance - amount;
                await prisma.agentAccount.update({
                    where: { id: account.id },
                    data: {
                        currentBalance: newBalance,
                        totalWithdrawn: { increment: amount },
                        totalEquity: { decrement: amount },
                    },
                });
                await prisma.accountTransaction.create({
                    data: {
                        accountId: account.id,
                        type: 'WITHDRAWAL',
                        amount: -amount,
                        balanceBefore: currentBalance,
                        balanceAfter: newBalance,
                        description,
                    },
                });
                break;

            case 'allocate':
                if (currentBalance < amount) {
                    return NextResponse.json({ error: 'Insufficient funds for allocation' }, { status: 400 });
                }
                newBalance = currentBalance - amount;
                await prisma.agentAccount.update({
                    where: { id: account.id },
                    data: {
                        currentBalance: newBalance,
                        allocatedCapital: { increment: amount },
                    },
                });
                await prisma.accountTransaction.create({
                    data: {
                        accountId: account.id,
                        type: 'ALLOCATION',
                        amount: -amount,
                        balanceBefore: currentBalance,
                        balanceAfter: newBalance,
                        relatedTradeId: tradeId,
                        description: description || `Capital allocated to trade`,
                    },
                });
                break;

            case 'release':
                newBalance = currentBalance + amount;
                await prisma.agentAccount.update({
                    where: { id: account.id },
                    data: {
                        currentBalance: newBalance,
                        allocatedCapital: { decrement: amount },
                    },
                });
                await prisma.accountTransaction.create({
                    data: {
                        accountId: account.id,
                        type: 'RELEASE',
                        amount,
                        balanceBefore: currentBalance,
                        balanceAfter: newBalance,
                        relatedTradeId: tradeId,
                        description: description || `Capital released from trade`,
                    },
                });
                break;

            case 'transfer':
                if (!toAccountId) {
                    return NextResponse.json({ error: 'Destination account required for transfer' }, { status: 400 });
                }
                if (currentBalance < amount) {
                    return NextResponse.json({ error: 'Insufficient funds for transfer' }, { status: 400 });
                }

                const toAccount = await prisma.agentAccount.findFirst({
                    where: { userId: user.id, accountId: toAccountId },
                });
                if (!toAccount) {
                    return NextResponse.json({ error: 'Destination account not found' }, { status: 404 });
                }

                // Deduct from source
                await prisma.agentAccount.update({
                    where: { id: account.id },
                    data: { currentBalance: { decrement: amount }, totalEquity: { decrement: amount } },
                });
                await prisma.accountTransaction.create({
                    data: {
                        accountId: account.id,
                        type: 'TRANSFER',
                        amount: -amount,
                        balanceBefore: currentBalance,
                        balanceAfter: currentBalance - amount,
                        relatedAccountId: toAccount.id,
                        description: description || `Transfer to ${toAccount.name}`,
                    },
                });

                // Add to destination
                const toBalance = toAccount.currentBalance.toNumber();
                await prisma.agentAccount.update({
                    where: { id: toAccount.id },
                    data: { currentBalance: { increment: amount }, totalEquity: { increment: amount } },
                });
                await prisma.accountTransaction.create({
                    data: {
                        accountId: toAccount.id,
                        type: 'TRANSFER',
                        amount,
                        balanceBefore: toBalance,
                        balanceAfter: toBalance + amount,
                        relatedAccountId: account.id,
                        description: description || `Transfer from ${account.name}`,
                    },
                });

                break;
        }

        // Fetch updated account
        const updatedAccount = await prisma.agentAccount.findUnique({ where: { id: account.id } });

        return NextResponse.json({
            success: true,
            account: updatedAccount ? {
                ...updatedAccount,
                currentBalance: updatedAccount.currentBalance.toNumber(),
                allocatedCapital: updatedAccount.allocatedCapital.toNumber(),
                totalEquity: updatedAccount.totalEquity.toNumber(),
            } : null,
        });

    } catch (error: any) {
        console.error('[Accounts API] POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
