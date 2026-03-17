'use client';

// ═══════════════════════════════════════════════════════════════
// ECON CALENDAR WIDGET
// "Trade aware. Never surprised."
//
// Real-time economic calendar showing:
//  - Today's event timeline (sorted, color-coded by impact)
//  - Live countdown to next event
//  - Active blackout / warning windows (fleet-wide)
//  - Per-event: forecast vs actual, affected symbols
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Calendar, AlertTriangle, CheckCircle, Clock, Zap, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';

// ─── Types (inlined to avoid server-only import issues) ──────────────────────

interface EconEvent {
    id: string;
    title: string;
    shortTitle: string;
    country: string;
    scheduledAt: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW' | 'HOLIDAY';
    forecast: string | null;
    previous: string | null;
    actual: string | null;
    source: string;
    affectedSymbols: string[];
    affectedMarkets: string[];
    category: string;
    blackoutBeforeMin: number;
    blackoutAfterMin: number;
}

interface EventWindow {
    event: EconEvent;
    phase: string;
    minutesUntil: number;
    minutesSince: number;
    riskLevel: string;
    recommendation: string;
    statusLabel: string;
}

interface CalendarData {
    todayEvents: EconEvent[];
    upcomingEvents: EconEvent[];
    activeWindows: EventWindow[];
    nextEvent: EconEvent | null;
    minutesUntilNext: number | null;
    overallRecommendation: string;
    source: string;
    lastFetched: string | null;
    stats: {
        totalToday: number;
        highImpactToday: number;
        activeWindows: number;
        inBlackout: boolean;
    };
}

// ─── Color Helpers ────────────────────────────────────────────────────────────

function impactColor(impact: string): string {
    switch (impact) {
        case 'HIGH':   return '#ef4444';
        case 'MEDIUM': return '#f97316';
        case 'LOW':    return '#eab308';
        default:       return 'rgba(255,255,255,0.2)';
    }
}

function phaseColor(phase: string): string {
    switch (phase) {
        case 'LIVE':          return '#ef4444';
        case 'CRITICAL':      return '#ef4444';
        case 'POST_VOLATILE': return '#f97316';
        case 'IMMINENT':      return '#f97316';
        case 'APPROACHING':   return '#eab308';
        case 'COOLING':       return '#06b6d4';
        default:              return 'rgba(255,255,255,0.2)';
    }
}

