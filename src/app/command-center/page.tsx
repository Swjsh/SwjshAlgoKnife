'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { OctagonX } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

// ─── Trading Agents ────────────────────────────────────────────────────────────
const AGENTS = [
    {
        id: 'sterling',
        name: 'Sterling',
        emoji: '🦅',
        role: 'Forex Specialist',
        category: 'FOREX',
        broker: 'OANDA Practice',
        assets: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD'],
        strategy: 'Three Ducks + S/R',
        sessionWindows: ['London', 'New York'],
        rTarget: '3:1',
        riskPct: 1,
        color: '#06b6d4',
    },
    {
        id: 'bitcoin_bob',
        name: 'Bitcoin Bob',
        emoji: '₿',
        role: 'Crypto Trader',
        category: 'CRYPTO',
        broker: 'Alpaca Paper',
        assets: ['BTCUSD', 'ETHUSD', 'SOLUSD'],
        strategy: 'S/R Zone Breakout',
        sessionWindows: ['24/7'],
        rTarget: '2:1',
        riskPct: 1,
        color: '#f59e0b',
    },
    {
        id: 'pivot_pete',
        name: 'Pivot Pete',
        emoji: '📐',
        role: 'Futures Trader',
        category: 'FUTURES',
        broker: 'Alpaca Paper',
        assets: ['ES', 'NQ', 'RTY', 'YM'],
        strategy: 'ORB + NeverStoppedOut',
        sessionWindows: ['New York'],
        rTarget: '3:1',
        riskPct: 1,
        color: '#a855f7',
    },
    {
        id: 'boba',
        name: 'Boba',
        emoji: '🧋',
        role: 'Options Trader',
        category: 'OPTIONS',
        broker: 'Alpaca Paper',
        assets: ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA'],
        strategy: 'VWAP + BB Breakout',
        sessionWindows: ['New York'],
        rTarget: '2:1',
        riskPct: 1,
        color: '#ec4899',
    },
    {
        id: 'spx_sniper',
        name: 'SPX Sniper',
        emoji: '🎯',
        role: 'SPX Options Specialist',
        category: 'OPTIONS',
        broker: 'Alpaca Paper',
        assets: ['SPX', 'SPY', '0DTE'],
        strategy: 'Opening Range + Delta',
        sessionWindows: ['New York'],
        rTarget: '4:1',
        riskPct: 0.5,
        color: '#ef4444',
    },
];

// ─── System Components ─────────────────────────────────────────────────────────
const SYSTEM_COMPONENTS = [
    {
        id: 'professor',
        name: 'The Professor',
        emoji: '🎓',
        role: 'Trade Analyst',
        color: '#10b981',
    },
    {
        id: 'overseer',
        name: 'Overseer',
        emoji: '🛡️',
        role: 'Risk Manager',
        color: '#6366f1',
    },
];

// ─── Market Sessions (ET hours) ───────────────────────────────────────────────
const SESSIONS = [
    { name: 'Sydney',   flag: '🇦🇺', open: 17, close: 2,  color: '#6366f1', pairs: ['AUDUSD', 'NZDUSD', 'AUDJPY'] },
    { name: 'Tokyo',    flag: '🇯🇵', open: 19, close: 4,  color: '#06b6d4', pairs: ['USDJPY', 'EURJPY', 'GBPJPY'] },
    { name: 'London',   flag: '🇬🇧', open: 3,  close: 12, color: '#10b981', pairs: ['GBPUSD', 'EURUSD', 'EURGBP'] },
    { name: 'New York', flag: '🇺🇸', open: 8,  close: 17, color: '#f59e0b', pairs: ['EURUSD', 'GBPUSD', 'SPY', 'ES'] },
];

