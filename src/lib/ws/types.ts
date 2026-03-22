/**
 * WebSocket Activity Feed Types
 *
 * Shared TypeScript types for the WebSocket hub that bridges
 * agent proxies and the dashboard for real-time activity streaming.
 */

// ─── Base Types ─────────────────────────────────────────────────────────────

/** Unique identifier for permission requests */
export type PermissionId = string;

/** Agent connection status */
export type AgentStatus = 'online' | 'offline' | 'busy';

/** Message direction for routing */
export type MessageSource = 'agent' | 'dashboard';

// ─── Agent Events (sent from agent proxies to hub) ──────────────────────────

/** Log line emitted by an agent */
export interface AgentLogEvent {
    type: 'agent:log';
    agent: string;
    line: string;
    timestamp: string;
    level?: 'info' | 'warn' | 'error' | 'debug';
}

/** Permission request from an agent */
export interface AgentPermissionEvent {
    type: 'agent:permission';
    id: PermissionId;
    agent: string;
    tool: string;
    params: Record<string, unknown>;
    prompt: string;
    timestamp: string;
    sessionId?: string;
}

/** Agent status change */
export interface AgentStatusEvent {
    type: 'agent:status';
    agent: string;
    status: AgentStatus;
    timestamp: string;
    metadata?: Record<string, unknown>;
}

/** Agent identification on connection */
export interface AgentIdentifyEvent {
    type: 'agent:identify';
    agent: string;
    version?: string;
    capabilities?: string[];
}

// ─── Dashboard Events (sent from dashboard to hub) ──────────────────────────

/** Dashboard subscription request */
export interface DashboardSubscribeEvent {
    type: 'dashboard:subscribe';
    filters?: {
        agents?: string[];
        levels?: ('info' | 'warn' | 'error' | 'debug')[];
    };
}

/** Dashboard approval/denial response */
export interface DashboardApproveEvent {
    type: 'dashboard:approve';
    id: PermissionId;
    approved: boolean;
    respondedBy?: string;
    timestamp: string;
}

/** Dashboard requesting current state */
export interface DashboardSyncEvent {
    type: 'dashboard:sync';
}

/** Dashboard broadcast message to agents */
export interface DashboardBroadcastEvent {
    type: 'dashboard:broadcast';
    message: string;
    timestamp: string;
}

/** Dashboard command to specific agent */
export interface DashboardCommandEvent {
    type: 'dashboard:command';
    agent?: string;
    command: string;
    timestamp: string;
}

// ─── Hub Events (sent from hub to clients) ──────────────────────────────────

/** Hub broadcasts current state to newly connected dashboards */
export interface HubStateEvent {
    type: 'hub:state';
    agents: Array<{
        name: string;
        status: AgentStatus;
        connectedAt: string;
    }>;
    pendingPermissions: PermissionRequest[];
    recentActivity: ActivityEntry[];
}

/** Hub confirmation that permission was resolved */
export interface HubPermissionResolvedEvent {
    type: 'hub:permission_resolved';
    id: PermissionId;
    approved: boolean;
    respondedBy?: string;
    timestamp: string;
}

/** Hub error notification */
export interface HubErrorEvent {
    type: 'hub:error';
    message: string;
    code?: string;
}

/** Hub command sent to agent */
export interface HubCommandEvent {
    type: 'hub:command';
    command: string;
    from: string;
    timestamp: string;
}

// ─── Session Watcher Events (from session-watcher.ts) ───────────────────────

/** Session watcher registration */
export interface SessionWatcherRegisterEvent {
    type: 'register';
    clientType: 'session_watcher';
}

/** Session watcher agent output */
export interface SessionWatcherAgentOutputEvent {
    type: 'agent_output';
    agentId: string;
    sessionId?: string;
    timestamp: string;
    content: unknown;
}

/** Session watcher user message */
export interface SessionWatcherUserMessageEvent {
    type: 'user_message';
    agentId: string;
    sessionId?: string;
    timestamp: string;
    content: { text?: string };
}

/** Session watcher assistant message */
export interface SessionWatcherAssistantMessageEvent {
    type: 'assistant_message';
    agentId: string;
    sessionId?: string;
    timestamp: string;
    content: { text?: string };
}

