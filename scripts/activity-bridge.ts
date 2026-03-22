#!/usr/bin/env npx tsx
/**
 * Activity Bridge - Connects Claude Code sessions to the Activity Feed
 *
 * This script:
 * 1. Watches Claude session logs for new activity
 * 2. Sends activity directly to dashboards via WebSocket
 * 3. Provides real-time terminal mirroring
 */

import { WebSocketServer, WebSocket } from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { addLogEntry, addStatusEntry, flush as flushActivityLog } from '../src/lib/activity-log';

// ─── Command Queue ────────────────────────────────────────────────────────────

const COMMAND_DIR = path.join(process.cwd(), 'data', 'commands');

interface CommandEntry {
  id: string;
  agentId: string;
  command: string;
  createdAt: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

interface CommandQueue {
  agentId: string;
  commands: CommandEntry[];
  lastUpdated: string;
}

function ensureCommandDir() {
  if (!fs.existsSync(COMMAND_DIR)) {
    fs.mkdirSync(COMMAND_DIR, { recursive: true });
  }
}

function enqueueCommand(agentId: string, command: string): CommandEntry {
  ensureCommandDir();
  const filePath = path.join(COMMAND_DIR, `${agentId.toLowerCase()}.json`);

  let queue: CommandQueue;
  try {
    if (fs.existsSync(filePath)) {
      queue = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } else {
      queue = { agentId, commands: [], lastUpdated: new Date().toISOString() };
    }
  } catch {
    queue = { agentId, commands: [], lastUpdated: new Date().toISOString() };
  }

  const entry: CommandEntry = {
    id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    agentId,
    command,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };

  queue.commands.push(entry);
  queue.lastUpdated = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(queue, null, 2));

  console.log(`[Bridge] Queued command for ${agentId}: ${command.substring(0, 50)}...`);
  return entry;
}

const ALL_AGENT_IDS = ['chief', 'hunter', 'ops', 'scout', 'arbiter', 'cortana', 'oracle'];

// ─── Heartbeat System ─────────────────────────────────────────────────────────

const HEARTBEAT_FILE = path.join(process.cwd(), 'data', 'heartbeat-status.json');

interface HeartbeatAgentState {
  lastSeen: string | null;
  lastNudge: string | null;
  nudgeCount: number;
  status: 'alive' | 'stale' | 'dead' | 'unknown';
}

interface HeartbeatConfig {
  staleThresholdMs: number;
  deadThresholdMs: number;
  autoNudgeEnabled: boolean;
  autoNudgeIntervalMs: number;
  nudgeCooldownMs: number;
}

interface HeartbeatState {
  description: string;
  agents: Record<string, HeartbeatAgentState>;
  config: HeartbeatConfig;
  lastUpdated: string | null;
}

function loadHeartbeatState(): HeartbeatState {
  try {
    if (fs.existsSync(HEARTBEAT_FILE)) {
      return JSON.parse(fs.readFileSync(HEARTBEAT_FILE, 'utf-8'));
    }
  } catch {}
  // Return default state
  const defaultAgents: Record<string, HeartbeatAgentState> = {};
  for (const agentId of ALL_AGENT_IDS) {
    defaultAgents[agentId] = {
      lastSeen: null,
      lastNudge: null,
      nudgeCount: 0,
      status: 'unknown',
    };
  }
  return {
    description: 'Heartbeat status for Halo agents',
    agents: defaultAgents,
    config: {
      staleThresholdMs: 180000,    // 3 minutes
      deadThresholdMs: 600000,     // 10 minutes
      autoNudgeEnabled: true,
      autoNudgeIntervalMs: 120000, // 2 minutes
      nudgeCooldownMs: 60000,      // 1 minute cooldown between nudges
    },
    lastUpdated: null,
  };
}

