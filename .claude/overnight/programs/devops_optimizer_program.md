# DEVOPS_OPTIMIZER Program

> AutoResearch-compliant program for autonomous build and infrastructure optimization.
> Reference: https://github.com/karpathy/autoresearch

---

## Setup

To set up a new DEVOPS_OPTIMIZER experiment session:

1. **Agree on a run tag**: e.g., `overnight-2026-03-22`

2. **Create the branch**:
   ```bash
   git checkout -b autoresearch/devops/<tag>
   ```

3. **Read in-scope files**:
   ```
   package.json              # NPM scripts, dependencies
   tsconfig.json             # TypeScript compiler options
   next.config.ts            # Next.js bundler configuration
   scripts/ecosystem.config.js   # PM2 process configuration
   Dockerfile                # Multi-stage Docker build
   docker-compose.yml        # Container orchestration
   ```

4. **Initialize results.tsv**:
   ```bash
   echo -e "commit\tbuild_time_s\tbundle_size_kb\tdocker_size_mb\tstatus\tdescription" > results.tsv
   ```

5. **Establish baseline**:
   ```bash
   BASELINE_COMMIT=$(git rev-parse --short HEAD)

   # Measure build time (3 runs, take average)
   rm -rf .next
   START=$(date +%s.%N)
   npm run build 2>&1 > /tmp/build.log
   END=$(date +%s.%N)
   BUILD_TIME=$(echo "$END - $START" | bc)

   # Measure bundle size (client JS)
   BUNDLE_SIZE=$(du -sk .next/static/chunks 2>/dev/null | cut -f1 || echo "0")

   # Measure Docker image size (if Docker available)
   DOCKER_SIZE=$(docker images swjshak:latest --format "{{.Size}}" 2>/dev/null | sed 's/MB//' || echo "0")

   echo -e "${BASELINE_COMMIT}\t${BUILD_TIME}\t${BUNDLE_SIZE}\t${DOCKER_SIZE}\tbaseline\tinitial state" >> results.tsv
   ```

---

## What You CAN Do

You are authorized to modify ONLY these files:

- **package.json**:
  - Add npm scripts for optimization (e.g., `build:analyze`, `build:profile`)
  - Configure script parallelization
  - Adjust dependency versions for performance
  - Add build caching scripts
  - Remove unused dependencies (after verifying not imported)

- **tsconfig.json**:
  - Optimize `target` for modern JS (ES2020+)
  - Configure `incremental` compilation
  - Adjust `moduleResolution` for bundler efficiency
  - Configure `paths` aliases for cleaner imports
  - Tune `strict` options for build speed vs safety tradeoff
  - Add/remove from `exclude` patterns

- **next.config.ts**:
  - Enable/configure `swcMinify`
  - Configure `output: 'standalone'` for Docker
  - Add `experimental` features (turbopack, etc.)
  - Configure `images` optimization
  - Add webpack bundle analyzer
  - Configure chunk splitting strategies
  - Enable/disable telemetry
  - Configure compression

- **scripts/ecosystem.config.js**:
  - Tune `max_memory_restart` thresholds
  - Adjust `restart_delay` timing
  - Configure `kill_timeout` for graceful shutdown
  - Add/remove environment variables for performance
  - Tune `watch` options if enabled
  - Optimize log rotation settings

- **Dockerfile**:
  - Optimize multi-stage build layers
  - Improve layer caching (order COPY statements)
  - Use `--mount=type=cache` for npm/pip caching
  - Switch to smaller base images (alpine, distroless)
  - Remove unnecessary packages from runtime
  - Optimize Python dependency installation
  - Use `.dockerignore` patterns

- **docker-compose.yml**:
  - Configure resource limits (memory, CPU)
  - Optimize logging drivers
  - Add healthchecks
  - Configure restart policies
  - Add build caching configuration

**Allowed modifications**:
- Add build performance profiling
- Implement caching strategies
- Reduce bundle sizes
- Optimize Docker layers
- Parallelize build steps
- Remove dead dependencies
- Configure tree-shaking
- Implement incremental builds

---

## What You CANNOT Do

The following are STRICTLY FORBIDDEN:

- **DO NOT** modify application source code (`src/`)
- **DO NOT** modify database schema or data files
- **DO NOT** break the build (always verify build succeeds)
- **DO NOT** remove dependencies that are actually used
- **DO NOT** change environment variable names expected by code
- **DO NOT** modify security headers in next.config.ts
- **DO NOT** change exposed ports (3000, 3001)
- **DO NOT** modify scripts beyond ecosystem.config.js
- **DO NOT** touch the eval_harness or test files
- **DO NOT** introduce vulnerabilities (verify with `npm audit`)
- **DO NOT** use deprecated/experimental features without fallback
- **DO NOT** ask the human for guidance - THINK HARDER and keep working

---

## The Goal

**Minimize build_time_reduction_pct (percentage reduction from baseline build time).**

The primary metric is build time, but secondary metrics matter:

