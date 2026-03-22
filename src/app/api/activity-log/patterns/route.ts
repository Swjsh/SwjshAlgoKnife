import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────────────────────────

const CreatePatternSchema = z.object({
    id: z.string().regex(/^[A-Z]\d{3}(-[A-Z]+)?$/, 'Pattern ID must be like P001, P001-ABC, M001'),
    agent: z.string().min(1).max(50),
    confidence: z.number().min(0).max(1).default(0.5),
    description: z.string().min(1).max(1000),
    action: z.string().max(500).optional(),
    category: z.string().max(50).optional(),
    source_issues: z.array(z.string()).optional(),
});

const UpdatePatternSchema = z.object({
    confidence: z.number().min(0).max(1).optional(),
    description: z.string().min(1).max(1000).optional(),
    action: z.string().max(500).optional(),
    category: z.string().max(50).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Pattern {
    id: string;
    timestamp: string;
    agent: string;
    confidence: number;
    description: string;
    action: string | null;
    category: string | null;
    source_issues: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/activity-log/patterns
//
// Query params:
//   - category: Filter by category
//   - min_confidence: Minimum confidence threshold (0-1)
//   - agent: Filter by agent who discovered the pattern
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        const category = searchParams.get('category');
        const minConfidence = parseFloat(searchParams.get('min_confidence') || '0');
        const agent = searchParams.get('agent');

        const conditions: string[] = ['confidence >= ?'];
        const params: any[] = [minConfidence];

        if (category) {
            conditions.push('category = ?');
            params.push(category);
        }
        if (agent) {
            conditions.push('agent = ?');
            params.push(agent);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        const stmt = db.prepare(`
            SELECT * FROM patterns_learned
            ${whereClause}
            ORDER BY confidence DESC, timestamp DESC
        `);
        const patterns = stmt.all(...params) as Pattern[];

        // Parse source_issues JSON
        const parsedPatterns = patterns.map(p => ({
            ...p,
            source_issues: p.source_issues ? JSON.parse(p.source_issues) : null,
        }));

        return NextResponse.json({ patterns: parsedPatterns });
    } catch (error: any) {
        console.error('[GET /api/activity-log/patterns] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch patterns', message: error.message },
            { status: 500 }
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/activity-log/patterns
//
// Creates a new pattern (or updates if ID exists).
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parseResult = CreatePatternSchema.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parseResult.error.flatten() },
                { status: 400 }
            );
        }

        const data = parseResult.data;

        // Use INSERT OR REPLACE to handle upsert
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO patterns_learned (id, agent, confidence, description, action, category, source_issues)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            data.id,
            data.agent,
            data.confidence,
            data.description,
            data.action || null,
            data.category || null,
            data.source_issues ? JSON.stringify(data.source_issues) : null
        );

        const getStmt = db.prepare('SELECT * FROM patterns_learned WHERE id = ?');
        const pattern = getStmt.get(data.id) as Pattern;

        return NextResponse.json(
            {
                pattern: {
                    ...pattern,
                    source_issues: pattern.source_issues ? JSON.parse(pattern.source_issues) : null,
                },
            },
            { status: 201 }
        );
    } catch (error: any) {
        console.error('[POST /api/activity-log/patterns] Error:', error);
        return NextResponse.json(
            { error: 'Failed to create pattern', message: error.message },
            { status: 500 }
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/activity-log/patterns
//
// Updates a pattern's confidence or description.
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
        const parseResult = UpdatePatternSchema.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parseResult.error.flatten() },
                { status: 400 }
            );
        }

        const data = parseResult.data;

        const updates: string[] = [];
        const params: any[] = [];

        if (data.confidence !== undefined) {
            updates.push('confidence = ?');
            params.push(data.confidence);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            params.push(data.description);
        }
        if (data.action !== undefined) {
            updates.push('action = ?');
            params.push(data.action);
        }
        if (data.category !== undefined) {
            updates.push('category = ?');
            params.push(data.category);
        }

        if (updates.length === 0) {
            return NextResponse.json(
                { error: 'No fields to update' },
                { status: 400 }
            );
        }

        params.push(id);

        const stmt = db.prepare(`
            UPDATE patterns_learned
            SET ${updates.join(', ')}
            WHERE id = ?
        `);
        const result = stmt.run(...params);

        if (result.changes === 0) {
            return NextResponse.json(
                { error: 'Pattern not found' },
                { status: 404 }
            );
        }

        const getStmt = db.prepare('SELECT * FROM patterns_learned WHERE id = ?');
        const pattern = getStmt.get(id) as Pattern;

        return NextResponse.json({
            pattern: {
                ...pattern,
                source_issues: pattern.source_issues ? JSON.parse(pattern.source_issues) : null,
            },
        });
    } catch (error: any) {
        console.error('[PATCH /api/activity-log/patterns] Error:', error);
        return NextResponse.json(
            { error: 'Failed to update pattern', message: error.message },
            { status: 500 }
        );
    }
}
