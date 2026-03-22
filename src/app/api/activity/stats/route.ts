import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { ACTIVITY_FEED_PATH } from '@/lib/dataPaths';
import type { ActivityStats, ActivityFeedData, AgentStatus, ActivityAgent } from '@/types';

export const dynamic = 'force-dynamic';

// Agent status timeout (5 minutes without activity = offline)
const AGENT_TIMEOUT_MS = 5 * 60 * 1000;

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
                agents: [],
                lastUpdated: new Date().toISOString(),
            };
        }
        throw error;
    }
}

/**
 * Calculate derived agent status based on last activity
 */
function calculateAgentStatus(agent: ActivityAgent): AgentStatus {
    const now = Date.now();
    const lastSeen = new Date(agent.lastSeen).getTime();
    const timeSinceLastSeen = now - lastSeen;

    if (agent.status === 'busy' || agent.status === 'error') {
        return agent.status;
    }

    if (timeSinceLastSeen > AGENT_TIMEOUT_MS) {
        return 'offline';
    }

    return 'online';
}

/**
 * Check if a date is today
 */
function isToday(dateString: string): boolean {
    const date = new Date(dateString);
    const today = new Date();
    return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
    );
}

/**
 * GET /api/activity/stats
 *
 * Returns aggregated activity statistics for the dashboard.
 *
 * Response: {
 *   agentsOnline: number,
 *   pendingPermissions: number,
 *   actionsToday: number,
 *   totalActions: number,
 *   lastActivity: string,
 *   agentBreakdown: { name: string, status: string, actionsToday: number }[],
 *   permissionBreakdown: { pending: number, approved: number, rejected: number, expired: number },
 *   activityByType: { type: string, count: number }[]
 * }
 */
export async function GET() {
    try {
        const feedData = await readActivityFeed();

        // Calculate agents online
        const agents = feedData.agents || [];
        const agentStatuses = agents.map(agent => ({
            ...agent,
            status: calculateAgentStatus(agent),
        }));
        const agentsOnline = agentStatuses.filter(a => a.status === 'online' || a.status === 'busy').length;

        // Calculate pending permissions
        const permissions = feedData.permissions || [];
        const pendingPermissions = permissions.filter(p => {
            if (p.status !== 'pending') return false;
            // Check if expired
            if (p.expiresAt && new Date(p.expiresAt) < new Date()) return false;
            return true;
        }).length;

        // Permission breakdown
        const permissionBreakdown = {
            pending: pendingPermissions,
            approved: permissions.filter(p => p.status === 'approved').length,
            rejected: permissions.filter(p => p.status === 'rejected').length,
            expired: permissions.filter(p => {
                if (p.status === 'expired') return true;
                if (p.status === 'pending' && p.expiresAt && new Date(p.expiresAt) < new Date()) return true;
                return false;
            }).length,
        };

        // Calculate actions today
        const entries = feedData.entries || [];
        const actionsToday = entries.filter(e => isToday(e.timestamp)).length;
        const totalActions = entries.length;

        // Find last activity
        const sortedEntries = [...entries].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        const lastActivity = sortedEntries.length > 0
            ? sortedEntries[0].timestamp
            : feedData.lastUpdated;

        // Agent breakdown
        const agentBreakdown = agentStatuses.map(agent => ({
            name: agent.name,
            status: agent.status,
            actionsToday: agent.actionsToday || 0,
            currentTask: agent.currentTask,
        }));

        // Activity by type (today only)
        const todayEntries = entries.filter(e => isToday(e.timestamp));
        const typeCount: Record<string, number> = {};
        for (const entry of todayEntries) {
            typeCount[entry.type] = (typeCount[entry.type] || 0) + 1;
        }
        const activityByType = Object.entries(typeCount)
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count);

        // Activity by hour (last 24 hours)
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const recentEntries = entries.filter(e => new Date(e.timestamp).getTime() > oneDayAgo);
        const hourlyCount: Record<number, number> = {};
        for (let h = 0; h < 24; h++) {
            hourlyCount[h] = 0;
        }
        for (const entry of recentEntries) {
            const hour = new Date(entry.timestamp).getHours();
            hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
        }
        const activityByHour = Object.entries(hourlyCount)
            .map(([hour, count]) => ({ hour: parseInt(hour, 10), count }))
            .sort((a, b) => a.hour - b.hour);

        // Status breakdown (today only)
        const statusCount: Record<string, number> = {};
        for (const entry of todayEntries) {
            statusCount[entry.status] = (statusCount[entry.status] || 0) + 1;
        }
        const statusBreakdown = Object.entries(statusCount)
            .map(([status, count]) => ({ status, count }))
            .sort((a, b) => b.count - a.count);

        const stats: ActivityStats & {
            agentBreakdown: typeof agentBreakdown;
            permissionBreakdown: typeof permissionBreakdown;
            activityByType: typeof activityByType;
            activityByHour: typeof activityByHour;
            statusBreakdown: typeof statusBreakdown;
        } = {
            agentsOnline,
            pendingPermissions,
            actionsToday,
            totalActions,
            lastActivity,
            agentBreakdown,
            permissionBreakdown,
            activityByType,
            activityByHour,
            statusBreakdown,
        };

        return NextResponse.json(stats);
    } catch (error: any) {
        console.error('[GET /api/activity/stats] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch activity stats', message: error.message },
            { status: 500 }
        );
    }
}
