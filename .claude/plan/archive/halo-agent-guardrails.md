# HALO Agent Guardrails - Implementation Plan

## Problem Statement

A HALO agent suggested cleaning up the C: drive during autonomous operation. This is a critical boundary violation - autonomous agents should NEVER be able to perform system-wide destructive operations that could damage the host PC.

**Root Cause Analysis:**
1. Current SOUL files define "NEVER" rules but these are advisory only - they rely on the LLM following instructions
2. No technical enforcement layer exists to prevent dangerous commands
3. No allowlist/blocklist for Bash commands at the activity-bridge or agent-runner level
4. Auto-continue nudge system (`CONTINUE: You are operating in AUTONOMOUS mode...`) can trigger agents to proceed with risky actions without human approval

## Security Principles

1. **Defense in Depth**: Multiple layers of protection, not just prompt instructions
2. **Least Privilege**: Agents should only access what they need for their domain
3. **Fail Safe**: If uncertain, block the action and alert
4. **Auditability**: Log all blocked actions for review

---

## Implementation Plan

### Phase 1: Immediate SOUL File Updates (Priority: CRITICAL)

Add explicit system guardrails to ALL HALO agent SOUL files.

#### 1.1 Create Shared Guardrails Include File

**File**: `Library/agent-souls/GUARDRAILS_COMMON.md`

```markdown
# SYSTEM GUARDRAILS — ABSOLUTE BOUNDARIES

## FORBIDDEN FILESYSTEM OPERATIONS (WILL BE BLOCKED)

The following operations are STRICTLY FORBIDDEN regardless of context:

### Path Restrictions
- NEVER operate outside the project directory: `C:\Users\jackw\Desktop\SwjshAlgoKnife\`
- NEVER access: `C:\Windows\`, `C:\Program Files\`, `C:\Users\jackw\AppData\`, `C:\Users\jackw\Documents\` (except ObsidianVaults)
- NEVER access: `/`, `/etc/`, `/usr/`, `/var/`, `/home/` (Unix paths)
- NEVER access other users' directories or system directories

### Dangerous Commands — ABSOLUTELY FORBIDDEN
- `rm -rf` / `rmdir /s` / `del /s` — bulk delete
- `format` — disk formatting
- `diskpart` — disk partitioning
- `shutdown` / `restart` — system power commands
- `regedit` / `reg` — Windows registry
- `taskkill` (except for project processes)
- `net user` / `net localgroup` — user management
- `icacls` / `chmod 777` / `attrib` — permission changes
- `chown` / `takeown` — ownership changes
- `mklink` / `ln -s` outside project — symlinks
- `curl | bash` / `iex (iwr ...)` — remote code execution
- `powershell -enc` — encoded commands (obfuscation)
- `schtasks` / `cron` — scheduled tasks outside project
- Package managers with `-y` / `--yes` flags for system-wide installs

### Data Destruction Prevention
- NEVER delete files without explicit user confirmation
- NEVER modify files outside the project
- NEVER run cleanup/optimization tools on system directories
- NEVER suggest "freeing up disk space" by deleting system files

### Network Restrictions
- NEVER make outbound requests to unknown domains
- NEVER expose internal services to public internet
- NEVER modify firewall rules
- NEVER install VPNs, proxies, or tunneling software

## IF ASKED TO DO SOMETHING FORBIDDEN

1. REFUSE immediately with: "This operation is outside my security boundaries."
2. Explain WHY it's forbidden (system safety)
3. Suggest a SAFE alternative if one exists
4. DO NOT attempt any workaround

## SCOPE BOUNDARIES

You are authorized to operate ONLY within:
- Project root: `C:\Users\jackw\Desktop\SwjshAlgoKnife\**`
- Obsidian vault (read + append only): `C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\**`
- npm/pip packages for the project only
- PM2 processes for this project only
- Docker containers started by this project only

Everything else requires EXPLICIT human approval.
```

#### 1.2 Update Each SOUL File

Add to the top of each agent's SOUL file:

```markdown
---
**CRITICAL: Read `Library/agent-souls/GUARDRAILS_COMMON.md` before ANY filesystem or system operation.**
---
```

And add this section after the "NEVER" list in each SOUL:

```markdown
### SYSTEM SAFETY (NON-NEGOTIABLE)

In addition to domain-specific rules, the following system-level restrictions apply to ALL actions:

1. **Filesystem**: Only operate within `C:\Users\jackw\Desktop\SwjshAlgoKnife\`
2. **Deletion**: NEVER delete files without human confirmation
3. **System Tools**: NEVER run system utilities (disk cleanup, defrag, antivirus scans, etc.)
4. **Installations**: NEVER install system-wide software
5. **Credentials**: NEVER read, copy, or display .env files, API keys, or credentials
6. **Network**: NEVER modify network settings or firewall rules
7. **Processes**: NEVER kill processes outside this project

If any task requires violating these rules, STOP and escalate to CEO/Jack.
```