// ─── Economic Events (ET decimal hours) ───────────────────────────────────────
const ECO_EVENTS = [
    { label: 'CPI',   time: 8.5,  color: '#ef4444', desc: 'CPI Release 8:30 ET' },
    { label: 'OPEN',  time: 9.5,  color: '#10b981', desc: 'NYSE Open 9:30 ET' },
    { label: 'FOMC',  time: 14.0, color: '#a855f7', desc: 'FOMC Statement 2:00 ET' },
    { label: 'CLOSE', time: 16.0, color: '#f59e0b', desc: 'NYSE Close 4:00 ET' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getETHour(): number {
    const now = new Date();
    const jan = new Date(now.getFullYear(), 0, 1);
    const jul = new Date(now.getFullYear(), 6, 1);
    const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    const isDST = now.getTimezoneOffset() < stdOffset;
    const etOffset = isDST ? -4 : -5;
    const utcH = now.getUTCHours() + now.getUTCMinutes() / 60;
    return ((utcH + etOffset) + 24) % 24;
}

function getETTime(): Date {
    const now = new Date();
    const jan = new Date(now.getFullYear(), 0, 1);
    const jul = new Date(now.getFullYear(), 6, 1);
    const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    const isDST = now.getTimezoneOffset() < stdOffset;
    const etOffset = isDST ? -4 : -5;
    return new Date(now.getTime() + (etOffset - (-now.getTimezoneOffset() / 60)) * 3600000);
}

function isSessionOpen(session: typeof SESSIONS[0]): boolean {
    const h = getETHour();
    if (session.open < session.close) return h >= session.open && h < session.close;
    return h >= session.open || h < session.close;
}

function sessionProgress(session: typeof SESSIONS[0]): number {
    const h = getETHour();
    const duration = session.open < session.close
        ? session.close - session.open
        : (24 - session.open) + session.close;
    if (!isSessionOpen(session)) return 0;
    const elapsed = session.open <= h ? h - session.open : (24 - session.open) + h;
    return Math.min(100, (elapsed / duration) * 100);
}

function isAgentInWindow(agent: typeof AGENTS[0]): boolean {
    if (agent.sessionWindows.includes('Always On') || agent.sessionWindows.includes('24/7')) return true;
    return agent.sessionWindows.some(s => {
        const sess = SESSIONS.find(x => x.name === s);
        return sess ? isSessionOpen(sess) : false;
    });
}

function pnlColor(v: number): string {
    if (v > 0) return '#10b981';
    if (v < 0) return '#ef4444';
    return 'rgba(255,255,255,0.5)';
}

function formatPnl(v: number): string {
    const sign = v >= 0 ? '+' : '';
    return `${sign}$${Math.abs(v).toFixed(2)}`;
}

function timeSince(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
}

// Returns segments for a session on a 0-24 ET timeline (handles midnight wrap)
function getSessionSegments(session: typeof SESSIONS[0]): { startPct: number; widthPct: number }[] {
    const { open, close } = session;
    if (open < close) {
        return [{ startPct: (open / 24) * 100, widthPct: ((close - open) / 24) * 100 }];
    }
    // Wraps midnight: two segments
    return [
        { startPct: 0, widthPct: (close / 24) * 100 },
        { startPct: (open / 24) * 100, widthPct: ((24 - open) / 24) * 100 },
    ];
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CommandCenterPage() {
    const router = useRouter();
    const { user, isGuest, loading: authLoading, userPreferences } = useAuth();

    const [tick, setTick] = useState(0);
    const [trades, setTrades] = useState<any[]>([]);
    const [signals, setSignals] = useState<any[]>([]);
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [prevPrices, setPrevPrices] = useState<Record<string, number>>({});
    const [agentData, setAgentData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [haltAll, setHaltAll] = useState(false);
    const [online, setOnline] = useState(true);

    // Redirect to onboarding if not complete (skip for guests)
    useEffect(() => {
        if (!authLoading && user && !isGuest && userPreferences && !userPreferences.onboardingComplete) {
            router.replace('/onboarding');
        }
    }, [authLoading, user, isGuest, userPreferences, router]);

    const displayName = user?.displayName
        ? user.displayName.split(' ')[0]
        : isGuest ? 'Guest' : 'Commander';

    const getHour = () => {
        const h = new Date().getHours();
        if (h < 5)  return 'Night Shift';
        if (h < 12) return 'Good Morning';
        if (h < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const etTime = getETTime();
    const hourNow = getETHour();

    useEffect(() => {
        const t = setInterval(() => setTick(n => n + 1), 1000);
        return () => clearInterval(t);
    }, []);

    const fetchPrices = useCallback(async () => {
        try {
            const r = await fetch('/api/prices');
            if (r.ok) {
                const raw = await r.json();
                if (!raw.error) {
                    const p: Record<string, number> = {};
                    for (const [k, v] of Object.entries(raw)) {
                        if (typeof v === 'number') p[k] = v as number;
                    }
                    setPrevPrices(old => ({ ...old }));
                    setPrices(p);
                }
            }
        } catch {}
    }, []);

    useEffect(() => { fetchPrices(); }, [fetchPrices]);
    useEffect(() => {
        const t = setInterval(fetchPrices, 30000);
        return () => clearInterval(t);
    }, [fetchPrices]);

    const fetchData = useCallback(async () => {
        try {
            const [jRes, sRes, aRes] = await Promise.allSettled([
                fetch('/api/journal?limit=100'),
                fetch('/api/signals?limit=20'),
                fetch('/api/agents'),
            ]);
            if (jRes.status === 'fulfilled' && jRes.value.ok) {
                const j = await jRes.value.json();
                setTrades(j.trades || []);
            }
            if (sRes.status === 'fulfilled' && sRes.value.ok) {
                const s = await sRes.value.json();
                setSignals(s.signals || s || []);
            }
            if (aRes.status === 'fulfilled' && aRes.value.ok) {
                const a = await aRes.value.json();
                setAgentData(a.agents || {});
            }
            setOnline(true);
        } catch {
            setOnline(false);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleHaltAll = useCallback(async () => {
        try {
            setHaltAll(true);
            const res = await fetch('/api/agents/halt-all', { method: 'POST' });
            if (res.ok) fetchData();
        } catch (err) {
            console.error('Error halting agents:', err);
        } finally {
            setHaltAll(false);
        }
    }, [fetchData]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => {
        const t = setInterval(fetchData, 15000);
        return () => clearInterval(t);
    }, [fetchData]);

    const today = new Date().toISOString().slice(0, 10);
    const todayTrades = trades.filter(t => (t.opened_at || '').startsWith(today));
    const openTrades  = trades.filter(t => t.status === 'OPEN');
    const closedTrades = trades.filter(t => ['WIN', 'LOSS', 'BE', 'CLOSED'].includes(t.status));
    const wins   = closedTrades.filter(t => t.status === 'WIN').length;
    const losses = closedTrades.filter(t => t.status === 'LOSS').length;
    const winRate  = closedTrades.length ? Math.round((wins / closedTrades.length) * 100) : 0;
    const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const todayPnl = todayTrades.reduce((s, t) => s + (t.pnl || 0), 0);

    // Agent status: prefer real API status, fall back to session window check
    const getAgentStatus = (agent: typeof AGENTS[0]): 'LIVE' | 'IDLE' | 'OFF' => {
        const data = agentData[agent.id] as any;
        if (data?.status === 'active' || data?.status === 'ACTIVE') return 'LIVE';
        if (data?.status === 'idle' || data?.status === 'IDLE') return 'IDLE';
        if (data?.status) return 'OFF';
        // No API data — fall back to session window heuristic
        return isAgentInWindow(agent) ? 'LIVE' : 'IDLE';
    };

    const liveAgentCount = AGENTS.filter(a => getAgentStatus(a) === 'LIVE').length;

    const nowPct = (hourNow / 24) * 100;
    const etTimeStr = etTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    // Find next event
    const nextEvent = ECO_EVENTS
        .map(ev => ({ ...ev, hoursUntil: (ev.time - hourNow + 24) % 24 }))
        .sort((a, b) => a.hoursUntil - b.hoursUntil)[0];

    const TICKER_ASSETS = [
        { sym: 'BTC', label: 'BTC', color: '#f59e0b' },
        { sym: 'ETH', label: 'ETH', color: '#a855f7' },
        { sym: 'SOL', label: 'SOL', color: '#06b6d4' },
        { sym: 'XRP', label: 'XRP', color: '#10b981' },
        { sym: 'DOGE', label: 'DOGE', color: '#ec4899' },
    ];

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: 'hsl(222,47%,11%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, color: 'rgba(255,255,255,0.4)', fontFamily: 'Consolas, monospace' }}>
                <div style={{ width: 36, height: 36, border: '2px solid rgba(6,182,212,0.2)', borderTopColor: '#06b6d4', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: 12, letterSpacing: 3 }}>INITIALIZING</span>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'hsl(222,47%,11%)', color: 'white', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

            <style>{`
                @keyframes spin    { to { transform: rotate(360deg); } }
                @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.35} }
                @keyframes glow    { 0%,100%{box-shadow:0 0 6px #06b6d4} 50%{box-shadow:0 0 14px #06b6d4, 0 0 28px #06b6d480} }
                @keyframes ticker  { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
                @keyframes fadeIn  { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
                * { box-sizing: border-box; }
                ::-webkit-scrollbar { width: 4px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(6,182,212,0.25); border-radius: 2px; }
                .agent-row:hover { background: rgba(6,182,212,0.06) !important; border-color: rgba(6,182,212,0.25) !important; }
            `}</style>

            {/* ── Price Ticker ───────────────────────────────────────────── */}
            {Object.keys(prices).length > 0 && (() => {
                const items = [...TICKER_ASSETS, ...TICKER_ASSETS];
                return (
                    <div style={{ overflow: 'hidden', background: 'rgba(6,182,212,0.04)', borderBottom: '1px solid rgba(6,182,212,0.12)', padding: '7px 0' }}>
                        <div style={{ display: 'flex', gap: 40, whiteSpace: 'nowrap', animation: 'ticker 28s linear infinite' } as React.CSSProperties}>
                            {items.map((a, i) => {
                                const price = prices[a.sym];
                                const prev  = prevPrices[a.sym];
                                const up    = prev && price > prev;
                                const dn    = prev && price < prev;
                                if (!price) return null;
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, fontFamily: 'Consolas, monospace' }}>
                                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 1 }}>{a.label}</span>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: up ? '#10b981' : dn ? '#ef4444' : a.color }}>
                                            ${price >= 1000
                                                ? price.toLocaleString('en-US', { maximumFractionDigits: 0 })
                                                : price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                        </span>
                                        <span style={{ fontSize: 10, color: up ? '#10b981' : dn ? '#ef4444' : 'rgba(255,255,255,0.2)' }}>{up ? '▲' : dn ? '▼' : '—'}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            <div style={{ padding: '20px 28px' }}>

                {/* ── 24hr Timeline (TOP) ────────────────────────────────── */}
                <div style={{
                    background: 'rgba(0,0,0,0.35)',
                    border: '1px solid rgba(6,182,212,0.18)',
                    borderRadius: 14,
                    padding: '16px 20px',
                    marginBottom: 20,
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    {/* Subtle corner accent */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: 32, height: 32, borderTop: '2px solid rgba(6,182,212,0.4)', borderLeft: '2px solid rgba(6,182,212,0.4)', borderTopLeftRadius: 14, pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderBottom: '2px solid rgba(6,182,212,0.2)', borderRight: '2px solid rgba(6,182,212,0.2)', borderBottomRightRadius: 14, pointerEvents: 'none' }} />

                    {/* Timeline header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 10, fontFamily: 'Consolas, monospace', color: '#06b6d4', letterSpacing: 2, textTransform: 'uppercase' }}>24-HR Market Clock // Eastern Time</span>
                            {nextEvent && (
                                <span style={{ fontSize: 10, fontFamily: 'Consolas, monospace', background: `${nextEvent.color}18`, border: `1px solid ${nextEvent.color}30`, color: nextEvent.color, padding: '2px 8px', borderRadius: 4 }}>
                                    NEXT: {nextEvent.label} in {nextEvent.hoursUntil < 1 ? `${Math.round(nextEvent.hoursUntil * 60)}m` : `${nextEvent.hoursUntil.toFixed(1)}h`}
                                </span>
                            )}
                        </div>
                        <span style={{ fontSize: 13, fontFamily: 'Consolas, monospace', color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>
                            {etTimeStr}
                        </span>
                    </div>

                    {/* Session rows */}
                    <div style={{ paddingLeft: 52, position: 'relative' }}>
                        {SESSIONS.map((sess, idx) => {
                            const open = isSessionOpen(sess);
                            const segments = getSessionSegments(sess);
                            return (
                                <div key={sess.name} style={{ position: 'relative', height: 10, marginBottom: 5 }}>
                                    {/* Row label */}
                                    <div style={{
                                        position: 'absolute', left: -52, width: 46, textAlign: 'right',
                                        fontSize: 9, fontFamily: 'Consolas, monospace',
                                        color: open ? sess.color : 'rgba(255,255,255,0.25)',
                                        fontWeight: 700, letterSpacing: 0.5,
                                        top: '50%', transform: 'translateY(-50%)',
                                        textTransform: 'uppercase',
                                    }}>
                                        {sess.flag} {sess.name.slice(0, 3)}
                                    </div>
                                    {/* Background track */}
                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.04)', borderRadius: 2 }} />
                                    {/* Session blocks */}
                                    {segments.map((seg, i) => (
                                        <div key={i} style={{
                                            position: 'absolute',
                                            left: `${seg.startPct}%`,
                                            width: `${seg.widthPct}%`,
                                            top: 0, height: '100%',
                                            borderRadius: 2,
                                            background: open ? `${sess.color}50` : `${sess.color}1a`,
                                            border: open ? `1px solid ${sess.color}80` : `1px solid ${sess.color}25`,
                                            transition: 'all 0.5s ease',
                                        }} />
                                    ))}
                                </div>
                            );
                        })}

                        {/* Economic event markers */}
                        <div style={{ position: 'relative', height: 22, marginTop: 6 }}>
                            {ECO_EVENTS.map(ev => {
                                const isPast = hourNow > ev.time;
                                const isNear = Math.abs(hourNow - ev.time) < 0.5;
                                return (
                                    <div key={ev.label} style={{
                                        position: 'absolute',
                                        left: `${(ev.time / 24) * 100}%`,
                                        top: 0, bottom: 0,
                                        transform: 'translateX(-50%)',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    }}>
                                        <div style={{
                                            width: 1, height: 12,
                                            background: isPast ? 'rgba(255,255,255,0.1)' : ev.color,
                                            opacity: isNear ? 1 : isPast ? 0.3 : 0.7,
                                        }} />
                                        <span style={{
                                            fontSize: 8, fontFamily: 'Consolas, monospace',
                                            color: isPast ? 'rgba(255,255,255,0.2)' : ev.color,
                                            fontWeight: 700, letterSpacing: 0.3,
                                            whiteSpace: 'nowrap',
                                            marginTop: 2,
                                        }}>
                                            {ev.label}
                                        </span>
                                    </div>
                                );
                            })}

                            {/* NOW cursor */}
                            <div style={{
                                position: 'absolute',
                                left: `${nowPct}%`,
                                top: -44, // extends up through session rows
                                height: 'calc(100% + 44px)',
                                width: 1,
                                background: 'rgba(255,255,255,0.65)',
                                boxShadow: '0 0 8px rgba(255,255,255,0.4)',
                                zIndex: 10,
                                pointerEvents: 'none',
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    bottom: -2, left: '50%', transform: 'translateX(-50%)',
                                    width: 5, height: 5, borderRadius: '50%',
                                    background: 'white', boxShadow: '0 0 6px white',
                                }} />
                            </div>
                        </div>

                        {/* Hour ruler */}
                        <div style={{ position: 'relative', height: 12, marginTop: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            {[0, 3, 6, 9, 12, 15, 18, 21].map(h => (
                                <span key={h} style={{
                                    position: 'absolute',
                                    left: `${(h / 24) * 100}%`,
                                    top: 2, transform: 'translateX(-50%)',
                                    fontSize: 8, fontFamily: 'Consolas, monospace',
                                    color: 'rgba(255,255,255,0.2)',
                                }}>
                                    {String(h).padStart(2, '0')}:00
                                </span>
                            ))}
                            {/* Extra label at 24 */}
                            <span style={{ position: 'absolute', left: '100%', top: 2, transform: 'translateX(-100%)', fontSize: 8, fontFamily: 'Consolas, monospace', color: 'rgba(255,255,255,0.2)' }}>24:00</span>
                        </div>
                    </div>
                </div>

                {/* ── Fleet Command Strip ──────────────────────────────────── */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 18px', borderRadius: 10, marginBottom: 16, gap: 16,
                    background: liveAgentCount > 0 ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
                    border: `1px solid ${liveAgentCount > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 9, height: 9, borderRadius: '50%',
                            background: liveAgentCount > 0 ? '#10b981' : '#ef4444',
                            animation: liveAgentCount > 0 ? 'pulse 2s ease-in-out infinite' : 'none',
                            boxShadow: liveAgentCount > 0 ? '0 0 6px #10b981' : 'none',
                        }} />
                        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'Consolas, monospace', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.8)' }}>
                            {liveAgentCount}/{AGENTS.length} AGENTS LIVE
                        </span>
                        {!online && <span style={{ fontSize: 10, color: '#ef4444', fontFamily: 'Consolas, monospace' }}>OFFLINE</span>}
                        {isGuest && (
                            <span style={{ fontSize: 10, color: '#f59e0b', fontFamily: 'Consolas, monospace' }}>
                                GUEST MODE — <a href="/sign-in" style={{ color: '#06b6d4', textDecoration: 'none' }}>Sign in</a>
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'Consolas, monospace', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em' }}>
                        Today: <span style={{ color: pnlColor(todayPnl), fontWeight: 700 }}>{formatPnl(todayPnl)}</span>
                        <span style={{ margin: '0 8px', color: 'rgba(255,255,255,0.15)' }}>|</span>
                        Open: <span style={{ color: openTrades.length > 0 ? '#06b6d4' : 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{openTrades.length}</span>
                        <span style={{ margin: '0 8px', color: 'rgba(255,255,255,0.15)' }}>|</span>
                        Win Rate: <span style={{ color: winRate >= 50 ? '#10b981' : '#f59e0b', fontWeight: 700 }}>{winRate}%</span>
                    </div>
                    <button
                        onClick={handleHaltAll}
                        disabled={haltAll}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
                            background: haltAll ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.12)',
                            border: '1px solid rgba(239,68,68,0.35)',
                            color: '#ef4444', cursor: haltAll ? 'default' : 'pointer',
                            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                            transition: 'all 0.15s', whiteSpace: 'nowrap', opacity: haltAll ? 0.6 : 1,
                        }}
                        onMouseEnter={(e) => { if (!haltAll) { e.currentTarget.style.background = 'rgba(239,68,68,0.25)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'; } }}
                        onMouseLeave={(e) => { if (!haltAll) { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.35)'; } }}
                    >
                        <OctagonX size={13} />
                        {haltAll ? 'HALTING...' : 'HALT ALL'}
                    </button>
                </div>

                {/* ── Header + Stats ──────────────────────────────────────── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 20 }}>
                    {/* Title + greeting */}
                    <div>
                        <h1 style={{
                            fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1,
                            background: 'linear-gradient(135deg, #06b6d4, #a855f7)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                        }}>
                            ⚡ {getHour()}, {displayName}
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.35)', margin: '4px 0 0', fontSize: 12, fontFamily: 'Consolas, monospace', letterSpacing: 1 }}>
                            COMMAND CENTER // {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </p>
                    </div>

                    {/* Stat pills */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as React.CSSProperties['flexWrap'] }}>
                        {[
                            { label: "Today's P&L", value: formatPnl(todayPnl), color: pnlColor(todayPnl) },
                            { label: 'Total P&L', value: formatPnl(totalPnl), color: pnlColor(totalPnl) },
                            { label: 'Win Rate', value: closedTrades.length ? `${winRate}%` : '—', color: winRate >= 50 ? '#10b981' : '#f59e0b' },
                            { label: 'Record', value: closedTrades.length ? `${wins}W / ${losses}L` : '—', color: 'rgba(255,255,255,0.7)' },
                        ].map(s => (
                            <div key={s.label} style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: 10, padding: '10px 16px',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                                minWidth: 72,
                            }}>
                                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.35)' }}>{s.label}</div>
                                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Consolas, monospace', color: s.color }}>{s.value}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Main Grid ─────────────────────────────────────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>

                    {/* ─── LEFT: Agent Roster ─────────────────────────────── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{
                            background: 'rgba(255,255,255,0.025)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: 14, overflow: 'hidden',
                        }}>
                            <div style={{
                                padding: '14px 18px',
                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}>
                                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)' }}>
                                    Fleet // {AGENTS.length} Agents
                                </span>
                                <span style={{
                                    fontSize: 9, fontFamily: 'Consolas, monospace', fontWeight: 700,
                                    padding: '2px 8px', borderRadius: 4,
                                    background: liveAgentCount > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)',
                                    color: liveAgentCount > 0 ? '#10b981' : '#6b7280',
                                    letterSpacing: 1,
                                }}>
                                    {liveAgentCount} ACTIVE
                                </span>
                            </div>

                            {/* Column headers */}
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.2fr 0.7fr 0.7fr 80px', gap: 0, padding: '7px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                {['Agent', 'Strategy', 'Assets', 'R:R', 'Risk', 'Status'].map(h => (
                                    <span key={h} style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>{h}</span>
                                ))}
                            </div>

                            {/* Agent rows */}
                            {AGENTS.map(agent => {
                                const status = getAgentStatus(agent);
                                const isLive = status === 'LIVE';
                                const isIdle = status === 'IDLE';
                                const statusColor = isLive ? '#10b981' : isIdle ? '#f59e0b' : '#374151';
                                const data = agentData[agent.id] as any;
                                const agentPnl = data?.performance?.total_pnl;
                                return (
                                    <div
                                        key={agent.id}
                                        className="agent-row"
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '2fr 1.5fr 1.2fr 0.7fr 0.7fr 80px',
                                            alignItems: 'center',
                                            gap: 0,
                                            padding: '11px 18px',
                                            borderBottom: '1px solid rgba(255,255,255,0.035)',
                                            borderLeft: `3px solid ${isLive ? agent.color : 'transparent'}`,
                                            transition: 'all 0.15s ease',
                                            cursor: 'default',
                                        }}
                                    >
                                        {/* Name */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                            <span style={{ fontSize: 16 }}>{agent.emoji}</span>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: isLive ? 'white' : 'rgba(255,255,255,0.7)' }}>{agent.name}</div>
                                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{agent.role}</div>
                                            </div>
                                        </div>
                                        {/* Strategy */}
                                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', paddingRight: 8 }}>{agent.strategy}</div>
                                        {/* Assets */}
                                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' as React.CSSProperties['flexWrap'] }}>
                                            {agent.assets.slice(0, 2).map(a => (
                                                <span key={a} style={{
                                                    fontSize: 9, fontFamily: 'Consolas, monospace',
                                                    background: `${agent.color}15`,
                                                    border: `1px solid ${agent.color}30`,
                                                    color: agent.color,
                                                    padding: '1px 5px', borderRadius: 3,
                                                }}>{a}</span>
                                            ))}
                                            {agent.assets.length > 2 && (
                                                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'Consolas, monospace' }}>+{agent.assets.length - 2}</span>
                                            )}
                                        </div>
                                        {/* RR */}
                                        <div style={{ fontSize: 12, fontFamily: 'Consolas, monospace', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{agent.rTarget}</div>
                                        {/* Risk */}
                                        <div style={{ fontSize: 12, fontFamily: 'Consolas, monospace', color: '#f59e0b' }}>{agent.riskPct}%</div>
                                        {/* Status + P&L */}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                <span style={{
                                                    width: 7, height: 7, borderRadius: '50%',
                                                    background: statusColor,
                                                    boxShadow: isLive ? `0 0 6px ${statusColor}` : 'none',
                                                    animation: isLive ? 'pulse 2s infinite' : 'none',
                                                    flexShrink: 0,
                                                }} />
                                                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: statusColor, textTransform: 'uppercase' }}>
                                                    {status}
                                                </span>
                                            </div>
                                            {agentPnl !== undefined && (
                                                <span style={{ fontSize: 10, fontFamily: 'Consolas, monospace', color: pnlColor(agentPnl), fontWeight: 700 }}>
                                                    {formatPnl(agentPnl)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* System Components */}
                            <div style={{ padding: '8px 18px 12px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>System</div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    {SYSTEM_COMPONENTS.map(sc => (
                                        <div key={sc.id} style={{
                                            flex: 1, display: 'flex', alignItems: 'center', gap: 9,
                                            background: 'rgba(255,255,255,0.025)',
                                            border: `1px solid ${sc.color}20`,
                                            borderRadius: 8, padding: '8px 12px',
                                        }}>
                                            <span style={{ fontSize: 16 }}>{sc.emoji}</span>
                                            <div>
                                                <div style={{ fontSize: 12, fontWeight: 700 }}>{sc.name}</div>
                                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{sc.role}</div>
                                            </div>
                                            <div style={{
                                                marginLeft: 'auto', fontSize: 8, fontWeight: 700,
                                                background: `${sc.color}20`, color: sc.color,
                                                border: `1px solid ${sc.color}40`,
                                                padding: '2px 6px', borderRadius: 4, letterSpacing: 0.5,
                                            }}>ON</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─── RIGHT: Live Data ──────────────────────────────────── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* Open Positions */}
                        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                            <div style={{ padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)' }}>Open Positions</span>
                                <span style={{
                                    fontSize: 11, fontFamily: 'Consolas, monospace', fontWeight: 700,
                                    color: openTrades.length > 0 ? '#06b6d4' : 'rgba(255,255,255,0.25)',
                                }}>{openTrades.length}</span>
                            </div>
                            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                                {openTrades.length === 0 ? (
                                    <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12, fontFamily: 'Consolas, monospace' }}>No open positions</div>
                                ) : (
                                    openTrades.map((t, i) => (
                                        <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Consolas, monospace', minWidth: 60 }}>{t.symbol}</span>
                                            <span style={{
                                                fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                                                background: t.direction === 'LONG' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                                color: t.direction === 'LONG' ? '#10b981' : '#ef4444',
                                            }}>{t.direction}</span>
                                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Consolas, monospace' }}>{Number(t.entry_price).toFixed(4)}</span>
                                            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{timeSince(t.entry_date)}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Recent Signals */}
                        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                            <div style={{ padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)' }}>Signal Feed</span>
                                <span style={{ fontSize: 9, fontFamily: 'Consolas, monospace', color: 'rgba(255,255,255,0.25)' }}>LIVE</span>
                            </div>
                            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                                {signals.length === 0 ? (
                                    <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12, fontFamily: 'Consolas, monospace' }}>No signals</div>
                                ) : (
                                    signals.slice(0, 8).map((sig, i) => {
                                        const isBuy = ['BUY', 'LONG'].includes(sig.action?.toUpperCase());
                                        const isSell = ['SELL', 'SHORT'].includes(sig.action?.toUpperCase());
                                        return (
                                            <div key={i} style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'Consolas, monospace', minWidth: 56 }}>{sig.symbol}</span>
                                                <span style={{
                                                    fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                                                    background: isBuy ? 'rgba(16,185,129,0.15)' : isSell ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                                                    color: isBuy ? '#10b981' : isSell ? '#ef4444' : '#f59e0b',
                                                }}>{sig.action}</span>
                                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sig.strategy || '—'}</span>
                                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'Consolas, monospace' }}>{timeSince(sig.timestamp || sig.created_at)}</span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Performance */}
                        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                            <div style={{ padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)' }}>Performance</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
                                {[
                                    { label: 'P&L', value: formatPnl(totalPnl), color: pnlColor(totalPnl) },
                                    { label: 'Win Rate', value: closedTrades.length ? `${winRate}%` : '—', color: winRate >= 50 ? '#10b981' : '#f59e0b' },
                                    { label: 'Trades', value: `${wins}W/${losses}L`, color: 'white' },
                                ].map((item, i) => (
                                    <div key={i} style={{
                                        padding: '14px 16px', textAlign: 'center',
                                        borderRight: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                    }}>
                                        <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>{item.label}</div>
                                        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Consolas, monospace', color: item.color }}>{item.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>

                {/* ── Footer ─────────────────────────────────────────────── */}
                <div style={{ marginTop: 20, textAlign: 'center', color: 'rgba(255,255,255,0.12)', fontSize: 10, fontFamily: 'Consolas, monospace', letterSpacing: 1 }}>
                    ⚡ SWJSH-AK // REFRESHES 15s // {new Date().toISOString().slice(0, 19)}Z
                </div>
            </div>
        </div>
    );
}
