"use client";

import React, { useState, useEffect, useMemo } from 'react';
import styles from './page.module.css';
import { Trophy, MessageCircle, TrendingUp, Star, Award, Coffee, Zap, Target, Activity } from 'lucide-react';
import ThemeToggle from '@/components/UI/ThemeToggle';
import { useStrategy } from '@/context/StrategyContext';
import Link from 'next/link';

// Agent color mapping for avatars and messages
const agentColors: Record<string, string> = {
    'fx': '#4A90D9',
    'crypto': '#F59E0B',
    'spx': '#EF4444',
    'futures': '#10B981',
    'boba': '#EC4899',
    'professor': '#10B981',
    'auditor': '#64748B',
    'overseer': '#D97706',
};

// Agent initials for fallback avatars
const agentInitials: Record<string, string> = {
    'fx': 'FX',
    'crypto': 'BB',
    'spx': 'SS',
    'futures': 'PP',
    'boba': '🧋',
    'professor': '🎓',
    'auditor': '⚖️',
    'overseer': '👁️',
};

// Water cooler sample messages (these cycle/update)
const waterCoolerTemplates = [
    { agent: 'The Overseer', message: 'Risk parameters holding steady. Stay disciplined, team.', color: '#D97706' },
    { agent: 'The Professor', message: 'Reviewing overnight performance. Report incoming.', color: '#10B981' },
];

