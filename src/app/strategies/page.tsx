"use client";

import React, { useState } from "react";
import { Check, Zap, LogOut, TrendingUp, TrendingDown, Filter, Shield } from "lucide-react";
import styles from "./Strategies.module.css";
import { useStrategy } from "@/context/StrategyContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import KillSwitchButton from "@/components/KillSwitch/KillSwitchButton";

// ── Agent roster ───────────────────────────────────────────────────────────────
const AGENTS = [
    { id: 'fx',        name: 'Sterling',      avatar: '/avatars/fx.png',        color: '#3b82f6' },
    { id: 'crypto',    name: 'Bitcoin Bob',   avatar: '/avatars/crypto.png',    color: '#f59e0b' },
    { id: 'spx',       name: 'SPX Sniper',    avatar: '/avatars/spx.png',       color: '#ef4444' },
    { id: 'futures',   name: 'Pivot Pete',    avatar: '/avatars/futures.png',   color: '#10b981' },
    { id: 'boba',      name: 'Boba',          avatar: '/avatars/boba.png',      color: '#a8906a' },
    { id: 'professor', name: 'The Professor', avatar: '/avatars/professor.png', color: '#6366f1' },
];

interface Strategy {
    id: string;
    name: string;
    description: string;
    icon: string;
    compatibleAgents: string[];
    activeAgents: string[];
    params?: Record<string, number | string>;
    category: 'ENTRY' | 'EXIT' | 'FILTER' | 'RISK';
}

const INITIAL_STRATEGIES: Strategy[] = [
    {
        id: 'supply_demand',
        name: 'Supply & Demand Zones',
        description: 'Identifies institutional order flow zones using price action structure.',
        icon: '📦',
        compatibleAgents: ['fx', 'crypto', 'futures', 'boba'],
        activeAgents: ['fx', 'crypto', 'futures'],
        category: 'ENTRY',
        params: { Freshness: 'Fresh Only', 'Min R:R': '2.0' }
    },
    {
        id: 'orb_breakout',
        name: 'ORB 15m Breakout',
        description: 'Trades the breakout of the first 15 minutes of the session.',
        icon: '🚀',
        compatibleAgents: ['spx', 'futures', 'boba'],
        activeAgents: ['futures', 'spx', 'boba'],
        category: 'ENTRY',
        params: { Duration: '15m', Threshold: '0.1%' }
    },
    {
        id: 'vwap_reversion',
        name: 'VWAP Mean Reversion',
        description: 'Trades price deviations from Volume Weighted Average Price.',
        icon: '📈',
        compatibleAgents: ['crypto', 'spx', 'futures'],
        activeAgents: ['crypto'],
        category: 'ENTRY',
        params: { Deviation: '1.5\u03c3' }
    },
    {
        id: 'pivot_rejection',
        name: 'Pivot Level Rejection',
        description: 'Trades rejections at calculated daily/weekly/monthly pivot points.',
        icon: '🔄',
        compatibleAgents: ['fx', 'futures', 'spx'],
        activeAgents: ['futures'],
        category: 'ENTRY',
        params: { Levels: 'R1 R2 S1 S2' }
    },
    {
        id: 'trailing_stop',
        name: 'Dynamic Trailing Stop',
        description: 'ATR-based trailing stop that adjusts with volatility to lock in profits.',
        icon: '🛡️',
        compatibleAgents: ['fx', 'crypto', 'spx', 'futures', 'boba'],
        activeAgents: ['fx', 'crypto', 'futures'],
        category: 'EXIT',
        params: { ATR: '1.5x', 'Min Profit': '1R' }
    },
    {
        id: 'time_exit',
        name: 'Time-Based Exit',
        description: 'Closes positions at specific times. Critical for 0DTE options.',
        icon: '⏰',
        compatibleAgents: ['spx', 'boba'],
        activeAgents: ['spx', 'boba'],
        category: 'EXIT',
        params: { Exit: '15:45 ET', Warning: '15:30 ET' }
    },
    {
        id: 'scale_out',
        name: 'Scale-Out Targets',
        description: 'Takes partial profits at 1R, 2R, and lets a runner go free.',
        icon: '🎯',
        compatibleAgents: ['fx', 'crypto', 'futures', 'boba'],
        activeAgents: ['boba'],
        category: 'EXIT',
        params: { T1: '1R (50%)', T2: '2R (30%)', Runner: '20%' }
    },
    {
        id: 'market_hours',
        name: 'Market Hours Filter',
        description: 'Only trades during optimal market hours. Avoids low-liquidity traps.',
        icon: '🕐',
        compatibleAgents: ['fx', 'spx', 'futures', 'boba'],
        activeAgents: ['fx', 'spx', 'futures'],
        category: 'FILTER',
        params: { Open: '9:30 ET', Close: '16:00 ET' }
    },
    {
        id: 'news_filter',
        name: 'High-Impact News Filter',
        description: 'Pauses trading before/after major economic events to avoid spikes.',
        icon: '📰',
        compatibleAgents: ['fx', 'crypto', 'spx', 'futures'],
        activeAgents: ['fx'],
        category: 'FILTER',
        params: { Before: '30m', After: '15m' }
    },
    {
        id: 'trend_filter',
        name: 'Multi-Timeframe Trend',
        description: 'Only takes trades aligned with the higher timeframe trend direction.',
        icon: '📊',
        compatibleAgents: ['fx', 'crypto', 'futures'],
        activeAgents: ['fx', 'crypto'],
        category: 'FILTER',
        params: { HTF: 'Daily', MTF: '4H', LTF: '1H' }
    },
    {
        id: 'position_sizing',
        name: 'Dynamic Position Sizing',
        description: 'Calculates position size based on account risk % and stop distance.',
        icon: '⚖️',
        compatibleAgents: ['fx', 'crypto', 'spx', 'futures', 'boba'],
        activeAgents: ['fx', 'crypto', 'futures', 'boba'],
        category: 'RISK',
        params: { Risk: '1%', 'Max Pos': '3' }
    },
    {
        id: 'daily_loss_limit',
        name: 'Daily Loss Limit',
        description: 'Halts all trading after hitting max daily drawdown to protect capital.',
        icon: '🛑',
        compatibleAgents: ['fx', 'crypto', 'spx', 'futures', 'boba'],
        activeAgents: ['spx', 'boba'],
        category: 'RISK',
        params: { 'Max Loss': '3%', Cooldown: '24h' }
    },
];

