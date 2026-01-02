"use client";

import React, { useState } from 'react';
import styles from './AgentScoreCard.module.css';
import { X, ExternalLink, Activity, Trophy, TrendingUp, Power } from 'lucide-react';
import Link from 'next/link';

interface AgentScoreCardProps {
    agent: any;
    onClose: () => void;
    onToggle: (id: string, active: boolean) => void;
}

export default function AgentScoreCard({ agent, onClose, onToggle }: AgentScoreCardProps) {
    // Generate some fake historical stats for demo/fun if real ones aren't fully populated
    const stats = {
        winRate: agent.performance?.win_rate ?? 0,
        totalTrades: agent.performance?.trades ?? 0,
        pnl: agent.performance?.total_pnl ?? 0,
        xp: Math.floor((agent.performance?.total_pnl ?? 0) / 10) + 1000 // Simplified XP based on PnL
    };

    const [active, setActive] = useState(agent.status === 'ACTIVE');

    const handleToggle = () => {
        const newState = !active;
        setActive(newState);
        onToggle(agent.id, newState);
    };

    if (!agent) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>

                {/* Hero Header */}
                <div className={styles.hero} style={{ backgroundImage: `url(${agent.meta?.avatar || ''})` }}>
                    <div className={styles.heroOverlay} />
                    <div className={styles.heroContent}>
                        <div className={styles.avatarLarge}>
                            {agent.meta?.avatar ? (
                                <img src={agent.meta.avatar} alt={agent.meta.name} />
                            ) : (
                                <span>{agent.initial || 'AG'}</span>
                            )}
                        </div>
                        <div>
                            <h2 className={styles.agentName}>{agent.meta?.name}</h2>
                            <p className={styles.agentRole}>{agent.meta?.type} Specialist</p>
                        </div>
                        <div className={styles.levelBadge}>
                            LVL {Math.floor(stats.xp / 1000)}
                        </div>
                    </div>
                </div>

                <div className={styles.body}>
                    {/* Status Toggle */}
                    <div className={styles.statusRow}>
                        <div className={styles.statusLabel}>
                            <Activity size={16} className={active ? styles.pulseGreen : ''} />
                            <span>System Status</span>
                        </div>
                        <button
                            className={`${styles.toggleBtn} ${active ? styles.toggleOn : styles.toggleOff}`}
                            onClick={handleToggle}
                        >
                            <Power size={14} />
                            {active ? 'ONLINE' : 'OFFLINE'}
                        </button>
                    </div>

                    {/* Stats Grid */}
                    <div className={styles.statsGrid}>
                        <div className={styles.statBox}>
                            <Trophy size={18} className={styles.iconGold} />
                            <span className={styles.statValue}>{stats.winRate}%</span>
                            <span className={styles.statLabel} >Win Rate</span>
                        </div>
                        <div className={styles.statBox}>
                            <TrendingUp size={18} className={styles.iconGreen} />
                            <span className={styles.statValue}>${stats.pnl.toLocaleString()}</span>
                            <span className={styles.statLabel}>Total PnL</span>
                        </div>
                        <div className={styles.statBox}>
                            <Activity size={18} className={styles.iconBlue} />
                            <span className={styles.statValue}>{stats.totalTrades}</span>
                            <span className={styles.statLabel}>Trades</span>
                        </div>
                    </div>

                    <div className={styles.bioSection}>
                        <h4>Directives</h4>
                        <p>{agent.meta?.description || "Autonomous trading agent authorized for market engagement."}</p>
                    </div>

                    <div className={styles.actions}>
                        <Link href={`/agent/${agent.id}`} className={styles.fullReportBtn}>
                            Full Diagnostic Report <ExternalLink size={14} />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
