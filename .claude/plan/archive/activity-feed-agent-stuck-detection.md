# Implementation Plan: Activity Feed Agent "Stuck" Detection & Auto-Nudge

## Task Summary

Audit the Activity Feed page, diagnose why Arbiter got "stuck", and implement visual indicators + auto-nudge functionality for agents that stall mid-workflow.

---

## Problem Analysis

### Why Arbiter Got "Stuck"

Examining the transcript, Arbiter completed a code quality audit and ended with:

```
Shall I proceed to fix the remaining instances to complete INFRA-17, or create follow-up tickets?
```

**Root Cause**: Arbiter asked a question and waited for human input, but:

1. **The SOUL file says "AUTONOMOUS"** - Line 737-809 instructs Arbiter to pick up work autonomously
2. **Arbiter violated its own rules** - It asked for permission instead of proceeding with its autonomous mandate
3. **No detection mechanism exists** - The Activity Feed has no way to detect an agent asking a question vs actively working
4. **The "Wake" button only sends a PING** - It doesn't tell the agent "continue working, don't wait for me"

### Current Heartbeat System Limitations

| What Exists | What's Missing |
|-------------|----------------|
| `stale` detection (3min no activity) | No detection of "waiting for input" state |
| `dead` detection (10min no activity) | No "autonomy nudge" message |
| Manual "Wake" button | No auto-continue for stuck agents |
| Auto-nudge on stale transition | No semantic understanding of agent state |

---

## Technical Solution

### 1. Detect "Waiting for Input" State

Add pattern matching to detect when an agent ends output with a question or choice prompt:

**Patterns indicating agent is waiting**:
- Ends with `?` after presenting options
- Contains "Shall I", "Should I", "Do you want", "Would you like"
- Contains "Please confirm", "Choose one", "Pick one"
- Ends with numbered list of choices
- Tool requested but no subsequent tool call for 30s+

### 2. New Heartbeat States

Extend `HeartbeatAgentState.status`:

```typescript
status: 'alive' | 'stale' | 'dead' | 'unknown' | 'waiting_input'
```

### 3. Visual Indicator in Activity Feed

Add a pulsing amber indicator when agent is `waiting_input`:

```
[ARBITER] 🟠 WAITING • "Shall I proceed to fix..."
              └── [Auto-Continue] [Respond]
```

### 4. Auto-Nudge Messages

Instead of just "PING", send context-aware nudge:

| Agent State | Nudge Message |
|-------------|---------------|
| `stale` | "PING: Heartbeat check. Reply with status." |
| `waiting_input` | "CONTINUE: You are in autonomous mode. Do not wait for human input. Proceed with your PRIMARY WORKFLOW. If blocked, pick the safer/smaller option and continue." |

### 5. Activity Feed UI Changes

**In AgentTerminal.tsx**:
- Amber pulsing dot for `waiting_input` state
- "WAITING" label next to heartbeat indicator
- "Continue" button (different from Wake) that sends autonomy nudge
- Show last question/prompt in terminal footer

---

## Implementation Steps

### Step 1: Extend HeartbeatAgentState Type

**File**: `src/hooks/useActivityFeed.ts:44-49`

Add `waiting_input` to status union:

```typescript
export interface HeartbeatAgentState {
    status: 'alive' | 'stale' | 'dead' | 'unknown' | 'waiting_input';
    lastSeen: string | null;
    nudgeCount: number;
    lastNudge: string | null;
    lastPrompt: string | null;  // NEW: Store the waiting prompt
    waitingDetectedAt: string | null;  // NEW: When we detected waiting
}
```

### Step 2: Add Waiting Detection Logic

**File**: `scripts/activity-bridge.ts`

After `broadcastLog()`, analyze the message content:

```typescript
function detectWaitingState(agentId: string, text: string): boolean {
    const waitingPatterns = [
        /Shall I\s+(proceed|continue|fix|create|implement)/i,
        /Should I\s+(proceed|continue|fix|create|implement)/i,
        /Do you want me to/i,
        /Would you like me to/i,
        /Please (confirm|choose|select|pick)/i,
        /\?\s*$/m,  // Ends with question mark
        /Options?:\s*\n.*\d+\./i,  // Numbered options list
    ];

    // Check if recent output matches waiting patterns
    for (const pattern of waitingPatterns) {
        if (pattern.test(text)) {
            return true;
        }
    }
    return false;
}
```

