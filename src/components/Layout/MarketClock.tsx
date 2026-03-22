'use client';

import React, { useEffect, useState, useMemo } from 'react';
import styles from './MarketClock.module.css';

// ─── Market Sessions (ET hours) ───────────────────────────────────────────────
const SESSIONS = [
    { name: 'Sydney',   abbr: 'SYD', flag: '🇦🇺', open: 17, close: 2,  color: '#6366f1' },
    { name: 'Tokyo',    abbr: 'TKY', flag: '🇯🇵', open: 19, close: 4,  color: '#06b6d4' },
    { name: 'London',   abbr: 'LDN', flag: '🇬🇧', open: 3,  close: 12, color: '#10b981' },
    { name: 'New York', abbr: 'NYC', flag: '🇺🇸', open: 8,  close: 17, color: '#f59e0b' },
] as const;

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
    const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    return ((utcH + etOffset) + 24) % 24;
}

function getETTimeString(): string {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    });
}

function isSessionOpen(session: typeof SESSIONS[number]): boolean {
    const h = getETHour();
    if (session.open < session.close) return h >= session.open && h < session.close;
    return h >= session.open || h < session.close;
}

function getSessionSegments(session: typeof SESSIONS[number]): { startPct: number; widthPct: number }[] {
    const { open, close } = session;
    if (open < close) {
        return [{ startPct: (open / 24) * 100, widthPct: ((close - open) / 24) * 100 }];
    }
    return [
        { startPct: 0, widthPct: (close / 24) * 100 },
        { startPct: (open / 24) * 100, widthPct: ((24 - open) / 24) * 100 },
    ];
}

function sessionProgress(session: typeof SESSIONS[number]): number {
    const h = getETHour();
    const duration = session.open < session.close
        ? session.close - session.open
        : (24 - session.open) + session.close;
    if (!isSessionOpen(session)) return 0;
    const elapsed = session.open <= h ? h - session.open : (24 - session.open) + h;
    return Math.min(100, (elapsed / duration) * 100);
}

