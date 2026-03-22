import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { ACTIVITY_FEED_PATH } from '@/lib/dataPaths';
import type { ActivityEntry, ActivityFeedData, ActivityType, ActivityStatus } from '@/types';

export const dynamic = 'force-dynamic';

// Maximum entries to store in the feed
const MAX_ENTRIES = 500;
// Maximum entries to return per request
const DEFAULT_LIMIT = 200;

// Validation schema for new activity entries
const CreateActivitySchema = z.object({
    type: z.enum(['tool_call', 'file_edit', 'command', 'permission_request', 'permission_response', 'agent_message', 'error', 'info']),
    agent: z.string().min(1).max(50),
    action: z.string().min(1).max(200),
    details: z.string().max(2000).optional(),
    status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'cancelled']).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Initialize default activity feed data structure
 */
function getDefaultFeedData(): ActivityFeedData {
    return {
        entries: [],
        permissions: [],
        agents: [
            { name: 'Chief', status: 'offline', lastSeen: new Date().toISOString(), actionsToday: 0 },
            { name: 'Arbiter', status: 'offline', lastSeen: new Date().toISOString(), actionsToday: 0 },
            { name: 'Cortana', status: 'offline', lastSeen: new Date().toISOString(), actionsToday: 0 },
            { name: 'Scout', status: 'offline', lastSeen: new Date().toISOString(), actionsToday: 0 },
            { name: 'Ops', status: 'offline', lastSeen: new Date().toISOString(), actionsToday: 0 },
            { name: 'Hunter', status: 'offline', lastSeen: new Date().toISOString(), actionsToday: 0 },
        ],
        lastUpdated: new Date().toISOString(),
    };
}

/**
 * Read activity feed data from JSON file
 */
async function readActivityFeed(): Promise<ActivityFeedData> {
    try {
        // Ensure directory exists
        const dir = path.dirname(ACTIVITY_FEED_PATH);
        await fs.mkdir(dir, { recursive: true });

        const data = await fs.readFile(ACTIVITY_FEED_PATH, 'utf8');
        return JSON.parse(data) as ActivityFeedData;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, create with defaults
            const defaultData = getDefaultFeedData();
            await writeActivityFeed(defaultData);
            return defaultData;
        }
        console.error('[Activity API] Error reading feed:', error);
        throw error;
    }
}

/**
 * Write activity feed data to JSON file
 */