/** Session watcher tool call */
export interface SessionWatcherToolCallEvent {
    type: 'tool_call';
    agentId: string;
    sessionId?: string;
    timestamp: string;
    content: { toolName?: string; toolId?: string; input?: string };
}

/** Session watcher tool result */
export interface SessionWatcherToolResultEvent {
    type: 'tool_result';
    agentId: string;
    sessionId?: string;
    timestamp: string;
    content: { toolId?: string; success?: boolean };
}

/** Session watcher permission request */
export interface SessionWatcherPermissionRequestEvent {
    type: 'permission_request';
    agentId: string;
    sessionId?: string;
    timestamp: string;
    content: { toolName?: string; toolId?: string; input?: string };
}

/** All possible session watcher events */
export type SessionWatcherEvent =
    | SessionWatcherRegisterEvent
    | SessionWatcherAgentOutputEvent
    | SessionWatcherUserMessageEvent
    | SessionWatcherAssistantMessageEvent
    | SessionWatcherToolCallEvent
    | SessionWatcherToolResultEvent
    | SessionWatcherPermissionRequestEvent;

// ─── Union Types ────────────────────────────────────────────────────────────

/** All possible events from agents */
export type AgentEvent =
    | AgentLogEvent
    | AgentPermissionEvent
    | AgentStatusEvent
    | AgentIdentifyEvent;

/** All possible events from dashboards */
export type DashboardEvent =
    | DashboardSubscribeEvent
    | DashboardApproveEvent
    | DashboardSyncEvent
    | DashboardBroadcastEvent
    | DashboardCommandEvent;

/** All possible events from hub */
export type HubEvent =
    | HubStateEvent
    | HubPermissionResolvedEvent
    | HubErrorEvent
    | HubCommandEvent;

/** Any WebSocket message in the system */
export type WSMessage = AgentEvent | DashboardEvent | HubEvent | SessionWatcherEvent;

// ─── Persistence Types ──────────────────────────────────────────────────────

/** Activity entry stored in the activity log */
export interface ActivityEntry {
    id: string;
    timestamp: string;
    type: 'log' | 'permission' | 'status' | 'approval';
    agent: string;
    data: Record<string, unknown>;
}

/** Permission request with resolution tracking */
export interface PermissionRequest {
    id: PermissionId;
    agent: string;
    tool: string;
    params: Record<string, unknown>;
    prompt: string;
    createdAt: string;
    resolvedAt?: string;
    approved?: boolean;
    respondedBy?: string;
}

// ─── Connection Types ───────────────────────────────────────────────────────

/** Connected agent metadata */
export interface ConnectedAgent {
    name: string;
    status: AgentStatus;
    connectedAt: string;
    lastActivityAt: string;
    version?: string;
    capabilities?: string[];
}

/** Dashboard subscription filters */
export interface DashboardFilters {
    agents?: string[];
    levels?: ('info' | 'warn' | 'error' | 'debug')[];
}

// ─── Type Guards ────────────────────────────────────────────────────────────

export function isAgentEvent(msg: WSMessage): msg is AgentEvent {
    return msg.type.startsWith('agent:');
}

export function isDashboardEvent(msg: WSMessage): msg is DashboardEvent {
    return msg.type.startsWith('dashboard:');
}

export function isHubEvent(msg: WSMessage): msg is HubEvent {
    return msg.type.startsWith('hub:');
}

export function isAgentLogEvent(msg: WSMessage): msg is AgentLogEvent {
    return msg.type === 'agent:log';
}

export function isAgentPermissionEvent(msg: WSMessage): msg is AgentPermissionEvent {
    return msg.type === 'agent:permission';
}

export function isAgentStatusEvent(msg: WSMessage): msg is AgentStatusEvent {
    return msg.type === 'agent:status';
}

export function isDashboardApproveEvent(msg: WSMessage): msg is DashboardApproveEvent {
    return msg.type === 'dashboard:approve';
}

export function isSessionWatcherEvent(msg: WSMessage): msg is SessionWatcherEvent {
    return ['register', 'agent_output', 'user_message', 'assistant_message', 'tool_call', 'tool_result', 'permission_request'].includes(msg.type);
}
