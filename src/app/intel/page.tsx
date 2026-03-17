'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Brain, RefreshCw, Wifi, WifiOff, AlertTriangle, ShieldAlert, ShieldCheck, ShieldOff, Zap } from 'lucide-react';
import SignalCard from '@/components/intel/SignalCard';
import type { IntelSignal, IntelSource } from '@/lib/intel/types';
import type { EconEvent, EventWindow } from '@/lib/intel/econ/types';
import {
    SOURCE_REGISTRY,
    ALL_INTEL_SOURCES,
    PREMIUM_SOURCES as PREMIUM_SRC,
    FREE_SOURCES as FREE_SRC,
    WATCHED_SYMBOLS as WATCHED_SYM,
} from '@/lib/intel/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ServiceHealth {
    lastHeartbeat: string | null;
    status: 'RUNNING' | 'STALE' | 'DEAD' | 'NOT_STARTED' | 'ERROR';
    signalsPublished: number;
}
type HealthMap = Record<string, ServiceHealth>;

interface ScoreData {
    symbol: string;
    score: {
        score: number;
        sizeMultiplier: number;
        reason: string;
        signalCount: number;
        breakdown: Record<string, { direction: string; confidence: number }>;
    };
    signals: IntelSignal[];
}

interface CalendarData {
    todayEvents: EconEvent[];
    upcomingEvents: EconEvent[];
    activeWindows: EventWindow[];
    nextEvent: EconEvent | null;
    minutesUntilNext: number | null;
    overallRecommendation: 'NORMAL' | 'CAUTION' | 'REDUCE_SIZE' | 'HOLD_NEW' | 'NO_TRADE';
    source: 'LIVE' | 'CACHE' | 'FALLBACK';
    lastFetched: string | null;
    stats: { totalToday: number; highImpactToday: number; activeWindows: number; inBlackout: boolean };
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SOURCE_LABELS = Object.fromEntries(ALL_INTEL_SOURCES.map(s => [s, SOURCE_REGISTRY[s].label])) as Record<IntelSource, string>;
const SOURCE_COLORS = Object.fromEntries(ALL_INTEL_SOURCES.map(s => [s, SOURCE_REGISTRY[s].color])) as Record<IntelSource, string>;
const SOURCE_EMOJIS = Object.fromEntries(ALL_INTEL_SOURCES.map(s => [s, SOURCE_REGISTRY[s].emoji])) as Record<IntelSource, string>;

const WATCHED_SYMBOLS = WATCHED_SYM;
const PREMIUM_SOURCES = PREMIUM_SRC;
const FREE_SOURCES    = FREE_SRC;
const ALL_SOURCES     = ALL_INTEL_SOURCES;

const FILTER_OPTIONS: Array<{ label: string; value: IntelSource | 'ALL' | 'FREE' }> = [
    { label: 'All', value: 'ALL' },
    { label: 'Free', value: 'FREE' },
    ...ALL_INTEL_SOURCES.map(s => ({ label: `${SOURCE_REGISTRY[s].emoji} ${SOURCE_REGISTRY[s].label}`, value: s as IntelSource })),
];

const ASSET_CLASSES: Record<string, string[]> = {
    'Crypto':    ['BTC', 'ETH', 'SOL', 'XRP', 'BTCUSD', 'ETHUSD', 'SOLUSD'],
    'Equities':  ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA', 'AMZN', 'META'],
    'Forex':     ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD'],
    'Futures':   ['ES', 'NQ', 'RTY', 'YM', 'CL', 'GC'],
};

const ASSET_FILTER_OPTIONS: Array<{ label: string; value: 'All' | keyof typeof ASSET_CLASSES }> = [
    { label: 'All', value: 'All' }, { label: 'Crypto', value: 'Crypto' },
    { label: 'Equities', value: 'Equities' }, { label: 'Forex', value: 'Forex' }, { label: 'Futures', value: 'Futures' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
    if (!iso) return 'never';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
}

function fmtEventTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }) + ' ET';
}

function statusColor(s: string): string {
    switch (s) {
        case 'RUNNING': return '#10b981';
        case 'STALE':   return '#f59e0b';
        case 'DEAD': case 'ERROR': return '#ef4444';
        default: return '#475569';
    }
}

