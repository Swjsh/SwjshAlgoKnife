/**
 * WebSocket Activity Hub
 *
 * Central hub that bridges agent proxies and dashboard clients.
 * - Tracks connected agent proxies (Map<agentName, WebSocket>)
 * - Tracks connected dashboards (Set<WebSocket>)
 * - Manages pending permissions (Map<id, PermissionRequest>)
 * - Broadcasts agent events to all dashboards
 * - Routes approval responses to specific agent proxies
 */

import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type {
    AgentEvent,
    AgentLogEvent,
    AgentPermissionEvent,
    AgentStatusEvent,
    AgentIdentifyEvent,
    DashboardEvent,
    DashboardSubscribeEvent,
    DashboardApproveEvent,
    DashboardSyncEvent,
    HubStateEvent,
    HubPermissionResolvedEvent,
    HubErrorEvent,
    WSMessage,
    ConnectedAgent,
    DashboardFilters,
    PermissionRequest,
    ActivityEntry,
    AgentStatus,
} from './types';
import {
    addLogEntry,
    addPermissionEntry,
    addStatusEntry,
    resolvePermission,
    getRecent,
    getPending,
} from '../activity-log';

// ─── Hub State ──────────────────────────────────────────────────────────────

interface DashboardConnection {
    ws: WebSocket;
    filters: DashboardFilters;
    connectedAt: string;
}

interface HubState {
    agents: Map<string, { ws: WebSocket; meta: ConnectedAgent }>;
    dashboards: Set<DashboardConnection>;
    pendingPermissions: Map<string, PermissionRequest>;
}

const state: HubState = {
    agents: new Map(),
    dashboards: new Set(),
    pendingPermissions: new Map(),
};

// ─── Hub Class ──────────────────────────────────────────────────────────────

export class ActivityHub {
    private wss: WebSocketServer | null = null;
    private heartbeatInterval: NodeJS.Timeout | null = null;

    /**
     * Start the WebSocket server
     */
    start(port: number): void {
        if (this.wss) {
            console.warn('[ActivityHub] Already running');
            return;
        }

        this.wss = new WebSocketServer({ port });

        this.wss.on('connection', (ws: WebSocket) => {
            this.handleConnection(ws);
        });

        this.wss.on('error', (error: Error) => {
            console.error('[ActivityHub] Server error:', error);
        });

        // Heartbeat to detect dead connections
        this.heartbeatInterval = setInterval(() => {
            this.checkConnections();
        }, 30000);

        console.log(`[ActivityHub] Started on port ${port}`);
    }

    /**
     * Stop the WebSocket server
     */
    stop(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if (this.wss) {
            // Close all connections gracefully
            for (const [name, { ws }] of state.agents) {
                ws.close(1001, 'Server shutting down');
            }
            for (const dashboard of state.dashboards) {
                dashboard.ws.close(1001, 'Server shutting down');
            }

            this.wss.close();
            this.wss = null;
        }

        state.agents.clear();
        state.dashboards.clear();

        console.log('[ActivityHub] Stopped');
    }

    /**
     * Handle new WebSocket connection
     */
    private handleConnection(ws: WebSocket): void {
        console.log('[ActivityHub] New connection');

        // Set up ping/pong for connection health
        (ws as any).isAlive = true;
        ws.on('pong', () => {
            (ws as any).isAlive = true;
        });

        ws.on('message', (data: Buffer) => {
            try {
                const message = JSON.parse(data.toString()) as WSMessage;
                this.handleMessage(ws, message);
            } catch (error) {
                console.error('[ActivityHub] Invalid message:', error);
                this.sendError(ws, 'Invalid JSON message');
            }
        });

        ws.on('close', () => {
            this.handleDisconnect(ws);
        });

        ws.on('error', (error: Error) => {
            console.error('[ActivityHub] Connection error:', error);
        });
    }

