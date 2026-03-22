import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────────────────────────

const CreateBlockerSchema = z.object({
    agent: z.string().min(1).max(50),
    issue: z.string().max(50).optional(),
    blocker: z.string().min(1).max(500),
});

const ResolveBlockerSchema = z.object({
    resolved_by: z.string().min(1).max(50),
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Blocker {
    id: number;
    timestamp: string;
    agent: string;
    issue: string | null;
    blocker: string;
    status: string;
    resolved_at: string | null;
    resolved_by: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/activity-log/blockers
//
// Query params:
//   - status: Filter by status (open, resolved)
//   - agent: Filter by agent
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        const status = searchParams.get('status') || 'open';
        const agent = searchParams.get('agent');

        const conditions: string[] = ['status = ?'];
        const params: any[] = [status];

        if (agent) {
            conditions.push('agent = ?');
            params.push(agent);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        const stmt = db.prepare(`
            SELECT * FROM agent_blockers
            ${whereClause}
            ORDER BY timestamp DESC
        `);
        const blockers = stmt.all(...params) as Blocker[];

        return NextResponse.json({ blockers });
    } catch (error: any) {
        console.error('[GET /api/activity-log/blockers] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch blockers', message: error.message },
            { status: 500 }
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/activity-log/blockers
//
// Creates a new blocker.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parseResult = CreateBlockerSchema.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parseResult.error.flatten() },
                { status: 400 }
            );
        }

        const data = parseResult.data;

        const stmt = db.prepare(`
            INSERT INTO agent_blockers (agent, issue, blocker, status)
            VALUES (?, ?, ?, 'open')
        `);

        const result = stmt.run(data.agent, data.issue || null, data.blocker);

        const getStmt = db.prepare('SELECT * FROM agent_blockers WHERE id = ?');
        const blocker = getStmt.get(result.lastInsertRowid) as Blocker;

        return NextResponse.json({ blocker }, { status: 201 });
    } catch (error: any) {
        console.error('[POST /api/activity-log/blockers] Error:', error);
        return NextResponse.json(
            { error: 'Failed to create blocker', message: error.message },
            { status: 500 }
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/activity-log/blockers
//
// Resolves a blocker by ID.
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
        const parseResult = ResolveBlockerSchema.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parseResult.error.flatten() },
                { status: 400 }
            );
        }

        const { resolved_by } = parseResult.data;

        const stmt = db.prepare(`
            UPDATE agent_blockers
            SET status = 'resolved', resolved_at = datetime('now'), resolved_by = ?
            WHERE id = ?
        `);
        const result = stmt.run(resolved_by, id);

        if (result.changes === 0) {
            return NextResponse.json(
                { error: 'Blocker not found' },
                { status: 404 }
            );
        }

        const getStmt = db.prepare('SELECT * FROM agent_blockers WHERE id = ?');
        const blocker = getStmt.get(id) as Blocker;

        return NextResponse.json({ blocker });
    } catch (error: any) {
        console.error('[PATCH /api/activity-log/blockers] Error:', error);
        return NextResponse.json(
            { error: 'Failed to resolve blocker', message: error.message },
            { status: 500 }
        );
    }
}
