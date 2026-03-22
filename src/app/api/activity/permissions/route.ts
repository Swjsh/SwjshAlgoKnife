import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { ACTIVITY_FEED_PATH } from '@/lib/dataPaths';
import type { PermissionRequest, PermissionStatus, ActivityFeedData, ActivityEntry } from '@/types';

export const dynamic = 'force-dynamic';

// Permission request expiry time (15 minutes)
const PERMISSION_EXPIRY_MS = 15 * 60 * 1000;

// Validation schema for creating permission requests
const CreatePermissionSchema = z.object({
    agent: z.string().min(1).max(50),
    action: z.string().min(1).max(200),
    resource: z.string().min(1).max(500),
    reason: z.string().max(1000).optional(),
});

// Validation schema for responding to permission requests
const RespondPermissionSchema = z.object({
    id: z.string().min(1),
    approved: z.boolean(),
    respondedBy: z.string().max(100).optional(),
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
            // Return default structure if file doesn't exist
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
 * Write activity feed data to JSON file
 */
async function writeActivityFeed(data: ActivityFeedData): Promise<void> {
    const dir = path.dirname(ACTIVITY_FEED_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(ACTIVITY_FEED_PATH, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Generate a unique ID for permission requests
 */
function generateId(): string {
    return `perm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if a permission request has expired
 */
function isExpired(permission: PermissionRequest): boolean {
    if (permission.status !== 'pending') return false;
    if (!permission.expiresAt) return false;
    return new Date(permission.expiresAt) < new Date();
}

/**
 * Update expired permissions to 'expired' status
 */
function updateExpiredPermissions(permissions: PermissionRequest[]): PermissionRequest[] {
    return permissions.map(p => {
        if (isExpired(p)) {
            return { ...p, status: 'expired' as PermissionStatus };
        }
        return p;
    });
}

/**
 * GET /api/activity/permissions
 *
 * Returns permission requests with optional filtering.
 *
 * Query parameters:
 *   - status: Filter by status ('pending', 'approved', 'rejected', 'expired')
 *   - agent: Filter by agent name
 *   - limit: Number of entries (default: 50, max: 200)
 *
 * Response: {
 *   pending: PermissionRequest[],
 *   approved: string[],
 *   rejected: string[],
 *   expired: string[],
 *   total: number
 * }
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const statusFilter = searchParams.get('status') as PermissionStatus | null;
        const agentFilter = searchParams.get('agent');
        const limit = Math.min(
            Math.max(parseInt(searchParams.get('limit') || '50', 10), 1),
            200
        );

        const feedData = await readActivityFeed();

        // Update expired permissions
        feedData.permissions = updateExpiredPermissions(feedData.permissions || []);
        await writeActivityFeed(feedData);

        let permissions = [...feedData.permissions];

        // Apply filters
        if (agentFilter) {
            permissions = permissions.filter(
                p => p.agent.toLowerCase() === agentFilter.toLowerCase()
            );
        }
        if (statusFilter) {
            permissions = permissions.filter(p => p.status === statusFilter);
        }

        // Sort by timestamp descending
        permissions.sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        // Categorize by status
        const pending = permissions.filter(p => p.status === 'pending').slice(0, limit);
        const approved = permissions
            .filter(p => p.status === 'approved')
            .slice(0, limit)
            .map(p => p.id);
        const rejected = permissions
            .filter(p => p.status === 'rejected')
            .slice(0, limit)
            .map(p => p.id);
        const expired = permissions
            .filter(p => p.status === 'expired')
            .slice(0, limit)
            .map(p => p.id);

        return NextResponse.json({
            pending,
            approved,
            rejected,
            expired,
            total: feedData.permissions.length,
        });
    } catch (error: any) {
        console.error('[GET /api/activity/permissions] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch permissions', message: error.message },
            { status: 500 }
        );
    }
}

/**
 * POST /api/activity/permissions
 *
 * Creates a new permission request OR responds to an existing one.
 *
 * For creating a new request:
 * Request body: {
 *   agent: string,
 *   action: string,
 *   resource: string,
 *   reason?: string
 * }
 *
 * For responding to a request:
 * Request body: {
 *   id: string,
 *   approved: boolean,
 *   respondedBy?: string
 * }
 *
 * Response: { permission: PermissionRequest } or { success: true, permission: PermissionRequest }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Check if this is a response to an existing permission
        if ('id' in body && 'approved' in body) {
            const parseResult = RespondPermissionSchema.safeParse(body);

            if (!parseResult.success) {
                return NextResponse.json(
                    { error: 'Validation failed', details: parseResult.error.flatten() },
                    { status: 400 }
                );
            }

            const { id, approved, respondedBy } = parseResult.data;
            const feedData = await readActivityFeed();

            // Find the permission request
            const permIndex = feedData.permissions.findIndex(p => p.id === id);
            if (permIndex === -1) {
                return NextResponse.json(
                    { error: 'Permission request not found' },
                    { status: 404 }
                );
            }

            const permission = feedData.permissions[permIndex];

            // Check if already responded or expired
            if (permission.status !== 'pending') {
                return NextResponse.json(
                    { error: `Permission already ${permission.status}` },
                    { status: 400 }
                );
            }

            if (isExpired(permission)) {
                feedData.permissions[permIndex] = {
                    ...permission,
                    status: 'expired',
                };
                await writeActivityFeed(feedData);
                return NextResponse.json(
                    { error: 'Permission request has expired' },
                    { status: 400 }
                );
            }

            // Update permission status
            const newStatus: PermissionStatus = approved ? 'approved' : 'rejected';
            const updatedPermission: PermissionRequest = {
                ...permission,
                status: newStatus,
                respondedAt: new Date().toISOString(),
                respondedBy: respondedBy || 'user',
            };
            feedData.permissions[permIndex] = updatedPermission;

            // Add activity entry for the response
            const activityEntry: ActivityEntry = {
                id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                timestamp: new Date().toISOString(),
                type: 'permission_response',
                agent: permission.agent,
                action: `Permission ${newStatus}: ${permission.action}`,
                details: `Resource: ${permission.resource}`,
                status: 'completed',
                metadata: {
                    permissionId: id,
                    approved,
                    respondedBy: respondedBy || 'user',
                },
            };
            feedData.entries.unshift(activityEntry);

            feedData.lastUpdated = new Date().toISOString();
            await writeActivityFeed(feedData);

            return NextResponse.json({
                success: true,
                permission: updatedPermission,
            });
        }

        // Creating a new permission request
        const parseResult = CreatePermissionSchema.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parseResult.error.flatten() },
                { status: 400 }
            );
        }

        const data = parseResult.data;
        const feedData = await readActivityFeed();

        // Create new permission request
        const newPermission: PermissionRequest = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            agent: data.agent,
            action: data.action,
            resource: data.resource,
            reason: data.reason,
            status: 'pending',
            expiresAt: new Date(Date.now() + PERMISSION_EXPIRY_MS).toISOString(),
        };

        feedData.permissions.unshift(newPermission);

        // Also add as an activity entry
        const activityEntry: ActivityEntry = {
            id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            timestamp: new Date().toISOString(),
            type: 'permission_request',
            agent: data.agent,
            action: `Permission requested: ${data.action}`,
            details: `Resource: ${data.resource}${data.reason ? ` | Reason: ${data.reason}` : ''}`,
            status: 'pending',
            metadata: {
                permissionId: newPermission.id,
                resource: data.resource,
            },
        };
        feedData.entries.unshift(activityEntry);

        feedData.lastUpdated = new Date().toISOString();
        await writeActivityFeed(feedData);

        return NextResponse.json(
            { permission: newPermission },
            { status: 201 }
        );
    } catch (error: any) {
        console.error('[POST /api/activity/permissions] Error:', error);
        return NextResponse.json(
            { error: 'Failed to process permission request', message: error.message },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/activity/permissions
 *
 * Clears resolved (non-pending) permission requests.
 *
 * Query parameters:
 *   - confirm: Must be "true" to proceed
 *   - status: Optional status to clear ('approved', 'rejected', 'expired', or 'all')
 *
 * Response: { cleared: number, remaining: number }
 */
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const confirm = searchParams.get('confirm');
        const statusToClear = searchParams.get('status') || 'all';

        if (confirm !== 'true') {
            return NextResponse.json(
                { error: 'Confirmation required. Set confirm=true to proceed.' },
                { status: 400 }
            );
        }

        const feedData = await readActivityFeed();
        const originalCount = feedData.permissions.length;

        if (statusToClear === 'all') {
            // Keep only pending permissions
            feedData.permissions = feedData.permissions.filter(p => p.status === 'pending');
        } else {
            // Clear specific status
            feedData.permissions = feedData.permissions.filter(p => p.status !== statusToClear);
        }

        feedData.lastUpdated = new Date().toISOString();
        await writeActivityFeed(feedData);

        return NextResponse.json({
            cleared: originalCount - feedData.permissions.length,
            remaining: feedData.permissions.length,
        });
    } catch (error: any) {
        console.error('[DELETE /api/activity/permissions] Error:', error);
        return NextResponse.json(
            { error: 'Failed to clear permissions', message: error.message },
            { status: 500 }
        );
    }
}