function recColor(rec: string): { bg: string; border: string; text: string; label: string } {
    switch (rec) {
        case 'NO_TRADE':    return { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', text: '#ef4444',  label: '🔴 NO TRADE' };
        case 'HOLD_NEW':    return { bg: 'rgba(249,115,22,0.12)', border: '#f97316', text: '#f97316', label: '🟠 HOLD NEW ENTRIES' };
        case 'REDUCE_SIZE': return { bg: 'rgba(234,179,8,0.10)', border: '#eab308', text: '#eab308',  label: '⚠️ REDUCE SIZE' };
        case 'CAUTION':     return { bg: 'rgba(234,179,8,0.07)', border: '#eab308', text: '#a16207',  label: '⚡ CAUTION' };
        default:            return { bg: 'transparent',          border: 'rgba(255,255,255,0.08)', text: '#10b981', label: '✓ ALL CLEAR' };
    }
}

function categoryEmoji(cat: string): string {
    switch (cat) {
        case 'CENTRAL_BANK': return '🏦';
        case 'INFLATION':    return '📊';
        case 'EMPLOYMENT':   return '👷';
        case 'GDP':          return '📈';
        case 'PMI':          return '🏭';
        case 'RETAIL':       return '🛍️';
        case 'HOUSING':      return '🏠';
        case 'TRADE':        return '⚖️';
        case 'TREASURY':     return '💰';
        case 'SESSION':      return '🕐';
        default:             return '📅';
    }
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function useCountdown(scheduledAt: string | null): string {
    const [display, setDisplay] = useState('');
    useEffect(() => {
        if (!scheduledAt) { setDisplay(''); return; }
        const tick = () => {
            const diff = new Date(scheduledAt).getTime() - Date.now();
            if (diff <= 0) { setDisplay('NOW'); return; }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setDisplay(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
        };
        tick();
        const t = setInterval(tick, 1000);
        return () => clearInterval(t);
    }, [scheduledAt]);
    return display;
}

// ─── Format Helpers ───────────────────────────────────────────────────────────

function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
}

function formatMinutesAgo(minutes: number): string {
    if (minutes <= 0) return 'upcoming';
    if (minutes < 60) return `${Math.round(minutes)}m ago`;
    return `${Math.round(minutes / 60)}h ago`;
}

// ─── Event Row ────────────────────────────────────────────────────────────────

function EventRow({ event, window: win, now }: { event: EconEvent; window?: EventWindow; now: Date }) {
    const [expanded, setExpanded] = useState(false);
    const eventTime = new Date(event.scheduledAt);
    const isPast = eventTime < now;
    const minutesUntil = (eventTime.getTime() - now.getTime()) / 60000;
    const isLive = win && (win.phase === 'LIVE' || win.phase === 'CRITICAL');
    const isActive = win && !['DISTANT', 'CLEAR'].includes(win.phase);

    const iColor = impactColor(event.impact);
    const borderL = isLive ? `3px solid ${iColor}` : `3px solid rgba(255,255,255,0.06)`;

    return (
        <div
            style={{
                marginBottom: 6,
                borderRadius: 8,
                background: isLive
                    ? 'rgba(239,68,68,0.06)'
                    : isActive
                    ? 'rgba(249,115,22,0.04)'
                    : isPast
                    ? 'rgba(255,255,255,0.02)'
                    : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isLive ? 'rgba(239,68,68,0.3)' : isActive ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.06)'}`,
                borderLeft: borderL,
                overflow: 'hidden',
                opacity: isPast && !isActive ? 0.55 : 1,
            }}
        >
            {/* Main row */}
            <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer' }}
                onClick={() => setExpanded(p => !p)}
            >
                {/* Impact dot */}
                <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: iColor, flexShrink: 0,
                    boxShadow: isLive ? `0 0 8px ${iColor}` : 'none',
                }} />

                {/* Time */}
                <div style={{
                    width: 64, flexShrink: 0,
                    fontSize: 11, fontFamily: 'monospace',
                    color: isLive ? iColor : isPast ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.65)',
                }}>
                    {formatTime(event.scheduledAt)}
                </div>

                {/* Country flag badge */}
                <div style={{
                    padding: '1px 6px', borderRadius: 4,
                    fontSize: 10, fontWeight: 700, flexShrink: 0,
                    background: `${iColor}20`, color: iColor,
                    border: `1px solid ${iColor}40`,
                }}>
                    {event.country}
                </div>

                {/* Category emoji */}
                <span style={{ fontSize: 13, flexShrink: 0 }}>{categoryEmoji(event.category)}</span>

                {/* Title */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: 13, fontWeight: 600,
                        color: isLive ? '#fff' : 'rgba(255,255,255,0.88)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                        {event.title}
                    </div>
                    {win && isActive && (
                        <div style={{ fontSize: 10, color: phaseColor(win.phase), marginTop: 1 }}>
                            {win.statusLabel}
                        </div>
                    )}
                </div>

                {/* Actual / Forecast chips */}
                <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center' }}>
                    {event.actual && (
                        <div style={{
                            padding: '2px 7px', borderRadius: 4,
                            fontSize: 10, fontWeight: 700,
                            background: 'rgba(16,185,129,0.15)', color: '#10b981',
                            border: '1px solid rgba(16,185,129,0.3)',
                        }}>
                            A: {event.actual}
                        </div>
                    )}
                    {event.forecast && !event.actual && (
                        <div style={{
                            padding: '2px 7px', borderRadius: 4,
                            fontSize: 10, fontWeight: 600,
                            background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                        }}>
                            F: {event.forecast}
                        </div>
                    )}
                    {!isPast && (
                        <div style={{
                            fontSize: 10, fontFamily: 'monospace',
                            color: minutesUntil < 30 ? '#f97316' : 'rgba(255,255,255,0.35)',
                        }}>
                            {minutesUntil > 0 && minutesUntil < 999 ? `${Math.round(minutesUntil)}m` : ''}
                        </div>
                    )}
                </div>

                {/* Expand arrow */}
                <div style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
                    {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </div>
            </div>

            {/* Expanded detail */}
            {expanded && (
                <div style={{
                    padding: '8px 12px 10px 12px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', flexWrap: 'wrap', gap: 12,
                }}>
                    {/* Data row */}
                    <div style={{ display: 'flex', gap: 16 }}>
                        {event.forecast && (
                            <div>
                                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Forecast</div>
                                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: '#06b6d4' }}>{event.forecast}</div>
                            </div>
                        )}
                        {event.previous && (
                            <div>
                                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Previous</div>
                                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: 'rgba(255,255,255,0.55)' }}>{event.previous}</div>
                            </div>
                        )}
                        {event.actual && (
                            <div>
                                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Actual</div>
                                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#10b981' }}>{event.actual}</div>
                            </div>
                        )}
                    </div>

                    {/* Affected symbols */}
                    <div style={{ width: '100%' }}>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Affected Pairs</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {event.affectedSymbols.map(sym => (
                                <span key={sym} style={{
                                    padding: '2px 6px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace',
                                    background: 'rgba(6,182,212,0.1)', color: '#06b6d4',
                                    border: '1px solid rgba(6,182,212,0.2)',
                                }}>{sym}</span>
                            ))}
                        </div>
                    </div>

                    {/* Blackout info */}
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                        Blackout: {event.blackoutBeforeMin}m before · {event.blackoutAfterMin}m after
                        &nbsp;&nbsp;|&nbsp;&nbsp;Source: {event.source}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Widget ──────────────────────────────────────────────────────────────

