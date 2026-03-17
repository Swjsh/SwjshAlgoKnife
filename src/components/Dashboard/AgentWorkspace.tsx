'use client';

import React, { useState } from 'react';
import styles from './AgentWorkspace.module.css';
import TerminalChat, { ChatMessage } from './TerminalChat';
import LiveSignals, { Signal } from './LiveSignals';
import RealTimeAnalytics from './RealTimeAnalytics';
import StatsTile from './StatsTile';
import { motion } from 'framer-motion';
import { Crosshair, DollarSign, Activity, Zap, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface AgentData {
    id: string;
    name: string;
    status: string;
    performance: {
        win_rate: number;
        total_pnl: number;
        trades: number;
    };
    live_signals: Signal[];
}

interface AgentWorkspaceProps {
    agent: AgentData;
    messages: ChatMessage[];
    onSendMessage: (text: string) => void;
    isTyping?: boolean;
}

export default function AgentWorkspace({ agent, messages, onSendMessage, isTyping }: AgentWorkspaceProps) {
    // Resizing State
    const [colSplit, setColSplit] = useState(75); // % width of left column
    const [rowSplit, setRowSplit] = useState(60); // % height of top row
    const [isResizing, setIsResizing] = useState<'col' | 'row' | null>(null);

    // Mouse Event Handlers
    React.useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;

            if (isResizing === 'col') {
                const newWidth = (e.clientX / window.innerWidth) * 100;
                setColSplit(Math.min(Math.max(newWidth, 20), 80)); // Clamp between 20% and 80%
            } else {
                // Approximate height calc (subtracting header ~80px)
                const workspaceHeight = window.innerHeight - 80;
                const newHeight = ((e.clientY - 80) / workspaceHeight) * 100;
                setRowSplit(Math.min(Math.max(newHeight, 20), 80));
            }
        };

        const handleMouseUp = () => {
            setIsResizing(null);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto'; // Re-enable text selection
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = 'none'; // Prevent selection while dragging
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const startResizing = (direction: 'col' | 'row') => {
        setIsResizing(direction);
        document.body.style.cursor = direction === 'col' ? 'col-resize' : 'row-resize';
    };

    return (
        <main className={styles.workspace}>
            <header className={styles.header}>
                <div className={styles.agentTitle}>
                    <div className={styles.titleText}>
                        <h1>{agent.name}</h1>
                        <span className={styles.statusLive}>
                            {agent.status}
                        </span>
                    </div>
                </div>
                <Link href={`/agent/${agent.id}`} className={styles.cockpitLink}>
                    <ExternalLink size={16} />
                    <span>Full Cockpit</span>
                </Link>
            </header>

            <div
                className={styles.bentoGrid}
                style={{
                    '--col-split': `${colSplit}%`,
                    '--row-split': `${rowSplit}%`
                } as React.CSSProperties}
            >
                {/* Chart Panel (Top Left) */}
                <motion.section
                    className={styles.chartPanel}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <RealTimeAnalytics
                        symbol={agent.name}
                        price={98250} // In prod, get this from agent.live_data.current_price
                    />
                </motion.section>

                {/* Vertical Resizer */}
                <div
                    className={styles.resizerVertical}
                    onMouseDown={() => startResizing('col')}
                />

                {/* Stats Panel (Top Right) */}
                <motion.section
                    className={styles.statsPanel}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <StatsTile
                        label="Win Rate"
                        value={`${agent.performance?.win_rate || 0}%`}
                        icon={Crosshair}
                        trend={(agent.performance?.win_rate || 0) > 50 ? 'positive' : 'neutral'}
                        progress={agent.performance?.win_rate || 0}
                    />
                    <StatsTile
                        label="Total PnL"
                        value={`$${(agent.performance?.total_pnl || 0).toLocaleString()}`}
                        icon={DollarSign}
                        trend={(agent.performance?.total_pnl || 0) >= 0 ? 'positive' : 'negative'}
                        progress={Math.min(100, Math.abs(agent.performance?.total_pnl || 0) / 100)} // Mock progress scale
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <StatsTile
                            label="Trades"
                            value={agent.performance?.trades || 0}
                            icon={Activity}
                            trend="neutral"
                        />
                        <StatsTile
                            label="Signals"
                            value={agent.live_signals?.length || 0}
                            icon={Zap}
                            trend="positive"
                        />
                    </div>
                </motion.section>

                {/* Horizontal Resizer */}
                <div
                    className={styles.resizerHorizontal}
                    onMouseDown={() => startResizing('row')}
                />

                {/* Mission Log (Bottom Left) */}
                <motion.section
                    className={styles.logsPanel}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <TerminalChat
                        agentName={agent.name}
                        messages={messages}
                        onSendMessage={onSendMessage}
                        isTyping={isTyping}
                    />
                </motion.section>

                {/* Live Signals (Bottom Right) */}
                <motion.section
                    className={styles.signalsPanel}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <LiveSignals signals={agent.live_signals || []} />
                </motion.section>
            </div>
        </main>
    );
}