---

### Phase 2: Technical Enforcement Layer (Priority: HIGH)

#### 2.1 Command Blocklist in Activity Bridge

**File**: `scripts/activity-bridge.ts` (new section)

Add a command filter that blocks dangerous patterns before they reach the agent:

```typescript
// ─── Command Safety Filter ────────────────────────────────────────────────────

const BLOCKED_COMMAND_PATTERNS: RegExp[] = [
  // Bulk deletion
  /rm\s+-rf?\s+[\/\\]/i,
  /rmdir\s+\/s/i,
  /del\s+\/[sq]/i,
  /Remove-Item.*-Recurse.*-Force/i,

  // System directories
  /[cC]:\\Windows/,
  /[cC]:\\Program Files/,
  /[cC]:\\Users\\[^\\]+\\AppData/,
  /\/etc\//,
  /\/usr\//,
  /\/var\//,

  // Dangerous system commands
  /\bformat\s+[a-zA-Z]:/i,
  /\bdiskpart\b/i,
  /\bshutdown\b/i,
  /\brestart\b.*-f/i,
  /\bregedit\b/i,
  /\breg\s+(add|delete|import)/i,
  /\bnet\s+(user|localgroup)/i,
  /\bschtasks\s+\/create/i,

  // Remote code execution
  /curl.*\|\s*(bash|sh|python)/i,
  /wget.*\|\s*(bash|sh|python)/i,
  /iex\s*\(.*iwr/i,
  /powershell.*-enc/i,
  /Invoke-Expression.*Download/i,

  // Permission changes
  /chmod\s+777/,
  /icacls.*\/grant.*Everyone/i,
  /takeown\s+\/f/i,

  // Package managers with auto-confirm on system paths
  /npm\s+install\s+-g/i,  // Global npm (suggest local instead)
  /pip\s+install(?!.*-e\s+\.).*--user/i,  // Only allow project-local pip
];

const BLOCKED_PATH_PATTERNS: RegExp[] = [
  /^[cC]:\\(?!Users\\jackw\\Desktop\\SwjshAlgoKnife)/,  // Outside project
  /^\/(?!home\/jackw\/SwjshAlgoKnife)/,                  // Unix outside project
  /\.\.\/.*\.\.\//,                                       // Path traversal
];

function isCommandBlocked(command: string): { blocked: boolean; reason: string } {
  for (const pattern of BLOCKED_COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      return {
        blocked: true,
        reason: `Command matches blocked pattern: ${pattern.source.substring(0, 50)}...`
      };
    }
  }

  for (const pattern of BLOCKED_PATH_PATTERNS) {
    if (pattern.test(command)) {
      return {
        blocked: true,
        reason: `Path outside allowed boundaries`
      };
    }
  }

  return { blocked: false, reason: '' };
}

function sanitizeAndLogCommand(agentId: string, command: string): boolean {
  const check = isCommandBlocked(command);

  if (check.blocked) {
    console.error(`[SECURITY] BLOCKED command from ${agentId}: ${check.reason}`);
    console.error(`[SECURITY] Command was: ${command.substring(0, 200)}...`);

    // Log to audit file
    const auditEntry = {
      timestamp: new Date().toISOString(),
      agentId,
      command: command.substring(0, 500),
      reason: check.reason,
      action: 'BLOCKED'
    };

    fs.appendFileSync(
      path.join(process.cwd(), 'data', 'security-audit.log'),
      JSON.stringify(auditEntry) + '\n'
    );

    return false;
  }

  return true;
}
```

#### 2.2 Add Enforcement to enqueueCommand()

Modify the `enqueueCommand` function:

```typescript
function enqueueCommand(agentId: string, command: string): CommandEntry | null {
  // Security check FIRST
  if (!sanitizeAndLogCommand(agentId, command)) {
    // Return null to indicate command was blocked
    console.log(`[Bridge] BLOCKED dangerous command for ${agentId}`);
    return null;
  }

  // ... existing code ...
}
```

---

### Phase 3: Pre-Flight Confirmation for Destructive Actions

#### 3.1 Add Confirmation Gate to Activity Bridge

For commands that might be destructive but aren't outright blocked, require explicit confirmation:

