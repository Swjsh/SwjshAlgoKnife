# AutoResearch Session: SECURITY_AUDITOR
# Terminal: 5
# Run Tag: overnight-2026-03-22
# Reference: https://github.com/karpathy/autoresearch

---

## ⚠️ CRITICAL: AutoResearch Protocol

This session follows Karpathy's AutoResearch methodology EXACTLY.

### Core Rules:
1. **Git commit BEFORE every experiment** - `git commit -am "experiment: <description>"`
2. **Measure AFTER every experiment** - Extract single metric
3. **Keep or Discard** - If metric improved → KEEP, if same/worse → `git reset --hard <prev>`
4. **Log to results.tsv** - Every experiment gets logged
5. **NEVER STOP** - Run indefinitely until `.claude/overnight/STOP` file exists
6. **Simplicity Criterion** - Simpler is better, all else equal

### Session Setup:
```bash
# 1. Create branch
git checkout -b autoresearch/security_auditor/overnight-2026-03-22

# 2. Initialize results.tsv (if not exists)
if [ ! -f results.tsv ]; then
    echo -e "commit\tmetric\tmemory_gb\tstatus\tdescription" > results.tsv
fi

# 3. Note starting commit
START_COMMIT=$(git rev-parse --short HEAD)
echo "Starting commit: $START_COMMIT"
```

---


---

## Program (Your Instructions)


# SECURITY_AUDITOR Program

> AutoResearch-compliant program for autonomous security vulnerability detection and remediation.
> Reference: https://github.com/karpathy/autoresearch

---

## Setup

To set up a new SECURITY_AUDITOR experiment session:

1. **Agree on a run tag**: e.g., `overnight-2026-03-22`

2. **Create the branch**:
   ```bash
   git checkout -b autoresearch/security-auditor/<tag>
   ```

3. **Read in-scope files**:
   ```
   src/lib/*                 # Core library code (auth, db, encryption)
   src/app/api/*             # API routes (auth, webhooks, data handling)
   scripts/*                 # Python/TypeScript scripts (credentials, executors)
   src/middleware.ts         # Request middleware (if exists)
   .env.example              # Environment variable patterns
   ```

4. **Initialize results.tsv**:
   ```bash
   echo -e "commit\tvulns_fixed\tseverity_high\tseverity_med\tseverity_low\tsecrets_found\tstatus\tdescription" > results.tsv
   ```

5. **Establish baseline**:
   ```bash
   BASELINE_COMMIT=$(git rev-parse --short HEAD)
   npm audit --json > /tmp/npm_audit.json 2>/dev/null || true
   BASELINE_VULNS=$(cat /tmp/npm_audit.json | jq -r '.metadata.vulnerabilities.total // 0')
   SECRETS_FOUND=$(grep -rE "(password|secret|api_key|token)\s*=\s*['\"][^'\"]+['\"]" src/ scripts/ --include="*.ts" --include="*.tsx" --include="*.py" --include="*.js" 2>/dev/null | wc -l)
   echo -e "${BASELINE_COMMIT}\t0\t0\t0\t0\t${SECRETS_FOUND}\tbaseline\tinitial security state" >> results.tsv
   ```

---

## What You CAN Do

You are authorized to modify files to fix security vulnerabilities:

- **Library files** (`src/lib/*`):
  - Fix SQL injection vulnerabilities in `db.ts`
  - Add input validation/sanitization
  - Improve authentication logic
  - Add rate limiting utilities
  - Fix XSS vulnerabilities in output encoding
  - Remove hardcoded secrets, replace with env vars

- **API routes** (`src/app/api/*`):
  - Add missing authentication checks
  - Add input validation on all endpoints
  - Add CSRF protection
  - Add rate limiting
  - Fix improper error handling that leaks info
  - Sanitize user input before database queries
  - Add proper CORS configuration

- **Scripts** (`scripts/*`):
  - Remove hardcoded credentials
  - Add credential validation
  - Fix insecure file operations
  - Add input sanitization for external data
  - Fix command injection vulnerabilities

- **Allowed modifications**:
  - Add/fix authentication middleware
  - Implement authorization checks
  - Add input validation schemas (Zod, etc.)
  - Replace hardcoded secrets with env vars
  - Add parameterized queries
  - Implement rate limiting
  - Add security headers
  - Fix OWASP Top 10 vulnerabilities
  - Add logging for security events

---

## What You CANNOT Do

The following are STRICTLY FORBIDDEN:

- **DO NOT** introduce new dependencies (use existing packages)
- **DO NOT** modify database schema (`src/lib/db.ts` structure)
- **DO NOT** break existing functionality while fixing security issues
- **DO NOT** delete legitimate test files
- **DO NOT** modify `.env` files (only `.env.example`)
- **DO NOT** expose real secrets in commits (use placeholders)
- **DO NOT** change the API contract (input/output shapes)
- **DO NOT** remove features - only make them secure
- **DO NOT** modify `CLAUDE.md` or `package.json` dependencies
- **DO NOT** ask the human for guidance - THINK HARDER and keep working