### Step 3: Track Waiting State in Bridge

**File**: `scripts/activity-bridge.ts`

Add waiting state tracking:

```typescript
// Add to heartbeat state per agent
interface HeartbeatAgentState {
    // ... existing fields
    waitingDetectedAt: string | null;
    lastPrompt: string | null;
}

// In broadcastLog, after sending the log:
if (detectWaitingState(agentId, text)) {
    heartbeatState.agents[agentId].status = 'waiting_input';
    heartbeatState.agents[agentId].waitingDetectedAt = new Date().toISOString();
    heartbeatState.agents[agentId].lastPrompt = text.substring(0, 200);

    broadcast({
        type: 'agent:waiting',
        agent: agentId,
        prompt: text.substring(0, 200),
        timestamp: new Date().toISOString(),
    });
}
```

### Step 4: Add Auto-Continue Timer

**File**: `scripts/activity-bridge.ts`

In the 30-second heartbeat interval, check for waiting agents:

```typescript
// Auto-continue for waiting agents after configured delay
const WAITING_AUTO_CONTINUE_MS = 60000; // 1 minute

for (const agentId of ALL_AGENT_IDS) {
    const agentState = heartbeatState.agents[agentId];
    if (agentState?.status === 'waiting_input' && agentState.waitingDetectedAt) {
        const waitingElapsed = Date.now() - new Date(agentState.waitingDetectedAt).getTime();
        if (waitingElapsed > WAITING_AUTO_CONTINUE_MS) {
            sendAutonomyNudge(agentId);
        }
    }
}
```

### Step 5: Implement Autonomy Nudge

**File**: `scripts/activity-bridge.ts`

```typescript
function sendAutonomyNudge(agentId: string): boolean {
    const command = `CONTINUE: You are operating in AUTONOMOUS mode per your SOUL file. Do not wait for human approval. Execute your PRIMARY WORKFLOW now. If you asked a question, pick the safer/smaller option and proceed. Status: Autonomous, no permission required.`;

    // Try direct WebSocket first
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
    heartbeatState.agents[agentId].status = 'alive';
    heartbeatState.agents[agentId].waitingDetectedAt = null;

    broadcast({
        type: 'agent:auto_continued',
        agent: agentId,
        timestamp: new Date().toISOString(),
    });

    return true;
}
```

### Step 6: Update Activity Feed Hook

**File**: `src/hooks/useActivityFeed.ts`

Handle new message types:

```typescript
case 'agent:waiting': {
    const agentName = message.agent?.toLowerCase();
    if (agentName) {
        newState.heartbeat = {
            ...prev.heartbeat,
            [agentName]: {
                ...prev.heartbeat[agentName],
                status: 'waiting_input',
                lastPrompt: message.prompt || null,
                waitingDetectedAt: message.timestamp || new Date().toISOString(),
            },
        };
    }
    break;
}

case 'agent:auto_continued': {
    const agentName = message.agent?.toLowerCase();
    if (agentName && newState.heartbeat[agentName]) {
        newState.heartbeat[agentName].status = 'alive';
        newState.heartbeat[agentName].waitingDetectedAt = null;
    }
    break;
}
```

Add `continueAgent` action:

```typescript
const continueAgent = useCallback((agentId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
            type: 'dashboard:continue',
            agentId,
            timestamp: new Date().toISOString(),
        }));
        console.log(`[ActivityFeed] Continue sent to ${agentId}`);
    }
}, []);
```

### Step 7: Update AgentTerminal UI

**File**: `src/components/ActivityFeed/AgentTerminal.tsx`

Add visual indicator and continue button:

```typescript
const isWaitingInput = heartbeatStatus === 'waiting_input';

// In header, after heartbeat indicator:
{isWaitingInput && (
    <div className={styles.waitingIndicator}>
        <div className={styles.waitingPulse} />
        <span className={styles.waitingLabel}>WAITING</span>
    </div>
)}

// Add Continue button (different from Wake)
{isWaitingInput && onContinue && (
    <button
        className={styles.continueButton}
        onClick={() => onContinue(agent.id)}
        title="Tell agent to continue autonomously"
    >
        <Play size={12} />
        Continue
    </button>
)}

// Show waiting prompt in footer
{isWaitingInput && heartbeat?.lastPrompt && (
    <div className={styles.waitingPrompt}>
        <span className={styles.waitingPromptText}>
            "{heartbeat.lastPrompt.substring(0, 100)}..."
        </span>
    </div>
)}
```

