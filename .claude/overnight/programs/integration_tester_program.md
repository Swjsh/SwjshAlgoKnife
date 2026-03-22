# INTEGRATION_TESTER Program

> AutoResearch-compliant program for autonomous integration testing cycles.
> Reference: https://github.com/karpathy/autoresearch

---

## Setup

To set up a new INTEGRATION_TESTER experiment session:

1. **Agree on a run tag**: e.g., `overnight-2026-03-22`

2. **Create the branch**:
   ```bash
   git checkout -b autoresearch/integration-tester/<tag>
   ```

3. **Read in-scope files**:
   ```
   src/app/api/*            # All API route handlers
   src/lib/db.ts            # Database operations and schema
   src/lib/db.test.ts       # Database tests
   scripts/*                # Backend scripts (agent_runner, executors, bridges)
   tests/                   # All test files
   src/lib/**/*.test.ts     # Unit tests for library modules
   src/lib/intel/__tests__/ # Intel system tests
   ```

4. **Initialize results.tsv**:
   ```bash
   echo -e "commit\ttest_pass_rate\ttests_passed\ttests_failed\ttests_total\tstatus\tdescription" > results.tsv
   ```

5. **Establish baseline**:
   ```bash
   BASELINE_COMMIT=$(git rev-parse --short HEAD)
   npm test 2>&1 | tee /tmp/test_output.log
   TESTS_PASSED=$(grep -oP '\d+(?= passed)' /tmp/test_output.log | tail -1 || echo 0)
   TESTS_FAILED=$(grep -oP '\d+(?= failed)' /tmp/test_output.log | tail -1 || echo 0)
   TESTS_TOTAL=$((TESTS_PASSED + TESTS_FAILED))
   if [ "$TESTS_TOTAL" -gt 0 ]; then
     BASELINE_RATE=$(echo "scale=2; $TESTS_PASSED * 100 / $TESTS_TOTAL" | bc)
   else
     BASELINE_RATE=0
   fi
   echo -e "${BASELINE_COMMIT}\t${BASELINE_RATE}\t${TESTS_PASSED}\t${TESTS_FAILED}\t${TESTS_TOTAL}\tbaseline\tinitial state" >> results.tsv
   ```

---

## What You CAN Do

You are authorized to modify ONLY these files/directories:

- **API Route Tests** (create new or modify existing):
  - `tests/api/*.test.ts` - API endpoint integration tests
  - Add coverage for all routes in `src/app/api/*`
  - Test request/response validation
  - Test error handling paths
  - Test authentication flows

- **Database Tests** (`src/lib/db.test.ts`):
  - Add CRUD operation coverage
  - Test transaction handling
  - Test edge cases (nulls, duplicates, constraints)
  - Test migration scenarios

- **Integration Tests** (`tests/integration/*.test.ts`):
  - Cross-component integration tests
  - Agent ecosystem tests
  - End-to-end workflow tests

- **Script Tests** (create in `tests/` as needed):
  - Test Python-TypeScript interop
  - Test activity-bridge WebSocket
  - Test agent-runner spawning logic

- **Library Tests** (`src/lib/**/*.test.ts`):
  - Add missing test coverage
  - Improve existing test assertions
  - Add edge case coverage

- **Test Fixtures & Mocks**:
  - Create test data fixtures
  - Add mock implementations
  - Setup/teardown utilities

- **Allowed modifications**:
  - Add new test files
  - Improve existing tests
  - Fix flaky tests
  - Add missing assertions
  - Improve test isolation
  - Add test coverage for uncovered paths
  - Refactor tests for clarity

---

## What You CANNOT Do

The following are STRICTLY FORBIDDEN:

- **DO NOT** modify production code to make tests pass
- **DO NOT** delete existing passing tests
- **DO NOT** modify `src/lib/db.ts` schema (test against existing schema)
- **DO NOT** modify API route handlers (`src/app/api/*/route.ts`)
- **DO NOT** change environment variable names
- **DO NOT** modify `CLAUDE.md` or `package.json` dependencies
- **DO NOT** skip or disable tests to improve pass rate
- **DO NOT** introduce test dependencies that require network calls
- **DO NOT** write tests that depend on external services being up
- **DO NOT** ask the human for guidance - THINK HARDER and keep working

---

## The Goal

**Maximize the test pass rate (percentage of integration tests passing).**

Formula: `test_pass_rate = (tests_passed / tests_total) * 100`

**Priorities:**

