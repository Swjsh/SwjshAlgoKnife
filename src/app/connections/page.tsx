'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, ExternalLink, Copy, Check, Wifi, WifiOff, AlertTriangle, Database, Zap } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Credential {
    label: string;
    envVar: string;
    masked: string;
    configured: boolean;
}

interface Connection {
    id: string;
    name: string;
    category: string;
    description: string;
    status: 'CONNECTED' | 'PARTIAL' | 'NOT_CONFIGURED' | 'FREE';
    statusLabel: string;
    icon: string;
    credentials: Credential[];
    docsUrl?: string;
    usedFor: string[];
    agents?: string[];
}

interface ConnectionsData {
    connections: Connection[];
    byCategory: Record<string, Connection[]>;
    summary: { total: number; connected: number; partial: number; missing: number };
    generatedAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORY_ORDER = ['Trading', 'Market Data', 'Intelligence', 'Notifications', 'Auth & Database', 'Infrastructure'];

const CATEGORY_ICONS: Record<string, string> = {
    'Trading': '⚡',
    'Market Data': '📡',
    'Intelligence': '🧠',
    'Notifications': '🔔',
    'Auth & Database': '🔐',
    'Infrastructure': '🏗️',
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        background: 'hsl(222 47% 11%)',
        color: 'hsl(210 40% 96%)',
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        padding: '24px',
    },
    header: {
        marginBottom: '28px',
    },
    titleRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap' as const,
        gap: '12px',
        marginBottom: '8px',
    },
    title: {
        fontSize: '22px',
        fontWeight: 700,
        color: 'hsl(188 95% 70%)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
        margin: 0,
    },
    subtitle: {
        fontSize: '12px',
        color: 'hsl(215 20% 55%)',
        marginTop: '4px',
    },
    refreshBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '7px 14px',
        background: 'rgba(6,182,212,0.1)',
        border: '1px solid rgba(6,182,212,0.3)',
        borderRadius: '6px',
        color: 'hsl(188 95% 70%)',
        fontSize: '11px',
        fontFamily: 'inherit',
        cursor: 'pointer',
        letterSpacing: '0.06em',
        textTransform: 'uppercase' as const,
    },
    // Summary bar
    summaryBar: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px',
        marginBottom: '28px',
    },
    summaryCard: {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '10px',
        padding: '14px 16px',
        textAlign: 'center' as const,
    },
    summaryNum: {
        fontSize: '28px',
        fontWeight: 700,
        lineHeight: 1.1,
    },
    summaryLabel: {
        fontSize: '10px',
        color: 'hsl(215 20% 55%)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.08em',
        marginTop: '4px',
    },
    // Section
    section: {
        marginBottom: '32px',
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
    sectionTitle: {
        fontSize: '12px',
        fontWeight: 600,
        color: 'hsl(215 20% 70%)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.1em',
        margin: 0,
    },
    sectionCount: {
        fontSize: '10px',
        color: 'hsl(215 20% 45%)',
        marginLeft: 'auto',
    },
    // Grid
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '12px',
    },
    // Card
    card: {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '12px',
        padding: '16px',
        transition: 'border-color 0.15s',
        position: 'relative' as const,
        overflow: 'hidden',
    },
    cardHeader: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '8px',
        marginBottom: '8px',
    },
    cardLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        minWidth: 0,
    },
    cardIcon: {
        fontSize: '22px',
        lineHeight: 1,
        flexShrink: 0,
    },
    cardName: {
        fontSize: '13px',
        fontWeight: 600,
        color: 'hsl(210 40% 92%)',
        margin: 0,
        whiteSpace: 'nowrap' as const,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    cardDesc: {
        fontSize: '11px',
        color: 'hsl(215 20% 50%)',
        marginBottom: '12px',
        lineHeight: 1.5,
    },
    // Status badge
    badge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 8px',
        borderRadius: '20px',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase' as const,
        whiteSpace: 'nowrap' as const,
        flexShrink: 0,
    },
    dot: {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        flexShrink: 0,
    },
    // Credentials
    credsList: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '6px',
        marginBottom: '12px',
    },
    credRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '6px 10px',
        background: 'rgba(0,0,0,0.25)',
        borderRadius: '6px',
        minHeight: '30px',
    },
    credLabel: {
        fontSize: '10px',
        color: 'hsl(215 20% 50%)',
        flexShrink: 0,
        minWidth: '80px',
    },
    credValue: {
        fontSize: '11px',
        fontFamily: "'JetBrains Mono', monospace",
        color: 'hsl(210 40% 75%)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const,
        flex: 1,
        textAlign: 'right' as const,
    },
    credMissing: {
        fontSize: '11px',
        color: 'hsl(0 72% 55%)',
        fontStyle: 'italic',
    },
    credEnvVar: {
        fontSize: '9px',
        color: 'hsl(188 95% 50%)',
        fontFamily: "'JetBrains Mono', monospace",
        textAlign: 'right' as const,
    },
    // Used for
    usedFor: {
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: '4px',
        marginTop: '8px',
    },
    tag: {
        padding: '2px 7px',
        borderRadius: '4px',
        fontSize: '9px',
        background: 'rgba(255,255,255,0.06)',
        color: 'hsl(215 20% 55%)',
        letterSpacing: '0.04em',
    },
    agentTag: {
        padding: '2px 7px',
        borderRadius: '4px',
        fontSize: '9px',
        background: 'rgba(168,85,247,0.15)',
        color: 'hsl(271 77% 75%)',
        border: '1px solid rgba(168,85,247,0.2)',
        letterSpacing: '0.04em',
    },
    // Docs link
    docsLink: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '10px',
        color: 'hsl(188 95% 60%)',
        textDecoration: 'none',
        marginTop: '8px',
        opacity: 0.7,
    },
    // Glow accent line at bottom of card
    accentLine: {
        position: 'absolute' as const,
        bottom: 0,
        left: 0,
        right: 0,
        height: '2px',
        borderRadius: '0 0 12px 12px',
    },
    // Copy button
    copyBtn: {
        background: 'none',
        border: 'none',
        padding: '2px 4px',
        cursor: 'pointer',
        color: 'hsl(215 20% 50%)',
        borderRadius: '3px',
        display: 'flex',
        alignItems: 'center',
    },
    separator: {
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        margin: '10px 0',
    },
    noCredsNote: {
        fontSize: '10px',
        color: 'hsl(215 20% 40%)',
        fontStyle: 'italic',
        textAlign: 'center' as const,
        padding: '4px',
    },
};