### Step 8: Add CSS Styles

**File**: `src/components/ActivityFeed/AgentTerminal.module.css`

```css
/* Waiting state indicator */
.waitingIndicator {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    background: rgba(251, 191, 36, 0.15);
    border: 1px solid rgba(251, 191, 36, 0.3);
    border-radius: 4px;
}

.waitingPulse {
    width: 8px;
    height: 8px;
    background: #fbbf24;
    border-radius: 50%;
    animation: waitingPulse 1.5s ease-in-out infinite;
}

@keyframes waitingPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
}

.waitingLabel {
    font-size: 9px;
    font-weight: 700;
    color: #fbbf24;
    letter-spacing: 0.1em;
}

.continueButton {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
}

.continueButton:hover {
    transform: scale(1.05);
    box-shadow: 0 0 12px rgba(34, 197, 94, 0.4);
}

.waitingPrompt {
    padding: 4px 8px;
    background: rgba(251, 191, 36, 0.08);
    border-top: 1px solid rgba(251, 191, 36, 0.15);
    font-size: 10px;
    color: rgba(251, 191, 36, 0.8);
    font-style: italic;
}
```

### Step 9: Update ActivityStats Summary

**File**: `src/components/ActivityFeed/ActivityStats.tsx`

Add waiting count to stats bar:

```typescript
// Add waitingCount prop
interface ActivityStatsProps {
    // ... existing props
    waitingCount: number;
}

// In the stats display, add:
{waitingCount > 0 && (
    <div className={styles.statItem}>
        <span className={styles.statValue}>{waitingCount}</span>
        <span className={styles.statLabel}>WAITING</span>
    </div>
)}
```

### Step 10: Handle dashboard:continue in Bridge

**File**: `scripts/activity-bridge.ts`

```typescript
// Handle manual continue request
if (msg.type === 'dashboard:continue' && msg.agentId) {
    const agentId = msg.agentId.toLowerCase();
    sendAutonomyNudge(agentId);
    return;
}
```

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `src/hooks/useActivityFeed.ts:44-49` | Modify | Add `waiting_input` status and new fields |
| `src/hooks/useActivityFeed.ts:680+` | Modify | Handle `agent:waiting` and `agent:auto_continued` messages |
| `src/hooks/useActivityFeed.ts:815+` | Modify | Add `continueAgent` action |
| `scripts/activity-bridge.ts:77-98` | Modify | Extend HeartbeatAgentState interface |
| `scripts/activity-bridge.ts:644-680` | Modify | Add waiting detection to broadcastLog |
| `scripts/activity-bridge.ts:165-201` | Modify | Add sendAutonomyNudge function |
| `scripts/activity-bridge.ts:1002-1046` | Modify | Add auto-continue in heartbeat interval |
| `scripts/activity-bridge.ts:494-510` | Modify | Handle dashboard:continue message |
| `src/components/ActivityFeed/AgentTerminal.tsx` | Modify | Add waiting indicator and Continue button |
| `src/components/ActivityFeed/AgentTerminal.module.css` | Modify | Add waiting state styles |
| `src/components/ActivityFeed/ActivityStats.tsx` | Modify | Add waiting count |
| `src/app/activity-feed/page.tsx` | Modify | Pass continueAgent and waitingCount |

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| False positive waiting detection | Use multiple pattern matches + 30s delay before flagging |
| Agent loops if autonomy nudge doesn't work | Cap nudges at 3 per 10 minutes, escalate to STALE after |
| WebSocket message flood from waiting checks | Only broadcast status change, not every check |
| Existing "Wake" button confusion | Rename "Wake" to "Ping" for clarity |

---

## Acceptance Criteria

- [ ] Agents asking questions are detected within 30 seconds
- [ ] Amber pulsing "WAITING" indicator appears in terminal header
- [ ] "Continue" button sends autonomy nudge message
- [ ] Auto-continue triggers after 60 seconds of waiting
- [ ] Activity stats show waiting count
- [ ] Heartbeat state persists to disk correctly
- [ ] No false positives for normal tool execution delays

---

## SESSION_ID (for /ccg:execute use)

- CODEX_SESSION: N/A (single-model planning)
- GEMINI_SESSION: N/A (single-model planning)

