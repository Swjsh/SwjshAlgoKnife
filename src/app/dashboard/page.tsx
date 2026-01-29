'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAgentContext } from '@/context/AgentContext';

export default function DashboardPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { agents, isLoading, totalPnL, systemStatus } = useAgentContext();

    // Protect route
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/login');
        }
    }, [user, authLoading, router]);

    if (authLoading || isLoading) {
        return (
            <div style={{ 
                minHeight: '100vh', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: '#0a0a12',
                color: 'white'
            }}>
                Loading...
            </div>
        );
    }

    if (!user) return null;

    const agentList = agents ? Object.entries(agents).map(([id, agent]: [string, any]) => ({
        id,
        name: agent.meta?.name || id,
        type: agent.meta?.type || 'Unknown',
        status: agent.status,
        pnl: agent.performance?.total_pnl || 0,
    })) : [];

    const tradingAgents = agentList.filter(a => !['professor', 'auditor'].includes(a.id));

    return (
        <div style={{ padding: 32, background: '#0a0a12', minHeight: '100vh', color: 'white' }}>
            <h1 style={{ marginBottom: 8 }}>Command Center</h1>
            <p style={{ color: '#888', marginBottom: 32 }}>System: {systemStatus} | Total PnL: ${totalPnL}</p>
            
            <h2 style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>TRADING SQUAD</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
                {tradingAgents.map((agent) => (
                    <div
                        key={agent.id}
                        onClick={() => router.push(`/agent/${agent.id}`)}
                        style={{
                            padding: 20,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 12,
                            cursor: 'pointer',
                        }}
                    >
                        <h3 style={{ margin: 0 }}>{agent.name}</h3>
                        <p style={{ color: '#888', margin: '4px 0' }}>{agent.type}</p>
                        <p style={{ 
                            color: agent.pnl >= 0 ? '#10b981' : '#ef4444',
                            fontFamily: 'monospace',
                            margin: 0
                        }}>
                            ${agent.pnl}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}