    /**
     * Route incoming message to appropriate handler
     */
    private handleMessage(ws: WebSocket, message: WSMessage): void {
        switch (message.type) {
            // Agent events
            case 'agent:identify':
                this.handleAgentIdentify(ws, message as AgentIdentifyEvent);
                break;
            case 'agent:log':
                this.handleAgentLog(ws, message as AgentLogEvent);
                break;
            case 'agent:permission':
                this.handleAgentPermission(ws, message as AgentPermissionEvent);
                break;
            case 'agent:status':
                this.handleAgentStatus(ws, message as AgentStatusEvent);
                break;

            // Dashboard events
            case 'dashboard:subscribe':
                this.handleDashboardSubscribe(ws, message as DashboardSubscribeEvent);
                break;
            case 'dashboard:approve':
                this.handleDashboardApprove(ws, message as DashboardApproveEvent);
                break;
            case 'dashboard:sync':
                this.handleDashboardSync(ws);
                break;
            case 'dashboard:broadcast':
                this.handleDashboardBroadcast(ws, message as any);
                break;
            case 'dashboard:command':
                this.handleDashboardCommand(ws, message as any);
                break;

            // Session Watcher events (from session-watcher.ts)
            case 'register':
                this.handleSessionWatcherRegister(ws, message);
                break;
            case 'agent_output':
            case 'user_message':
            case 'assistant_message':
            case 'tool_call':
            case 'tool_result':
            case 'permission_request':
                this.handleSessionWatcherActivity(ws, message);
                break;

            default:
                console.warn('[ActivityHub] Unknown message type:', (message as any).type);
                this.sendError(ws, `Unknown message type: ${(message as any).type}`);
        }
    }

    /**
     * Handle WebSocket disconnect
     */
    private handleDisconnect(ws: WebSocket): void {
        // Check if it was an agent
        for (const [name, { ws: agentWs }] of state.agents) {
            if (agentWs === ws) {
                console.log(`[ActivityHub] Agent disconnected: ${name}`);
                state.agents.delete(name);
                addStatusEntry(name, 'offline');
                this.broadcastToDashboards({
                    type: 'agent:status',
                    agent: name,
                    status: 'offline',
                    timestamp: new Date().toISOString(),
                });
                return;
            }
        }

        // Check if it was a dashboard
        for (const dashboard of state.dashboards) {
            if (dashboard.ws === ws) {
                console.log('[ActivityHub] Dashboard disconnected');
                state.dashboards.delete(dashboard);
                return;
            }
        }
    }

    // ─── Agent Event Handlers ───────────────────────────────────────────────

    private handleAgentIdentify(ws: WebSocket, event: AgentIdentifyEvent): void {
        const { agent, version, capabilities } = event;

        // Check if agent already connected
        const existing = state.agents.get(agent);
        if (existing) {
            existing.ws.close(1000, 'Replaced by new connection');
        }

        const meta: ConnectedAgent = {
            name: agent,
            status: 'online',
            connectedAt: new Date().toISOString(),
            lastActivityAt: new Date().toISOString(),
            version,
            capabilities,
        };

        state.agents.set(agent, { ws, meta });
        console.log(`[ActivityHub] Agent identified: ${agent}`);

        addStatusEntry(agent, 'online', { version, capabilities });

        // Broadcast to dashboards
        this.broadcastToDashboards({
            type: 'agent:status',
            agent,
            status: 'online',
            timestamp: new Date().toISOString(),
            metadata: { version, capabilities },
        });
    }

    private handleAgentLog(ws: WebSocket, event: AgentLogEvent): void {
        const { agent, line, level } = event;

        // Update last activity
        const agentConn = state.agents.get(agent);
        if (agentConn) {
            agentConn.meta.lastActivityAt = new Date().toISOString();
        }

        // Persist
        addLogEntry(agent, line, level ?? 'info');

        // Broadcast to dashboards (with filtering)
        this.broadcastToDashboards(event, (dashboard) => {
            if (!dashboard.filters.agents && !dashboard.filters.levels) {
                return true;
            }
            if (dashboard.filters.agents && !dashboard.filters.agents.includes(agent)) {
                return false;
            }
            if (dashboard.filters.levels && level && !dashboard.filters.levels.includes(level)) {
                return false;
            }
            return true;
        });
    }

    private handleAgentPermission(ws: WebSocket, event: AgentPermissionEvent): void {
        const { id, agent, tool, params, prompt, timestamp } = event;

        const request: PermissionRequest = {
            id,
            agent,
            tool,
            params,
            prompt,
            createdAt: timestamp,
        };

        state.pendingPermissions.set(id, request);
        addPermissionEntry(request);

        console.log(`[ActivityHub] Permission request from ${agent}: ${tool}`);

        // Broadcast to all dashboards
        this.broadcastToDashboards(event);
    }