async function writeActivityFeed(data: ActivityFeedData): Promise<void> {
    try {
        const dir = path.dirname(ACTIVITY_FEED_PATH);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(ACTIVITY_FEED_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('[Activity API] Error writing feed:', error);
        throw error;
    }
}

/**
 * Generate a unique ID for activity entries
 */
function generateId(): string {
    return `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * GET /api/activity
 *
 * Returns activity history entries with optional filtering and pagination.
 *
 * Query parameters:
 *   - limit: Number of entries to return (default: 200, max: 500)
 *   - offset: Number of entries to skip (default: 0)
 *   - type: Filter by activity type
 *   - agent: Filter by agent name
 *   - status: Filter by status
 *   - since: Return entries after this ISO timestamp
 *
 * Response: { entries: ActivityEntry[], total: number, hasMore: boolean }
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        // Parse query parameters
        const limit = Math.min(
            Math.max(parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10), 1),
            MAX_ENTRIES
        );
        const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);
        const typeFilter = searchParams.get('type') as ActivityType | null;
        const agentFilter = searchParams.get('agent');
        const statusFilter = searchParams.get('status') as ActivityStatus | null;
        const sinceFilter = searchParams.get('since');

        const feedData = await readActivityFeed();
        let entries = [...feedData.entries];

        // Apply filters
        if (typeFilter) {
            entries = entries.filter(e => e.type === typeFilter);
        }
        if (agentFilter) {
            entries = entries.filter(e => e.agent.toLowerCase() === agentFilter.toLowerCase());
        }
        if (statusFilter) {
            entries = entries.filter(e => e.status === statusFilter);
        }
        if (sinceFilter) {
            const sinceDate = new Date(sinceFilter);
            if (!isNaN(sinceDate.getTime())) {
                entries = entries.filter(e => new Date(e.timestamp) > sinceDate);
            }
        }

        // Sort by timestamp descending (most recent first)
        entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const total = entries.length;
        const paginatedEntries = entries.slice(offset, offset + limit);

        return NextResponse.json({
            entries: paginatedEntries,
            total,
            hasMore: offset + limit < total,
            offset,
            limit,
        });
    } catch (error: any) {
        console.error('[GET /api/activity] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch activity entries', message: error.message },
            { status: 500 }
        );
    }
}

/**
 * POST /api/activity
 *
 * Adds a new activity entry (for non-WebSocket clients or server-side events).
 *
 * Request body: {
 *   type: ActivityType,
 *   agent: string,
 *   action: string,
 *   details?: string,
 *   status?: ActivityStatus,
 *   metadata?: Record<string, unknown>
 * }
 *
 * Response: { entry: ActivityEntry, total: number }
 */
export async function POST(req: NextRequest) {
    try {
        // Rate limit check: limit payload to 10KB
        const contentLength = req.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > 10 * 1024) {
            return NextResponse.json(
                { error: 'Request payload too large (max 10KB)' },
                { status: 413 }
            );
        }

        const body = await req.json();
        const parseResult = CreateActivitySchema.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parseResult.error.flatten() },
                { status: 400 }
            );
        }

        const data = parseResult.data;
        const feedData = await readActivityFeed();

        // Create new entry
        const newEntry: ActivityEntry = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            type: data.type,
            agent: data.agent,
            action: data.action,
            details: data.details,
            status: data.status || 'completed',
            metadata: data.metadata,
        };

        // Add to beginning of array (most recent first)
        feedData.entries.unshift(newEntry);

        // Trim to max entries
        if (feedData.entries.length > MAX_ENTRIES) {
            feedData.entries = feedData.entries.slice(0, MAX_ENTRIES);
        }

        // Update agent's last seen and action count
        const agentIndex = feedData.agents.findIndex(
            a => a.name.toLowerCase() === data.agent.toLowerCase()
        );
        if (agentIndex >= 0) {
            const agent = feedData.agents[agentIndex];
            agent.lastSeen = newEntry.timestamp;
            agent.status = 'online';

            // Reset action count if it's a new day
            const lastSeenDate = new Date(agent.lastSeen).toDateString();
            const today = new Date().toDateString();
            if (lastSeenDate !== today) {
                agent.actionsToday = 1;
            } else {
                agent.actionsToday = (agent.actionsToday || 0) + 1;
            }
        }

        feedData.lastUpdated = newEntry.timestamp;

        await writeActivityFeed(feedData);

        return NextResponse.json(
            { entry: newEntry, total: feedData.entries.length },
            { status: 201 }
        );
    } catch (error: any) {
        console.error('[POST /api/activity] Error:', error);
        return NextResponse.json(
            { error: 'Failed to create activity entry', message: error.message },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/activity
 *
 * Clears activity entries. Requires confirmation via query param.
 *
 * Query parameters:
 *   - confirm: Must be "true" to proceed
 *   - older_than: Optional ISO timestamp to clear only older entries
 *
 * Response: { cleared: number, remaining: number }
 */
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const confirm = searchParams.get('confirm');
        const olderThan = searchParams.get('older_than');

        if (confirm !== 'true') {
            return NextResponse.json(
                { error: 'Confirmation required. Set confirm=true to proceed.' },
                { status: 400 }
            );
        }

        const feedData = await readActivityFeed();
        const originalCount = feedData.entries.length;

        if (olderThan) {
            const cutoffDate = new Date(olderThan);
            if (!isNaN(cutoffDate.getTime())) {
                feedData.entries = feedData.entries.filter(
                    e => new Date(e.timestamp) > cutoffDate
                );
            }
        } else {
            feedData.entries = [];
        }

        feedData.lastUpdated = new Date().toISOString();
        await writeActivityFeed(feedData);

        return NextResponse.json({
            cleared: originalCount - feedData.entries.length,
            remaining: feedData.entries.length,
        });
    } catch (error: any) {
        console.error('[DELETE /api/activity] Error:', error);
        return NextResponse.json(
            { error: 'Failed to clear activity entries', message: error.message },
            { status: 500 }
        );
    }
}
