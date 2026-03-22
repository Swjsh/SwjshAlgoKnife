import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// HALO agent metadata
const HALO_AGENTS = {
  chief: { name: 'Chief', role: 'COO', emoji: '👔', color: '#f59e0b' },
  arbiter: { name: 'Arbiter', role: 'Quality Control', emoji: '⚖️', color: '#ef4444' },
  ops: { name: 'Ops', role: 'SRE / DevOps', emoji: '🔧', color: '#06b6d4' },
  hunter: { name: 'Hunter', role: 'Security / Audit', emoji: '🔍', color: '#10b981' },
  cortana: { name: 'Cortana', role: 'Research / Intel', emoji: '🧠', color: '#a855f7' },
  scout: { name: 'Scout', role: 'Product / Backlog', emoji: '🗺️', color: '#ec4899' },
} as const;

type AgentId = keyof typeof HALO_AGENTS;

interface Heartbeat {
  agent: string;
  timestamp: string;
  status: string;
  lastTask: string;
  cycleCount: number;
}

interface AgentRegistry {
  agents: Record<string, { sessionId: string }>;
}

interface AgentStatus {
  name: string;
  role: string;
  emoji: string;
  color: string;
  status: 'online' | 'dead' | 'idle';
  lastHeartbeat: string | null;
  lastTask: string;
  cycleCount: number;
  staleSince: string | null;
  sessionId: string | null;
}

// Helper: Calculate how many seconds ago a timestamp was
function getSecondsSince(isoString: string | null): number | null {
  if (!isoString) return null;
  const then = new Date(isoString).getTime();
  const now = Date.now();
  return Math.round((now - then) / 1000);
}

// Helper: Format uptime from seconds
function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

// Helper: Read heartbeat files
async function getHeartbeats(): Promise<Record<AgentId, Heartbeat | null>> {
  const heartbeatsDir = path.join(process.cwd(), 'data', 'halo-heartbeats');
  const result: Record<AgentId, Heartbeat | null> = {
    chief: null,
    arbiter: null,
    ops: null,
    hunter: null,
    cortana: null,
    scout: null,
  };

  try {
    const files = await fs.readdir(heartbeatsDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = await fs.readFile(path.join(heartbeatsDir, file), 'utf-8');
          const heartbeat: Heartbeat = JSON.parse(content);
          const agentId = heartbeat.agent.toLowerCase() as AgentId;
          if (agentId in result) {
            result[agentId] = heartbeat;
          }
        } catch (e) {
          console.error(`Failed to parse heartbeat file ${file}:`, e);
        }
      }
    }
  } catch (e) {
    // Directory doesn't exist yet, that's fine
    console.debug('No heartbeat directory found:', e);
  }

  return result;
}

// Helper: Read agent registry
async function getRegistry(): Promise<AgentRegistry> {
  try {
    const registryPath = path.join(process.cwd(), 'data', 'agent-registry.json');
    const content = await fs.readFile(registryPath, 'utf-8');
    return JSON.parse(content) as AgentRegistry;
  } catch (e) {
    console.debug('No agent registry found:', e);
    return { agents: {} };
  }
}

