'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LogEntry, AgentStatus } from './useActivityFeed';

// ─── Types ────────────────────────────────────────────────────────────────────

/** AutoResearch metrics tracked per agent */
export interface AutoResearchMetrics {
    branch: string;
    experimentsRun: number;
    experimentsKept: number;
    experimentsDiscarded: number;
    currentMetric: number | null;
    bestMetric: number | null;
}

export interface ResearchAgentState {
    id: string;
    name: string;
    emoji: string;
    color: string;
    terminalNumber: number;
    status: AgentStatus;
    logs: LogEntry[];
    lastActivity: string;
    /** AutoResearch protocol metrics (Karpathy methodology) */
    autoresearch?: AutoResearchMetrics;
}

export interface ResearchAgentsState {
    agents: Record<string, ResearchAgentState>;
    loading: boolean;
    error: string | null;
}

export interface CommandQueueEntry {
    id: string;
    agentId: string;
    command: string;
    timestamp: string;
    status: 'pending' | 'sent' | 'executed';
}

// ─── Agent Definitions ────────────────────────────────────────────────────────

const RESEARCH_AGENT_DEFINITIONS: Record<string, Omit<ResearchAgentState, 'status' | 'logs' | 'lastActivity'>> = {
    improver: {
        id: 'improver',
        name: 'IMPROVER',
        emoji: '\uD83D\uDD27', // wrench
        color: '#06b6d4', // cyan
        terminalNumber: 1,
    },
    backtester: {
        id: 'backtester',
        name: 'BACKTESTER',
        emoji: '\uD83D\uDCCA', // bar chart
        color: '#22c55e', // green
        terminalNumber: 2,
    },
    researcher: {
        id: 'researcher',
        name: 'RESEARCHER',
        emoji: '\uD83D\uDD0D', // magnifying glass
        color: '#a855f7', // purple
        terminalNumber: 3,
    },
    brain_updater: {
        id: 'brain_updater',
        name: 'BRAIN_UPDATER',
        emoji: '\uD83E\uDDE0', // brain
        color: '#f59e0b', // amber
        terminalNumber: 4,
    },
    security_auditor: {
        id: 'security_auditor',
        name: 'SECURITY_AUDITOR',
        emoji: '\uD83D\uDEE1\uFE0F', // shield
        color: '#ef4444', // red
        terminalNumber: 5,
    },
    integration_tester: {
        id: 'integration_tester',
        name: 'INTEGRATION_TESTER',
        emoji: '\uD83E\uDDEA', // test tube
        color: '#3b82f6', // blue
        terminalNumber: 6,
    },
    intel_aggregator: {
        id: 'intel_aggregator',
        name: 'INTEL_AGGREGATOR',
        emoji: '\uD83D\uDCE1', // satellite
        color: '#8b5cf6', // violet
        terminalNumber: 7,
    },
    devops_optimizer: {
        id: 'devops_optimizer',
        name: 'DEVOPS_OPTIMIZER',
        emoji: '\u2699\uFE0F', // gear
        color: '#14b8a6', // teal
        terminalNumber: 8,
    },
};

// ─── Initial State ────────────────────────────────────────────────────────────

