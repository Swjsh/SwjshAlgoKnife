'use client';

import React from 'react';
import Image from 'next/image';
import styles from './TicketStrip.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Ticket {
    key: string;
    summary: string;
    status: string;
    priority: string;
    updated: string;
}

export interface AgentTickets {
    done: Ticket | null;
    inProgress: Ticket | null;
    next: Ticket | null;
}

export interface TicketStripProps {
    tickets: {
        [agentId: string]: AgentTickets;
    };
    isLoading?: boolean;
}

// ─── Agent Configuration ──────────────────────────────────────────────────────

const AGENTS = [
    { id: 'chief', name: 'Chief', color: '#f59e0b' },
    { id: 'hunter', name: 'Hunter', color: '#10b981' },
    { id: 'ops', name: 'Ops', color: '#06b6d4' },
    { id: 'scout', name: 'Scout', color: '#8b5cf6' },
    { id: 'arbiter', name: 'Arbiter', color: '#ef4444' },
    { id: 'cortana', name: 'Cortana', color: '#ec4899' },
] as const;

// ─── Utility Functions ────────────────────────────────────────────────────────

function formatTimeAgo(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function truncateSummary(summary: string, maxLength: number = 40): string {
    if (summary.length <= maxLength) return summary;
    return summary.slice(0, maxLength - 3) + '...';
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

interface TicketCardProps {
    ticket: Ticket | null;
    slotType: 'done' | 'inProgress' | 'next';
}

function TicketCard({ ticket, slotType }: TicketCardProps) {
    if (!ticket) {
        return (
            <div className={`${styles.ticketSlot} ${styles[slotType]} ${styles.empty}`}>
                <span className={styles.emptyText}>No tickets</span>
            </div>
        );
    }

    return (
        <div className={`${styles.ticketSlot} ${styles[slotType]}`}>
            <div className={styles.ticketHeader}>
                <span className={styles.ticketKey}>{ticket.key}</span>
                <span className={styles.ticketTime}>{formatTimeAgo(ticket.updated)}</span>
            </div>
            <div className={styles.ticketSummary}>
                {truncateSummary(ticket.summary)}
            </div>
            <div className={styles.statusIndicator}>
                {slotType === 'done' && (
                    <svg className={styles.checkIcon} viewBox="0 0 16 16" fill="none">
                        <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                )}
                {slotType === 'inProgress' && (
                    <span className={styles.pulsingDot} />
                )}
                {slotType === 'next' && (
                    <svg className={styles.nextIcon} viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/>
                    </svg>
                )}
            </div>
        </div>
    );
}

interface AgentColumnProps {
    agentId: string;
    agentName: string;
    agentColor: string;
    tickets: AgentTickets;
}

function AgentColumn({ agentId, agentName, agentColor, tickets }: AgentColumnProps) {
    return (
        <div
            className={styles.agentColumn}
            style={{ '--agent-color': agentColor } as React.CSSProperties}
        >
            <div className={styles.agentHeader}>
                <div className={styles.avatarWrapper}>
                    <Image
                        src={`/avatars/halo/${agentId}.png`}
                        alt={agentName}
                        width={24}
                        height={24}
                        className={styles.avatar}
                    />
                </div>
                <span className={styles.agentName}>{agentName}</span>
            </div>
            <div className={styles.ticketRows}>
                <TicketCard ticket={tickets.done} slotType="done" />
                <TicketCard ticket={tickets.inProgress} slotType="inProgress" />
                <TicketCard ticket={tickets.next} slotType="next" />
            </div>
        </div>
    );
}

// ─── Loading State ────────────────────────────────────────────────────────────

function LoadingSkeleton() {
    return (
        <div className={styles.container}>
            <div className={styles.strip}>
                {AGENTS.map((agent) => (
                    <div
                        key={agent.id}
                        className={styles.agentColumn}
                        style={{ '--agent-color': agent.color } as React.CSSProperties}
                    >
                        <div className={styles.agentHeader}>
                            <div className={`${styles.avatarWrapper} ${styles.skeleton}`} />
                            <span className={`${styles.agentName} ${styles.skeleton}`}>&nbsp;</span>
                        </div>
                        <div className={styles.ticketRows}>
                            <div className={`${styles.ticketSlot} ${styles.skeleton}`} />
                            <div className={`${styles.ticketSlot} ${styles.skeleton}`} />
                            <div className={`${styles.ticketSlot} ${styles.skeleton}`} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TicketStrip({ tickets, isLoading = false }: TicketStripProps) {
    if (isLoading) {
        return <LoadingSkeleton />;
    }

    const emptyTickets: AgentTickets = { done: null, inProgress: null, next: null };

    return (
        <div className={styles.container}>
            <div className={styles.strip}>
                {AGENTS.map((agent) => (
                    <AgentColumn
                        key={agent.id}
                        agentId={agent.id}
                        agentName={agent.name}
                        agentColor={agent.color}
                        tickets={tickets[agent.id] || emptyTickets}
                    />
                ))}
            </div>
        </div>
    );
}

export default TicketStrip;
