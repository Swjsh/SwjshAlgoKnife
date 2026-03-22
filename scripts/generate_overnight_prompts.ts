#!/usr/bin/env npx tsx
/**
 * Overnight Prompt Generator (AutoResearch-Aligned)
 *
 * Generates prompts for overnight research sessions using Karpathy's AutoResearch methodology.
 * Reference: https://github.com/karpathy/autoresearch
 *
 * Key principles:
 * 1. Each agent has a program.md file (human-modified instructions)
 * 2. Git commit BEFORE every experiment
 * 3. results.tsv logging (untracked)
 * 4. NEVER STOP - run indefinitely until manual stop
 * 5. Simplicity criterion - simpler is better
 *
 * GROUP 1 (Internal Improvement):
 *   - Terminal 1: IMPROVER (run /improve cycles, execute surgeon queue)
 *   - Terminal 2: BACKTESTER (run backtests, compare against KPIs)
 *   - Terminal 3: RESEARCHER (Context7 docs, GitHub pattern search)
 *   - Terminal 4: BRAIN_UPDATER (update codemaps, brain files, Master Tracker)
 *
 * GROUP 2 (Security & Ops):
 *   - Terminal 5: SECURITY_AUDITOR (dependency audit, secret detection, API security)
 *   - Terminal 6: INTEGRATION_TESTER (E2E tests, API contracts, broker integration)
 *   - Terminal 7: INTEL_AGGREGATOR (Oracle data ingestion, confidence scoring)
 *   - Terminal 8: DEVOPS_OPTIMIZER (CI/CD optimization, Docker tuning, monitoring)
 *
 * Usage:
 *   npx tsx scripts/generate_overnight_prompts.ts              # Generate all
 *   npx tsx scripts/generate_overnight_prompts.ts --group 1    # Group 1 only
 *   npx tsx scripts/generate_overnight_prompts.ts --group 2    # Group 2 only
 *   npx tsx scripts/generate_overnight_prompts.ts --group all  # Both groups
 *   npx tsx scripts/generate_overnight_prompts.ts --dry-run    # Preview only
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ── Types ────────────────────────────────────────────────────────────────

type Group1Role = 'improver' | 'backtester' | 'researcher' | 'brain_updater';
type Group2Role = 'security_auditor' | 'integration_tester' | 'intel_aggregator' | 'devops_optimizer';

interface OvernightPrompt {
    terminal: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    role: Group1Role | Group2Role;
    group: 'group1' | 'group2';
    prompt: string;
    focus: string;
    programFile: string;
}

// ── Constants ────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const OVERNIGHT_DIR = path.join(ROOT, '.claude', 'overnight');
const PROGRAMS_DIR = path.join(OVERNIGHT_DIR, 'programs');

// ── Role Configuration ───────────────────────────────────────────────────

const ROLE_CONFIG: Record<Group1Role | Group2Role, {
    terminal: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    group: 'group1' | 'group2';
    focus: string;
    programFile: string;
}> = {
    improver: {
        terminal: 1,
        group: 'group1',
        focus: 'improvement-cycles',
        programFile: 'improver_program.md',
    },
    backtester: {
        terminal: 2,
        group: 'group1',
        focus: 'strategy-validation',
        programFile: 'backtester_program.md',
    },
    researcher: {
        terminal: 3,
        group: 'group1',
        focus: 'external-patterns',
        programFile: 'researcher_program.md',
    },
    brain_updater: {
        terminal: 4,
        group: 'group1',
        focus: 'knowledge-currency',
        programFile: 'brain_updater_program.md',
    },
    security_auditor: {
        terminal: 5,
        group: 'group2',
        focus: 'security-hardening',
        programFile: 'security_auditor_program.md',
    },
    integration_tester: {
        terminal: 6,
        group: 'group2',
        focus: 'integration-testing',
        programFile: 'integration_tester_program.md',
    },
    intel_aggregator: {
        terminal: 7,
        group: 'group2',
        focus: 'oracle-intelligence',
        programFile: 'intel_aggregator_program.md',
    },
    devops_optimizer: {
        terminal: 8,
        group: 'group2',
        focus: 'infrastructure-optimization',
        programFile: 'devops_optimizer_program.md',
    },
};

// ── Session Header (Common to all agents) ────────────────────────────────

function generateSessionHeader(role: string, terminal: number): string {
    const today = new Date().toISOString().split('T')[0];
    const runTag = `overnight-${today}`;

    return `# AutoResearch Session: ${role.toUpperCase()}
# Terminal: ${terminal}
# Run Tag: ${runTag}
# Reference: https://github.com/karpathy/autoresearch

---

## ⚠️ CRITICAL: AutoResearch Protocol

This session follows Karpathy's AutoResearch methodology EXACTLY.

### Core Rules:
1. **Git commit BEFORE every experiment** - \`git commit -am "experiment: <description>"\`
2. **Measure AFTER every experiment** - Extract single metric
3. **Keep or Discard** - If metric improved → KEEP, if same/worse → \`git reset --hard <prev>\`
4. **Log to results.tsv** - Every experiment gets logged
5. **NEVER STOP** - Run indefinitely until \`.claude/overnight/STOP\` file exists
6. **Simplicity Criterion** - Simpler is better, all else equal

### Session Setup:
\`\`\`bash
# 1. Create branch
git checkout -b autoresearch/${role}/${runTag}

# 2. Initialize results.tsv (if not exists)
if [ ! -f results.tsv ]; then
    echo -e "commit\\tmetric\\tmemory_gb\\tstatus\\tdescription" > results.tsv
fi

# 3. Note starting commit
START_COMMIT=$(git rev-parse --short HEAD)
echo "Starting commit: $START_COMMIT"
\`\`\`

---

`;
}

// ── Heartbeat Protocol (Common to all agents) ────────────────────────────

function generateHeartbeatProtocol(terminal: number, role: string): string {
    return `
## Heartbeat Protocol

Write status every 30 minutes to enable dashboard monitoring.

### Status File (overwrite each time)
Path: \`.claude/overnight/terminal_${terminal}_status.json\`
\`\`\`json
{
  "status": "running",
  "role": "${role.toUpperCase()}",
  "terminal": ${terminal},
  "lastActivity": "ISO-8601-timestamp",
  "currentExperiment": "experiment description",
  "experimentsRun": 0,
  "experimentsKept": 0,
  "experimentsDiscarded": 0,
  "bestMetric": 0.0,
  "currentMetric": 0.0
}
\`\`\`

### Heartbeat Log (append each time)
Path: \`.claude/overnight/terminal_${terminal}_heartbeat.jsonl\`
\`\`\`json
{"timestamp":"ISO-8601","experiment":"desc","metric":0.0,"status":"keep|discard|crash"}
\`\`\`
`;
}

// ── NEVER STOP Protocol (Replaces EXIT_CONDITIONS) ──────────────────────

function generateNeverStopProtocol(): string {
    return `
## NEVER STOP Protocol

You run INDEFINITELY until:
- Manual stop signal: \`.claude/overnight/STOP\` file exists
- Critical system failure (build completely broken, cannot recover)

### When Context Approaches Limit:
1. Run \`/compact\` immediately
2. Continue working
3. If still limited, save state to \`.claude/overnight/session_state.json\` and RE-SPAWN

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
1. \`git status\` - check current state
2. \`git stash\` - save any changes
3. \`git checkout main\` - return to stable
4. \`git checkout -b autoresearch/<role>/recovery-<timestamp>\` - new branch
5. Resume experimentation
`;
}

// ── Command Polling Protocol ─────────────────────────────────────────────

function generateCommandPollingProtocol(terminal: number): string {
    return `
## Command Queue Polling (Every 5 minutes)

Check for incoming commands from the Research Lab dashboard:

### Step 1: Check Command Queue
\`\`\`bash
cat .claude/overnight/commands/terminal_${terminal}_queue.json 2>/dev/null || echo '{"commands":[]}'
\`\`\`

### Step 2: Process Pending Commands
For each command with \`"status": "pending"\`:
1. Parse the command text
2. Execute if safe (see below)
3. Update queue file: set \`"status": "executed"\`
4. Log execution result to heartbeat

### Safe Commands (execute immediately):
- \`"report progress"\` → Output current experiment status
- \`"status"\` → Write current status JSON
- \`"pause"\` → Wait 5 minutes, then resume (DO NOT STOP)
- \`"skip"\` → Abandon current experiment, try next idea

### Unsafe Commands (log but DON'T execute):
- File deletions, git force operations, system commands
`;
}

// ── Load Program File ────────────────────────────────────────────────────

function loadProgramFile(programFile: string): string {
    const programPath = path.join(PROGRAMS_DIR, programFile);
    if (fs.existsSync(programPath)) {
        return fs.readFileSync(programPath, 'utf-8');
    }
    console.warn(`Warning: Program file not found: ${programPath}`);
    return `# Program file not found: ${programFile}\n\nPlease create this file at: ${programPath}`;
}

// ── Generate Full Prompt ─────────────────────────────────────────────────

function generatePrompt(role: Group1Role | Group2Role): OvernightPrompt {
    const config = ROLE_CONFIG[role];
    const programContent = loadProgramFile(config.programFile);

    const fullPrompt = [
        generateSessionHeader(role, config.terminal),
        '---\n\n## Program (Your Instructions)\n\n',
        programContent,
        '\n---\n',
        generateHeartbeatProtocol(config.terminal, role),
        generateCommandPollingProtocol(config.terminal),
        generateNeverStopProtocol(),
    ].join('\n');

    return {
        terminal: config.terminal,
        role,
        group: config.group,
        prompt: fullPrompt,
        focus: config.focus,
        programFile: config.programFile,
    };
}

// ── File Writers ─────────────────────────────────────────────────────────

function ensureDirectories(): void {
    const dirs = [
        OVERNIGHT_DIR,
        PROGRAMS_DIR,
        path.join(OVERNIGHT_DIR, 'commands'),
        path.join(ROOT, 'data', 'overnight'),
    ];

    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
    }
}

function writePrompts(prompts: OvernightPrompt[]): void {
    ensureDirectories();

    for (const prompt of prompts) {
        const filename = `terminal_${prompt.terminal}_prompt.md`;
        const filepath = path.join(OVERNIGHT_DIR, filename);
        fs.writeFileSync(filepath, prompt.prompt, 'utf-8');
        console.log(`Wrote: ${filepath}`);
    }

    // Group prompts by group
    const group1Prompts = prompts.filter(p => p.group === 'group1');
    const group2Prompts = prompts.filter(p => p.group === 'group2');

    const today = new Date().toISOString().split('T')[0];

    // Write index file
    const indexContent = `# AutoResearch Overnight Session
# Reference: https://github.com/karpathy/autoresearch

Generated: ${new Date().toISOString()}
Run Tag: overnight-${today}

## AutoResearch Protocol Summary

1. **Git commit BEFORE every experiment**
2. **Measure single metric AFTER every experiment**
3. **Keep if improved, Discard (git reset) if same/worse**
4. **Log to results.tsv**
5. **NEVER STOP until manual STOP signal**

---

## Group 1: Internal Improvement (Terminals 1-4)

| Terminal | Role | Focus | Program File |
|----------|------|-------|--------------|
${group1Prompts.map(p => `| ${p.terminal} | ${p.role.toUpperCase()} | ${p.focus} | ${p.programFile} |`).join('\n')}

## Group 2: Security & Ops (Terminals 5-8)

| Terminal | Role | Focus | Program File |
|----------|------|-------|--------------|
${group2Prompts.map(p => `| ${p.terminal} | ${p.role.toUpperCase()} | ${p.focus} | ${p.programFile} |`).join('\n')}

---

## Launch Commands

### Group 1 (Terminals 1-4):
\`\`\`powershell
# Launch all Group 1 agents
Start-Process -FilePath "claude" -ArgumentList "-p", (Get-Content ".claude/overnight/terminal_1_prompt.md" -Raw)
Start-Process -FilePath "claude" -ArgumentList "-p", (Get-Content ".claude/overnight/terminal_2_prompt.md" -Raw)
Start-Process -FilePath "claude" -ArgumentList "-p", (Get-Content ".claude/overnight/terminal_3_prompt.md" -Raw)
Start-Process -FilePath "claude" -ArgumentList "-p", (Get-Content ".claude/overnight/terminal_4_prompt.md" -Raw)
\`\`\`

### Group 2 (Terminals 5-8):
\`\`\`powershell
# Launch all Group 2 agents
Start-Process -FilePath "claude" -ArgumentList "-p", (Get-Content ".claude/overnight/terminal_5_prompt.md" -Raw)
Start-Process -FilePath "claude" -ArgumentList "-p", (Get-Content ".claude/overnight/terminal_6_prompt.md" -Raw)
Start-Process -FilePath "claude" -ArgumentList "-p", (Get-Content ".claude/overnight/terminal_7_prompt.md" -Raw)
Start-Process -FilePath "claude" -ArgumentList "-p", (Get-Content ".claude/overnight/terminal_8_prompt.md" -Raw)
\`\`\`

---

## Stop Signal

To stop all terminals gracefully:
\`\`\`powershell
echo "stop" > .claude/overnight/STOP
\`\`\`

To resume after stop:
\`\`\`powershell
Remove-Item .claude/overnight/STOP
\`\`\`

---

## Results

Each agent logs to its own results.tsv in the current branch.
View combined results:
\`\`\`bash
cat results.tsv
\`\`\`

## Session State

Check status of all terminals:
\`\`\`powershell
Get-Content .claude/overnight/terminal_*_status.json | ConvertFrom-Json
\`\`\`
`;

    fs.writeFileSync(path.join(OVERNIGHT_DIR, 'INDEX.md'), indexContent, 'utf-8');
    console.log(`Wrote: ${path.join(OVERNIGHT_DIR, 'INDEX.md')}`);

    // Initialize results.tsv if not exists
    const resultsTsv = path.join(ROOT, 'results.tsv');
    if (!fs.existsSync(resultsTsv)) {
        fs.writeFileSync(resultsTsv, 'commit\tmetric\tmemory_gb\tstatus\tdescription\n', 'utf-8');
        console.log(`Initialized: ${resultsTsv}`);
    }

    // Add results.tsv to .gitignore if not already
    const gitignorePath = path.join(ROOT, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
        const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
        if (!gitignore.includes('results.tsv')) {
            fs.appendFileSync(gitignorePath, '\n# AutoResearch results (not committed)\nresults.tsv\n');
            console.log('Added results.tsv to .gitignore');
        }
    }
}

// ── Main ─────────────────────────────────────────────────────────────────

function main(): void {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');

    // Parse --group argument
    const groupIndex = args.indexOf('--group');
    let targetGroup: '1' | '2' | 'all' = 'all';
    if (groupIndex !== -1 && args[groupIndex + 1]) {
        const groupArg = args[groupIndex + 1];
        if (groupArg === '1' || groupArg === '2' || groupArg === 'all') {
            targetGroup = groupArg;
        }
    }

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     AutoResearch Overnight Prompt Generator                  ║');
    console.log('║     https://github.com/karpathy/autoresearch                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    console.log(`Target: ${targetGroup === 'all' ? 'Both Groups (8 terminals)' : `Group ${targetGroup} (4 terminals)`}\n`);

    // Generate prompts based on target group
    const prompts: OvernightPrompt[] = [];

    if (targetGroup === '1' || targetGroup === 'all') {
        prompts.push(generatePrompt('improver'));
        prompts.push(generatePrompt('backtester'));
        prompts.push(generatePrompt('researcher'));
        prompts.push(generatePrompt('brain_updater'));
    }

    if (targetGroup === '2' || targetGroup === 'all') {
        prompts.push(generatePrompt('security_auditor'));
        prompts.push(generatePrompt('integration_tester'));
        prompts.push(generatePrompt('intel_aggregator'));
        prompts.push(generatePrompt('devops_optimizer'));
    }

    // Check for missing program files
    const missingPrograms = prompts.filter(p => {
        const programPath = path.join(PROGRAMS_DIR, p.programFile);
        return !fs.existsSync(programPath);
    });

    if (missingPrograms.length > 0) {
        console.warn('\n⚠️  Missing program.md files:');
        for (const p of missingPrograms) {
            console.warn(`   - ${p.programFile}`);
        }
        console.warn('\nRun the autoresearch alignment audit to generate these files.\n');
    }

    // Output
    if (dryRun) {
        console.log('DRY RUN - Would generate:\n');
        for (const p of prompts) {
            const programPath = path.join(PROGRAMS_DIR, p.programFile);
            const exists = fs.existsSync(programPath);
            console.log(`Terminal ${p.terminal} (${p.role}):`);
            console.log(`  Group: ${p.group}`);
            console.log(`  Focus: ${p.focus}`);
            console.log(`  Program: ${p.programFile} ${exists ? '✓' : '✗ MISSING'}`);
            console.log();
        }
    } else {
        writePrompts(prompts);
        console.log('\n✅ Prompts generated successfully!');
        console.log('\n📝 Key files:');
        console.log(`   - Index:      ${path.join(OVERNIGHT_DIR, 'INDEX.md')}`);
        console.log(`   - Programs:   ${PROGRAMS_DIR}`);
        console.log(`   - Results:    ${path.join(ROOT, 'results.tsv')}`);
    }

    // Output summary JSON
    const summary = {
        generated: new Date().toISOString(),
        targetGroup,
        methodology: 'karpathy/autoresearch',
        prompts: prompts.map(p => ({
            terminal: p.terminal,
            role: p.role,
            group: p.group,
            focus: p.focus,
            programFile: p.programFile,
        })),
    };

    console.log('\n' + JSON.stringify(summary, null, 2));
}

main();
