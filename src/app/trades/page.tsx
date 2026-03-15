'use client';

import React, { useEffect, useState, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   TRADES & PERFORMANCE — Live Paper Trading Dashboard
   Shows: KPI bar, equity curve, strategy breakdown, live trade feed, grades
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Types ────────────────────────────────────────────────────────────────────
interface Trade {
    id: string;
    symbol: string;
    direction: 'LONG' | 'SHORT';
    entryPrice: number;
    exitPrice: number | null;
    quantity: number;
    realizedPnl: number | null;
    fees: number;
    status: 'OPEN' | 'CLOSED' | 'WIN' | 'LOSS' | 'BE';
    strategy: string;
    entryTime: string;
    exitTime: string | null;
    notes: string;
    intelSnapshot: any | null;
    // Execution details
    entryOrderId: string | null;
    exitOrderId: string | null;
    exitReason: string | null;
    bot?: { name: string; strategy: string } | null;
    brokerConfig?: { broker: string; environment: string } | null;
}

interface Stats {
    total: number;
    open: number;
    closed: number;
    wins: number;
    losses: number;
    winRate: number;
    totalPnl: number;
    avgWin: number;
    avgLoss: number;
    expectancy: number;
    profitFactor: number;
}

interface StrategyBreakdown {
    name: string;
    trades: number;
    wins: number;
    losses: number;
    winRate: number;
    pnl: number;
}

interface EquityPoint {
    date: string;
    pnl: number;
    symbol: string;
    status: string;
}

interface Signal {
    id: number;
    timestamp: string;
    symbol: string;
    strategy: string;
    action: string;
    price: number;
    payload: string;
}

interface TradesData {
    trades: Trade[];
    stats: Stats;
    strategies: StrategyBreakdown[];
    equityCurve: EquityPoint[];
    signals: Signal[];
    generatedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatPrice(price: number, symbol: string): string {
    if (!price) return '—';
    const s = symbol.toUpperCase();
    if (s.includes('BTC')) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    if (s.includes('ETH')) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    if (s.includes('SOL')) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    if (s.includes('JPY')) return price.toFixed(3);
    if (s.length === 6 && !s.includes('USD') || (s.includes('EUR') || s.includes('GBP') || s.includes('AUD') || s.includes('CAD'))) {
        return price.toFixed(5);
    }
    return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function formatPnl(pnl: number | null): string {
    if (pnl === null || pnl === undefined) return '—';
    const sign = pnl >= 0 ? '+' : '';
    return `${sign}$${pnl.toFixed(2)}`;
}

function timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

function gradeFromPnl(trade: Trade): { grade: string; color: string } {
    if (trade.status === 'OPEN') return { grade: '—', color: 'var(--text-muted)' };
    if (trade.status === 'BE') return { grade: 'C', color: 'var(--status-warning)' };

    const entry = trade.entryPrice;
    const exit = trade.exitPrice || entry;
    const notesSL = trade.notes?.match(/SL|stop/i);
    const risk = Math.abs(entry * 0.01); // approximate 1% risk
    const reward = Math.abs(exit - entry);
    const rr = risk > 0 ? reward / risk : 0;

    const isWin = trade.status === 'WIN' || (trade.realizedPnl && trade.realizedPnl > 0);
    if (isWin) {
        if (rr >= 2) return { grade: 'A', color: '#10b981' };
        if (rr >= 1) return { grade: 'B', color: '#06b6d4' };
        return { grade: 'C+', color: 'var(--status-warning)' };
    }
    // LOSS
    if (notesSL) return { grade: 'B-', color: '#06b6d4' };
    return { grade: 'D', color: '#ef4444' };
}

function getTimeRangeFilter(timeRange: string): (trade: Trade) => boolean {
    const now = new Date();
    return (trade: Trade) => {
        const tradeTime = new Date(trade.entryTime);
        if (timeRange === 'today') {
            return tradeTime.toDateString() === now.toDateString();
        } else if (timeRange === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return tradeTime >= weekAgo;
        } else if (timeRange === 'month') {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return tradeTime >= monthAgo;
        }
        return true; // all
    };
}

function groupTrades(trades: Trade[], groupBy: string): Record<string, Trade[]> {
    if (groupBy === 'none') return { 'All Trades': trades };

    const groups: Record<string, Trade[]> = {};
    trades.forEach(trade => {
        const key = groupBy === 'agent' ? (trade.bot?.name || 'Manual') : trade.strategy;
        if (!groups[key]) groups[key] = [];
        groups[key].push(trade);
    });
    return groups;
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function TradesPage() {
    const [data, setData] = useState<TradesData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'OPEN' | 'WIN' | 'LOSS'>('all');
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [groupBy, setGroupBy] = useState<'none' | 'agent' | 'strategy'>('none');
    const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('all');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    const fetchData = useCallback(async () => {
        try {
            const statusParam = filter !== 'all' ? `&status=${filter}` : '';
            const res = await fetch(`/api/trades?limit=100${statusParam}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setData(json);
            setError(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchData();
        if (!autoRefresh) return;
        const interval = setInterval(fetchData, 10000); // refresh every 10s
        return () => clearInterval(interval);
    }, [fetchData, autoRefresh]);

    if (loading && !data) return (
        <div style={pageStyles.loadingContainer}>
            <div style={pageStyles.spinner} />
            <p style={{ color: 'var(--text-secondary)', marginTop: 16 }}>Loading trades...</p>
        </div>
    );

    if (error && !data) return (
        <div style={pageStyles.loadingContainer}>
            <p style={{ color: 'var(--status-danger)' }}>Error: {error}</p>
            <button onClick={fetchData} style={pageStyles.retryBtn}>Retry</button>
        </div>
    );

    const stats = data?.stats;
    let trades = data?.trades || [];
    const strategies = data?.strategies || [];
    let equityCurve = data?.equityCurve || [];
    const signals = data?.signals || [];

    // Apply time range filter
    const timeRangeFilterFn = getTimeRangeFilter(timeRange);
    trades = trades.filter(timeRangeFilterFn);
    equityCurve = equityCurve.filter(p => timeRangeFilterFn({ entryTime: p.date } as Trade));

    // Calculate total fees from filtered trades
    const totalFees = trades.reduce((sum, t) => sum + (t.fees || 0), 0);

    // Calculate time-range adjusted stats
    const timeRangeStats = (() => {
        if (timeRange === 'all' && stats) return stats;
        const closedTrades = trades.filter(t => t.status !== 'OPEN');
        const wins = closedTrades.filter(t => t.status === 'WIN' || (t.realizedPnl && t.realizedPnl > 0));
        const losses = closedTrades.filter(t => t.status === 'LOSS' || (t.realizedPnl && t.realizedPnl < 0));
        const totalPnl = trades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
        const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.realizedPnl || 0), 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + (t.realizedPnl || 0), 0) / losses.length) : 0;
        const winRate = closedTrades.length > 0 ? Math.round((wins.length / closedTrades.length) * 100) : 0;
        const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : (avgWin * wins.length > 0 ? 999 : 0);
        return {
            total: trades.length,
            open: trades.filter(t => t.status === 'OPEN').length,
            closed: closedTrades.length,
            wins: wins.length,
            losses: losses.length,
            winRate,
            totalPnl,
            avgWin,
            avgLoss,
            expectancy: stats?.expectancy || 0,
            profitFactor,
        };
    })();

    // ── Equity curve SVG ─────────────────────────────────────────────────
    const curveWidth = 600;
    const curveHeight = 120;
    let curvePath = '';
    if (equityCurve.length > 1) {
        const maxPnl = Math.max(...equityCurve.map(p => p.pnl), 0.01);
        const minPnl = Math.min(...equityCurve.map(p => p.pnl), -0.01);
        const range = maxPnl - minPnl || 1;
        const xStep = curveWidth / (equityCurve.length - 1);
        curvePath = equityCurve.map((p, i) => {
            const x = i * xStep;
            const y = curveHeight - ((p.pnl - minPnl) / range) * (curveHeight - 20) - 10;
            return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
        }).join(' ');
    }

    const lastPnl = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].pnl : 0;
    const curveColor = lastPnl >= 0 ? '#10b981' : '#ef4444';

    return (
        <div style={pageStyles.page}>
            {/* ── Header ────────────────────────────────────────────── */}
            <div style={pageStyles.header}>
                <div>
                    <h1 style={pageStyles.title}>Trades & Performance</h1>
                    <p style={pageStyles.subtitle}>
                        Paper Trading Console — {autoRefresh ? 'Live' : 'Paused'} {data?.generatedAt ? `• Updated ${timeAgo(data.generatedAt)}` : ''}
                    </p>
                </div>
                <div style={pageStyles.headerActions}>
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        style={{
                            ...pageStyles.toggleBtn,
                            borderColor: autoRefresh ? '#10b981' : 'var(--border-base)',
                            color: autoRefresh ? '#10b981' : 'var(--text-muted)',
                        }}
                    >
                        {autoRefresh ? '● LIVE' : '○ PAUSED'}
                    </button>
                    <button onClick={fetchData} style={pageStyles.refreshBtn} title="Refresh now">
                        ↻
                    </button>
                </div>
            </div>

            {/* ── KPI Bar ───────────────────────────────────────────── */}
            {timeRangeStats && (
                <div style={pageStyles.kpiRow}>
                    <KpiCard label="Total Trades" value={String(timeRangeStats.total)} />
                    <KpiCard label="Open" value={String(timeRangeStats.open)} accent="var(--brand-primary)" />
                    <KpiCard label="Win Rate" value={`${timeRangeStats.winRate}%`} accent={timeRangeStats.winRate >= 50 ? '#10b981' : '#ef4444'} />
                    <KpiCard label="Net PnL" value={formatPnl(timeRangeStats.totalPnl)} accent={timeRangeStats.totalPnl >= 0 ? '#10b981' : '#ef4444'} />
                    <KpiCard label="Avg Win" value={formatPnl(timeRangeStats.avgWin)} accent="#10b981" />
                    <KpiCard label="Avg Loss" value={formatPnl(-timeRangeStats.avgLoss)} accent="#ef4444" />
                    <KpiCard label="Total Fees" value={`$${totalFees.toFixed(2)}`} accent="#f59e0b" />
                    <KpiCard label="Profit Factor" value={timeRangeStats.profitFactor > 0 ? timeRangeStats.profitFactor.toFixed(2) : '—'} accent={timeRangeStats.profitFactor >= 1 ? '#10b981' : '#ef4444'} />
                </div>
            )}

            {/* ── Main Grid ─────────────────────────────────────────── */}
            <div style={pageStyles.grid}>
                {/* Left: Equity + Strategy Breakdown */}
                <div style={pageStyles.leftCol}>
                    {/* Equity Curve */}
                    <div style={pageStyles.panel}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={pageStyles.panelTitle}>Equity Curve</h3>
                            <div style={pageStyles.filterRow}>
                                {(['today', 'week', 'month', 'all'] as const).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setTimeRange(t)}
                                        style={{
                                            ...pageStyles.filterBtn,
                                            ...(timeRange === t ? pageStyles.filterBtnActive : {}),
                                        }}
                                    >
                                        {t === 'today' ? 'Today' : t === 'week' ? 'This Week' : t === 'month' ? 'This Month' : 'All Time'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {equityCurve.length > 0 ? (
                            <svg viewBox={`0 0 ${curveWidth} ${curveHeight}`} style={{ width: '100%', height: 140 }}>
                                {/* Zero line */}
                                {(() => {
                                    const maxP = Math.max(...equityCurve.map(p => p.pnl), 0.01);
                                    const minP = Math.min(...equityCurve.map(p => p.pnl), -0.01);
                                    const range = maxP - minP || 1;
                                    const zeroY = curveHeight - ((0 - minP) / range) * (curveHeight - 20) - 10;
                                    return <line x1="0" y1={zeroY} x2={curveWidth} y2={zeroY} stroke="var(--border-bright)" strokeDasharray="4,4" />;
                                })()}
                                <path d={curvePath} fill="none" stroke={curveColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        ) : (
                            <div style={pageStyles.emptyState}>
                                <p>No closed trades yet — equity curve appears after your first trade closes.</p>
                            </div>
                        )}
                    </div>

                    {/* Strategy Breakdown */}
                    <div style={pageStyles.panel}>
                        <h3 style={pageStyles.panelTitle}>Strategy Performance</h3>
                        {strategies.length > 0 ? (
                            <table style={pageStyles.table}>
                                <thead>
                                    <tr>
                                        <th style={pageStyles.th}>Strategy</th>
                                        <th style={{ ...pageStyles.th, textAlign: 'center' }}>Trades</th>
                                        <th style={{ ...pageStyles.th, textAlign: 'center' }}>W / L</th>
                                        <th style={{ ...pageStyles.th, textAlign: 'center' }}>Win %</th>
                                        <th style={{ ...pageStyles.th, textAlign: 'right' }}>PnL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {strategies.map((s) => (
                                        <tr key={s.name} style={pageStyles.tr}>
                                            <td style={{ ...pageStyles.td, fontWeight: 600 }}>{s.name}</td>
                                            <td style={{ ...pageStyles.td, textAlign: 'center' }}>{s.trades}</td>
                                            <td style={{ ...pageStyles.td, textAlign: 'center' }}>
                                                <span style={{ color: '#10b981' }}>{s.wins}</span>
                                                <span style={{ color: 'var(--text-muted)' }}> / </span>
                                                <span style={{ color: '#ef4444' }}>{s.losses}</span>
                                            </td>
                                            <td style={{ ...pageStyles.td, textAlign: 'center', color: s.winRate >= 50 ? '#10b981' : '#ef4444' }}>
                                                {s.winRate}%
                                            </td>
                                            <td style={{ ...pageStyles.td, textAlign: 'right', color: s.pnl >= 0 ? '#10b981' : '#ef4444', fontFamily: 'var(--font-mono)' }}>
                                                {formatPnl(s.pnl)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div style={pageStyles.emptyState}>
                                <p>No completed trades yet. Strategy breakdown appears after first closed trade.</p>
                            </div>
                        )}
                    </div>

                    {/* Recent Signals */}
                    <div style={pageStyles.panel}>
                        <h3 style={pageStyles.panelTitle}>Signal Log</h3>
                        {signals.length > 0 ? (
                            <div style={pageStyles.signalList}>
                                {signals.slice(0, 10).map((s: Signal) => (
                                    <div key={s.id} style={pageStyles.signalRow}>
                                        <span style={{
                                            ...pageStyles.actionBadge,
                                            backgroundColor: s.action === 'BUY' || s.action === 'LONG' ? 'rgba(16,185,129,0.15)' : s.action === 'EXIT' ? 'rgba(168,85,247,0.15)' : 'rgba(239,68,68,0.15)',
                                            color: s.action === 'BUY' || s.action === 'LONG' ? '#10b981' : s.action === 'EXIT' ? '#a855f7' : '#ef4444',
                                        }}>
                                            {s.action}
                                        </span>
                                        <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 13 }}>{s.symbol}</span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>via {s.strategy}</span>
                                        <span style={{ color: 'var(--text-dim)', fontSize: 11, marginLeft: 'auto' }}>{timeAgo(s.timestamp)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={pageStyles.emptyState}>
                                <p>No signals received yet. Start a bot to see signals flow in.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Trade Feed */}
                <div style={pageStyles.rightCol}>
                    <div style={pageStyles.panel}>
                        <div style={pageStyles.feedHeader}>
                            <h3 style={pageStyles.panelTitle}>Trade Feed</h3>
                            <div style={pageStyles.filterRow}>
                                {(['all', 'OPEN', 'WIN', 'LOSS'] as const).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFilter(f)}
                                        style={{
                                            ...pageStyles.filterBtn,
                                            ...(filter === f ? pageStyles.filterBtnActive : {}),
                                        }}
                                    >
                                        {f === 'all' ? 'All' : f}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Grouping Tabs */}
                        <div style={{ marginBottom: 12, display: 'flex', gap: 4 }}>
                            {(['none', 'agent', 'strategy'] as const).map(g => (
                                <button
                                    key={g}
                                    onClick={() => setGroupBy(g)}
                                    style={{
                                        ...pageStyles.filterBtn,
                                        ...(groupBy === g ? pageStyles.filterBtnActive : {}),
                                    }}
                                >
                                    {g === 'none' ? 'All Trades' : g === 'agent' ? 'By Agent' : 'By Strategy'}
                                </button>
                            ))}
                        </div>

                        {trades.length > 0 ? (
                            <div style={pageStyles.tradeList}>
                                {(() => {
                                    const groups = groupTrades(trades, groupBy);
                                    return Object.entries(groups).map(([groupName, groupTrades]) => {
                                        const isCollapsed = collapsedGroups.has(groupName);
                                        const groupPnl = groupTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
                                        const groupWins = groupTrades.filter(t => t.status === 'WIN' || (t.realizedPnl && t.realizedPnl > 0)).length;

                                        return (
                                            <div key={groupName}>
                                                {groupBy !== 'none' && (
                                                    <div
                                                        onClick={() => {
                                                            setCollapsedGroups(prev => {
                                                                const next = new Set(prev);
                                                                if (next.has(groupName)) {
                                                                    next.delete(groupName);
                                                                } else {
                                                                    next.add(groupName);
                                                                }
                                                                return next;
                                                            });
                                                        }}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 8,
                                                            padding: '10px 12px',
                                                            marginBottom: 8,
                                                            background: 'rgba(6,182,212,0.08)',
                                                            border: '1px solid rgba(6,182,212,0.2)',
                                                            borderRadius: 'var(--radius-sm)',
                                                            cursor: 'pointer',
                                                            fontWeight: 600,
                                                            color: 'var(--text-secondary)',
                                                            fontSize: 13,
                                                        }}
                                                    >
                                                        <span style={{ fontSize: 12, color: 'var(--brand-primary)' }}>
                                                            {isCollapsed ? '▶' : '▼'}
                                                        </span>
                                                        <span>{groupName}</span>
                                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                                            {groupTrades.length} trades {groupWins > 0 && `• ${groupWins}W`}
                                                        </span>
                                                        <span style={{
                                                            fontFamily: 'var(--font-mono)',
                                                            fontSize: 12,
                                                            color: groupPnl >= 0 ? '#10b981' : '#ef4444',
                                                            fontWeight: 700,
                                                        }}>
                                                            {formatPnl(groupPnl)}
                                                        </span>
                                                    </div>
                                                )}
                                                {!isCollapsed && (
                                                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                                                        {groupTrades.map((trade) => (
                                                            <TradeCard key={trade.id} trade={trade} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        ) : (
                            <div style={pageStyles.emptyState}>
                                <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                                <p style={{ fontSize: 15 }}>No trades yet</p>
                                <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
                                    Start your bots and the Next.js server — trades will appear here in real-time.
                                </p>
                                <div style={pageStyles.startGuide}>
                                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                                        <strong style={{ color: 'var(--text-secondary)' }}>Quick Start:</strong><br />
                                        1. npm run dev<br />
                                        2. python scripts/bitcoin_bob_engine.py<br />
                                        3. python scripts/sterling_fx_engine.py
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Bot Color Map ─────────────────────────────────────────────────────────────
const botColorMap: Record<string, { bg: string; text: string }> = {
    'sterling': { bg: 'rgba(6,182,212,0.15)', text: '#06b6d4' },
    'bitcoin_bob': { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
    'pivot_pete': { bg: 'rgba(168,85,247,0.15)', text: '#a855f7' },
    'boba': { bg: 'rgba(236,72,153,0.15)', text: '#ec4899' },
    'spx_sniper': { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
};

// ── Trade Card ───────────────────────────────────────────────────────────────
function TradeCard({ trade }: { trade: Trade }) {
    const { grade, color: gradeColor } = gradeFromPnl(trade);
    const isOpen = trade.status === 'OPEN';
    const isWin = trade.status === 'WIN' || (trade.realizedPnl && trade.realizedPnl > 0);
    const statusColor = isOpen ? 'var(--brand-primary)' : isWin ? '#10b981' : trade.status === 'BE' ? 'var(--status-warning)' : '#ef4444';
    const dirColor = trade.direction === 'LONG' ? '#10b981' : '#ef4444';

    // Intel snapshot
    let intelScore: number | null = null;
    if (trade.intelSnapshot) {
        try {
            const snap = typeof trade.intelSnapshot === 'string'
                ? JSON.parse(trade.intelSnapshot)
                : trade.intelSnapshot;
            intelScore = snap.score ?? snap.compositeScore ?? null;
        } catch {}
    }

    // Calculate slippage if we have order IDs (indicates real execution)
    const hasExecution = !!trade.entryOrderId;

    // Get bot color (match by lowercase bot name)
    const getBotColor = (): { bg: string; text: string } => {
        if (!trade.bot) return { bg: 'rgba(107,114,128,0.15)', text: '#9ca3af' };
        const botKey = trade.bot.name.toLowerCase();
        for (const [key, colors] of Object.entries(botColorMap)) {
            if (botKey.includes(key)) return colors;
        }
        return { bg: 'rgba(168,85,247,0.15)', text: '#a855f7' }; // default
    };
    const botColors = getBotColor();

    return (
        <div style={{
            ...pageStyles.tradeCard,
            borderLeftColor: statusColor,
        }}>
            <div style={pageStyles.tradeCardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ ...pageStyles.dirBadge, backgroundColor: `${dirColor}20`, color: dirColor }}>
                        {trade.direction}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                        {trade.symbol}
                    </span>
                    <span style={{ ...pageStyles.statusChip, backgroundColor: `${statusColor}20`, color: statusColor }}>
                        {trade.status}
                    </span>
                    {/* Bot badge */}
                    {trade.bot ? (
                        <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-full)',
                            background: botColors.bg,
                            color: botColors.text,
                            fontFamily: 'var(--font-mono)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                        }}>
                            {trade.bot.name}
                            <span style={{ fontSize: 10, opacity: 0.8 }}>•</span>
                            <span style={{ fontSize: 10 }}>{trade.bot.strategy}</span>
                        </span>
                    ) : (
                        <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-full)',
                            background: 'rgba(107,114,128,0.15)',
                            color: '#9ca3af',
                        }}>
                            Manual
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Professor Grade */}
                    {!isOpen && (
                        <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 800,
                            fontSize: 18,
                            color: gradeColor,
                            letterSpacing: '-0.5px',
                        }}>
                            {grade}
                        </span>
                    )}
                    {/* PnL */}
                    {trade.realizedPnl !== null && trade.realizedPnl !== undefined && (
                        <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            fontSize: 15,
                            color: trade.realizedPnl >= 0 ? '#10b981' : '#ef4444',
                        }}>
                            {formatPnl(trade.realizedPnl)}
                        </span>
                    )}
                </div>
            </div>

            <div style={pageStyles.tradeCardBody}>
                <div style={pageStyles.priceRow}>
                    <span style={pageStyles.priceLabel}>Entry</span>
                    <span style={pageStyles.priceValue}>{formatPrice(trade.entryPrice, trade.symbol)}</span>
                    {trade.exitPrice && (
                        <>
                            <span style={{ ...pageStyles.priceLabel, marginLeft: 16 }}>Exit</span>
                            <span style={pageStyles.priceValue}>{formatPrice(trade.exitPrice, trade.symbol)}</span>
                        </>
                    )}
                    <span style={{ ...pageStyles.priceLabel, marginLeft: 16 }}>Size</span>
                    <span style={pageStyles.priceValue}>{trade.quantity}</span>
                </div>

                {/* Execution Details Row */}
                {(hasExecution || trade.fees > 0) && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: '1px solid var(--border-subtle)',
                        flexWrap: 'wrap',
                    }}>
                        {trade.entryOrderId && (
                            <span style={{
                                fontSize: 10,
                                color: 'var(--text-dim)',
                                fontFamily: 'var(--font-mono)',
                            }}>
                                Order: {trade.entryOrderId.slice(0, 8)}...
                            </span>
                        )}
                        {trade.fees > 0 && (
                            <span style={{
                                fontSize: 10,
                                color: '#f59e0b',
                                fontFamily: 'var(--font-mono)',
                            }}>
                                Fee: ${trade.fees.toFixed(2)}
                            </span>
                        )}
                        {trade.brokerConfig && (
                            <span style={{
                                fontSize: 9,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: trade.brokerConfig.environment === 'PAPER'
                                    ? 'rgba(6,182,212,0.15)'
                                    : 'rgba(239,68,68,0.15)',
                                color: trade.brokerConfig.environment === 'PAPER'
                                    ? '#06b6d4'
                                    : '#ef4444',
                                fontWeight: 600,
                            }}>
                                {trade.brokerConfig.broker} {trade.brokerConfig.environment}
                            </span>
                        )}
                        {trade.exitReason && (
                            <span style={{
                                fontSize: 10,
                                color: 'var(--text-muted)',
                            }}>
                                Exit: {trade.exitReason}
                            </span>
                        )}
                    </div>
                )}

                <div style={pageStyles.tradeCardFooter}>
                    <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                        {trade.strategy}
                    </span>
                    {intelScore !== null && (
                        <span style={{
                            fontSize: 11,
                            color: intelScore > 0.3 ? '#10b981' : intelScore > -0.1 ? 'var(--status-warning)' : '#ef4444',
                            fontFamily: 'var(--font-mono)',
                        }}>
                            Intel: {intelScore > 0 ? '+' : ''}{(intelScore * 100).toFixed(0)}%
                        </span>
                    )}
                    <span style={{ color: 'var(--text-dim)', fontSize: 11, marginLeft: 'auto' }}>
                        {timeAgo(trade.entryTime)}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
    return (
        <div style={pageStyles.kpiCard}>
            <p style={pageStyles.kpiLabel}>{label}</p>
            <p style={{ ...pageStyles.kpiValue, color: accent || 'var(--text-primary)' }}>{value}</p>
        </div>
    );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const pageStyles: Record<string, React.CSSProperties> = {
    page: {
        padding: '24px 32px',
        maxWidth: 1400,
        margin: '0 auto',
    },
    loadingContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
    },
    spinner: {
        width: 32,
        height: 32,
        border: '3px solid var(--border-base)',
        borderTopColor: 'var(--brand-primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
    },
    retryBtn: {
        marginTop: 16,
        padding: '8px 20px',
        background: 'var(--brand-primary)',
        color: '#fff',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        fontSize: 14,
    },

    // Header
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 700,
        color: 'var(--text-primary)',
        margin: 0,
    },
    subtitle: {
        fontSize: 13,
        color: 'var(--text-muted)',
        marginTop: 4,
    },
    headerActions: {
        display: 'flex',
        gap: 8,
        alignItems: 'center',
    },
    toggleBtn: {
        padding: '6px 14px',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        border: '1px solid var(--border-base)',
        borderRadius: 'var(--radius-full)',
        background: 'transparent',
        cursor: 'pointer',
        letterSpacing: '0.5px',
    },
    refreshBtn: {
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        border: '1px solid var(--border-base)',
        borderRadius: 'var(--radius-sm)',
        background: 'transparent',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
    },

    // KPI
    kpiRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 12,
        marginBottom: 24,
    },
    kpiCard: {
        padding: '16px 18px',
        background: 'var(--panel-bg)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        backdropFilter: 'blur(12px)',
    },
    kpiLabel: {
        fontSize: 11,
        fontWeight: 500,
        color: 'var(--text-muted)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.8px',
        margin: 0,
    },
    kpiValue: {
        fontSize: 22,
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        margin: '6px 0 0',
    },

    // Grid
    grid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 20,
        alignItems: 'start',
    },
    leftCol: {
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
    },
    rightCol: {
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
    },

    // Panels
    panel: {
        background: 'var(--panel-bg)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '20px',
        backdropFilter: 'blur(12px)',
    },
    panelTitle: {
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.8px',
        margin: '0 0 16px',
    },
    emptyState: {
        textAlign: 'center' as const,
        padding: '32px 16px',
        color: 'var(--text-muted)',
        fontSize: 14,
    },
    startGuide: {
        marginTop: 16,
        padding: 16,
        background: 'var(--bg-subtle)',
        borderRadius: 'var(--radius-sm)',
        textAlign: 'left' as const,
    },

    // Table
    table: {
        width: '100%',
        borderCollapse: 'collapse' as const,
    },
    th: {
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.6px',
        padding: '8px 12px',
        textAlign: 'left' as const,
        borderBottom: '1px solid var(--border-subtle)',
    },
    tr: {
        borderBottom: '1px solid var(--border-subtle)',
    },
    td: {
        padding: '10px 12px',
        fontSize: 13,
        color: 'var(--text-primary)',
    },

    // Signal list
    signalList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    signalRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 'var(--radius-xs)',
        background: 'var(--bg-subtle)',
    },
    actionBadge: {
        fontSize: 10,
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        padding: '2px 8px',
        borderRadius: 'var(--radius-full)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
    },

    // Feed header
    feedHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    filterRow: {
        display: 'flex',
        gap: 4,
    },
    filterBtn: {
        padding: '4px 12px',
        fontSize: 11,
        fontWeight: 600,
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-full)',
        background: 'transparent',
        color: 'var(--text-muted)',
        cursor: 'pointer',
    },
    filterBtnActive: {
        background: 'var(--brand-primary)',
        color: '#fff',
        borderColor: 'var(--brand-primary)',
    },

    // Trade list
    tradeList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxHeight: 680,
        overflowY: 'auto' as const,
    },
    tradeCard: {
        background: 'var(--bg-subtle)',
        borderRadius: 'var(--radius-sm)',
        padding: '14px 16px',
        borderLeft: '3px solid',
    },
    tradeCardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    tradeCardBody: {},
    priceRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap' as const,
    },
    priceLabel: {
        fontSize: 11,
        color: 'var(--text-dim)',
        textTransform: 'uppercase' as const,
    },
    priceValue: {
        fontSize: 13,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-primary)',
        fontWeight: 500,
    },
    tradeCardFooter: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginTop: 8,
    },
    dirBadge: {
        fontSize: 10,
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        padding: '2px 8px',
        borderRadius: 'var(--radius-xs)',
        letterSpacing: '0.5px',
    },
    statusChip: {
        fontSize: 10,
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        padding: '2px 8px',
        borderRadius: 'var(--radius-full)',
        letterSpacing: '0.3px',
    },
};
