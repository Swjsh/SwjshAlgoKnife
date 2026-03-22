'use client';

import React from 'react';
import Image from 'next/image';
import { Activity, CheckCircle2, Loader2, ListTodo } from 'lucide-react';
import styles from './ActivityColumn.module.css';

interface Ticket {
    key: string;
    summary: string;
    status: string;
    priority: string;
    updated: string;
}

interface AgentTickets {
    done: Ticket | null;
    inProgress: Ticket | null;
    next: Ticket | null;
}

interface AgentInfo {
    id: string;
    name: string;
    color: string;
    avatar?: string;
    emoji: string;
}

interface ActivityColumnProps {
    tickets: Record<string, AgentTickets>;
    agents: Record<string, AgentInfo>;
}

// Agent display order
const AGENT_ORDER = ['chief', 'hunter', 'ops', 'scout', 'arbiter', 'cortana'] as const;

function getStatusIcon(status: string) {
    const lower = status.toLowerCase();
    if (lower === 'done' || lower === 'closed') {
        return <CheckCircle2 size={10} className={styles.statusIconDone} />;
    }
    if (lower === 'in progress' || lower === 'in-progress') {
        return <Loader2 size={10} className={styles.statusIconProgress} />;
    }
    return <ListTodo size={10} className={styles.statusIconTodo} />;
}

function getStatusClass(status: string): string {
    const lower = status.toLowerCase();
    if (lower === 'done' || lower === 'closed') return 'done';
    if (lower === 'in progress' || lower === 'in-progress') return 'inProgress';
    return 'todo';
}

export function ActivityColumn({ tickets, agents }: ActivityColumnProps) {
    // Build list of agents with their current work
    const agentWork = AGENT_ORDER.map(agentId => {
        const agent = agents[agentId];
        const agentTickets = tickets[agentId];

        if (!agent) return null;

        return {
            agent,
            inProgress: agentTickets?.inProgress || null,
            next: agentTickets?.next || null,
            done: agentTickets?.done || null,
        };
    }).filter(Boolean);

    // Count total active tickets
    const activeCount = agentWork.filter(a => a?.inProgress).length;

    return (
        <div className={styles.column}>
            <div className={styles.header}>
                <Activity size={14} />
                <span>Agent Work</span>
                <span className={styles.entryCount}>{activeCount} active</span>
            </div>

            <div className={styles.feed}>
                {agentWork.map(item => {
                    if (!item) return null;
                    const { agent, inProgress, next, done } = item;
                    const currentTicket = inProgress || next;
                    const hasWork = currentTicket || done;

                    return (
                        <div
                            key={agent.id}
                            className={`${styles.agentCard} ${inProgress ? styles.active : ''}`}
                            style={{ '--agent-color': agent.color } as React.CSSProperties}
                        >
                            <div className={styles.agentHeader}>
                                {agent.avatar ? (
                                    <div className={styles.avatarWrapper}>
                                        <Image
                                            src={agent.avatar}
                                            alt={agent.name}
                                            width={22}
                                            height={22}
                                            className={styles.avatar}
                                            unoptimized
                                        />
                                    </div>
                                ) : (
                                    <span className={styles.emoji}>{agent.emoji}</span>
                                )}
                                <span
                                    className={styles.agentName}
                                    style={{ color: agent.color }}
                                >
                                    {agent.name}
                                </span>
                            </div>

                            {hasWork ? (
                                <div className={styles.ticketList}>
                                    {inProgress && (
                                        <div className={`${styles.ticket} ${styles.inProgress}`}>
                                            <div className={styles.ticketHeader}>
                                                <span className={styles.ticketKey}>{inProgress.key}</span>
                                                <span className={`${styles.ticketStatus} ${styles[getStatusClass(inProgress.status)]}`}>
                                                    {getStatusIcon(inProgress.status)}
                                                    {inProgress.status}
                                                </span>
                                            </div>
                                            <div className={styles.ticketSummary}>{inProgress.summary}</div>
                                        </div>
                                    )}

                                    {!inProgress && next && (
                                        <div className={`${styles.ticket} ${styles.next}`}>
                                            <div className={styles.ticketHeader}>
                                                <span className={styles.ticketKey}>{next.key}</span>
                                                <span className={`${styles.ticketStatus} ${styles.todo}`}>
                                                    {getStatusIcon(next.status)}
                                                    Up Next
                                                </span>
                                            </div>
                                            <div className={styles.ticketSummary}>{next.summary}</div>
                                        </div>
                                    )}

                                    {!inProgress && !next && done && (
                                        <div className={`${styles.ticket} ${styles.completed}`}>
                                            <div className={styles.ticketHeader}>
                                                <span className={styles.ticketKey}>{done.key}</span>
                                                <span className={`${styles.ticketStatus} ${styles.done}`}>
                                                    {getStatusIcon('done')}
                                                    Done
                                                </span>
                                            </div>
                                            <div className={styles.ticketSummary}>{done.summary}</div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className={styles.noWork}>
                                    <span>No assigned tickets</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ActivityColumn;
