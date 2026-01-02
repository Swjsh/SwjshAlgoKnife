"use client";

import React, { useState, useEffect } from "react";
import { Check, LogOut } from "lucide-react";
import styles from "./Strategies.module.css";
import { useStrategy } from "@/context/StrategyContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/UI/ThemeToggle";
import KillSwitchButton from "@/components/KillSwitch/KillSwitchButton";

// Agent definitions with their default strategies
const AGENTS = [
    { id: 'fx', name: 'Swjsh FX', avatar: '/avatars/fx.png', color: '#3b82f6' },
    { id: 'crypto', name: 'Bitcoin Bob', avatar: '/avatars/crypto.png', color: '#f59e0b' },
    { id: 'spx', name: 'SPX Sniper', avatar: '/avatars/spx.png', color: '#ef4444' },
    { id: 'futures', name: 'Pivot Pete', avatar: '/avatars/futures.png', color: '#10b981' },
    { id: 'boba', name: 'Boba', avatar: '/avatars/boba.png', color: '#a8906a' },
    { id: 'professor', name: 'The Professor', avatar: '/avatars/professor.png', color: '#6366f1' },
    { id: 'auditor', name: 'The Auditor', avatar: '/avatars/auditor.png', color: '#64748b' },
];

interface Strategy {
    id: string;
    name: string;
    description: string;
    icon: string;
    compatibleAgents: string[]; // Which agents CAN use this strategy
    activeAgents: string[];     // Which agents currently HAVE it enabled
    params?: Record<string, number | string>;
    category: 'ENTRY' | 'EXIT' | 'FILTER' | 'RISK';
}

