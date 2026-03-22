'use client';

import React, { useEffect, useState, useCallback } from 'react';
import styles from './HeaderStats.module.css';

interface StatsData {
    todayPnl: number;
    openPositions: number;
    winRate: number;
    totalTrades: number;
    activeAgents: number;
    totalAgents: number;
}

export default function HeaderStats() {
    const [stats, setStats] = useState<StatsData>({
        todayPnl: 0,
        openPositions: 0,
        winRate: 0,
        totalTrades: 0,
        activeAgents: 0,
        totalAgents: 0,
    });
    const [loaded, setLoaded] = useState(false);

    const fetchStats = useCallback(async () => {
        try {
            const [journalRes, agentRes] = await Promise.allSettled([
                fetch('/api/journal?limit=200'),
                fetch('/api/agents'),
            ]);

            let todayPnl = 0;
            let openPositions = 0;
            let winRate = 0;
            let totalTrades = 0;

            if (journalRes.status === 'fulfilled' && journalRes.value.ok) {
                const data = await journalRes.value.json();
                const trades = data.trades || [];
                const today = new Date().toISOString().slice(0, 10);
                const todayTrades = trades.filter((t: any) => (t.opened_at || '').startsWith(today));
                todayPnl = todayTrades.reduce((s: number, t: any) => s + (t.pnl || 0), 0);
                openPositions = trades.filter((t: any) => t.status === 'OPEN').length;
                const closed = trades.filter((t: any) => ['WIN', 'LOSS', 'BE', 'CLOSED'].includes(t.status));
                totalTrades = closed.length;
                const wins = closed.filter((t: any) => t.status === 'WIN').length;
                winRate = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0;
            }

            let activeAgents = 0;
            let totalAgents = 0;

            if (agentRes.status === 'fulfilled' && agentRes.value.ok) {
                const agentData = await agentRes.value.json();
                const agents = Array.isArray(agentData) ? agentData : Object.values(agentData.agents || agentData || {});
                totalAgents = agents.length;
                activeAgents = agents.filter((a: any) =>
                    a.status === 'ACTIVE' || a.status === 'active' || a.status === 'LIVE'
                ).length;
            }

            setStats({ todayPnl, openPositions, winRate, totalTrades, activeAgents, totalAgents });
            setLoaded(true);
        } catch {
            // silently fail
        }
    }, []);

    useEffect(() => {
        fetchStats();
        const t = setInterval(fetchStats, 30_000);
        return () => clearInterval(t);
    }, [fetchStats]);

    const pnlPositive = stats.todayPnl >= 0;
    const pnlStr = `${pnlPositive ? '+' : ''}$${Math.abs(stats.todayPnl).toFixed(2)}`;

    if (!loaded) {
        return (
            <div className={styles.wrapper}>
                <div className={styles.stat}>
                    <span className={styles.statLabel}>LOADING</span>
                    <span className={styles.statValueMuted}>—</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.wrapper}>
            {/* Daily P&L */}
            <div className={styles.stat}>
                <span className={styles.statLabel}>TODAY P&L</span>
                <span className={`${styles.statValue} ${pnlPositive ? styles.positive : styles.negative}`}>
                    {pnlStr}
                </span>
            </div>

            <div className={styles.divider} />

            {/* Open Positions */}
            <div className={styles.stat}>
                <span className={styles.statLabel}>POSITIONS</span>
                <span className={styles.statValue}>
                    {stats.openPositions}
                    <span className={styles.statSuffix}> open</span>
                </span>
            </div>

            <div className={styles.divider} />

            {/* Win Rate */}
            <div className={styles.stat}>
                <span className={styles.statLabel}>WIN RATE</span>
                <span className={styles.statValue}>
                    {stats.winRate}%
                    <span className={styles.statSuffix}> / {stats.totalTrades}</span>
                </span>
            </div>

            <div className={styles.divider} />

            {/* Active Agents */}
            <div className={styles.stat}>
                <span className={styles.statLabel}>AGENTS</span>
                <span className={styles.statValue}>
                    <span className={stats.activeAgents > 0 ? styles.agentLive : styles.agentOff}>
                        {stats.activeAgents}
                    </span>
                    <span className={styles.statSuffix}> / {stats.totalAgents}</span>
                </span>
            </div>
        </div>
    );
}
