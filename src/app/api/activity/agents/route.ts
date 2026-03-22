import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { ACTIVITY_FEED_PATH } from '@/lib/dataPaths';
import type { ActivityAgent, AgentStatus, ActivityFeedData } from '@/types';

export const dynamic = 'force-dynamic';

// Default Halo Crew agents
const DEFAULT_AGENTS: ActivityAgent[] = [
    { name: 'Chief', status: 'offline', lastSeen: new Date().toISOString(), actionsToday: 0 },
    { name: 'Arbiter', status: 'offline', lastSeen: new Date().toISOString(), actionsToday: 0 },
    { name: 'Cortana', status: 'offline', lastSeen: new Date().toISOString(), actionsToday: 0 },
    { name: 'Scout', status: 'offline', lastSeen: new Date().toISOString(), actionsToday: 0 },
    { name: 'Ops', status: 'offline', lastSeen: new Date().toISOString(), actionsToday: 0 },
    { name: 'Hunter', status: 'offline', lastSeen: new Date().toISOString(), actionsToday: 0 },
];

// Agent status timeout (5 minutes without activity = offline)
const AGENT_TIMEOUT_MS = 5 * 60 * 1000;
// Agent busy timeout (2 minutes without update = back to online/offline)
const AGENT_BUSY_TIMEOUT_MS = 2 * 60 * 1000;

// Validation schema for updating agent status
const UpdateAgentSchema = z.object({
    name: z.string().min(1).max(50),
    status: z.enum(['online', 'offline', 'busy', 'error']).optional(),
    currentTask: z.string().max(200).optional().nullable(),
});

/**
 * Read activity feed data from JSON file
 */
async function readActivityFeed(): Promise<ActivityFeedData> {
    try {
        const dir = path.dirname(ACTIVITY_FEED_PATH);
        await fs.mkdir(dir, { recursive: true });

        const data = await fs.readFile(ACTIVITY_FEED_PATH, 'utf8');
        return JSON.parse(data) as ActivityFeedData;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return {
                entries: [],
                permissions: [],
                agents: DEFAULT_AGENTS,
                lastUpdated: new Date().toISOString(),
            };
        }
        throw error;
    }
}

/**
 * Write activity feed data to JSON file
 */