    private handleAgentStatus(ws: WebSocket, event: AgentStatusEvent): void {
        const { agent, status, metadata } = event;

        const agentConn = state.agents.get(agent);
        if (agentConn) {
            agentConn.meta.status = status;
            agentConn.meta.lastActivityAt = new Date().toISOString();
        }

        addStatusEntry(agent, status, metadata);

        // Broadcast to dashboards
        this.broadcastToDashboards(event);
    }

    // ─── Dashboard Event Handlers ───────────────────────────────────────────

    private handleDashboardSubscribe(ws: WebSocket, event: DashboardSubscribeEvent): void {
        const dashboard: DashboardConnection = {
            ws,
            filters: event.filters ?? {},
            connectedAt: new Date().toISOString(),
        };

        state.dashboards.add(dashboard);
        console.log('[ActivityHub] Dashboard subscribed');

        // Send current state
        this.sendHubState(ws);
    }

    private handleDashboardApprove(ws: WebSocket, event: DashboardApproveEvent): void {
        const { id, approved, respondedBy, timestamp } = event;

        const request = state.pendingPermissions.get(id);
        if (!request) {
            this.sendError(ws, `Permission request not found: ${id}`);
            return;
        }

        // Remove from pending
        state.pendingPermissions.delete(id);

        // Persist resolution
        resolvePermission(id, approved, respondedBy);

        console.log(`[ActivityHub] Permission ${id} ${approved ? 'approved' : 'denied'} by ${respondedBy ?? 'unknown'}`);

        // Route response to the agent
        const agentConn = state.agents.get(request.agent);
        if (agentConn) {
            const resolvedEvent: HubPermissionResolvedEvent = {
                type: 'hub:permission_resolved',
                id,
                approved,
                respondedBy,
                timestamp,
            };
            this.send(agentConn.ws, resolvedEvent);
        }

        // Notify all dashboards
        this.broadcastToDashboards({
            type: 'hub:permission_resolved',
            id,
            approved,
            respondedBy,
            timestamp,
        });
    }

    private handleDashboardSync(ws: WebSocket): void {
        this.sendHubState(ws);
    }

    private handleDashboardBroadcast(ws: WebSocket, event: { command: string; timestamp: string }): void {
        const { command, timestamp } = event;
        console.log(`[ActivityHub] Broadcasting command to all agents: ${command.substring(0, 100)}...`);

        // Send to all connected agents
        let sentCount = 0;
        for (const [agentName, { ws: agentWs }] of state.agents) {
            if (agentWs.readyState === WebSocket.OPEN) {
                this.send(agentWs, {
                    type: 'hub:command',
                    command,
                    from: 'dashboard',
                    timestamp,
                });
                sentCount++;
                console.log(`[ActivityHub] Sent broadcast to agent: ${agentName}`);
            }
        }

        // Notify dashboards of the broadcast
        this.broadcastToDashboards({
            type: 'agent:log',
            agent: 'system',
            line: `Broadcast sent to ${sentCount} agent(s): ${command.substring(0, 80)}...`,
            level: 'info',
            timestamp,
        });

        // Also write to command queue files for agents that poll
        this.writeCommandToQueues(command, timestamp);
    }

    private handleDashboardCommand(ws: WebSocket, event: { agentId: string; command: string; timestamp: string }): void {
        const { agentId, command, timestamp } = event;
        console.log(`[ActivityHub] Sending command to ${agentId}: ${command.substring(0, 100)}...`);

        const agentConn = state.agents.get(agentId);
        if (agentConn && agentConn.ws.readyState === WebSocket.OPEN) {
            this.send(agentConn.ws, {
                type: 'hub:command',
                command,
                from: 'dashboard',
                timestamp,
            });
            console.log(`[ActivityHub] Sent command to agent: ${agentId}`);
        } else {
            // Write to agent's command queue file
            this.writeCommandToQueue(agentId, command, timestamp);
        }
    }

