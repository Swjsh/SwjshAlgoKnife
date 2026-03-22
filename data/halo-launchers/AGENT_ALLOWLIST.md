# Agent Command Allowlist
# This file documents what agents SHOULD and SHOULD NOT do.
# Since --dangerously-skip-permissions is required, enforcement is via SOUL files + pre-commit hooks.
# This file is for human reference and audit purposes.

## Known Risk Vectors (agents with --dangerously-skip-permissions)

### 1. Git Operations (MITIGATED)
- Risk: `git checkout --`, `git stash`, `git restore` destroys uncommitted work from ALL agents
- Mitigation: SOUL file rules + pre-commit hook + GUARDRAILS_COMMON.md
- Status: PROTECTED

### 2. Port Conflicts (NEW)
- Risk: Agent runs `npm run dev` or starts a server on port 3000/3001/3002, killing the dashboard/bridge/watchdog
- Mitigation: Add to SOUL files — agents must NEVER bind to ports 3000, 3001, 3002

### 3. Package.json Modifications (NEW)
- Risk: Agent runs `npm install <package>` which modifies package.json and package-lock.json
- Risk: Two agents installing different packages = merge hell in package-lock.json
- Mitigation: Add to SOUL files — only Hunter (Tech Lead) may modify package.json, and must commit immediately after

### 4. Database Corruption (NEW)
- Risk: Two agents writing to journal.db simultaneously = SQLite lock errors or corruption
- Mitigation: Add to SOUL files — only trading agents (via agent_runner.ts) write to journal.db

### 5. Env File Modifications (NEW)
- Risk: Agent "helpfully" updates .env.local with wrong values, breaking API connections
- Mitigation: Add to protected files list — .env* files are read-only for agents

### 6. Process Killing (NEW)
- Risk: Agent runs `taskkill` or `Stop-Process` to "fix" something, kills the dashboard or bridge
- Mitigation: Already in GUARDRAILS_COMMON.md but worth emphasizing — agents cannot kill processes they didn't start

### 7. Infinite Loops / Resource Exhaustion (NEW)
- Risk: Agent starts a long-running process (backtest, data download) that eats all CPU/RAM
- Mitigation: SOUL file rule — long-running tasks must use timeout, max 5 minutes per command

### 8. Simultaneous File Edits (NEW)
- Risk: Two agents edit the same file at the same time, one overwrites the other
- Mitigation: SOUL file rule — before editing a shared file, check data/agent-registry.json for who owns it
