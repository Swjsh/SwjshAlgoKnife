'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    Activity, RefreshCw, ChevronRight, Terminal, Cpu, Zap, Clock, Bot,
    TrendingUp, BarChart2, Shield, Award, Play, Pause, Square
} from 'lucide-react';
import EconCalendar from '@/components/Intelligence/EconCalendar';
import { ErrorBoundary } from '@/components/UI/ErrorBoundary';

// ── Agent Definitions ─────────────────────────────────────────────────────────
const TRADING_AGENTS = [
    {
        id: 'sterling',      dbKey: 'fx',
        name: 'Sterling',    emoji: '🦅',
        role: 'Forex Specialist',  category: 'FOREX',
        broker: 'OANDA Practice',
        assets: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD'],
        strategy: 'Three Ducks + S&D Zones',
        sessionWindows: ['London', 'New York'],
        rTarget: '3:1', riskPct: 1, color: '#06b6d4', pm2: 'AK-Sterling',
        description: 'Multi-timeframe forex swing trader. Top-down analysis from Weekly to 15m. Hunts fresh S&D zones at London/NY overlap for 3:1+ setups.',
    },
    {
        id: 'bitcoin_bob',   dbKey: 'crypto',
        name: 'Bitcoin Bob', emoji: '₿',
        role: 'Crypto Trader',     category: 'CRYPTO',
        broker: 'Alpaca Paper',
        assets: ['BTC/USD', 'ETH/USD', 'SOL/USD'],
        strategy: 'S&D Zone Breakout',
        sessionWindows: ['24/7'],
        rTarget: '2:1', riskPct: 1, color: '#f59e0b', pm2: 'AK-BitcoinBob',
        description: 'Crypto-native S&D zone trader. Monitors BTC, ETH, SOL for high-probability breakouts from historical volume nodes. 24/7 operation.',
    },
    {
        id: 'pivot_pete',    dbKey: 'futures',
        name: 'Pivot Pete',  emoji: '📐',
        role: 'Futures Trader',    category: 'FUTURES',
        broker: 'Alpaca Paper (SPY proxy)',
        assets: ['ES (SPY)', 'NQ (QQQ)', 'RTY', 'YM'],
        strategy: 'ORB + NeverStoppedOut',
        sessionWindows: ['New York'],
        rTarget: '3:1', riskPct: 1, color: '#a855f7', pm2: 'AK-PivotPete',
        description: 'Opening Range Breakout specialist. Tracks first 15m of NYSE session. NeverStoppedOut variant for wide-range days. Pivot level rejection entries.',
    },
    {
        id: 'boba',          dbKey: 'boba',
        name: 'Boba',        emoji: '🧋',
        role: 'Options Trader',    category: 'OPTIONS',
        broker: 'Alpaca Paper',
        assets: ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA'],
        strategy: 'VWAP + Bollinger Bands',
        sessionWindows: ['New York (9:30–11:00)'],
        rTarget: '2:1', riskPct: 1, color: '#ec4899', pm2: 'AK-Boba',
        description: 'Options flow trader detecting VWAP breaks and BB squeezes. Scans supply & demand zones every 15m. Early-session entry gate for optimal premium.',
    },
    {
        id: 'spx_sniper',    dbKey: 'spx',
        name: 'SPX Sniper',  emoji: '🎯',
        role: 'SPX 0DTE Specialist', category: 'OPTIONS',
        broker: 'Alpaca Paper',
        assets: ['SPX', 'SPY', '0DTE'],
        strategy: 'Opening Range + Delta Scalp',
        sessionWindows: ['New York (10:30–15:50)'],
        rTarget: '4:1', riskPct: 0.5, color: '#ef4444', pm2: 'AK-SPXSniper',
        description: 'Precision SPX 0DTE scalper. VWAP cross + EMA9 + RSI momentum confluence. Hard time gate 10:30–15:50 ET. Targets 4:1 R on same-day expiry options.',
    },
];

