'use client';

import { useSquadStatus } from '@/context/AgentContext';
import styles from './SquadStatusWidget.module.css';

export default function SquadStatusWidget() {
    const { totalPnL, activeTradesCount, systemStatus, activeAgents, topPerformer } = useSquadStatus();

    const statusColor = {
        OPERATIONAL: 'var(--success)',
        DEGRADED: 'var(--warning)',
        OFFLINE: 'var(--danger)'
    }[systemStatus];

    const pnlColor = totalPnL >= 0 ? 'var(--success)' : 'var(--danger)';
    const pnlSign = totalPnL >= 0 ? '+' : '';

    return (
        <div className={styles.widget}>
            {/* System Status */}
            <div className={styles.statusSection}>
                <span
                    className={styles.statusDot}
                    style={{ backgroundColor: statusColor }}
                />
                <span className={styles.statusLabel}>
                    {systemStatus === 'OPERATIONAL' ? 'All Systems Go' : systemStatus}
                </span>
            </div>

            {/* Active Trades */}
            <div className={styles.stat}>
                <span className={styles.statValue}>{activeTradesCount}</span>
                <span className={styles.statLabel}>Active Trades</span>
            </div>

            {/* Total PnL */}
            <div className={styles.stat}>
                <span className={styles.statValue} style={{ color: pnlColor }}>
                    {pnlSign}${totalPnL.toFixed(2)}
                </span>
                <span className={styles.statLabel}>Today's P&L</span>
            </div>

            {/* Active Agents Ticker */}
            {activeAgents.length > 0 && (
                <div className={styles.ticker}>
                    {activeAgents.map(agent => (
                        <span key={agent.id} className={styles.tickerItem}>
                            <strong>{agent.name}</strong>: {agent.trade?.side} {agent.trade?.ticker}
                        </span>
                    ))}
                </div>
            )}

            {/* Top Performer Badge */}
            {topPerformer && topPerformer.pnl > 0 && (
                <div className={styles.topPerformer}>
                    🏆 {topPerformer.name}: +${topPerformer.pnl.toFixed(2)}
                </div>
            )}
        </div>
    );
}