    private writeCommandToQueues(command: string, timestamp: string): void {
        const commandsDir = path.join(process.cwd(), 'data', 'commands');

        // Ensure directory exists
        if (!fs.existsSync(commandsDir)) {
            fs.mkdirSync(commandsDir, { recursive: true });
        }

        const agents = ['chief', 'hunter', 'ops', 'scout', 'arbiter', 'cortana'];
        for (const agent of agents) {
            this.writeCommandToQueue(agent, command, timestamp);
        }
    }

    private writeCommandToQueue(agentId: string, command: string, timestamp: string): void {
        const queueFile = path.join(process.cwd(), 'data', 'commands', `${agentId}.json`);

        try {
            let queue: any[] = [];
            if (fs.existsSync(queueFile)) {
                queue = JSON.parse(fs.readFileSync(queueFile, 'utf-8'));
            }

            queue.push({
                id: `cmd-${Date.now()}`,
                command,
                status: 'pending',
                createdAt: timestamp,
                from: 'dashboard',
            });

            fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
            console.log(`[ActivityHub] Wrote command to queue: ${queueFile}`);
        } catch (error) {
            console.error(`[ActivityHub] Failed to write command queue for ${agentId}:`, error);
        }
    }

    // ─── Session Watcher Event Handlers ────────────────────────────────────

    private sessionWatcher: WebSocket | null = null;

    private handleSessionWatcherRegister(ws: WebSocket, message: any): void {
        if (message.clientType === 'session_watcher') {
            this.sessionWatcher = ws;
            console.log('[ActivityHub] Session watcher connected');
        }
    }

    private handleSessionWatcherActivity(ws: WebSocket, activity: any): void {
        const { type, agentId, sessionId, timestamp, content } = activity;

        // Ensure agent exists in state
        if (agentId && agentId !== 'unknown' && !state.agents.has(agentId)) {
            // Auto-register agent from session watcher
            const meta: ConnectedAgent = {
                name: agentId,
                status: 'online',
                connectedAt: new Date().toISOString(),
                lastActivityAt: timestamp,
                version: 'session-watcher',
                capabilities: ['session-log'],
            };

            // Create a virtual WebSocket for session-watcher tracked agents
            state.agents.set(agentId, { ws, meta });
            console.log(`[ActivityHub] Agent detected via session watcher: ${agentId}`);

            addStatusEntry(agentId, 'online', { source: 'session_watcher' });

            // Broadcast to dashboards
            this.broadcastToDashboards({
                type: 'agent:status',
                agent: agentId,
                status: 'online',
                timestamp,
                metadata: { source: 'session_watcher', sessionId },
            });
        }

        // Update last activity
        const agentConn = state.agents.get(agentId);
        if (agentConn) {
            agentConn.meta.lastActivityAt = timestamp;
            agentConn.meta.status = 'busy';
        }

        // Convert session watcher events to hub events
        switch (type) {
            case 'user_message':
            case 'assistant_message':
            case 'agent_output': {
                const text = content?.text || JSON.stringify(content);
                // addLogEntry only accepts: 'info' | 'warn' | 'error' | 'debug'
                addLogEntry(agentId, text, 'info');

                this.broadcastToDashboards({
                    type: 'agent:log',
                    agent: agentId,
                    line: text,
                    level: 'info',
                    timestamp,
                    sessionId,
                    messageType: type,
                } as any);
                break;
            }

            case 'tool_call': {
                const { toolName, toolId, input } = content || {};
                const line = `[${toolName}] ${input || ''}`;

                addLogEntry(agentId, line, 'info');

                this.broadcastToDashboards({
                    type: 'agent:log',
                    agent: agentId,
                    line,
                    level: 'info',
                    timestamp,
                    sessionId,
                    toolName,
                    toolId,
                } as any);
                break;
            }

            case 'tool_result': {
                const { toolId, success } = content || {};
                const line = `[Result] ${success ? 'Success' : 'Failed'}`;

                addLogEntry(agentId, line, success ? 'info' : 'error');

                this.broadcastToDashboards({
                    type: 'agent:log',
                    agent: agentId,
                    line,
                    level: success ? 'info' : 'error',
                    timestamp,
                    sessionId,
                    toolId,
                } as any);
                break;
            }

            case 'permission_request': {
                const { toolName, toolId, input } = content || {};
                const id = `perm-${Date.now()}-${toolId || Math.random().toString(36).slice(2)}`;

                const request: PermissionRequest = {
                    id,
                    agent: agentId,
                    tool: toolName,
                    params: input ? { input } : {},
                    prompt: `${toolName}: ${input || '(no params)'}`,
                    createdAt: timestamp,
                };

                state.pendingPermissions.set(id, request);
                addPermissionEntry(request);

                console.log(`[ActivityHub] Permission detected from ${agentId}: ${toolName}`);

                this.broadcastToDashboards({
                    type: 'agent:permission',
                    id,
                    agent: agentId,
                    tool: toolName,
                    params: request.params,
                    prompt: request.prompt,
                    timestamp,
                    sessionId,
                });
                break;
            }
        }
    }

