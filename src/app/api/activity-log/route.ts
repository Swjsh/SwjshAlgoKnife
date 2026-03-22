import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────────────────────────

const ActivityStatus = z.enum(['pending', 'in_progress', 'completed', 'blocked', 'cancelled']);

const CreateActivityLogSchema = z.object({
    agent: z.string().min(1).max(50),
    project: z.string().max(50).optional(),
    issue: z.string().max(50).optional(),
    status: ActivityStatus,
    notes: z.string().max(2000).optional(),
    pr_url: z.string().url().optional(),
    duration_minutes: z.number().int().min(0).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

const UpdateActivityLogSchema = z.object({
    status: ActivityStatus.optional(),
    notes: z.string().max(2000).optional(),
    pr_url: z.string().url().optional(),
    duration_minutes: z.number().int().min(0).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ActivityLogEntry {
    id: number;
    timestamp: string;
    agent: string;
    project: string | null;
    issue: string | null;
    status: string;
    notes: string | null;
    pr_url: string | null;
    duration_minutes: number | null;
    metadata: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/activity-log
//
// Query params:
//   - agent: Filter by agent name
//   - project: Filter by Jira project (SCRUM, INFRA, etc.)
//   - status: Filter by status
//   - since: ISO timestamp to get entries after
//   - limit: Max entries (default 100, max 500)
//   - offset: Pagination offset
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        const agent = searchParams.get('agent');
        const project = searchParams.get('project');
        const status = searchParams.get('status');
        const since = searchParams.get('since');
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10), 1), 500);
        const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

        // Build query dynamically
        const conditions: string[] = [];
        const params: any[] = [];

        if (agent) {
            conditions.push('agent = ?');
            params.push(agent);
        }
        if (project) {
            conditions.push('project = ?');
            params.push(project);
        }
        if (status) {
            conditions.push('status = ?');
            params.push(status);
        }
        if (since) {
            conditions.push('timestamp > ?');
            params.push(since);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Get total count
        const countStmt = db.prepare(`SELECT COUNT(*) as total FROM agent_activity_log ${whereClause}`);
        const { total } = countStmt.get(...params) as { total: number };

        // Get paginated results
        const selectStmt = db.prepare(`
            SELECT * FROM agent_activity_log
            ${whereClause}
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
        `);
        const entries = selectStmt.all(...params, limit, offset) as ActivityLogEntry[];

        // Parse metadata JSON
        const parsedEntries = entries.map(entry => ({
            ...entry,
            metadata: entry.metadata ? JSON.parse(entry.metadata) : null,
        }));

        return NextResponse.json({
            entries: parsedEntries,
            total,
            hasMore: offset + limit < total,
            offset,
            limit,
        });
    } catch (error: any) {
        console.error('[GET /api/activity-log] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch activity log', message: error.message },
            { status: 500 }
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/activity-log
//
// Creates a new activity log entry.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parseResult = CreateActivityLogSchema.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parseResult.error.flatten() },
                { status: 400 }
            );
        }

        const data = parseResult.data;

        const stmt = db.prepare(`
            INSERT INTO agent_activity_log (agent, project, issue, status, notes, pr_url, duration_minutes, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            data.agent,
            data.project || null,
            data.issue || null,
            data.status,
            data.notes || null,
            data.pr_url || null,
            data.duration_minutes || null,
            data.metadata ? JSON.stringify(data.metadata) : null
        );

        // Fetch the created entry
        const getStmt = db.prepare('SELECT * FROM agent_activity_log WHERE id = ?');
        const entry = getStmt.get(result.lastInsertRowid) as ActivityLogEntry;

        return NextResponse.json(
            {
                entry: {
                    ...entry,
                    metadata: entry.metadata ? JSON.parse(entry.metadata) : null,
                },
            },
            { status: 201 }
        );
    } catch (error: any) {
        console.error('[POST /api/activity-log] Error:', error);
        return NextResponse.json(
            { error: 'Failed to create activity log entry', message: error.message },
            { status: 500 }
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/activity-log
//
// Updates an existing activity log entry by ID.
// Query param: id (required)
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'Missing required query parameter: id' },
                { status: 400 }
            );
        }

        const body = await req.json();
        const parseResult = UpdateActivityLogSchema.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parseResult.error.flatten() },
                { status: 400 }
            );
        }

        const data = parseResult.data;

        // Build update dynamically
        const updates: string[] = [];
        const params: any[] = [];

        if (data.status !== undefined) {
            updates.push('status = ?');
            params.push(data.status);
        }
        if (data.notes !== undefined) {
            updates.push('notes = ?');
            params.push(data.notes);
        }
        if (data.pr_url !== undefined) {
            updates.push('pr_url = ?');
            params.push(data.pr_url);
        }
        if (data.duration_minutes !== undefined) {
            updates.push('duration_minutes = ?');
            params.push(data.duration_minutes);
        }
        if (data.metadata !== undefined) {
            updates.push('metadata = ?');
            params.push(JSON.stringify(data.metadata));
        }

        if (updates.length === 0) {
            return NextResponse.json(
                { error: 'No fields to update' },
                { status: 400 }
            );
        }

        params.push(id);

        const stmt = db.prepare(`
            UPDATE agent_activity_log
            SET ${updates.join(', ')}
            WHERE id = ?
        `);
        const result = stmt.run(...params);

        if (result.changes === 0) {
            return NextResponse.json(
                { error: 'Activity log entry not found' },
                { status: 404 }
            );
        }

        // Fetch the updated entry
        const getStmt = db.prepare('SELECT * FROM agent_activity_log WHERE id = ?');
        const entry = getStmt.get(id) as ActivityLogEntry;

        return NextResponse.json({
            entry: {
                ...entry,
                metadata: entry.metadata ? JSON.parse(entry.metadata) : null,
            },
        });
    } catch (error: any) {
        console.error('[PATCH /api/activity-log] Error:', error);
        return NextResponse.json(
            { error: 'Failed to update activity log entry', message: error.message },
            { status: 500 }
        );
    }
}
