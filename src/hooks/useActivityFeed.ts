'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AgentAction } from '@/lib/agentActionPatterns';

// Re-export AgentAction for consumers
export type { AgentAction };

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgentStatus = 'online' | 'offline' | 'busy';

export interface LogEntry {
    id: string;
    timestamp: string;
    level: 'INFO' | 'WARN' | 'SUCCESS' | 'ERROR' | 'ACTION';
    text: string;
    agentId: string;
}

export interface AgentState {
    id: string;
    name: string;
    emoji: string;
    color: string;
    avatar?: string;
    status: AgentStatus;
    logs: LogEntry[];
    lastActivity: string;
}

export interface PermissionRequest {
    id: string;
    agentId: string;
    agentName: string;
    agentEmoji: string;
    toolName: string;
    params: Record<string, unknown>;
    timestamp: string;
    isNew?: boolean;
}

export interface PermissionStats {
    approved: number;
    rejected: number;
}

export interface HeartbeatAgentState {
    status: 'alive' | 'stale' | 'dead' | 'unknown' | 'waiting_input';
    lastSeen: string | null;
    nudgeCount: number;
    lastNudge: string | null;
    waitingDetectedAt: string | null;
    lastPrompt: string | null;
}

export interface HeartbeatConfig {
    staleThresholdMs: number;
    deadThresholdMs: number;
    autoNudgeEnabled: boolean;
    autoNudgeIntervalMs: number;
    nudgeCooldownMs: number;
}

export interface ActivityFeedState {
    agents: Record<string, AgentState>;
    permissions: PermissionRequest[];
    isConnected: boolean;
    actionsToday: number;
    lastActivity: string | null;
    // Permission statistics (manual approvals from dashboard)
    totalApproved: number;
    totalRejected: number;
    permissionStatsByAgent: Record<string, PermissionStats>;
    // Tool execution tracking (auto-executed with --dangerously-skip-permissions)
    toolExecutions: number;
    toolSuccesses: number;
    toolFailures: number;
    // Heartbeat tracking
    heartbeat: Record<string, HeartbeatAgentState>;
    heartbeatConfig: HeartbeatConfig;
    // Agent actions (Jira, memory, commits, etc.)
    agentActions: AgentAction[];
}

// ─── Agent Definitions ────────────────────────────────────────────────────────

const AGENT_DEFINITIONS: Record<string, Omit<AgentState, 'status' | 'logs' | 'lastActivity'>> = {
    chief: {
        id: 'chief',
        name: 'Chief',
        emoji: '\u2694\uFE0F',
        color: '#6B8E23',
        avatar: '/avatars/halo/chief.png',
    },
    hunter: {
        id: 'hunter',
        name: 'Hunter',
        emoji: '\uD83C\uDFAF',
        color: '#8A2BE2',
        avatar: '/avatars/halo/hunter.png',
    },
    ops: {
        id: 'ops',
        name: 'Ops',
        emoji: '\uD83D\uDCE1',
        color: '#DAA520',
        avatar: '/avatars/halo/ops.png',
    },
    scout: {
        id: 'scout',
        name: 'Scout',
        emoji: '\uD83D\uDD2D',
        color: '#2E8B57',
        avatar: '/avatars/halo/scout.png',
    },
    arbiter: {
        id: 'arbiter',
        name: 'Arbiter',
        emoji: '\u2696\uFE0F',
        color: '#8B4513',
        avatar: '/avatars/halo/arbiter.png',
    },
    cortana: {
        id: 'cortana',
        name: 'Cortana',
        emoji: '\uD83E\uDDE0',
        color: '#6495ED',
        avatar: '/avatars/halo/cortana.png',
    },
    // Oracle is in definitions for state tracking, but NOT displayed on activity-feed grid
    // Oracle has its own UI section on /halo-command page
    oracle: {
        id: 'oracle',
        name: 'Oracle',
        emoji: '\uD83D\uDD2E',
        color: '#9333EA',
        avatar: '/avatars/halo/oracle.png',
    },
};

// ─── Initial State ────────────────────────────────────────────────────────────