const INITIAL_STRATEGIES: Strategy[] = [
    // === ENTRY STRATEGIES ===
    {
        id: 'supply_demand',
        name: 'Supply & Demand Zones',
        description: 'Identifies institutional order flow zones using price action structure. Core "Set & Forget" logic.',
        icon: '📦',
        compatibleAgents: ['fx', 'crypto', 'futures', 'boba'],
        activeAgents: ['fx', 'crypto', 'futures'],
        category: 'ENTRY',
        params: { freshness: 'Fresh Only', minRR: 2.0 }
    },
    {
        id: 'orb_breakout',
        name: 'ORB 15m Breakout',
        description: 'Trades the breakout of the first 15 minutes of the session. Best for indices.',
        icon: '🚀',
        compatibleAgents: ['spx', 'futures', 'boba'],
        activeAgents: ['futures'],
        category: 'ENTRY',
        params: { duration: 15, threshold: 0.1 }
    },
    {
        id: 'vwap_reversion',
        name: 'VWAP Mean Reversion',
        description: 'Trades price deviations from Volume Weighted Average Price. Good for ranging markets.',
        icon: '📈',
        compatibleAgents: ['crypto', 'spx', 'futures'],
        activeAgents: ['crypto'],
        category: 'ENTRY',
        params: { deviation: 1.5 }
    },
    {
        id: 'pivot_rejection',
        name: 'Pivot Level Rejection',
        description: 'Trades rejections at calculated daily/weekly/monthly pivot points.',
        icon: '🔄',
        compatibleAgents: ['fx', 'futures', 'spx'],
        activeAgents: ['futures'],
        category: 'ENTRY',
        params: { levels: 'R1, R2, S1, S2' }
    },
    // === EXIT STRATEGIES ===
    {
        id: 'trailing_stop',
        name: 'Dynamic Trailing Stop',
        description: 'ATR-based trailing stop that adjusts with volatility. Locks in profits.',
        icon: '🛡️',
        compatibleAgents: ['fx', 'crypto', 'spx', 'futures', 'boba'],
        activeAgents: ['fx', 'crypto', 'futures'],
        category: 'EXIT',
        params: { atrMultiplier: 1.5, minProfit: '1R' }
    },
    {
        id: 'time_exit',
        name: 'Time-Based Exit',
        description: 'Closes positions at specific times. Critical for 0DTE options.',
        icon: '⏰',
        compatibleAgents: ['spx', 'boba'],
        activeAgents: ['spx', 'boba'],
        category: 'EXIT',
        params: { exitTime: '15:45', warning: '15:30' }
    },
    {
        id: 'scale_out',
        name: 'Scale-Out Targets',
        description: 'Takes partial profits at 1R, 2R, and lets runner fly. Reduces risk.',
        icon: '🎯',
        compatibleAgents: ['fx', 'crypto', 'futures', 'boba'],
        activeAgents: ['boba'],
        category: 'EXIT',
        params: { target1: '1R (50%)', target2: '2R (30%)', runner: '20%' }
    },
    // === FILTER STRATEGIES ===
    {
        id: 'market_hours',
        name: 'Market Hours Filter',
        description: 'Only trades during optimal market hours. Avoids low-liquidity traps.',
        icon: '🕐',
        compatibleAgents: ['fx', 'spx', 'futures', 'boba'],
        activeAgents: ['fx', 'spx', 'futures'],
        category: 'FILTER',
        params: { start: '9:30', end: '16:00', timezone: 'EST' }
    },
    {
        id: 'news_filter',
        name: 'High-Impact News Filter',
        description: 'Pauses trading before/after major economic events. Protects from spikes.',
        icon: '📰',
        compatibleAgents: ['fx', 'crypto', 'spx', 'futures'],
        activeAgents: ['fx'],
        category: 'FILTER',
        params: { pauseBefore: '30min', pauseAfter: '15min' }
    },
    {
        id: 'trend_filter',
        name: 'Multi-Timeframe Trend',
        description: 'Only takes trades aligned with higher timeframe trend. Filters counter-trend.',
        icon: '📊',
        compatibleAgents: ['fx', 'crypto', 'futures'],
        activeAgents: ['fx', 'crypto'],
        category: 'FILTER',
        params: { htf: 'Daily', mtf: '4H', ltf: '1H' }
    },
    // === RISK STRATEGIES ===
    {
        id: 'position_sizing',
        name: 'Dynamic Position Sizing',
        description: 'Calculates position size based on account risk % and stop distance.',
        icon: '⚖️',
        compatibleAgents: ['fx', 'crypto', 'spx', 'futures', 'boba'],
        activeAgents: ['fx', 'crypto', 'futures', 'boba'],
        category: 'RISK',
        params: { riskPercent: '1%', maxPositions: 3 }
    },
    {
        id: 'daily_loss_limit',
        name: 'Daily Loss Limit',
        description: 'Stops trading after hitting max daily drawdown. Protects capital.',
        icon: '🛑',
        compatibleAgents: ['fx', 'crypto', 'spx', 'futures', 'boba'],
        activeAgents: ['spx', 'boba'],
        category: 'RISK',
        params: { maxLoss: '3%', cooldown: '24h' }
    },
];

const CATEGORY_INFO = {
    'ENTRY': { label: 'Entry Strategies', color: '#10b981', description: 'How we get in' },
    'EXIT': { label: 'Exit Strategies', color: '#f59e0b', description: 'How we get out' },
    'FILTER': { label: 'Filters', color: '#6366f1', description: 'When to trade' },
    'RISK': { label: 'Risk Management', color: '#ef4444', description: 'How much to risk' },
};

