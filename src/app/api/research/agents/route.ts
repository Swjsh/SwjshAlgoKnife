/**
 * /api/research/agents — Overnight Research Agent Status & Command API
 *
 * GET  — Returns status of all 8 overnight research agents
 * POST — Sends commands to specific agents
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// ============================================================================
// Constants
// ============================================================================

const ROOT = process.cwd();
const OVERNIGHT_DIR = path.join(ROOT, '.claude', 'overnight');
const HEARTBEAT_DIR = path.join(ROOT, 'data', 'heartbeats');

// Agent definitions with metadata (IDs use underscores to match useResearchAgents.ts)
const AGENT_DEFINITIONS: AgentDefinition[] = [
  // Group 1: Internal Improvement (Terminals 1-4)
  { id: 'improver', terminalId: 1, name: 'IMPROVER', emoji: '🔧', color: '#06b6d4', group: 1 },
  { id: 'backtester', terminalId: 2, name: 'BACKTESTER', emoji: '📊', color: '#22c55e', group: 1 },
  { id: 'researcher', terminalId: 3, name: 'RESEARCHER', emoji: '🔍', color: '#a855f7', group: 1 },
  { id: 'brain_updater', terminalId: 4, name: 'BRAIN_UPDATER', emoji: '🧠', color: '#f59e0b', group: 1 },
  // Group 2: Security & Ops (Terminals 5-8)
  { id: 'security_auditor', terminalId: 5, name: 'SECURITY_AUDITOR', emoji: '🛡️', color: '#ef4444', group: 2 },
  { id: 'integration_tester', terminalId: 6, name: 'INTEGRATION_TESTER', emoji: '🧪', color: '#3b82f6', group: 2 },
  { id: 'intel_aggregator', terminalId: 7, name: 'INTEL_AGGREGATOR', emoji: '📡', color: '#8b5cf6', group: 2 },
  { id: 'devops_optimizer', terminalId: 8, name: 'DEVOPS_OPTIMIZER', emoji: '⚙️', color: '#14b8a6', group: 2 },
];

// Heartbeat thresholds (in milliseconds)
const HEARTBEAT_ALIVE_THRESHOLD = 5 * 60 * 1000;   // 5 minutes
const HEARTBEAT_STALE_THRESHOLD = 15 * 60 * 1000;  // 15 minutes

// ============================================================================
// Types
// ============================================================================

interface AgentDefinition {
  id: string;
  terminalId: number;
  name: string;
  emoji: string;
  color: string;
  group: 1 | 2;
}

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
  message: string;
}

interface HeartbeatInfo {
  status: 'alive' | 'stale' | 'dead';
  lastSeen: string | null;
}

interface SessionInfo {
  started: string;
  baseline: number;
  target: number;
}

interface AgentStatus {
  id: string;
  terminalId: number;
  name: string;
  emoji: string;
  color: string;
  group: 1 | 2;
  status: 'online' | 'offline' | 'busy' | 'completed' | 'error';
  logs: LogEntry[];
  heartbeat: HeartbeatInfo;
  sessionInfo: SessionInfo | null;
  lastActivity: string | null;
  delta: number | null;
  verdict: string | null;
}

interface StatusFile {
  agent?: string;
  status?: string;
  started?: string;
  ended?: string;
  baseline?: number;
  target?: number;
  final?: number;
  delta?: number;
  verdict?: string;
  items?: { done?: number; failed?: number; skipped?: number };
  exit_reason?: string;
  [key: string]: unknown;
}

interface HeartbeatFile {
  timestamp?: string;
  ts?: string;
  status?: string;
  [key: string]: unknown;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

function parseLogLine(line: string): LogEntry | null {
  // Format: [2026-03-22T06:03:45.226Z] [INFO] Message here
  const match = line.match(/^\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.+)$/);
  if (match) {
    return {
      timestamp: match[1],
      level: match[2] as LogEntry['level'],
      message: match[3],
    };
  }
  return null;
}

async function readLogFile(terminalId: number, maxLines: number = 50): Promise<LogEntry[]> {
  const logPath = path.join(OVERNIGHT_DIR, `terminal_${terminalId}_log.txt`);
  try {
    const content = await fs.readFile(logPath, 'utf-8');
    const lines = content.trim().split('\n').slice(-maxLines);
    const entries: LogEntry[] = [];

    for (const line of lines) {
      const entry = parseLogLine(line);
      if (entry) {
        entries.push(entry);
      }
    }

    return entries;
  } catch {
    return [];
  }
}

function determineHeartbeatStatus(heartbeat: HeartbeatFile | null): HeartbeatInfo {
  if (!heartbeat) {
    return { status: 'dead', lastSeen: null };
  }

  const lastSeenStr = heartbeat.timestamp || heartbeat.ts;
  if (!lastSeenStr) {
    return { status: 'dead', lastSeen: null };
  }

  const lastSeen = new Date(lastSeenStr).getTime();
  const now = Date.now();
  const age = now - lastSeen;

  if (age < HEARTBEAT_ALIVE_THRESHOLD) {
    return { status: 'alive', lastSeen: lastSeenStr };
  } else if (age < HEARTBEAT_STALE_THRESHOLD) {
    return { status: 'stale', lastSeen: lastSeenStr };
  } else {
    return { status: 'dead', lastSeen: lastSeenStr };
  }
}

function determineAgentStatus(
  statusFile: StatusFile | null,
  heartbeat: HeartbeatInfo
): 'online' | 'offline' | 'busy' | 'completed' | 'error' {
  if (!statusFile) {
    return 'offline';
  }

  const fileStatus = statusFile.status?.toLowerCase();

  if (fileStatus === 'completed') {
    return 'completed';
  }

  if (fileStatus === 'error' || fileStatus === 'failed') {
    return 'error';
  }

  if (fileStatus === 'running') {
    // Check heartbeat to distinguish online vs busy
    if (heartbeat.status === 'alive') {
      return 'busy';
    } else if (heartbeat.status === 'stale') {
      return 'online'; // Running but might be stuck
    } else {
      return 'offline'; // Heartbeat dead, agent likely crashed
    }
  }

  return 'offline';
}

async function getFileMtime(filePath: string): Promise<Date | null> {
  try {
    const stats = await fs.stat(filePath);
    return stats.mtime;
  } catch {
    return null;
  }
}

async function getAgentStatus(definition: AgentDefinition): Promise<AgentStatus> {
  const { id, terminalId, name, emoji, color, group } = definition;

  // Read status file
  const statusPath = path.join(OVERNIGHT_DIR, `terminal_${terminalId}_status.json`);
  const statusFile = await readJsonFile<StatusFile>(statusPath);

  // Read heartbeat file - try multiple locations
  let heartbeatFile: HeartbeatFile | null = null;

  // 1. Try overnight directory with terminal number
  const heartbeatPath1 = path.join(OVERNIGHT_DIR, `heartbeat_${terminalId}.json`);
  heartbeatFile = await readJsonFile<HeartbeatFile>(heartbeatPath1);

  // 2. Try data/heartbeats directory with agent id (matching existing status route)
  if (!heartbeatFile) {
    const heartbeatPath2 = path.join(HEARTBEAT_DIR, `${id}.json`);
    heartbeatFile = await readJsonFile<HeartbeatFile>(heartbeatPath2);
  }

  // 3. Try agent-specific log file for heartbeat data
  if (!heartbeatFile) {
    const agentLogPath = path.join(OVERNIGHT_DIR, `${id}_log.json`);
    const agentLog = await readJsonFile<HeartbeatFile>(agentLogPath);
    if (agentLog?.timestamp || agentLog?.ts) {
      heartbeatFile = agentLog;
    }
  }

  let heartbeat = determineHeartbeatStatus(heartbeatFile);

  // Read logs
  const logs = await readLogFile(terminalId);

  // Fallback: use log file modification time for heartbeat if no heartbeat file
  if (heartbeat.status === 'dead') {
    const logPath = path.join(OVERNIGHT_DIR, `terminal_${terminalId}_log.txt`);
    const logMtime = await getFileMtime(logPath);
    if (logMtime) {
      const now = Date.now();
      const age = now - logMtime.getTime();

      if (age < HEARTBEAT_ALIVE_THRESHOLD) {
        heartbeat = { status: 'alive', lastSeen: logMtime.toISOString() };
      } else if (age < HEARTBEAT_STALE_THRESHOLD) {
        heartbeat = { status: 'stale', lastSeen: logMtime.toISOString() };
      }
    }
  }

  // Determine overall status
  const status = determineAgentStatus(statusFile, heartbeat);

  // Extract session info
  let sessionInfo: SessionInfo | null = null;
  if (statusFile?.started && statusFile?.baseline !== undefined) {
    sessionInfo = {
      started: statusFile.started,
      baseline: statusFile.baseline,
      target: statusFile.target ?? statusFile.baseline + 5,
    };
  }

  // Get last activity timestamp
  let lastActivity: string | null = null;
  if (statusFile?.ended) {
    lastActivity = statusFile.ended;
  } else if (heartbeat.lastSeen) {
    lastActivity = heartbeat.lastSeen;
  } else if (logs.length > 0) {
    lastActivity = logs[logs.length - 1].timestamp;
  }

  return {
    id,
    terminalId,
    name,
    emoji,
    color,
    group,
    status,
    logs,
    heartbeat,
    sessionInfo,
    lastActivity,
    delta: statusFile?.delta ?? null,
    verdict: statusFile?.verdict ?? null,
  };
}

async function getSessionInfo(): Promise<{ running: boolean; sessionId: string | null }> {
  // Check if there's a running session by looking at eval_state.json or any running agents
  const evalStatePath = path.join(OVERNIGHT_DIR, 'eval_state.json');
  const evalState = await readJsonFile<{ sessionId?: string }>(evalStatePath);

  // Also check if any agent is currently running
  let hasRunningAgent = false;
  for (const def of AGENT_DEFINITIONS) {
    const statusPath = path.join(OVERNIGHT_DIR, `terminal_${def.terminalId}_status.json`);
    const status = await readJsonFile<StatusFile>(statusPath);
    if (status?.status === 'running') {
      hasRunningAgent = true;
      break;
    }
  }

  // Try to extract session ID from status files
  let sessionId: string | null = null;
  if (evalState?.sessionId) {
    sessionId = evalState.sessionId;
  } else {
    // Look for a session ID pattern in status files
    const status1 = await readJsonFile<StatusFile>(
      path.join(OVERNIGHT_DIR, 'terminal_1_status.json')
    );
    if (status1?.started) {
      // Generate session ID from start time
      const date = status1.started.slice(0, 10);
      const time = status1.started.slice(11, 19).replace(/:/g, '');
      sessionId = `overnight-${date}-${time}`;
    }
  }

  return {
    running: hasRunningAgent,
    sessionId,
  };
}

// ============================================================================
// GET Handler — Returns status of all agents
// ============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    // Check if overnight directory exists
    const dirExists = await fileExists(OVERNIGHT_DIR);
    if (!dirExists) {
      // No overnight directory yet - return all agents as offline
      return NextResponse.json({
        success: true,
        agents: AGENT_DEFINITIONS.map((def) => ({
          ...def,
          status: 'offline' as const,
          logs: [],
          heartbeat: { status: 'dead' as const, lastSeen: null },
          sessionInfo: null,
          lastActivity: null,
          delta: null,
          verdict: null,
        })),
        sessionRunning: false,
        sessionId: null,
        timestamp: new Date().toISOString(),
      });
    }

    // Get status for all agents in parallel
    const agentStatuses = await Promise.all(
      AGENT_DEFINITIONS.map((def) => getAgentStatus(def))
    );

    // Get overall session info
    const { running, sessionId } = await getSessionInfo();

    return NextResponse.json({
      success: true,
      agents: agentStatuses,
      sessionRunning: running,
      sessionId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[research/agents] GET failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get agent status',
        agents: [],
        sessionRunning: false,
        sessionId: null,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler — Sends commands to agents
// ============================================================================

interface CommandRequest {
  agentId: string;
  command: string;
}

interface CommandFile {
  command: string;
  sentAt: string;
  processed: boolean;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as CommandRequest;
    const { agentId, command } = body;

    // Validate request
    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid agentId',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (!command || typeof command !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid command',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Find the agent (support both underscore and hyphen formats)
    const normalizedId = agentId.toLowerCase().replace(/-/g, '_');
    const agent = AGENT_DEFINITIONS.find(
      (def) =>
        def.id === agentId ||
        def.id === normalizedId ||
        def.name === agentId.toUpperCase() ||
        def.name === normalizedId.toUpperCase()
    );

    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown agent: ${agentId}`,
          validAgents: AGENT_DEFINITIONS.map((d) => d.id),
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Write command to the agent's command file
    const commandFile: CommandFile = {
      command: command.trim(),
      sentAt: new Date().toISOString(),
      processed: false,
    };

    const commandPath = path.join(
      OVERNIGHT_DIR,
      `terminal_${agent.terminalId}_commands.json`
    );

    // Read existing commands or create new array
    let commands: CommandFile[] = [];
    const existingCommands = await readJsonFile<CommandFile[]>(commandPath);
    if (Array.isArray(existingCommands)) {
      commands = existingCommands;
    }

    // Add new command
    commands.push(commandFile);

    // Write back
    const success = await writeJsonFile(commandPath, commands);

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to write command file',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Command sent to ${agent.name}`,
      agentId: agent.id,
      terminalId: agent.terminalId,
      command: commandFile.command,
      sentAt: commandFile.sentAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[research/agents] POST failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send command',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
