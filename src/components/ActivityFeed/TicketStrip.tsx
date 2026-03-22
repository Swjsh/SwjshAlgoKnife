'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ArrowRight, Check, RefreshCw, Loader2 } from 'lucide-react';
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
    onTransition?: (key: string, status: 'In Progress' | 'Done', comment?: string) => Promise<void>;
    onRefresh?: () => void;
    lastUpdated?: string | null;
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
    onTransition?: (key: string, status: 'In Progress' | 'Done', comment?: string) => Promise<void>;
}

function TicketCard({ ticket, slotType, onTransition }: TicketCardProps) {
    const [isTransitioning, setIsTransitioning] = useState(false);

    const handlePickUp = async () => {
        if (!ticket || !onTransition || isTransitioning) return;
        setIsTransitioning(true);
        try {
            await onTransition(ticket.key, 'In Progress', 'Picked up via Activity Feed');
        } finally {
            setIsTransitioning(false);
        }
    };

    const handleComplete = async () => {
        if (!ticket || !onTransition || isTransitioning) return;
        setIsTransitioning(true);
        try {
            await onTransition(ticket.key, 'Done', 'Completed via Activity Feed');
        } finally {
            setIsTransitioning(false);
        }
    };

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
            {slotType === 'next' && onTransition && (
                <button
                    className={`${styles.pickUpButton} ${isTransitioning ? styles.buttonLoading : ''}`}
                    onClick={handlePickUp}
                    disabled={isTransitioning}
                >
                    {isTransitioning ? (
                        <Loader2 size={12} className={styles.spinning} />
                    ) : (
                        <>
                            <ArrowRight size={12} />
                            Pick Up
                        </>
                    )}
                </button>
            )}
            {slotType === 'inProgress' && onTransition && (
                <button
                    className={`${styles.completeButton} ${isTransitioning ? styles.buttonLoading : ''}`}
                    onClick={handleComplete}
                    disabled={isTransitioning}
                >
                    {isTransitioning ? (
                        <Loader2 size={12} className={styles.spinning} />
                    ) : (
                        <>
                            <Check size={12} />
                            Complete
                        </>
                    )}
                </button>
            )}
        </div>
    );
}

interface AgentColumnProps {
    agentId: string;
    agentName: string;
    agentColor: string;
    tickets: AgentTickets;
    onTransition?: (key: string, status: 'In Progress' | 'Done', comment?: string) => Promise<void>;
}

function AgentColumn({ agentId, agentName, agentColor, tickets, onTransition }: AgentColumnProps) {
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
                <TicketCard ticket={tickets.done} slotType="done" onTransition={onTransition} />
                <TicketCard ticket={tickets.inProgress} slotType="inProgress" onTransition={onTransition} />
                <TicketCard ticket={tickets.next} slotType="next" onTransition={onTransition} />
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

export function TicketStrip({ tickets, isLoading = false, onTransition, onRefresh, lastUpdated }: TicketStripProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        if (!onRefresh || isRefreshing) return;
        setIsRefreshing(true);
        try {
            onRefresh();
        } finally {
            // Reset after a short delay to show the animation
            setTimeout(() => setIsRefreshing(false), 1000);
        }
    };

    if (isLoading) {
        return <LoadingSkeleton />;
    }

    const emptyTickets: AgentTickets = { done: null, inProgress: null, next: null };

    return (
        <div className={styles.container}>
            {/* Refresh button inline — header removed to save space */}
            {onRefresh && (
                <div className={styles.refreshSection}>
                    {lastUpdated && (
                        <span className={styles.lastUpdated}>
                            Updated {formatTimeAgo(lastUpdated)}
                        </span>
                    )}
                    <button
                        className={`${styles.refreshButton} ${isRefreshing ? styles.spinning : ''}`}
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        title="Refresh tickets"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            )}
            <div className={styles.strip}>
                {AGENTS.map((agent) => (
                    <AgentColumn
                        key={agent.id}
                        agentId={agent.id}
                        agentName={agent.name}
                        agentColor={agent.color}
                        tickets={tickets[agent.id] || emptyTickets}
                        onTransition={onTransition}
                    />
                ))}
            </div>
        </div>
    );
}

export default TicketStrip;