// ── Status helpers ──────────────────────────────────────────────────────────────

function statusColors(status: Connection['status']) {
    switch (status) {
        case 'CONNECTED':
            return { dot: '#22c55e', badge: 'rgba(34,197,94,0.12)', text: '#4ade80', border: 'rgba(34,197,94,0.35)' };
        case 'FREE':
            return { dot: '#06b6d4', badge: 'rgba(6,182,212,0.12)', text: '#22d3ee', border: 'rgba(6,182,212,0.3)' };
        case 'PARTIAL':
            return { dot: '#f59e0b', badge: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.35)' };
        case 'NOT_CONFIGURED':
            return { dot: '#ef4444', badge: 'rgba(239,68,68,0.1)', text: '#f87171', border: 'rgba(239,68,68,0.25)' };
    }
}

function statusIcon(status: Connection['status']) {
    switch (status) {
        case 'CONNECTED': return <Wifi size={9} />;
        case 'FREE': return <Zap size={9} />;
        case 'PARTIAL': return <AlertTriangle size={9} />;
        case 'NOT_CONFIGURED': return <WifiOff size={9} />;
    }
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const copy = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    return (
        <button style={S.copyBtn} onClick={copy} title="Copy env var name">
            {copied ? <Check size={10} color="#22c55e" /> : <Copy size={10} />}
        </button>
    );
}

function ConnectionCard({ conn }: { conn: Connection }) {
    const colors = statusColors(conn.status);

    return (
        <div style={{ ...S.card, borderColor: `rgba(255,255,255,0.07)` }}>
            {/* Accent line */}
            <div style={{ ...S.accentLine, background: colors.dot, opacity: conn.status === 'NOT_CONFIGURED' ? 0.2 : 0.6 }} />

            {/* Header */}
            <div style={S.cardHeader}>
                <div style={S.cardLeft}>
                    <span style={S.cardIcon}>{conn.icon}</span>
                    <h3 style={S.cardName}>{conn.name}</h3>
                </div>
                <div style={{
                    ...S.badge,
                    background: colors.badge,
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                }}>
                    <span style={{ ...S.dot, background: colors.dot }} />
                    {statusIcon(conn.status)}
                    {conn.statusLabel}
                </div>
            </div>

            {/* Description */}
            <p style={S.cardDesc}>{conn.description}</p>

            {/* Credentials */}
            {conn.credentials.length > 0 ? (
                <div style={S.credsList}>
                    {conn.credentials.map(cred => (
                        <div key={cred.envVar} style={S.credRow}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: '80px' }}>
                                <span style={S.credLabel}>{cred.label}</span>
                                <span style={S.credEnvVar}>{cred.envVar}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
                                {cred.configured && cred.masked ? (
                                    <span style={S.credValue}>{cred.masked}</span>
                                ) : (
                                    <span style={S.credMissing}>not set</span>
                                )}
                                <CopyButton text={cred.envVar} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ ...S.credsList }}>
                    <p style={S.noCredsNote}>No credentials required</p>
                </div>
            )}

            {/* Divider */}
            <div style={S.separator} />

            {/* Used for tags */}
            {conn.usedFor.length > 0 && (
                <div style={S.usedFor}>
                    {conn.usedFor.map(u => <span key={u} style={S.tag}>{u}</span>)}
                    {conn.agents?.map(a => <span key={a} style={S.agentTag}>🤖 {a}</span>)}
                </div>
            )}

            {/* Docs link */}
            {conn.docsUrl && (
                <a href={conn.docsUrl} target="_blank" rel="noreferrer" style={S.docsLink}>
                    Docs <ExternalLink size={9} />
                </a>
            )}
        </div>
    );
}

