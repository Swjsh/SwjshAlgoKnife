# WebSocket Terminal Mirroring System — Full Investigation

> **Author**: Claude (Halo Session)
> **Date**: 2026-03-22
> **Status**: ~80% Working — gaps identified, fixes recommended
> **Scope**: Complete data-flow trace from Claude Code agent terminals → Activity Bridge → WebSocket → Browser dashboard terminals

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Component Deep-Dive](#3-component-deep-dive)
   - 3.1 [LAUNCH_HALO_SYSTEM.ps1 — Master Launcher](#31-launch_halo_systemps1--master-launcher)
   - 3.2 [LAUNCH_AGENTS.ps1 — Agent Spawner](#32-launch_agentsps1--agent-spawner)
   - 3.3 [activity-bridge.ts — WebSocket Server (Port 3001)](#33-activity-bridgets--websocket-server-port-3001)
   - 3.4 [activity-hub.ts — Alternative Hub Class](#34-activity-hubts--alternative-hub-class)
   - 3.5 [agent-proxy.ts — Direct Agent-to-Hub Relay](#35-agent-proxyts--direct-agent-to-hub-relay)
   - 3.6 [activity-log.ts — Persistence Layer](#36-activity-logts--persistence-layer)
   - 3.7 [useActivityFeed.ts — Browser WebSocket Client](#37-useactivityfeedts--browser-websocket-client)
   - 3.8 [AgentTerminal.tsx — Terminal Rendering](#38-agentterminaltsxs--terminal-rendering)
4. [Message Protocol Reference](#4-message-protocol-reference)
5. [Data Flow Traces](#5-data-flow-traces)
   - 5.1 [Path A: JSONL Session File Watching (Current Primary)](#51-path-a-jsonl-session-file-watching-current-primary)
   - 5.2 [Path B: Direct Agent Proxy WebSocket](#52-path-b-direct-agent-proxy-websocket)
   - 5.3 [Path C: Dashboard → Agent Commands](#53-path-c-dashboard--agent-commands)
   - 5.4 [Path D: Permission Request Lifecycle](#54-path-d-permission-request-lifecycle)
6. [Heartbeat & Health Monitoring](#6-heartbeat--health-monitoring)
7. [Log Throttling & Buffer System](#7-log-throttling--buffer-system)
8. [What's Working (The 80%)](#8-whats-working-the-80)
9. [What's Broken / Missing (The 20%)](#9-whats-broken--missing-the-20)
10. [Recommended Fixes](#10-recommended-fixes)
11. [File Index](#11-file-index)

---

## 1. System Overview

The WebSocket terminal mirroring system creates a real-time bridge between **6 Claude Code agent sessions** (running in Windows Terminal tabs) and a **browser-based Activity Feed dashboard** at `http://localhost:3000/activity-feed`. The goal is to mirror each agent's terminal output into individual browser terminal panels, just like watching 6 real terminals simultaneously.

### Key Players

| Component | Location | Port | Role |
|-----------|----------|------|------|
| **Activity Bridge** | `scripts/activity-bridge.ts` | **3001** | Central WebSocket hub — routes all messages |
| **Next.js Dashboard** | `src/app/activity-feed/page.tsx` | **3000** | Browser UI with 6 terminal panels |
| **Agent Proxy** | `scripts/agent-proxy.ts` | connects to 3001 | Optional direct relay for overnight agents |
| **JSONL Session Files** | `~/.claude/projects/.../` | N/A | Claude Code writes session logs here |
| **Activity Log** | `src/lib/activity-log.ts` | N/A | Persistent JSON storage layer |

### The Two Input Paths

The system has **two ways** agent output reaches the dashboard:

1. **File-watching path** (primary): The bridge watches `.jsonl` session transcript files that Claude Code writes to `~/.claude/projects/`. When a file changes, the bridge reads new lines, parses them, detects which agent it belongs to, and broadcasts the content via WebSocket.

2. **Direct WebSocket path** (agent-proxy): An agent-proxy process connects directly to port 3001, sends `agent:identify`, and relays stdin/stdout as `agent:output` messages. This is used for overnight/batch agents.

---

## 2. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  WINDOWS TERMINAL (6 Tabs)                                       │
│                                                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ Chief   │ │ Hunter  │ │  Ops    │ │ Scout   │ │ Arbiter │  │
│  │ Claude  │ │ Claude  │ │ Claude  │ │ Claude  │ │ Claude  │  │
│  │ Code    │ │ Code    │ │ Code    │ │ Code    │ │ Code    │  │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘  │
│       │           │           │           │           │         │
│       ▼           ▼           ▼           ▼           ▼         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ~/.claude/projects/<project-hash>/*.jsonl              │    │
│  │  (Claude Code writes JSONL transcripts per session)     │    │
│  └────────────────────────┬────────────────────────────────┘    │
└───────────────────────────┼──────────────────────────────────────┘
                            │ fs.watch + fs.createReadStream
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│  ACTIVITY BRIDGE  (scripts/activity-bridge.ts)                    │
│  WebSocket Server on port 3001                                    │
│                                                                   │
│  ┌─────────────────┐   ┌────────────────────┐                    │
│  │ File Watcher    │   │ Agent Detection     │                    │
│  │ scanForSessions │──▶│ detectAgent()       │                    │
│  │ (every 10s)     │   │ detectAgentStrict() │                    │
│  └────────┬────────┘   └────────┬────────────┘                    │
│           │                     │                                  │
│           ▼                     ▼                                  │
│  ┌─────────────────────────────────────────┐                      │
│  │ parseSessionLine()                      │                      │
│  │ Extracts: user messages, assistant text,│                      │
│  │ tool calls, tool results, permissions   │                      │
│  └────────────────┬────────────────────────┘                      │
│                   │                                                │
│                   ▼                                                │
│  ┌─────────────────────────────────────────┐                      │
│  │ broadcastLog(agentId, text, level)      │                      │
│  │  → addLogEntry() to activity-feed.json  │                      │
│  │  → broadcast agent:log to dashboards    │                      │
│  │  → detectWaitingState() for heartbeat   │                      │
│  └────────────────┬────────────────────────┘                      │
│                   │                                                │
│  Also handles:    │                                                │
│  • Heartbeat (30s intervals)                                      │
│  • Command queue (data/commands/<agent>.json)                     │
│  • Permission routing                                             │
│  • Auto-nudge & auto-continue                                     │
└───────────────────┼───────────────────────────────────────────────┘
                    │ WebSocket (JSON messages)
                    ▼
┌───────────────────────────────────────────────────────────────────┐
│  BROWSER DASHBOARD  (localhost:3000/activity-feed)                 │
│                                                                   │
│  ┌─────────────────────────────────────────┐                      │
│  │ useActivityFeed.ts  (React Hook)        │                      │
│  │  → connects to ws://localhost:3001      │                      │
│  │  → sends dashboard:subscribe            │                      │
│  │  → handleMessage() switch on msg.type   │                      │
│  │  → Log buffer: 750ms flush, max 3/agent │                      │
│  └────────────────┬────────────────────────┘                      │
│                   │                                                │
│                   ▼                                                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│  │Chief │ │Hunter│ │ Ops  │ │Scout │ │Arbit │ │Corta │         │
│  │Term. │ │Term. │ │Term. │ │Term. │ │Term. │ │Term. │         │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘         │
│                                                                   │
│  AgentTerminal.tsx                                                │
│   → stringifyMessage() handles non-string content                 │
│   → parseAnsiText() renders colored output                        │
│   → formatLogMessage() detects [USER]/[TOOL]/[RESULT] prefixes   │
│   → auto-scroll on new logs                                       │
└───────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Deep-Dive

### 3.1 LAUNCH_HALO_SYSTEM.ps1 — Master Launcher

**File**: `LAUNCH_HALO_SYSTEM.ps1` (root)

This is the ONE command to start everything. It launches 8 things in order:

1. **Cleanup** — Kills processes on ports 3000 and 3001 (preserves other Claude sessions)
2. **Node.js check**
3. **npm dependencies check**
4. **Activity Bridge** — `npx tsx scripts/activity-bridge.ts` (minimized cmd window)
5. **Next.js dev server** — `npm run dev` (port 3000, minimized)
6. **Agent Runner** — `npx tsx scripts/agent_runner.ts` (trading bots, minimized)
7. **Halo Agents** — Calls `LAUNCH_AGENTS.ps1` which opens 6 Windows Terminal tabs
8. **Browser** — Opens `http://localhost:3000/command-center`

**Key detail**: The Activity Bridge starts on port 3001 **before** the dashboard starts. This means by the time the browser connects, the WebSocket server is already running and ready to accept `dashboard:subscribe`.

### 3.2 LAUNCH_AGENTS.ps1 — Agent Spawner

**File**: `LAUNCH_AGENTS.ps1` (root)

Spawns 6 Claude Code sessions, each in a separate Windows Terminal tab:

| Tab | Agent | SOUL File | Mode |
|-----|-------|-----------|------|
| 1 | Chief | CHIEF_SOUL.md | `--dangerously-skip-permissions` |
| 2 | Arbiter | ARBITER_SOUL.md | `--dangerously-skip-permissions` |
| 3 | Ops | OPS_SOUL.md | `--dangerously-skip-permissions` |
| 4 | Hunter | HUNTER_SOUL.md | `--dangerously-skip-permissions` |
| 5 | Cortana | CORTANA_SOUL.md | `--dangerously-skip-permissions` |
| 6 | Scout | SCOUT_SOUL.md | `--dangerously-skip-permissions` |

Each agent is launched with:
```cmd
claude --dangerously-skip-permissions --system-prompt "<soul-path>" "You are <Name>. Your SOUL file has been loaded as system context. Begin your PRIMARY WORKFLOW now."
```

**Critical observation**: These agents do NOT run the agent-proxy. They are raw `claude` CLI sessions. Their output is captured **only via JSONL file watching** by the Activity Bridge. This is the primary path and the one that needs to be perfected.

### 3.3 activity-bridge.ts — WebSocket Server (Port 3001)

**File**: `scripts/activity-bridge.ts` (~1225 lines)

This is the **heart of the system**. It does everything:

#### WebSocket Server Setup
- Creates `WebSocketServer` on port 3001
- Accepts two types of clients:
  - **Agents** — identified by `agent:identify` or `agent:register` message
  - **Dashboards** — identified by `dashboard:subscribe` or defaulting to dashboard

#### Session File Watching (Primary Input)
- **`scanForSessions()`** — Every 10 seconds, scans `~/.claude/projects/<project-dirs>/*.jsonl` for files modified in last 10 minutes
- **`watchSessionFile(filePath)`** — Sets up `fs.watch()` on each active JSONL file
- **`readNewContent(filePath, sessionId)`** — On change event, reads bytes from last known position, splits into lines, passes each to `parseSessionLine()`
- **`readInitialLines()`** — On first encounter, reads first 20 lines to detect agent identity

#### Agent Detection
Two tiers of detection are used to identify which JSONL file belongs to which Halo agent:

**Strict detection** (`detectAgentStrict()`):
```
chief:   /Terminal 1:\s+Chief|halo-crew\/agents\/chief\/CLAUDE\.md/i
hunter:  /Terminal 2:\s+Hunter|halo-crew\/agents\/hunter\/CLAUDE\.md/i
...
```

**Broad detection** (`detectAgent()`):
```
chief:   /Terminal 1.*Chief|agent-mgmt\.md|MGMT Agent|management|orchestrat/i
hunter:  /Terminal 2.*Hunter|agent-hunter\.md|bug.*hunt|debug|fix.*error/i
...
```

**Fallback**: Unidentified sessions are assigned to `chief` to avoid losing data.

#### Session Line Parsing (`parseSessionLine()`)
Parses JSONL events from Claude Code transcripts:

| Event Type | What it Extracts | Broadcast As |
|-----------|------------------|--------------|
| `user` | `message.content` text | `[USER] <text>` (level: action) |
| `assistant` (text) | `content[].text` | Raw text (level: info) |
| `assistant` (tool_use) | `content[].name + input` | `[TOOL] <name>: <input>` (level: action) |
| `tool_result` | `is_error` boolean | `[RESULT] Success/Failed` (level: success/error) |

#### Dashboard Message Handling

| Message Type | Action |
|-------------|--------|
| `dashboard:command` | Routes to connected agent WS, or falls back to file queue |
| `dashboard:broadcast` | Sends to all 7 agents (direct WS or file queue) |
| `dashboard:approve` | Routes `permission:response` to all connected agents |
| `dashboard:continue` | Calls `sendAutonomyNudge()` |
| `dashboard:nudge` | Sends PING command to specific agent |
| `dashboard:nudge_all` | Nudges all stale/dead agents |
| `dashboard:heartbeat_config` | Updates heartbeat thresholds |

#### Command Queue (File-Based Fallback)
When an agent isn't directly connected via WebSocket, commands are written to JSON files:
```
data/commands/chief.json
data/commands/hunter.json
data/commands/ops.json
...
```

Each file contains an array of `{ id, agentId, command, createdAt, status }` entries. When an agent reconnects, `sendPendingCommands()` flushes the queue.

**Problem**: The standard Halo agents launched by LAUNCH_AGENTS.ps1 never read these command queue files. They're only useful if the agent-proxy is connected, which it isn't in the standard flow.

### 3.4 activity-hub.ts — Alternative Hub Class

**File**: `src/lib/ws/activity-hub.ts` (~769 lines)

This is a **separate, class-based implementation** of the WebSocket hub that exists in the `src/lib/ws/` directory. It has a similar architecture to the bridge but is structured as an importable `ActivityHub` class with a singleton export.

**Key differences from activity-bridge.ts**:
- Uses the `ws/types.ts` type system with strict TypeScript interfaces
- Has a `handleSessionWatcherRegister()` and `handleSessionWatcherActivity()` methods for a session-watcher integration pattern
- Does NOT do direct JSONL file watching — it expects a separate `session-watcher.ts` process to send events
- Uses the `activity-log.ts` persistence layer for all storage

**Current status**: This file appears to be an earlier/alternative design. The `activity-bridge.ts` is the one actually launched by `LAUNCH_HALO_SYSTEM.ps1` and does the JSONL watching itself. The two files represent a potential refactoring opportunity but currently the bridge is the one in active use.

### 3.5 agent-proxy.ts — Direct Agent-to-Hub Relay

**File**: `scripts/agent-proxy.ts` (~700 lines)

A CLI tool for connecting overnight/batch agents directly to the WebSocket server. Not used by the standard Halo launch flow.

**Usage**:
```bash
npx tsx scripts/agent-proxy.ts --agent overnight-improver --ws-url ws://localhost:3001 --interactive
```

**Flow**:
1. Connects to WS server
2. Sends `identify` message with agent name
3. Starts heartbeat (30s intervals)
4. In interactive mode, relays stdin lines as `message` events
5. Handles `hub:command` messages by printing to stdout
6. Auto-approves permission requests
7. Reconnects with exponential backoff (max 10 attempts)
8. Watches for STOP signal file (`.claude/overnight/STOP`)

### 3.6 activity-log.ts — Persistence Layer

**File**: `src/lib/activity-log.ts` (~463 lines)

Manages persistent storage of all activity feed data:

- **Storage file**: `data/activity-feed.json` (configurable via `ACTIVITY_FEED_PATH`)
- **In-memory cache**: Last 1000 entries
- **File rotation**: Archives when file exceeds 10MB
- **Debounced writes**: 100ms debounce to prevent excessive disk I/O
- **Agent tracking**: Maintains `TrackedAgent` records with status, lastSeen, actionsToday

**Exported functions used by the bridge**:
- `addLogEntry(agent, line, level)` — Adds log + updates agent tracking
- `addStatusEntry(agent, status, metadata)` — Status change
- `addPermissionEntry(request)` — Permission tracking
- `resolvePermission(id, approved, respondedBy)` — Permission resolution
- `getRecent(count)` — Recent entries for initial state sync
- `getPending()` — Pending permissions
- `flush()` — Force immediate write to disk

### 3.7 useActivityFeed.ts — Browser WebSocket Client

**File**: `src/hooks/useActivityFeed.ts` (~948 lines)

The React hook that powers the browser-side connection.

#### Connection Lifecycle
1. On mount, creates `new WebSocket('ws://localhost:3001')`
2. On open, sends `dashboard:subscribe` with empty filters
3. Bridge responds with `hub:state` (agent list + pending permissions)
4. Bridge also sends `heartbeat:state` (all agent heartbeat data)
5. On close, schedules reconnect with exponential backoff (max 30s)

#### Message Handling
The `handleMessage()` callback processes 20+ message types:

**Log messages** (buffered):
- `agent:output` — Raw terminal output from agent-proxy
- `agent:log` — Structured log from bridge (the primary format)
- `agent_log` — Legacy format

**Status messages** (immediate):
- `agent:status` — Online/offline/busy changes
- `agent_status` — Legacy format

**Permission messages**:
- `agent:permission` — New permission request
- `hub:permission_resolved` — Permission was approved/denied
- `permission:resolved` — Bridge format resolution

**Heartbeat messages**:
- `heartbeat:state` — Full heartbeat state on connect
- `agent:heartbeat` — Individual agent heartbeat update (every 30s)
- `heartbeat:config` — Config changes
- `agent:waiting` — Agent detected waiting for input
- `agent:auto_continued` — Agent was auto-continued
- `agent:nudged` — Agent was nudged

**Command confirmations**:
- `command:queued` — Single agent command queued
- `broadcast:queued` — Broadcast command sent

**State sync**:
- `hub:state` — Full state dump (agents + permissions + recent activity)

#### Log Throttling System
This is one of the most important pieces for terminal feel:

```typescript
const LOG_FLUSH_INTERVAL = 750;  // Flush every 750ms
const MAX_LOGS_PER_FLUSH = 3;    // Max 3 logs per agent per flush
```

Incoming logs are buffered in `logBufferRef` (a `Map<string, LogEntry[]>`). Every 750ms, `flushLogBuffer()` takes the **last 3 entries** per agent from the buffer, appends them to that agent's log array (capped at 500 entries), and clears the buffer.

**Trade-off**: This prevents UI spam but means you can lose intermediate logs if an agent produces more than 3 messages per 750ms. Real terminal output would show every line — this shows a sampled subset.

#### Exported Actions
- `approve(permissionId)` — Sends `dashboard:approve` with `approved: true`
- `reject(permissionId)` — Sends `dashboard:approve` with `approved: false`
- `approveAll()` — Approves all pending permissions
- `sendCommand(agentId, command)` — Sends `dashboard:command`
- `broadcastCommand(command)` — Sends `dashboard:broadcast`
- `nudgeAgent(agentId)` — Sends `dashboard:nudge`
- `nudgeAllStale()` — Sends `dashboard:nudge_all`
- `continueAgent(agentId)` — Sends `dashboard:continue`
- `setHeartbeatConfig(config)` — Sends `dashboard:heartbeat_config`

### 3.8 AgentTerminal.tsx — Terminal Rendering

**File**: `src/components/ActivityFeed/AgentTerminal.tsx` (~435 lines)

The terminal panel component that renders each agent's output.

#### Rendering Pipeline
```
LogEntry.text (string | object)
    ↓
stringifyMessage(input)
    → if string: return as-is
    → if object: extract .message/.text/.line/.content fields
    → fallback: JSON.stringify
    ↓
parseAnsiText(text)
    → truncate at 500 chars
    → scan for ANSI escape codes (\x1b[31m, etc.)
    → produce array of <span> elements with color styles
    ↓
Rendered in .logLine > .message > spans
```

#### Visual Elements
- **Header**: Avatar (40px circle with agent-color border), name, ticket badges (done/inProgress/todo from Jira), heartbeat indicator, wake/continue buttons, status badge
- **Content**: Scrollable log area with timestamp + icon + message per line
- **Input**: Prompt with avatar, text input, send button
- **Waiting prompt**: Shows when agent is waiting for input (from heartbeat)
- **Accent bar**: 2px color bar at bottom

---

## 4. Message Protocol Reference

### Agent → Bridge (or Hub)

| Type | Fields | Description |
|------|--------|-------------|
| `agent:identify` | `agent`, `version?`, `capabilities?` | Agent announces itself on connect |
| `agent:register` | `agent` | Alternative identification format |
| `agent:output` | `agent`, `line`, `stream?`, `level?`, `timestamp` | Raw terminal output line |
| `agent:log` | `agent`, `line`, `level?`, `timestamp` | Structured log entry |
| `agent:status` | `agent`, `status`, `timestamp`, `metadata?` | Status change |
| `agent:permission` | `id`, `agent`, `tool`, `params`, `prompt`, `timestamp` | Permission request |

### Dashboard → Bridge

| Type | Fields | Description |
|------|--------|-------------|
| `dashboard:subscribe` | `filters?` | Subscribe to events |
| `dashboard:command` | `agentId`, `command`, `timestamp` | Command to single agent |
| `dashboard:broadcast` | `command`, `timestamp` | Command to all agents |
| `dashboard:approve` | `id`, `approved`, `respondedBy?`, `timestamp` | Permission response |
| `dashboard:nudge` | `agentId`, `timestamp` | Manual heartbeat check |
| `dashboard:nudge_all` | `timestamp` | Nudge all stale agents |
| `dashboard:continue` | `agentId`, `timestamp` | Tell agent to continue autonomously |
| `dashboard:heartbeat_config` | `config`, `timestamp` | Update heartbeat thresholds |

### Bridge → Dashboard

| Type | Fields | Description |
|------|--------|-------------|
| `hub:state` | `agents[]`, `pendingPermissions[]`, `recentActivity[]` | Full state on connect |
| `agent:log` | `agent`, `line`, `level`, `timestamp`, `logId` | Log entry broadcast |
| `agent:status` | `agent`, `status`, `timestamp` | Agent status change |
| `agent:permission` | `id`, `agent`, `tool`, `params`, `prompt`, `timestamp` | Permission request |
| `agent:heartbeat` | `agent`, `status`, `lastSeen`, `nudgeCount`, `lastNudge`, `timestamp` | Heartbeat update (every 30s) |
| `agent:waiting` | `agent`, `prompt`, `timestamp` | Agent is waiting for input |
| `agent:auto_continued` | `agent`, `timestamp` | Agent was auto-continued |
| `agent:nudged` | `agent`, `isAuto`, `nudgeCount`, `timestamp` | Agent was nudged |
| `heartbeat:state` | `agents{}`, `config{}`, `timestamp` | Full heartbeat state on connect |
| `heartbeat:config` | `config{}`, `timestamp` | Config updated |
| `command:queued` | `agentId`, `commandId`, `command`, `timestamp` | Command queued confirmation |
| `broadcast:queued` | `command`, `agents[]`, `directCount`, `queuedCount`, `timestamp` | Broadcast confirmation |
| `permission:resolved` | `id`, `approved`, `timestamp` | Permission resolved |

---

## 5. Data Flow Traces

### 5.1 Path A: JSONL Session File Watching (Current Primary)

This is how 95% of agent output reaches the dashboard:

```
Step 1: Claude Code agent (e.g., Chief) generates output
        → Claude Code writes to ~/.claude/projects/<hash>/<session-id>.jsonl
        → Each line is a JSON event: { type: "assistant", message: { content: [...] } }

Step 2: activity-bridge.ts scanForSessions() (every 10s)
        → Scans PROJECT_DIRS for *.jsonl files modified in last 10 minutes
        → Calls watchSessionFile(filePath) for new/updated files

Step 3: fs.watch() fires 'change' event on the JSONL file
        → readNewContent(filePath, sessionId) reads bytes from last-known position
        → Splits into lines, calls parseSessionLine(line, sessionId) for each

Step 4: parseSessionLine() processes the JSONL event:
        → Looks up agentId via agentSessions map (sessionId → agentId)
        → If unknown, checks agent registry, then runs detectAgentStrict/detectAgent
        → Falls back to 'chief' if still unknown

        For 'assistant' events with text content:
        → Extracts content[].text parts
        → Calls broadcastLog(agentId, text.substring(0, 300), 'info')

        For 'assistant' events with tool_use:
        → Extracts tool name and input JSON
        → Calls broadcastLog(agentId, '[TOOL] name: input', 'action')

Step 5: broadcastLog(agentId, text, level)
        → Updates agentStatus and heartbeatState
        → Calls addLogEntry() to persist to activity-feed.json
        → Broadcasts { type: 'agent:log', agent, line, level, timestamp } to all dashboards
        → Checks detectWaitingState() and broadcasts agent:waiting if detected

Step 6: Browser useActivityFeed.ts receives the agent:log message
        → handleMessage() creates LogEntry { id, timestamp, level, text, agentId }
        → Pushes to logBufferRef map under the agent name
        → Also sets agent status to 'busy'

Step 7: flushLogBuffer() fires (every 750ms)
        → Takes last 3 entries per agent from buffer
        → Appends to agent.logs (capped at 500)
        → Clears buffer
        → Triggers React re-render

Step 8: AgentTerminal.tsx re-renders
        → Maps agent.logs to log line elements
        → Each log goes through: stringifyMessage() → parseAnsiText() → <span> elements
        → Auto-scrolls to bottom
```

### 5.2 Path B: Direct Agent Proxy WebSocket

For agents using agent-proxy.ts:

```
Step 1: Agent proxy connects to ws://localhost:3001
Step 2: Sends { type: 'agent:identify', agent: 'overnight-improver' }
Step 3: Bridge registers in agentConnections map
Step 4: Agent proxy relays stdout as { type: 'agent:output', agent, line }
Step 5: Bridge receives, broadcasts as agent:log to dashboards
Step 6: Dashboard handles same as Path A from Step 6
```

**Note**: The standard Halo agents do NOT use this path.

### 5.3 Path C: Dashboard → Agent Commands

```
Step 1: User types in AgentTerminal input, hits Enter
Step 2: onSendCommand fires → sendCommand(agentId, command)
Step 3: WebSocket sends { type: 'dashboard:command', agentId, command, timestamp }
Step 4: Bridge receives:
        → If agent is directly connected (agentConnections has agentId):
          Sends { type: 'hub:command', command, from: 'dashboard' } to agent WS
        → Else (file-based fallback):
          Writes to data/commands/<agentId>.json
          Broadcasts { type: 'command:queued' } to dashboards
Step 5: Dashboard shows [CMD] log entry in that agent's terminal
```

**Critical gap**: Standard Halo agents never read the command queue files. Commands sent through the terminal input are essentially lost unless the agent happens to reconnect via agent-proxy.

### 5.4 Path D: Permission Request Lifecycle

```
Step 1: Agent hits a permission prompt (detected from JSONL or via direct WS)
Step 2: Bridge creates permission entry, broadcasts agent:permission to dashboards
Step 3: Dashboard useActivityFeed adds to permissions[] state
Step 4: Activity Feed page shows permission card with Approve/Deny buttons
Step 5: User clicks Approve → sends dashboard:approve with approved: true
Step 6: Bridge receives:
        → Broadcasts permission:resolved to dashboards
        → Sends permission:response to connected agents
Step 7: Dashboard removes from permissions list
```

**Gap**: With `--dangerously-skip-permissions`, the Halo agents never actually wait for permission responses. The permission flow is designed for non-autonomous agents.

---

## 6. Heartbeat & Health Monitoring

The heartbeat system tracks agent liveness and can auto-nudge stale agents.

### Thresholds (defaults)
| Parameter | Value | Meaning |
|-----------|-------|---------|
| staleThresholdMs | 180,000 (3 min) | Agent becomes "stale" — last seen 3+ minutes ago |
| deadThresholdMs | 600,000 (10 min) | Agent becomes "dead" — last seen 10+ minutes ago |
| autoNudgeEnabled | true | Auto-send PING when agent becomes stale |
| autoNudgeIntervalMs | 120,000 (2 min) | Minimum between auto-nudges |
| nudgeCooldownMs | 60,000 (1 min) | Cooldown between any nudges to same agent |

### Heartbeat Cycle (every 30s in bridge)
1. For each agent, compute status: `alive | stale | dead`
2. If directly connected via WS, force status to `alive` and update lastSeen
3. Broadcast `agent:heartbeat` with status, lastSeen, nudgeCount to dashboards
4. If agent just became stale and autoNudge is enabled, send PING command
5. If agent status is `waiting_input` for >60s, send auto-continue (autonomy nudge)
6. Save heartbeat state to `data/heartbeat-status.json`

### Waiting State Detection
The bridge checks every log message against patterns:
```javascript
/Shall I\s+(proceed|continue|fix|create|implement)/i
/Should I\s+(proceed|continue|fix|create|implement)/i
/Do you want me to/i
/Would you like me to/i
/Please (confirm|choose|select|pick)/i
/Which (option|approach|one)/i
/\?\s*$/m  // Ends with question mark
```

When detected:
- Agent status set to `waiting_input`
- Dashboard shows pulsing "WAITING" indicator + "Continue" button
- After 60s, auto-continue sends an autonomy nudge command

### Startup Detection
On bridge startup, `detectWaitingOnStartup()` reads `data/activity-feed.json` and checks each agent's last non-[USER] message for waiting patterns. This restores waiting state across bridge restarts.

---

## 7. Log Throttling & Buffer System

### Why Throttling Exists
Claude Code agents can produce hundreds of lines per second (especially during tool calls). Without throttling, the browser terminal would:
- Scroll so fast it's unreadable
- Cause excessive React re-renders (performance death)
- Fill up the 500-entry log buffer instantly

### How It Works

**Bridge side**: No throttling — every log line is broadcast immediately via WebSocket.

**Client side** (`useActivityFeed.ts`):
```
Incoming agent:log messages
    ↓
logBufferRef (Map<agentName, LogEntry[]>)
    ↓ every 750ms
flushLogBuffer()
    → Take last 3 entries per agent
    → Append to agent.logs (max 500)
    → Clear buffer
    → Trigger re-render
```

### Impact on Terminal Fidelity
- **750ms interval** = ~1.3 updates per second per agent
- **Max 3 per flush** = at most 3 new lines appear per 750ms
- A real terminal shows every line instantly
- The throttled view shows a sampled subset, which can miss important intermediate output

### Current Limits
| Parameter | Value | Effect |
|-----------|-------|--------|
| LOG_FLUSH_INTERVAL | 750ms | How often buffer is flushed |
| MAX_LOGS_PER_FLUSH | 3 per agent | Max lines added per flush per agent |
| Max log array | 500 entries | Oldest entries dropped when exceeded |
| Message truncation | 1000 chars (hook), 500 chars (ANSI parser) | Long messages get cut off |
| broadcastLog truncation | 300 chars (assistant text) | Bridge truncates before sending |

---

## 8. What's Working (The 80%)

1. **WebSocket server starts and accepts connections** — Bridge on :3001 is solid
2. **Dashboard connects and receives initial state** — `hub:state` and `heartbeat:state` sync works
3. **JSONL file watching detects active sessions** — `scanForSessions()` correctly finds recent files
4. **Agent detection from content** — Both strict and broad patterns catch most agents
5. **Log broadcasting works** — `agent:log` messages flow from bridge to dashboard
6. **Log buffering and rendering** — Throttled display works, no UI freezing
7. **Heartbeat system tracks agent liveness** — Status indicators (alive/stale/dead/waiting) display correctly
8. **Waiting state detection** — Question-mark patterns are caught, WAITING indicator shows
9. **Auto-nudge and auto-continue** — Stale agents get pinged, waiting agents get continued
10. **ANSI color parsing** — Terminal colors render properly in browser
11. **Agent avatars and theming** — Each terminal has correct Halo character portrait and color
12. **Jira ticket counts** — Real ticket data from Jira appears in terminal headers
13. **Permission UI exists** — Permission cards with approve/deny buttons render
14. **Command input UI exists** — Each terminal has a command input at the bottom
15. **Reconnection logic** — Both bridge and dashboard handle disconnects gracefully

---

## 9. What's Broken / Missing (The 20%)

### Critical Issues

#### 9.1 Agent Detection is Unreliable
**Problem**: The bridge tries to detect which session belongs to which agent by pattern-matching content. But:
- The initial message from `LAUNCH_AGENTS.ps1` is `"You are <Name>. Your SOUL file has been loaded..."` which is a user message
- The strict pattern expects `"Terminal 1: Chief"` or `halo-crew/agents/chief/CLAUDE.md` — but the launch script uses `--system-prompt` which may not appear in the transcript as user content
- If detection fails, everything gets assigned to `chief` (the fallback)
- **Result**: Multiple agents' output may all appear in Chief's terminal

**Evidence**: The `detectAgentStrict()` patterns reference old launch patterns (`Terminal 1: Chief`) that the current `LAUNCH_AGENTS.ps1` doesn't produce.

#### 9.2 Commands Can't Reach Standard Halo Agents
**Problem**: The dashboard command input sends `dashboard:command` to the bridge, which either:
- Routes to a directly-connected agent WebSocket (agent-proxy) — **not used by Halo agents**
- Writes to `data/commands/<agentId>.json` — **Halo agents never poll this**

**Result**: Typing a command in the terminal input goes nowhere. The agents never see it.

**Fix needed**: Either integrate command queue polling into the Claude Code sessions (via SOUL file instructions) or use a different mechanism like writing to the session's stdin.

#### 9.3 Permissions Don't Actually Work with `--dangerously-skip-permissions`
**Problem**: All Halo agents are launched with `--dangerously-skip-permissions`. This means:
- They never pause for permission
- The permission detection in the bridge parses JSONL events but the agents already auto-approved
- The approve/deny buttons in the dashboard are cosmetic for Halo agents

**Result**: Permission cards may appear but approving/denying them has no effect on the agent.

#### 9.4 Bridge Truncation Loses Content
**Problem**: Multiple truncation points in the pipeline:
- `parseSessionLine()` truncates assistant text at 300 chars
- `broadcastLog()` console log truncates at 80 chars
- `useActivityFeed` truncates at 1000 chars
- `parseAnsiText()` truncates at 500 chars

**Result**: Long tool outputs, error messages, or code blocks are cut short. A real terminal would show everything.

#### 9.5 `stringifyMessage()` / "complex message" Issue
**Problem**: Sometimes the bridge sends non-string `line` values (objects with nested content). The `stringifyMessage()` function in `AgentTerminal.tsx` was added to handle this by extracting `.message`, `.text`, `.line`, or `.content` fields. But:
- If the object doesn't have those fields, it falls back to `JSON.stringify` which produces `{"type":"text","text":"..."}` — ugly but functional
- The hook also does `typeof message.line === 'string' ? message.line : JSON.stringify(message.line)` which may produce double-encoded JSON

**Result**: Some messages may still show as JSON blobs rather than clean text.

### Minor Issues

#### 9.6 File Position Tracking Can Drift
The bridge tracks `filePositions` (byte offset per file). If the JSONL file is truncated or rotated by Claude Code, the position may become invalid, causing:
- Missed content (position past end of new file)
- Duplicate content (re-reading from wrong offset)

#### 9.7 No Deduplication
If the bridge restarts, it re-reads recent JSONL files and may re-broadcast old logs to the dashboard. There's no dedup mechanism.

#### 9.8 Two Hub Implementations Coexist
`activity-bridge.ts` and `activity-hub.ts` are parallel implementations. The bridge is used in production; the hub class sits unused. This causes confusion about which is authoritative.

#### 9.9 `ws/types.ts` Types Not Used by Bridge
The bridge defines its own inline types rather than importing from `src/lib/ws/types.ts`. The type system exists but isn't leveraged, leading to potential message format mismatches.

#### 9.10 Heartbeat File Persistence is Heavy
The bridge loads/saves `heartbeat-status.json` to disk every 30 seconds. For 7 agents, this is fine, but the `loadHeartbeatState()` call in `updateHeartbeat()` re-reads from disk on every agent activity event (it was noted in code that "Don't save on every update - let the periodic save handle it" but the load is still per-event).

---

## 10. Recommended Fixes

### Fix 1: Reliable Agent Registration (Priority: HIGH)
**Problem**: Agent detection by content matching is fragile.
**Solution**: Have each Claude Code agent register itself explicitly.

Add to each agent's SOUL file:
```markdown
## Activity Feed Registration
At the START of every session, write a registration file:
```bash
echo '{"agentId":"chief","sessionId":"SESSION_ID","startedAt":"TIMESTAMP"}' > data/agent-registry.json
```

Or better, modify `LAUNCH_AGENTS.ps1` to:
1. Generate a unique session ID per agent
2. Write to `data/agent-registry.json` with `{ agents: { chief: { sessionId: "xxx" } } }`
3. The bridge already has `getRegisteredSessions()` which reads this file

The bridge's existing code already checks the registry:
```typescript
const registeredSessions = getRegisteredSessions();
if (registeredSessions.has(sessionId)) {
    const registeredAgent = registeredSessions.get(sessionId)!;
    agentSessions.set(sessionId, registeredAgent);
}
```

### Fix 2: Increase Log Fidelity (Priority: HIGH)
**Problem**: Too much truncation prevents terminal-like experience.
**Solution**:

In `activity-bridge.ts`:
```diff
- broadcastLog(agentId, part.text.substring(0, 300), 'info');
+ broadcastLog(agentId, part.text.substring(0, 2000), 'info');
```

In `useActivityFeed.ts`:
```diff
- text: lineText.substring(0, 1000),
+ text: lineText.substring(0, 3000),
```

In `AgentTerminal.tsx` parseAnsiText():
```diff
- const truncatedText = text.length > 500 ? text.substring(0, 500) + '...' : text;
+ const truncatedText = text.length > 2000 ? text.substring(0, 2000) + '...' : text;
```

Also increase throttle fidelity:
```diff
- const LOG_FLUSH_INTERVAL = 750;
- const MAX_LOGS_PER_FLUSH = 3;
+ const LOG_FLUSH_INTERVAL = 400;  // Faster updates
+ const MAX_LOGS_PER_FLUSH = 8;    // More lines per flush
```

### Fix 3: Fix Command Delivery (Priority: MEDIUM)
**Problem**: Dashboard commands don't reach standard Halo agents.
**Solution options**:

**Option A** (Simplest): Add command queue polling to SOUL files:
```markdown
## Command Queue Check
Every 2 minutes, check for pending commands:
```bash
cat data/commands/<your-id>.json 2>/dev/null
```
If you find pending commands, execute them and update status to 'completed'.
```

**Option B** (Better): Use Claude Code's `--continue` or session resume mechanism to inject commands.

**Option C** (Best): Have the bridge write commands as user messages to the active JSONL session, which Claude Code picks up. This requires deeper integration with Claude Code's session format.

### Fix 4: Clean Up Dual Hub Implementations (Priority: LOW)
**Problem**: `activity-bridge.ts` and `activity-hub.ts` are parallel implementations.
**Solution**: Either:
- Delete `activity-hub.ts` and keep the bridge (simpler)
- Refactor the bridge to use the hub class internally (cleaner architecture)
- At minimum, add comments explaining which is used and why

### Fix 5: Add Message Deduplication (Priority: LOW)
**Problem**: Bridge restart causes duplicate log broadcasts.
**Solution**: Track last-processed byte position in a persistent file:
```json
// data/bridge-positions.json
{
  "session-abc123.jsonl": 48293,
  "session-def456.jsonl": 12847
}
```
Load on startup, skip already-processed content.

### Fix 6: Normalize Message Format (Priority: LOW)
**Problem**: Non-string `line` values cause "complex message" rendering.
**Solution**: In the bridge's `broadcastLog()`, always ensure line is a string:
```typescript
function broadcastLog(agentId: string, text: unknown, level: string = 'info') {
    const textStr = typeof text === 'string' ? text :
        (typeof text === 'object' && text !== null && 'text' in text)
            ? String((text as any).text)
            : JSON.stringify(text);
    // ... rest of function
}
```

---

## 11. File Index

| File | Purpose | Lines |
|------|---------|-------|
| `LAUNCH_HALO_SYSTEM.ps1` | Master launcher (starts everything) | 145 |
| `LAUNCH_AGENTS.ps1` | Spawns 6 Claude Code agent terminals | 175 |
| `scripts/activity-bridge.ts` | **WebSocket server + JSONL watcher + command routing** | ~1225 |
| `scripts/agent-proxy.ts` | Optional direct agent-to-hub relay | ~700 |
| `scripts/stop-activity-feed.ts` | Graceful shutdown | ~200 |
| `scripts/verify-activity-feed.ps1` | Diagnostic checker | 173 |
| `src/lib/ws/activity-hub.ts` | Alternative hub class (unused in prod) | ~769 |
| `src/lib/ws/types.ts` | TypeScript type definitions for WS protocol | 311 |
| `src/lib/activity-log.ts` | Persistent JSON storage layer | ~463 |
| `src/lib/dataPaths.ts` | Centralized path resolver | ~30 |
| `src/hooks/useActivityFeed.ts` | **Browser WebSocket client hook** | ~948 |
| `src/components/ActivityFeed/AgentTerminal.tsx` | **Terminal rendering component** | ~435 |
| `src/components/ActivityFeed/AgentTerminal.module.css` | Terminal styling | ~652 |
| `src/app/activity-feed/page.tsx` | Activity Feed page layout | ~100 |
| `src/hooks/useJiraStats.ts` | Jira ticket count fetcher | ~74 |
| `src/app/api/jira/stats/route.ts` | Jira stats API endpoint | ~126 |
| `data/activity-feed.json` | Persistent activity log | Runtime |
| `data/heartbeat-status.json` | Heartbeat state persistence | Runtime |
| `data/commands/<agent>.json` | File-based command queues | Runtime |
| `data/agent-registry.json` | Agent session registration | Runtime |

---

## Summary

The system is architecturally sound. The bridge successfully watches JSONL session files, parses Claude Code transcript events, and broadcasts them to a browser dashboard via WebSocket. The heartbeat system, waiting detection, and auto-nudge features are sophisticated additions.

The main gaps preventing "real terminal" fidelity are:

1. **Unreliable agent detection** — Fix with explicit agent registration
2. **Aggressive content truncation** — Increase limits across the pipeline
3. **Dead command input** — Standard agents never see dashboard commands
4. **Log sampling** (3 per 750ms) — Increase for more real-time feel

Fix items 1 and 2, and the system jumps from 80% to ~95%. Fix all four and it's a full terminal mirror.

---

## Status Update (2026-03-22)

**Issues Fixed:**

1. ✅ **Agent detection patterns updated** — Now matches "You are {Agent}" format from LAUNCH_AGENTS.ps1
2. ✅ **Content truncation increased** — Bridge: 2000 chars, Hook: 3000 chars, Terminal: 2000 chars
3. ✅ **Log sampling improved** — 400ms flush interval, 8 logs per flush (5x throughput)
4. ⚠️ **Command input** — Commands still queue to file (agents don't poll) — marked with visual indicator

**Files Modified:**
- `scripts/activity-bridge.ts` — Detection patterns, truncation, logging
- `src/hooks/useActivityFeed.ts` — Throttling parameters, truncation
- `src/components/ActivityFeed/AgentTerminal.tsx` — Display truncation
