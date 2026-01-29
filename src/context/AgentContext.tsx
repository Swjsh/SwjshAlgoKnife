'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Agent state interface matching agents_db.json
interface AgentPerformance {
    win_rate: number;
    total_pnl: number;
    trades: number;
}

interface AgentMeta {
    name: string;
    type: string;
}

interface Trade {
    ticker: string;
    entry: number;
    exit?: number;
    stop?: number;
    side?: string;
    type?: string;
    pnl?: number;
    status?: string;
    created_at?: string;
    closed_at?: string;
}

export interface AgentState {
    last_updated: string;
    status: string;
    active_pairs: number;
    total_zones_found: number;
    performance: AgentPerformance;
    pending_orders: Trade[];
    active_trades: Trade[];
    closed_trades: Trade[];
    reviews?: any[];
    audits?: any[];
    meta: AgentMeta;
}

interface AgentContextData {
    agents: Record<string, AgentState>;
    isLoading: boolean;
    error: string | null;
    lastUpdate: Date | null;

    // Computed values
    totalPnL: number;
    activeTradesCount: number;
    systemStatus: 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE';
    allActiveTrades: (Trade & { agentId: string; agentName: string })[];

    // Actions
    refresh: () => Promise<void>;
}

const AgentContext = createContext<AgentContextData | undefined>(undefined);

export function AgentProvider({ children }: { children: ReactNode }) {
    const [agents, setAgents] = useState<Record<string, AgentState>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    const fetchAgents = async () => {
        try {
            const res = await fetch('/api/agents');
            if (!res.ok) throw new Error('Failed to fetch agent data');
            const data = await res.json();
            setAgents(data);
            setLastUpdate(new Date());
            setError(null);
        } catch (err: any) {
            console.error('[AgentContext] Fetch error:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Initial fetch and polling
    useEffect(() => {
        fetchAgents();

        // Poll every 30 seconds (reduce log noise)
        const interval = setInterval(fetchAgents, 30000);
        return () => clearInterval(interval);
    }, []);

    // Computed values
    const totalPnL = Object.values(agents).reduce((sum, agent) => {
        return sum + (agent.performance?.total_pnl || 0);
    }, 0);

    const activeTradesCount = Object.values(agents).reduce((sum, agent) => {
        return sum + (agent.active_trades?.length || 0);
    }, 0);

    const allActiveTrades = Object.entries(agents).flatMap(([agentId, agent]) => {
        return (agent.active_trades || []).map(trade => ({
            ...trade,
            agentId,
            agentName: agent.meta?.name || agentId
        }));
    });

    const systemStatus = (() => {
        const activeAgents = Object.values(agents).filter(a =>
            a.status === 'ACTIVE' || a.status === 'ONLINE'
        ).length;
        if (activeAgents === 0) return 'OFFLINE';
        if (activeAgents < Object.keys(agents).length) return 'DEGRADED';
        return 'OPERATIONAL';
    })();

    const contextValue: AgentContextData = {
        agents,
        isLoading,
        error,
        lastUpdate,
        totalPnL,
        activeTradesCount,
        systemStatus,
        allActiveTrades,
        refresh: fetchAgents
    };

    return (
        <AgentContext.Provider value={contextValue}>
            {children}
        </AgentContext.Provider>
    );
}

export function useAgentContext() {
    const context = useContext(AgentContext);
    if (context === undefined) {
        throw new Error('useAgentContext must be used within an AgentProvider');
    }
    return context;
}

// Convenience hooks
export function useSquadStatus() {
    const { agents, totalPnL, activeTradesCount, systemStatus } = useAgentContext();

    const activeAgents = Object.entries(agents)
        .filter(([_, a]) => a.active_trades?.length > 0)
        .map(([id, a]) => ({
            id,
            name: a.meta?.name || id,
            trade: a.active_trades[0]
        }));

    const topPerformer = Object.entries(agents)
        .filter(([id]) => !['professor', 'auditor'].includes(id))
        .sort(([, a], [, b]) => (b.performance?.total_pnl || 0) - (a.performance?.total_pnl || 0))
    [0];

    return {
        totalPnL,
        activeTradesCount,
        systemStatus,
        activeAgents,
        topPerformer: topPerformer ? {
            id: topPerformer[0],
            name: topPerformer[1].meta?.name || topPerformer[0],
            pnl: topPerformer[1].performance?.total_pnl || 0
        } : null
    };
}

export function useAgent(agentId: string) {
    const { agents } = useAgentContext();
    return agents[agentId] || null;
}
