'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Settings, Activity, Brain, TrendingUp, Zap, Radio } from 'lucide-react';
import Link from 'next/link';
import { useStrategy } from '@/context/StrategyContext';
import Image from 'next/image';

// --- SEAT MAPPING (SPACE CAFE V3) ---
const SEAT_POSITIONS = [
    { id: 'spx', top: '55%', left: '12%', label: 'Sniper' },          // Far Left (Tactical Gear)
    { id: 'fx', top: '58%', left: '25%', label: 'FX Specialist' },    // Woman Phone (Casual)
    { id: 'futures', top: '48%', left: '36%', label: 'Futures' },     // Back Left (Suit/Bar)
    { id: 'crypto', top: '52%', left: '44%', label: 'Alpha' },        // Center (Hoodie/Laptop)
    { id: 'professor', top: '50%', left: '56%', label: 'Analyst' },   // Center Right (Silver Hair)
    { id: 'boba', top: '58%', left: '66%', label: 'Degen' },          // Right (Woman/Drink)
    { id: 'auditor', top: '65%', left: '82%', label: 'Risk Info' },   // Far Right (Suit/Tablet)
];

const TIPS = [
    "Leverage the 15m breakout for quick scalps.",
    "Never underestimate the power of a daily support level.",
    "Volume precedes price. Watch the flow.",
    "Patience pays more than frequency.",
    "Hedging is not just for gardeners.",
    "Trend is your friend until the bend.",
    "Always secure partial profits at 1R."
];

const defaultAgentList = [
    { id: 'fx', name: 'Swjsh FX', role: 'Forex Specialist', avatar: '/avatars/fx.png', initial: 'FX', status: 'active', performance: { win_rate: 68, total_pnl: 1540 } },
    { id: 'crypto', name: 'Bitcoin Bob', role: 'Crypto Hunter', avatar: '/avatars/crypto.png', initial: 'BB', status: 'active', performance: { win_rate: 74, total_pnl: 4200 } },
    { id: 'spx', name: 'SPX Sniper', role: 'Indices Trader', avatar: '/avatars/spx.png', initial: 'SS', status: 'active', performance: { win_rate: 62, total_pnl: 2800 } },
    { id: 'futures', name: 'Pivot Pete', role: 'Futures Expert', avatar: '/avatars/futures.png', initial: 'PP', status: 'active', performance: { win_rate: 58, total_pnl: 950 } },
    { id: 'boba', name: 'Boba', role: 'Meme Coin Degen', avatar: '/avatars/boba.png', initial: '🧋', status: 'paused', performance: { win_rate: 42, total_pnl: -300 } },
    { id: 'professor', name: 'The Professor', role: 'Market Analyst', avatar: '/avatars/professor.png', initial: '🎓', status: 'offline', performance: { win_rate: 0, total_pnl: 0 } },
    { id: 'auditor', name: 'The Auditor', role: 'Risk Manager', avatar: '/avatars/auditor.png', initial: '⚖️', status: 'active', performance: { win_rate: 100, total_pnl: 0 } },
];