function scoreColor(s: number): string {
    if (s > 0.3) return '#10b981';
    if (s < -0.1) return '#ef4444';
    return '#f59e0b';
}

function scoreLabel(s: number): string {
    if (s > 0.3) return '▲ BULLISH';
    if (s < -0.1) return '▼ BEARISH';
    return '● MIXED';
}

function impactColor(impact: string): string {
    switch (impact) {
        case 'HIGH':   return '#ef4444';
        case 'MEDIUM': return '#f59e0b';
        case 'LOW':    return '#10b981';
        default:       return '#475569';
    }
}

function recConfig(rec: string): { color: string; bg: string; label: string; icon: string } {
    switch (rec) {
        case 'NO_TRADE':    return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: 'NO TRADE — BLACKOUT',     icon: '🚫' };
        case 'HOLD_NEW':    return { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   label: 'HOLD NEW ENTRIES',         icon: '⛔' };
        case 'REDUCE_SIZE': return { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'REDUCE POSITION SIZE',     icon: '⚠️' };
        case 'CAUTION':     return { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: 'CAUTION — REDUCED SIZING', icon: '⚡' };
        default:            return { color: '#10b981', bg: 'rgba(16,185,129,0.08)', label: 'CLEAR TO TRADE',           icon: '✅' };
    }
}

function phaseColor(phase: string): string {
    switch (phase) {
        case 'CRITICAL':      return '#ef4444';
        case 'IMMINENT':      return '#f59e0b';
        case 'LIVE':          return '#ef4444';
        case 'APPROACHING':   return '#f59e0b';
        case 'POST_VOLATILE': return '#f59e0b';
        case 'COOLING':       return '#06b6d4';
        case 'CLEAR':         return '#10b981';
        default:              return '#475569';
    }
}

function isHighValueEvent(e: EconEvent): boolean {
    const keywords = ['CPI', 'NFP', 'FOMC', 'Non-Farm', 'Consumer Price', 'Federal Funds', 'GDP', 'PCE', 'Payroll'];
    return keywords.some(k => e.title.toLowerCase().includes(k.toLowerCase()) || (e.shortTitle || '').toUpperCase().includes(k.toUpperCase()));
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, overflow: 'hidden',
            ...style,
        }}>
            {children}
        </div>
    );
}

function PanelHeader({ label, right }: { label: string; right?: React.ReactNode }) {
    return (
        <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)' }}>
                {label}
            </span>
            {right}
        </div>
    );
}

