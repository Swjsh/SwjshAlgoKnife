"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Zap, Coins, BarChart2, Crosshair, Users, Bot } from "lucide-react";
import styles from "./StrategyMenu.module.css";
import clsx from "clsx";
import DynamicBorderCard from "@/components/UI/DynamicBorderCard";
import { useAgentContext } from "@/context/AgentContext";
import { useRouter } from "next/navigation";

const AGENT_COLORS: Record<string, string> = {
    'PIVOT PETE': '#a855f7',
    'BOBA': '#4ade80',
    'CRYPTO SNIPER': '#f59e0b',
    'SPX SNIPER': '#ef4444',
    'AUDITOR': '#3b82f6',
    'PROFESSOR': '#ec4899',
    'DEFAULT': '#a855f7'
};

const AGENT_ICONS: Record<string, any> = {
    'FOREX': <Zap size={18} />,
    'INSTITUTIONAL': <Users size={18} />,
    'SCALPER': <Coins size={18} />,
    '0DTE': <Crosshair size={18} />,
    'DEFAULT': <Bot size={18} />
};

export default function StrategyMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const { agents } = useAgentContext();
    const router = useRouter();

    const squadMembers = Object.entries(agents).map(([id, agent]) => {
        const name = agent.meta?.name || id;
        const type = agent.meta?.type || 'UNKNOWN';
        const color = AGENT_COLORS[name.toUpperCase()] || AGENT_COLORS.DEFAULT;
        const icon = AGENT_ICONS[type.toUpperCase()] || AGENT_ICONS.DEFAULT;

        return {
            id,
            name,
            type,
            color,
            icon,
            status: agent.status
        };
    }).slice(0, 4); // Keep it to 4 for the grid

    return (
        <div className={styles.menuWrapper} onMouseLeave={() => setIsOpen(false)}>
            <button
                className={styles.trigger}
                onMouseEnter={() => setIsOpen(true)}
            >
                <div className={styles.triggerInner}>
                    <BarChart2 size={18} className={styles.triggerIcon} />
                    <span>SQUAD TERMINAL</span>
                    <ChevronDown className={styles.chevron} size={16} />
                </div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={styles.dropdown}
                    >
                        <div className={styles.dropdownInner}>
                            <div className={styles.header}>
                                <h3>ACTIVE ASSIGNMENTS</h3>
                                <span>AUTHORIZED ACCESS ONLY</span>
                            </div>

                            <div className={styles.grid}>
                                {squadMembers.map((agent) => (
                                    <DynamicBorderCard
                                        key={agent.id}
                                        className={styles.agentCard}
                                        gradient={`conic-gradient(from 0deg, transparent 0, ${agent.color} 90deg, #fff 180deg, transparent 270deg)`}
                                    >
                                        <div className={styles.agentContent}>
                                            <div className={styles.agentHeader}>
                                                <div className={styles.iconBox} style={{ color: agent.color }}>
                                                    {agent.icon}
                                                </div>
                                                <div className={clsx(styles.statusBadge, agent.status.toLowerCase() === 'active' && styles.statusActive)}>
                                                    {agent.status}
                                                </div>
                                            </div>
                                            <div className={styles.agentInfo}>
                                                <div className={styles.agentName}>{agent.name}</div>
                                                <div className={styles.agentType}>{agent.type}</div>
                                            </div>
                                        </div>
                                    </DynamicBorderCard>
                                ))}
                            </div>

                            <div className={styles.footer}>
                                <button
                                    className={styles.labBtn}
                                    onClick={() => {
                                        router.push('/agents');
                                        setIsOpen(false);
                                    }}
                                >
                                    ENTER THE LAB
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