function createInitialAgents(): Record<string, AgentState> {
    const agents: Record<string, AgentState> = {};
    for (const [id, def] of Object.entries(AGENT_DEFINITIONS)) {
        agents[id] = {
            ...def,
            status: 'offline',
            logs: [],
            lastActivity: new Date().toISOString(),
        };
    }
    return agents;
}

function createAgentFromId(id: string): AgentState {
    const def = AGENT_DEFINITIONS[id] || {
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        emoji: '\uD83E\uDD16',
        color: '#888888',
    };
    return {
        ...def,
        id,
        status: 'offline',
        logs: [],
        lastActivity: new Date().toISOString(),
    };
}

function mapLogLevel(level?: string): LogEntry['level'] {
    if (!level) return 'INFO';
    const normalized = level.toLowerCase();
    if (normalized === 'error' || normalized === 'err') return 'ERROR';
    if (normalized === 'warn' || normalized === 'warning') return 'WARN';
    if (normalized === 'success' || normalized === 'ok') return 'SUCCESS';
    if (normalized === 'action' || normalized === 'act') return 'ACTION';
    return 'INFO';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useActivityFeed(wsUrl = 'ws://localhost:3001') {
    const [state, setState] = useState<ActivityFeedState>({
        agents: createInitialAgents(),
        permissions: [],
        isConnected: false,
        actionsToday: 0,
        lastActivity: null,
        totalApproved: 0,
        totalRejected: 0,
        permissionStatsByAgent: {},
        toolExecutions: 0,
        toolSuccesses: 0,
        toolFailures: 0,
        heartbeat: {},
        heartbeatConfig: {
            staleThresholdMs: 180000,
            deadThresholdMs: 600000,
            autoNudgeEnabled: true,
            autoNudgeIntervalMs: 120000,
            nudgeCooldownMs: 60000,
        },
        agentActions: [],
    });

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttemptsRef = useRef(0);

    // ─── Log Throttling ────────────────────────────────────────────────────────
    // Buffer logs and flush periodically to prevent UI spam while maintaining fidelity
    const logBufferRef = useRef<Map<string, LogEntry[]>>(new Map());
    const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
    const LOG_FLUSH_INTERVAL = 400; // ms - faster for better real-time feel
    const MAX_LOGS_PER_FLUSH = 8; // Max logs to add per agent per flush - increased for better fidelity

    const flushLogBuffer = useCallback(() => {
        const buffer = logBufferRef.current;
        if (buffer.size === 0) return;

        setState(prev => {
            const newState = { ...prev };
            let totalNewLogs = 0;

            buffer.forEach((logs, agentName) => {
                const agent = prev.agents[agentName];
                if (agent && logs.length > 0) {
                    // Take only the most recent logs if buffer is large
                    const logsToAdd = logs.slice(-MAX_LOGS_PER_FLUSH);
                    const newLogs = [...agent.logs, ...logsToAdd].slice(-500);
                    newState.agents = {
                        ...newState.agents,
                        [agentName]: {
                            ...agent,
                            logs: newLogs,
                            lastActivity: logsToAdd[logsToAdd.length - 1]?.timestamp || agent.lastActivity,
                        },
                    };
                    totalNewLogs += logsToAdd.length;
                }
            });

            // Clear the buffer
            logBufferRef.current = new Map();

            return {
                ...newState,
                actionsToday: prev.actionsToday + totalNewLogs,
                lastActivity: new Date().toISOString(),
            };
        });
    }, []);

    // Start flush timer on mount
    useEffect(() => {
        flushTimerRef.current = setInterval(flushLogBuffer, LOG_FLUSH_INTERVAL);
        return () => {
            if (flushTimerRef.current) {
                clearInterval(flushTimerRef.current);
            }
        };
    }, [flushLogBuffer]);

    // ─── WebSocket Connection ─────────────────────────────────────────────────

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[ActivityFeed] WebSocket connected');
                reconnectAttemptsRef.current = 0;
                setState(prev => ({ ...prev, isConnected: true }));

                // Subscribe to get initial state
                ws.send(JSON.stringify({
                    type: 'dashboard:subscribe',
                    filters: {},
                }));
            };

            ws.onclose = () => {
                console.log('[ActivityFeed] WebSocket disconnected');
                setState(prev => ({ ...prev, isConnected: false }));
                scheduleReconnect();
            };

            ws.onerror = (error) => {
                console.warn('[ActivityFeed] WebSocket error:', error);
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    handleMessage(message);
                } catch (err) {
                    console.warn('[ActivityFeed] Failed to parse message:', err);
                }
            };
        } catch (err) {
            console.warn('[ActivityFeed] Failed to connect:', err);
            scheduleReconnect();
        }
    }, [wsUrl]);

    const scheduleReconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }

        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current += 1;

        console.log(`[ActivityFeed] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

        reconnectTimeoutRef.current = setTimeout(() => {
            connect();
        }, delay);
    }, [connect]);

    // ─── Message Handler ──────────────────────────────────────────────────────

    const handleMessage = useCallback((message: {
        type: string;
        // Old format
        agentId?: string;
        status?: AgentStatus;
        log?: LogEntry;
        permission?: PermissionRequest;
        permissionId?: string;
        actionsToday?: number;
        // New format from activity-hub
        agent?: string;
        line?: string;
        level?: string;
        timestamp?: string;
        sessionId?: string;
        messageType?: string;
        toolName?: string;
        toolId?: string;
        id?: string;
        tool?: string;
        params?: Record<string, unknown>;
        prompt?: string;
        stream?: 'stdout' | 'stderr';
        directConnection?: boolean;
        directCount?: number;
        queuedCount?: number;
        commandId?: string;
        agents?: Array<{ name: string; status: AgentStatus; connectedAt: string }> | Record<string, HeartbeatAgentState>;
        pendingPermissions?: Array<PermissionRequest>;
        recentActivity?: Array<{ type: string; [key: string]: unknown }>;
        approved?: boolean;
        // Heartbeat fields
        config?: HeartbeatConfig;
        lastSeen?: string | null;
        lastNudge?: string | null;
        nudgeCount?: number;
        isAuto?: boolean;
    }) => {
        // ─── Buffer log messages (old, new, and agent-proxy output formats) ────
        if (message.type === 'agent:output' && message.agent && message.line) {
            // Raw terminal output from agent-proxy (direct WebSocket connection)
            const agentName = message.agent.toLowerCase();
            const lineText = typeof message.line === 'string' ? message.line : JSON.stringify(message.line);
            const logEntry: LogEntry = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                timestamp: message.timestamp || new Date().toISOString(),
                level: mapLogLevel(message.level || (message.stream === 'stderr' ? 'error' : 'info')),
                text: lineText.substring(0, 3000),
                agentId: agentName,
            };

            const buffer = logBufferRef.current;
            const existingLogs = buffer.get(agentName) || [];
            existingLogs.push(logEntry);
            buffer.set(agentName, existingLogs);
        } else if (message.type === 'agent:log' && message.agent && message.line) {
            // New format
            const agentName = message.agent.toLowerCase();
            const lineText = typeof message.line === 'string' ? message.line : JSON.stringify(message.line);
            const logEntry: LogEntry = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                timestamp: message.timestamp || new Date().toISOString(),
                level: mapLogLevel(message.level),
                text: lineText.substring(0, 3000),
                agentId: agentName,
            };

            const buffer = logBufferRef.current;
            const existingLogs = buffer.get(agentName) || [];
            existingLogs.push(logEntry);
            buffer.set(agentName, existingLogs);

            // Track tool executions from log content
            if (lineText.startsWith('[TOOL]')) {
                setState(prev => ({ ...prev, toolExecutions: prev.toolExecutions + 1 }));
            } else if (lineText.startsWith('[RESULT]')) {
                if (lineText.includes('Success')) {
                    setState(prev => ({ ...prev, toolSuccesses: prev.toolSuccesses + 1 }));
                } else if (lineText.includes('Failed')) {
                    setState(prev => ({ ...prev, toolFailures: prev.toolFailures + 1 }));
                }
            }
        } else if (message.type === 'agent_log' && message.agentId && message.log) {
            // Old format
            const buffer = logBufferRef.current;
            const existingLogs = buffer.get(message.agentId) || [];
            existingLogs.push(message.log);
            buffer.set(message.agentId, existingLogs);
        }

        setState(prev => {
            const newState = { ...prev };

            switch (message.type) {
                // Old format support
                case 'agent_status': {
                    if (message.agentId && message.status) {
                        const agentDef = prev.agents[message.agentId] ?? createAgentFromId(message.agentId);
                        newState.agents = {
                            ...prev.agents,
                            [message.agentId]: {
                                ...agentDef,
                                status: message.status,
                                lastActivity: new Date().toISOString(),
                            },
                        };
                        newState.lastActivity = new Date().toISOString();
                    }
                    break;
                }

                case 'agent_log': {
                    // Old format logs are also buffered
                    // Actual buffering happens above setState
                    if (message.agentId) {
                        const agent = prev.agents[message.agentId];
                        if (agent) {
                            newState.agents = {
                                ...prev.agents,
                                [message.agentId]: {
                                    ...agent,
                                    status: 'busy',
                                    lastActivity: new Date().toISOString(),
                                },
                            };
                            newState.lastActivity = new Date().toISOString();
                        }
                    }
                    break;
                }

                case 'permission_request': {
                    if (message.permission) {
                        newState.permissions = [
                            { ...message.permission, isNew: true },
                            ...prev.permissions,
                        ];
                        newState.lastActivity = new Date().toISOString();
                    }
                    break;
                }

                case 'permission_resolved': {
                    if (message.permissionId) {
                        newState.permissions = prev.permissions.filter(
                            p => p.id !== message.permissionId
                        );
                    }
                    break;
                }

                case 'sync': {
                    if (message.actionsToday !== undefined) {
                        newState.actionsToday = message.actionsToday;
                    }
                    break;
                }

                // New format from activity-hub (session watcher)
                case 'agent:status': {
                    const agentName = message.agent?.toLowerCase();
                    if (agentName && message.status) {
                        const agentDef = prev.agents[agentName] ?? createAgentFromId(agentName);
                        newState.agents = {
                            ...prev.agents,
                            [agentName]: {
                                ...agentDef,
                                status: message.status,
                                lastActivity: message.timestamp || new Date().toISOString(),
                            },
                        };
                        newState.lastActivity = message.timestamp || new Date().toISOString();
                    }
                    break;
                }

                case 'agent:output':
                case 'agent:log': {
                    // Logs are buffered and flushed periodically to prevent UI spam
                    // The actual log entry is created and buffered outside this setState
                    const agentName = message.agent?.toLowerCase();
                    if (agentName) {
                        const agent = prev.agents[agentName] ?? createAgentFromId(agentName);
                        // Just update the agent status to busy, logs will be added via buffer flush
                        newState.agents = {
                            ...prev.agents,
                            [agentName]: {
                                ...agent,
                                status: 'busy',
                                lastActivity: message.timestamp || new Date().toISOString(),
                            },
                        };
                        newState.lastActivity = message.timestamp || new Date().toISOString();
                    }
                    break;
                }

                case 'agent:permission': {
                    const agentName = message.agent?.toLowerCase() || 'unknown';
                    const agentDef = AGENT_DEFINITIONS[agentName] || { name: agentName, emoji: '\uD83E\uDD16', color: '#888' };
                    if (message.id) {
                        const permReq: PermissionRequest = {
                            id: message.id,
                            agentId: agentName,
                            agentName: agentDef.name,
                            agentEmoji: agentDef.emoji,
                            toolName: message.tool || message.toolName || 'Unknown Tool',
                            params: message.params || {},
                            timestamp: message.timestamp || new Date().toISOString(),
                            isNew: true,
                        };
                        newState.permissions = [permReq, ...prev.permissions];
                        newState.lastActivity = message.timestamp || new Date().toISOString();
                    }
                    break;
                }

                case 'hub:permission_resolved': {
                    if (message.id) {
                        newState.permissions = prev.permissions.filter(p => p.id !== message.id);
                    }
                    break;
                }

                case 'hub:state': {
                    // Initial state sync from hub
                    if (message.agents && Array.isArray(message.agents)) {
                        for (const agent of message.agents) {
                            const name = agent.name.toLowerCase();
                            const existing = prev.agents[name] ?? createAgentFromId(name);
                            newState.agents = {
                                ...newState.agents,
                                [name]: {
                                    ...existing,
                                    status: agent.status,
                                    lastActivity: agent.connectedAt,
                                },
                            };
                        }
                    }
                    if (message.pendingPermissions) {
                        // pendingPermissions from hub uses different field names
                        type HubPermission = {
                            id: string;
                            agent?: string;
                            agentId?: string;
                            tool?: string;
                            toolName?: string;
                            params?: Record<string, unknown>;
                            createdAt?: string;
                            timestamp?: string;
                        };
                        for (const perm of message.pendingPermissions as HubPermission[]) {
                            const agentName = (perm.agent || perm.agentId || 'unknown').toLowerCase();
                            const agentDef = AGENT_DEFINITIONS[agentName] || { name: agentName, emoji: '\uD83E\uDD16', color: '#888' };
                            const permReq: PermissionRequest = {
                                id: perm.id,
                                agentId: agentName,
                                agentName: agentDef.name,
                                agentEmoji: agentDef.emoji,
                                toolName: perm.tool || perm.toolName || 'Unknown Tool',
                                params: perm.params || {},
                                timestamp: perm.createdAt || perm.timestamp || new Date().toISOString(),
                            };
                            if (!newState.permissions.find(p => p.id === perm.id)) {
                                newState.permissions.push(permReq);
                            }
                        }
                    }
                    break;
                }

                // Command confirmations from bridge
                case 'command:queued': {
                    // Command was queued for an agent (file-based fallback)
                    const agentName = message.agentId?.toLowerCase();
                    if (agentName) {
                        const agent = prev.agents[agentName] ?? createAgentFromId(agentName);
                        const logEntry: LogEntry = {
                            id: `cmd-${Date.now()}`,
                            timestamp: message.timestamp || new Date().toISOString(),
                            level: 'ACTION',
                            text: `[CMD] ${(message as any).command || 'Command queued'}`,
                            agentId: agentName,
                        };
                        newState.agents = {
                            ...prev.agents,
                            [agentName]: {
                                ...agent,
                                logs: [...agent.logs, logEntry].slice(-500),
                                lastActivity: new Date().toISOString(),
                            },
                        };
                    }
                    break;
                }

                case 'broadcast:queued': {
                    // Broadcast command was sent/queued to all agents
                    newState.lastActivity = new Date().toISOString();
                    break;
                }

                case 'permission:resolved': {
                    // Bridge format for permission resolution
                    if (message.id) {
                        newState.permissions = prev.permissions.filter(p => p.id !== message.id);
                    }
                    break;
                }

                // Heartbeat messages
                case 'heartbeat:state': {
                    // Initial heartbeat state from bridge
                    if (message.agents && typeof message.agents === 'object' && !Array.isArray(message.agents)) {
                        newState.heartbeat = message.agents as unknown as Record<string, HeartbeatAgentState>;
                    }
                    if (message.config) {
                        newState.heartbeatConfig = message.config as HeartbeatConfig;
                    }
                    break;
                }

                case 'agent:heartbeat': {
                    // Individual agent heartbeat update
                    const agentName = message.agent?.toLowerCase();
                    if (agentName) {
                        const heartbeatStatus = (message.status as HeartbeatAgentState['status']) || 'unknown';
                        const existingState = prev.heartbeat[agentName];
                        newState.heartbeat = {
                            ...prev.heartbeat,
                            [agentName]: {
                                status: heartbeatStatus,
                                lastSeen: message.lastSeen || null,
                                nudgeCount: message.nudgeCount || 0,
                                lastNudge: message.lastNudge || null,
                                waitingDetectedAt: existingState?.waitingDetectedAt || null,
                                lastPrompt: existingState?.lastPrompt || null,
                            },
                        };
                    }
                    break;
                }

                case 'heartbeat:config': {
                    // Heartbeat config update
                    if (message.config) {
                        newState.heartbeatConfig = message.config as HeartbeatConfig;
                    }
                    break;
                }

                case 'agent:nudged': {
                    // Agent was nudged - update nudge count
                    const agentName = message.agent?.toLowerCase();
                    if (agentName && newState.heartbeat[agentName]) {
                        newState.heartbeat = {
                            ...prev.heartbeat,
                            [agentName]: {
                                ...prev.heartbeat[agentName],
                                nudgeCount: message.nudgeCount || (prev.heartbeat[agentName]?.nudgeCount || 0) + 1,
                                lastNudge: message.timestamp || new Date().toISOString(),
                            },
                        };
                    }
                    break;
                }

                case 'agent:waiting': {
                    const agentName = message.agent?.toLowerCase();
                    if (agentName) {
                        newState.heartbeat = {
                            ...prev.heartbeat,
                            [agentName]: {
                                ...prev.heartbeat[agentName],
                                status: 'waiting_input',
                                lastPrompt: message.prompt || null,
                                waitingDetectedAt: message.timestamp || new Date().toISOString(),
                                lastSeen: prev.heartbeat[agentName]?.lastSeen || null,
                                nudgeCount: prev.heartbeat[agentName]?.nudgeCount || 0,
                                lastNudge: prev.heartbeat[agentName]?.lastNudge || null,
                            },
                        };
                    }
                    break;
                }

                case 'agent:auto_continued': {
                    const agentName = message.agent?.toLowerCase();
                    if (agentName && prev.heartbeat[agentName]) {
                        newState.heartbeat = {
                            ...prev.heartbeat,
                            [agentName]: {
                                ...prev.heartbeat[agentName],
                                status: 'alive',
                                waitingDetectedAt: null,
                            },
                        };
                    }
                    break;
                }

                case 'agent:action': {
                    // Important agent action detected (Jira, memory, commits, etc.)
                    const action = (message as { action?: AgentAction }).action;
                    if (action) {
                        // Keep last 50 actions, newest first
                        newState.agentActions = [action, ...prev.agentActions].slice(0, 50);
                        newState.lastActivity = action.timestamp;
                    }
                    break;
                }
            }

            return newState;
        });
    }, []);

    // ─── Actions ──────────────────────────────────────────────────────────────

    const approve = useCallback((permissionId: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'dashboard:approve',
                id: permissionId,
                approved: true,
                respondedBy: 'dashboard',
                timestamp: new Date().toISOString(),
            }));
        }

        // Optimistic update with stats tracking
        setState(prev => {
            const permission = prev.permissions.find(p => p.id === permissionId);
            const agentId = permission?.agentId || 'unknown';
            const currentAgentStats = prev.permissionStatsByAgent[agentId] || { approved: 0, rejected: 0 };

            return {
                ...prev,
                permissions: prev.permissions.filter(p => p.id !== permissionId),
                totalApproved: prev.totalApproved + 1,
                permissionStatsByAgent: {
                    ...prev.permissionStatsByAgent,
                    [agentId]: {
                        ...currentAgentStats,
                        approved: currentAgentStats.approved + 1,
                    },
                },
            };
        });
    }, []);

    const reject = useCallback((permissionId: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'dashboard:approve',
                id: permissionId,
                approved: false,
                respondedBy: 'dashboard',
                timestamp: new Date().toISOString(),
            }));
        }

        // Optimistic update with stats tracking
        setState(prev => {
            const permission = prev.permissions.find(p => p.id === permissionId);
            const agentId = permission?.agentId || 'unknown';
            const currentAgentStats = prev.permissionStatsByAgent[agentId] || { approved: 0, rejected: 0 };

            return {
                ...prev,
                permissions: prev.permissions.filter(p => p.id !== permissionId),
                totalRejected: prev.totalRejected + 1,
                permissionStatsByAgent: {
                    ...prev.permissionStatsByAgent,
                    [agentId]: {
                        ...currentAgentStats,
                        rejected: currentAgentStats.rejected + 1,
                    },
                },
            };
        });
    }, []);

    const approveAll = useCallback(() => {
        // Approve each pending permission
        for (const perm of state.permissions) {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'dashboard:approve',
                    id: perm.id,
                    approved: true,
                    respondedBy: 'dashboard',
                    timestamp: new Date().toISOString(),
                }));
            }
        }

        // Optimistic update with stats tracking
        setState(prev => {
            const newStatsByAgent = { ...prev.permissionStatsByAgent };
            for (const perm of prev.permissions) {
                const agentId = perm.agentId || 'unknown';
                const current = newStatsByAgent[agentId] || { approved: 0, rejected: 0 };
                newStatsByAgent[agentId] = {
                    ...current,
                    approved: current.approved + 1,
                };
            }
            return {
                ...prev,
                permissions: [],
                totalApproved: prev.totalApproved + prev.permissions.length,
                permissionStatsByAgent: newStatsByAgent,
            };
        });
    }, [state.permissions]);

    // ─── Command Sending ───────────────────────────────────────────────────────

    const sendCommand = useCallback((agentId: string, command: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'dashboard:command',
                agentId,
                command,
                timestamp: new Date().toISOString(),
            }));
            console.log(`[ActivityFeed] Sent command to ${agentId}: ${command.substring(0, 50)}...`);
        }
    }, []);

    const broadcastCommand = useCallback((command: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'dashboard:broadcast',
                command,
                timestamp: new Date().toISOString(),
            }));
            console.log(`[ActivityFeed] Broadcast command to all: ${command.substring(0, 50)}...`);
        }
    }, []);

    // ─── Heartbeat Actions ─────────────────────────────────────────────────────

    const nudgeAgent = useCallback((agentId: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'dashboard:nudge',
                agentId,
                timestamp: new Date().toISOString(),
            }));
            console.log(`[ActivityFeed] Nudge sent to ${agentId}`);
        }
    }, []);

    const nudgeAllStale = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'dashboard:nudge_all',
                timestamp: new Date().toISOString(),
            }));
            console.log('[ActivityFeed] Nudge all stale agents');
        }
    }, []);

    const continueAgent = useCallback((agentId: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'dashboard:continue',
                agentId,
                timestamp: new Date().toISOString(),
            }));
            console.log(`[ActivityFeed] Continue sent to ${agentId}`);
        }
    }, []);

    const setHeartbeatConfig = useCallback((config: Partial<HeartbeatConfig>) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'dashboard:heartbeat_config',
                config,
                timestamp: new Date().toISOString(),
            }));
            console.log('[ActivityFeed] Heartbeat config updated:', config);
        }
    }, []);

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    useEffect(() => {
        connect();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connect]);

    // ─── Computed Values ──────────────────────────────────────────────────────

    const agentValues = Object.values(state.agents);
    const onlineCount = agentValues.filter(a => a.status === 'online').length;
    const busyCount = agentValues.filter(a => a.status === 'busy').length;
    const offlineCount = agentValues.filter(a => a.status === 'offline').length;
    const totalAgents = Object.keys(state.agents).length;
    const activeCount = onlineCount + busyCount; // online or busy = active
    const waitingCount = Object.values(state.heartbeat).filter(h => h.status === 'waiting_input').length;

    return {
        ...state,
        onlineCount,
        busyCount,
        offlineCount,
        activeCount,
        totalAgents,
        approve,
        reject,
        approveAll,
        sendCommand,
        broadcastCommand,
        // Tool execution stats
        toolExecutions: state.toolExecutions,
        toolSuccesses: state.toolSuccesses,
        toolFailures: state.toolFailures,
        // Heartbeat
        heartbeat: state.heartbeat,
        heartbeatConfig: state.heartbeatConfig,
        nudgeAgent,
        nudgeAllStale,
        continueAgent,
        setHeartbeatConfig,
        waitingCount,
        // Agent actions (Jira, memory, commits, etc.)
        agentActions: state.agentActions,
    };
}

export default useActivityFeed;
