'use client';

import React from 'react';
import { Activity, Users, Clock, AlertCircle, CheckCircle, Terminal, Zap, Play, Square } from 'lucide-react';
import styles from './ActivityStats.module.css';
import type { PermissionStats } from '@/hooks/useActivityFeed';

// Jira loop state type (from useJiraLoop)
interface LoopState {
    running: boolean;
    currentProject: string | null;
    currentIssue: string | null;
    iterationCount: number;
    issuesCompleted: number;
    skillsLearned?: number;
    lastActivity?: string | null;
    errors?: string[];
}

interface ActivityStatsProps {
    onlineCount: number;
    busyCount: number;
    activeCount: number;
    totalAgents: number;
    pendingPermissions: number;
    actionsToday: number;
    lastActivity: string | null;
    isConnected: boolean;
    totalApproved: number;
    totalRejected: number;
    permissionStatsByAgent: Record<string, PermissionStats>;
    // Tool execution stats (for agents running with --dangerously-skip-permissions)
    toolExecutions?: number;
    toolSuccesses?: number;
    toolFailures?: number;
    waitingCount?: number;
    // Jira loop controls (optional)
    loopState?: LoopState | null;
    loopLoading?: boolean;
    onStartLoop?: () => Promise<void>;
    onStopLoop?: () => Promise<void>;
}

function formatTimeAgo(isoString: string | null): string {
    if (!isoString) return 'N/A';

    const diff = Date.now() - new Date(isoString).getTime();
    const seconds = Math.floor(diff / 1000);

    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export function ActivityStats({
    onlineCount,
    busyCount,
    activeCount,
    totalAgents,
    pendingPermissions,
    actionsToday,
    lastActivity,
    isConnected,
    totalApproved,
    totalRejected,
    permissionStatsByAgent,
    toolExecutions = 0,
    toolSuccesses = 0,
    toolFailures = 0,
    waitingCount,
    loopState,
    loopLoading,
    onStartLoop,
    onStopLoop,
}: ActivityStatsProps) {
    // Calculate agent breakdown for tooltip
    const agentBreakdown = Object.entries(permissionStatsByAgent)
        .filter(([_, stats]) => stats.approved > 0 || stats.rejected > 0)
        .map(([agent, stats]) => `${agent}: ${stats.approved}✓ ${stats.rejected}✗`)
        .join(' | ');

    // Show tool executions if agents are running in auto-mode (skip permissions)
    const hasToolActivity = toolExecutions > 0 || toolSuccesses > 0 || toolFailures > 0;
    const hasManualApprovals = totalApproved > 0 || totalRejected > 0;

    return (
        <div className={styles.statsBar}>
            {/* Connection Status */}
            <div className={styles.connectionStatus}>
                <div className={`${styles.connectionDot} ${isConnected ? styles.connected : styles.disconnected}`} />
                <span className={styles.connectionText}>
                    {isConnected ? 'CONNECTED' : 'OFFLINE'}
                </span>
            </div>

            {/* Stats Grid */}
            <div className={styles.statsGrid}>
                {/* Agents Active (online + busy) */}
                <div className={styles.stat}>
                    <Users size={16} className={styles.statIcon} />
                    <div className={styles.statContent}>
                        <span className={styles.statLabel}>Active Agents</span>
                        <span className={styles.statValue}>
                            <span className={activeCount > 0 ? styles.highlight : styles.muted}>
                                {activeCount}
                            </span>
                            <span className={styles.divider}>/</span>
                            <span className={styles.total}>{totalAgents}</span>
                            {busyCount > 0 && (
                                <span className={styles.busyIndicator} title={`${busyCount} busy`}>
                                    <Zap size={12} />
                                    {busyCount}
                                </span>
                            )}
                        </span>
                    </div>
                </div>

                {/* Pending Permissions */}
                <div className={`${styles.stat} ${pendingPermissions > 0 ? styles.alert : ''}`}>
                    <AlertCircle size={16} className={styles.statIcon} />
                    <div className={styles.statContent}>
                        <span className={styles.statLabel}>Pending</span>
                        <span className={`${styles.statValue} ${pendingPermissions > 0 ? styles.alertValue : ''}`}>
                            {pendingPermissions}
                        </span>
                    </div>
                </div>

                {/* Tool Executions (auto-mode) or Manual Approvals */}
                {hasToolActivity || !hasManualApprovals ? (
                    <div className={`${styles.stat} ${styles.approvalStat}`} title={`${toolExecutions} tool calls (${toolSuccesses} succeeded, ${toolFailures} failed)`}>
                        <Terminal size={16} className={styles.statIconSuccess} />
                        <div className={styles.statContent}>
                            <span className={styles.statLabel}>Tool Calls ✓/✗</span>
                            <span className={styles.statValue}>
                                <span className={styles.approvedCount}>{toolSuccesses}</span>
                                <span className={styles.divider}>/</span>
                                <span className={styles.rejectedCount}>{toolFailures}</span>
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className={`${styles.stat} ${styles.approvalStat}`} title={agentBreakdown || 'No approvals/rejections yet'}>
                        <CheckCircle size={16} className={styles.statIconSuccess} />
                        <div className={styles.statContent}>
                            <span className={styles.statLabel}>Approved / Denied</span>
                            <span className={styles.statValue}>
                                <span className={styles.approvedCount}>{totalApproved}</span>
                                <span className={styles.divider}>/</span>
                                <span className={styles.rejectedCount}>{totalRejected}</span>
                            </span>
                        </div>
                    </div>
                )}

                {/* Actions Today */}
                <div className={styles.stat}>
                    <Activity size={16} className={styles.statIcon} />
                    <div className={styles.statContent}>
                        <span className={styles.statLabel}>Actions Today</span>
                        <span className={styles.statValue}>{actionsToday.toLocaleString()}</span>
                    </div>
                </div>

                {/* Last Activity */}
                <div className={styles.stat}>
                    <Clock size={16} className={styles.statIcon} />
                    <div className={styles.statContent}>
                        <span className={styles.statLabel}>Last Activity</span>
                        <span className={styles.statValue}>{formatTimeAgo(lastActivity)}</span>
                    </div>
                </div>

                {/* Waiting Agents */}
                {waitingCount !== undefined && waitingCount > 0 && (
                    <div className={styles.statBadge} style={{ background: 'rgba(251, 191, 36, 0.15)', borderColor: 'rgba(251, 191, 36, 0.3)' }}>
                        <span className={styles.statValue} style={{ color: '#fbbf24' }}>{waitingCount}</span>
                        <span className={styles.statLabel} style={{ color: '#fbbf24' }}>WAITING</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ActivityStats;