async function writeActivityFeed(data: ActivityFeedData): Promise<void> {
    const dir = path.dirname(ACTIVITY_FEED_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(ACTIVITY_FEED_PATH, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Calculate derived agent status based on last activity
 */
function calculateAgentStatus(agent: ActivityAgent): AgentStatus {
    const now = Date.now();
    const lastSeen = new Date(agent.lastSeen).getTime();
    const timeSinceLastSeen = now - lastSeen;

    // If agent is marked as busy, check busy timeout
    if (agent.status === 'busy') {
        if (timeSinceLastSeen > AGENT_BUSY_TIMEOUT_MS) {
            return 'online'; // Fallback to online after busy timeout
        }
        return 'busy';
    }

    // If agent is marked as error, keep it
    if (agent.status === 'error') {
        return 'error';
    }

    // Check offline timeout
    if (timeSinceLastSeen > AGENT_TIMEOUT_MS) {
        return 'offline';
    }

    return 'online';
}

/**
 * Ensure all default agents exist in the list
 */
function ensureDefaultAgents(agents: ActivityAgent[]): ActivityAgent[] {
    const agentNames = new Set(agents.map(a => a.name.toLowerCase()));
    const result = [...agents];

    for (const defaultAgent of DEFAULT_AGENTS) {
        if (!agentNames.has(defaultAgent.name.toLowerCase())) {
            result.push({ ...defaultAgent });
        }
    }

    return result;
}

/**
 * GET /api/activity/agents
 *
 * Returns status of all agents with calculated online/offline status.
 *
 * Query parameters:
 *   - status: Filter by status ('online', 'offline', 'busy', 'error')
 *
 * Response: {
 *   agents: { name: string, status: 'online'|'offline'|'busy'|'error', lastSeen: string, currentTask?: string, actionsToday?: number }[]
 * }
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const statusFilter = searchParams.get('status') as AgentStatus | null;

        const feedData = await readActivityFeed();

        // Ensure all default agents exist
        let agents = ensureDefaultAgents(feedData.agents || []);

        // Calculate derived status for each agent
        agents = agents.map(agent => ({
            ...agent,
            status: calculateAgentStatus(agent),
        }));

        // Apply status filter
        if (statusFilter) {
            agents = agents.filter(a => a.status === statusFilter);
        }

        // Sort by name
        agents.sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({ agents });
    } catch (error: any) {
        console.error('[GET /api/activity/agents] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch agent status', message: error.message },
            { status: 500 }
        );
    }
}

/**
 * POST /api/activity/agents
 *
 * Updates an agent's status (called by agents to report their state).
 *
 * Request body: {
 *   name: string,
 *   status?: 'online' | 'offline' | 'busy' | 'error',
 *   currentTask?: string | null
 * }
 *
 * Response: { agent: ActivityAgent }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parseResult = UpdateAgentSchema.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parseResult.error.flatten() },
                { status: 400 }
            );
        }

        const { name, status, currentTask } = parseResult.data;
        const feedData = await readActivityFeed();

        // Ensure agents array exists
        feedData.agents = ensureDefaultAgents(feedData.agents || []);

        // Find or create agent
        let agentIndex = feedData.agents.findIndex(
            a => a.name.toLowerCase() === name.toLowerCase()
        );

        if (agentIndex === -1) {
            // Create new agent
            const newAgent: ActivityAgent = {
                name,
                status: status || 'online',
                lastSeen: new Date().toISOString(),
                currentTask: currentTask || undefined,
                actionsToday: 0,
            };
            feedData.agents.push(newAgent);
            agentIndex = feedData.agents.length - 1;
        } else {
            // Update existing agent
            const agent = feedData.agents[agentIndex];
            const now = new Date();

            // Check if it's a new day, reset action count
            const lastSeenDate = new Date(agent.lastSeen).toDateString();
            const today = now.toDateString();
            if (lastSeenDate !== today) {
                agent.actionsToday = 0;
            }

            agent.lastSeen = now.toISOString();

            if (status !== undefined) {
                agent.status = status;
            }

            if (currentTask !== undefined) {
                agent.currentTask = currentTask || undefined;
            }
        }

        feedData.lastUpdated = new Date().toISOString();
        await writeActivityFeed(feedData);

        const updatedAgent = feedData.agents[agentIndex];

        return NextResponse.json({ agent: updatedAgent });
    } catch (error: any) {
        console.error('[POST /api/activity/agents] Error:', error);
        return NextResponse.json(
            { error: 'Failed to update agent status', message: error.message },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/activity/agents
 *
 * Bulk update agent statuses (e.g., mark all as offline).
 *
 * Request body: {
 *   status: 'online' | 'offline' | 'busy' | 'error',
 *   agents?: string[]  // Optional: specific agent names, or all if omitted
 * }
 *
 * Response: { updated: number, agents: ActivityAgent[] }
 */
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();

        const status = body.status as AgentStatus;
        const agentNames = body.agents as string[] | undefined;

        if (!status || !['online', 'offline', 'busy', 'error'].includes(status)) {
            return NextResponse.json(
                { error: 'Invalid status. Must be: online, offline, busy, or error' },
                { status: 400 }
            );
        }

        const feedData = await readActivityFeed();
        feedData.agents = ensureDefaultAgents(feedData.agents || []);

        let updated = 0;
        const now = new Date().toISOString();

        for (const agent of feedData.agents) {
            // If specific agents are specified, only update those
            if (agentNames && agentNames.length > 0) {
                const shouldUpdate = agentNames.some(
                    n => n.toLowerCase() === agent.name.toLowerCase()
                );
                if (!shouldUpdate) continue;
            }

            agent.status = status;
            agent.lastSeen = now;

            // Clear current task if going offline
            if (status === 'offline') {
                agent.currentTask = undefined;
            }

            updated++;
        }

        feedData.lastUpdated = now;
        await writeActivityFeed(feedData);

        return NextResponse.json({
            updated,
            agents: feedData.agents,
        });
    } catch (error: any) {
        console.error('[PUT /api/activity/agents] Error:', error);
        return NextResponse.json(
            { error: 'Failed to bulk update agents', message: error.message },
            { status: 500 }
        );
    }
}
