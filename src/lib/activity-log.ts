/**
 * Activity Log Persistence
 *
 * Manages persistent storage of activity feed entries.
 * - Writes to data/activity-hub.json
 * - Keeps last 1000 entries in memory for fast access
 * - Rotates file when > 10MB
 * - Thread-safe write operations with debounced queue
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { ActivityEntry, PermissionRequest } from './ws/types';
import { ACTIVITY_FEED_PATH } from './dataPaths';

// ─── Configuration ──────────────────────────────────────────────────────────

// Use the centralized path so WebSocket hub and REST API share the same file
const ACTIVITY_FILE = ACTIVITY_FEED_PATH;
const ARCHIVE_DIR = path.join(path.dirname(ACTIVITY_FILE), 'activity-archive');

const MAX_MEMORY_ENTRIES = 1000;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const WRITE_DEBOUNCE_MS = 100;

// ─── Agent Tracking ──────────────────────────────────────────────────────────

/** Agent state for activity feed (matches API expectations) */
interface TrackedAgent {
    name: string;
    status: 'online' | 'offline' | 'busy' | 'error';
    lastSeen: string;
    currentTask?: string;
    actionsToday: number;
}

/** Default Halo Crew agents (6 terminal agents + Oracle knowledge system) */
const DEFAULT_AGENTS: TrackedAgent[] = [
    { name: 'Chief', status: 'offline', lastSeen: new Date().toISOString(), actionsToday: 0 },
    { name: 'Arbiter', status: 'offline', lastSeen: new Date().toISOString(), actionsToday: 0 },
    { name: 'Cortana', status: 'offline', lastSeen: new Date().toISOString(), actionsToday: 0 },
    { name: 'Scout', status: 'offline', lastSeen: new Date().toISOString(), actionsToday: 0 },
    { name: 'Ops', status: 'offline', lastSeen: new Date().toISOString(), actionsToday: 0 },
    { name: 'Hunter', status: 'offline', lastSeen: new Date().toISOString(), actionsToday: 0 },
    { name: 'Oracle', status: 'offline', lastSeen: new Date().toISOString(), actionsToday: 0 },
];

// ─── State ──────────────────────────────────────────────────────────────────

interface ActivityLogState {
    entries: ActivityEntry[];
    pendingPermissions: Map<string, PermissionRequest>;
    agents: Map<string, TrackedAgent>;
    isDirty: boolean;
    writeTimeout: NodeJS.Timeout | null;
}

const state: ActivityLogState = {
    entries: [],
    pendingPermissions: new Map(),
    agents: new Map(),
    isDirty: false,
    writeTimeout: null,
};

// ─── Initialization ─────────────────────────────────────────────────────────

/**
 * Initialize the activity log by loading existing data
 */
export function initActivityLog(): void {
    ensureDirectoriesExist();
    loadFromDisk();
}

function ensureDirectoriesExist(): void {
    const dataDir = path.dirname(ACTIVITY_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(ARCHIVE_DIR)) {
        fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    }
}

function loadFromDisk(): void {
    try {
        // Initialize default agents first
        state.agents.clear();
        for (const agent of DEFAULT_AGENTS) {
            state.agents.set(agent.name.toLowerCase(), { ...agent });
        }

        if (fs.existsSync(ACTIVITY_FILE)) {
            const raw = fs.readFileSync(ACTIVITY_FILE, 'utf-8');
            const data = JSON.parse(raw);

            // Load entries
            if (Array.isArray(data.entries)) {
                state.entries = data.entries.slice(-MAX_MEMORY_ENTRIES);
            }

            // Load pending permissions (support both field names)
            const permissions = data.pendingPermissions || data.permissions || [];
            if (Array.isArray(permissions)) {
                state.pendingPermissions.clear();
                for (const perm of permissions) {
                    state.pendingPermissions.set(perm.id, perm);
                }
            }

            // Load agents (merge with defaults)
            if (Array.isArray(data.agents)) {
                for (const agent of data.agents) {
                    const key = agent.name.toLowerCase();
                    state.agents.set(key, {
                        name: agent.name,
                        status: agent.status || 'offline',
                        lastSeen: agent.lastSeen || new Date().toISOString(),
                        currentTask: agent.currentTask,
                        actionsToday: agent.actionsToday || 0,
                    });
                }
            }

            console.log(`[ActivityLog] Loaded ${state.entries.length} entries, ${state.pendingPermissions.size} pending permissions, ${state.agents.size} agents`);
        } else {
            console.log(`[ActivityLog] No existing file, initialized with ${state.agents.size} default agents`);
        }
    } catch (error) {
        console.warn('[ActivityLog] Failed to load existing data:', error);
        state.entries = [];
        state.pendingPermissions.clear();
        // Keep default agents on error
    }
}