function createInitialAgents(): Record<string, ResearchAgentState> {
    const agents: Record<string, ResearchAgentState> = {};
    for (const [id, def] of Object.entries(RESEARCH_AGENT_DEFINITIONS)) {
        agents[id] = {
            ...def,
            status: 'offline',
            logs: [],
            lastActivity: new Date().toISOString(),
        };
    }
    return agents;
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function mapLogLevel(level?: string): LogEntry['level'] {
    if (!level) return 'INFO';
    const normalized = level.toLowerCase();
    if (normalized === 'error' || normalized === 'err') return 'ERROR';
    if (normalized === 'warn' || normalized === 'warning') return 'WARN';
    if (normalized === 'success' || normalized === 'ok') return 'SUCCESS';
    if (normalized === 'action' || normalized === 'act') return 'ACTION';
    return 'INFO';
}

function parseLogLine(line: string, agentId: string): LogEntry | null {
    // Parse log format: [2026-03-22T06:03:45.226Z] [INFO] Message text
    const match = line.match(/^\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.+)$/);
    if (match) {
        const [, timestamp, level, text] = match;
        return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            timestamp,
            level: mapLogLevel(level),
            text: text.substring(0, 1000),
            agentId,
        };
    }
    // Fallback: treat entire line as INFO
    if (line.trim()) {
        return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            timestamp: new Date().toISOString(),
            level: 'INFO',
            text: line.trim().substring(0, 1000),
            agentId,
        };
    }
    return null;
}