| Priority | Focus Area | Target |
|----------|------------|--------|
| 1 | API endpoint coverage | All routes in `src/app/api/*` have tests |
| 2 | Database operations | CRUD + transactions + constraints |
| 3 | Cross-component integration | Agent <-> API <-> DB flows |
| 4 | Health endpoints | `/api/health`, `/api/n8n/health` verified |
| 5 | Error path coverage | All error responses tested |

**Current baseline**: Calculate from `npm test` output

**Your target**: 100% PASS RATE with MAXIMUM COVERAGE

The ONLY metric that matters is test_pass_rate. Increasing test count without improving pass rate is NOT progress.

---

## Experiment Loop

```
LOOP FOREVER:

1. NOTE CURRENT STATE
   PREV_COMMIT=$(git rev-parse --short HEAD)
   PREV_RATE=<last known pass rate>

2. IDENTIFY WEAKNESS
   - Find untested API endpoints
   - Find uncovered database operations
   - Find failing or flaky tests
   - Find missing integration scenarios

3. MAKE EXPERIMENTAL CHANGE
   - Add new test(s) for uncovered path
   - Fix failing test
   - Improve test isolation
   - Add missing assertions

4. COMMIT IMMEDIATELY
   git add -A
   git commit -m "experiment: <brief description>"
   NEW_COMMIT=$(git rev-parse --short HEAD)

5. RUN VALIDATION
   npm test 2>&1 | tee /tmp/test_output.log

   # Extract metrics
   TESTS_PASSED=$(grep -oP '\d+(?= passed)' /tmp/test_output.log | tail -1 || echo 0)
   TESTS_FAILED=$(grep -oP '\d+(?= failed)' /tmp/test_output.log | tail -1 || echo 0)
   TESTS_TOTAL=$((TESTS_PASSED + TESTS_FAILED))

   if [ "$TESTS_TOTAL" -gt 0 ]; then
     NEW_RATE=$(echo "scale=2; $TESTS_PASSED * 100 / $TESTS_TOTAL" | bc)
   else
     NEW_RATE=0
   fi

6. ALSO CHECK API HEALTH (integration validation)
   curl -s http://localhost:3000/api/health | jq -r '.status'
   # Should return "ok" if server is running

7. EVALUATE RESULT
   If NEW_RATE > PREV_RATE:
     STATUS="keep"
     Log: "KEEP: ${NEW_COMMIT} pass rate ${NEW_RATE}% (was ${PREV_RATE}%)"
     PREV_RATE=${NEW_RATE}
   Else if NEW_RATE == PREV_RATE AND TESTS_TOTAL > PREV_TOTAL:
     STATUS="keep"
     Log: "KEEP: ${NEW_COMMIT} added coverage at same pass rate"
     PREV_TOTAL=${TESTS_TOTAL}
   Else:
     goto step 8 (discard)

8. DISCARD IF NOT IMPROVED
   If STATUS != "keep":
     STATUS="discard"
     git reset --hard ${PREV_COMMIT}
     Log: "DISCARD: experiment did not improve pass rate"

9. LOG TO results.tsv
   echo -e "${NEW_COMMIT}\t${NEW_RATE}\t${TESTS_PASSED}\t${TESTS_FAILED}\t${TESTS_TOTAL}\t${STATUS}\t<description>" >> results.tsv

10. NEVER STOP - GOTO STEP 1
```

---

## Simplicity Criterion

When evaluating whether to KEEP a change:

**Track complexity metrics:**
```bash
LINES_ADDED=$(git diff --stat HEAD~1 | tail -1 | awk '{print $4}')
LINES_REMOVED=$(git diff --stat HEAD~1 | tail -1 | awk '{print $6}')
FILES_TOUCHED=$(git diff --name-only HEAD~1 | wc -l)
COMPLEXITY_DELTA=$((LINES_ADDED - LINES_REMOVED))
```

**Decision Matrix:**

| Pass Rate Delta | Complexity Delta | Decision |
|-----------------|------------------|----------|
| +5% or more | Any | KEEP (significant improvement) |
| +1% to +4% | Any | KEEP (solid improvement) |
| 0% + more tests | <= 50 lines | KEEP (added coverage) |
| 0% + more tests | > 50 lines | KEEP if tests are meaningful |
| 0% same tests | <= -20 (simpler) | KEEP (simplification win) |
| 0% same tests | > 0 | DISCARD (no improvement) |
| negative | Any | DISCARD (regression) |

**Key Principles:**
- Adding tests that PASS = good (increases coverage)
- Adding tests that FAIL = only good if they reveal real bugs to fix
- Fixing flaky tests = high value (improves reliability)
- Simplifying test setup = good if tests still pass
- Deleting duplicate/redundant tests = WIN if coverage maintained

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

