'use client';

import React from 'react';
import type { IntelSignal, IntelSource } from '@/lib/intel/types';
import { SOURCE_REGISTRY } from '@/lib/intel/types';

interface SignalCardProps {
    signal: IntelSignal;
}

// Use the central registry — no more duplicated color/emoji maps
const DIRECTION_META: Record<string, { color: string; bg: string; label: string }> = {
    BULLISH:  { color: '#10B981', bg: 'rgba(16,185,129,0.15)', label: '▲ BULLISH' },
    BEARISH:  { color: '#EF4444', bg: 'rgba(239,68,68,0.15)',  label: '▼ BEARISH' },
    NEUTRAL:  { color: '#94A3B8', bg: 'rgba(148,163,184,0.15)', label: '● NEUTRAL' },
    ALERT:    { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', label: '⚡ ALERT' },
};

function timeAgo(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    if (diff < 0) return 'just now';
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return 'just now';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hrs}h ${remMins}m ago` : `${hrs}h ago`;
}

function ttlRemaining(expiresAt: string): string {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'expired';
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '< 1m left';
    if (mins < 60) return `${mins}m left`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hrs}h ${remMins}m left` : `${hrs}h left`;
}

export default function SignalCard({ signal }: SignalCardProps) {
    const srcMeta = SOURCE_REGISTRY[signal.source] || { label: signal.source, color: '#94A3B8', emoji: '🧠' };
    const dir = DIRECTION_META[signal.direction] || DIRECTION_META.NEUTRAL;

    // Don't render expired signals
    if (signal.expiresAt && new Date(signal.expiresAt).getTime() < Date.now()) {
        return null;
    }

    // Clamp confidence bar to 0-100%
    const confPct = Math.max(0, Math.min(100, Math.round(signal.confidence * 100)));

    return (
        <div style={{
            background: '#1E293B',
            border: `1px solid ${srcMeta.color}22`,
            borderLeft: `3px solid ${srcMeta.color}`,
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
        }}>
            {/* Row 1: Source + Symbol + Direction */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15 }}>{srcMeta.emoji}</span>
                <span style={{ color: srcMeta.color, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {srcMeta.label}
                </span>
                <span style={{ color: '#F8FAFC', fontSize: 13, fontWeight: 700 }}>{signal.symbol}</span>
                <span style={{
                    background: dir.bg,
                    color: dir.color,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                    letterSpacing: '0.05em',
                }}>
                    {dir.label}
                </span>

                {/* Confidence bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                    <div style={{ width: 60, height: 4, background: '#334155', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                            width: `${confPct}%`,
                            height: '100%',
                            background: srcMeta.color,
                            borderRadius: 2,
                        }} />
                    </div>
                    <span style={{ color: srcMeta.color, fontSize: 11, fontWeight: 700, minWidth: 32 }}>
                        {confPct}%
                    </span>
                </div>
            </div>

            {/* Row 2: Summary */}
            {signal.summary && (
                <p style={{ color: '#CBD5E1', fontSize: 12, margin: 0, lineHeight: 1.4 }}>
                    {signal.summary}
                </p>
            )}

            {/* Row 3: Timestamps */}
            <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#64748B' }}>
                {signal.timestamp && <span>{timeAgo(signal.timestamp)}</span>}
                {signal.expiresAt && (
                    <span style={{ color: '#475569' }}>⏱ {ttlRemaining(signal.expiresAt)}</span>
                )}
            </div>
        </div>
    );
}
