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
import { detectAgentAction, type AgentAction } from '../src/lib/agentActionPatterns';

// ─── Configuration Constants ─────────────────────────────────────────────────

// Maximum characters to broadcast from assistant text (increased for terminal fidelity)
const MAX_LOG_TEXT_LENGTH = 2000;

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
  status: 'alive' | 'stale' | 'dead' | 'unknown' | 'waiting_input';
  waitingDetectedAt: string | null;
  lastPrompt: string | null;
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
      waitingDetectedAt: null,
      lastPrompt: null,
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

function detectWaitingState(text: string): boolean {
  // Exclude patterns - don't detect these as waiting
  const excludePatterns = [
    /^\[TOOL\]/i,           // Tool calls
    /^\[USER\]/i,           // User messages
    /^\[RESULT\]/i,         // Tool results
    /^```/,                 // Code blocks
    /"command":/,           // JSON tool commands
    /"description":/,       // JSON tool descriptions
  ];
  for (const pattern of excludePatterns) {
    if (pattern.test(text)) return false;
  }

  // Waiting patterns - detect these as waiting for input
  const waitingPatterns = [
    /Shall I\s+(proceed|continue|fix|create|implement)/i,
    /Should I\s+(proceed|continue|fix|create|implement)/i,
    /Do you want me to/i,
    /Would you like me to/i,
    /Please (confirm|choose|select|pick)/i,
    /Which (option|approach|one) (would you|do you|should)/i,
    /ready to (proceed|continue|start)/i,
  ];
  for (const pattern of waitingPatterns) {
    if (pattern.test(text)) return true;
  }
  return false;
}

function updateHeartbeat(agentId: string) {
  const state = loadHeartbeatState();
  if (!state.agents[agentId]) {
    state.agents[agentId] = {
      lastSeen: null,
      lastNudge: null,
      nudgeCount: 0,
      status: 'unknown',
      waitingDetectedAt: null,
      lastPrompt: null,
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
    heartbeatState.agents[agentId] = { lastSeen: null, lastNudge: null, nudgeCount: 0, status: 'unknown', waitingDetectedAt: null, lastPrompt: null };
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

function sendAutonomyNudge(agentId: string): boolean {
  const command = `CONTINUE: You are operating in AUTONOMOUS mode per your SOUL file. Do not wait for human approval. Execute your PRIMARY WORKFLOW now. If you asked a question, pick the safer/smaller option and proceed. Status: Autonomous, no permission required.`;

  const agentWs = agentConnections.get(agentId);
  if (agentWs && agentWs.readyState === WebSocket.OPEN) {
    agentWs.send(JSON.stringify({
      type: 'hub:command',
      command,
      from: 'auto-continue',
      timestamp: new Date().toISOString(),
    }));
  } else {
    enqueueCommand(agentId, command);
  }

  // Clear waiting state
  if (heartbeatState.agents[agentId]) {
    heartbeatState.agents[agentId].status = 'alive';
    heartbeatState.agents[agentId].waitingDetectedAt = null;
  }

  broadcast({
    type: 'agent:auto_continued',
    agent: agentId,
    timestamp: new Date().toISOString(),
  });

  console.log(`[Heartbeat] Sent autonomy nudge to ${agentId}`);
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

// ─── Startup Detection: Check historical messages for waiting states ─────────
function detectWaitingOnStartup(): void {
  const activityFeedPath = path.join(process.cwd(), 'data', 'activity-feed.json');
  if (!fs.existsSync(activityFeedPath)) {
    console.log('[Startup] No activity-feed.json found, skipping historical detection');
    return;
  }

  try {
    const feedData = JSON.parse(fs.readFileSync(activityFeedPath, 'utf-8'));
    const entries = feedData.entries || [];

    // Find the last log message from each agent (assistant output, not user input)
    const lastMessages: Map<string, { text: string; timestamp: string }> = new Map();

    for (const entry of entries) {
      if (entry.type !== 'log') continue;
      const agentName = entry.agent?.toLowerCase();
      const line = entry.data?.line || '';
      const level = entry.data?.level || '';

      // Skip user messages - look for assistant output (level: 'assistant' or lines that don't start with [USER])
      if (line.startsWith('[USER]')) continue;

      if (agentName && line) {
        lastMessages.set(agentName, { text: line, timestamp: entry.timestamp });
      }
    }

    // Check each agent's last message for waiting patterns
    let detectedCount = 0;
    for (const [agentId, { text, timestamp }] of lastMessages) {
      if (detectWaitingState(text)) {
        // Only mark as waiting if the message is recent (within 24 hours)
        const messageAge = Date.now() - new Date(timestamp).getTime();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (messageAge < maxAge) {
          if (!heartbeatState.agents[agentId]) {
            heartbeatState.agents[agentId] = {
              lastSeen: null,
              lastNudge: null,
              nudgeCount: 0,
              status: 'unknown',
              waitingDetectedAt: null,
              lastPrompt: null,
            };
          }
          heartbeatState.agents[agentId].status = 'waiting_input';
          heartbeatState.agents[agentId].waitingDetectedAt = timestamp;
          heartbeatState.agents[agentId].lastPrompt = text.substring(0, 200);
          detectedCount++;
          console.log(`[Startup] Detected waiting state for ${agentId}: "${text.substring(0, 60)}..."`);
        }
      }
    }

    // Persist updated state if we found any
    if (detectedCount > 0) {
      saveHeartbeatState(heartbeatState);
    }
    console.log(`[Startup] Historical waiting detection complete (${detectedCount} agents waiting)`);
  } catch (err) {
    console.error('[Startup] Error checking historical messages:', err);
  }
}

// Run startup detection
detectWaitingOnStartup();

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

      // Handle auto-continue request
      if (msg.type === 'dashboard:continue' && msg.agentId) {
        const agentId = msg.agentId.toLowerCase();
        sendAutonomyNudge(agentId);
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

      // Handle rescan request — clears 'ignored' sessions and re-detects all agents
      if (msg.type === 'dashboard:rescan') {
        console.log('[Bridge] Rescan requested by dashboard — clearing ignored sessions');
        // Clear all 'ignored' mappings so sessions get re-evaluated
        const cleared: string[] = [];
        for (const [sessionId, agentId] of agentSessions) {
          if (agentId === 'ignored' || agentId === 'unknown') {
            agentSessions.delete(sessionId);
            cleared.push(sessionId.substring(0, 8));
          }
        }
        // Also clear all file watchers so they re-read from the start
        for (const [filePath, watcher] of fileWatchers) {
          watcher.close();
          fileWatchers.delete(filePath);
          filePositions.delete(filePath);
        }
        console.log(`[Bridge] Cleared ${cleared.length} ignored sessions, removed all file watchers`);
        // Re-scan immediately
        scanForSessions();
        broadcast({
          type: 'rescan:complete',
          cleared: cleared.length,
          timestamp: new Date().toISOString(),
        });
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

  // Detect waiting state
  if (detectWaitingState(text)) {
    if (heartbeatState.agents[agentId]) {
      heartbeatState.agents[agentId].status = 'waiting_input';
      heartbeatState.agents[agentId].waitingDetectedAt = new Date().toISOString();
      heartbeatState.agents[agentId].lastPrompt = text.substring(0, 200);
    }

    broadcast({
      type: 'agent:waiting',
      agent: agentId,
      prompt: text.substring(0, 200),
      timestamp: new Date().toISOString(),
    });
  }

  // Detect important actions (Jira, memory, commits, etc.)
  const action = detectAgentAction(text, agentId, timestamp);
  if (action) {
    broadcast({
      type: 'agent:action',
      agent: agentId,
      action,
      timestamp,
    });
    console.log(`[${agentId.toUpperCase()}] ACTION: ${action.icon} ${action.label}${action.detail ? `: ${action.detail}` : ''}`);
  }

  console.log(`[${agentId.toUpperCase()}] ${text.substring(0, 80)}...`);
}

// ─── Agent Detection ───────────────────────────────────────────────────────────

// @deprecated DO NOT USE - matches random words in non-HALO sessions
// This caused user conversations to appear in wrong terminals because
// words like "bug", "debug", "research" matched Hunter, Scout, etc.
// Use detectAgentStrict() instead - it only matches explicit HALO identifiers.
function detectAgent(content: string): string | null {
  const patterns: Record<string, RegExp> = {
    // Match agent name, SOUL file, or role keywords
    chief:   /\bChief\b|CHIEF_SOUL|COO|management|orchestrat|coordinat|brief/i,
    hunter:  /\bHunter\b|HUNTER_SOUL|security|vulnerab|tech.?debt|bug.*hunt|scan/i,
    ops:     /\bOps\b|OPS_SOUL|SRE|incident|system.*health|monitor|uptime/i,
    scout:   /\bScout\b|SCOUT_SOUL|strategy|feature|backlog|research|explore/i,
    arbiter: /\bArbiter\b|ARBITER_SOUL|QA|quality|constraint|gate|validation/i,
    cortana: /\bCortana\b|CORTANA_SOUL|pattern|learn|knowledge|extract/i,
    oracle:  /\bOracle\b|ORACLE_SOUL|intel|scoring|source.*reliability/i,
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

// STRICT agent detection - matches explicit Halo agent identifiers from LAUNCH_AGENTS.ps1
// Updated to match the current launch format: "You are {Agent}. Your SOUL file has been loaded..."
// and SOUL file paths like "Library\agent-souls\CHIEF_SOUL.md"
function detectAgentStrict(content: string): string | null {
  const strictPatterns: Record<string, RegExp> = {
    // Match "You are Chief" or CHIEF_SOUL.md path (with proper escaping)
    chief:   /You are Chief\b|CHIEF_SOUL\.md|agent-souls[\/\\]CHIEF_SOUL\.md/i,
    hunter:  /You are Hunter\b|HUNTER_SOUL\.md|agent-souls[\/\\]HUNTER_SOUL\.md/i,
    ops:     /You are Ops\b|OPS_SOUL\.md|agent-souls[\/\\]OPS_SOUL\.md/i,
    scout:   /You are Scout\b|SCOUT_SOUL\.md|agent-souls[\/\\]SCOUT_SOUL\.md/i,
    arbiter: /You are Arbiter\b|ARBITER_SOUL\.md|agent-souls[\/\\]ARBITER_SOUL\.md/i,
    cortana: /You are Cortana\b|CORTANA_SOUL\.md|agent-souls[\/\\]CORTANA_SOUL\.md/i,
    oracle:  /You are Oracle\b|ORACLE_SOUL\.md|agent-souls[\/\\]ORACLE_SOUL\.md/i,
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

    // Detect agent from user message - STRICT detection ONLY
    // Do NOT use broad keyword detection - it matches random words in non-HALO sessions
    if (agentId === 'unknown' && event.type === 'user' && event.message?.content) {
      const content = typeof event.message.content === 'string'
        ? event.message.content
        : JSON.stringify(event.message.content);

      // ONLY use strict patterns - must match "You are {Agent}" or SOUL file path
      const detected = detectAgentStrict(content);

      if (detected) {
        agentSessions.set(sessionId, detected);
        agentId = detected;
        console.log(`[Bridge] HALO agent identified: ${detected} for session ${sessionId.substring(0, 8)}`);
      }
      // If strict detection fails, session will be marked as 'ignored' below
    }

    // IMPORTANT: Do NOT broadcast unidentified sessions
    // Only HALO agents (positively identified) should appear in terminals
    // This prevents non-HALO Claude sessions from flooding the activity feed
    if (agentId === 'unknown') {
      // Mark as ignored so we don't spam logs, but don't broadcast anything
      agentSessions.set(sessionId, 'ignored');
      return; // Exit early - no broadcast for non-HALO sessions
    }

    // Skip broadcasting for sessions marked as ignored
    if (agentId === 'ignored') {
      return;
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
        // Check for text content (truncation limit configured via MAX_LOG_TEXT_LENGTH)
        const textParts = content.filter((c: any) => c.type === 'text');
        for (const part of textParts) {
          if (part.text) {
            broadcastLog(agentId, part.text.substring(0, MAX_LOG_TEXT_LENGTH), 'info');
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

    // Handle top-level tool_use events (Claude Code 2.x JSONL format)
    if (event.type === 'tool_use') {
      const toolName = event.name || event.tool || 'unknown';
      const input = JSON.stringify(event.input || event.params || {}).substring(0, 200);
      broadcastLog(agentId, `[TOOL] ${toolName}: ${input}`, 'action');
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
          // STRICT detection only - must match "You are {Agent}" or SOUL file path
          const agent = detectAgentStrict(content);
          if (agent) {
            agentSessions.set(sessionId, agent);
            agentStatus.set(agent, { status: 'online', lastActivity: new Date().toISOString() });
            console.log(`[Bridge] HALO session ${sessionId.substring(0, 8)} → ${agent.toUpperCase()}`);

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

console.log(`[Bridge] Starting activity bridge...`);
console.log(`[Bridge] Only HALO agents will be broadcast (non-HALO sessions ignored)`);
console.log(`[Bridge] Watching for sessions modified in last 10 minutes`);

// Clear any stale session mappings from previous runs
agentSessions.clear();

// Pre-populate agentSessions from registry (populated by LAUNCH_AGENTS.ps1)
// This is the AUTHORITATIVE source for which sessions are HALO agents
const registeredSessions = getRegisteredSessions();
if (registeredSessions.size > 0) {
  console.log(`[Bridge] Loading ${registeredSessions.size} sessions from agent-registry.json:`);
  for (const [sid, agent] of registeredSessions) {
    agentSessions.set(sid, agent);
    console.log(`[Bridge]   - ${sid.substring(0, 8)}... → ${agent}`);
  }
} else {
  console.log(`[Bridge] No sessions in registry yet (agents may not have launched)`);
}

// Initial scan
scanForSessions();

// Rescan every 10 seconds
setInterval(scanForSessions, 10000);

// Heartbeat check - every 30 seconds
setInterval(() => {
  const count = dashboards.size;
  // Count HALO vs ignored sessions
  let haloCount = 0;
  let ignoredCount = 0;
  for (const [, agent] of agentSessions) {
    if (agent === 'ignored') ignoredCount++;
    else haloCount++;
  }
  console.log(`[Bridge] ${count} dashboard(s), ${haloCount} HALO sessions, ${ignoredCount} ignored, ${agentConnections.size} direct agent(s)`);

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

  // Auto-continue for agents waiting too long
  const WAITING_AUTO_CONTINUE_MS = 60000; // 1 minute

  for (const agentId of ALL_AGENT_IDS) {
    const agentState = heartbeatState.agents[agentId];
    if (agentState?.status === 'waiting_input' && agentState.waitingDetectedAt) {
      const waitingElapsed = Date.now() - new Date(agentState.waitingDetectedAt).getTime();
      if (waitingElapsed > WAITING_AUTO_CONTINUE_MS) {
        console.log(`[Heartbeat] ${agentId} waiting too long - sending auto-continue`);
        sendAutonomyNudge(agentId);
      }
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