const SYSTEM_AGENTS = [
    {
        id: 'professor', dbKey: 'professor',
        name: 'The Professor', emoji: '🎓',
        role: 'Trade Analyst & Grader', color: '#10b981',
        description: 'Reviews every closed trade and delivers structured A–F grades with critique on entry quality, risk management, and execution discipline.',
        duties: ['Grade trades A–F', 'Identify strategy violations', 'Generate improvement notes', 'Weekly performance reports'],
    },
    {
        id: 'overseer', dbKey: 'overseer',
        name: 'Overseer', emoji: '🛡️',
        role: 'Risk Manager & Kill Switch', color: '#6366f1',
        description: 'Monitors all agent activity for drawdown, correlation risk, and kill-switch conditions. Automatically pauses the fleet when limits are breached.',
        duties: ['Monitor daily drawdown', 'Enforce max position limits', 'Trigger kill switch', 'Correlation risk watch'],
    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
    if (!iso) return 'never';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

function getSessionsNow() {
    const now = new Date();
    const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
    return {
        london: utcMins >= 480 && utcMins < 1020,
        newYork: utcMins >= 780 && utcMins < 1320,
        crypto: true,
    };
}

// ── Activity line: plain-English "what is this bot doing right now" ───────────
function getActivityLine(agent: typeof TRADING_AGENTS[0], d: Record<string, any>, sessions: ReturnType<typeof getSessionsNow>) {
    const status = (d.status ?? 'OFFLINE').toUpperCase();
    const openPos = d.active_trades?.length ?? 0;
    const lastSig = d.last_signal;

    if (status === 'OFFLINE') return { text: 'Not running — start the engine to activate', warn: true };

    const inSession = agent.sessionWindows.includes('24/7') ||
        (agent.sessionWindows.some((s: string) => s.includes('London')) && sessions.london) ||
        (agent.sessionWindows.some((s: string) => s.includes('New York')) && sessions.newYork);

    if (openPos > 0) return { text: `Managing ${openPos} open position${openPos > 1 ? 's' : ''} — monitoring for exit signals`, hot: true };
    if (!inSession) {
        const next = agent.sessionWindows.find((s: string) => s !== '24/7');
        return { text: `Waiting for ${next ?? 'next session'} to open`, warn: false };
    }
    if (lastSig) return { text: `Last signal: ${lastSig}`, active: true };
    if (status === 'ACTIVE') return { text: `Live scanning ${agent.assets.slice(0, 2).join(' & ')} for ${agent.strategy.split(' + ')[0]} setups`, active: true };
    return { text: `Idle — session is open but no active scan running`, warn: false };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AgentsPage() {
    const [agentData, setAgentData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [controlLoading, setControlLoading] = useState<Record<string, string>>({});
    const sessions = getSessionsNow();

    const fetchData = useCallback(async () => {
        try {
            const r = await fetch('/api/agents');
            if (r.ok) {
                const json = await r.json();
                setAgentData(json.agents || {});
            }
        } catch {}
        finally { setLoading(false); setLastSync(new Date()); }
    }, []);

    const controlAgent = useCallback(async (dbKey: string, action: 'start' | 'pause' | 'stop') => {
        setControlLoading(prev => ({ ...prev, [`${dbKey}-${action}`]: 'loading' }));
        try {
            const r = await fetch(`/api/agents/${dbKey}/${action}`, { method: 'POST' });
            if (r.ok) {
                setControlLoading(prev => ({ ...prev, [`${dbKey}-${action}`]: 'success' }));
                setTimeout(() => {
                    setControlLoading(prev => {
                        const updated = { ...prev };
                        delete updated[`${dbKey}-${action}`];
                        return updated;
                    });
                }, 500);
                await fetchData();
            }
        } catch (err) {
            setControlLoading(prev => {
                const updated = { ...prev };
                delete updated[`${dbKey}-${action}`];
                return updated;
            });
        }
    }, [fetchData]);

    useEffect(() => {
        fetchData();
        const t = setInterval(fetchData, 15_000);
        return () => clearInterval(t);
    }, [fetchData]);

    // Fleet-level stats (trading agents only)
    const activeCount = TRADING_AGENTS.filter(a => {
        const d = agentData[a.dbKey];
        return d?.status === 'ACTIVE' || d?.status === 'active';
    }).length;

    const totalPnl = TRADING_AGENTS.reduce((s, a) => s + (agentData[a.dbKey]?.performance?.total_pnl ?? 0), 0);
    const totalTrades = TRADING_AGENTS.reduce((s, a) => s + (agentData[a.dbKey]?.performance?.trades ?? 0), 0);

    const openTrades = TRADING_AGENTS.reduce((s, a) => {
        const d = agentData[a.dbKey];
        return s + (d?.active_trades?.length ?? 0);
    }, 0);

    const P: React.CSSProperties = { minHeight: '100vh', background: 'hsl(222 47% 11%)', color: 'white', padding: '24px 28px' };

    return (
        <div style={P}>
            <style>{`
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
                @keyframes heartbeat { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.4);opacity:0.5} }
                .ak-card { transition: border-color 0.18s, transform 0.18s; }
                .ak-card:hover { transform: translateY(-2px); }
                .ak-expand-btn { transition: background 0.15s; }
                .ak-expand-btn:hover { background: rgba(255,255,255,0.08) !important; }
                .ak-control-btn { transition: all 0.12s; }
                .ak-control-btn:hover { transform: scale(1.08); }
                .ak-control-btn:active { transform: scale(0.95); }
            `}</style>

            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Bot size={24} style={{ color: '#06b6d4' }} /> AGENT FLEET
                    </h1>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '6px 0 0', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
                        5 TRADING BOTS · 2 SYSTEM COMPONENTS · PAPER MODE
                        {lastSync && <span style={{ marginLeft: 12, color: 'rgba(255,255,255,0.22)' }}>synced {timeAgo(lastSync.toISOString())}</span>}
                    </p>
                </div>
                <button onClick={fetchData} aria-label="Refresh agent data" style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
                    background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)',
                    color: '#06b6d4', cursor: 'pointer', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em'
                }}>
                    <RefreshCw size={13} /> REFRESH
                </button>
            </div>

            {/* ── Fleet KPIs ── */}
            <div role="status" aria-live="polite" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 30 }}>
                {[
                    { label: 'Agents Active', value: `${activeCount} / ${TRADING_AGENTS.length}`,
                      color: activeCount > 0 ? '#10b981' : 'rgba(255,255,255,0.3)', sub: 'trading bots online' },
                    { label: 'Fleet P&L', value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`,
                      color: totalPnl >= 0 ? '#10b981' : '#ef4444', sub: 'paper trading gains' },
                    { label: 'Total Trades', value: `${totalTrades}`,
                      color: '#a855f7', sub: 'paper trades executed' },
                    { label: 'Open Positions', value: `${openTrades}`,
                      color: openTrades > 0 ? '#06b6d4' : 'rgba(255,255,255,0.3)', sub: 'live right now' },
                ].map(k => (
                    <div key={k.label} style={{ padding: '16px 18px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                            {k.label}
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'monospace', color: k.color }}>
                            {k.value}
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 3 }}>{k.sub}</div>
                    </div>
                ))}
            </div>

            {/* ── Market Intelligence: Economic Calendar ── */}
            <div style={{ marginBottom: 32 }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
                    paddingBottom: 8, borderBottom: '1px solid rgba(249,115,22,0.15)',
                }}>
                    <span style={{ fontSize: 10, color: '#f97316', letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase' }}>
                        📅 Market Intelligence
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em' }}>
                        — Economic events your agents trade around
                    </span>
                </div>
                <EconCalendar />
            </div>

            {/* ── Section Label: Trading Bots ── */}
            <SectionLabel icon={<Activity size={13} style={{ color: '#06b6d4' }} />} label="Trading Bots" />

            {/* ── Trading Agent Cards ── */}
            <ErrorBoundary>
                {loading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 32 }}>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} style={{
                                borderRadius: 14, overflow: 'hidden',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                height: 400,
                                animation: 'pulse 2s infinite',
                            }} />
                        ))}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 32 }}>
                        {TRADING_AGENTS.map(agent => {
                    const d = agentData[agent.dbKey] ?? {};
                    const status = (d.status ?? 'OFFLINE').toUpperCase();
                    const isActive = status === 'ACTIVE';
                    const isIdle = status === 'IDLE';

                    const pnl = d.performance?.total_pnl ?? 0;
                    const trades = d.performance?.trades ?? 0;
                    const winRate = d.performance?.win_rate ?? 0;
                    const openPos = d.active_trades?.length ?? 0;
                    const lastUpdate = d.last_updated;

                    const dotColor = isActive ? '#10b981' : isIdle ? '#f59e0b' : 'rgba(255,255,255,0.18)';
                    const statusLabel = isActive ? 'LIVE' : isIdle ? 'IDLE' : 'OFFLINE';
                    const isExpanded = expanded === agent.id;

                    const activity = getActivityLine(agent, d, sessions);
                    const inSession = agent.sessionWindows.includes('24/7') ||
                        (agent.sessionWindows.some(s => s.includes('London')) && sessions.london) ||
                        (agent.sessionWindows.some(s => s.includes('New York')) && sessions.newYork);

                    // Status header colours
                    const headerBg = isActive
                        ? `linear-gradient(90deg, ${agent.color}22, ${agent.color}08)`
                        : isIdle
                        ? 'linear-gradient(90deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))'
                        : 'linear-gradient(90deg, rgba(255,255,255,0.04), transparent)';

                    return (
                        <div key={agent.id} className="ak-card" style={{
                            borderRadius: 14, overflow: 'hidden',
                            background: 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isActive ? agent.color + '40' : isIdle ? 'rgba(245,158,11,0.22)' : 'rgba(255,255,255,0.08)'}`,
                        }}>
                            {/* ── STATUS HEADER ─────────────────────────────── */}
                            <div style={{
                                background: headerBg,
                                borderBottom: `1px solid ${isActive ? agent.color + '25' : 'rgba(255,255,255,0.06)'}`,
                                padding: '10px 16px',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}>
                                {/* Left: dot + status word + bot name */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ position: 'relative', width: 10, height: 10 }}>
                                        <div style={{
                                            width: 10, height: 10, borderRadius: '50%',
                                            background: dotColor,
                                            boxShadow: isActive ? `0 0 8px ${dotColor}` : 'none',
                                            animation: isActive ? 'heartbeat 0.8s infinite' : 'none',
                                        }} />
                                    </div>
                                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                                        letterSpacing: '0.1em', color: dotColor }}>{statusLabel}</span>
                                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em' }}>·</span>
                                    <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.03em' }}>
                                        {agent.emoji} {agent.name}
                                    </span>
                                </div>
                                {/* Right: category + controls */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                                        letterSpacing: '0.08em', background: `${agent.color}18`,
                                        color: agent.color, border: `1px solid ${agent.color}30` }}>
                                        {agent.category}
                                    </div>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        {(['start','pause','stop'] as const).map(action => (
                                            <button key={action} className="ak-control-btn"
                                                aria-label={`${action} ${agent.name}`}
                                                onClick={() => controlAgent(agent.dbKey, action)}
                                                disabled={controlLoading[`${agent.dbKey}-${action}`] === 'loading'}
                                                style={{ width: 24, height: 24, borderRadius: 5, border: 'none', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    opacity: controlLoading[`${agent.dbKey}-${action}`] === 'loading' ? 0.5 : 1,
                                                    background: action === 'start' ? (isActive ? 'rgba(16,185,129,0.22)' : 'rgba(16,185,129,0.1)')
                                                              : action === 'pause' ? (isIdle ? 'rgba(245,158,11,0.22)' : 'rgba(245,158,11,0.1)')
                                                              : 'rgba(239,68,68,0.1)' }}>
                                                {action === 'start' && <Play  size={11} color={isActive ? '#10b981' : 'rgba(255,255,255,0.4)'} fill={isActive ? '#10b981' : 'rgba(255,255,255,0.2)'} />}
                                                {action === 'pause' && <Pause size={11} color={isIdle  ? '#f59e0b' : 'rgba(255,255,255,0.4)'} fill={isIdle  ? '#f59e0b' : 'rgba(255,255,255,0.2)'} />}
                                                {action === 'stop'  && <Square size={11} color="rgba(239,68,68,0.7)" fill="rgba(239,68,68,0.2)" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div style={{ padding: '14px 16px' }}>
                                {/* ── WHAT IT DOES (always visible) ──────────── */}
                                <p style={{ margin: '0 0 10px', fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65 }}>
                                    {agent.description}
                                </p>

                                {/* ── NOW: what's happening right now ─────────── */}
                                <div style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', borderRadius: 8,
                                    marginBottom: 14,
                                    background: (activity as any).hot
                                        ? 'rgba(6,182,212,0.08)' : (activity as any).active
                                        ? `${agent.color}0d` : (activity as any).warn
                                        ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${(activity as any).hot
                                        ? 'rgba(6,182,212,0.22)' : (activity as any).active
                                        ? `${agent.color}28` : (activity as any).warn
                                        ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.07)'}`,
                                }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', marginTop: 1, whiteSpace: 'nowrap',
                                        color: (activity as any).hot ? '#06b6d4' : (activity as any).active ? agent.color : (activity as any).warn ? '#ef4444' : 'rgba(255,255,255,0.28)' }}>
                                        NOW
                                    </span>
                                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                                        {activity.text}
                                    </span>
                                </div>

                                {/* ── METRICS ──────────────────────────────────── */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
                                    {[
                                        { label: 'P&L',       value: `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
                                          color: pnl >= 0 ? '#10b981' : '#ef4444' },
                                        { label: 'Trades',    value: `${trades}`, color: 'rgba(255,255,255,0.8)' },
                                        { label: 'Win Rate',  value: trades > 0 ? `${(winRate * 100).toFixed(0)}%` : '—',
                                          color: winRate > 0.5 ? '#10b981' : winRate > 0 ? '#f59e0b' : 'rgba(255,255,255,0.3)' },
                                        { label: 'Open',      value: `${openPos}`,
                                          color: openPos > 0 ? '#06b6d4' : 'rgba(255,255,255,0.3)' },
                                    ].map(m => (
                                        <div key={m.label} style={{ textAlign: 'center', padding: '7px 4px', borderRadius: 7,
                                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.08em',
                                                textTransform: 'uppercase', marginBottom: 3 }}>{m.label}</div>
                                            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: m.color }}>{m.value}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Mini equity sparkline */}
                                <MiniSparkline pnls={d.performance?.recent_pnls || []} color={agent.color} marginBottom={10} />

                                {/* ── SESSION + STRATEGY ───────────────────────── */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Clock size={11} color="rgba(255,255,255,0.3)" />
                                        <span style={{ fontSize: 10, color: inSession ? '#10b981' : 'rgba(255,255,255,0.32)' }}>
                                            {inSession ? '● In session' : '○ Session closed'} — {agent.sessionWindows.join(' / ')}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontFamily: 'monospace' }}>
                                        {agent.strategy}
                                    </span>
                                </div>

                                {/* Asset chips */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                                    {agent.assets.map(a => (
                                        <span key={a} style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600,
                                            background: `${agent.color}14`, border: `1px solid ${agent.color}28`,
                                            color: agent.color, fontFamily: 'monospace' }}>{a}</span>
                                    ))}
                                </div>

                                {/* Expand for raw details */}
                                <button className="ak-expand-btn" onClick={() => setExpanded(isExpanded ? null : agent.id)}
                                    aria-label={isExpanded ? `Hide details for ${agent.name}` : `Show details for ${agent.name}`}
                                    style={{ width: '100%', padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
                                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                                        color: 'rgba(255,255,255,0.35)', fontSize: 10,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                                    <ChevronRight size={11} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                                    {isExpanded ? 'HIDE DETAILS' : 'SHOW DETAILS'}
                                </button>

                                {isExpanded && (
                                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 10 }}>
                                            {[
                                                { label: 'Target R:R',   value: agent.rTarget },
                                                { label: 'Risk / Trade', value: `${agent.riskPct}%` },
                                                { label: 'Open Trades',  value: `${openPos}` },
                                                { label: 'PM2 Process',  value: agent.pm2 },
                                            ].map(item => (
                                                <div key={item.label} style={{ padding: '8px 10px', borderRadius: 7,
                                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase',
                                                        letterSpacing: '0.08em', marginBottom: 3 }}>{item.label}</div>
                                                    <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
                                                        {item.value}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {lastUpdate && (
                                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
                                                Last heartbeat: {timeAgo(lastUpdate)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                        })}
                    </div>
                )}
            </ErrorBoundary>

            {/* ── Section Label: System Components ── */}
            <SectionLabel icon={<Cpu size={13} style={{ color: '#a855f7' }} />} label="System Components" />

            {/* ── System Agent Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 32 }}>
                {SYSTEM_AGENTS.map(agent => (
                    <div key={agent.id} className="ak-card" style={{
                        borderRadius: 14, overflow: 'hidden',
                        background: 'rgba(255,255,255,0.03)',
                        border: `1px solid ${agent.color}22`,
                    }}>
                        <div style={{ height: 3, background: `linear-gradient(90deg, ${agent.color}, ${agent.color}55)` }} />
                        <div style={{ padding: '16px 18px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ fontSize: 30, lineHeight: 1 }}>{agent.emoji}</span>
                                    <div>
                                        <div style={{ fontSize: 15, fontWeight: 800 }}>{agent.name}</div>
                                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{agent.role}</div>
                                    </div>
                                </div>
                                <div style={{ padding: '4px 10px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                                    letterSpacing: '0.08em', background: `${agent.color}18`,
                                    color: agent.color, border: `1px solid ${agent.color}35` }}>
                                    ALWAYS ON
                                </div>
                            </div>
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.48)', lineHeight: 1.7, margin: '0 0 14px' }}>
                                {agent.description}
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {agent.duties.map(d => (
                                    <div key={d} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 6,
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                                        color: 'rgba(255,255,255,0.6)' }}>{d}</div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Quick Start ── */}
            <SectionLabel icon={<Terminal size={13} style={{ color: '#10b981' }} />} label="Quick Start" />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <CodeBlock title="Start All (PM2)" color="#10b981" lines={[
                    'cd .../SwjshAlgoKnife/scripts',
                    'pm2 start ecosystem.config.js',
                    'pm2 save',
                ]} />
                <CodeBlock title="Monitor Status (PM2)" color="#06b6d4" lines={[
                    'pm2 status',
                    'pm2 logs AK-Sterling',
                    'pm2 restart AK-PivotPete',
                ]} />
            </div>

            <div style={{ padding: '18px 20px', borderRadius: 14,
                background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 14, letterSpacing: '0.08em' }}>
                    Individual Python Launch
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                        { name: 'Sterling',     cmd: 'python sterling_engine.py'       },
                        { name: 'Bitcoin Bob',  cmd: 'python run_bitcoin_bob.py'       },
                        { name: 'Pivot Pete',   cmd: 'python pivot_pete_engine.py'     },
                        { name: 'Boba',         cmd: 'python boba_trades_engine.py'    },
                        { name: 'SPX Sniper',   cmd: 'python spx_sniper_engine.py'     },
                        { name: 'Dashboard',    cmd: 'npm run dev'                     },
                    ].map(item => (
                        <div key={item.name} style={{ padding: '8px 12px', borderRadius: 8,
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginBottom: 4 }}>{item.name}</div>
                            <code style={{ fontSize: 10, color: '#a855f7', fontFamily: 'monospace' }}>{item.cmd}</code>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            {icon}
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>{label}</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)', marginLeft: 6 }} />
        </div>
    );
}

function CodeBlock({ title, color, lines }: { title: string; color: string; lines: string[] }) {
    return (
        <div style={{ padding: '16px 18px', borderRadius: 14,
            background: `${color}08`, border: `1px solid ${color}22` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 10, letterSpacing: '0.08em' }}>
                {title}
            </div>
            <code style={{ display: 'block', fontSize: 11, color, fontFamily: 'monospace',
                background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 8, lineHeight: 1.9 }}>
                {lines.map((l, i) => <span key={i} style={{ display: 'block' }}>{l}</span>)}
            </code>
        </div>
    );
}

function MiniSparkline({ pnls, color, marginBottom }: { pnls: number[]; color: string; marginBottom: number }) {
    const hasData = pnls && pnls.length > 0;

    if (!hasData) {
        return (
            <svg width="100%" height={32} style={{ marginBottom, display: 'block' }}>
                <line x1="0" y1="16" x2="100%" y2="16" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            </svg>
        );
    }

    const width = 100;
    const height = 32;
    const padding = 4;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const min = Math.min(...pnls);
    const max = Math.max(...pnls);
    const range = max - min || 1;

    const points = pnls.map((val, i) => {
        const x = padding + (i / (pnls.length - 1 || 1)) * chartWidth;
        const y = padding + chartHeight - ((val - min) / range) * chartHeight;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width="100%" height={32} style={{ marginBottom, display: 'block', overflow: 'visible' }} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
    );
}
