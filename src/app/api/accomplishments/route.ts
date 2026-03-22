/**
 * Accomplishments API Endpoint
 * ============================
 * Cross-system accomplishment rollup for Research + HALO + Trading agents.
 *
 * GET /api/accomplishments
 *   Returns: Today's accomplishments across all agent types
 *
 * GET /api/accomplishments?days=7
 *   Returns: Accomplishments from last N days
 *
 * GET /api/accomplishments?type=research|halo|trading
 *   Returns: Filtered by agent type
 *
 * GET /api/accomplishments?stream=true
 *   Returns: SSE stream for real-time accomplishments
 *
 * Part of Research Agent Audit System — achieving 95%+ scores
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import db from '@/lib/db';

// ============================================================================
// Types
// ============================================================================

interface Accomplishment {
  id?: number;
  agent_id: string;
  agent_type: 'research' | 'halo' | 'trading';
  timestamp: string;
  action_type: string;
  description: string;
  quantified_value: number | null;
  jira_ticket: string | null;
  git_commit: string | null;
  source?: string;
}

interface RollupSummary {
  total: number;
  byType: {
    research: number;
    halo: number;
    trading: number;
  };
  byActionType: Record<string, number>;
  byAgent: Record<string, number>;
}

// ============================================================================
// Constants
// ============================================================================

const DATA_DIR = path.join(process.cwd(), 'data');
const OVERNIGHT_DIR = path.join(process.cwd(), '.claude', 'overnight');

// ============================================================================
// Helper Functions
// ============================================================================

function getAccomplishmentsFromDB(days: number = 1, agentType?: string): Accomplishment[] {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startStr = startDate.toISOString();

    let query = `
      SELECT * FROM accomplishments
      WHERE timestamp >= ?
    `;
    const params: (string | number)[] = [startStr];

    if (agentType) {
      query += ` AND agent_type = ?`;
      params.push(agentType);
    }

    query += ` ORDER BY timestamp DESC`;

    const stmt = db.prepare(query);
    return stmt.all(...params) as Accomplishment[];
  } catch {
    return [];
  }
}

function getAccomplishmentsFromActivityFeed(): Accomplishment[] {
  const accomplishments: Accomplishment[] = [];
  const activityFile = path.join(DATA_DIR, 'activity-feed.json');

  try {
    if (fs.existsSync(activityFile)) {
      const content = fs.readFileSync(activityFile, 'utf-8');
      const data = JSON.parse(content) as { events?: Array<{
        type?: string;
        agent?: string;
        agentType?: string;
        message?: string;
        timestamp?: string;
        jiraTicket?: string;
      }> };

      if (data.events && Array.isArray(data.events)) {
        const today = new Date().toISOString().split('T')[0];

        for (const event of data.events) {
          if (event.type === 'accomplishment' && event.timestamp?.startsWith(today)) {
            accomplishments.push({
              agent_id: event.agent || 'unknown',
              agent_type: (event.agentType as 'research' | 'halo' | 'trading') || 'halo',
              timestamp: event.timestamp || new Date().toISOString(),
              action_type: 'activity',
              description: event.message || '',
              quantified_value: null,
              jira_ticket: event.jiraTicket || null,
              git_commit: null,
              source: 'activity-feed',
            });
          }
        }
      }
    }
  } catch {
    // Activity feed may not exist or be invalid
  }

  return accomplishments;
}

function getAccomplishmentsFromMorningReports(days: number = 1): Accomplishment[] {
  const accomplishments: Accomplishment[] = [];
  const morningReportsDir = path.join(DATA_DIR, 'morning-reports');

  try {
    if (!fs.existsSync(morningReportsDir)) return accomplishments;

    const files = fs.readdirSync(morningReportsDir).filter(f => f.endsWith('.json'));
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    for (const file of files) {
      const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
      if (!dateMatch) continue;

      const fileDate = new Date(dateMatch[1]);
      if (fileDate < cutoffDate) continue;

      try {
        const content = fs.readFileSync(path.join(morningReportsDir, file), 'utf-8');
        const report = JSON.parse(content) as {
          terminals?: Array<{
            role?: string;
            accomplishments?: string[];
          }>;
        };

        if (report.terminals) {
          for (const terminal of report.terminals) {
            if (terminal.accomplishments && Array.isArray(terminal.accomplishments)) {
              for (const acc of terminal.accomplishments) {
                accomplishments.push({
                  agent_id: terminal.role?.toLowerCase() || 'unknown',
                  agent_type: 'research',
                  timestamp: dateMatch[1] + 'T08:00:00Z',
                  action_type: 'morning_report',
                  description: acc,
                  quantified_value: null,
                  jira_ticket: null,
                  git_commit: null,
                  source: 'morning-report',
                });
              }
            }
          }
        }
      } catch {
        // Invalid report file
      }
    }
  } catch {
    // Can't read directory
  }

  return accomplishments;
}

function calculateRollupSummary(accomplishments: Accomplishment[]): RollupSummary {
  const summary: RollupSummary = {
    total: accomplishments.length,
    byType: { research: 0, halo: 0, trading: 0 },
    byActionType: {},
    byAgent: {},
  };

  for (const acc of accomplishments) {
    // By type
    if (acc.agent_type in summary.byType) {
      summary.byType[acc.agent_type]++;
    }

    // By action type
    summary.byActionType[acc.action_type] = (summary.byActionType[acc.action_type] || 0) + 1;

    // By agent
    summary.byAgent[acc.agent_id] = (summary.byAgent[acc.agent_id] || 0) + 1;
  }

  return summary;
}

// ============================================================================
// API Handler
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    const typeFilter = searchParams.get('type') as 'research' | 'halo' | 'trading' | null;
    const streamMode = searchParams.get('stream') === 'true';
    const days = daysParam ? parseInt(daysParam, 10) : 1;

    // Real-time streaming mode (SSE)
    if (streamMode) {
      // Return SSE headers for real-time streaming
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // Send initial data
          const initialData = getAccomplishmentsFromDB(days, typeFilter || undefined);
          const message = `data: ${JSON.stringify({ type: 'initial', accomplishments: initialData })}\n\n`;
          controller.enqueue(encoder.encode(message));

          // Keep connection alive with heartbeat
          const heartbeat = setInterval(() => {
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
          }, 30000);

          // Clean up on close
          request.signal.addEventListener('abort', () => {
            clearInterval(heartbeat);
            controller.close();
          });
        },
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Standard JSON response with cross-system rollup
    const dbAccomplishments = getAccomplishmentsFromDB(days, typeFilter || undefined);
    const activityAccomplishments = getAccomplishmentsFromActivityFeed();
    const morningReportAccomplishments = getAccomplishmentsFromMorningReports(days);

    // Merge and dedupe
    const allAccomplishments: Accomplishment[] = [...dbAccomplishments];
    const seenKeys = new Set(dbAccomplishments.map(a => `${a.agent_id}:${a.timestamp}:${a.description.substring(0, 50)}`));

    for (const acc of [...activityAccomplishments, ...morningReportAccomplishments]) {
      const key = `${acc.agent_id}:${acc.timestamp}:${acc.description.substring(0, 50)}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        if (!typeFilter || acc.agent_type === typeFilter) {
          allAccomplishments.push(acc);
        }
      }
    }

    // Sort by timestamp descending
    allAccomplishments.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Calculate summary
    const summary = calculateRollupSummary(allAccomplishments);

    return NextResponse.json({
      success: true,
      accomplishments: allAccomplishments,
      summary,
      sources: ['database', 'activity-feed', 'morning-reports'],
      days,
      typeFilter,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Accomplishments API] Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