function saveHeartbeatState(state: HeartbeatState) {
  state.lastUpdated = new Date().toISOString();
  try {
    fs.writeFileSync(HEARTBEAT_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('[Bridge] Failed to save heartbeat state:', err);
  }
}

function computeHeartbeatStatus(lastSeen: string | null, config: HeartbeatConfig): 'alive' | 'stale' | 'dead' | 'unknown' {
  if (!lastSeen) return 'unknown';
  const elapsed = Date.now() - new Date(lastSeen).getTime();
  if (elapsed < config.staleThresholdMs) return 'alive';
  if (elapsed < config.deadThresholdMs) return 'stale';
  return 'dead';
}

function updateHeartbeat(agentId: string) {
  const state = loadHeartbeatState();
  if (!state.agents[agentId]) {
    state.agents[agentId] = {
      lastSeen: null,
      lastNudge: null,
      nudgeCount: 0,
      status: 'unknown',
    };
  }
  state.agents[agentId].lastSeen = new Date().toISOString();
  state.agents[agentId].status = 'alive';
  // Don't save on every update - let the periodic save handle it
}

// In-memory heartbeat state for performance (persisted periodically)
let heartbeatState = loadHeartbeatState();

function sendNudge(agentId: string, isAuto: boolean = false): boolean {
  const now = new Date();
  const agentState = heartbeatState.agents[agentId];

  // Check cooldown
  if (agentState?.lastNudge) {
    const elapsed = now.getTime() - new Date(agentState.lastNudge).getTime();
    if (elapsed < heartbeatState.config.nudgeCooldownMs) {
      console.log(`[Heartbeat] Skipping nudge for ${agentId} - cooldown active (${Math.round((heartbeatState.config.nudgeCooldownMs - elapsed) / 1000)}s remaining)`);
      return false;
    }
  }

  // Send PING command
  const command = `PING: ${isAuto ? 'Auto-' : ''}Heartbeat check from Activity Feed. Reply with your current status and what you're working on.`;
  enqueueCommand(agentId, command);

  // Update nudge tracking
  if (!heartbeatState.agents[agentId]) {
    heartbeatState.agents[agentId] = { lastSeen: null, lastNudge: null, nudgeCount: 0, status: 'unknown' };
  }
  heartbeatState.agents[agentId].lastNudge = now.toISOString();
  heartbeatState.agents[agentId].nudgeCount++;

  console.log(`[Heartbeat] Sent ${isAuto ? 'auto-' : ''}nudge to ${agentId} (total: ${heartbeatState.agents[agentId].nudgeCount})`);

  // Broadcast nudge event to dashboards
  broadcast({
    type: 'agent:nudged',
    agent: agentId,
    isAuto,
    nudgeCount: heartbeatState.agents[agentId].nudgeCount,
    timestamp: now.toISOString(),
  });

  return true;
}

// ─── Agent Registry ───────────────────────────────────────────────────────────

const REGISTRY_FILE = path.join(process.cwd(), 'data', 'agent-registry.json');

interface AgentRegistration {
  agentId: string;
  sessionId?: string;
  startedAt: string;
  status: 'online' | 'offline' | 'busy';
  cwd?: string;
}

interface AgentRegistry {
  description: string;
  agents: Record<string, AgentRegistration>;
  lastUpdated: string;
}

function loadAgentRegistry(): AgentRegistry {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
    }
  } catch {}
  return {
    description: 'Registry of active Halo agents',
    agents: {},
    lastUpdated: new Date().toISOString(),
  };
}

// Map of sessionId -> agentId from registry
function getRegisteredSessions(): Map<string, string> {
  const registry = loadAgentRegistry();
  const map = new Map<string, string>();
  for (const [agentId, reg] of Object.entries(registry.agents)) {
    if (reg.sessionId) {
      map.set(reg.sessionId, agentId);
    }
  }
  return map;
}

// ─── Configuration ─────────────────────────────────────────────────────────────

const WS_PORT = 3001;
const CLAUDE_PROJECTS_DIR = path.join(process.env.USERPROFILE || '', '.claude', 'projects');

// Watch multiple project directories for broader coverage
const PROJECT_DIRS = [
  path.join(CLAUDE_PROJECTS_DIR, 'C--Users-jackw-Desktop-SwjshAlgoKnife'),
  path.join(CLAUDE_PROJECTS_DIR, 'C--Users-jackw-Desktop'),
  path.join(CLAUDE_PROJECTS_DIR, 'C--Users-jackw'),
];
// Backwards compat - use first dir for logging
const SWJSH_PROJECT_DIR = PROJECT_DIRS[0];

// ─── Agent Definitions ─────────────────────────────────────────────────────────

const AGENT_DEFS: Record<string, { name: string; emoji: string; color: string }> = {
  chief:   { name: 'Chief',   emoji: '⚔️', color: '#808000' },
  hunter:  { name: 'Hunter',  emoji: '🎯', color: '#a855f7' },
  ops:     { name: 'Ops',     emoji: '📡', color: '#ffd700' },
  scout:   { name: 'Scout',   emoji: '🔭', color: '#22c55e' },
  arbiter: { name: 'Arbiter', emoji: '⚖️', color: '#cd7f32' },
  cortana: { name: 'Cortana', emoji: '🧠', color: '#06b6d4' },
  oracle:  { name: 'Oracle',  emoji: '🔮', color: '#9333ea' },
};

