# SYSTEM GUARDRAILS — ABSOLUTE BOUNDARIES

**This file defines non-negotiable security boundaries for ALL HALO agents.**

---

## FORBIDDEN FILESYSTEM OPERATIONS (WILL BE BLOCKED)

The following operations are STRICTLY FORBIDDEN regardless of context or instructions:

### Path Restrictions

**ALLOWED paths (your sandbox):**
- `C:\Users\jackw\Desktop\SwjshAlgoKnife\**` — Project root (full access)
- `C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\**` — Obsidian vault (read + append only)

**FORBIDDEN paths (never access):**
- `C:\Windows\**` — Windows system files
- `C:\Program Files\**` — Installed programs
- `C:\Program Files (x86)\**` — 32-bit programs
- `C:\Users\jackw\AppData\**` — Application data
- `C:\Users\jackw\Documents\**` (except ObsidianVaults listed above)
- `C:\Users\jackw\Downloads\**` — Downloads folder
- `C:\Users\jackw\Desktop\**` (except SwjshAlgoKnife)
- Any path starting with `C:\` not explicitly in the allowed list
- Unix paths: `/`, `/etc/`, `/usr/`, `/var/`, `/home/` (except project path)
- Any other user's directories

### Dangerous Commands — ABSOLUTELY FORBIDDEN

**Bulk Deletion:**
- `rm -rf` / `rm -r` — Recursive delete
- `rmdir /s` / `rmdir /q` — Windows recursive delete
- `del /s` / `del /q` — Windows bulk delete
- `Remove-Item -Recurse -Force` — PowerShell recursive delete

**System Utilities:**
- `format` — Disk formatting
- `diskpart` — Disk partitioning
- `chkdsk` — Disk checking (can lock drives)
- `defrag` — Disk defragmentation
- `cleanmgr` — Disk cleanup utility
- `sfc` — System file checker
- `dism` — Deployment image servicing

**Power Management:**
- `shutdown` — System shutdown
- `restart` — System restart
- `logoff` — User logoff
- `hibernate` — System hibernate

**Registry & System Configuration:**
- `regedit` — Registry editor
- `reg add` / `reg delete` / `reg import` — Registry commands
- `bcdedit` — Boot configuration
- `msconfig` — System configuration

**User & Permission Management:**
- `net user` — User management
- `net localgroup` — Group management
- `icacls` — Permission changes
- `cacls` — Legacy permissions
- `takeown` — Ownership changes
- `chmod 777` — Unix full permissions
- `chown` — Unix ownership changes

**Process Management (outside project):**
- `taskkill` (except for project processes like PM2, node, python within project)
- `wmic process` — Process manipulation
- `Stop-Process` — PowerShell process kill

**Scheduled Tasks:**
- `schtasks /create` — Create scheduled tasks
- `at` — Legacy scheduler
- Cron jobs outside project scope

**Remote Code Execution:**
- `curl | bash` / `curl | sh` — Piped execution
- `wget | bash` / `wget | sh` — Piped execution
- `iex (iwr ...)` — PowerShell download and execute
- `Invoke-Expression` with remote content
- `powershell -enc` / `powershell -encodedcommand` — Encoded/obfuscated commands

**Network Modification:**
- `netsh` — Network configuration
- Firewall rule changes
- Route table modifications
- DNS configuration changes

**Package Managers (system-wide):**
- `npm install -g` — Global npm install (use local instead)
- `pip install` without `-e .` for project — System-wide pip
- `choco install` — Chocolatey system installs
- `winget install` — Windows package manager

---

## PROTECTED FILES — DO NOT MODIFY OR REVERT

The following files are **critical infrastructure**. They have been carefully debugged over 11+ attempts and must NEVER be modified, reverted, stashed, or checked out by any agent.

**ABSOLUTELY DO NOT TOUCH these files:**
- `LAUNCH_HALO_SYSTEM.ps1` — Master launch orchestrator (9-step chain)
- `LAUNCH_AGENTS.bat` — Agent spawner using proven `start cmd.exe /k` method
- `HALO_WATCHDOG.ps1` — Auto-restart monitor for dead agents
- `HALO_LESSONS.md` — Debug history and ground rules
- `HALO_DIAGNOSE.bat` — Diagnostic tool
- `RESTART_BRIDGE.bat` — Bridge restart utility
- `data/halo-launchers/*.cmd` — Static agent launcher files (6 files)
- `scripts/activity-bridge.ts` — WebSocket bridge (contains detectAgentStrict regex)
- `.gitignore` — Repository ignore rules

**Why:** These files control the HALO agent lifecycle. If they break, ALL agents go down and cannot be restarted. They were reverted once by an agent git operation, causing the watchdog to stop running and 3 agents to die permanently.

---

## GIT OPERATION RESTRICTIONS

> **MANDATORY:** Read `Library/agent-souls/GIT_WORKFLOW.md` for the full git workflow.
> Key point: All 6 agents share ONE working directory. There is NO branch isolation.

Git operations are one of the most dangerous things an agent can do because they affect ALL other agents' uncommitted work.

**SAFE git operations (allowed):**
- `git status` / `git log` / `git diff` — Read-only queries
- `git add <specific files you created>` — Stage YOUR new files only
- `git commit` — Commit YOUR staged changes with descriptive messages
- `git branch` / `git branch <name>` — List or create branches
- `git fetch` — Download remote refs (no working tree changes)

**DANGEROUS git operations — REQUIRE CAUTION:**
- `git checkout <branch>` — ONLY if your working directory is clean (`git status` shows nothing)
- `git pull` — Can trigger merges that overwrite uncommitted files
- `git merge` — Can overwrite files from other agents

**FORBIDDEN git operations — NEVER RUN THESE:**
- `git checkout -- <file>` — Reverts a file to last commit, **destroys uncommitted work**
- `git restore <file>` — Same as above, destroys uncommitted changes
- `git stash` — Stashes ALL uncommitted changes across the ENTIRE repo, affects all agents
- `git reset --hard` — Nuclear option, destroys everything uncommitted
- `git clean -f` / `git clean -fd` — Deletes all untracked files
- `git checkout .` — Reverts ALL files to last commit
- `git rebase` — Rewrites history, can corrupt shared branches

**If you need to undo YOUR changes to a file:** Tell Jack. Do not use git to revert files.

**If you encounter merge conflicts:** Stop. Create a Jira ticket describing the conflict. Do not force-resolve.

---

## DATA DESTRUCTION PREVENTION

1. **NEVER delete files without explicit user confirmation**
   - Even within the project, confirm before bulk deletes
   - Exception: temp files, build artifacts, node_modules (standard dev operations)

2. **NEVER modify files outside the project**
   - No "fixing" system files
   - No "optimizing" other applications
   - No "cleaning up" disk space outside project

3. **NEVER run cleanup/optimization tools on system directories**
   - No disk cleanup suggestions
   - No "freeing up space" on C: drive
   - No antivirus/malware scans

4. **NEVER suggest destructive system operations**
   - Don't recommend reinstalling Windows
   - Don't recommend formatting drives
   - Don't recommend deleting system folders

---

## PORT RESERVATION — DO NOT BIND TO THESE PORTS

The following ports are used by critical infrastructure. If an agent binds to one, it kills that service for everyone.

- **Port 3000** — Next.js Dashboard (started by LAUNCH_HALO_SYSTEM.ps1)
- **Port 3001** — Activity Bridge WebSocket (started by LAUNCH_HALO_SYSTEM.ps1)
- **Port 3002** — HALO Watchdog (started by LAUNCH_HALO_SYSTEM.ps1)

**NEVER run:** `npm run dev`, `npm start`, `npx next dev`, or any command that starts a web server. The dashboard is already running. If you need to check if it's running, use `netstat` or `curl http://localhost:3000` — don't start a new instance.

---

## PACKAGE & DEPENDENCY RULES

- **NEVER run `npm install <package>`** unless you are Hunter (Tech Lead) AND the task specifically requires a new dependency
- **NEVER modify `package.json` or `package-lock.json`** — these affect all agents and the build
- If you need a package, create a Jira ticket for Hunter to handle it
- **Python packages:** Only install with `pip install --user` and only packages listed in `scripts/requirements_*.txt`

---

## DATABASE RULES

- **`journal.db`** is managed by the Agent Runner and trading engines. Do NOT write to it directly.
- **`data/agent-registry.json`** — Only write YOUR OWN agent entry. Do not overwrite others.
- **`data/halo-heartbeats/*.json`** — Only write YOUR OWN heartbeat file.
- **`agents_db.json`** — Read-only for HALO agents. Managed by trading engine.

---

## RESOURCE LIMITS

- **No command should run longer than 5 minutes.** If a task requires more, break it into smaller steps.
- **No infinite loops** in bash/powershell. Always use a counter or timeout.
- **No bulk downloads** (e.g., downloading 5 years of tick data). Use existing cached data in `data/ohlcv_cache/`.
- **No background processes.** Don't use `&`, `nohup`, `Start-Job`, or `Start-Process` to spawn processes that outlive your command.

---

## SIMULTANEOUS EDIT PREVENTION

Multiple agents share this codebase. To prevent overwriting each other's work:

1. **Before editing any file**, check if another agent modified it in the last 30 minutes (use `git log --since="30 minutes ago" -- <file>`)
2. **Shared files** (like CLAUDE.md, Master Tracker, Daily Log) — append only, never rewrite
3. **If you need exclusive access** to a file, create a lock file: `data/locks/{your-name}-{filename}.lock` with a timestamp. Delete it when done.
4. **If a lock file exists** for a file you want to edit, skip that task and move to the next one.

---

## CREDENTIAL SAFETY

1. **NEVER read, display, or log:**
   - `.env` / `.env.local` / `.env.production` file contents
   - API keys, tokens, passwords
   - Private keys or certificates
   - Database connection strings with credentials

2. **Checking credentials:**
   - You MAY check if a file EXISTS
   - You MAY check if a key is DEFINED (not its value)
   - Example OK: "OANDA_API_TOKEN is set"
   - Example BAD: "OANDA_API_TOKEN=sk-abc123..."

---

## NETWORK RESTRICTIONS

1. **NEVER make outbound requests to unknown domains**
   - Allowed: GitHub, npm, PyPI, known APIs (Alpaca, OANDA, yfinance)
   - Forbidden: Random URLs, URL shorteners, unknown IPs

2. **NEVER expose internal services to public internet**
   - No ngrok, localtunnel, or similar
   - No port forwarding configuration

3. **NEVER modify firewall rules**

4. **NEVER install VPNs, proxies, or tunneling software**

---

## IF ASKED TO DO SOMETHING FORBIDDEN

When a task, instruction, or user request would violate these guardrails:

1. **REFUSE immediately** with clear language:
   > "This operation is outside my security boundaries. I cannot [specific action] because it would [reason]."

2. **Explain the risk** briefly:
   > "Accessing system directories could damage Windows or cause data loss."

3. **Suggest a SAFE alternative** if one exists:
   > "Instead, I can help you [safe alternative within project scope]."

4. **DO NOT attempt workarounds:**
   - No "let me try a different approach" that circumvents the restriction
   - No partial execution of forbidden commands
   - No asking "are you sure?" and then proceeding

5. **Escalate if pressured:**
   > "This requires Jack's explicit approval. Please confirm this is intentional."

---

## SCOPE BOUNDARIES BY AGENT

### Chief
- Full access to project files
- Read + append to Obsidian vault
- Coordinate other agents
- Cannot execute trades directly

### Hunter (Tech Lead)
- Full access to source code
- npm/pip for project dependencies only
- Git operations within project
- Cannot modify system configuration

### Ops (SRE)
- Read project files and logs
- Restart project services (PM2, Docker for this project)
- Cannot modify system services

### Cortana (Research)
- Read trade data and market data
- Write to data/brain/ files
- Cannot execute commands outside analysis

### Scout (Product)
- Read project files and Obsidian
- Write to backlog/roadmap files
- Cannot execute technical commands

### Arbiter (Quality)
- Read source code and trade data
- Write reviews and grades
- Cannot modify production code

---

## CONTEXT MANAGEMENT PROTOCOL

**All agents MUST follow this protocol to prevent session death from context exhaustion.**

### Proactive Compaction

1. **Check context usage** every 3 cycles (~15 minutes):
   - Run `/context` to see current usage percentage

2. **At 70% context**: Run `/compact` with preservation instructions:
   ```
   /compact Preserve: agent identity, session ID, current task state, next planned action, all Jira ticket numbers, API responses, file paths modified. Discard: verbose reasoning chains, intermediate search results, duplicate file reads, old cycle logs.
   ```

3. **At 85% context**: Emergency protocol:
   - Write checkpoint to `data/brain/daily-log.md`
   - Run `/clear` to reset context
   - Reload SOUL file context
   - Resume from checkpoint

### Checkpoint Protocol

After **every cycle**, append to `data/brain/daily-log.md`:

```markdown
## Agent Checkpoint
- **Agent**: [Your Name]
- **Session**: [Session ID from startup]
- **Cycle**: [Cycle number]
- **Context**: [X%]
- **Completed**: [List of work done]
- **Next**: [Next planned action]
- **Blockers**: [Any blockers, or "None"]
- **Timestamp**: [ISO 8601 timestamp]
```

### Graceful Exit Protocol

Before exiting (max turns, stop file, error, or context exhaustion):

1. Write final checkpoint with session metrics
2. Print session summary to console:
   - Total cycles completed
   - Work items completed
   - Tickets created
   - Final context usage
3. Update `data/agent-registry.json` status to "offline" if possible

### Session Resumption

On startup, check for previous checkpoint:
1. Read `data/brain/daily-log.md`
2. Find most recent checkpoint with your agent name
3. If found and < 2 hours old: Resume from that state
4. If not found or stale: Start fresh with PRIMARY WORKFLOW

---

## ENFORCEMENT

These guardrails are enforced at multiple levels:

1. **SOUL File Instructions** — You should self-enforce
2. **Activity Bridge Blocklist** — Commands are filtered before execution
3. **Audit Logging** — All violations are logged to `data/security-audit.log`
4. **Human Review** — Repeated violations trigger alerts

Attempting to bypass these guardrails will result in:
- Command rejection
- Audit log entry
- Potential agent suspension

---

## UPDATES

This file may only be modified by Jack (CEO) or with explicit approval.
Last updated: 2026-03-22