**If out of ideas:**
1. Re-read this program.md for missed angles
2. List all API routes in `src/app/api/` - find untested ones
3. Analyze `src/lib/db.ts` - find untested database operations
4. Check `scripts/` directory - find untested backend functionality
5. Look at `tests/` directory - find opportunities to expand coverage
6. Run `npm test -- --coverage` to identify low-coverage files
7. Try combining test scenarios for integration coverage
8. Add negative test cases (invalid inputs, error paths)
9. Add boundary condition tests
10. Add concurrent operation tests

**DO NOT** ask "should I continue?" - YES, ALWAYS CONTINUE.

---

## Output Format

### Heartbeat (every 30 minutes)

Write to `.claude/overnight/terminal_6_status.json`:
```json
{
  "status": "running",
  "role": "INTEGRATION_TESTER",
  "terminal": 6,
  "group": "group2",
  "sessionId": "autoresearch/integration-tester/<tag>",
  "lastActivity": "ISO-8601-timestamp",
  "launchedAt": "ISO-8601-timestamp",
  "currentPhase": "EXPERIMENT_LOOP",
  "experimentsRun": 15,
  "experimentsKept": 12,
  "currentPassRate": 95.5,
  "baselinePassRate": 78.2,
  "bestPassRate": 97.1,
  "testsTotal": 47
}
```

Append to `.claude/overnight/terminal_6_heartbeat.jsonl`:
```json
{"timestamp":"ISO-8601","phase":"LOOP","experiments":15,"kept":12,"passRate":95.5,"testsTotal":47,"context_pct":"45%"}
```

### results.tsv format

```
commit	test_pass_rate	tests_passed	tests_failed	tests_total	status	description
a1b2c3d	78.2	18	5	23	baseline	initial state
b2c3d4e	82.6	19	4	23	keep	fixed flaky db connection test
c3d4e5f	80.0	20	5	25	discard	new tests failed
d4e5f6g	87.5	21	3	24	keep	added API health endpoint tests
e5f6g7h	91.3	21	2	23	keep	fixed webhook auth test
```

### Session Summary (on exit)

Write to `.claude/overnight/terminal_6_summary.md`:
```markdown
# INTEGRATION_TESTER Session Summary

## Run: autoresearch/integration-tester/<tag>
## Duration: X hours
## Experiments: Y total, Z kept

## Pass Rate Progress
- Baseline: 78.2%
- Final: 97.1%
- Delta: +18.9%

## Coverage Progress
- Baseline tests: 23
- Final tests: 47
- New tests added: 24

## Key Improvements
1. <commit>: <description> (+X% pass rate)
2. <commit>: <description> (+Y new tests)

## API Endpoints Tested
- [x] /api/health
- [x] /api/agents
- [x] /api/webhook/tradingview
- [ ] /api/intel/stream (pending)

## Failed Experiments (for future reference)
1. <description>: caused <issue>

## Recommendations for Next Session
- <actionable suggestion>
```

---

## API Endpoints to Test

Priority order for coverage:

### Critical (must have tests)
- `GET /api/health` - System health check
- `POST /api/webhook/tradingview` - Webhook ingestion
- `GET /api/agents` - Agent status
- `GET /api/control` - LLM control endpoint
- `POST /api/control` - Command execution

### High Priority
- `GET /api/signals` - Signal retrieval
- `POST /api/signals` - Signal submission
- `GET /api/journal` - Journal entries
- `GET /api/trades` - Trade history
- `GET /api/brokers` - Broker connections
- `GET /api/activity` - Activity feed

### Medium Priority
- `GET /api/intel/*` - Intel system endpoints
- `GET /api/brain/*` - Brain knowledge endpoints
- `GET /api/jira/*` - Jira integration
- `GET /api/research/*` - Research lab endpoints

### Lower Priority
- `GET /api/admin/*` - Admin endpoints
- `GET /api/user/*` - User management
- `GET /api/n8n/*` - n8n integration

---

## Quick Reference

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/api/webhook.test.ts

# Run integration tests only
npm test -- tests/integration/

# Check API health (requires server running)
curl -s http://localhost:3000/api/health

# Check for stop signal
test -f .claude/overnight/STOP && echo "STOP REQUESTED"

# Git reset on failure
git reset --hard <previous_commit>

# Log to results
echo -e "commit\trate\tpassed\tfailed\ttotal\tstatus\tdescription" >> results.tsv

# List all API routes
find src/app/api -name "route.ts" | wc -l

# Find untested routes
diff <(find src/app/api -name "route.ts" | sort) <(find tests/api -name "*.test.ts" | sort)
```

---

*Program version: 1.0.0*
*AutoResearch compliance: Full*
*Last updated: 2026-03-22*
