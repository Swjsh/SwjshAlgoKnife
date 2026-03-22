# HALO Agent Git Workflow — MANDATORY FOR ALL AGENTS

**Last Updated:** 2026-03-22
**Authority:** Jack (CEO) — only Jack can modify this file.

---

## THE GOLDEN RULE

> **All 6 HALO agents share ONE working directory. There is NO branch isolation.**
> Any git operation that changes the working tree affects EVERY agent.
> When in doubt, DON'T touch git. Just write code and let Jack handle git.

---

## BRANCHING STRATEGY: Trunk-Based Development

We use **trunk-based development** on a single development branch.

### Why NOT feature branches per agent?
All 6 agents share the same filesystem. If Hunter runs `git checkout fix/INFRA-28`,
every file Cortana, Scout, Chief, Ops, and Arbiter are working on gets changed.
Feature branches only work when each developer has their own working copy.

### The Branch Structure

```
master (stable, deployable)
  └── dev (daily work happens here — all agents work on this branch)
```

- **`master`** — Stable, tested, deployable. Only updated via merge from `dev` by Jack.
- **`dev`** — Active development branch. All agents commit here. Merged to master periodically.

### What This Means for Agents

1. **NEVER run `git checkout`** — You are always on `dev`. Period.
2. **NEVER create new branches** — All work goes on `dev`.
3. **NEVER merge or rebase** — Jack handles all merges to master.
4. **Just commit your work** — Small, frequent commits to `dev`.

---

## COMMIT RULES

### Who Can Commit What

| Agent | Can Commit | Cannot Commit |
|-------|-----------|---------------|
| **Hunter** | Source code (`src/`, `scripts/`), tests, config | Infrastructure files, SOUL files |
| **Arbiter** | Code review notes (`data/reviews/`), grade files | Source code (read-only) |
| **Chief** | Management docs, Master Tracker updates | Source code, infrastructure |
| **Ops** | Monitoring configs, health check scripts | Source code, infrastructure |
| **Cortana** | Research data (`data/brain/`), analysis files | Source code, infrastructure |
| **Scout** | Backlog docs, roadmap files | Source code, infrastructure |

### Commit Message Format

```
<type>(<scope>): <description>

[Optional body — what and why, not how]

Agent: <agent-name>
Ticket: <JIRA-KEY>
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `data`
**Scopes:** Jira project key or component name

**Examples:**
```
feat(INFRA-26): implement Bitcoin Bob SHORT filter

Agent: Hunter
Ticket: INFRA-26

docs(MGMT-13): update sprint velocity tracking

Agent: Chief
Ticket: MGMT-13

data(LEARN-19): add cross-asset SHORT bias analysis

Agent: Cortana
Ticket: LEARN-19
```

### Commit Frequency

- **Hunter:** After each completed subtask (not after each file edit)
- **Cortana/Scout:** After each research cycle or document update
- **Chief:** After each management document update
- **Ops:** After each monitoring config change
- **Arbiter:** After each code review is written

### Before EVERY Commit

```bash
# 1. Check status — are there OTHER agents' uncommitted changes?
git status

# 2. Only stage YOUR files — NEVER use `git add .` or `git add -A`
git add src/specific/file.ts

# 3. Commit with proper message
git commit -m "feat(INFRA-26): implement SHORT filter

Agent: Hunter
Ticket: INFRA-26"
```

**CRITICAL:** Never use `git add .` or `git add -A`. These will stage every
modified file in the repo, including other agents' uncommitted work, runtime
state files, and potentially secrets.

---

## PROTECTED FILES — PRE-COMMIT HOOK ENFORCED

These files are blocked by the pre-commit hook. Only Jack can modify them
(using `git commit --no-verify`):

- `LAUNCH_HALO_SYSTEM.ps1`
- `LAUNCH_AGENTS.bat`
- `HALO_WATCHDOG.ps1`
- `HALO_DIAGNOSE.bat`
- `RESTART_BRIDGE.bat`
- `data/halo-launchers/*.cmd`

---

## FILES THAT SHOULD NOT BE IN GIT

The following are runtime state files. They should be in `.gitignore`:

- `data/halo-heartbeats/*.json` — Agent heartbeat state
- `data/locks/*.lock` — File lock system
- `data/agent-registry.json` — Runtime agent registry
- `agent_logs.json` — Runtime logs
- `agent_state/*.json` — Trading agent runtime state
- `data/ops/*.json` — Ops monitoring state
- `data/sentinel/*.json` — Sentinel state

---

## WHAT TO DO WHEN THINGS GO WRONG

### "I see uncommitted changes from another agent"
→ STOP. Do not commit, do not checkout, do not stash. Continue your own work.
   The other agent will commit their own changes.

### "I have a merge conflict"
→ STOP. Create a Jira ticket: "INFRA: Merge conflict in {filename}".
   Do NOT resolve it yourself. Wait for Jack.

### "I accidentally staged the wrong files"
→ Run `git reset HEAD <file>` to unstage. This is SAFE — it doesn't delete anything.

### "I need to undo my last commit"
→ Tell Jack. Do NOT run `git reset` or `git revert` yourself.

### "Git says HEAD.lock exists"
→ A previous git operation crashed. Create a Jira ticket: "INFRA: Stale git lock file".
   Do NOT delete the lock file yourself.

### "I want to see what's on another branch"
→ Use `git log <branch> --oneline -10` or `git show <branch>:<file>` — these are READ-ONLY
   and don't change the working tree.

---

## JACK'S WORKFLOW (Human — not for agents)

Jack handles all branch management:

1. **Periodic merge to master:**
   ```bash
   git checkout master
   git merge dev --no-ff -m "Merge dev: sprint X summary"
   git push origin master
   git checkout dev
   ```

2. **Cleanup stale branches:**
   ```bash
   git branch -d <merged-branch>
   git push origin --delete <merged-branch>
   ```

3. **Emergency rollback:**
   ```bash
   git checkout master
   git revert <bad-commit>
   git push origin master
   ```

4. **Protected file changes:**
   ```bash
   git add LAUNCH_HALO_SYSTEM.ps1
   git commit --no-verify -m "infra: update launch chain"
   ```

---

## ENFORCEMENT

1. **SOUL files** — Every agent reads this workflow on startup
2. **Pre-commit hook** — Blocks protected file commits
3. **GUARDRAILS_COMMON.md** — Comprehensive safety rules
4. **Audit** — Git log is reviewed for compliance