export default function BreakRoomPage() {
    const { agents } = useStrategy();
    const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);

    // Normalize Data
    const agentData = agents && Object.keys(agents).length > 0
        ? Object.entries(agents).map(([k, v]: [string, any]) => ({ ...v, id: k }))
        : defaultAgentList;

    // Normalize Data and Map to Specific Seats
    // We try to match ID first, otherwise fallback to index
    const seats = SEAT_POSITIONS.map((seat, i) => {
        // Find agent by ID if possible (assuming mapped IDs above match agent IDs)
        // or just take the ith agent
        const agent = agentData.find(a => a.id === seat.id) || agentData[i] || defaultAgentList[i];
        return {
            ...agent,
            seat: seat,
            tip: TIPS[i % TIPS.length]
        };
    });

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-[#050510] text-white selection:bg-cyan-500/30">

            {/* Immersive Background */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="/backgrounds/space_cafe_v3.jpg"
                    alt="Space Cafe V3"
                    fill
                    className="object-cover opacity-90"
                    priority
                />

                {/* Live TV Overlay - Mapped to Top Left Wall Monitor */}
                <div
                    className="absolute z-10 overflow-hidden mix-blend-screen opacity-90 pointer-events-none"
                    style={{
                        top: '8%',
                        left: '0%',
                        width: '10%',
                        height: '18%',
                        transform: 'perspective(500px) rotateY(10deg) rotateX(5deg)',
                        clipPath: 'polygon(0 0, 100% 5%, 100% 95%, 0 100%)', // Slight warp to match perspective
                        background: 'rgba(0, 0, 0, 0.6)',
                    }}
                >
                    {/* Scanlines for TV effect */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[length:100%_2px,3px_100%] pointer-events-none" />

                    {/* Live Content Simulation */}
                    <div className="p-1 h-full flex flex-col pt-4 pl-4">
                        <div className="flex justify-between items-center mb-1 border-b border-green-500/30 pb-0.5">
                            <span className="text-[6px] font-mono text-green-300 font-bold tracking-widest animate-pulse">LIVE</span>
                        </div>

                        <div className="flex-1 overflow-hidden font-mono text-[6px] text-green-400/90 leading-tight">
                            <div className="animate-[translateY_-50%_15s_linear_infinite] space-y-1">
                                <p>&gt; MKT OPEN</p>
                                <p>&gt; SPX 5200</p>
                                <p>&gt; VOL HUGE</p>
                                <p>&gt; BUY DIP</p>
                                <p>&gt; LIQ HUNT</p>
                                <p>&gt; MKT OPEN</p>
                                <p>&gt; SPX 5200</p>
                                <p>&gt; VOL HUGE</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#050510] via-transparent to-[#050510]/20 mix-blend-multiply" />
            </div>

            {/* Header */}
            <div className="absolute top-8 left-8 z-50">
                <Link href="/agents">
                    <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] cursor-pointer hover:opacity-80 transition-opacity">
                        SPACE CAFE
                    </h1>
                </Link>
                <div className="flex items-center gap-3 mt-2 text-blue-200/80 font-mono text-xs tracking-[0.2em]">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse shadow-[0_0_10px_#60a5fa]" />
                    <span>SECTOR 7G • RECREATION MODULE</span>
                </div>
            </div>

            {/* Return Button */}
            <div className="absolute top-8 right-8 z-50">
                <Link href="/agents">
                    <button className="group flex items-center gap-3 px-6 py-3 bg-black/40 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-400/50 rounded-full transition-all duration-300 backdrop-blur-md">
                        <ArrowLeft className="w-4 h-4 text-cyan-400 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-xs font-bold tracking-widest text-cyan-100 uppercase">Return to Bridge</span>
                    </button>
                </Link>
            </div>

            {/* Interactive Seats */}
            <div className="absolute inset-0 z-30">
                {seats.map((agent) => (
                    <div
                        key={agent.id}
                        className="absolute w-20 h-20 sm:w-28 sm:h-28 -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                        style={{
                            top: agent.seat.top,
                            left: agent.seat.left,
                        }}
                        onMouseEnter={() => setHoveredAgent(agent.id)}
                        onMouseLeave={() => setHoveredAgent(null)}
                    >
                        {/* Hitbox visual aid (for debugging, set opacity 0 for prod) */}
                        <div className="absolute inset-0 bg-cyan-400/0 group-hover:bg-cyan-400/5 rounded-full transition-colors duration-300" />

                        {/* Target Reticle (Idle) */}
                        <div className="absolute inset-0 border border-white/0 group-hover:border-cyan-400/30 rounded-full transition-all duration-500 scale-75 group-hover:scale-100 opacity-0 group-hover:opacity-100 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                            <div className="absolute inset-0 animate-[spin_8s_linear_infinite] border-t border-cyan-400/50 rounded-full" />
                        </div>

                        {/* Holo-Card (Hover) */}
                        <AnimatePresence>
                            {hoveredAgent === agent.id && (
                                <motion.div
                                    initial={{ opacity: 0, y: 40, scale: 0.8, rotateX: 20 }}
                                    animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                                    exit={{ opacity: 0, y: 20, scale: 0.9, rotateX: 10 }}
                                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                    className="absolute bottom-[100%] left-1/2 -translate-x-1/2 w-[340px] z-50 origin-bottom"
                                    style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}
                                >
                                    {/* Glass Panel */}
                                    <div className="relative overflow-hidden rounded-2xl bg-[#0a0f1e]/90 backdrop-blur-2xl border border-cyan-500/30 shadow-[0_0_80px_rgba(34,211,238,0.3)]">

                                        {/* Living Header */}
                                        <div className="p-4 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-950/50 to-transparent flex items-start gap-4">
                                            {/* Avatar with Ring */}
                                            <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)] shrink-0 group-hover:scale-105 transition-transform duration-500">
                                                <img src={agent.avatar || `https://ui-avatars.com/api/?name=${agent.name}`} alt={agent.name} className="w-full h-full object-cover" />
                                                {/* Scanline over avatar */}
                                                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.2)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,6px_100%] pointer-events-none opacity-50" />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="text-xl font-bold text-white leading-none tracking-tight">{agent.name}</h3>
                                                        <span className="text-[10px] font-mono uppercase text-cyan-400 tracking-widest">{agent.role}</span>
                                                    </div>

                                                    {/* GEAR ICON ACTION */}
                                                    <Link href={`/agents?agent=${agent.id}&mode=settings`}>
                                                        <div className="p-2 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-white/50 hover:text-cyan-400 border border-transparent hover:border-cyan-500/30 transition-all cursor-pointer group/gear">
                                                            <Settings size={16} className="group-hover/gear:rotate-90 transition-transform duration-500" />
                                                        </div>
                                                    </Link>
                                                </div>

                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${agent.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                                                    <span className="text-[10px] text-white/40 font-mono uppercase">{agent.status === 'active' ? 'ONLINE' : 'OFFLINE'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Stats Grid */}
                                        <div className="grid grid-cols-2 gap-px bg-cyan-500/10 border-b border-cyan-500/10">
                                            <div className="p-4 bg-[#0a0f1e]/60 flex flex-col items-center hover:bg-cyan-500/5 transition-colors">
                                                <span className="text-[9px] uppercase tracking-widest text-cyan-400/60 mb-1">Win Rate</span>
                                                <div className="flex items-end gap-1">
                                                    <span className="text-2xl font-mono font-bold text-white tracking-tighter">{agent.performance?.win_rate || 0}%</span>
                                                    <Activity size={14} className="text-cyan-400 mb-1.5" />
                                                </div>
                                            </div>
                                            <div className="p-4 bg-[#0a0f1e]/60 flex flex-col items-center hover:bg-cyan-500/5 transition-colors">
                                                <span className="text-[9px] uppercase tracking-widest text-cyan-400/60 mb-1">24h PnL</span>
                                                <div className="flex items-end gap-1">
                                                    <span className={`text-2xl font-mono font-bold tracking-tighter ${agent.performance?.total_pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                                        ${Math.abs(agent.performance?.total_pnl || 0).toLocaleString()}
                                                    </span>
                                                    <TrendingUp size={14} className={agent.performance?.total_pnl >= 0 ? "text-emerald-500" : "text-rose-500 mb-1.5"} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Professor's Insight */}
                                        <div className="p-4 bg-gradient-to-b from-purple-900/10 to-purple-900/5">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="p-1 rounded bg-purple-500/20">
                                                    <Brain size={12} className="text-purple-400" />
                                                </div>
                                                <span className="text-[10px] font-bold text-purple-300 uppercase tracking-widest">Professor's Insight</span>
                                            </div>
                                            <p className="text-xs text-purple-100/90 leading-relaxed font-medium">
                                                "{agent.tip}"
                                            </p>
                                        </div>
                                    </div>

                                    {/* Holographic Projection Base */}
                                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-cyan-500/20 blur-xl rounded-full" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>

            {/* Foreground Overlay for Depth */}
            <div className="absolute inset-0 z-40 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,5,16,0.2)_100%)] opacity-50" />
        </div>
    );
}
