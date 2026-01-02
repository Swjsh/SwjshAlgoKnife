'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FlaskConical, Atom, Binary, Scan, Award } from 'lucide-react';
import styles from './TheLab.module.css';

interface Agent {
    id: string;
    name: string;
    role: string;
    avatar?: string;
    performance: {
        win_rate: number;
        total_pnl: number;
    };
}

interface TheLabProps {
    agents: Agent[];
}

export default function TheLab({ agents }: TheLabProps) {
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

    return (
        <div className={styles.labContainer}>
            <div className={styles.ambientGrid} />

            {/* Professor's HUD */}
            <header className={styles.header}>
                <div className={styles.profProfile}>
                    <div className={styles.profAvatar}>
                        <img src="/avatars/professor.png" alt="The Professor" />
                        <div className={styles.profStatus} />
                    </div>
                    <div>
                        <h1 className={styles.profName}>The Professor</h1>
                        <p className={styles.profRole}>Head of Quantitative Analysis</p>
                    </div>
                </div>
                <div className={styles.hudStats}>
                    <div className={styles.hudItem}>
                        <Binary size={14} className="text-cyan-400" />
                        <span>Analysis: ACTIVE</span>
                    </div>
                    <div className={styles.hudItem}>
                        <Atom size={14} className="text-purple-400" />
                        <span>Simulation: RUNNING</span>
                    </div>
                </div>
            </header>

            <main className={styles.gridCanvas}>
                {/* 3D Agent Cards Spiral */}
                <div className={styles.agentDeck}>
                    {agents.map((agent, i) => {
                        // Calculate Grade
                        let grade = 'C';
                        if (agent.performance.win_rate > 70) grade = 'A+';
                        else if (agent.performance.win_rate > 60) grade = 'A';
                        else if (agent.performance.win_rate > 50) grade = 'B';

                        const isSelected = selectedAgent?.id === agent.id;

                        return (
                            <motion.div
                                key={agent.id}
                                className={`${styles.holoCard} ${isSelected ? styles.selected : ''}`}
                                onClick={() => setSelectedAgent(agent)}
                                initial={{ opacity: 0, scale: 0, z: -500 }}
                                animate={{
                                    opacity: 1,
                                    scale: 1,
                                    z: 0,
                                    rotateY: isSelected ? 0 : -15 + (i % 2) * 30
                                }}
                                transition={{
                                    delay: i * 0.15,
                                    type: "spring",
                                    stiffness: 100
                                }}
                                whileHover={{ scale: 1.05, rotateY: 0, zIndex: 50 }}
                            >
                                <div className={styles.scanLine} />
                                <div className={styles.cardHeader}>
                                    <img src={agent.avatar} className={styles.cardAvatar} />
                                    <div className={styles.gradeBadge} data-grade={grade[0]}>{grade}</div>
                                </div>
                                <h3 className={styles.cardName}>{agent.name}</h3>
                                <div className={styles.cardStats}>
                                    <div className={styles.statRow}>
                                        <span>Win Rate</span>
                                        <span className={styles.statVal}>{agent.performance.win_rate}%</span>
                                    </div>
                                    <div className={styles.statRow}>
                                        <span>PnL</span>
                                        <span className={styles.statVal}>${agent.performance.total_pnl}</span>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Analysis Terminal (Right Side) */}
                <AnimatePresence>
                    {selectedAgent && (
                        <motion.aside
                            className={styles.analysisPanel}
                            initial={{ x: 100, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 100, opacity: 0 }}
                        >
                            <div className={styles.panelHeader}>
                                <Scan size={18} className="text-cyan-400 animate-pulse" />
                                <h2>Subject Analysis</h2>
                            </div>

                            <div className={styles.analysisContent}>
                                <p className="text-sm font-mono text-cyan-200 mb-4">
                                    &gt; Scanning neural weights...<br />
                                    &gt; Backtesting strategy logic...<br />
                                    &gt; Risk parameters verified.
                                </p>

                                <div className={styles.gradeBox}>
                                    <Award size={32} className="text-yellow-400 mb-2" />
                                    <div className="text-4xl font-bold text-white mb-1">
                                        {selectedAgent.performance.win_rate > 60 ? 'A' : 'B-'}
                                    </div>
                                    <div className="text-xs uppercase tracking-widest text-white/50">Performance Grade</div>
                                </div>

                                <div className="mt-8 space-y-4">
                                    <div className="h-1 bg-white/10 rounded overflow-hidden">
                                        <motion.div
                                            className="h-full bg-cyan-500"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${selectedAgent.performance.win_rate}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-white/40 font-mono">Efficiency Metric</p>
                                </div>
                            </div>
                        </motion.aside>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
