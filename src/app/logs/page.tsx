"use client";

import React, { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useAgentContext } from "@/context/AgentContext";
import EntryForm from "@/components/Journal/EntryForm";
import AnalyticsHeader from "@/components/Journal/AnalyticsHeader";
import LogFilters from "@/components/Logs/LogFilters";
import LogEntryRow from "@/components/Logs/LogEntryRow";
import { Trade } from "@/types";
import styles from "./page.module.css";

export default function MissionLogsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [agentFilter, setAgentFilter] = useState<string>('all');
    const [limit, setLimit] = useState(20);
    const { agents } = useAgentContext();

    // Protect route
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/login');
        }
    }, [user, authLoading, router]);

    // Fetch trades from API - must be before conditional returns (React hooks rule)
    useEffect(() => {
        if (!user) return; // Don't fetch if no user
        async function fetchTrades() {
            setLoading(true); // Show loading state on refetch
            try {
                // Dynamic limit based on slider
                const res = await fetch(`/api/journal?limit=${limit}`);
                if (res.ok) {
                    const data = await res.json();
                    setTrades(data);
                }
            } catch (err) {
                console.error("Failed to fetch trades", err);
            } finally {
                setLoading(false);
            }
        }
        fetchTrades();
    }, [user, limit]);

    if (authLoading) {
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

    // Get all closed trades from agents
    const getAgentTrades = () => {
        if (!agents) return [];

        const agentTrades: any[] = [];
        Object.entries(agents).forEach(([agentId, agent]) => {
            if (agent.closed_trades) {
                agent.closed_trades.forEach((trade: any) => {
                    agentTrades.push({
                        ...trade,
                        agentId,
                        agentName: agent.meta?.name || agentId,
                        agentType: agent.meta?.type,
                        // Match with reviews/audits if available
                        review: agent.reviews?.find((r: any) => r.trade_id === trade.id),
                        audit: agent.audits?.find((a: any) => a.trade_id === trade.id),
                    });
                });
            }
        });
        return agentTrades;
    };

    const agentTrades = getAgentTrades();

    // Combine manual trades with agent trades
    const allTrades = [
        ...trades.map(t => ({ ...t, source: 'manual' as const })),
        ...agentTrades.map(t => ({ ...t, source: 'agent' as const }))
    ].sort((a, b) => {
        const dateA = new Date(a.entry_date || a.created_at || 0);
        const dateB = new Date(b.entry_date || b.created_at || 0);
        return dateB.getTime() - dateA.getTime();
    });

    // Filter trades logic
    const filteredTrades = allTrades.filter(t => {
        if (agentFilter === 'all') return true;
        if (agentFilter === 'wins') return (t.pnl || 0) > 0;
        if (agentFilter === 'losses') return (t.pnl || 0) < 0;
        return t.agentId === agentFilter;
    });

    // Get unique agents for filter
    const uniqueAgents = agents ? Object.entries(agents)
        .filter(([id]) => !['professor', 'auditor'].includes(id))
        .map(([id, agent]) => ({
            id,
            name: agent.meta?.name || id
        })) : [];

    const handleSuccess = () => {
        setShowForm(false);
        // Refetch trades
        fetch("/api/journal")
            .then(res => res.json())
            .then(data => setTrades(data))
            .catch(console.error);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h2 className={styles.title}>Mission Logs</h2>
                    <p className={styles.subtitle}>System of Record • Tactical Analysis</p>
                </div>
                <button className={styles.addBtn} onClick={() => setShowForm(true)}>
                    <Plus size={18} />
                    New Entry
                </button>
            </div>

            <AnalyticsHeader trades={trades} />

            <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <LogFilters
                    currentFilter={agentFilter}
                    onFilterChange={setAgentFilter}
                    agents={uniqueAgents}
                />

                {/* Limit Slider */}
                <div className={styles.limitControl} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        Display {limit} entries
                    </span>
                    <input
                        type="range"
                        min="10"
                        max="100"
                        step="10"
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        style={{
                            accentColor: '#22d3ee',
                            cursor: 'pointer',
                            width: '120px'
                        }}
                    />
                </div>
            </div>

            {loading ? (
                <div className={styles.loadingState}>Decrypting Archives...</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filteredTrades.length === 0 ? (
                        <div className={styles.emptyState}>No mission records found matching current criteria.</div>
                    ) : (
                        filteredTrades.map((trade, idx) => (
                            <LogEntryRow
                                key={`${trade.source}-${trade.id || idx}`}
                                trade={trade}
                            />
                        ))
                    )}
                </div>
            )}

            {showForm && (
                <EntryForm
                    onClose={() => setShowForm(false)}
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    );
}