export default function BreakRoomPage() {
    const { agents, theme, toggleTheme } = useStrategy();
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update time every minute
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    // Build leaderboard from real agent data
    const leaderboard = useMemo(() => {
        if (!agents) return [];

        return Object.entries(agents)
            .filter(([id]) => !['professor', 'auditor'].includes(id)) // Exclude non-trading agents
            .map(([id, agent]: [string, any]) => ({
                id,
                name: agent.meta?.name || id,
                avatar: agent.meta?.avatar || null,
                pnl: (agent.performance as any)?.total_pnl || 0,
                winRate: (agent.performance as any)?.win_rate || 0,
                trades: (agent.performance as any)?.trades || 0,
                zones: agent.total_zones_found || 0,
                status: agent.status,
            }))
            .sort((a, b) => {
                // Sort by PnL first, then by zones found, then by win rate
                if (b.pnl !== a.pnl) return b.pnl - a.pnl;
                if (b.zones !== a.zones) return b.zones - a.zones;
                return b.winRate - a.winRate;
            });
    }, [agents]);

    // Employee of the month - top performer
    const employeeOfMonth = leaderboard[0] || { name: 'No Data', pnl: 0, winRate: 0, id: 'none' };

    // Generate dynamic water cooler messages from agent activity
    const waterCoolerMessages = useMemo(() => {
        const messages: any[] = [];
        const now = new Date();

        if (agents) {
            Object.entries(agents).forEach(([id, agent]: [string, any]) => {
                // Add status messages
                if (agent.status === 'ACTIVE') {
                    messages.push({
                        agent: agent.meta?.name || id,
                        message: `Engine running. Monitoring ${agent.active_pairs || 0} pairs.`,
                        time: new Date(agent.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        color: agentColors[id] || '#888',
                    });
                }

                // Add zone discovery messages
                if (agent.total_zones_found > 0) {
                    messages.push({
                        agent: agent.meta?.name || id,
                        message: `Found ${agent.total_zones_found} trading zones. Analyzing for entry.`,
                        time: new Date(agent.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        color: agentColors[id] || '#888',
                    });
                }
            });
        }

        // Add static "flavor" messages
        messages.push(...waterCoolerTemplates.map(t => ({
            ...t,
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        })));

        return messages.slice(0, 8); // Limit to 8 messages
    }, [agents]);

    // Get status badge for agent
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE': return { text: '🟢 Active', class: styles.statusActive };
            case 'ONLINE': return { text: '🟣 Online', class: styles.statusOnline };
            case 'DISABLED': return { text: '🔴 Disabled', class: styles.statusDisabled };
            default: return { text: '⚪ Unknown', class: '' };
        }
    };

    return (
        <div className={styles.container}>
            {/* Background Elements */}
            <div className={styles.bgOverlay} />
            <div className={styles.bgFoliage} />

            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <Coffee size={28} className={styles.coffeeIcon} />
                    <h1 className={styles.title}>The Break Room</h1>
                    <span className={styles.subtitle}>Where the algorithms unwind</span>
                </div>
                <div className={styles.headerRight}>
                    <Link href="/agents" className={styles.backLink}>
                        ← Back to Agents
                    </Link>
                    <ThemeToggle theme={theme} onToggle={toggleTheme} />
                </div>
            </header>

            {/* Main Grid */}
            <div className={styles.mainGrid}>

                {/* Left Column: Employee of the Month */}
                <section className={styles.employeeSection}>
                    <div className={styles.sectionHeader}>
                        <Trophy size={20} />
                        <h2>Top Performer</h2>
                    </div>
                    <div className={styles.polaroidFrame}>
                        <div className={styles.polaroidImage}>
                            {employeeOfMonth.avatar ? (
                                <img src={employeeOfMonth.avatar} alt={employeeOfMonth.name} />
                            ) : (
                                <div className={styles.avatarPlaceholder} style={{ background: agentColors[employeeOfMonth.id] || '#888' }}>
                                    <span>{agentInitials[employeeOfMonth.id] || '?'}</span>
                                </div>
                            )}
                        </div>
                        <div className={styles.polaroidCaption}>
                            <span className={styles.employeeName}>{employeeOfMonth.name}</span>
                            <span className={styles.employeeStats}>
                                {employeeOfMonth.pnl > 0 ? `$${employeeOfMonth.pnl.toLocaleString()} PnL` : `${employeeOfMonth.zones || 0} zones found`}
                            </span>
                            <span className={styles.employeeWinRate}>
                                {employeeOfMonth.winRate > 0 ? `${employeeOfMonth.winRate}% Win Rate` : 'New trader 🌱'}
                            </span>
                        </div>
                        <div className={styles.stickyNote}>
                            <span>{employeeOfMonth.pnl > 0 ? '"Excellent discipline this week!"' : '"Keep grinding, results will come."'}</span>
                            <span className={styles.stickyAuthor}>- The Professor</span>
                        </div>
                    </div>
                </section>

                {/* Center Column: Leaderboard */}
                <section className={styles.leaderboardSection}>
                    <div className={styles.sectionHeader}>
                        <Star size={20} />
                        <h2>Agent Rankings</h2>
                    </div>
                    <div className={styles.leaderboardTable}>
                        <div className={styles.tableHeader}>
                            <span>Rank</span>
                            <span>Agent</span>
                            <span>Status</span>
                            <span>Zones</span>
                            <span>Win %</span>
                        </div>
                        {leaderboard.length > 0 ? leaderboard.map((agent, index) => (
                            <Link
                                href={`/agents?agent=${agent.id}`}
                                key={agent.id}
                                className={`${styles.tableRow} ${index === 0 ? styles.goldRow : ''} ${index === 1 ? styles.silverRow : ''} ${index === 2 ? styles.bronzeRow : ''}`}
                            >
                                <span className={styles.rank}>
                                    {index === 0 && '🥇'}
                                    {index === 1 && '🥈'}
                                    {index === 2 && '🥉'}
                                    {index > 2 && `#${index + 1}`}
                                </span>
                                <span className={styles.agentName}>
                                    <div className={styles.miniAvatar} style={{ background: agentColors[agent.id] || '#888' }}>
                                        {agent.avatar ? (
                                            <img src={agent.avatar} alt={agent.name} />
                                        ) : (
                                            <span>{agentInitials[agent.id] || agent.name.charAt(0)}</span>
                                        )}
                                    </div>
                                    {agent.name}
                                </span>
                                <span className={getStatusBadge(agent.status).class}>
                                    {agent.status === 'ACTIVE' ? '🟢' : agent.status === 'DISABLED' ? '🔴' : '⚪'}
                                </span>
                                <span className={styles.zones}>{agent.zones}</span>
                                <span className={styles.winRate}>{agent.winRate}%</span>
                            </Link>
                        )) : (
                            <div className={styles.noData}>No agents connected yet</div>
                        )}
                    </div>
                </section>

                {/* Right Column: Water Cooler */}
                <section className={styles.waterCoolerSection}>
                    <div className={styles.sectionHeader}>
                        <MessageCircle size={20} />
                        <h2>The Water Cooler</h2>
                        <span className={styles.liveIndicator}>● LIVE</span>
                    </div>
                    <div className={styles.waterCoolerFeed}>
                        {waterCoolerMessages.length > 0 ? waterCoolerMessages.map((msg, index) => (
                            <div key={index} className={styles.waterCoolerMessage}>
                                <div className={styles.messageHeader}>
                                    <span
                                        className={styles.messageSender}
                                        style={{ color: msg.color }}
                                    >
                                        {msg.agent}
                                    </span>
                                    <span className={styles.messageTime}>{msg.time}</span>
                                </div>
                                <p className={styles.messageText}>{msg.message}</p>
                            </div>
                        )) : (
                            <div className={styles.noData}>Agents are quiet... for now.</div>
                        )}
                    </div>
                </section>

            </div>

            {/* Bottom Section: Quick Stats */}
            <section className={styles.quickStatsSection}>
                <div className={styles.quickStat}>
                    <Zap size={24} />
                    <div>
                        <span className={styles.quickStatValue}>{leaderboard.filter(a => a.status === 'ACTIVE').length}</span>
                        <span className={styles.quickStatLabel}>Active Agents</span>
                    </div>
                </div>
                <div className={styles.quickStat}>
                    <Target size={24} />
                    <div>
                        <span className={styles.quickStatValue}>{leaderboard.reduce((sum, a) => sum + a.zones, 0)}</span>
                        <span className={styles.quickStatLabel}>Total Zones</span>
                    </div>
                </div>
                <div className={styles.quickStat}>
                    <Activity size={24} />
                    <div>
                        <span className={styles.quickStatValue}>{leaderboard.reduce((sum, a) => sum + a.trades, 0)}</span>
                        <span className={styles.quickStatLabel}>Trades Today</span>
                    </div>
                </div>
                <div className={styles.quickStat}>
                    <TrendingUp size={24} />
                    <div>
                        <span className={`${styles.quickStatValue} ${leaderboard.reduce((sum, a) => sum + a.pnl, 0) >= 0 ? styles.positive : styles.negative}`}>
                            ${leaderboard.reduce((sum, a) => sum + a.pnl, 0).toLocaleString()}
                        </span>
                        <span className={styles.quickStatLabel}>Total PnL</span>
                    </div>
                </div>
            </section>
        </div>
    );
}