| Metric | Weight | Target |
|--------|--------|--------|
| Build Time | 50 | Fastest possible `npm run build` |
| Bundle Size | 25 | Smallest client JS payload |
| Docker Size | 15 | Smallest production image |
| Build Success | 10 | Must pass `npm run build && npm test` |

**Composite Score Calculation:**
```
build_score = (baseline_build_time - current_build_time) / baseline_build_time * 100
bundle_score = (baseline_bundle - current_bundle) / baseline_bundle * 100
docker_score = (baseline_docker - current_docker) / baseline_docker * 100

composite = (build_score * 0.5) + (bundle_score * 0.25) + (docker_score * 0.15) + (success * 10)
```

**Your target**: MAXIMUM REDUCTION PERCENTAGE

Build time is king. A 10% build time improvement is worth more than a 5% bundle reduction.

---

## Experiment Loop

```
LOOP FOREVER:

1. NOTE CURRENT STATE
   PREV_COMMIT=$(git rev-parse --short HEAD)
   PREV_BUILD_TIME=<from last successful experiment>

2. MAKE EXPERIMENTAL CHANGE
   - Read relevant config files
   - Identify optimization opportunity
   - Implement targeted change (ONE change per experiment)

3. COMMIT IMMEDIATELY
   git add -A
   git commit -m "experiment: <brief description>"
   NEW_COMMIT=$(git rev-parse --short HEAD)

4. RUN VALIDATION
   # Clean slate for accurate timing
   rm -rf .next node_modules/.cache

   # Time the build
   START=$(date +%s.%N)
   npm run build 2>&1 > /tmp/build.log
   BUILD_EXIT=$?
   END=$(date +%s.%N)

   if [ $BUILD_EXIT -ne 0 ]; then
     STATUS="crash"
     goto step 7 (discard)
   fi

   # Run tests
   npm test 2>&1 > /tmp/test.log
   if [ $? -ne 0 ]; then
     STATUS="crash"
     goto step 7 (discard)
   fi

5. EXTRACT METRICS
   NEW_BUILD_TIME=$(echo "$END - $START" | bc)
   NEW_BUNDLE=$(du -sk .next/static/chunks 2>/dev/null | cut -f1)

   # Calculate improvement
   IMPROVEMENT=$(echo "scale=2; ($PREV_BUILD_TIME - $NEW_BUILD_TIME) / $PREV_BUILD_TIME * 100" | bc)

6. EVALUATE RESULT
   If NEW_BUILD_TIME < PREV_BUILD_TIME:
     STATUS="keep"
     Log: "KEEP: ${NEW_COMMIT} build=${NEW_BUILD_TIME}s (was ${PREV_BUILD_TIME}s, -${IMPROVEMENT}%)"
     PREV_BUILD_TIME=${NEW_BUILD_TIME}
   ElseIf NEW_BUILD_TIME == PREV_BUILD_TIME AND NEW_BUNDLE < PREV_BUNDLE:
     STATUS="keep"
     Log: "KEEP: ${NEW_COMMIT} same build time but smaller bundle"
   Else:
     goto step 7 (discard)

7. DISCARD IF NOT IMPROVED
   If STATUS != "keep":
     STATUS="discard"
     git reset --hard ${PREV_COMMIT}
     Log: "DISCARD: experiment did not improve metrics"

8. LOG TO results.tsv
   echo -e "${NEW_COMMIT}\t${NEW_BUILD_TIME}\t${NEW_BUNDLE}\t${DOCKER_SIZE}\t${STATUS}\t<description>" >> results.tsv

9. NEVER STOP - GOTO STEP 1
```

---

## Simplicity Criterion

When evaluating whether to KEEP a change:

**Track complexity metrics:**
```bash
LINES_ADDED=$(git diff --stat HEAD~1 | tail -1 | awk '{print $4}')
LINES_REMOVED=$(git diff --stat HEAD~1 | tail -1 | awk '{print $6}')
CONFIG_COMPLEXITY=$(wc -l < package.json) + $(wc -l < tsconfig.json) + $(wc -l < Dockerfile)
```

**Decision Matrix:**

| Build Improvement | Complexity Delta | Decision |
|-------------------|------------------|----------|
| >= 10% faster | Any | KEEP (significant win) |
| 5-10% faster | Any | KEEP (solid improvement) |
| 2-5% faster | <= +10 lines | KEEP (acceptable) |
| 2-5% faster | > +10 lines | KEEP if bundle also smaller |
| 1-2% faster | <= 0 (simpler) | KEEP |
| 1-2% faster | > 0 | DISCARD (not worth complexity) |
| 0% (same) | <= -5 lines | KEEP (simplification win) |
| 0% (same) | > -5 lines | DISCARD |
| slower | Any | DISCARD (regression) |

**Key Principles:**
- Simpler config is ALWAYS better, all else equal
- One-line change with 5% improvement > 50-line change with 6% improvement
- Deleting config that maintains performance = WIN
- Experimental features need significant payoff to justify risk
- If build breaks, ALWAYS discard immediately

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
2. Re-read the in-scope config files for optimization opportunities
3. Try combining previous near-miss experiments
4. Try radical/unconventional changes:
   - Switch to Turbopack (experimental)
   - Try SWC minifier options
   - Experiment with chunk splitting strategies
   - Test different base Docker images
   - Try build parallelization approaches