---

## The Goal

**Maximize vulnerabilities_remediated (count of security fixes applied).**

This is measured by counting successful security improvements:

| Category | Points Per Fix | Detection Method |
|----------|----------------|------------------|
| Hardcoded secret removed | 3 | grep for secrets pattern |
| SQL injection fixed | 3 | parameterized query added |
| XSS vulnerability fixed | 2 | output encoding added |
| Missing auth check added | 2 | auth middleware present |
| Input validation added | 1 | validation schema present |
| Rate limiting added | 1 | rate limit middleware present |
| CSRF protection added | 1 | CSRF token verified |
| npm audit vuln reduced | 1 | npm audit shows fewer vulns |

**Your target**: HIGHEST POSSIBLE vulnerabilities_remediated count

The ONLY metric that matters is total vulnerabilities fixed. Each fix must:
1. Actually address a real security concern
2. Not break existing functionality
3. Pass build and tests

---

## Experiment Loop

```
LOOP FOREVER:

1. NOTE CURRENT STATE
   PREV_COMMIT=$(git rev-parse --short HEAD)
   PREV_VULNS=$(tail -1 results.tsv | cut -f2)

2. SCAN FOR VULNERABILITIES
   Run security scans:
   - npm audit --json > /tmp/npm_audit.json
   - grep for hardcoded secrets patterns
   - grep for SQL string concatenation
   - grep for innerHTML/dangerouslySetInnerHTML without sanitization
   - grep for missing auth checks in API routes
   - Check for missing input validation

3. IDENTIFY TARGET VULNERABILITY
   Pick ONE vulnerability to fix (start with highest severity)

4. MAKE EXPERIMENTAL FIX
   - Read the vulnerable file
   - Implement security fix
   - Ensure fix doesn't break functionality

5. COMMIT IMMEDIATELY
   git add -A
   git commit -m "security: <brief description of fix>"
   NEW_COMMIT=$(git rev-parse --short HEAD)

6. RUN VALIDATION
   npm run build
   if build fails: goto step 9 (discard)

   npm test (if tests exist)
   if tests fail: goto step 9 (discard)

7. VERIFY FIX
   Re-run the scan that detected the vulnerability
   If vulnerability still present: goto step 9 (discard)

8. EXTRACT METRIC
   NEW_VULNS=$((PREV_VULNS + 1))  # Increment fixed count
   Categorize: HIGH, MEDIUM, or LOW severity
   Check for secrets: SECRETS_FOUND=$(grep count)

   STATUS="keep"
   Log: "KEEP: ${NEW_COMMIT} fixed vulnerability (total: ${NEW_VULNS})"

9. DISCARD IF NOT VALID
   If STATUS != "keep":
     STATUS="discard"
     git reset --hard ${PREV_COMMIT}
     Log: "DISCARD: fix broke build/tests or didn't resolve vulnerability"

10. LOG TO results.tsv
    echo -e "${NEW_COMMIT}\t${NEW_VULNS}\t${HIGH}\t${MED}\t${LOW}\t${SECRETS}\t${STATUS}\t<description>" >> results.tsv

11. NEVER STOP - GOTO STEP 1
```

---

## Security Scan Commands

```bash
# NPM vulnerability audit
npm audit --json 2>/dev/null | jq '.metadata.vulnerabilities'

# Hardcoded secrets detection
grep -rE "(password|secret|api_key|apikey|token|credential)\s*[=:]\s*['\"][^'\"]{8,}['\"]" \
  src/ scripts/ --include="*.ts" --include="*.tsx" --include="*.py" --include="*.js"

# SQL injection patterns (string concatenation in queries)
grep -rE "query\s*\(\s*['\"].*\+.*['\"]" src/ scripts/ --include="*.ts" --include="*.py"
grep -rE "SELECT.*\+.*FROM|INSERT.*\+.*INTO|UPDATE.*\+.*SET|DELETE.*\+.*WHERE" src/ scripts/

# XSS vulnerable patterns
grep -rE "innerHTML|dangerouslySetInnerHTML|document\.write" src/ --include="*.ts" --include="*.tsx"

# Missing auth check in API routes
grep -rL "getServerSession|auth|authenticate" src/app/api/**/*.ts

# Eval/exec patterns (code injection)
grep -rE "\beval\(|\bexec\(|Function\(" src/ scripts/ --include="*.ts" --include="*.py" --include="*.js"

# Insecure file operations
grep -rE "fs\.(readFile|writeFile|unlink|rmdir).*\+" src/ scripts/

# Missing input validation
grep -rL "z\.|zod|validate|sanitize" src/app/api/**/*.ts
```

