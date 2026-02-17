'use client';

import React from 'react';
import TheLab from '@/components/Dashboard/TheLab';
import { useStrategy } from '@/context/StrategyContext';

// Backup static list if context is empty
const defaultAgentList = [
    { id: 'fx', name: 'Sterling', role: 'Forex Specialist', initial: 'ST', status: 'active' as const, avatar: '/avatars/fx.png', active_pairs: 4, performance: { win_rate: 65, total_pnl: 1250 } },
    { id: 'crypto', name: 'Bitcoin Bob', role: 'Crypto Hunter', initial: 'BB', status: 'active' as const, avatar: '/avatars/crypto.png', active_pairs: 2, performance: { win_rate: 72, total_pnl: 3400 } },
    { id: 'spx', name: 'SPX Sniper', role: 'Indices Trader', initial: 'SS', status: 'active' as const, avatar: '/avatars/spx.png', active_pairs: 1, performance: { win_rate: 68, total_pnl: 2100 } },
    { id: 'futures', name: 'Pivot Pete', role: 'Futures Expert', initial: 'PP', status: 'active' as const, avatar: '/avatars/futures.png', active_pairs: 3, performance: { win_rate: 55, total_pnl: 850 } },
    { id: 'boba', name: 'Boba', role: 'Meme Coin Degen', initial: '🧋', status: 'paused' as const, avatar: '/avatars/boba.png', active_pairs: 0, performance: { win_rate: 40, total_pnl: -500 } },
    { id: 'professor', name: 'The Professor', role: 'Market Analyst', initial: '🎓', status: 'offline' as const, avatar: '/avatars/professor.png', active_pairs: 0, performance: { win_rate: 0, total_pnl: 0 } },
    { id: 'auditor', name: 'The Auditor', role: 'Risk Manager', initial: '⚖️', status: 'active' as const, avatar: '/avatars/auditor.png', active_pairs: 6, performance: { win_rate: 100, total_pnl: 0 } },
];

export default function LabPage() {
    const { agents } = useStrategy();

    // Normalize or use default
    const normalizedAgents = agents && Object.keys(agents).length > 0
        ? Object.entries(agents).map(([key, agent]: [string, any]) => ({
            ...agent,
            id: agent.id || key,
            name: agent.meta?.name || agent.name || 'Unknown Agent',
            role: agent.meta?.role || agent.role || 'Specialist',
            avatar: agent.meta?.avatar || agent.avatar,
            status: agent.status || 'offline',
            active_pairs: agent.active_pairs || 0,
            performance: {
                win_rate: agent.performance?.win_rate || 0,
                total_pnl: agent.performance?.total_pnl || 0
            }
        }))
        : defaultAgentList;

    return (
        <div className="h-screen w-full bg-[#050507]">
            <TheLab agents={normalizedAgents} />
        </div>
    );
}