5. Search GitHub for Next.js optimization patterns
6. Look for unused dependencies to remove
7. Analyze bundle composition with webpack-bundle-analyzer
8. Profile TypeScript compilation time
9. Test incremental build performance
10. Experiment with Docker layer ordering

**DO NOT** ask "should I continue?" - YES, ALWAYS CONTINUE.

---

## Optimization Ideas Backlog

Reference these when experimenting:

### Build Time
- Enable `incremental: true` in tsconfig.json
- Use SWC minifier (`swcMinify: true`)
- Configure `transpilePackages` for problematic deps
- Enable Turbopack for dev builds
- Parallelize npm scripts with `npm-run-all`
- Use `tsc --build` mode for incremental
- Configure `skipLibCheck: true`

### Bundle Size
- Tree-shake unused exports
- Configure `sideEffects: false` in package.json
- Use dynamic imports for heavy components
- Analyze and split large chunks
- Remove unused dependencies
- Configure dead code elimination

### Docker
- Use multi-stage builds effectively
- Order COPY statements for cache hits
- Use `--mount=type=cache` for npm ci
- Switch to `node:20-alpine` (smaller)
- Use `.dockerignore` aggressively
- Remove dev dependencies in final stage
- Use `standalone` output mode

### PM2/Runtime
- Tune `max_memory_restart` based on actual usage
- Configure cluster mode for multi-core
- Optimize `restart_delay` for recovery time
- Configure log rotation to prevent disk fill

---

## Output Format

### Heartbeat (every 30 minutes)

Write to `.claude/overnight/terminal_X_status.json`:
```json
{
  "status": "running",
  "role": "DEVOPS_OPTIMIZER",
  "terminal": X,
  "group": "groupX",
  "sessionId": "autoresearch/devops/<tag>",
  "lastActivity": "ISO-8601-timestamp",
  "launchedAt": "ISO-8601-timestamp",
  "currentPhase": "EXPERIMENT_LOOP",
  "experimentsRun": 15,
  "experimentsKept": 8,
  "baselineBuildTime": 45.2,
  "currentBuildTime": 32.1,
  "improvementPct": 29.0,
  "baselineBundle": 2048,
  "currentBundle": 1820
}
```

Append to `.claude/overnight/terminal_X_heartbeat.jsonl`:
```json
{"timestamp":"ISO-8601","phase":"LOOP","experiments":15,"kept":8,"build_time":32.1,"improvement":"29%","context_pct":"45%"}
```

### results.tsv format

```
commit	build_time_s	bundle_size_kb	docker_size_mb	status	description
a1b2c3d	45.2	2048	892	baseline	initial state
b2c3d4e	42.1	2048	892	keep	enabled swcMinify
c3d4e5f	43.5	2048	892	discard	turbopack unstable, slower
d4e5f6g	38.8	1920	892	keep	added incremental compilation
e5f6g7h	38.8	1820	845	keep	removed unused lodash dep
f6g7h8i	35.2	1820	845	keep	optimized tsconfig excludes
```

### Session Summary (on exit)

Write to `.claude/overnight/terminal_X_summary.md`:
```markdown
# DEVOPS_OPTIMIZER Session Summary

## Run: autoresearch/devops/<tag>
## Duration: X hours
## Experiments: Y total, Z kept

## Performance Progress
- Baseline Build: 45.2s
- Final Build: 32.1s
- Improvement: 29.0%

- Baseline Bundle: 2048 KB
- Final Bundle: 1650 KB
- Reduction: 19.4%

- Baseline Docker: 892 MB
- Final Docker: 756 MB
- Reduction: 15.2%

## Key Optimizations Applied
1. <commit>: <description> (-X% build time)
2. <commit>: <description> (-Y KB bundle)

## Failed Experiments (for future reference)
1. <description>: caused <issue>

## Recommendations for Next Session
- <actionable suggestion>
```

---

## Quick Reference

```bash
# Time a clean build
rm -rf .next && time npm run build

# Measure bundle size
du -sh .next/static/chunks

# Analyze bundle composition
ANALYZE=true npm run build

# Check for unused dependencies
npx depcheck

# Audit for vulnerabilities
npm audit

# Check Docker image size
docker images swjshak:latest --format "{{.Size}}"

# Check for stop signal
test -f .claude/overnight/STOP && echo "STOP REQUESTED"

# Git reset on failure
git reset --hard <previous_commit>

# Log to results
echo -e "commit\tbuild_time\tbundle\tdocker\tstatus\tdescription" >> results.tsv

# Profile TypeScript compilation
tsc --extendedDiagnostics

# List large dependencies
npm ls --all | head -50
```

---

*Program version: 1.0.0*
*AutoResearch compliance: Full*
*Last updated: 2026-03-22*
