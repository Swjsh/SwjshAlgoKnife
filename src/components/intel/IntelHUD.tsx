'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Brain } from 'lucide-react';
import type { IntelSource } from '@/lib/intel/types';
import { SOURCE_REGISTRY } from '@/lib/intel/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BreakdownItem {
    direction: string;
    confidence: number;
}

interface IntelScoreData {
    score: number;
    sizeMultiplier: number;
    reason: string;
    signalCount: number;
    breakdown: Record<IntelSource, BreakdownItem>;
}

interface IntelHUDProps {
    symbol?: string;
    compact?: boolean;
}

// ─── Source metadata ──────────────────────────────────────────────────────────

// Derived from central registry — single source of truth
const SOURCE_EMOJIS: Record<string, string> = Object.fromEntries(
    Object.entries(SOURCE_REGISTRY).map(([k, v]) => [k, v.emoji])
);
const SOURCE_COLORS: Record<string, string> = Object.fromEntries(
    Object.entries(SOURCE_REGISTRY).map(([k, v]) => [k, v.color])
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTrafficLight(score: number | null, signalCount: number): {
    color: string;
    glow: string;
    label: string;
    emoji: string;
} {
    if (signalCount === 0 || score === null) {
        return { color: '#64748B', glow: 'rgba(100,116,139,0.3)', label: 'NO DATA', emoji: '⚫' };
    }
    if (score > 0.3)  return { color: '#10B981', glow: 'rgba(16,185,129,0.3)',  label: 'BULLISH',  emoji: '🟢' };
    if (score < -0.1) return { color: '#EF4444', glow: 'rgba(239,68,68,0.3)',   label: 'BEARISH',  emoji: '🔴' };
    return { color: '#F59E0B', glow: 'rgba(245,158,11,0.3)', label: 'MIXED', emoji: '🟡' };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function IntelHUD({ symbol = 'BTCUSD', compact = false }: IntelHUDProps) {
    const [scoreData, setScoreData] = useState<IntelScoreData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchScore = useCallback(async () => {
        try {
            const res = await fetch(`/api/intel/score?symbol=${symbol}&direction=LONG`);
            if (!res.ok) return;
            const data = await res.json();
            setScoreData(data.score);
        } catch {
            // Silent — HUD should degrade gracefully
        } finally {
            setLoading(false);
        }
    }, [symbol]);

    useEffect(() => {
        fetchScore();
        const interval = setInterval(fetchScore, 15 * 1000);
        return () => clearInterval(interval);
    }, [fetchScore]);

    const light = getTrafficLight(scoreData?.score ?? null, scoreData?.signalCount ?? 0);

    if (compact) {
        // Minimal pill for dashboard header
        return (
            <div
                title={`${symbol} Intel: ${light.label} — ${scoreData?.reason || 'No data'}`}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: '#1E293B',
                    border: `1px solid ${light.color}44`,
                    borderRadius: 20,
                    padding: '4px 10px',
                    fontSize: 11,
                    cursor: 'default',
                    boxShadow: `0 0 8px ${light.glow}`,
                }}
            >
                <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: light.color,
                    boxShadow: `0 0 6px ${light.color}`,
                }} />
                <span style={{ color: '#94A3B8', fontWeight: 600 }}>{symbol}</span>
                <span style={{ color: light.color, fontWeight: 700, letterSpacing: '0.04em' }}>
                    {light.label}
                </span>
                {scoreData && (
                    <span style={{ color: '#64748B' }}>
                        {Math.round(scoreData.sizeMultiplier * 100)}%
                    </span>
                )}
            </div>
        );
    }

    // Full widget
    return (
        <div style={{
            background: '#1E293B',
            border: `1px solid ${light.color}33`,
            borderRadius: 10,
            padding: '12px 16px',
            minWidth: 180,
            boxShadow: `0 0 12px ${light.glow}`,
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Brain size={14} color="#06B6D4" />
                    <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, letterSpacing: '0.06em' }}>
                        {symbol}
                    </span>
                </div>
                <span style={{
                    background: `${light.color}22`,
                    color: light.color,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    letterSpacing: '0.05em',
                }}>
                    {light.emoji} {light.label}
                </span>
            </div>

            {/* Traffic light dot + score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                    width: 16, height: 16, borderRadius: '50%',
                    background: light.color,
                    boxShadow: `0 0 10px ${light.color}`,
                    flexShrink: 0,
                }} />
                <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: light.color, lineHeight: 1 }}>
                        {loading ? '—' : scoreData ? scoreData.score.toFixed(2) : '—'}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748B' }}>
                        {scoreData?.signalCount ?? 0} signal{(scoreData?.signalCount ?? 0) !== 1 ? 's' : ''} ·
                        {' '}{Math.round((scoreData?.sizeMultiplier ?? 0.75) * 100)}% size
                    </div>
                </div>
            </div>

            {/* Source breakdown dots */}
            {scoreData?.breakdown && Object.keys(scoreData.breakdown).length > 0 && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {(Object.entries(scoreData.breakdown) as [IntelSource, BreakdownItem][]).map(([src, data]) => {
                        const dColor = data.direction === 'BULLISH' ? '#10B981'
                                     : data.direction === 'BEARISH' ? '#EF4444'
                                     : '#64748B';
                        return (
                            <div
                                key={src}
                                title={`${src}: ${data.direction} (${Math.round(data.confidence * 100)}%)`}
                                style={{
                                    background: `${SOURCE_COLORS[src]}15`,
                                    border: `1px solid ${SOURCE_COLORS[src]}33`,
                                    borderRadius: 4,
                                    padding: '2px 5px',
                                    fontSize: 10,
                                    color: dColor,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 3,
                                }}
                            >
                                {SOURCE_EMOJIS[src]}
                                <span style={{ color: '#475569' }}>{Math.round(data.confidence * 100)}%</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