function getAgentIdFromTerminal(terminalNumber: number): string | null {
    for (const [id, def] of Object.entries(RESEARCH_AGENT_DEFINITIONS)) {
        if (def.terminalNumber === terminalNumber) {
            return id;
        }
    }
    return null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useResearchAgents(pollInterval = 5000) {
    const [state, setState] = useState<ResearchAgentsState>({
        agents: createInitialAgents(),
        loading: true,
        error: null,
    });

    const lastLogLinesRef = useRef<Record<string, number>>({});
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    // ─── Fetch Agent Status ───────────────────────────────────────────────────

    const fetchAgentStatus = useCallback(async () => {
        try {
            // Fetch status and logs for all 8 terminals
            const statusPromises: Promise<void>[] = [];

            for (let terminal = 1; terminal <= 8; terminal++) {
                const agentId = getAgentIdFromTerminal(terminal);
                if (!agentId) continue;

                // Fetch status file
                statusPromises.push(
                    fetch(`/api/research/status?terminal=${terminal}`)
                        .then(async (res) => {
                            if (res.ok) {
                                const data = await res.json();
                                setState((prev) => ({
                                    ...prev,
                                    agents: {
                                        ...prev.agents,
                                        [agentId]: {
                                            ...prev.agents[agentId],
                                            status: data.status || 'offline',
                                            lastActivity: data.lastActivity || prev.agents[agentId].lastActivity,
                                            // Parse AutoResearch metrics if present
                                            autoresearch: data.autoresearch || prev.agents[agentId].autoresearch,
                                        },
                                    },
                                }));
                            }
                        })
                        .catch(() => {
                            // Status file not found - agent is offline
                        })
                );

                // Fetch log file
                statusPromises.push(
                    fetch(`/api/research/logs?terminal=${terminal}&offset=${lastLogLinesRef.current[agentId] || 0}`)
                        .then(async (res) => {
                            if (res.ok) {
                                const data = await res.json();
                                if (data.logs && data.logs.length > 0) {
                                    const newLogs: LogEntry[] = data.logs
                                        .map((line: string) => parseLogLine(line, agentId))
                                        .filter((log: LogEntry | null): log is LogEntry => log !== null);

                                    if (newLogs.length > 0) {
                                        lastLogLinesRef.current[agentId] = (lastLogLinesRef.current[agentId] || 0) + data.logs.length;

                                        setState((prev) => ({
                                            ...prev,
                                            agents: {
                                                ...prev.agents,
                                                [agentId]: {
                                                    ...prev.agents[agentId],
                                                    logs: [...prev.agents[agentId].logs, ...newLogs].slice(-500),
                                                    status: 'busy', // If we're getting logs, agent is active
                                                    lastActivity: newLogs[newLogs.length - 1].timestamp,
                                                },
                                            },
                                        }));
                                    }
                                }
                            }
                        })
                        .catch(() => {
                            // Log file not found
                        })
                );
            }

            await Promise.allSettled(statusPromises);

            setState((prev) => ({
                ...prev,
                loading: false,
                error: null,
            }));
        } catch (err) {
            setState((prev) => ({
                ...prev,
                loading: false,
                error: err instanceof Error ? err.message : 'Failed to fetch agent status',
            }));
        }
    }, []);

    // ─── Send Command ─────────────────────────────────────────────────────────

    const sendCommand = useCallback(async (agentId: string, command: string): Promise<boolean> => {
        const agent = RESEARCH_AGENT_DEFINITIONS[agentId];
        if (!agent) {
            console.error(`[useResearchAgents] Unknown agent: ${agentId}`);
            return false;
        }

        try {
            const response = await fetch('/api/research/command', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    terminal: agent.terminalNumber,
                    agentId,
                    command,
                    timestamp: new Date().toISOString(),
                }),
            });

            if (!response.ok) {
                console.error(`[useResearchAgents] Failed to send command to ${agentId}`);
                return false;
            }

            console.log(`[useResearchAgents] Command sent to ${agentId}: ${command.substring(0, 50)}...`);

            // Add command to local logs as ACTION
            const logEntry: LogEntry = {
                id: `cmd-${Date.now()}`,
                timestamp: new Date().toISOString(),
                level: 'ACTION',
                text: `[CMD] ${command}`,
                agentId,
            };
            setState((prev) => ({
                ...prev,
                agents: {
                    ...prev.agents,
                    [agentId]: {
                        ...prev.agents[agentId],
                        logs: [...prev.agents[agentId].logs, logEntry].slice(-500),
                        lastActivity: new Date().toISOString(),
                    },
                },
            }));

            return true;
        } catch (err) {
            console.error(`[useResearchAgents] Error sending command to ${agentId}:`, err);
            return false;
        }
    }, []);

    // ─── Broadcast Command ────────────────────────────────────────────────────

    const broadcastCommand = useCallback(async (command: string): Promise<boolean> => {
        try {
            const response = await fetch('/api/research/command', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    broadcast: true,
                    command,
                    timestamp: new Date().toISOString(),
                }),
            });

            if (!response.ok) {
                console.error('[useResearchAgents] Failed to broadcast command');
                return false;
            }

            console.log(`[useResearchAgents] Broadcast command: ${command.substring(0, 50)}...`);

            // Add command to all agent logs
            setState((prev) => {
                const newAgents = { ...prev.agents };
                const now = new Date().toISOString();
                for (const id of Object.keys(newAgents)) {
                    const logEntry: LogEntry = {
                        id: `cmd-${Date.now()}-${id}`,
                        timestamp: now,
                        level: 'ACTION',
                        text: `[BROADCAST] ${command}`,
                        agentId: id,
                    };
                    newAgents[id] = {
                        ...newAgents[id],
                        logs: [...newAgents[id].logs, logEntry].slice(-500),
                        lastActivity: now,
                    };
                }
                return { ...prev, agents: newAgents };
            });

            return true;
        } catch (err) {
            console.error('[useResearchAgents] Error broadcasting command:', err);
            return false;
        }
    }, []);

    // ─── Agent Control Actions ───────────────────────────────────────────────

    const startAgent = useCallback(async (agentId: string): Promise<boolean> => {
        const agent = RESEARCH_AGENT_DEFINITIONS[agentId];
        if (!agent) return false;

        try {
            const response = await fetch('/api/research/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start',
                    terminal: agent.terminalNumber,
                    agentId,
                }),
            });

            if (response.ok) {
                setState((prev) => ({
                    ...prev,
                    agents: {
                        ...prev.agents,
                        [agentId]: {
                            ...prev.agents[agentId],
                            status: 'busy',
                            lastActivity: new Date().toISOString(),
                        },
                    },
                }));
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }, []);

    const stopAgent = useCallback(async (agentId: string): Promise<boolean> => {
        const agent = RESEARCH_AGENT_DEFINITIONS[agentId];
        if (!agent) return false;

        try {
            const response = await fetch('/api/research/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'stop',
                    terminal: agent.terminalNumber,
                    agentId,
                }),
            });

            if (response.ok) {
                setState((prev) => ({
                    ...prev,
                    agents: {
                        ...prev.agents,
                        [agentId]: {
                            ...prev.agents[agentId],
                            status: 'offline',
                        },
                    },
                }));
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }, []);

    const refreshAgent = useCallback(async (agentId: string): Promise<boolean> => {
        const agent = RESEARCH_AGENT_DEFINITIONS[agentId];
        if (!agent) return false;

        try {
            const response = await fetch('/api/research/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'refresh',
                    terminal: agent.terminalNumber,
                    agentId,
                }),
            });

            if (response.ok) {
                // Trigger immediate refetch
                await fetchAgentStatus();
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }, [fetchAgentStatus]);

    const deployAgent = useCallback(async (agentId: string): Promise<boolean> => {
        const agent = RESEARCH_AGENT_DEFINITIONS[agentId];
        if (!agent) return false;

        try {
            const response = await fetch('/api/research/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'deploy',
                    terminal: agent.terminalNumber,
                    agentId,
                }),
            });

            if (response.ok) {
                const deployLog: LogEntry = {
                    id: `deploy-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    level: 'ACTION',
                    text: `[DEPLOY] Deploying ${agent.name}...`,
                    agentId,
                };
                setState((prev) => ({
                    ...prev,
                    agents: {
                        ...prev.agents,
                        [agentId]: {
                            ...prev.agents[agentId],
                            status: 'busy',
                            lastActivity: new Date().toISOString(),
                            logs: [...prev.agents[agentId].logs, deployLog].slice(-500),
                        },
                    },
                }));
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }, []);

    // ─── Clear Logs ───────────────────────────────────────────────────────────

    const clearLogs = useCallback((agentId?: string) => {
        if (agentId) {
            // Clear specific agent logs
            setState((prev) => ({
                ...prev,
                agents: {
                    ...prev.agents,
                    [agentId]: {
                        ...prev.agents[agentId],
                        logs: [],
                    },
                },
            }));
            lastLogLinesRef.current[agentId] = 0;
        } else {
            // Clear all logs
            setState((prev) => {
                const newAgents = { ...prev.agents };
                for (const id of Object.keys(newAgents)) {
                    newAgents[id] = {
                        ...newAgents[id],
                        logs: [],
                    };
                }
                return { ...prev, agents: newAgents };
            });
            lastLogLinesRef.current = {};
        }
    }, []);

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    useEffect(() => {
        // Initial fetch
        fetchAgentStatus();

        // Set up polling
        pollingRef.current = setInterval(fetchAgentStatus, pollInterval);

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }
        };
    }, [fetchAgentStatus, pollInterval]);

    // ─── Computed Values ──────────────────────────────────────────────────────

    const agentValues = Object.values(state.agents);
    const onlineCount = agentValues.filter((a) => a.status === 'online').length;
    const busyCount = agentValues.filter((a) => a.status === 'busy').length;
    const offlineCount = agentValues.filter((a) => a.status === 'offline').length;
    const totalAgents = Object.keys(state.agents).length;
    const activeCount = onlineCount + busyCount;

    // Get agents as array sorted by terminal number
    const agentsList = agentValues.sort((a, b) => a.terminalNumber - b.terminalNumber);

    return {
        agents: state.agents,
        agentsList,
        loading: state.loading,
        error: state.error,
        onlineCount,
        busyCount,
        offlineCount,
        activeCount,
        totalAgents,
        sendCommand,
        broadcastCommand,
        clearLogs,
        refetch: fetchAgentStatus,
        // Agent control actions
        startAgent,
        stopAgent,
        refreshAgent,
        deployAgent,
    };
}

export default useResearchAgents;

// ─── Export Agent Definitions ─────────────────────────────────────────────────

export { RESEARCH_AGENT_DEFINITIONS };