// ─── Write Operations ───────────────────────────────────────────────────────

function scheduleWrite(): void {
    state.isDirty = true;

    if (state.writeTimeout) {
        return; // Already scheduled
    }

    state.writeTimeout = setTimeout(() => {
        flushToDisk();
        state.writeTimeout = null;
    }, WRITE_DEBOUNCE_MS);
}

function flushToDisk(): void {
    if (!state.isDirty) return;

    try {
        checkAndRotate();

        // Format agents array for API compatibility
        const agents = Array.from(state.agents.values()).map(agent => ({
            name: agent.name,
            status: agent.status,
            lastSeen: agent.lastSeen,
            currentTask: agent.currentTask,
            actionsToday: agent.actionsToday,
        }));

        const data = {
            entries: state.entries,
            pendingPermissions: Array.from(state.pendingPermissions.values()),
            agents,
            lastUpdated: new Date().toISOString(),
        };

        fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(data, null, 2), 'utf-8');
        state.isDirty = false;
    } catch (error) {
        console.error('[ActivityLog] Failed to write to disk:', error);
    }
}

function checkAndRotate(): void {
    try {
        if (!fs.existsSync(ACTIVITY_FILE)) return;

        const stats = fs.statSync(ACTIVITY_FILE);
        if (stats.size > MAX_FILE_SIZE_BYTES) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const archivePath = path.join(ARCHIVE_DIR, `activity-feed-${timestamp}.json`);
            fs.renameSync(ACTIVITY_FILE, archivePath);
            console.log(`[ActivityLog] Rotated to ${archivePath}`);

            // Keep only recent entries in memory after rotation
            state.entries = state.entries.slice(-100);
        }
    } catch (error) {
        console.warn('[ActivityLog] Rotation check failed:', error);
    }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Add a new activity entry
 */
export function addEntry(entry: Omit<ActivityEntry, 'id'>): ActivityEntry {
    const fullEntry: ActivityEntry = {
        id: randomUUID(),
        ...entry,
    };

    state.entries.push(fullEntry);

    // Trim in-memory entries
    if (state.entries.length > MAX_MEMORY_ENTRIES) {
        state.entries = state.entries.slice(-MAX_MEMORY_ENTRIES);
    }

    scheduleWrite();
    return fullEntry;
}

/**
 * Add a log entry and update agent's last seen time
 */
export function addLogEntry(
    agent: string,
    line: string,
    level: 'info' | 'warn' | 'error' | 'debug' = 'info'
): ActivityEntry {
    const now = new Date().toISOString();

    // Update agent tracking
    const key = agent.toLowerCase();
    const existing = state.agents.get(key);
    if (existing) {
        existing.lastSeen = now;
        // If agent was offline and is now logging, mark as online
        if (existing.status === 'offline') {
            existing.status = 'online';
        }
        // Increment action count
        const today = new Date().toDateString();
        const lastSeenDate = new Date(existing.lastSeen).toDateString();
        if (lastSeenDate !== today) {
            existing.actionsToday = 1;
        } else {
            existing.actionsToday = (existing.actionsToday || 0) + 1;
        }
        state.isDirty = true;
    } else if (agent && agent !== 'unknown' && agent !== 'system') {
        // Auto-register unknown agents
        const displayName = agent.charAt(0).toUpperCase() + agent.slice(1).toLowerCase();
        state.agents.set(key, {
            name: displayName,
            status: 'online',
            lastSeen: now,
            actionsToday: 1,
        });
        state.isDirty = true;
    }

    return addEntry({
        timestamp: now,
        type: 'log',
        agent,
        data: { line, level },
    });
}

/**
 * Add a permission request
 */
export function addPermissionEntry(request: PermissionRequest): ActivityEntry {
    state.pendingPermissions.set(request.id, request);

    const entry = addEntry({
        timestamp: new Date().toISOString(),
        type: 'permission',
        agent: request.agent,
        data: {
            id: request.id,
            tool: request.tool,
            params: request.params,
            prompt: request.prompt,
        },
    });

    return entry;
}