export default function MarketClock() {
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const t = setInterval(() => setTick(n => n + 1), 1000);
        return () => clearInterval(t);
    }, []);

    const hourNow = getETHour();
    const etTimeStr = getETTimeString();
    const nowPct = (hourNow / 24) * 100;

    const openSessions = SESSIONS.filter(s => isSessionOpen(s));

    const nextEvent = useMemo(() => {
        return ECO_EVENTS
            .map(ev => ({ ...ev, hoursUntil: (ev.time - hourNow + 24) % 24 }))
            .sort((a, b) => a.hoursUntil - b.hoursUntil)[0];
    }, [hourNow]);

    return (
        <div className={styles.wrapper}>
            {/* ── Left: label + session tags + time ── */}
            <div className={styles.infoColumn}>
                <div className={styles.clockLabel}>24HR MARKET CLOCK</div>
                <div className={styles.sessionTags}>
                    {openSessions.length > 0 ? (
                        openSessions.map(s => (
                            <span
                                key={s.name}
                                className={styles.sessionTag}
                                style={{ color: s.color, borderColor: `${s.color}40`, background: `${s.color}10` }}
                            >
                                <span className={styles.tagDot} style={{ background: s.color, boxShadow: `0 0 4px ${s.color}` }} />
                                {s.abbr}
                            </span>
                        ))
                    ) : (
                        <span className={styles.sessionTagClosed}>ALL CLOSED</span>
                    )}
                </div>
            </div>

            {/* ── Center: full inline timeline ── */}
            <div className={styles.timelineArea}>
                {/* Timeline content area — everything uses same coordinate space */}
                <div className={styles.timelineInner}>
                    {/* Session rows stacked */}
                    {SESSIONS.map(sess => {
                        const open = isSessionOpen(sess);
                        const segments = getSessionSegments(sess);
                        return (
                            <div key={sess.name} className={styles.sessionRow}>
                                <span className={styles.rowLabel} style={{ color: open ? sess.color : undefined }}>{sess.abbr}</span>
                                <div className={styles.rowTrack}>
                                    {segments.map((seg, i) => (
                                        <div
                                            key={i}
                                            className={styles.rowBlock}
                                            style={{
                                                left: `${seg.startPct}%`,
                                                width: `${seg.widthPct}%`,
                                                background: open ? `${sess.color}60` : `${sess.color}18`,
                                                borderColor: open ? `${sess.color}70` : `${sess.color}20`,
                                                boxShadow: open ? `0 0 6px ${sess.color}30` : 'none',
                                            }}
                                        />
                                    ))}

                                    {/* NOW needle per-row so it aligns with track exactly */}
                                    <div className={styles.rowNeedle} style={{ left: `${nowPct}%` }} />
                                </div>
                            </div>
                        );
                    })}

                    {/* Hour scale */}
                    <div className={styles.hourScale}>
                        {[0, 4, 8, 12, 16, 20].map(h => (
                            <span key={h} className={styles.hourTick} style={{ left: `${(h / 24) * 100}%` }}>
                                {h.toString().padStart(2, '0')}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Right: ET time + next event ── */}
            <div className={styles.timeColumn}>
                <span className={styles.etTime}>{etTimeStr}</span>
                <span className={styles.etLabel}>EASTERN</span>
                {nextEvent && (
                    <div className={styles.nextEvent}>
                        <span className={styles.nextDot} style={{ background: nextEvent.color }} />
                        <span className={styles.nextText}>
                            {nextEvent.label} {nextEvent.hoursUntil < 1
                                ? `${Math.round(nextEvent.hoursUntil * 60)}m`
                                : `${nextEvent.hoursUntil.toFixed(1)}h`}
                        </span>
                    </div>
                )}
            </div>

            {/* ── Hover detail panel (expanded view) ── */}
            <div className={styles.detailPanel}>
                <div className={styles.detailHeader}>
                    <span className={styles.detailTitle}>24-HR MARKET CLOCK // EASTERN TIME</span>
                    <span className={styles.detailTime}>{etTimeStr} ET</span>
                </div>

                <div className={styles.fullTimeline}>
                    <div className={styles.hourMarkers}>
                        {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].map(h => (
                            <span key={h} className={styles.fullHourLabel} style={{ left: `${(h / 24) * 100}%` }}>
                                {h.toString().padStart(2, '0')}
                            </span>
                        ))}
                    </div>

                    {SESSIONS.map(sess => {
                        const open = isSessionOpen(sess);
                        const segments = getSessionSegments(sess);
                        const progress = sessionProgress(sess);
                        return (
                            <div key={sess.name} className={styles.fullRow}>
                                <div className={styles.fullRowLabel} style={{ color: open ? sess.color : undefined }}>
                                    {sess.flag} {sess.name}
                                    {open && <span className={styles.fullRowPct}>{Math.round(progress)}%</span>}
                                </div>
                                <div className={styles.fullRowTrack}>
                                    {segments.map((seg, i) => (
                                        <div
                                            key={i}
                                            className={styles.fullRowBlock}
                                            style={{
                                                left: `${seg.startPct}%`,
                                                width: `${seg.widthPct}%`,
                                                background: open ? `${sess.color}55` : `${sess.color}15`,
                                                borderColor: open ? `${sess.color}80` : `${sess.color}20`,
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    <div className={styles.fullEventsRow}>
                        {ECO_EVENTS.map(ev => {
                            const isPast = hourNow > ev.time;
                            const isNear = Math.abs(hourNow - ev.time) < 0.5;
                            return (
                                <div key={ev.label} className={styles.fullEventMarker} style={{ left: `${(ev.time / 24) * 100}%` }}>
                                    <div className={styles.fullEventLine} style={{ background: isPast ? 'rgba(255,255,255,0.08)' : ev.color, opacity: isNear ? 1 : 0.7 }} />
                                    <span className={styles.fullEventLabel} style={{ color: isPast ? 'rgba(255,255,255,0.2)' : ev.color }}>
                                        {ev.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    <div className={styles.fullNowCursor} style={{ left: `${nowPct}%` }}>
                        <div className={styles.fullNowLine} />
                    </div>
                </div>

                {nextEvent && (
                    <div className={styles.detailNext}>
                        <span className={styles.detailNextLabel}>NEXT EVENT:</span>
                        <span className={styles.detailNextName} style={{ color: nextEvent.color }}>{nextEvent.label}</span>
                        <span className={styles.detailNextDesc}>{nextEvent.desc}</span>
                        <span className={styles.detailNextCountdown}>
                            in {nextEvent.hoursUntil < 1
                                ? `${Math.round(nextEvent.hoursUntil * 60)}m`
                                : `${nextEvent.hoursUntil.toFixed(1)}h`}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
