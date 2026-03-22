'use client';

import React from 'react';
import Link from 'next/link';
import { AgentState } from '@/context/AgentContext';
import styles from './AgentCard.module.css';

interface AgentCardProps {
    agentId: string;
    agent: AgentState;
}

export default function AgentCard({ agentId, agent }: AgentCardProps) {
    const isActive = agent.status === 'ACTIVE' || agent.status === 'ONLINE';
    const isIdle = agent.status === 'IDLE' || agent.status === 'WAITING';
    const hasError = agent.status === 'ERROR' || agent.status === 'OFFLINE';

    // Get current action text
    const getCurrentAction = () => {
        if (agent.active_trades && agent.active_trades.length > 0) {
            const trade = agent.active_trades[0];
            return `${trade.side || 'LONG'} ${trade.ticker} @ ${trade.entry}`;
        }
        if (agent.pending_orders && agent.pending_orders.length > 0) {
            const order = agent.pending_orders[0];
            return `Watching ${order.ticker}`;
        }
        if (agent.meta?.type?.toLowerCase() === 'crypto') {
            return '24/7 Scanning';
        }
        return 'Waiting for opportunity';
    };

    // Calculate day's PnL
    const dayPnL = agent.performance?.total_pnl || 0;
    const winRate = agent.performance?.win_rate || 0;

    // Get avatar
    const avatarUrl = (agent.meta as any)?.avatar;

    // Determine status dot class
    const getStatusClass = () => {
        if (hasError) return styles.statusError;
        if (isActive) return styles.statusActive;
        if (isIdle) return styles.statusIdle;
        return styles.statusIdle;
    };

    return (
        <Link href={`/agent/${agentId}`} className={styles.card}>
            <div className={styles.header}>
                <div className={styles.avatarWrapper}>
                    {avatarUrl ? (
                        <img src={avatarUrl} alt={agent.meta?.name} className={styles.avatarImage} />
                    ) : (
                        <div className={styles.avatarFallback}>
                            {agent.meta?.name?.charAt(0) || agentId.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className={`${styles.statusDot} ${getStatusClass()}`} />
                </div>
                <div className={styles.nameSection}>
                    <h3 className={styles.name}>{agent.meta?.name || agentId}</h3>
                    <span className={styles.marketType}>{agent.meta?.type}</span>
                </div>
            </div>

            <div className={styles.body}>
                <p className={styles.currentAction}>{getCurrentAction()}</p>
            </div>

            <div className={styles.footer}>
                <div className={styles.pnlSection}>
                    <span className={`${styles.pnl} ${dayPnL >= 0 ? styles.pnlPositive : styles.pnlNegative}`}>
                        {dayPnL >= 0 ? '+' : ''}${dayPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={styles.pnlLabel}>Today</span>
                </div>
                <div className={styles.winRateSection}>
                    <span className={styles.winRate}>{winRate}%</span>
                    <span className={styles.winRateLabel}>Win Rate</span>
                </div>
            </div>
        </Link>
    );
}