/**
 * Resolve a pending permission request
 */
export function resolvePermission(
    id: string,
    approved: boolean,
    respondedBy?: string
): PermissionRequest | null {
    const request = state.pendingPermissions.get(id);
    if (!request) return null;

    request.resolvedAt = new Date().toISOString();
    request.approved = approved;
    request.respondedBy = respondedBy;

    state.pendingPermissions.delete(id);

    addEntry({
        timestamp: new Date().toISOString(),
        type: 'approval',
        agent: request.agent,
        data: {
            id,
            approved,
            respondedBy,
            tool: request.tool,
        },
    });

    scheduleWrite();
    return request;
}

/**
 * Add an agent status change entry and update agent tracking
 */
export function addStatusEntry(
    agent: string,
    status: 'online' | 'offline' | 'busy',
    metadata?: Record<string, unknown>
): ActivityEntry {
    const now = new Date().toISOString();
    const key = agent.toLowerCase();

    // Update or create agent in tracking map
    const existing = state.agents.get(key);
    if (existing) {
        existing.status = status;
        existing.lastSeen = now;
        if (metadata?.currentTask !== undefined) {
            existing.currentTask = metadata.currentTask as string | undefined;
        }
        // Increment action count for active statuses
        if (status === 'online' || status === 'busy') {
            const today = new Date().toDateString();
            const lastSeenDate = new Date(existing.lastSeen).toDateString();
            if (lastSeenDate !== today) {
                existing.actionsToday = 1; // Reset for new day
            } else {
                existing.actionsToday = (existing.actionsToday || 0) + 1;
            }
        }
    } else {
        // Create new agent entry (capitalize first letter)
        const displayName = agent.charAt(0).toUpperCase() + agent.slice(1).toLowerCase();
        state.agents.set(key, {
            name: displayName,
            status,
            lastSeen: now,
            currentTask: metadata?.currentTask as string | undefined,
            actionsToday: (status === 'online' || status === 'busy') ? 1 : 0,
        });
    }

    return addEntry({
        timestamp: now,
        type: 'status',
        agent,
        data: { status, ...metadata },
    });
}

/**
 * Get recent activity entries
 */
export function getRecent(count: number = 100): ActivityEntry[] {
    return state.entries.slice(-count);
}

/**
 * Get all pending permission requests
 */
export function getPending(): PermissionRequest[] {
    return Array.from(state.pendingPermissions.values());
}

/**
 * Get a specific pending permission by ID
 */
export function getPendingById(id: string): PermissionRequest | null {
    return state.pendingPermissions.get(id) ?? null;
}

/**
 * Get activity for a specific agent
 */
export function getByAgent(agent: string, count: number = 100): ActivityEntry[] {
    return state.entries
        .filter(e => e.agent === agent)
        .slice(-count);
}

/**
 * Get activity by type
 */
export function getByType(
    type: 'log' | 'permission' | 'status' | 'approval',
    count: number = 100
): ActivityEntry[] {
    return state.entries
        .filter(e => e.type === type)
        .slice(-count);
}

/**
 * Clear all entries (for testing/reset)
 */
export function clearAll(): void {
    state.entries = [];
    state.pendingPermissions.clear();
    state.isDirty = true;
    flushToDisk();
}

/**
 * Force immediate write to disk
 */
export function flush(): void {
    if (state.writeTimeout) {
        clearTimeout(state.writeTimeout);
        state.writeTimeout = null;
    }
    flushToDisk();
}

/**
 * Get current stats
 */
export function getStats(): {
    totalEntries: number;
    pendingPermissions: number;
    oldestEntry: string | null;
    newestEntry: string | null;
} {
    return {
        totalEntries: state.entries.length,
        pendingPermissions: state.pendingPermissions.size,
        oldestEntry: state.entries[0]?.timestamp ?? null,
        newestEntry: state.entries[state.entries.length - 1]?.timestamp ?? null,
    };
}

// ─── Auto-initialize ────────────────────────────────────────────────────────

// Initialize on module load (safe for serverless - just loads data)
try {
    initActivityLog();
} catch (error) {
    console.warn('[ActivityLog] Auto-init failed:', error);
}