// ─── State ─────────────────────────────────────────────────────────────────────

const dashboards: Set<WebSocket> = new Set();
const agentConnections: Map<string, WebSocket> = new Map(); // agentId -> WebSocket
const agentSessions: Map<string, string> = new Map(); // sessionId -> agentId
const agentStatus: Map<string, { status: string; lastActivity: string }> = new Map();
const filePositions: Map<string, number> = new Map();
const fileWatchers: Map<string, fs.FSWatcher> = new Map();
let logIdCounter = 0;

// ─── WebSocket Server ──────────────────────────────────────────────────────────

const wss = new WebSocketServer({ port: WS_PORT });

console.log('═══════════════════════════════════════════════════════════');
console.log('  Activity Bridge - Claude Code → Activity Feed');
console.log('═══════════════════════════════════════════════════════════');
console.log(`WebSocket server: ws://localhost:${WS_PORT}`);
console.log('Watching directories:');
for (const dir of PROJECT_DIRS) {
  console.log(`  - ${dir}`);
}
console.log('');

wss.on('connection', (ws: WebSocket) => {
  console.log('[Bridge] New connection');
  let identified = false;

  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());

      // ─── Agent Identification ─────────────────────────────────────────
      if (!identified && (msg.type === 'agent:identify' || msg.type === 'agent:register')) {
        identified = true;
        const agentId = (msg.agent || msg.payload?.agent || '').toLowerCase();
        if (agentId && AGENT_DEFS[agentId]) {
          // Remove old connection if exists
          const oldWs = agentConnections.get(agentId);
          if (oldWs && oldWs !== ws) {
            oldWs.close(1000, 'Replaced by new connection');
          }

          agentConnections.set(agentId, ws);
          agentStatus.set(agentId, { status: 'online', lastActivity: new Date().toISOString() });

          // Update heartbeat
          if (heartbeatState.agents[agentId]) {
            heartbeatState.agents[agentId].lastSeen = new Date().toISOString();
            heartbeatState.agents[agentId].status = 'alive';
          }

          console.log(`[Bridge] Agent connected: ${agentId.toUpperCase()}`);

          // Notify dashboards
          broadcast({
            type: 'agent:status',
            agent: agentId,
            status: 'online',
            timestamp: new Date().toISOString(),
          });

          // Send any pending commands to the agent
          sendPendingCommands(agentId, ws);
          return;
        }
      }

      // ─── Dashboard Identification ─────────────────────────────────────
      if (!identified && (msg.type === 'dashboard:subscribe' || msg.type === 'subscribe' || msg.type === 'register')) {
        identified = true;
        dashboards.add(ws);
        console.log('[Bridge] Dashboard connected');
        sendInitialState(ws);
        return;
      }

      // If not yet identified, try to identify based on message type
      if (!identified) {
        if (msg.type?.startsWith('agent:')) {
          // It's an agent - but we don't know which one yet, buffer messages
          console.log('[Bridge] Unidentified agent message:', msg.type);
          return;
        }
        // Default to dashboard
        identified = true;
        dashboards.add(ws);
        console.log('[Bridge] Connection defaulted to dashboard');
        sendInitialState(ws);
      }

      // ─── Agent Messages ───────────────────────────────────────────────
      if (msg.type === 'agent:output' || msg.type === 'agent:log') {
        const agentId = (msg.agent || msg.payload?.agent || '').toLowerCase();
        if (agentId) {
          const line = msg.line || msg.payload?.line || '';
          const stream = msg.stream || msg.payload?.stream || 'stdout';
          const level = msg.level || (stream === 'stderr' ? 'error' : 'info');
          broadcastLog(agentId, line, level);
        }
        return;
      }

      if (msg.type === 'agent:status') {
        const agentId = (msg.agent || msg.payload?.agent || '').toLowerCase();
        const status = msg.status || msg.payload?.status;
        if (agentId && status) {
          agentStatus.set(agentId, { status, lastActivity: new Date().toISOString() });
          broadcast({
            type: 'agent:status',
            agent: agentId,
            status,
            timestamp: new Date().toISOString(),
          });
        }
        return;
      }

      if (msg.type === 'agent:permission' || msg.type === 'permission:request') {
        const payload = msg.payload || msg;
        const agentId = (payload.agent || '').toLowerCase();
        const id = payload.id || `perm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        broadcast({
          type: 'agent:permission',
          id,
          agent: agentId,
          tool: payload.tool,
          params: payload.params || {},
          prompt: payload.prompt || '',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // ─── Dashboard Messages (existing handlers) ───────────────────────
      // Handle command to single agent - route directly if connected
      if (msg.type === 'dashboard:command' && msg.agentId && msg.command) {
        const agentWs = agentConnections.get(msg.agentId.toLowerCase());
        if (agentWs && agentWs.readyState === WebSocket.OPEN) {
          // Route directly to agent via WebSocket
          agentWs.send(JSON.stringify({
            type: 'hub:command',
            command: msg.command,
            from: 'dashboard',
            timestamp: new Date().toISOString(),
          }));
          console.log(`[Bridge] Routed command directly to ${msg.agentId}`);
          // Also log it
          broadcastLog(msg.agentId, `[CMD] ${msg.command.substring(0, 200)}`, 'action');
        } else {
          // Fall back to file queue
          const entry = enqueueCommand(msg.agentId, msg.command);
          broadcast({
            type: 'command:queued',
            agentId: msg.agentId,
            commandId: entry.id,
            command: msg.command.substring(0, 100),
            timestamp: entry.createdAt,
          });
        }
        return;
      }

      // Handle broadcast to all agents
      if (msg.type === 'dashboard:broadcast' && msg.command) {
        let directCount = 0;
        const entries: CommandEntry[] = [];

        for (const agentId of ALL_AGENT_IDS) {
          const agentWs = agentConnections.get(agentId);
          if (agentWs && agentWs.readyState === WebSocket.OPEN) {
            agentWs.send(JSON.stringify({
              type: 'hub:command',
              command: msg.command,
              from: 'dashboard',
              timestamp: new Date().toISOString(),
            }));
            directCount++;
          } else {
            const entry = enqueueCommand(agentId, msg.command);
            entries.push(entry);
          }
        }

        broadcast({
          type: 'broadcast:queued',
          command: msg.command.substring(0, 100),
          agents: ALL_AGENT_IDS,
          directCount,
          queuedCount: entries.length,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Handle permission approval - route to agent if connected
      if (msg.type === 'dashboard:approve' && msg.id) {
        console.log(`[Bridge] Permission ${msg.approved ? 'approved' : 'denied'}: ${msg.id}`);

        // Try to route to connected agent
        for (const [agentId, agentWs] of agentConnections) {
          if (agentWs.readyState === WebSocket.OPEN) {
            agentWs.send(JSON.stringify({
              type: 'permission:response',
              payload: {
                requestId: msg.id,
                approved: msg.approved,
              },
            }));
          }
        }

        broadcast({
          type: 'permission:resolved',
          id: msg.id,
          approved: msg.approved,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Handle manual nudge request
      if (msg.type === 'dashboard:nudge' && msg.agentId) {
        const agentWs = agentConnections.get(msg.agentId.toLowerCase());
        if (agentWs && agentWs.readyState === WebSocket.OPEN) {
          agentWs.send(JSON.stringify({
            type: 'hub:command',
            command: 'PING: Dashboard heartbeat check. Reply with your current status.',
            from: 'dashboard',
            timestamp: new Date().toISOString(),
          }));
          console.log(`[Bridge] Nudge routed directly to ${msg.agentId}`);
        } else {
          sendNudge(msg.agentId, false);
        }
        return;
      }

      // Handle nudge all stale agents
      if (msg.type === 'dashboard:nudge_all') {
        for (const agentId of ALL_AGENT_IDS) {
          const agentState = heartbeatState.agents[agentId];
          const status = computeHeartbeatStatus(agentState?.lastSeen || null, heartbeatState.config);
          if (status === 'stale' || status === 'dead') {
            const agentWs = agentConnections.get(agentId);
            if (agentWs && agentWs.readyState === WebSocket.OPEN) {
              agentWs.send(JSON.stringify({
                type: 'hub:command',
                command: 'PING: Auto-nudge. Reply with status.',
                from: 'dashboard',
                timestamp: new Date().toISOString(),
              }));
            } else {
              sendNudge(agentId, false);
            }
          }
        }
        return;
      }

      // Handle heartbeat config update
      if (msg.type === 'dashboard:heartbeat_config' && msg.config) {
        heartbeatState.config = { ...heartbeatState.config, ...msg.config };
        saveHeartbeatState(heartbeatState);
        broadcast({
          type: 'heartbeat:config',
          config: heartbeatState.config,
          timestamp: new Date().toISOString(),
        });
        return;
      }

    } catch (e) {
      // Ignore parse errors
    }
  });

  ws.on('close', () => {
    // Check if it was a dashboard
    if (dashboards.has(ws)) {
      console.log('[Bridge] Dashboard disconnected');
      dashboards.delete(ws);
      return;
    }

    // Check if it was an agent
    for (const [agentId, agentWs] of agentConnections) {
      if (agentWs === ws) {
        console.log(`[Bridge] Agent disconnected: ${agentId.toUpperCase()}`);
        agentConnections.delete(agentId);
        agentStatus.set(agentId, { status: 'offline', lastActivity: new Date().toISOString() });
        broadcast({
          type: 'agent:status',
          agent: agentId,
          status: 'offline',
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }
  });
});

function sendPendingCommands(agentId: string, ws: WebSocket) {
  const filePath = path.join(COMMAND_DIR, `${agentId.toLowerCase()}.json`);
  try {
    if (!fs.existsSync(filePath)) return;
    const queue: CommandQueue = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const pending = queue.commands.filter(c => c.status === 'pending');

    for (const cmd of pending) {
      ws.send(JSON.stringify({
        type: 'hub:command',
        command: cmd.command,
        commandId: cmd.id,
        from: 'dashboard',
        timestamp: cmd.createdAt,
      }));
      cmd.status = 'executing';
    }

    if (pending.length > 0) {
      queue.lastUpdated = new Date().toISOString();
      fs.writeFileSync(filePath, JSON.stringify(queue, null, 2));
      console.log(`[Bridge] Sent ${pending.length} pending commands to ${agentId}`);
    }
  } catch (err) {
    console.error(`[Bridge] Error sending pending commands to ${agentId}:`, err);
  }
}

function sendInitialState(ws: WebSocket) {
  const agents = Object.entries(AGENT_DEFS).map(([id, def]) => ({
    name: id,
    displayName: def.name,
    status: agentConnections.has(id) ? 'online' : (agentStatus.get(id)?.status || 'offline'),
    connectedAt: agentStatus.get(id)?.lastActivity || new Date().toISOString(),
    directConnection: agentConnections.has(id),
  }));

  const state = {
    type: 'hub:state',
    agents,
    pendingPermissions: [],
    recentActivity: [],
  };

  ws.send(JSON.stringify(state));

  // Send heartbeat state
  const heartbeatData = {
    type: 'heartbeat:state',
    agents: heartbeatState.agents,
    config: heartbeatState.config,
    timestamp: new Date().toISOString(),
  };
  ws.send(JSON.stringify(heartbeatData));

  console.log('[Bridge] Sent initial state + heartbeat to dashboard');
}

// ─── Broadcast to Dashboards ───────────────────────────────────────────────────

function broadcast(message: any) {
  const data = JSON.stringify(message);
  for (const ws of dashboards) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

function broadcastLog(agentId: string, text: string, level: string = 'info') {
  const timestamp = new Date().toISOString();
  logIdCounter++;

  // Update agent status
  agentStatus.set(agentId, { status: 'busy', lastActivity: timestamp });

  // Update heartbeat - agent is alive
  if (heartbeatState.agents[agentId]) {
    heartbeatState.agents[agentId].lastSeen = timestamp;
    heartbeatState.agents[agentId].status = 'alive';
  }

  // Persist to activity-feed.json
  const logLevel = level === 'action' ? 'info' : (level as 'info' | 'warn' | 'error' | 'debug');
  addLogEntry(agentId, text, logLevel);
  addStatusEntry(agentId, 'online');

  // Broadcast status change
  broadcast({
    type: 'agent:status',
    agent: agentId,
    status: 'online',
    timestamp,
  });

  // Broadcast log
  broadcast({
    type: 'agent:log',
    agent: agentId,
    line: text,
    level,
    timestamp,
    logId: `log-${logIdCounter}`,
  });

  console.log(`[${agentId.toUpperCase()}] ${text.substring(0, 80)}...`);
}

// ─── Agent Detection ───────────────────────────────────────────────────────────

// Broad patterns to detect agent type from session content
function detectAgent(content: string): string | null {
  const patterns: Record<string, RegExp> = {
    // Explicit terminal/agent identifiers
    chief:   /Terminal 1.*Chief|agent-mgmt\.md|MGMT Agent|Chief.*Command|management|orchestrat/i,
    hunter:  /Terminal 2.*Hunter|agent-hunter\.md|agent-infra\.md|INFRA Agent|Hunter.*Bug|bug.*hunt|debug|fix.*error/i,
    ops:     /Terminal 3.*Ops|agent-scrum\.md|SCRUM Agent|Ops.*Core|scrum|sprint|task|hourly.*audit|sync|status/i,
    scout:   /Terminal 4.*Scout|agent-back\.md|BACK Agent|Scout.*Research|research|explore|search|investigate/i,
    arbiter: /Terminal 5.*Arbiter|agent-pulse\.md|PULSE Agent|Arbiter.*Health|health.*check|monitor|pulse|validation/i,
    cortana: /Terminal 6.*Cortana|agent-learn\.md|agent-grade\.md|LEARN Agent|GRADE Agent|Cortana.*Pattern|learn|grade|pattern|review/i,
    oracle:  /Terminal 7.*Oracle|oracle[\/\\]CLAUDE\.md|SAGE Agent|Oracle.*Knowledge|knowledge|intel|scoring|validation|source.*reliability/i,
  };

  for (const [agent, pattern] of Object.entries(patterns)) {
    if (pattern.test(content)) {
      return agent;
    }
  }
  return null;
}

// Detect agent from tool activity (file paths, commands)
function detectAgentFromActivity(toolName: string, input: Record<string, unknown>): string | null {
  const inputStr = JSON.stringify(input).toLowerCase();

  // Detect from file paths being accessed
  if (inputStr.includes('agent-mgmt') || inputStr.includes('management')) return 'chief';
  if (inputStr.includes('agent-hunter') || inputStr.includes('debug') || inputStr.includes('bug')) return 'hunter';
  if (inputStr.includes('agent-scrum') || inputStr.includes('scrum') || inputStr.includes('audit')) return 'ops';
  if (inputStr.includes('agent-back') || inputStr.includes('research')) return 'scout';
  if (inputStr.includes('agent-pulse') || inputStr.includes('health')) return 'arbiter';
  if (inputStr.includes('agent-learn') || inputStr.includes('lesson') || inputStr.includes('grade')) return 'cortana';

  return null;
}

// STRICT agent detection - only matches explicit Halo agent identifiers from LAUNCH_AGENTS.ps1
// This ensures we only show the 7 VS Code terminals, not random Claude sessions
function detectAgentStrict(content: string): string | null {
  // Must match the exact format from LAUNCH_AGENTS.ps1:
  // "Terminal 1: Chief" or "halo-crew/agents/chief/CLAUDE.md"
  const strictPatterns: Record<string, RegExp> = {
    chief:   /Terminal 1[:\s]+Chief|halo-crew[\/\\]agents[\/\\]chief[\/\\]CLAUDE\.md/i,
    hunter:  /Terminal 2[:\s]+Hunter|halo-crew[\/\\]agents[\/\\]hunter[\/\\]CLAUDE\.md/i,
    ops:     /Terminal 3[:\s]+Ops|halo-crew[\/\\]agents[\/\\]ops[\/\\]CLAUDE\.md/i,
    scout:   /Terminal 4[:\s]+Scout|halo-crew[\/\\]agents[\/\\]scout[\/\\]CLAUDE\.md/i,
    arbiter: /Terminal 5[:\s]+Arbiter|halo-crew[\/\\]agents[\/\\]arbiter[\/\\]CLAUDE\.md/i,
    cortana: /Terminal 6[:\s]+Cortana|halo-crew[\/\\]agents[\/\\]cortana[\/\\]CLAUDE\.md/i,
    oracle:  /Terminal 7[:\s]+Oracle|halo-crew[\/\\]agents[\/\\]oracle[\/\\]CLAUDE\.md/i,
  };

  for (const [agent, pattern] of Object.entries(strictPatterns)) {
    if (pattern.test(content)) {
      return agent;
    }
  }
  return null;
}

// ─── Session Log Parsing ───────────────────────────────────────────────────────

function parseSessionLine(line: string, sessionId: string): void {
  try {
    const event = JSON.parse(line);
    let agentId = agentSessions.get(sessionId) || 'unknown';

    // Check if this session is registered in the agent registry
    const registeredSessions = getRegisteredSessions();
    if (registeredSessions.has(sessionId)) {
      const registeredAgent = registeredSessions.get(sessionId)!;
      if (agentId === 'unknown') {
        agentSessions.set(sessionId, registeredAgent);
        agentId = registeredAgent;
        console.log(`[Bridge] Using registered agent: ${registeredAgent} for session ${sessionId.substring(0, 8)}`);
      }
    }

    // Detect agent from user message - try STRICT first, then fall back to BROAD detection
    if (agentId === 'unknown' && event.type === 'user' && event.message?.content) {
      const content = typeof event.message.content === 'string'
        ? event.message.content
        : JSON.stringify(event.message.content);

      // Try strict patterns first (explicit Terminal identifiers)
      let detected = detectAgentStrict(content);

      // Fall back to broad keyword-based detection
      if (!detected) {
        detected = detectAgent(content);
      }

      if (detected) {
        agentSessions.set(sessionId, detected);
        agentId = detected;
        console.log(`[Bridge] Detected Halo agent: ${detected} for session ${sessionId.substring(0, 8)}`);

        // Broadcast initial log
        broadcastLog(agentId, `Session started: ${content.substring(0, 100)}`, 'action');
      }
    }

    // Fall back to 'chief' for unidentified sessions so we still capture activity
    if (agentId === 'unknown') {
      agentId = 'chief'; // Default to Chief for general sessions
      agentSessions.set(sessionId, agentId);
      console.log(`[Bridge] Assigning unidentified session ${sessionId.substring(0, 8)} to Chief (default)`);
    }

    // Handle different event types
    if (event.type === 'user' && event.message?.content) {
      let text = '';
      const content = event.message.content;

      if (typeof content === 'string') {
        text = content.substring(0, 500);
      } else if (Array.isArray(content)) {
        // Extract text from content array (handles multi-part messages)
        const textParts = content
          .filter((c: any) => c.type === 'text' && c.text)
          .map((c: any) => c.text)
          .join(' ');
        text = textParts.substring(0, 500) || 'Multi-part input';
      } else if (typeof content === 'object' && content !== null) {
        // Object content - try to extract text field
        const obj = content as Record<string, unknown>;
        text = (obj.text || obj.message || obj.content || JSON.stringify(content).substring(0, 200)) as string;
      } else {
        text = 'Input received';
      }

      // Skip logging empty or trivial messages
      if (text.length > 10) {
        broadcastLog(agentId, `[USER] ${text}`, 'action');
      }
    }

    if (event.type === 'assistant' && event.message?.content) {
      const content = event.message.content;

      if (Array.isArray(content)) {
        // Check for text content
        const textParts = content.filter((c: any) => c.type === 'text');
        for (const part of textParts) {
          if (part.text) {
            broadcastLog(agentId, part.text.substring(0, 300), 'info');
          }
        }

        // Check for tool use
        const toolUses = content.filter((c: any) => c.type === 'tool_use');
        for (const tool of toolUses) {
          const toolName = tool.name;
          const input = JSON.stringify(tool.input || {}).substring(0, 200);
          broadcastLog(agentId, `[TOOL] ${toolName}: ${input}`, 'action');
        }
      }
    }

    if (event.type === 'tool_result' || event.type === 'tool') {
      const success = !event.is_error;
      broadcastLog(agentId, `[RESULT] ${success ? 'Success' : 'Failed'}`, success ? 'success' : 'error');
    }

  } catch (e) {
    // Ignore parse errors
  }
}

// ─── File Watching ─────────────────────────────────────────────────────────────

function watchSessionFile(filePath: string) {
  const sessionId = path.basename(filePath, '.jsonl');

  if (fileWatchers.has(filePath)) return;

  console.log(`[Bridge] Watching session: ${sessionId.substring(0, 8)}...`);

  // Get current file size
  try {
    const stats = fs.statSync(filePath);
    filePositions.set(filePath, stats.size);
  } catch {
    filePositions.set(filePath, 0);
  }

  // Read first few lines to detect agent
  readInitialLines(filePath, sessionId);

  // Watch for changes
  const watcher = fs.watch(filePath, (eventType) => {
    if (eventType === 'change') {
      readNewContent(filePath, sessionId);
    }
  });

  fileWatchers.set(filePath, watcher);
}

async function readInitialLines(filePath: string, sessionId: string) {
  try {
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream });
    let lineCount = 0;

    for await (const line of rl) {
      if (lineCount > 20) break;

      try {
        const event = JSON.parse(line);
        if (event.type === 'user' && event.message?.content) {
          const content = typeof event.message.content === 'string'
            ? event.message.content
            : JSON.stringify(event.message.content);
          const agent = detectAgent(content);
          if (agent) {
            agentSessions.set(sessionId, agent);
            agentStatus.set(agent, { status: 'online', lastActivity: new Date().toISOString() });
            console.log(`[Bridge] Session ${sessionId.substring(0, 8)} is ${agent.toUpperCase()}`);

            // Broadcast status update to any connected dashboards
            broadcast({
              type: 'agent:status',
              agent,
              status: 'online',
              timestamp: new Date().toISOString(),
            });
            break;
          }
        }
      } catch {}
      lineCount++;
    }

    rl.close();
    stream.destroy();
  } catch (err) {
    console.error(`[Bridge] Error reading ${filePath}:`, err);
  }
}

function readNewContent(filePath: string, sessionId: string) {
  const lastPos = filePositions.get(filePath) || 0;

  try {
    const stats = fs.statSync(filePath);
    if (stats.size <= lastPos) return;

    const stream = fs.createReadStream(filePath, {
      encoding: 'utf8',
      start: lastPos,
    });

    let buffer = '';

    stream.on('data', (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          parseSessionLine(line, sessionId);
        }
      }
    });

    stream.on('end', () => {
      filePositions.set(filePath, stats.size);
    });

    stream.on('error', (err) => {
      console.error(`[Bridge] Stream error:`, err);
    });

  } catch (err) {
    console.error(`[Bridge] File access error:`, err);
  }
}

function scanForSessions() {
  const now = Date.now();
  const tenMinutesAgo = now - (10 * 60 * 1000);

  for (const projectDir of PROJECT_DIRS) {
    try {
      if (!fs.existsSync(projectDir)) {
        continue; // Skip non-existent directories
      }

      const files = fs.readdirSync(projectDir);

      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;

        const filePath = path.join(projectDir, file);

        try {
          const stats = fs.statSync(filePath);
          if (stats.mtimeMs > tenMinutesAgo) {
            watchSessionFile(filePath);
          }
        } catch {}
      }
    } catch (err) {
      console.error(`[Bridge] Scan error for ${projectDir}:`, err);
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

// Initial scan
scanForSessions();

// Rescan every 10 seconds
setInterval(scanForSessions, 10000);

// Heartbeat check - every 30 seconds
setInterval(() => {
  const count = dashboards.size;
  console.log(`[Bridge] ${count} dashboard(s) connected, ${agentSessions.size} sessions tracked, ${agentConnections.size} agent(s) directly connected`);

  // Compute and broadcast heartbeat status for each agent
  const now = new Date().toISOString();
  for (const agentId of ALL_AGENT_IDS) {
    const agentState = heartbeatState.agents[agentId];
    if (!agentState) continue;

    // Check if agent has a direct WebSocket connection
    if (agentConnections.has(agentId) && agentConnections.get(agentId)!.readyState === WebSocket.OPEN) {
      agentState.lastSeen = new Date().toISOString();
      agentState.status = 'alive';
    }

    const prevStatus = agentState.status;
    const newStatus = computeHeartbeatStatus(agentState.lastSeen, heartbeatState.config);
    agentState.status = newStatus;

    // Broadcast heartbeat status to dashboards
    broadcast({
      type: 'agent:heartbeat',
      agent: agentId,
      status: newStatus,
      lastSeen: agentState.lastSeen,
      nudgeCount: agentState.nudgeCount,
      lastNudge: agentState.lastNudge,
      timestamp: now,
    });

    // Auto-nudge if enabled and agent just became stale
    if (heartbeatState.config.autoNudgeEnabled && newStatus === 'stale' && prevStatus === 'alive') {
      console.log(`[Heartbeat] ${agentId} became stale - sending auto-nudge`);
      sendNudge(agentId, true);
    }
  }

  // Save heartbeat state to disk
  saveHeartbeatState(heartbeatState);

  // Flush activity log to disk periodically
  flushActivityLog();
}, 30000);

console.log('');
console.log('[Bridge] Running. Press Ctrl+C to stop.');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