function EconEventRow({ event, window: win }: { event: EconEvent; window?: EventWindow }) {
    const ic   = impactColor(event.impact);
    const isHV = isHighValueEvent(event);
    const phase = win?.phase;
    const pColor = phase ? phaseColor(phase) : null;
    const hasActual = event.actual && event.actual.trim() !== '';

    return (
        <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            borderLeft: `3px solid ${isHV ? ic : 'transparent'}`,
            background: win ? `${ic}06` : 'transparent',
            display: 'grid',
            gridTemplateColumns: '1fr auto auto auto',
            alignItems: 'center',
            gap: 12,
        }}>
            {/* Event info */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                        background: `${ic}20`, color: ic, letterSpacing: 0.5,
                    }}>{event.impact}</span>
                    {isHV && <span style={{ fontSize: 9, color: ic, fontWeight: 700 }}>★</span>}
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>
                        {event.shortTitle || event.title}
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{event.country}</span>
                </div>
                {phase && pColor && (
                    <span style={{
                        fontSize: 9, fontFamily: 'Consolas, monospace',
                        color: pColor, fontWeight: 700, letterSpacing: 0.5,
                        animation: ['CRITICAL','LIVE','IMMINENT'].includes(phase) ? 'pulse 1.5s infinite' : 'none',
                    }}>
                        {phase.replace('_', ' ')}
                    </span>
                )}
            </div>

            {/* Forecast / Actual / Previous */}
            <div style={{ display: 'flex', gap: 12, fontSize: 11, fontFamily: 'Consolas, monospace' }}>
                {event.forecast && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: 0.5, marginBottom: 2 }}>FCST</div>
                        <div style={{ color: 'rgba(255,255,255,0.6)' }}>{event.forecast}</div>
                    </div>
                )}
                {hasActual && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: 0.5, marginBottom: 2 }}>ACT</div>
                        <div style={{ color: '#10b981', fontWeight: 700 }}>{event.actual}</div>
                    </div>
                )}
                {event.previous && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: 0.5, marginBottom: 2 }}>PREV</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)' }}>{event.previous}</div>
                    </div>
                )}
            </div>

            {/* Time */}
            <div style={{ fontSize: 11, fontFamily: 'Consolas, monospace', color: 'rgba(255,255,255,0.4)', textAlign: 'right' }}>
                {fmtEventTime(event.scheduledAt)}
            </div>

            {/* Minutes until */}
            {win && (
                <div style={{
                    fontSize: 10, fontFamily: 'Consolas, monospace', fontWeight: 700,
                    color: pColor || '#475569', textAlign: 'right', minWidth: 44,
                }}>
                    {win.minutesUntil > 0 ? `-${Math.round(win.minutesUntil)}m` : `+${Math.round(win.minutesSince)}m`}
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IntelPage() {
    const [signals, setSignals]             = useState<IntelSignal[]>([]);
    const [health, setHealth]               = useState<HealthMap>({});
    const [scores, setScores]               = useState<Record<string, ScoreData>>({});
    const [calendar, setCalendar]           = useState<CalendarData | null>(null);
    const [filter, setFilter]               = useState<IntelSource | 'ALL' | 'FREE'>('ALL');
    const [assetFilter, setAssetFilter]     = useState<'All' | keyof typeof ASSET_CLASSES>('All');
    const [freeFeedsStarted, setFreeFeedsStarted] = useState(false);
    const [loading, setLoading]             = useState(true);
    const [calLoading, setCalLoading]       = useState(false);
    const [lastRefresh, setLastRefresh]     = useState<Date>(new Date());
    const [sseConnected, setSseConnected]   = useState(false);
    const eventSourceRef = useRef<EventSource | null>(null);

    // ── Data fetching ────────────────────────────────────────────

    const fetchSignals = useCallback(async () => {
        try {
            const res = await fetch('/api/intel?limit=60');
            const data = await res.json();
            if (data.signals) setSignals(data.signals);
        } catch {}
    }, []);

    const fetchHealth = useCallback(async () => {
        try {
            const res = await fetch('/api/health');
            const data = await res.json();
            if (data.services) setHealth(data.services);
        } catch {}
    }, []);

    const fetchScores = useCallback(async () => {
        const results: Record<string, ScoreData> = {};
        await Promise.all(
            WATCHED_SYMBOLS.map(async (sym) => {
                try {
                    const res = await fetch(`/api/intel/score?symbol=${sym}&direction=LONG`);
                    if (res.ok) results[sym] = await res.json();
                } catch {}
            })
        );
        setScores(results);
    }, []);

    const fetchCalendar = useCallback(async () => {
        setCalLoading(true);
        try {
            const res = await fetch('/api/intel/calendar');
            if (res.ok) {
                const data = await res.json();
                setCalendar(data);
            }
        } catch {} finally {
            setCalLoading(false);
        }
    }, []);

    const refreshAll = useCallback(async () => {
        setLoading(true);
        await Promise.all([fetchSignals(), fetchHealth(), fetchScores(), fetchCalendar()]);
        setLastRefresh(new Date());
        setLoading(false);
    }, [fetchSignals, fetchHealth, fetchScores, fetchCalendar]);

    // ── SSE ──────────────────────────────────────────────────────

    useEffect(() => {
        const es = new EventSource('/api/intel/stream');
        eventSourceRef.current = es;
        es.addEventListener('init', (e: MessageEvent) => {
            const data = JSON.parse(e.data);
            if (data.signals) setSignals(data.signals);
            if (data.health) setHealth(data.health);
            setSseConnected(true);
        });
        es.addEventListener('intel', (e: MessageEvent) => {
            const signal = JSON.parse(e.data) as IntelSignal;
            setSignals(prev => {
                if (signal.id && prev.some(s => s.id === signal.id)) return prev;
                return [signal, ...prev].slice(0, 100);
            });
        });
        es.addEventListener('health', (e: MessageEvent) => {
            const data = JSON.parse(e.data);
            if (data.health) setHealth(data.health);
        });
        es.onerror = () => setSseConnected(false);
        return () => { es.close(); setSseConnected(false); };
    }, []);

    useEffect(() => {
        let cancelled = false;
        fetch('/api/intel/free-feeds?start=true')
            .then(r => r.json())
            .then(data => { if (!cancelled) setFreeFeedsStarted(data.running === true); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        refreshAll();
        const interval = setInterval(refreshAll, 15 * 1000);
        return () => clearInterval(interval);
    }, [refreshAll]);

    // Calendar refresh every 60s
    useEffect(() => {
        const t = setInterval(fetchCalendar, 60 * 1000);
        return () => clearInterval(t);
    }, [fetchCalendar]);

    // ── Derived ──────────────────────────────────────────────────

    const filteredSymbols = assetFilter === 'All' ? WATCHED_SYMBOLS : (ASSET_CLASSES[assetFilter] || []);

    const filteredSignals = (() => {
        let sigs = filter === 'ALL' ? signals
            : filter === 'FREE' ? signals.filter(s => FREE_SOURCES.includes(s.source))
            : signals.filter(s => s.source === filter);
        return sigs.filter(s => filteredSymbols.includes(s.symbol));
    })();

    const totalSignals   = signals.length;
    const bullishCount   = signals.filter(s => s.direction === 'BULLISH').length;
    const bearishCount   = signals.filter(s => s.direction === 'BEARISH').length;
    const neutralCount   = totalSignals - bullishCount - bearishCount;

    const topHits = filteredSymbols
        .map(sym => ({ symbol: sym, data: scores[sym] || null }))
        .filter(item => item.data !== null)
        .sort((a, b) => Math.abs(b.data?.score.score ?? 0) - Math.abs(a.data?.score.score ?? 0))
        .slice(0, 6);

    // Build a map from eventId → EventWindow for the calendar
    const windowMap = new Map<string, EventWindow>();
    calendar?.activeWindows?.forEach(w => windowMap.set(w.event.id, w));

    const todayHighImpact = calendar?.todayEvents?.filter(e => e.impact === 'HIGH') ?? [];
    const todayAll        = calendar?.todayEvents ?? [];
    const rec             = calendar?.overallRecommendation ?? 'NORMAL';
    const recCfg          = recConfig(rec);

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div style={{ minHeight: '100vh', background: 'hsl(222,47%,11%)', color: 'white', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

            <style>{`
                @keyframes spin  { to { transform: rotate(360deg); } }
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
                @keyframes glow  { 0%,100%{box-shadow:0 0 4px #06b6d4} 50%{box-shadow:0 0 12px #06b6d4} }
                * { box-sizing: border-box; }
                ::-webkit-scrollbar { width: 4px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(6,182,212,0.25); border-radius: 2px; }
                .filter-btn:hover { opacity: 0.85; }
            `}</style>

            <div style={{ padding: '20px 28px' }}>

                {/* ── Header ────────────────────────────────────────────── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Brain size={22} color="#06b6d4" />
                        <div>
                            <h1 style={{
                                margin: 0, fontSize: 22, fontWeight: 700,
                                background: 'linear-gradient(135deg, #06b6d4, #a855f7)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                                letterSpacing: '0.05em',
                            }}>
                                INTELLIGENCE CENTER
                            </h1>
                            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'Consolas, monospace', letterSpacing: 1 }}>
                                MARKET INTEL // 8 DATA SOURCES // {freeFeedsStarted ? '4 FREE FEEDS ACTIVE' : 'FEEDS STARTING'}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'Consolas, monospace', color: sseConnected ? '#10b981' : '#f59e0b' }}>
                            {sseConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
                            <span>{sseConnected ? 'LIVE' : 'POLLING'}</span>
                        </div>
                        <button
                            onClick={refreshAll}
                            style={{
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 8, padding: '6px 14px', color: 'rgba(255,255,255,0.5)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                                fontFamily: 'Consolas, monospace',
                            }}
                        >
                            <RefreshCw size={12} style={loading ? { animation: 'spin 0.8s linear infinite' } : {}} />
                            {loading ? 'SYNCING' : timeAgo(lastRefresh.toISOString())}
                        </button>
                    </div>
                </div>

                {/* ── Economic Calendar Panel ──────────────────────────── */}
                <div style={{
                    background: 'rgba(0,0,0,0.35)',
                    border: `1px solid ${recCfg.color}30`,
                    borderRadius: 14, marginBottom: 20,
                    overflow: 'hidden', position: 'relative',
                }}>
                    {/* Corner accents */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: 28, height: 28, borderTop: `2px solid ${recCfg.color}50`, borderLeft: `2px solid ${recCfg.color}50`, borderTopLeftRadius: 14, pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderBottom: `2px solid rgba(255,255,255,0.06)`, borderRight: `2px solid rgba(255,255,255,0.06)`, borderBottomRightRadius: 14, pointerEvents: 'none' }} />

                    {/* Calendar header with recommendation */}
                    <div style={{
                        padding: '12px 16px',
                        borderBottom: `1px solid ${recCfg.color}20`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: recCfg.bg,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)' }}>
                                Economic Calendar
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{
                                    fontSize: 9, fontWeight: 700, padding: '2px 9px', borderRadius: 4,
                                    background: `${recCfg.color}20`, color: recCfg.color,
                                    border: `1px solid ${recCfg.color}40`, letterSpacing: 0.5,
                                    animation: ['NO_TRADE','HOLD_NEW','REDUCE_SIZE'].includes(rec) ? 'pulse 2s infinite' : 'none',
                                }}>
                                    {recCfg.icon} {recCfg.label}
                                </span>
                                {calendar?.stats && (
                                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'Consolas, monospace' }}>
                                        {calendar.stats.highImpactToday} HIGH · {calendar.stats.totalToday} events today
                                    </span>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {calendar?.nextEvent && calendar.minutesUntilNext != null && (
                                <span style={{ fontSize: 11, fontFamily: 'Consolas, monospace', color: 'rgba(255,255,255,0.4)' }}>
                                    NEXT: <span style={{ color: impactColor(calendar.nextEvent.impact), fontWeight: 700 }}>
                                        {calendar.nextEvent.shortTitle || calendar.nextEvent.title}
                                    </span>
                                    {' '}in {calendar.minutesUntilNext < 60
                                        ? `${calendar.minutesUntilNext}m`
                                        : `${(calendar.minutesUntilNext / 60).toFixed(1)}h`}
                                </span>
                            )}
                            <span style={{
                                fontSize: 9, color: calendar?.source === 'LIVE' ? '#10b981' : '#f59e0b',
                                fontFamily: 'Consolas, monospace', letterSpacing: 0.5,
                            }}>
                                {calendar?.source || 'LOADING'}
                            </span>
                        </div>
                    </div>

                    {/* Active windows alert */}
                    {calendar?.activeWindows && calendar.activeWindows.length > 0 && (
                        <div style={{
                            padding: '8px 16px',
                            background: 'rgba(239,68,68,0.08)',
                            borderBottom: '1px solid rgba(239,68,68,0.15)',
                            display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                            <AlertTriangle size={13} color="#ef4444" />
                            <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, fontFamily: 'Consolas, monospace' }}>
                                {calendar.activeWindows.length} ACTIVE EVENT WINDOW{calendar.activeWindows.length > 1 ? 'S' : ''} —
                            </span>
                            {calendar.activeWindows.slice(0, 2).map(w => (
                                <span key={w.event.id} style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                                    {w.event.shortTitle || w.event.title} ({w.phase.replace('_', ' ')})
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Events list */}
                    {todayAll.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12, fontFamily: 'Consolas, monospace' }}>
                            {calLoading ? 'Loading calendar...' : 'No economic events today'}
                        </div>
                    ) : (
                        <div>
                            {/* HIGH impact first, then rest */}
                            {[...todayHighImpact, ...todayAll.filter(e => e.impact !== 'HIGH')]
                                .slice(0, 8)
                                .map(event => (
                                    <EconEventRow
                                        key={event.id}
                                        event={event}
                                        window={windowMap.get(event.id)}
                                    />
                                ))}
                            {todayAll.length > 8 && (
                                <div style={{ padding: '8px 16px', fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'Consolas, monospace', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                    + {todayAll.length - 8} more events today
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Stats + Service Health ────────────────────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, marginBottom: 20, alignItems: 'start' }}>

                    {/* Signal stats */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        {[
                            { label: 'Signals', value: totalSignals,  color: '#06b6d4' },
                            { label: 'Bullish',  value: bullishCount,  color: '#10b981' },
                            { label: 'Bearish',  value: bearishCount,  color: '#ef4444' },
                            { label: 'Neutral',  value: neutralCount,  color: 'rgba(255,255,255,0.4)' },
                        ].map(s => (
                            <div key={s.label} style={{
                                background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.07)`,
                                borderRadius: 10, padding: '10px 16px', textAlign: 'center', minWidth: 70,
                            }}>
                                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Consolas, monospace', color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Service health compact */}
                    <Panel>
                        <div style={{ padding: '8px 14px', display: 'flex', flexWrap: 'wrap' as React.CSSProperties['flexWrap'], gap: 6 }}>
                            {ALL_SOURCES.map(src => {
                                const h = health[SOURCE_REGISTRY[src].healthKey] || { lastHeartbeat: null, status: 'NOT_STARTED', signalsPublished: 0 };
                                const color = statusColor(h.status);
                                const isPremium = PREMIUM_SOURCES.includes(src);
                                return (
                                    <div key={src} style={{
                                        display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px',
                                        background: `${color}0f`, border: `1px solid ${color}25`, borderRadius: 6,
                                        fontSize: 10,
                                    }}>
                                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: h.status === 'RUNNING' ? `0 0 4px ${color}` : 'none' }} />
                                        <span style={{ fontFamily: 'Consolas, monospace', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.3 }}>
                                            {SOURCE_EMOJIS[src]} {SOURCE_LABELS[src]}
                                        </span>
                                        {isPremium && <span style={{ fontSize: 8, color: '#a855f7', fontWeight: 700 }}>PRO</span>}
                                        <span style={{ fontSize: 9, color, fontWeight: 700 }}>{h.signalsPublished}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </Panel>
                </div>

                {/* ── Top Scanner Hits ──────────────────────────────────── */}
                {topHits.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
                            Top Conviction Hits
                        </div>
                        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                            {topHits.map(hit => {
                                const score  = hit.data?.score.score ?? 0;
                                const color  = scoreColor(score);
                                const dir    = score > 0.3 ? '▲' : score < -0.1 ? '▼' : '●';
                                return (
                                    <div key={hit.symbol} style={{
                                        background: `${color}0a`,
                                        border: `1px solid ${color}33`,
                                        borderRadius: 10, padding: '12px 14px',
                                        minWidth: 130, flexShrink: 0,
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Consolas, monospace' }}>{hit.symbol}</span>
                                            <span style={{ color, fontSize: 14, fontWeight: 700 }}>{dir}</span>
                                        </div>
                                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Consolas, monospace', color, marginBottom: 4 }}>
                                            {Math.abs(score).toFixed(2)}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: 'Consolas, monospace' }}>
                                            <span>SZ: {Math.round((hit.data?.score.sizeMultiplier ?? 0) * 100)}%</span>
                                            <span>{hit.data?.score.signalCount || 0} sig</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Main 2-col grid ───────────────────────────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

                    {/* Left: Signal Feed */}
                    <Panel>
                        <PanelHeader
                            label="Live Signal Feed"
                            right={
                                <div style={{ display: 'flex', gap: 5 }}>
                                    {FILTER_OPTIONS.slice(0, 4).map(opt => (
                                        <button
                                            key={opt.value}
                                            className="filter-btn"
                                            onClick={() => setFilter(opt.value as any)}
                                            style={{
                                                background: filter === opt.value ? 'rgba(6,182,212,0.15)' : 'transparent',
                                                border: `1px solid ${filter === opt.value ? '#06b6d4' : 'rgba(255,255,255,0.1)'}`,
                                                borderRadius: 5, padding: '3px 9px',
                                                color: filter === opt.value ? '#06b6d4' : 'rgba(255,255,255,0.35)',
                                                fontSize: 10, cursor: 'pointer', fontWeight: filter === opt.value ? 700 : 400,
                                            }}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            }
                        />
                        {/* Asset filter */}
                        <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 5 }}>
                            {ASSET_FILTER_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    className="filter-btn"
                                    onClick={() => setAssetFilter(opt.value)}
                                    style={{
                                        background: assetFilter === opt.value ? 'rgba(168,85,247,0.12)' : 'transparent',
                                        border: `1px solid ${assetFilter === opt.value ? '#a855f7' : 'rgba(255,255,255,0.08)'}`,
                                        borderRadius: 5, padding: '3px 9px',
                                        color: assetFilter === opt.value ? '#a855f7' : 'rgba(255,255,255,0.3)',
                                        fontSize: 10, cursor: 'pointer', fontWeight: assetFilter === opt.value ? 700 : 400,
                                    }}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {filteredSignals.length === 0 ? (
                            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                                <Brain size={32} color="rgba(255,255,255,0.08)" style={{ margin: '0 auto 12px' }} />
                                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13, margin: 0 }}>No active intel signals</p>
                                <p style={{ color: 'rgba(255,255,255,0.12)', fontSize: 11, margin: '6px 0 0' }}>Start intel services to receive data</p>
                            </div>
                        ) : (
                            <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 2 }}>
                                {filteredSignals.map(sig => (
                                    <SignalCard key={`${sig.id}-${sig.timestamp}`} signal={sig} />
                                ))}
                            </div>
                        )}
                    </Panel>

                    {/* Right col */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* Symbol Conviction */}
                        <Panel>
                            <PanelHeader label="Symbol Conviction" />
                            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {filteredSymbols.map(sym => {
                                    const d     = scores[sym];
                                    const score = d?.score.score ?? 0;
                                    const color = d ? scoreColor(score) : 'rgba(255,255,255,0.2)';
                                    const pct   = Math.round((score + 1) / 2 * 100);
                                    return (
                                        <div key={sym} style={{
                                            padding: '10px 12px',
                                            background: `${color}07`,
                                            border: `1px solid ${color}20`,
                                            borderRadius: 8,
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                                                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Consolas, monospace' }}>{sym}</span>
                                                <span style={{
                                                    fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                                                    background: `${color}20`, color, letterSpacing: 0.5,
                                                }}>
                                                    {d ? scoreLabel(score) : '⚫ NO DATA'}
                                                </span>
                                            </div>
                                            {/* Score bar */}
                                            <div style={{ position: 'relative', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                                                <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', background: 'rgba(255,255,255,0.15)' }} />
                                                {d && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: score >= 0 ? '50%' : `${pct}%`,
                                                        width: `${Math.abs(pct - 50)}%`,
                                                        height: '100%', background: color, borderRadius: 2,
                                                    }} />
                                                )}
                                            </div>
                                            {d && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'Consolas, monospace', color: 'rgba(255,255,255,0.35)' }}>
                                                    <span>SIZE: <span style={{ color: '#06b6d4' }}>{Math.round((d.score.sizeMultiplier ?? 0) * 100)}%</span></span>
                                                    <span>{d.score.signalCount} sig{d.score.signalCount !== 1 ? 's' : ''}</span>
                                                    <span style={{ color }}>{score.toFixed(2)}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </Panel>

                        {/* Trade Gate Reference */}
                        <Panel>
                            <PanelHeader label="Trade Gate" />
                            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {[
                                    { mult: '1.0×', label: 'Confirmed  >+0.3',  color: '#10b981' },
                                    { mult: '0.5×', label: 'Mixed  -0.1 to +0.3', color: '#f59e0b' },
                                    { mult: '0.25×', label: 'Opposing  -0.5 to -0.1', color: '#ef4444' },
                                    { mult: '0×',   label: 'Veto  <-0.5',       color: '#7f1d1d' },
                                    { mult: '0.75×', label: 'No data',           color: '#475569' },
                                ].map(row => (
                                    <div key={row.mult} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Consolas, monospace', color: row.color }}>{row.mult}</span>
                                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{row.label}</span>
                                    </div>
                                ))}
                            </div>
                        </Panel>

                    </div>
                </div>

                {/* Footer */}
                <div style={{ marginTop: 20, textAlign: 'center', color: 'rgba(255,255,255,0.1)', fontSize: 10, fontFamily: 'Consolas, monospace', letterSpacing: 1 }}>
                    ⚡ INTEL CENTER // REFRESHES 15s // {new Date().toISOString().slice(0, 19)}Z
                </div>
            </div>
        </div>
    );
}
