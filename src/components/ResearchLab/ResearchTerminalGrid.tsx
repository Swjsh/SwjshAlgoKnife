'use client';

import React from 'react';
import { AgentTerminal } from '@/components/ActivityFeed/AgentTerminal';
import { useResearchAgents, type ResearchAgentState } from '@/hooks/useResearchAgents';
import type { AgentState } from '@/hooks/useActivityFeed';
import styles from './ResearchTerminalGrid.module.css';

export interface ResearchTerminalGridProps {
    className?: string;
}

/**
 * Adapts a ResearchAgentState to the AgentState interface expected by AgentTerminal.
 */
function adaptToAgentState(researchAgent: ResearchAgentState): AgentState {
    return {
        id: researchAgent.id,
        name: researchAgent.name,
        emoji: researchAgent.emoji,
        color: researchAgent.color,
        status: researchAgent.status,
        logs: researchAgent.logs,
        lastActivity: researchAgent.lastActivity,
    };
}

/**
 * ResearchTerminalGrid displays 8 research agent terminals in a 2x4 grid layout.
 *
 * Group 1 (Internal Improvement): Terminals 1-4 on the left
 * Group 2 (Security & Ops): Terminals 5-8 on the right
 *
 * On mobile, the grid stacks to a single column.
 */
export function ResearchTerminalGrid({ className }: ResearchTerminalGridProps) {
    const {
        agentsList,
        loading,
        activeCount,
        totalAgents,
        sendCommand,
    } = useResearchAgents();

    // Split agents into two groups: terminals 1-4 and 5-8
    const group1Agents = agentsList.filter(a => a.terminalNumber <= 4);
    const group2Agents = agentsList.filter(a => a.terminalNumber > 4);

    // Check if agents are fetched (not loading)
    const isConnected = !loading;

    // Wrapper to adapt sendCommand signature (AgentTerminal expects (agentId, command) => void)
    const handleSendCommand = (agentId: string, command: string): void => {
        void sendCommand(agentId, command);
    };

    return (
        <div className={`${styles.container} ${className || ''}`}>
            {/* Connection Status Indicator */}
            <div className={styles.statusBar}>
                <div className={`${styles.connectionStatus} ${isConnected ? styles.connected : styles.disconnected}`}>
                    <span className={styles.statusDot} />
                    <span className={styles.statusText}>
                        {isConnected ? 'Connected' : 'Loading...'}
                    </span>
                </div>
                <span className={styles.agentCount}>
                    {activeCount} / {totalAgents} agents active
                </span>
            </div>

            <div className={styles.gridWrapper}>
                {/* Group 1: Internal Improvement */}
                <div className={styles.group}>
                    <div className={styles.groupHeader}>
                        <span className={styles.groupBadge}>GROUP 1</span>
                        <h3 className={styles.groupTitle}>Internal Improvement</h3>
                        <span className={styles.groupDescription}>Code Quality, Architecture, Testing, Documentation</span>
                    </div>
                    <div className={styles.terminalColumn}>
                        {group1Agents.length > 0 ? (
                            group1Agents.map((agent) => (
                                <div key={agent.id} className={styles.terminalWrapper}>
                                    <AgentTerminal
                                        agent={adaptToAgentState(agent)}
                                        onSendCommand={handleSendCommand}
                                    />
                                </div>
                            ))
                        ) : (
                            // Empty state placeholders for Group 1
                            Array.from({ length: 4 }).map((_, index) => (
                                <div key={`placeholder-1-${index}`} className={styles.terminalWrapper}>
                                    <div className={styles.emptyTerminal}>
                                        <div className={styles.emptyContent}>
                                            <span className={styles.emptyIcon}>?</span>
                                            <span className={styles.emptyLabel}>Research Agent {index + 1}</span>
                                            <span className={styles.emptySubtext}>Awaiting initialization...</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Group 2: Security & Ops */}
                <div className={styles.group}>
                    <div className={`${styles.groupHeader} ${styles.group2Header}`}>
                        <span className={`${styles.groupBadge} ${styles.group2Badge}`}>GROUP 2</span>
                        <h3 className={styles.groupTitle}>Security & Ops</h3>
                        <span className={styles.groupDescription}>Security Review, DevOps, Performance, Monitoring</span>
                    </div>
                    <div className={styles.terminalColumn}>
                        {group2Agents.length > 0 ? (
                            group2Agents.map((agent) => (
                                <div key={agent.id} className={styles.terminalWrapper}>
                                    <AgentTerminal
                                        agent={adaptToAgentState(agent)}
                                        onSendCommand={handleSendCommand}
                                    />
                                </div>
                            ))
                        ) : (
                            // Empty state placeholders for Group 2
                            Array.from({ length: 4 }).map((_, index) => (
                                <div key={`placeholder-2-${index}`} className={styles.terminalWrapper}>
                                    <div className={styles.emptyTerminal}>
                                        <div className={styles.emptyContent}>
                                            <span className={styles.emptyIcon}>?</span>
                                            <span className={styles.emptyLabel}>Research Agent {index + 5}</span>
                                            <span className={styles.emptySubtext}>Awaiting initialization...</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ResearchTerminalGrid;