---

## OWASP Top 10 Checklist

For each API route, verify:

- [ ] **A01:2021 Broken Access Control** - Auth check present
- [ ] **A02:2021 Cryptographic Failures** - Secrets not hardcoded
- [ ] **A03:2021 Injection** - Input sanitized, queries parameterized
- [ ] **A04:2021 Insecure Design** - Rate limiting present
- [ ] **A05:2021 Security Misconfiguration** - Error messages don't leak info
- [ ] **A06:2021 Vulnerable Components** - npm audit clean
- [ ] **A07:2021 Auth Failures** - Session handling secure
- [ ] **A08:2021 Data Integrity** - CSRF protection present
- [ ] **A09:2021 Logging Failures** - Security events logged
- [ ] **A10:2021 SSRF** - URL validation on external requests

---

## Simplicity Criterion

When evaluating whether to KEEP a security fix:

**Track complexity metrics:**
```bash
LINES_ADDED=$(git diff --stat HEAD~1 | tail -1 | awk '{print $4}')
LINES_REMOVED=$(git diff --stat HEAD~1 | tail -1 | awk '{print $6}')
FILES_TOUCHED=$(git diff --name-only HEAD~1 | wc -l)
COMPLEXITY_DELTA=$((LINES_ADDED - LINES_REMOVED))
```

**Decision Matrix:**

| Vuln Severity | Complexity Delta | Decision |
|---------------|------------------|----------|
| HIGH/CRITICAL | Any | KEEP (security trumps complexity) |
| MEDIUM | <= +100 | KEEP (acceptable overhead) |
| MEDIUM | > +100 | KEEP anyway (security > complexity) |
| LOW | <= +20 | KEEP (minimal overhead) |
| LOW | +21 to +50 | KEEP if clearly improves security |
| LOW | > +50 | Consider DISCARD (too complex for low risk) |

**Key Principles:**
- Security fixes ALWAYS take priority over complexity concerns
- HIGH severity vulnerabilities must be fixed regardless of complexity
- Simpler fixes are preferred, but security is non-negotiable
- If a fix requires refactoring, do the minimum necessary
- Document complex fixes with comments explaining why

---

## Continuation Rules (NEVER STOP)

You run INDEFINITELY until:
- Manual stop signal: file `.claude/overnight/STOP` exists
- Critical unrecoverable failure (e.g., git repository corrupted)

**If context approaches limit:**
1. Save current state to `results.tsv`
2. Run `/compact` immediately
3. Continue working
4. If still limited: commit progress, log "context limit", prepare for respawn

**If out of vulnerabilities to fix:**
1. Re-run ALL security scans with different patterns
2. Check for OWASP issues not yet addressed
3. Review npm audit for newly discovered vulnerabilities
4. Check for missing security headers in API routes
5. Look for authorization bypass possibilities
6. Check for insecure direct object references
7. Review error handling for information disclosure
8. Add security logging where missing
9. Check for timing attacks in auth code
10. Review file upload handling (if any)

**If out of ideas:**
1. Re-read this program.md for missed scan patterns
2. Run different grep patterns for secrets
3. Check Python scripts for unique vulnerability patterns
4. Review recent commits for accidentally introduced issues
5. Cross-reference against OWASP Testing Guide
6. Look for business logic vulnerabilities

**DO NOT** ask "should I continue?" - YES, ALWAYS CONTINUE.

---

## Output Format

### Heartbeat (every 30 minutes)

Write to `.claude/overnight/terminal_X_status.json`:
```json
{
  "status": "running",
  "role": "SECURITY_AUDITOR",
  "terminal": X,
  "group": "groupX",
  "sessionId": "autoresearch/security-auditor/<tag>",
  "lastActivity": "ISO-8601-timestamp",
  "launchedAt": "ISO-8601-timestamp",
  "currentPhase": "EXPERIMENT_LOOP",
  "vulnerabilitiesFixed": 12,
  "highSeverityFixed": 3,
  "mediumSeverityFixed": 5,
  "lowSeverityFixed": 4,
  "secretsRemoved": 2,
  "scansRun": 45
}
```

Append to `.claude/overnight/terminal_X_heartbeat.jsonl`:
```json
{"timestamp":"ISO-8601","phase":"LOOP","vulns_fixed":12,"high":3,"med":5,"low":4,"secrets_removed":2,"context_pct":"45%"}
```

### results.tsv format

