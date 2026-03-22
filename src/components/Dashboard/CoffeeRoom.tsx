'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Users, Coffee, ArrowUpRight, Activity, BarChart3 } from 'lucide-react';
import StatsTile from './StatsTile';

interface Agent {
    id: string;
    name: string;
    role: string;
    status: 'active' | 'paused' | 'offline';
    avatar?: string;
    active_pairs?: number;
    performance: {
        win_rate: number;
        total_pnl: number;
    };
}

interface CoffeeRoomProps {
    agents: Agent[];
    onSelectAgent?: (id: string) => void;
}

export default function CoffeeRoom({ agents, onSelectAgent }: CoffeeRoomProps) {
    const router = useRouter();
    
    const handleAgentClick = (id: string) => {
        // Navigate to the full agent cockpit with chart
        router.push(`/agent/${id}`);
    };
    const activeAgents = agents.filter(a => a.status === 'active');
    const totalPnL = agents.reduce((acc, a) => acc + a.performance.total_pnl, 0);

    return (
        <div className="h-full w-full overflow-y-auto p-8 flex flex-col gap-8">
            <header className="flex justify-between items-end border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500 mb-2">
                        Squad Break Room ☕
                    </h1>
                    <p className="text-white/40 text-sm max-w-xl">
                        Central command hub. Monitor global squad performance, active signals, and network status.
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="bg-white/5 rounded-xl p-4 min-w-[160px] backdrop-blur-md border border-white/5">
                        <span className="block text-xs text-white/40 uppercase tracking-widest mb-1">Squad PnL</span>
                        <span className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            ${totalPnL.toLocaleString()}
                        </span>
                    </div>
                </div>
            </header>

            {/* Active Agents Grid */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <Users size={18} className="text-purple-400" />
                    <h2 className="text-xs uppercase tracking-widest text-white/60 font-semibold">Ready for Deployment</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {agents.map((agent, i) => (
                        <motion.div
                            key={agent.id}
                            className={`
                                group relative p-5 rounded-2xl cursor-pointer border
                                ${agent.status === 'active'
                                    ? 'bg-gradient-to-br from-white/[0.03] to-white/[0.01] border-white/10 hover:border-purple-500/50'
                                    : 'bg-white/[0.01] border-white/5 opacity-60 grayscale'}
                            `}
                            onClick={() => handleAgentClick(agent.id)}
                            whileHover={{ y: -4, scale: 1.01 }}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                        >
                            {/* Agent Header */}
                            <div className="flex items-center gap-4 mb-4">
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center border border-white/10 overflow-hidden">
                                        {agent.avatar ? (
                                            <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-lg font-bold text-purple-400">{agent.name[0]}</span>
                                        )}
                                    </div>
                                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#131318] ${agent.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-gray-500'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-white group-hover:text-purple-400 transition-colors truncate">{agent.name}</h3>
                                        <ArrowUpRight size={14} className="text-white/20 group-hover:text-purple-400 transition-colors" />
                                    </div>
                                    <p className="text-xs text-white/40 truncate">{agent.role}</p>
                                </div>
                            </div>

                            {/* Mini Stats */}
                            <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5">
                                <div>
                                    <span className="block text-[10px] text-white/30 uppercase mb-1">Win Rate</span>
                                    <span className="text-sm font-mono text-white/80">{agent.performance.win_rate}%</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] text-white/30 uppercase mb-1">PnL</span>
                                    <span className={`text-sm font-mono ${agent.performance.total_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        ${Math.abs(agent.performance.total_pnl)}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Network Activity Simulation */}
            <section className="mt-4 flex-1">
                <div className="flex items-center gap-2 mb-4">
                    <Activity size={18} className="text-blue-400" />
                    <h2 className="text-xs uppercase tracking-widest text-white/60 font-semibold">Network Signals</h2>
                </div>
                <div className="w-full h-48 bg-white/[0.02] rounded-2xl border border-white/5 flex items-center justify-center">
                    <p className="text-white/20 text-sm">Waiting for incoming signal blocks...</p>
                </div>
            </section>
        </div>
    );
}