// Helper: Check if watchdog is running
async function checkWatchdog(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch('http://localhost:3002/health', {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

// Helper: Get system start time (estimate from oldest heartbeat or current time)
async function getSystemStartTime(): Promise<Date> {
  const heartbeats = await getHeartbeats();
  const timestamps: Date[] = [];

  for (const hb of Object.values(heartbeats)) {
    if (hb?.timestamp) {
      timestamps.push(new Date(hb.timestamp));
    }
  }

  if (timestamps.length === 0) {
    return new Date();
  }

  return timestamps.reduce((oldest, current) =>
    current < oldest ? current : oldest
  );
}

/**
 * GET /api/agents/halo
 * Returns the status of all 6 HALO agents
 */
export async function GET(req: NextRequest) {
  try {
    const heartbeats = await getHeartbeats();
    const registry = await getRegistry();
    const watchdogRunning = await checkWatchdog();
    const systemStartTime = await getSystemStartTime();

    const agents: Record<AgentId, AgentStatus> = {
      chief: null as any,
      arbiter: null as any,
      ops: null as any,
      hunter: null as any,
      cortana: null as any,
      scout: null as any,
    };

    let totalOnline = 0;
    let totalDead = 0;

    for (const agentId of Object.keys(HALO_AGENTS) as AgentId[]) {
      const metadata = HALO_AGENTS[agentId];
      const heartbeat = heartbeats[agentId];
      const sessionId = registry.agents?.[agentId]?.sessionId || null;

      let status: 'online' | 'dead' | 'idle' = 'idle';
      let staleSince: string | null = null;

      if (heartbeat?.timestamp) {
        const secondsSince = getSecondsSince(heartbeat.timestamp);
        const STALE_THRESHOLD = 600; // 10 minutes

        if (secondsSince !== null && secondsSince > STALE_THRESHOLD) {
          status = 'dead';
          const staleDate = new Date(heartbeat.timestamp);
          staleDate.setSeconds(staleDate.getSeconds() + STALE_THRESHOLD);
          staleSince = staleDate.toISOString();
          totalDead++;
        } else {
          status = 'online';
          totalOnline++;
        }
      }

      agents[agentId] = {
        name: metadata.name,
        role: metadata.role,
        emoji: metadata.emoji,
        color: metadata.color,
        status,
        lastHeartbeat: heartbeat?.timestamp || null,
        lastTask: heartbeat?.lastTask || 'None',
        cycleCount: heartbeat?.cycleCount || 0,
        staleSince,
        sessionId,
      };
    }

    const now = Date.now();
    const uptimeSeconds = Math.round((now - systemStartTime.getTime()) / 1000);

    return NextResponse.json({
      agents,
      watchdog: {
        running: watchdogRunning,
        port: 3002,
      },
      system: {
        totalOnline,
        totalDead,
        uptime: formatUptime(uptimeSeconds),
      },
    });
  } catch (error: any) {
    console.error('[HALO API] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch HALO status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/halo
 * Controls HALO agents via the watchdog
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, agent } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action parameter' },
        { status: 400 }
      );
    }

    // Validate agent name if specified
    if (agent && !(agent in HALO_AGENTS)) {
      return NextResponse.json(
        { error: `Invalid agent: ${agent}. Must be one of: ${Object.keys(HALO_AGENTS).join(', ')}` },
        { status: 400 }
      );
    }

    // Map action to watchdog endpoint
    let url: string;
    let method = 'POST';

    switch (action) {
      case 'restart':
        if (!agent) {
          return NextResponse.json(
            { error: 'restart action requires agent parameter' },
            { status: 400 }
          );
        }
        url = `http://localhost:3002/restart?agent=${encodeURIComponent(agent)}`;
        break;

      case 'restart-all':
        url = 'http://localhost:3002/restart-all';
        break;

      case 'stop':
        if (!agent) {
          return NextResponse.json(
            { error: 'stop action requires agent parameter' },
            { status: 400 }
          );
        }
        url = `http://localhost:3002/stop?agent=${encodeURIComponent(agent)}`;
        break;

      case 'stop-all':
        url = 'http://localhost:3002/stop-all';
        break;

      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}. Must be one of: restart, restart-all, stop, stop-all` },
          { status: 400 }
        );
    }

    // Proxy request to watchdog
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      clearTimeout(timeoutId);

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        return NextResponse.json(
          {
            error: 'Watchdog error',
            details: responseData,
            status: response.status,
          },
          { status: response.status }
        );
      }

      return NextResponse.json({
        success: true,
        action,
        agent: agent || 'all',
        watchdogResponse: responseData,
      });
    } catch (fetchError: any) {
      console.error('[HALO API] Watchdog fetch error:', fetchError);
      return NextResponse.json(
        {
          error: 'Failed to reach watchdog',
          details: fetchError.message,
          watchdogUrl: 'http://localhost:3002',
        },
        { status: 503 }
      );
    }
  } catch (error: any) {
    console.error('[HALO API] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process HALO command' },
      { status: 500 }
    );
  }
}