// ── Main Page ───────────────────────────────────────────────────────────────────

export default function ConnectionsPage() {
    const [data, setData] = useState<ConnectionsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<string>('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/connections');
            if (res.ok) {
                const json = await res.json();
                setData(json);
                setLastUpdated(new Date().toLocaleTimeString());
            }
        } catch (err) {
            console.error('Failed to fetch connections:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const summary = data?.summary;

    return (
        <div style={S.page}>
            {/* Header */}
            <div style={S.header}>
                <div style={S.titleRow}>
                    <div>
                        <h1 style={S.title}>⚡ Data Connections</h1>
                        <p style={S.subtitle}>
                            All API keys, credentials, and external integrations ·{' '}
                            {lastUpdated ? `Last updated ${lastUpdated}` : 'Loading...'}
                        </p>
                    </div>
                    <button
                        style={S.refreshBtn}
                        onClick={fetchData}
                        disabled={loading}
                    >
                        <RefreshCw size={11} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Summary Bar */}
            {summary && (
                <div style={S.summaryBar}>
                    <div style={S.summaryCard}>
                        <div style={{ ...S.summaryNum, color: 'hsl(210 40% 85%)' }}>{summary.total}</div>
                        <div style={S.summaryLabel}>Total Integrations</div>
                    </div>
                    <div style={S.summaryCard}>
                        <div style={{ ...S.summaryNum, color: '#4ade80' }}>{summary.connected}</div>
                        <div style={S.summaryLabel}>Active / Free</div>
                    </div>
                    <div style={S.summaryCard}>
                        <div style={{ ...S.summaryNum, color: '#fbbf24' }}>{summary.partial}</div>
                        <div style={S.summaryLabel}>Partial</div>
                    </div>
                    <div style={S.summaryCard}>
                        <div style={{ ...S.summaryNum, color: '#f87171' }}>{summary.missing}</div>
                        <div style={S.summaryLabel}>Not Configured</div>
                    </div>
                    <div style={{ ...S.summaryCard, background: 'rgba(6,182,212,0.06)', borderColor: 'rgba(6,182,212,0.15)' }}>
                        <div style={{ ...S.summaryNum, color: '#22d3ee' }}>
                            {summary.total > 0 ? Math.round((summary.connected / summary.total) * 100) : 0}%
                        </div>
                        <div style={S.summaryLabel}>Coverage</div>
                    </div>
                </div>
            )}

            {/* Loading state */}
            {loading && !data && (
                <div style={{ textAlign: 'center', color: 'hsl(215 20% 45%)', padding: '40px', fontSize: '12px' }}>
                    <Database size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                    <div>Loading connections...</div>
                </div>
            )}

            {/* Categories */}
            {data && CATEGORY_ORDER.map(category => {
                const connections = data.byCategory[category];
                if (!connections || connections.length === 0) return null;

                const connectedCount = connections.filter(c => c.status === 'CONNECTED' || c.status === 'FREE').length;

                return (
                    <div key={category} style={S.section}>
                        <div style={S.sectionHeader}>
                            <span style={{ fontSize: '14px' }}>{CATEGORY_ICONS[category]}</span>
                            <h2 style={S.sectionTitle}>{category}</h2>
                            <span style={S.sectionCount}>
                                {connectedCount}/{connections.length} active
                            </span>
                        </div>
                        <div style={S.grid}>
                            {connections.map(conn => (
                                <ConnectionCard key={conn.id} conn={conn} />
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* Footer hint */}
            {data && (
                <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)', borderRadius: '8px', fontSize: '11px', color: 'hsl(215 20% 50%)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '14px' }}>💡</span>
                    <span>
                        All credentials are read from your <code style={{ color: 'hsl(188 95% 65%)', background: 'rgba(6,182,212,0.1)', padding: '1px 5px', borderRadius: '3px' }}>.env.local</code> file.
                        Keys are masked server-side — the raw values are never sent to the browser.
                        Click the copy icon next to any credential to copy its environment variable name.
                    </span>
                </div>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