```typescript
const REQUIRES_CONFIRMATION_PATTERNS: RegExp[] = [
  /rm\s+/i,
  /del\s+/i,
  /Remove-Item/i,
  /drop\s+table/i,
  /truncate/i,
  /git\s+(reset|clean|checkout)\s+--hard/i,
  /npm\s+uninstall/i,
  /pip\s+uninstall/i,
];

interface PendingConfirmation {
  id: string;
  agentId: string;
  command: string;
  requestedAt: string;
  expiresAt: string;
}

const pendingConfirmations: Map<string, PendingConfirmation> = new Map();

function requiresConfirmation(command: string): boolean {
  return REQUIRES_CONFIRMATION_PATTERNS.some(p => p.test(command));
}
```

#### 3.2 Dashboard Alert for Pending Confirmations

Add API endpoint and UI component to show pending confirmations that need human approval.

---

### Phase 4: Audit and Monitoring

#### 4.1 Security Audit Log

**File**: `data/security-audit.log`

All blocked commands and confirmations logged as JSONL:

```json
{"timestamp":"2026-03-22T10:00:00Z","agentId":"cortana","command":"rm -rf /","reason":"Matches bulk delete pattern","action":"BLOCKED"}
{"timestamp":"2026-03-22T10:01:00Z","agentId":"ops","command":"del C:\\Windows\\temp\\*","reason":"Path outside allowed boundaries","action":"BLOCKED"}
```

#### 4.2 Dashboard Security Widget

Add a security events widget to the Activity Feed showing:
- Recent blocked commands (last 24h)
- Pending confirmations
- Agents with repeated block attempts (potential prompt injection)

---

### Phase 5: Auto-Continue Safeguards

#### 5.1 Modify the CONTINUE Nudge Logic

Currently in activity-bridge.ts (~line 270):

```typescript
const CONTINUE_MESSAGE = `CONTINUE: You are operating in AUTONOMOUS mode per your SOUL file.
Do not wait for human approval. Execute your PRIMARY WORKFLOW now.`;
```

**Change to:**

```typescript
const CONTINUE_MESSAGE = `CONTINUE: You are operating in AUTONOMOUS mode per your SOUL file.

REMINDER: Your autonomy is LIMITED to your assigned domain within the SwjshAlgoKnife project.
- You may NOT perform system-wide operations
- You may NOT delete files without confirmation
- You may NOT access paths outside the project
- When in doubt, wait for human approval

Execute your PRIMARY WORKFLOW now, within these boundaries.`;
```

#### 5.2 Add Watchdog for Auto-Continue

Track how many times an agent has been auto-continued. If it exceeds threshold without producing useful output, pause and alert:

```typescript
const AUTO_CONTINUE_LIMIT = 5;  // Max auto-continues before requiring human check

interface AgentContinueTracker {
  agentId: string;
  continueCount: number;
  lastContinue: string;
  lastUsefulOutput: string | null;
}

function shouldAutoNudge(agentId: string, tracker: AgentContinueTracker): boolean {
  if (tracker.continueCount >= AUTO_CONTINUE_LIMIT) {
    console.warn(`[Bridge] Agent ${agentId} has been auto-nudged ${tracker.continueCount} times. Pausing for human review.`);
    return false;
  }
  return true;
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `Library/agent-souls/GUARDRAILS_COMMON.md` | NEW FILE - shared guardrails |
| `Library/agent-souls/*_SOUL.md` (all 6) | Add include + system safety section |
| `openclaw-setup/workspace/SOUL.md` | Add system safety section |
| `scripts/activity-bridge.ts` | Add command blocklist, confirmation gate |
| `src/app/api/commands/route.ts` | Add security check before processing |
| `data/security-audit.log` | NEW FILE - audit trail |
| `src/components/ActivityFeed/SecurityWidget.tsx` | NEW - dashboard component |

---

## Testing Plan

1. **Unit Tests**: Test blocklist patterns against known-bad commands
2. **Integration Test**: Attempt to queue a blocked command via API - verify rejection
3. **Manual Test**: Have a HALO agent receive a task that would require system access - verify it refuses
4. **Regression Test**: Ensure normal agent operations (file edits within project, npm install for project) still work

---

## Rollout Plan

1. **Immediate** (Day 1): Add GUARDRAILS_COMMON.md and update SOUL files
2. **Day 2**: Implement command blocklist in activity-bridge.ts
3. **Day 3**: Add confirmation gate and audit logging
4. **Day 4**: Update auto-continue logic with safeguards
5. **Day 5**: Add dashboard security widget

---

## Success Criteria

- No agent can execute commands that modify system directories
- All blocked commands are logged with full audit trail
- Agents explicitly refuse system-level requests in their responses
- Dashboard shows security events in real-time
- Auto-continue cannot force an agent past the safety boundary

---

## SESSION_ID

- CODEX_SESSION: N/A (Claude-only planning)
- GEMINI_SESSION: N/A (Claude-only planning)
