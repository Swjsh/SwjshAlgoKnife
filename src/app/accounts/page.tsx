'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import styles from './Accounts.module.css';
import {
    Wallet,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownLeft,
    Plus,
    RefreshCw,
    Shield,
    DollarSign,
    PieChart
} from 'lucide-react';

interface Account {
    id: string;
    name: string;
    type: 'MASTER' | 'AGENT';
    initial_balance: number;
    current_balance: number;
    allocated_capital: number;
    total_deposited: number;
    total_withdrawn: number;
    realized_pnl: number;
    unrealized_pnl: number;
    total_equity: number;
    status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
}

interface Transaction {
    id: number;
    account_id: string;
    type: string;
    amount: number;
    balance_before: number;
    balance_after: number;
    description: string;
    created_at: string;
    account_name?: string;
}

interface SystemSummary {
    master_account: Account | null;
    agent_count: number;
    total_equity: number;
    total_allocated: number;
    total_available: number;
    total_realized_pnl: number;
    total_unrealized_pnl: number;
    utilization_rate: number;
    accounts: Account[];
}

export default function AccountsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [summary, setSummary] = useState<SystemSummary | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showDepositModal, setShowDepositModal] = useState(false);

    // Protect route
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/login');
        }
    }, [user, authLoading, router]);

    const fetchData = async () => {
        try {
            const [summaryRes, txnsRes] = await Promise.all([
                fetch('/api/accounts?summary=true'),
                fetch('/api/accounts?transactions=all')
            ]);

            if (summaryRes.ok) {
                const data = await summaryRes.json();
                setSummary(data);
            }

            if (txnsRes.ok) {
                const data = await txnsRes.json();
                setTransactions(data.transactions || []);
            }
        } catch (error) {
            console.error('Failed to fetch account data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const handleDeposit = async (account_id: string, amount: number) => {
        try {
            const res = await fetch('/api/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'deposit',
                    account_id,
                    amount,
                    description: 'Manual deposit'
                })
            });

            if (res.ok) {
                fetchData();
                setShowDepositModal(false);
            }
        } catch (error) {
            console.error('Deposit failed:', error);
        }
    };

    const handleTransfer = async (from: string, to: string, amount: number) => {
        try {
            const res = await fetch('/api/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'transfer',
                    from_account_id: from,
                    to_account_id: to,
                    amount,
                    description: 'Account transfer'
                })
            });

            if (res.ok) {
                fetchData();
                setShowTransferModal(false);
            }
        } catch (error) {
            console.error('Transfer failed:', error);
        }
    };

    if (authLoading || loading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner} />
                <p>Loading accounts...</p>
            </div>
        );
    }

    if (!user || !summary) return null;

    const agentAccounts = summary.accounts.filter(a => a.type === 'AGENT');
    const masterAccount = summary.master_account;

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Account Management</h1>
                    <p className={styles.subtitle}>Capital allocation and money flow oversight</p>
                </div>
                <div className={styles.headerActions}>
                    <button onClick={fetchData} className={styles.refreshBtn}>
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* System Overview */}
            <div className={styles.overview}>
                <div className={styles.overviewCard}>
                    <Wallet size={20} />
                    <div>
                        <div className={styles.overviewLabel}>Total Equity</div>
                        <div className={styles.overviewValue}>${summary.total_equity.toLocaleString()}</div>
                    </div>
                </div>
                <div className={styles.overviewCard}>
                    <DollarSign size={20} />
                    <div>
                        <div className={styles.overviewLabel}>Available Cash</div>
                        <div className={styles.overviewValue}>${summary.total_available.toLocaleString()}</div>
                    </div>
                </div>
                <div className={styles.overviewCard}>
                    <PieChart size={20} />
                    <div>
                        <div className={styles.overviewLabel}>Allocated Capital</div>
                        <div className={styles.overviewValue}>${summary.total_allocated.toLocaleString()}</div>
                    </div>
                </div>
                <div className={styles.overviewCard}>
                    <TrendingUp size={20} />
                    <div>
                        <div className={styles.overviewLabel}>Realized P&L</div>
                        <div className={`${styles.overviewValue} ${summary.total_realized_pnl >= 0 ? styles.profit : styles.loss}`}>
                            {summary.total_realized_pnl >= 0 ? '+' : ''}${summary.total_realized_pnl.toLocaleString()}
                        </div>
                    </div>
                </div>
                <div className={styles.overviewCard}>
                    <Shield size={20} />
                    <div>
                        <div className={styles.overviewLabel}>Capital Utilization</div>
                        <div className={styles.overviewValue}>{summary.utilization_rate.toFixed(1)}%</div>
                    </div>
                </div>
            </div>

            {/* Master Account */}
            {masterAccount && (
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Master Account</h2>
                    <div className={styles.masterCard}>
                        <div className={styles.accountHeader}>
                            <div className={styles.accountInfo}>
                                <h3>{masterAccount.name}</h3>
                                <span className={styles.accountType}>MASTER</span>
                            </div>
                            <div className={styles.accountBalance}>
                                <div className={styles.balanceLabel}>Total Equity</div>
                                <div className={styles.balanceValue}>${masterAccount.total_equity.toLocaleString()}</div>
                            </div>
                        </div>
                        <div className={styles.accountGrid}>
                            <div className={styles.accountMetric}>
                                <div className={styles.metricLabel}>Available Cash</div>
                                <div className={styles.metricValue}>${masterAccount.current_balance.toLocaleString()}</div>
                            </div>
                            <div className={styles.accountMetric}>
                                <div className={styles.metricLabel}>Allocated</div>
                                <div className={styles.metricValue}>${masterAccount.allocated_capital.toLocaleString()}</div>
                            </div>
                            <div className={styles.accountMetric}>
                                <div className={styles.metricLabel}>Realized P&L</div>
                                <div className={`${styles.metricValue} ${masterAccount.realized_pnl >= 0 ? styles.profit : styles.loss}`}>
                                    {masterAccount.realized_pnl >= 0 ? '+' : ''}${masterAccount.realized_pnl.toLocaleString()}
                                </div>
                            </div>
                            <div className={styles.accountMetric}>
                                <div className={styles.metricLabel}>Unrealized P&L</div>
                                <div className={`${styles.metricValue} ${masterAccount.unrealized_pnl >= 0 ? styles.profit : styles.loss}`}>
                                    {masterAccount.unrealized_pnl >= 0 ? '+' : ''}${masterAccount.unrealized_pnl.toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Agent Accounts */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Agent Accounts ({agentAccounts.length})</h2>
                <div className={styles.accountsGrid}>
                    {agentAccounts.map((account) => (
                        <div key={account.id} className={styles.agentCard}>
                            <div className={styles.agentHeader}>
                                <div>
                                    <h4>{account.name}</h4>
                                    <span className={styles.agentId}>{account.id}</span>
                                </div>
                                <span className={`${styles.statusBadge} ${styles[account.status.toLowerCase()]}`}>
                                    {account.status}
                                </span>
                            </div>
                            <div className={styles.agentEquity}>
                                <div className={styles.equityLabel}>Total Equity</div>
                                <div className={styles.equityValue}>${account.total_equity.toLocaleString()}</div>
                            </div>
                            <div className={styles.agentMetrics}>
                                <div className={styles.metric}>
                                    <span>Cash:</span>
                                    <strong>${account.current_balance.toLocaleString()}</strong>
                                </div>
                                <div className={styles.metric}>
                                    <span>Allocated:</span>
                                    <strong>${account.allocated_capital.toLocaleString()}</strong>
                                </div>
                                <div className={styles.metric}>
                                    <span>P&L:</span>
                                    <strong className={account.realized_pnl >= 0 ? styles.profit : styles.loss}>
                                        {account.realized_pnl >= 0 ? '+' : ''}${account.realized_pnl.toLocaleString()}
                                    </strong>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Transactions */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Recent Transactions</h2>
                <div className={styles.transactionList}>
                    {transactions.slice(0, 20).map((txn) => (
                        <div key={txn.id} className={styles.transactionRow}>
                            <div className={styles.txnIcon}>
                                {txn.type === 'DEPOSIT' && <ArrowDownLeft size={16} className={styles.depositIcon} />}
                                {txn.type === 'WITHDRAWAL' && <ArrowUpRight size={16} className={styles.withdrawIcon} />}
                                {txn.type === 'ALLOCATION' && <PieChart size={16} className={styles.allocIcon} />}
                                {txn.type === 'RELEASE' && <RefreshCw size={16} className={styles.releaseIcon} />}
                                {txn.type === 'PROFIT' && <TrendingUp size={16} className={styles.profitIcon} />}
                                {txn.type === 'LOSS' && <TrendingDown size={16} className={styles.lossIcon} />}
                            </div>
                            <div className={styles.txnDetails}>
                                <div className={styles.txnType}>{txn.type}</div>
                                <div className={styles.txnDesc}>{txn.description}</div>
                            </div>
                            <div className={styles.txnAccount}>{txn.account_name || txn.account_id}</div>
                            <div className={`${styles.txnAmount} ${txn.amount >= 0 ? styles.positive : styles.negative}`}>
                                {txn.amount >= 0 ? '+' : ''}${Math.abs(txn.amount).toLocaleString()}
                            </div>
                            <div className={styles.txnTime}>
                                {new Date(txn.created_at).toLocaleString()}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