interface EconCalendarProps {
    compact?: boolean;
}

export default function EconCalendar({ compact = false }: EconCalendarProps) {
    const [data, setData] = useState<CalendarData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(new Date());
    const [showAll, setShowAll] = useState(false);

    const countdown = useCountdown(data?.nextEvent?.scheduledAt ?? null);

    const fetchCalendar = useCallback(async () => {
        try {
            const res = await fetch('/api/intel/calendar');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setData(json);
            setError(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const forceRefresh = async () => {
        setRefreshing(true);
        await fetch('/api/intel/calendar', { method: 'POST' });
        await fetchCalendar();
        setRefreshing(false);
    };

    // Clock tick
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(t);
    }, []);

    // Data refresh
    useEffect(() => {
        fetchCalendar();
        const t = setInterval(fetchCalendar, 60000); // Re-fetch every minute
        return () => clearInterval(t);
    }, [fetchCalendar]);

    // ── Render: loading ──
    if (loading) {
        return (
            <div style={{
                padding: '20px', borderRadius: 12, textAlign: 'center',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Loading economic calendar…</div>
            </div>
        );
    }

    const rec = data?.overallRecommendation ?? 'NORMAL';
    const recStyle = recColor(rec);
    const today = data?.todayEvents ?? [];
    const windows = data?.activeWindows ?? [];
    const displayEvents = showAll || compact ? today : today.slice(0, 6);

    return (
        <div style={{
            borderRadius: 14, overflow: 'hidden',
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${recStyle.border}`,
        }}>
            {/* Accent bar */}
            <div style={{ height: 3, background: `linear-gradient(90deg, #f97316, #ef4444)` }} />

            <div style={{ padding: compact ? '14px 16px' : '18px 20px' }}>

                {/* ── Header ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Calendar size={15} style={{ color: '#f97316' }} />
                        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            Economic Calendar
                        </span>
                        {data?.source === 'LIVE' && (
                            <span style={{
                                padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                                background: 'rgba(16,185,129,0.15)', color: '#10b981',
                                border: '1px solid rgba(16,185,129,0.25)', letterSpacing: '0.06em',
                            }}>LIVE</span>
                        )}
                        {data?.source === 'FALLBACK' && (
                            <span style={{
                                padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                                background: 'rgba(249,115,22,0.15)', color: '#f97316',
                                border: '1px solid rgba(249,115,22,0.25)', letterSpacing: '0.06em',
                            }}>HEURISTIC</span>
                        )}
                    </div>
                    <button
                        onClick={forceRefresh}
                        disabled={refreshing}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                            background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)',
                            color: '#f97316', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                        }}
                    >
                        <RefreshCw size={11} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        REFRESH
                    </button>
                </div>

                {/* ── Overall Recommendation Banner ── */}
                <div style={{
                    padding: '10px 14px', borderRadius: 8, marginBottom: 14,
                    background: recStyle.bg,
                    border: `1px solid ${recStyle.border}40`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {rec === 'NORMAL'
                            ? <CheckCircle size={14} style={{ color: '#10b981' }} />
                            : <AlertTriangle size={14} style={{ color: recStyle.text }} />
                        }
                        <span style={{ fontSize: 13, fontWeight: 800, color: recStyle.text, letterSpacing: '0.05em' }}>
                            {recStyle.label}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em' }}>EVENTS TODAY</div>
                            <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: 'rgba(255,255,255,0.8)' }}>
                                {data?.stats?.totalToday ?? 0}
                                <span style={{ fontSize: 10, color: '#ef4444', marginLeft: 4 }}>
                                    {data?.stats?.highImpactToday ? `${data.stats.highImpactToday} HIGH` : ''}
                                </span>
                            </div>
                        </div>
                        {data?.nextEvent && (
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em' }}>NEXT EVENT</div>
                                <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: '#f97316' }}>
                                    {countdown}
                                </div>
                                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
                                    {data.nextEvent.shortTitle}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Active Windows Alert ── */}
                {windows.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                            ⚡ Active Windows
                        </div>
                        {windows.slice(0, 3).map(w => (
                            <div key={`${w.event.id}-${w.phase}`} style={{
                                padding: '6px 10px', marginBottom: 4, borderRadius: 6,
                                background: `${phaseColor(w.phase)}15`,
                                border: `1px solid ${phaseColor(w.phase)}35`,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Zap size={11} style={{ color: phaseColor(w.phase) }} />
                                    <span style={{ fontSize: 11, fontWeight: 700, color: phaseColor(w.phase) }}>
                                        {w.event.shortTitle}
                                    </span>
                                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                                        ({w.event.country})
                                    </span>
                                </div>
                                <div style={{ fontSize: 10, color: phaseColor(w.phase), fontFamily: 'monospace' }}>
                                    {w.statusLabel}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Today's Timeline ── */}
                {!compact && (
                    <>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                            <Clock size={10} style={{ display: 'inline', marginRight: 4 }} />
                            Today's Schedule
                        </div>

                        {today.length === 0 ? (
                            <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
                                No major events scheduled today
                            </div>
                        ) : (
                            <>
                                {displayEvents.map(event => {
                                    const win = windows.find(w => w.event.id === event.id);
                                    return <EventRow key={event.id} event={event} window={win} now={now} />;
                                })}
                                {today.length > 6 && (
                                    <button
                                        onClick={() => setShowAll(p => !p)}
                                        style={{
                                            width: '100%', marginTop: 6, padding: '6px',
                                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: 6, cursor: 'pointer', fontSize: 11,
                                            color: 'rgba(255,255,255,0.45)',
                                        }}
                                    >
                                        {showAll ? '▲ Show less' : `▼ Show ${today.length - 6} more events`}
                                    </button>
                                )}
                            </>
                        )}
                    </>
                )}

                {/* ── Compact mode: just upcoming in next 3h ── */}
                {compact && data?.upcomingEvents && (
                    <div>
                        {data.upcomingEvents.slice(0, 4).map(event => {
                            const win = windows.find(w => w.event.id === event.id);
                            return <EventRow key={event.id} event={event} window={win} now={now} />;
                        })}
                        {data.upcomingEvents.length === 0 && (
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '8px 0' }}>
                                No events in the next 24h
                            </div>
                        )}
                    </div>
                )}

                {/* ── Footer ── */}
                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
                        {data?.lastFetched
                            ? `Updated ${new Date(data.lastFetched).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : 'Not yet fetched'
                        }
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ fontSize: 9, color: '#ef4444' }}>🔴 HIGH</span>
                        <span style={{ fontSize: 9, color: '#f97316' }}>🟠 MED</span>
                        <span style={{ fontSize: 9, color: '#eab308' }}>🟡 LOW</span>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
