import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const SECURITY_AUDIT_LOG = path.join(process.cwd(), 'data', 'security-audit.log');

interface SecurityEvent {
  timestamp: string;
  agentId: string;
  command: string;
  reason: string;
  action: 'BLOCKED' | 'WARNED' | 'ALLOWED';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const agentId = searchParams.get('agentId');
    const action = searchParams.get('action');

    if (!fs.existsSync(SECURITY_AUDIT_LOG)) {
      return NextResponse.json({
        events: [],
        total: 0,
        message: 'No security events recorded yet'
      });
    }

    const content = fs.readFileSync(SECURITY_AUDIT_LOG, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    let events: SecurityEvent[] = lines
      .map(line => {
        try {
          return JSON.parse(line) as SecurityEvent;
        } catch {
          return null;
        }
      })
      .filter((e): e is SecurityEvent => e !== null);

    // Filter by agentId if specified
    if (agentId) {
      events = events.filter(e => e.agentId.toLowerCase() === agentId.toLowerCase());
    }

    // Filter by action if specified
    if (action) {
      events = events.filter(e => e.action === action.toUpperCase());
    }

    // Sort by timestamp descending (most recent first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit
    const limitedEvents = events.slice(0, limit);

    // Calculate stats
    const stats = {
      total: events.length,
      blocked: events.filter(e => e.action === 'BLOCKED').length,
      warned: events.filter(e => e.action === 'WARNED').length,
      byAgent: {} as Record<string, number>
    };

    events.forEach(e => {
      stats.byAgent[e.agentId] = (stats.byAgent[e.agentId] || 0) + 1;
    });

    return NextResponse.json({
      events: limitedEvents,
      stats,
      hasMore: events.length > limit
    });

  } catch (error) {
    console.error('Error reading security audit log:', error);
    return NextResponse.json(
      { error: 'Failed to read security events' },
      { status: 500 }
    );
  }
}

// POST endpoint to manually log a security event (for testing or manual reporting)
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const event: SecurityEvent = {
      timestamp: new Date().toISOString(),
      agentId: body.agentId || 'manual',
      command: body.command || '[manual entry]',
      reason: body.reason || 'Manual security event',
      action: body.action || 'WARNED'
    };

    const logDir = path.dirname(SECURITY_AUDIT_LOG);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    fs.appendFileSync(SECURITY_AUDIT_LOG, JSON.stringify(event) + '\n');

    return NextResponse.json({
      success: true,
      event
    });

  } catch (error) {
    console.error('Error logging security event:', error);
    return NextResponse.json(
      { error: 'Failed to log security event' },
      { status: 500 }
    );
  }
}