```
commit	vulns_fixed	severity_high	severity_med	severity_low	secrets_found	status	description
a1b2c3d	0	0	0	0	5	baseline	initial security state
b2c3d4e	1	1	0	0	5	keep	fixed SQL injection in journal API
c3d4e5f	2	1	1	0	5	keep	added auth check to signals endpoint
d4e5f6g	2	1	1	0	5	discard	fix broke build
e5f6g7h	3	1	1	1	4	keep	removed hardcoded API key from script
f6g7h8i	4	2	1	1	4	keep	fixed XSS in dashboard component
```

### Session Summary (on exit)

Write to `.claude/overnight/terminal_X_summary.md`:
```markdown
# SECURITY_AUDITOR Session Summary

## Run: autoresearch/security-auditor/<tag>
## Duration: X hours
## Vulnerabilities Fixed: Y total (H high, M medium, L low)

## Security Posture Improvement
- Baseline secrets exposed: 5
- Final secrets exposed: 0
- npm audit vulnerabilities: 12 -> 3
- API routes without auth: 4 -> 0

## Key Fixes
1. <commit>: <description> (HIGH - SQL injection)
2. <commit>: <description> (HIGH - hardcoded credentials)
3. <commit>: <description> (MEDIUM - missing auth)

## Remaining Vulnerabilities (for next session)
1. <description>: requires architectural change
2. <description>: needs dependency update

## Recommendations for Next Session
- <actionable suggestion>
```

---

## Quick Reference

```bash
# Check npm vulnerabilities
npm audit

# Scan for hardcoded secrets
grep -rE "(password|secret|api_key|token)\s*=\s*['\"]" src/ scripts/

# Check for SQL injection
grep -rE "query\s*\(\s*['\"].*\+" src/

# Check for missing auth
grep -rL "getServerSession|auth" src/app/api/**/*.ts

# Check for stop signal
test -f .claude/overnight/STOP && echo "STOP REQUESTED"

# Git reset on failure
git reset --hard <previous_commit>

# Log to results
echo -e "commit\tvulns\thigh\tmed\tlow\tsecrets\tstatus\tdescription" >> results.tsv
```

---

*Program version: 1.0.0*
*AutoResearch compliance: Full*
*Last updated: 2026-03-22*


---


## Heartbeat Protocol

Write status every 30 minutes to enable dashboard monitoring.

### Status File (overwrite each time)
Path: `.claude/overnight/terminal_5_status.json`
```json
{
  "status": "running",
  "role": "SECURITY_AUDITOR",
  "terminal": 5,
  "lastActivity": "ISO-8601-timestamp",
  "currentExperiment": "experiment description",
  "experimentsRun": 0,
  "experimentsKept": 0,
  "experimentsDiscarded": 0,
  "bestMetric": 0.0,
  "currentMetric": 0.0
}
```

### Heartbeat Log (append each time)
Path: `.claude/overnight/terminal_5_heartbeat.jsonl`
```json
{"timestamp":"ISO-8601","experiment":"desc","metric":0.0,"status":"keep|discard|crash"}
```


## Command Queue Polling (Every 5 minutes)

Check for incoming commands from the Research Lab dashboard:

### Step 1: Check Command Queue
```bash
cat .claude/overnight/commands/terminal_5_queue.json 2>/dev/null || echo '{"commands":[]}'
```

### Step 2: Process Pending Commands
For each command with `"status": "pending"`:
1. Parse the command text
2. Execute if safe (see below)
3. Update queue file: set `"status": "executed"`
4. Log execution result to heartbeat

### Safe Commands (execute immediately):
- `"report progress"` → Output current experiment status
- `"status"` → Write current status JSON
- `"pause"` → Wait 5 minutes, then resume (DO NOT STOP)
- `"skip"` → Abandon current experiment, try next idea

### Unsafe Commands (log but DON'T execute):
- File deletions, git force operations, system commands


## NEVER STOP Protocol

You run INDEFINITELY until:
- Manual stop signal: `.claude/overnight/STOP` file exists
- Critical system failure (build completely broken, cannot recover)

### When Context Approaches Limit:
1. Run `/compact` immediately
2. Continue working
3. If still limited, save state to `.claude/overnight/session_state.json` and RE-SPAWN

### When Out of Ideas:
1. Re-read your program.md for missed angles
2. Try combining previous near-misses
3. Try radical/unconventional changes
4. Search for external patterns (GitHub, papers)
5. Try simplification (deleting code that doesn't help)

**DO NOT ask "should I continue?" - YES, ALWAYS CONTINUE.**
**DO NOT pause for human input - THINK HARDER.**
**DO NOT stop after a fixed number of experiments - KEEP GOING.**

### Emergency Recovery:
If you encounter repeated failures:
1. `git status` - check current state
2. `git stash` - save any changes
3. `git checkout main` - return to stable
4. `git checkout -b autoresearch/<role>/recovery-<timestamp>` - new branch
5. Resume experimentation