    // ─── Utility Methods ────────────────────────────────────────────────────

    private sendHubState(ws: WebSocket): void {
        const agents = Array.from(state.agents.values()).map(({ meta }) => ({
            name: meta.name,
            status: meta.status,
            connectedAt: meta.connectedAt,
        }));

        const stateEvent: HubStateEvent = {
            type: 'hub:state',
            agents,
            pendingPermissions: Array.from(state.pendingPermissions.values()),
            recentActivity: getRecent(100),
        };

        this.send(ws, stateEvent);
    }

    private send(ws: WebSocket, message: WSMessage): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    private sendError(ws: WebSocket, message: string, code?: string): void {
        const errorEvent: HubErrorEvent = {
            type: 'hub:error',
            message,
            code,
        };
        this.send(ws, errorEvent);
    }

    private broadcastToDashboards(
        message: WSMessage,
        filter?: (dashboard: DashboardConnection) => boolean
    ): void {
        for (const dashboard of state.dashboards) {
            if (!filter || filter(dashboard)) {
                this.send(dashboard.ws, message);
            }
        }
    }

    private checkConnections(): void {
        // Check agents
        for (const [name, { ws }] of state.agents) {
            if ((ws as any).isAlive === false) {
                console.log(`[ActivityHub] Agent ${name} failed heartbeat`);
                ws.terminate();
                state.agents.delete(name);
                addStatusEntry(name, 'offline', { reason: 'heartbeat_timeout' });
                this.broadcastToDashboards({
                    type: 'agent:status',
                    agent: name,
                    status: 'offline',
                    timestamp: new Date().toISOString(),
                    metadata: { reason: 'heartbeat_timeout' },
                });
            } else {
                (ws as any).isAlive = false;
                ws.ping();
            }
        }

        // Check dashboards
        for (const dashboard of state.dashboards) {
            if ((dashboard.ws as any).isAlive === false) {
                console.log('[ActivityHub] Dashboard failed heartbeat');
                dashboard.ws.terminate();
                state.dashboards.delete(dashboard);
            } else {
                (dashboard.ws as any).isAlive = false;
                dashboard.ws.ping();
            }
        }
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    /**
     * Get current hub statistics
     */
    getStats(): {
        connectedAgents: number;
        connectedDashboards: number;
        pendingPermissions: number;
        agentNames: string[];
    } {
        return {
            connectedAgents: state.agents.size,
            connectedDashboards: state.dashboards.size,
            pendingPermissions: state.pendingPermissions.size,
            agentNames: Array.from(state.agents.keys()),
        };
    }

    /**
     * Check if an agent is connected
     */
    isAgentConnected(name: string): boolean {
        return state.agents.has(name);
    }

    /**
     * Get connected agent info
     */
    getAgent(name: string): ConnectedAgent | null {
        return state.agents.get(name)?.meta ?? null;
    }

    /**
     * Get all connected agents
     */
    getAgents(): ConnectedAgent[] {
        return Array.from(state.agents.values()).map(({ meta }) => meta);
    }

    /**
     * Broadcast a message to a specific agent
     */
    sendToAgent(agentName: string, message: WSMessage): boolean {
        const agentConn = state.agents.get(agentName);
        if (!agentConn) return false;
        this.send(agentConn.ws, message);
        return true;
    }

    /**
     * Broadcast a message to all dashboards
     */
    broadcast(message: WSMessage): void {
        this.broadcastToDashboards(message);
    }
}

// ─── Singleton Export ───────────────────────────────────────────────────────

export const activityHub = new ActivityHub();
