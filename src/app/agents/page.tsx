"use client";

import React, { useState, useEffect, Suspense } from 'react';
import styles from './page.module.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useStrategy } from '@/context/StrategyContext';
import AgentSidebar from '@/components/Dashboard/AgentSidebar';
import AgentWorkspace from '@/components/Dashboard/AgentWorkspace';
import CoffeeRoom from '@/components/Dashboard/CoffeeRoom';
import TheLab from '@/components/Dashboard/TheLab';

// Agent configuration list
const agentList = [
    { id: 'fx', name: 'Swjsh FX', role: 'Forex Specialist', initial: 'FX', status: 'active' as const, avatar: '/avatars/fx.png', catchphrase: 'Pips don\'t sleep', performance: { win_rate: 65, total_pnl: 1250 }, active_pairs: 4 },
    { id: 'crypto', name: 'Bitcoin Bob', role: 'Crypto Hunter', initial: 'BB', status: 'active' as const, avatar: '/avatars/crypto.png', catchphrase: 'HODL active', performance: { win_rate: 72, total_pnl: 3400 }, active_pairs: 2 },
    { id: 'spx', name: 'SPX Sniper', role: 'Indices Trader', initial: 'SS', status: 'active' as const, avatar: '/avatars/spx.png', catchphrase: 'Trend is friend', performance: { win_rate: 68, total_pnl: 2100 }, active_pairs: 1 },
    { id: 'futures', name: 'Pivot Pete', role: 'Futures Expert', initial: 'PP', status: 'active' as const, avatar: '/avatars/futures.png', catchphrase: 'Level to level', performance: { win_rate: 55, total_pnl: 850 }, active_pairs: 3 },
    { id: 'boba', name: 'Boba', role: 'Meme Coin Degen', initial: '🧋', status: 'paused' as const, avatar: '/avatars/boba.png', catchphrase: 'Wen moon?', performance: { win_rate: 40, total_pnl: -500 }, active_pairs: 0 },
    { id: 'professor', name: 'The Professor', role: 'Market Analyst', initial: '🎓', status: 'offline' as const, avatar: '/avatars/professor.png', catchphrase: 'Data indicates...', performance: { win_rate: 0, total_pnl: 0 }, active_pairs: 0 },
    { id: 'auditor', name: 'The Auditor', role: 'Risk Manager', initial: '⚖️', status: 'active' as const, avatar: '/avatars/auditor.png', catchphrase: 'Risk constrained', performance: { win_rate: 100, total_pnl: 0 }, active_pairs: 6 },
];

function AgentsPageContent() {
    const { agents } = useStrategy();
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [selectedAgentId, setSelectedAgentId] = useState<string>('fx');
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [isTyping, setIsTyping] = useState(false);

    // Protect route
    useEffect(() => {
        if (!loading && !user) {
            router.replace('/login');
        }
    }, [user, loading, router]);

    // Handle deep linking
    useEffect(() => {
        const agentParam = searchParams.get('agent');
        if (agentParam && agentList.some(a => a.id === agentParam)) {
            setSelectedAgentId(agentParam);
        }
    }, [searchParams]);

    // Clear chat when switching agents
    useEffect(() => {
        setChatMessages([]);
    }, [selectedAgentId]);

    const [longLoad, setLongLoad] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setLongLoad(true), 3000);
        return () => clearTimeout(timer);
    }, []);

    if (loading || !user) {
        return (
            <div className={styles.loader}>
                <div className={styles.spinner} />
                <span>Initializing Neural Interface...</span>
                {longLoad && (
                    <button
                        onClick={() => router.replace('/login')}
                        style={{ marginTop: 20, padding: '8px 16px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 4 }}
                    >
                        Force Login
                    </button>
                )}
            </div>
        );
    }

    const handleSendMessage = (text: string) => {
        // Add user message
        setChatMessages(prev => [...prev, {
            sender: 'You',
            text: text,
            time: new Date().toLocaleTimeString(),
            isAgent: false
        }]);

        setIsTyping(true);

        // Simulate agent response
        setTimeout(() => {
            const agent = agents?.[selectedAgentId];
            if (!agent) return;

            let responseText = `Processing request: "${text}"...`;

            // Simple keyword matching for demo
            if (text.toLowerCase().includes('status')) {
                responseText = `Systems nominal. Active monitors on ${agent.active_pairs} pairs.`;
            } else if (text.toLowerCase().includes('pnl') || text.toLowerCase().includes('doing')) {
                responseText = `Current session PnL: $${agent.performance.total_pnl}. Win Rate: ${agent.performance.win_rate}%.`;
            }

            setChatMessages(prev => [...prev, {
                sender: agent.meta.name,
                text: responseText,
                time: new Date().toLocaleTimeString(),
                isAgent: true
            }]);
            setIsTyping(false);
        }, 1500);
    };

    const selectedAgentData = agents?.[selectedAgentId] ? {
        ...agents[selectedAgentId],
        id: selectedAgentId,
        // Ensure name is consistent
        name: agents[selectedAgentId].meta.name || agentList.find(a => a.id === selectedAgentId)?.name || 'Unknown Agent'
    } : null;

    // Normalize Agents Data
    const normalizedAgents = agents ? Object.entries(agents).map(([key, agent]: [string, any]) => ({
        ...agent,
        id: agent.id || key,
        name: agent.meta?.name || agent.name || 'Unknown Agent',
        role: agent.meta?.role || agent.role || 'Specialist',
        avatar: agent.meta?.avatar || agent.avatar || agentList.find(a => a.id === key)?.avatar,
        status: agent.status || 'offline',
        active_pairs: agent.active_pairs || 0,
        performance: {
            win_rate: agent.performance?.win_rate || 0,
            total_pnl: agent.performance?.total_pnl || 0
        }
    })) : agentList;

    // Calculate total PnL across all agents
    const totalPnl = normalizedAgents.reduce((acc: number, agent: any) => {
        return acc + (agent.performance?.total_pnl || 0);
    }, 0);

    // Calculate Active Agents (Robust Check)
    const activeCount = normalizedAgents.filter((a: any) =>
        a.status && a.status.toLowerCase() === 'active'
    ).length;

    const handleAgentSelect = (id: string) => {
        setSelectedAgentId(id);
    };

    return (
        <div className={styles.layout}>
            <AgentSidebar
                agents={normalizedAgents}
                selectedId={selectedAgentId}
                onSelect={handleAgentSelect}
                totalPnl={totalPnl}
                activeAgentsCount={activeCount}
            />

            <div className="flex-1 overflow-hidden relative">
                {selectedAgentData ? (
                    <AgentWorkspace
                        agent={selectedAgentData}
                        messages={chatMessages}
                        onSendMessage={handleSendMessage}
                        isTyping={isTyping}
                    />
                ) : (
                    <div className={styles.loader}>Select an agent to begin transmission.</div>
                )}
            </div>
        </div>
    );
}

export default function AgentsPage() {
    return (
        <Suspense fallback={<div className={styles.loader}>Loading...</div>}>
            <AgentsPageContent />
        </Suspense>
    );
}