const CATEGORIES = {
    ENTRY:  { label: 'Entry',  longLabel: 'Entry Strategies', color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: TrendingUp,   desc: 'How we get in'    },
    EXIT:   { label: 'Exit',   longLabel: 'Exit Strategies',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: TrendingDown, desc: 'How we get out'   },
    FILTER: { label: 'Filter', longLabel: 'Trade Filters',    color: '#6366f1', bg: 'rgba(99,102,241,0.12)', icon: Filter,       desc: 'When to trade'    },
    RISK:   { label: 'Risk',   longLabel: 'Risk Management',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: Shield,       desc: 'How much to risk' },
} as const;

type CategoryKey = keyof typeof CATEGORIES;

export default function StrategiesPage() {
    const { theme } = useStrategy();
    const { logout } = useAuth();
    const router = useRouter();
    const [strategies, setStrategies] = useState(INITIAL_STRATEGIES);
    const [activeCategory, setActiveCategory] = useState<CategoryKey | null>('ENTRY');

    const toggleAgentForStrategy = (strategyId: string, agentId: string) => {
        setStrategies(prev => prev.map(s => {
            if (s.id !== strategyId) return s;
            const isActive = s.activeAgents.includes(agentId);
            return {
                ...s,
                activeAgents: isActive
                    ? s.activeAgents.filter(a => a !== agentId)
                    : [...s.activeAgents, agentId],
            };
        }));
    };

    const filteredStrategies = activeCategory
        ? strategies.filter(s => s.category === activeCategory)
        : strategies;

    return (
        <div className={styles.container}>
            {/* ── Page Header ─────────────────────────────────────────── */}
            <header className={styles.header}>
                <div className={styles.headerTop}>
                    <div>
                        <h1 className={styles.title}>Strategy Arsenal</h1>
                        <p className={styles.subtitle}>Configure operational directives for your autonomous fleet</p>
                    </div>
                    <div className={styles.headerActions}>
                        <KillSwitchButton />
                        <button
                            onClick={async () => { await logout(); router.push('/login'); }}
                            className={styles.signOutBtn}
                            title="Sign Out"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>

                {/* ── Category tab bar ── */}
                <div className={styles.tabBar}>
                    <button
                        className={`${styles.tab} ${activeCategory === null ? styles.tabAllActive : ''}`}
                        onClick={() => setActiveCategory(null)}
                    >
                        <Zap size={13} />
                        <span>All</span>
                        <span className={styles.tabCount}>{strategies.length}</span>
                    </button>

                    {(Object.entries(CATEGORIES) as [CategoryKey, typeof CATEGORIES[CategoryKey]][]).map(([key, cat]) => {
                        const CatIcon = cat.icon;
                        const isActive = activeCategory === key;
                        return (
                            <button
                                key={key}
                                className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
                                onClick={() => setActiveCategory(isActive ? null : key)}
                                style={{ '--cat-color': cat.color } as React.CSSProperties}
                            >
                                <CatIcon size={13} />
                                <span>{cat.label}</span>
                                <span
                                    className={styles.tabCount}
                                    style={isActive ? { background: cat.color, color: '#000', fontWeight: 700 } : {}}
                                >
                                    {strategies.filter(s => s.category === key).length}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </header>

            {/* ── Category context strip ───────────────────────────────── */}
            {activeCategory && (() => {
                const cat = CATEGORIES[activeCategory];
                const CatIcon = cat.icon;
                const active = strategies.filter(s => s.category === activeCategory && s.activeAgents.length > 0).length;
                const total  = strategies.filter(s => s.category === activeCategory).length;
                return (
                    <div className={styles.catStrip} style={{ '--cat-color': cat.color, '--cat-bg': cat.bg } as React.CSSProperties}>
                        <div className={styles.catStripLeft}>
                            <div className={styles.catStripIcon}><CatIcon size={18} /></div>
                            <div>
                                <div className={styles.catStripTitle}>{cat.longLabel}</div>
                                <div className={styles.catStripDesc}>{cat.desc}</div>
                            </div>
                        </div>
                        <div className={styles.catStripStats}>
                            <div className={styles.catStat}>
                                <span className={styles.catStatVal} style={{ color: cat.color }}>{active}</span>
                                <span className={styles.catStatLabel}>active</span>
                            </div>
                            <div className={styles.catStatDivider} />
                            <div className={styles.catStat}>
                                <span className={styles.catStatVal}>{total}</span>
                                <span className={styles.catStatLabel}>total</span>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── Strategy cards grid ──────────────────────────────────── */}
            <div className={styles.grid}>
                {filteredStrategies.map(strat => {
                    const cat = CATEGORIES[strat.category];
                    const CatIcon = cat.icon;
                    const activeCount = strat.activeAgents.length;
                    const totalCount  = strat.compatibleAgents.length;

                    return (
                        <div
                            key={strat.id}
                            className={styles.card}
                            style={{ '--cat-color': cat.color } as React.CSSProperties}
                        >
                            {/* Colored left accent */}
                            <div className={styles.cardAccent} style={{ background: cat.color }} />

                            <div className={styles.cardBody}>
                                {/* Top section: icon + name + badge */}
                                <div className={styles.cardTop}>
                                    <span className={styles.cardEmoji}>{strat.icon}</span>
                                    <div className={styles.cardInfo}>
                                        <div className={styles.cardTitleRow}>
                                            <h3 className={styles.cardTitle}>{strat.name}</h3>
                                            <span
                                                className={styles.catBadge}
                                                style={{ color: cat.color, background: cat.bg, borderColor: `${cat.color}33` }}
                                            >
                                                <CatIcon size={9} />
                                                {cat.label.toUpperCase()}
                                            </span>
                                        </div>
                                        <p className={styles.cardDesc}>{strat.description}</p>
                                    </div>
                                </div>

                                {/* Params */}
                                {strat.params && Object.keys(strat.params).length > 0 && (
                                    <div className={styles.params}>
                                        {Object.entries(strat.params).map(([k, v]) => (
                                            <div key={k} className={styles.param}>
                                                <span className={styles.paramKey}>{k}</span>
                                                <span className={styles.paramVal}>{String(v)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Divider */}
                                <div className={styles.sep} />

                                {/* Agent assignment */}
                                <div className={styles.agentSection}>
                                    <div className={styles.agentHeader}>
                                        <span className={styles.agentLabel}>ASSIGNED AGENTS</span>
                                        <span
                                            className={styles.agentCountBadge}
                                            style={activeCount > 0 ? { color: cat.color } : {}}
                                        >
                                            {activeCount}<span style={{ opacity: 0.35 }}>/{totalCount}</span>
                                        </span>
                                    </div>

                                    <div className={styles.agentList}>
                                        {strat.compatibleAgents.map(agentId => {
                                            const agent = AGENTS.find(a => a.id === agentId);
                                            const isActive = strat.activeAgents.includes(agentId);
                                            return (
                                                <button
                                                    key={agentId}
                                                    className={`${styles.agentBtn} ${isActive ? styles.agentBtnOn : styles.agentBtnOff}`}
                                                    onClick={() => toggleAgentForStrategy(strat.id, agentId)}
                                                    style={isActive ? {
                                                        borderColor: `${agent?.color}50`,
                                                        background: `${agent?.color}15`,
                                                    } : {}}
                                                    title={isActive ? `Remove ${agent?.name}` : `Add ${agent?.name}`}
                                                >
                                                    {/* Avatar + dot */}
                                                    <div className={styles.agentAvatarWrap}>
                                                        <img
                                                            src={agent?.avatar}
                                                            alt={agent?.name ?? ''}
                                                            className={styles.agentAvatar}
                                                            onError={e => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${agent?.name}&background=random&size=32`)}
                                                        />
                                                        <span
                                                            className={styles.agentDot}
                                                            style={{ background: isActive ? (agent?.color ?? '#10b981') : 'rgba(255,255,255,0.15)' }}
                                                        />
                                                    </div>
                                                    <span className={`${styles.agentName} ${isActive ? styles.agentNameOn : ''}`}>
                                                        {agent?.name}
                                                    </span>
                                                    {isActive && (
                                                        <Check size={10} strokeWidth={3} style={{ color: agent?.color, marginLeft: 'auto', flexShrink: 0 }} />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
