/**
 * /api/control — LLM Control API for SwjshAlgoKnife
 *
 * Serves as the programmatic interface for LLM agents to query system status
 * and execute control commands.
 *
 * SECURITY (updated 2026-03-18):
 *   - Authentication REQUIRED in production (X-Control-Key header)
 *   - Rate limited: 60 req/min GET, 30 req/min POST
 *   - Localhost access allowed in development without key
 *
 * GET  /api/control   — Full system status snapshot
 * POST /api/control   — Execute control commands (pause, resume, restart, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { AGENTS_DB_PATH } from '@/lib/dataPaths';

// ============================================================================
// Types
// ============================================================================

interface AgentState {
  last_updated: string;
  status: string;
  active_pairs: number;
  total_zones_found: number;
  performance: {
    win_rate: number;
    total_pnl: number;
    trades: number;
  };
  pending_orders: Array<Record<string, unknown>>;
  active_trades?: Array<Record<string, unknown>>;
  closed_trades: Array<Record<string, unknown>>;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

interface SystemStatus {
  agents: Record<string, AgentState>;
  system_health: {
    total_pnl: number;
    active_trades_count: number;
    closed_trades_count: number;
    last_updated: string;
    stale_agents: string[];
    watchdog_alerts: string[];
  };
  recent_activity: Array<Record<string, unknown>>;
  system_prompt: string;
}

interface ControlCommand {
  id: string;
  command: string;
  agentId?: string;
  reason?: string;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';
}

// ============================================================================
// Rate Limiting (Security Fix: Prevent DoS on control endpoints)
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const controlRateLimitStore = new Map<string, RateLimitEntry>();

function checkRateLimit(
  clientIp: string,
  max: number = 60,
  windowSeconds: number = 60
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const key = `control:${clientIp}`;
  const entry = controlRateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowSeconds * 1000;
    controlRateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: max - 1, resetAt };
  }

  entry.count++;
  const remaining = Math.max(0, max - entry.count);
  return { allowed: entry.count <= max, remaining, resetAt: entry.resetAt };
}

// Cleanup stale rate limit entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of controlRateLimitStore) {
    if (now > entry.resetAt) {
      controlRateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the data directory from environment or fallback to cwd.
 * MUST match agent_runner.ts: process.env.DATA_DIR ?? process.cwd()
 * AND dataPaths.ts: process.env.DATA_DIR ?? process.cwd()
 */
function getDataDir(): string {
  return process.env.DATA_DIR || process.cwd();
}

/**
 * Resolve a data file path with fallback to relative path from cwd
 */
async function resolveDataFile(filename: string): Promise<string> {
  const dataDir = getDataDir();
  const fullPath = path.join(dataDir, filename);

  try {
    // Try the full path first
    await fs.access(fullPath);
    return fullPath;
  } catch {
    // Fallback to relative path from cwd
    const fallbackPath = path.join(process.cwd(), filename);
    try {
      await fs.access(fallbackPath);
      return fallbackPath;
    } catch {
      // Neither exists, return the full path (may be created)
      return fullPath;
    }
  }
}

/**
 * Read agent logs safely with fallback
 */