export default function StrategiesPage() {
    const { theme, toggleTheme } = useStrategy();
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const [strategies, setStrategies] = useState(INITIAL_STRATEGIES);
    // Default to 'ENTRY' category
    const [activeCategory, setActiveCategory] = useState<string | null>('ENTRY');

    // Protect route - redirect to login if not authenticated
    useEffect(() => {
        if (!loading && !user) {
            router.replace('/login');
        }
    }, [user, loading, router]);

    // Show loading while checking auth - but don't block render entirely
    // This prevents the blank page issue while still protecting the route

    // Toggle agent for a strategy
    const toggleAgentForStrategy = (strategyId: string, agentId: string) => {
        setStrategies(strategies.map(s => {
            if (s.id !== strategyId) return s;
            const isActive = s.activeAgents.includes(agentId);
            return {
                ...s,
                activeAgents: isActive
                    ? s.activeAgents.filter(a => a !== agentId)
                    : [...s.activeAgents, agentId]
            };
        }));
    };

    // Filter strategies by category
    const filteredStrategies = activeCategory
        ? strategies.filter(s => s.category === activeCategory)
        : strategies;

    // Group by category for display (or just list if filtered)
    // If activeCategory is set, we only show that category. If 'All', we show all groups.
    const strategiesToDisplay = activeCategory
        ? { [activeCategory]: filteredStrategies }
        : filteredStrategies.reduce((acc, strat) => {
            if (!acc[strat.category]) acc[strat.category] = [];
            acc[strat.category].push(strat);
            return acc;
        }, {} as Record<string, Strategy[]>);

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.headerText}>
                        <h1 className={styles.title}>Strategy Arsenal</h1>
                        <p className={styles.subtitle}>
                            Configure operational directives for your autonomous fleet.
                        </p>
                    </div>
                    <div className={styles.headerActions}>
                        <KillSwitchButton />
                        <ThemeToggle theme={theme} onToggle={toggleTheme} />
                        <button
                            onClick={async () => {
                                await logout();
                                router.push('/login');
                            }}
                            title="Sign Out"
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                padding: '0.5rem',
                                color: 'rgba(255,255,255,0.7)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                                marginLeft: '0.5rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                e.currentTarget.style.color = '#ef4444';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                            }}
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>

                {/* Category Filter Pills */}
                <div className={styles.categoryPills}>
                    <button
                        className={`${styles.categoryPill} ${!activeCategory ? styles.categoryPillActive : ''}`}
                        onClick={() => setActiveCategory(null)}
                    >
                        All Strategies
                    </button>
                    {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                        <button
                            key={key}
                            className={`${styles.categoryPill} ${activeCategory === key ? styles.categoryPillActive : ''}`}
                            onClick={() => setActiveCategory(activeCategory === key ? null : key)}
                            style={{ '--pill-color': info.color } as React.CSSProperties}
                        >
                            {info.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* Strategy Grid */}
            <div className={styles.strategyGrid}>
                {Object.entries(strategiesToDisplay).map(([category, strats]) => (
                    <div key={category} className={styles.categorySection}>
                        {!activeCategory && (
                            <div className={styles.categorySectionHeader}>
                                <span
                                    className={styles.categoryDot}
                                    style={{ background: CATEGORY_INFO[category as keyof typeof CATEGORY_INFO].color }}
                                />
                                <h2 className={styles.categorySectionTitle}>
                                    {CATEGORY_INFO[category as keyof typeof CATEGORY_INFO].label}
                                </h2>
                                <span className={styles.categorySectionCount}>{strats.length}</span>
                            </div>
                        )}

                        <div className={styles.strategyCards}>
                            {strats.map((strat) => (
                                <div key={strat.id} className={styles.strategyCard}>
                                    {/* Card Header */}
                                    <div className={styles.cardHeader}>
                                        <div className={styles.cardIcon}>{strat.icon}</div>
                                        <div className={styles.cardInfo}>
                                            <h3 className={styles.cardTitle}>{strat.name}</h3>
                                            <p className={styles.cardDesc}>{strat.description}</p>
                                        </div>
                                    </div>

                                    {/* Active Agents List - Always Visible */}
                                    <div className={styles.cardBody}>
                                        <div className={styles.agentListLabel}>Active Assignments</div>
                                        <div className={styles.agentToggles}>
                                            {strat.compatibleAgents.map(agentId => {
                                                const agent = AGENTS.find(a => a.id === agentId);
                                                const isActive = strat.activeAgents.includes(agentId);
                                                return (
                                                    <button
                                                        key={agentId}
                                                        className={`${styles.agentToggle} ${isActive ? styles.agentToggleActive : ''}`}
                                                        onClick={() => toggleAgentForStrategy(strat.id, agentId)}
                                                        style={{ '--agent-color': agent?.color } as React.CSSProperties}
                                                    >
                                                        <div className={styles.agentAvatarWrapper}>
                                                            <img
                                                                src={agent?.avatar}
                                                                alt={agent?.name}
                                                                className={styles.agentAvatarImg}
                                                                onError={(e) => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${agent?.name}&background=random`)}
                                                            />
                                                            {isActive && (
                                                                <div className={styles.activeCheck}>
                                                                    <Check size={10} strokeWidth={4} />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className={styles.agentToggleName}>{agent?.name}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
