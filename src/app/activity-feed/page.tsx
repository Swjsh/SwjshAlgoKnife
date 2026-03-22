'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, KeyboardEvent } from 'react';
import { Activity, Radio, Send, RefreshCw, Database } from 'lucide-react';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useJiraTickets } from '@/hooks/useJiraTickets';
import { useJiraLoop } from '@/hooks/useJiraLoop';
import { useJiraStats } from '@/hooks/useJiraStats';
import { ActivityStats } from '@/components/ActivityFeed/ActivityStats';
import { AgentTerminal } from '@/components/ActivityFeed/AgentTerminal';
import { PermissionQueue } from '@/components/ActivityFeed/PermissionQueue';
import { ActivityColumn } from '@/components/ActivityFeed/ActivityColumn';
import { N8nHeartbeat } from '@/components/ActivityFeed/N8nHeartbeat';
import { AgentLeaderboard } from '@/components/ActivityFeed/AgentLeaderboard';
import styles from './page.module.css';

// Agent order for the grid (7 agents: 2x3 + 1)
const AGENT_ORDER = ['chief', 'hunter', 'ops', 'scout', 'arbiter', 'cortana'] as const;

export default function ActivityFeedPage() {
    const [isHydrated, setIsHydrated] = useState(false);
    const [broadcastValue, setBroadcastValue] = useState('');
    const [syncingAgents, setSyncingAgents] = useState(false);
    const [syncingJira, setSyncingJira] = useState(false);
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
        continueAgent,
        rescanSessions,
        waitingCount,
    } = useActivityFeed();

    // Fetch Jira tickets for all agents
    const { tickets, refetch: refetchTickets } = useJiraTickets();

    // Jira loop controls
    const { loopState, isLoading: loopLoading, startLoop, stopLoop } = useJiraLoop();

    // Jira ticket count stats per agent
    const { stats: jiraStats } = useJiraStats();

    // Sync Agents — tell the bridge to clear ignored sessions and re-detect agents
    const handleSyncAgents = useCallback(async () => {
        setSyncingAgents(true);
        try {
            rescanSessions();
        } finally {
            setTimeout(() => setSyncingAgents(false), 600);
        }
    }, []);

    // Sync Jira — refetch Jira tickets for all agents
    const handleSyncJira = useCallback(async () => {
        setSyncingJira(true);
        try {
            await refetchTickets();
        } finally {
            setTimeout(() => setSyncingJira(false), 600);
        }
    }, [refetchTickets]);

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

    // Hydration
    useEffect(() => {
        setIsHydrated(true);
    }, []);

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
            {/* Unified top bar: title + stats + clock */}
            <div className={styles.topBar}>
                <h1 className={styles.title}>
                    <Activity size={16} style={{ display: 'inline', marginRight: 4 }} />
                    Activity Feed
                </h1>
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
                waitingCount={waitingCount}
                loopState={loopState}
                loopLoading={loopLoading}
                onStartLoop={startLoop}
                onStopLoop={stopLoop}
            />
                <AgentLeaderboard
                    agents={agents}
                    toolSuccesses={toolSuccesses}
                    toolFailures={toolFailures}
                    actionsToday={actionsToday}
                />
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <N8nHeartbeat />
                    <button
                        className={`${styles.syncBtn} ${styles.syncAgentsBtn} ${syncingAgents ? styles.refreshSpin : ''}`}
                        onClick={handleSyncAgents}
                        disabled={syncingAgents}
                        title="Sync agent status from PM2"
                    >
                        <RefreshCw size={14} className={syncingAgents ? styles.syncSpinner : ''} />
                        <span className={styles.syncBtnLabel}>Sync Agents</span>
                    </button>
                    <button
                        className={`${styles.syncBtn} ${styles.syncJiraBtn} ${syncingJira ? styles.refreshSpin : ''}`}
                        onClick={handleSyncJira}
                        disabled={syncingJira}
                        title="Sync Jira tickets"
                    >
                        <Database size={14} className={syncingJira ? styles.syncSpinner : ''} />
                        <span className={styles.syncBtnLabel}>Sync Jira</span>
                    </button>
                </div>
            </div>

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

            {/* Main Content - Agent Grid + Activity Column */}
            <div className={styles.mainContent}>
                {/* Agent Terminals - 2x3 Grid */}
                <div className={styles.agentGrid}>
                    {orderedAgents.map((agent) => (
                        <AgentTerminal
                            key={agent.id}
                            agent={agent}
                            onSendCommand={sendCommand}
                            heartbeat={heartbeat[agent.id]}
                            onNudge={nudgeAgent}
                            onContinue={continueAgent}
                            jiraStats={jiraStats[agent.id]}
                        />
                    ))}
                </div>

                {/* Activity Column - Right Side */}
                <div className={styles.activityColumn}>
                    <ActivityColumn tickets={tickets} agents={agents} />
                </div>
            </div>

        </div>
    );
}