async function readAgentLogs(): Promise<Array<Record<string, unknown>>> {
  try {
    const logsPath = await resolveDataFile('agent_logs.json');
    const data = await fs.readFile(logsPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Read agents database
 */
async function readAgentsDB(): Promise<Record<string, AgentState>> {
  try {
    const data = await fs.readFile(AGENTS_DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

/**
 * Calculate total P&L and trade counts across all agents
 */
function calculateSystemMetrics(
  agents: Record<string, AgentState>
): { total_pnl: number; active_count: number; closed_count: number } {
  let total_pnl = 0;
  let active_count = 0;
  let closed_count = 0;

  Object.values(agents).forEach((agent) => {
    total_pnl += agent?.performance?.total_pnl || 0;
    active_count += agent?.pending_orders?.length || 0;
    active_count += agent?.active_trades?.length || 0;
    closed_count += agent?.closed_trades?.length || 0;
  });

  return { total_pnl, active_count, closed_count };
}

/**
 * Detect stale agents (no update in 10 minutes)
 */
function detectStaleAgents(agents: Record<string, AgentState>): string[] {
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

  return Object.entries(agents)
    .filter(([, agent]) => {
      const lastUpdate = new Date(agent.last_updated);
      return lastUpdate < tenMinutesAgo;
    })
    .map(([id]) => id);
}

/**
 * Generate watchdog alerts
 */
function generateWatchdogAlerts(
  agents: Record<string, AgentState>,
  staleAgents: string[]
): string[] {
  const alerts: string[] = [];

  // Alert for stale agents
  if (staleAgents.length > 0) {
    alerts.push(`${staleAgents.length} agent(s) stale: ${staleAgents.join(', ')}`);
  }

  // Alert for agents in ERROR status
  Object.entries(agents).forEach(([id, agent]) => {
    if (agent.status === 'ERROR') {
      alerts.push(`Agent ${id} in ERROR status`);
    }
  });

  return alerts;
}

/**
 * Build human-readable system prompt for LLM
 */
function buildSystemPrompt(): string {
  return `You are controlling the SwjshAlgoKnife autonomous trading platform. Here are the available commands:

QUERY COMMANDS:
- "status" — Get full system snapshot (agents, P&L, activity log)
- "summary" — Get human-readable performance summary

CONTROL COMMANDS (require agentId):
- "pause" — Pause a specific agent (stops new trades, keeps existing ones)
- "resume" — Resume a paused agent
- "restart" — Restart an agent (reconnects to broker, reloads state)

SYSTEM COMMANDS:
- "killswitch" — Global halt (all agents stop trading immediately)
- "killswitch_reset" — Reset global halt (allows trading to resume)

REQUIRED FIELDS:
- command: The action to execute
- agentId: Target agent (required for pause/resume/restart, optional for others)
- reason: Human-readable reason for the command (optional but recommended)

AUTHENTICATION:
If CONTROL_API_KEY is set on the server, include header: X-Control-Key: <key>
Without the key configured, the API is open (internal/localhost use).

RESPONSE FORMAT:
All commands return:
{
  "success": boolean,
  "data": { ... },     // Command output
  "error": string,     // If success=false
  "timestamp": ISO8601 timestamp
}

EXAMPLE USAGE:
POST /api/control
{
  "command": "pause",
  "agentId": "boba",
  "reason": "Volatility spike detected, awaiting market stabilization"
}`;
}

// ============================================================================
// Auth Helper — REQUIRED API key guard (Security Fix: fail closed)
// ============================================================================

/**
 * Verify the Control API key. Authentication is ALWAYS required.
 * In production, CONTROL_API_KEY must be set or requests are rejected.
 * Requests must include: X-Control-Key: <key>
 *
 * Security Note: Changed from "open by default" to "closed by default"
 * to prevent unauthorized access to trading controls.
 */
function checkAuth(req: NextRequest): NextResponse | null {
  const requiredKey = process.env.CONTROL_API_KEY;
  const isProduction = process.env.NODE_ENV === 'production';

  // Security: Fail closed - require auth in production
  if (!requiredKey) {
    if (isProduction) {
      console.error('CRITICAL: CONTROL_API_KEY not set in production!');
      return NextResponse.json(
        {
          success: false,
          error: 'Service misconfiguration. Contact administrator.',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
    // In development, warn but allow localhost access
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     req.headers.get('x-real-ip') || '';
    if (!clientIp.includes('127.0.0.1') && !clientIp.includes('::1') && clientIp !== 'localhost') {
      console.warn('Control API accessed without auth from non-localhost:', clientIp);
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Set CONTROL_API_KEY for production use.',
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }
    return null; // Allow localhost in dev without key
  }

  const providedKey = req.headers.get('x-control-key');
  if (!providedKey || providedKey !== requiredKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized. Provide a valid X-Control-Key header.',
        timestamp: new Date().toISOString(),
      },
      { status: 401 }
    );
  }
  return null; // Auth passed
}

// ============================================================================
// GET Handler — Full System Status
// ============================================================================

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Security: Rate limiting
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                   req.headers.get('x-real-ip') || 'unknown';
  const { allowed, remaining, resetAt } = checkRateLimit(clientIp, 60, 60);
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded', timestamp: new Date().toISOString() },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': String(remaining),
        },
      }
    );
  }

  const authError = checkAuth(req);
  if (authError) return authError;

  try {
    // Read all data
    const agents = await readAgentsDB();
    const logs = await readAgentLogs();

    // Calculate metrics
    const { total_pnl, active_count, closed_count } = calculateSystemMetrics(agents);
    const staleAgents = detectStaleAgents(agents);
    const watchdogAlerts = generateWatchdogAlerts(agents, staleAgents);

    // Get last 20 activity log entries
    const recentActivity = logs.slice(-20).map((entry) => ({
      ...entry,
      timestamp: new Date(entry.timestamp as string).toISOString(),
    }));

    // Build response
    const status: SystemStatus = {
      agents,
      system_health: {
        total_pnl,
        active_trades_count: active_count,
        closed_trades_count: closed_count,
        last_updated: new Date().toISOString(),
        stale_agents: staleAgents,
        watchdog_alerts: watchdogAlerts,
      },
      recent_activity: recentActivity,
      system_prompt: buildSystemPrompt(),
    };

    return NextResponse.json(status, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[API /control GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch system status',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler — Execute Commands
// ============================================================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Security: Stricter rate limiting for POST (commands can change state)
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                   req.headers.get('x-real-ip') || 'unknown';
  const { allowed, remaining, resetAt } = checkRateLimit(clientIp, 30, 60); // 30/min for commands
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded', timestamp: new Date().toISOString() },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': String(remaining),
        },
      }
    );
  }

  const authError = checkAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { command, agentId, reason } = body;

    if (!command) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: command',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Handle different commands
    switch (command.toLowerCase()) {
      case 'status':
        return handleStatusCommand(req);

      case 'summary':
        return handleSummaryCommand();

      case 'pause':
      case 'resume':
      case 'restart':
        if (!agentId) {
          return NextResponse.json(
            {
              success: false,
              error: `Command "${command}" requires agentId`,
              timestamp: new Date().toISOString(),
            },
            { status: 400 }
          );
        }
        return handleAgentCommand(command, agentId, reason);

      case 'killswitch':
      case 'killswitch_reset':
        return handleKillswitchCommand(command, reason);

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown command: ${command}`,
            supported_commands: [
              'status',
              'summary',
              'pause',
              'resume',
              'restart',
              'killswitch',
              'killswitch_reset',
            ],
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API /control POST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute command',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Command Handlers
// ============================================================================

/**
 * Handle "status" command — delegates to GET
 */
async function handleStatusCommand(req: NextRequest): Promise<NextResponse> {
  return GET(req);
}

/**
 * Handle "summary" command — human-readable performance report
 */
async function handleSummaryCommand(): Promise<NextResponse> {
  try {
    const agents = await readAgentsDB();
    const { total_pnl, active_count, closed_count } = calculateSystemMetrics(agents);

    // Build summary text
    let summary = '=== SwjshAlgoKnife Daily Summary ===\n\n';
    summary += `Generated: ${new Date().toISOString()}\n\n`;

    summary += '--- PORTFOLIO METRICS ---\n';
    summary += `Total P&L: $${total_pnl.toFixed(2)}\n`;
    summary += `Active Trades: ${active_count}\n`;
    summary += `Closed Trades: ${closed_count}\n\n`;

    summary += '--- AGENT STATUS ---\n';
    Object.entries(agents).forEach(([id, agent]) => {
      summary += `\n${agent.meta?.name || id}:\n`;
      summary += `  Status: ${agent.status}\n`;
      summary += `  Win Rate: ${agent?.performance?.win_rate ?? 0}%\n`;
      summary += `  Total P&L: $${(agent?.performance?.total_pnl ?? 0).toFixed(2)}\n`;
      summary += `  Trades: ${agent?.performance?.trades ?? 0}\n`;
      summary += `  Active Pairs: ${agent.active_pairs}\n`;
      summary += `  Last Updated: ${new Date(agent.last_updated).toLocaleString()}\n`;
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          summary,
          metrics: {
            total_pnl,
            active_trades: active_count,
            closed_trades: closed_count,
          },
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /control] Summary command error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate summary',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Handle agent control commands (pause, resume, restart)
 */
async function handleAgentCommand(
  command: string,
  agentId: string,
  reason?: string
): Promise<NextResponse> {
  try {
    const agents = await readAgentsDB();

    // Verify agent exists
    if (!agents[agentId]) {
      return NextResponse.json(
        {
          success: false,
          error: `Agent not found: ${agentId}`,
          available_agents: Object.keys(agents),
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Write control command to control_commands.json
    const controlCmd: ControlCommand = {
      id: `cmd_${Date.now()}`,
      command: command.toLowerCase(),
      agentId,
      reason: reason || `LLM-initiated ${command}`,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    const controlPath = await resolveDataFile('control_commands.json');
    let commands: { commands: ControlCommand[] } = { commands: [] };

    try {
      const existing = await fs.readFile(controlPath, 'utf8');
      commands = JSON.parse(existing);
    } catch {
      // File doesn't exist, start fresh
    }

    commands.commands.push(controlCmd);

    // Write updated commands file
    await fs.writeFile(controlPath, JSON.stringify(commands, null, 2), 'utf8');

    return NextResponse.json(
      {
        success: true,
        data: {
          command: controlCmd.command,
          agentId,
          status: 'pending',
          command_id: controlCmd.id,
          message: `${controlCmd.command.toUpperCase()} command queued for ${agentId}`,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('[API /control] Agent command error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute agent command',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Handle killswitch commands (global halt/reset)
 */
async function handleKillswitchCommand(
  command: string,
  reason?: string
): Promise<NextResponse> {
  try {
    const controlPath = await resolveDataFile('control_commands.json');
    let commands: { commands: ControlCommand[] } = { commands: [] };

    try {
      const existing = await fs.readFile(controlPath, 'utf8');
      commands = JSON.parse(existing);
    } catch {
      // File doesn't exist, start fresh
    }

    const controlCmd: ControlCommand = {
      id: `cmd_${Date.now()}`,
      command: command.toLowerCase(),
      reason: reason || `LLM-initiated ${command}`,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    commands.commands.push(controlCmd);

    // Write updated commands file
    await fs.writeFile(controlPath, JSON.stringify(commands, null, 2), 'utf8');

    const isKillswitch = command.toLowerCase() === 'killswitch';

    return NextResponse.json(
      {
        success: true,
        data: {
          command: controlCmd.command,
          status: 'pending',
          command_id: controlCmd.id,
          message: isKillswitch
            ? 'KILLSWITCH ACTIVATED — all agents halting immediately'
            : 'Killswitch reset — agents may resume trading',
        },
        warning: isKillswitch
          ? 'All trading has been halted globally. Verify market conditions before reset.'
          : undefined,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('[API /control] Killswitch command error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute killswitch command',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
