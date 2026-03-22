'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, KeyboardEvent } from 'react';
import { Activity, Radio, Send } from 'lucide-react';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useJiraTickets } from '@/hooks/useJiraTickets';
import { ActivityStats } from '@/components/ActivityFeed/ActivityStats';
import { AgentTerminal } from '@/components/ActivityFeed/AgentTerminal';
import { PermissionQueue } from '@/components/ActivityFeed/PermissionQueue';
import { TicketStrip } from '@/components/ActivityFeed/TicketStrip';
import styles from './page.module.css';

// Agent order for the grid (7 agents: 2x3 + 1)
const AGENT_ORDER = ['chief', 'hunter', 'ops', 'scout', 'arbiter', 'cortana'] as const;

export default function ActivityFeedPage() {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isHydrated, setIsHydrated] = useState(false);
    const [broadcastValue, setBroadcastValue] = useState('');
    const broadcastInputRef = useRef<HTMLInputElement>(null);

    // Connect to WebSocket for real-time updates
    const {
        agents,
        permissions,
        isConnected,
        actionsToday,
        lastActivity,
        onlineCount,
        busyCount,
        activeCount,
        totalAgents,
        totalApproved,
        totalRejected,
        permissionStatsByAgent,
        toolExecutions,
        toolSuccesses,
        toolFailures,
        heartbeat,
        nudgeAgent,
        nudgeAllStale,
        approve,
        reject,
        approveAll,
        sendCommand,
        broadcastCommand,
    } = useActivityFeed();

    // Fetch Jira tickets for all agents
    const { tickets, isLoading: ticketsLoading } = useJiraTickets();

    // Keyboard shortcut handlers
    const handleApproveFirst = useCallback(() => {
        if (permissions.length > 0) {
            approve(permissions[0].id);
        }
    }, [permissions, approve]);

    const handleRejectFirst = useCallback(() => {
        if (permissions.length > 0) {
            reject(permissions[0].id);
        }
    }, [permissions, reject]);

    const handleClearSelection = useCallback(() => {
        // Could be used to clear any UI selection state
        console.log('[ActivityFeed] Selection cleared');
    }, []);

    // Handle broadcast command submission
    const handleBroadcast = useCallback(() => {
        const command = broadcastValue.trim();
        if (!command) return;

        broadcastCommand(command);
        setBroadcastValue('');
        console.log(`[ActivityFeed] Broadcast to all: ${command}`);
    }, [broadcastValue, broadcastCommand]);

    // Handle broadcast keyboard shortcut
    const handleBroadcastKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleBroadcast();
        }
    }, [handleBroadcast]);

    // Register keyboard shortcuts
    useKeyboardShortcuts({
        onApproveFirst: handleApproveFirst,
        onRejectFirst: handleRejectFirst,
        onApproveAll: approveAll,
        onClearSelection: handleClearSelection,
        enabled: true,
    });

    // Update clock every second
    useEffect(() => {
        setIsHydrated(true);
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Format time for display
    const formattedTime = useMemo(() => {
        return currentTime.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    }, [currentTime]);

    const formattedDate = useMemo(() => {
        return currentTime.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    }, [currentTime]);

    // Order agents for display
    const orderedAgents = useMemo(() => {
        return AGENT_ORDER.map((id) => agents[id]).filter(Boolean);
    }, [agents]);

    // Loading state (wait for hydration)
    if (!isHydrated) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner} />
                <span className={styles.loadingText}>Initializing Activity Feed</span>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.titleSection}>
                    <h1 className={styles.title}>
                        <Activity size={24} style={{ display: 'inline', marginRight: 10 }} />
                        Activity Feed
                    </h1>
                    <p className={styles.subtitle}>Halo Crew // Real-Time Agent Monitoring</p>
                </div>

                <div className={styles.clockSection}>
                    <span className={styles.clockTime}>{formattedTime}</span>
                    <span className={styles.clockDate}>{formattedDate}</span>
                </div>
            </header>

            {/* Activity Stats Bar */}
            <ActivityStats
                onlineCount={onlineCount}
                busyCount={busyCount}
                activeCount={activeCount}
                totalAgents={6}
                pendingPermissions={permissions.length}
                actionsToday={actionsToday}
                lastActivity={lastActivity}
                isConnected={isConnected}
                totalApproved={totalApproved}
                totalRejected={totalRejected}
                permissionStatsByAgent={permissionStatsByAgent}
                toolExecutions={toolExecutions}
                toolSuccesses={toolSuccesses}
                toolFailures={toolFailures}
            />

            {/* Master Broadcast Input */}
            <div className={styles.broadcastSection}>
                <div className={styles.broadcastIcon}>
                    <Radio size={18} />
                </div>
                <div className={styles.broadcastInputWrapper}>
                    <span className={styles.broadcastLabel}>Broadcast to All Agents</span>
                    <input
                        ref={broadcastInputRef}
                        type="text"
                        className={styles.broadcastInput}
                        placeholder={isConnected
                            ? "Type a command to send to all 6 terminals..."
                            : "Type a command (will send when connected)..."
                        }
                        value={broadcastValue}
                        onChange={(e) => setBroadcastValue(e.target.value)}
                        onKeyDown={handleBroadcastKeyDown}
                    />
                </div>
                <button
                    className={styles.broadcastButton}
                    onClick={handleBroadcast}
                    disabled={!broadcastValue.trim()}
                >
                    <Send size={14} />
                    Broadcast
                </button>
            </div>

            {/* Main Layout: 2x3 Agent Grid + Permission Queue */}
            <div className={styles.mainLayout}>
                {/* Agent Terminals - 2x3 Grid */}
                <div className={styles.agentGrid}>
                    {orderedAgents.map((agent) => (
                        <AgentTerminal
                            key={agent.id}
                            agent={agent}
                            onSendCommand={sendCommand}
                            heartbeat={heartbeat[agent.id]}
                            onNudge={nudgeAgent}
                        />
                    ))}
                </div>

                {/* Permission Queue Panel */}
                <div className={styles.permissionPanel}>
                    <PermissionQueue
                        permissions={permissions}
                        onApprove={approve}
                        onReject={reject}
                        onApproveAll={approveAll}
                    />
                </div>
            </div>

            {/* Jira Ticket Strip - Bottom Row */}
            <div className={styles.ticketStripWrapper}>
                <TicketStrip tickets={tickets} isLoading={ticketsLoading} />
            </div>
        </div>
    );
}
