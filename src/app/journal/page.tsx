"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Download, BarChart2, TrendingUp, TrendingDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import TradeList from "@/components/Journal/TradeList";
import EntryForm from "@/components/Journal/EntryForm";
import AnalyticsHeader from "@/components/Journal/AnalyticsHeader";
import { Trade } from "@/types";

export default function JournalPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
    const [importingTrades, setImportingTrades] = useState(false);

    // Protect route
    useEffect(() => {
        if (!loading && !user) {
            router.replace('/login');
        }
    }, [user, loading, router]);

    // Fetch recent closed trades on mount
    const fetchRecentTrades = useCallback(async () => {
        try {
            const response = await fetch('/api/trades?status=CLOSED&limit=20');
            if (response.ok) {
                const data = await response.json();
                setRecentTrades(data);
            }
        } catch (error) {
            console.error('Failed to fetch recent trades:', error);
        }
    }, []);

    useEffect(() => {
        fetchRecentTrades();
    }, [fetchRecentTrades]);

    // Handle trade import
    const handleImportTrades = async () => {
        if (recentTrades.length === 0) return;

        setImportingTrades(true);
        try {
            // Import each recent trade as a journal entry
            for (const trade of recentTrades) {
                await fetch('/api/journal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tradeId: trade.id,
                        strategy: trade.strategy,
                        symbol: trade.symbol,
                        entry_price: trade.entry_price,
                        exit_price: trade.exit_price,
                        pnl: trade.pnl ?? 0,
                        notes: `Auto-imported from closed trade: ${trade.symbol}`,
                    }),
                });
            }
            setRecentTrades([]);
            setRefreshKey(prev => prev + 1);
        } catch (error) {
            console.error('Failed to import trades:', error);
        } finally {
            setImportingTrades(false);
        }
    };

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0a0a12',
                color: 'rgba(255,255,255,0.5)'
            }}>
                <div>🔐 Verifying authentication...</div>
            </div>
        );
    }

    if (!user) return null;

    const handleSuccess = () => {
        setShowForm(false);
        setRefreshKey(prev => prev + 1);
    };

    // Calculate performance metrics (this is defined earlier in the file)
    const calculateMetrics = () => {
        if (trades.length === 0) {
            return {
                totalTrades: 0,
                winRate: 0,
                expectancy: 0,
                bestTrade: 0,
                worstTrade: 0,
                totalPnl: 0,
                byStrategy: {} as Record<string, { wins: number; total: number; rate: number }>,
            };
        }

        const totalTrades = trades.length;
        const closedTrades = trades.filter(t => t.exit_price && t.pnl !== undefined);
        const winningTrades = closedTrades.filter(t => (t.pnl ?? 0) > 0).length;
        const winRate = closedTrades.length > 0 ? (winningTrades / closedTrades.length) * 100 : 0;
        const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const expectancy = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;
        const bestTrade = closedTrades.length > 0 ? Math.max(...closedTrades.map(t => t.pnl || 0)) : 0;
        const worstTrade = closedTrades.length > 0 ? Math.min(...closedTrades.map(t => t.pnl || 0)) : 0;

        // Group by strategy
        const byStrategy: Record<string, { wins: number; total: number; rate: number }> = {};
        closedTrades.forEach(trade => {
            const strategy = trade.strategy || 'Unknown';
            if (!byStrategy[strategy]) {
                byStrategy[strategy] = { wins: 0, total: 0, rate: 0 };
            }
            byStrategy[strategy].total += 1;
            if ((trade.pnl ?? 0) > 0) {
                byStrategy[strategy].wins += 1;
            }
            byStrategy[strategy].rate = (byStrategy[strategy].wins / byStrategy[strategy].total) * 100;
        });

        return { totalTrades, winRate, expectancy, bestTrade, worstTrade, totalPnl, byStrategy };
    };

    const metrics = calculateMetrics();

    return (
        <div style={{
            minHeight: '100vh',
            padding: '24px 28px',
            background: '#0a0a12'
        }}>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight">TRADE JOURNAL</h2>
                    <p className="text-[var(--color-text-muted)] text-sm mt-1 uppercase tracking-widest">Performance Tracking & Strategy Refinement</p>
                </div>
                <div className="flex gap-3 items-center">
                    {recentTrades.length > 0 && (
                        <button
                            className="flex items-center gap-2 bg-[hsl(271,77%,62%)] text-white px-6 py-3 rounded-[var(--radius-md)] font-bold hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98] relative disabled:opacity-50"
                            onClick={handleImportTrades}
                            disabled={importingTrades}
                        >
                            <Download size={18} />
                            IMPORT TRADES
                            <span style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                background: '#06b6d4',
                                color: 'black',
                                borderRadius: '50%',
                                width: '24px',
                                height: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: 'bold'
                            }}>
                                {recentTrades.length}
                            </span>
                        </button>
                    )}
                    <button
                        className="flex items-center gap-2 bg-[hsl(var(--brand-primary))] text-black px-6 py-3 rounded-[var(--radius-md)] font-bold hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        onClick={() => setShowForm(true)}
                    >
                        <Plus size={18} />
                        ADD ENTRY
                    </button>
                </div>
            </div>

            {/* Performance Summary Bar */}
            <div style={{
                background: 'rgba(6, 182, 212, 0.05)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(6, 182, 212, 0.2)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px 24px',
                marginBottom: '24px'
            }}>
                <div className="flex gap-4 mb-4 flex-wrap">
                    {/* Total Trades */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        minWidth: '120px'
                    }}>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Trades</span>
                        <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#06b6d4', marginTop: '4px' }}>{metrics.totalTrades}</span>
                    </div>

                    {/* Win Rate */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        minWidth: '120px'
                    }}>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>Win Rate</span>
                        <span style={{
                            fontSize: '20px',
                            fontWeight: 'bold',
                            color: metrics.winRate >= 50 ? '#10b981' : '#ef4444',
                            marginTop: '4px'
                        }}>
                            {metrics.winRate.toFixed(1)}%
                        </span>
                    </div>

                    {/* Expectancy */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        minWidth: '120px'
                    }}>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>Expectancy</span>
                        <span style={{
                            fontSize: '20px',
                            fontWeight: 'bold',
                            color: metrics.expectancy >= 0 ? '#10b981' : '#ef4444',
                            marginTop: '4px'
                        }}>
                            ${metrics.expectancy.toFixed(2)}
                        </span>
                    </div>

                    {/* Best Trade */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        minWidth: '120px'
                    }}>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>Best Trade</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                            <TrendingUp size={16} style={{ color: '#10b981' }} />
                            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#10b981' }}>
                                ${metrics.bestTrade.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* Worst Trade */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        minWidth: '120px'
                    }}>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>Worst Trade</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                            <TrendingDown size={16} style={{ color: '#ef4444' }} />
                            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#ef4444' }}>
                                ${metrics.worstTrade.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Strategy Breakdown */}
                {Object.keys(metrics.byStrategy).length > 0 && (
                    <div>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>By Strategy</span>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                            {Object.entries(metrics.byStrategy).map(([strategy, data]) => (
                                <div
                                    key={strategy}
                                    style={{
                                        background: data.rate >= 50 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                        border: data.rate >= 50 ? '1px solid #10b981' : '1px solid #ef4444',
                                        padding: '6px 12px',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        color: data.rate >= 50 ? '#10b981' : '#ef4444'
                                    }}
                                >
                                    {strategy}: {data.rate.toFixed(0)}% ({data.wins}/{data.total})
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <AnalyticsHeader trades={trades} />

            <TradeList key={refreshKey} onDataLoad={setTrades} />

            {showForm && (
                <EntryForm
                    onClose={() => setShowForm(false)}
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    );
}

