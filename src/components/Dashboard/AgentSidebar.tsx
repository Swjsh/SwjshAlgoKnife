'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import styles from './AgentSidebar.module.css';
import { TickerIcon } from './TickerIcons';

interface Agent {
    id: string;
    name: string;
    role: string;
    status: 'active' | 'paused' | 'offline';
    avatar?: string;
    initial: string;
    catchphrase?: string;
}

interface AgentSidebarProps {
    agents: Agent[];
    selectedId: string;
    onSelect: (id: string) => void;
    totalPnl?: number;
    activeAgentsCount?: number;
}

export default function AgentSidebar({
    agents,
    selectedId,
    onSelect,
    totalPnl = 0,
    activeAgentsCount = 0,
}: AgentSidebarProps) {
    const router = useRouter();

    // Navigate to the agent's full cockpit with chart
    const handleAgentClick = (agentId: string) => {
        router.push(`/agent/${agentId}`);
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.header}>
                <div className={styles.title}>Squad Metrics</div>

                <div className={styles.metrics}>
                    <div className={styles.metric}>
                        <span className={styles.metricLabel}>Active Agents</span>
                        <span className={styles.metricValue}>{activeAgentsCount}</span>
                    </div>
                    <div className={styles.metric}>
                        <span className={styles.metricLabel}>Total PnL</span>
                        <span className={`${styles.metricValue} ${totalPnl >= 0 ? styles['value-positive'] : styles['value-negative']}`}>
                            ${totalPnl.toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>

            <div className={styles.agentList}>
                <div className={styles.title} style={{ paddingLeft: 8 }}>Deployed Agents</div>
                {agents.map((agent, i) => {
                    // Simulation for "Live" feel
                    const winRate = 65 + (agent.name.length * 2) % 20;
                    const dailyPnl = (agent.name.length * 150) % 1000 * (i % 2 === 0 ? 1 : -0.2);
                    const isPositive = dailyPnl >= 0;

                    // Determine Ticker & Type based on ID/Role
                    let ticker = "BTC/USD";
                    let tickerType = "crypto";
                    if (agent.id.includes('forex') || agent.role.includes('Forex')) {
                        ticker = "EUR/USD";
                        tickerType = "forex";
                    } else if (agent.id.includes('indices') || agent.role.includes('Indices') || agent.name.includes('Sniper') || agent.id.includes('spx')) {
                        ticker = "SPX500";
                        tickerType = "index";
                    } else if (agent.id.includes('boba') || agent.role.includes('Meme')) {
                        ticker = "DOGE";
                        tickerType = "doge";
                    } else if (agent.id.includes('pivot') || agent.role.includes('Future')) {
                        ticker = "ES_F";
                        tickerType = "index";
                    }

                    return (
                        <div
                            key={agent.id}
                            className={`${styles.agentCard} ${selectedId === agent.id ? styles.active : ''}`}
                            onClick={() => handleAgentClick(agent.id)}
                            style={{ animationDelay: `${i * 0.1}s` }}
                        >
                            <div className={styles.avatar}>
                                {agent.avatar ? (
                                    <img src={agent.avatar} alt={agent.name} />
                                ) : (
                                    agent.initial
                                )}
                                <div className={`${styles.statusDot} ${styles[`status-${agent.status}`]}`} />
                            </div>

                            <div className={styles.info}>
                                <div className={styles.headerRow}>
                                    <span className={styles.name}>{agent.name}</span>
                                    <div className={styles.tickerPill}>
                                        <TickerIcon type={tickerType} />
                                        <span>{ticker}</span>
                                    </div>
                                </div>

                                <span className={styles.role}>{agent.role}</span>

                                <div className={styles.statsRow}>
                                    <div className={styles.statItem}>
                                        <span className={styles.statLabel}>Win Rate</span>
                                        <span className={`${styles.statValue} ${styles.positive}`}>{winRate}%</span>
                                    </div>
                                    <div className={styles.statItem}>
                                        <span className={styles.statLabel}>24h PnL</span>
                                        <span className={`${styles.statValue} ${isPositive ? styles.positive : styles.negative}`}>
                                            {isPositive ? '+' : ''}${Math.abs(dailyPnl).toFixed(0)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}
