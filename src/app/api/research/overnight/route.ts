/**
 * /api/research/overnight — Overnight Research Session Management API
 *
 * POST /api/research/overnight with { action: string, group?: string }
 *
 * Actions:
 *   - 'launch'         : Launch Group 1 (terminals 1-4)
 *   - 'launch-group-2' : Launch Group 2 (terminals 5-8)
 *   - 'launch-all'     : Launch both groups (all 8 terminals)
 *   - 'status'         : Check current session status
 *   - 'stop'           : Send graceful stop signal
 *   - 'morning-report' : Generate morning summary report
 *   - 'single-cycle'   : Run one improvement cycle via eval harness
 */

import { NextRequest, NextResponse } from 'next/server';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import db from '@/lib/db';

const execAsync = promisify(exec);

// ============================================================================
// Constants
// ============================================================================

const ROOT = process.cwd();
const OVERNIGHT_DIR = path.join(ROOT, '.claude', 'overnight');
const SESSIONS_FILE = path.join(ROOT, 'data', 'overnight-sessions.json');
const MORNING_REPORTS_DIR = path.join(ROOT, 'data', 'morning-reports');
const STOP_SIGNAL_FILE = path.join(OVERNIGHT_DIR, 'STOP');
const RESULTS_TSV = path.join(ROOT, 'results.tsv');
const AUTORESEARCH_METRICS_FILE = path.join(ROOT, 'data', 'autoresearch-metrics.json');

// Node.js paths for spawned terminals (Windows full paths to avoid PATH issues)
const NODE_DIR = path.dirname(process.execPath);
const NPX_PATH = path.join(NODE_DIR, 'npx.cmd');

// Group definitions
const GROUP1_ROLES = ['IMPROVER', 'BACKTESTER', 'RESEARCHER', 'BRAIN_UPDATER'];
const GROUP2_ROLES = ['SECURITY_AUDITOR', 'INTEGRATION_TESTER', 'INTEL_AGGREGATOR', 'DEVOPS_OPTIMIZER'];

// All roles indexed by terminal number (1-8)
const ALL_ROLES: Record<number, { role: string; group: 'group1' | 'group2' }> = {
  1: { role: 'IMPROVER', group: 'group1' },
  2: { role: 'BACKTESTER', group: 'group1' },
  3: { role: 'RESEARCHER', group: 'group1' },
  4: { role: 'BRAIN_UPDATER', group: 'group1' },
  5: { role: 'SECURITY_AUDITOR', group: 'group2' },
  6: { role: 'INTEGRATION_TESTER', group: 'group2' },
  7: { role: 'INTEL_AGGREGATOR', group: 'group2' },
  8: { role: 'DEVOPS_OPTIMIZER', group: 'group2' },
};

// ============================================================================
// Database Schema — overnight_sessions table
// ============================================================================

function ensureOvernightSessionsTable(): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS overnight_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'stopped', 'failed')),
        session_group TEXT NOT NULL CHECK(session_group IN ('group1', 'group2', 'both')) DEFAULT 'group1',
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        terminals_group1 INTEGER DEFAULT 0,
        terminals_group2 INTEGER DEFAULT 0,
        prompts_generated INTEGER DEFAULT 0,
        eval_score_before INTEGER,
        eval_score_after INTEGER,
        notes TEXT
      );
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_overnight_sessions_status
      ON overnight_sessions(status, started_at);
    `);
  } catch (error) {
    console.warn('[overnight] Table creation skipped (may already exist):', error);
  }

  // Migration: Add session_group column if missing (for tables created before this column existed)
  try {
    const tableInfo = db.prepare("PRAGMA table_info(overnight_sessions)").all() as Array<{ name: string }>;
    const hasSessionGroup = tableInfo.some(col => col.name === 'session_group');
    if (!hasSessionGroup) {
      db.exec("ALTER TABLE overnight_sessions ADD COLUMN session_group TEXT DEFAULT 'group1'");
      console.log('[overnight] Migration: Added session_group column');
    }
  } catch (migrationError) {
    console.warn('[overnight] Migration check failed:', migrationError);
  }
}

// Auto-init table on module load
ensureOvernightSessionsTable();

// ============================================================================
// Types
// ============================================================================

interface OvernightSession {
  id: number;
  session_id: string;
  status: 'running' | 'completed' | 'stopped' | 'failed';
  session_group: 'group1' | 'group2' | 'both';
  started_at: string;
  ended_at: string | null;
  terminals_group1: number;
  terminals_group2: number;
  prompts_generated: number;
  eval_score_before: number | null;
  eval_score_after: number | null;
  notes: string | null;
}

// ============================================================================
// Rate Limiting
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

function checkRateLimit(
  clientIp: string,
  max: number = 30,
  windowSeconds: number = 60
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const key = `overnight:${clientIp}`;
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: max - 1 };
  }

  entry.count++;
  return { allowed: entry.count <= max, remaining: Math.max(0, max - entry.count) };
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateSessionId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');
  return `overnight-${date}-${time}`;
}

async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch {
    // Directory may already exist
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function saveSession(session: Partial<OvernightSession> & { session_id: string; session_group: string }): void {
  const stmt = db.prepare(`
    INSERT INTO overnight_sessions (session_id, status, session_group, terminals_group1, terminals_group2, prompts_generated, eval_score_before, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      status = excluded.status,
      session_group = excluded.session_group,
      terminals_group1 = excluded.terminals_group1,
      terminals_group2 = excluded.terminals_group2,
      prompts_generated = excluded.prompts_generated,
      eval_score_before = excluded.eval_score_before,
      notes = excluded.notes
  `);
  stmt.run(
    session.session_id,
    session.status || 'running',
    session.session_group,
    session.terminals_group1 || 0,
    session.terminals_group2 || 0,
    session.prompts_generated || 0,
    session.eval_score_before || null,
    session.notes || null
  );
}

function getLatestSession(): OvernightSession | null {
  const stmt = db.prepare(`
    SELECT * FROM overnight_sessions
    ORDER BY started_at DESC
    LIMIT 1
  `);
  return stmt.get() as OvernightSession | null;
}

// ============================================================================
// Terminal Spawner
// ============================================================================

/**
 * Spawns research agent terminals using Windows Terminal (wt).
 *
 * Key patterns from HALO agent launcher fix:
 * - Use interactive mode (NO -p flag) to keep agents in persistent sessions
 * - Use --dangerously-skip-permissions for autonomous operation
 * - Use --system-prompt to inject the prompt file as context
 * - Create unique WT window names to avoid interfering with existing sessions
 * - Use .cmd files for reliable temp launcher execution
 *
 * @param sessionId - Unique session identifier
 * @param group - Which group is being launched
 * @param startTerminal - Terminal number to start from (1 for group1, 5 for group2)
 * @param roles - Array of role names for the agents
 * @param windowExists - If true, adds tabs to existing window instead of creating new one
 */
async function spawnTerminals(
  sessionId: string,
  group: 'group1' | 'group2',
  startTerminal: number,
  roles: string[],
  windowExists: boolean = false
): Promise<number> {
  let terminalsLaunched = 0;

  // Unique window name for this research session (timestamp-based)
  const wtWindowName = `Research-${sessionId}`;
  const groupLabel = group === 'group1' ? 'Group 1: Internal Improvement' : 'Group 2: Security & Ops';

  for (let i = 0; i < roles.length; i++) {
    const terminalNum = startTerminal + i;
    const promptFile = path.join(OVERNIGHT_DIR, `terminal_${terminalNum}_prompt.md`);
    const role = roles[i];

    if (await fileExists(promptFile)) {
      try {
        // Create .cmd launcher (more reliable than .bat for temp folder execution)
        const cmdContent = `@echo off
title Research: ${role} (T${terminalNum}) [${sessionId}]
cd /d "${ROOT}"
echo.
echo ========================================
echo   RESEARCH AGENT: ${role}
echo   Terminal ${terminalNum} of 8 (${groupLabel})
echo   Session: ${sessionId}
echo   Mode: INTERACTIVE (persistent)
echo ========================================
echo.
echo Prompt file: ${promptFile}
echo.
echo Starting Claude Code in interactive mode...
echo.
claude --dangerously-skip-permissions --system-prompt "${promptFile}" "You are ${role}. Begin your PRIMARY WORKFLOW now. Execute all tasks autonomously. Do NOT ask questions. Do NOT wait for user input. Proceed immediately with your mission."
echo.
echo ========================================
echo   [Session ended - press any key to close]
echo ========================================
pause >nul
`;
        const cmdPath = path.join(OVERNIGHT_DIR, `terminal_${terminalNum}_run.cmd`);
        await fs.writeFile(cmdPath, cmdContent, 'utf-8');

        // ═══════════════════════════════════════════════════════════════════
        // AutoResearch Protocol Integration
        // ═══════════════════════════════════════════════════════════════════

        // 1. Create AutoResearch branch for this agent
        const branchName = `autoresearch/${role.toLowerCase()}/${sessionId}`;
        try {
          await execAsync(`git checkout -b "${branchName}" 2>nul || git checkout "${branchName}"`, { cwd: ROOT });
          console.log(`[overnight] Created AutoResearch branch: ${branchName}`);
        } catch (branchError) {
          console.warn(`[overnight] Branch creation warning (may already exist):`, branchError);
        }

        // 2. Initialize results.tsv if not exists
        if (!(await fileExists(RESULTS_TSV))) {
          await fs.writeFile(RESULTS_TSV, 'commit\tmetric\tmemory_gb\tstatus\tdescription\n', 'utf-8');
          console.log(`[overnight] Initialized results.tsv`);
        }

        // ═══════════════════════════════════════════════════════════════════

        // Write status file to indicate agent is launching (with AutoResearch metrics)
        const statusFile = path.join(OVERNIGHT_DIR, `terminal_${terminalNum}_status.json`);
        await fs.writeFile(statusFile, JSON.stringify({
          status: 'launching',
          role,
          terminal: terminalNum,
          group,
          sessionId,
          launchedAt: new Date().toISOString(),
          // AutoResearch additions:
          autoresearch: {
            branch: branchName,
            experimentsRun: 0,
            experimentsKept: 0,
            experimentsDiscarded: 0,
            currentMetric: null,
            bestMetric: null,
          },
        }, null, 2), 'utf-8');

        // Launch using Windows Terminal - MATCHES HALO PATTERN EXACTLY
        // First agent creates new window, subsequent agents add tabs to most recent window
        const needsNewWindow = terminalsLaunched === 0 && !windowExists;

        if (needsNewWindow) {
          // First agent - create new WT window (matches HALO LAUNCH_AGENTS.ps1 line 113-124)
          exec(`wt new-tab --title "${role}" -d "${ROOT}" -- cmd.exe /k "${cmdPath}"`, { cwd: ROOT });
        } else {
          // Subsequent agents - add tab to most recent window using -w 0 (matches HALO line 128-141)
          exec(`wt -w 0 nt --title "${role}" -d "${ROOT}" -- cmd.exe /k "${cmdPath}"`, { cwd: ROOT });
        }

        terminalsLaunched++;
        console.log(`[overnight] Terminal ${terminalNum} (${role}) launched in window ${wtWindowName}`);

        // Wait 3 seconds between terminal launches to ensure WT has time to create each tab
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (spawnError) {
        console.error(`[overnight] Failed to spawn terminal ${terminalNum}:`, spawnError);

        // Write error status
        const statusFile = path.join(OVERNIGHT_DIR, `terminal_${terminalNum}_status.json`);
        await fs.writeFile(statusFile, JSON.stringify({
          status: 'error',
          role,
          terminal: terminalNum,
          group,
          sessionId,
          error: spawnError instanceof Error ? spawnError.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        }, null, 2), 'utf-8');
      }
    } else {
      console.warn(`[overnight] Prompt file not found for terminal ${terminalNum}: ${promptFile}`);
    }
  }

  return terminalsLaunched;
}

/**
 * Spawns a single research agent terminal.
 * Used by handleLaunchSpecific for flexible agent selection.
 */
async function spawnSingleTerminal(
  sessionId: string,
  terminalNum: number,
  wtWindowName: string,
  isFirstTerminal: boolean
): Promise<boolean> {
  const terminalInfo = ALL_ROLES[terminalNum];
  if (!terminalInfo) {
    console.error(`[overnight] Invalid terminal number: ${terminalNum}`);
    return false;
  }

  const { role, group } = terminalInfo;
  const promptFile = path.join(OVERNIGHT_DIR, `terminal_${terminalNum}_prompt.md`);
  const groupLabel = group === 'group1' ? 'Group 1: Internal Improvement' : 'Group 2: Security & Ops';

  if (!(await fileExists(promptFile))) {
    console.warn(`[overnight] Prompt file not found for terminal ${terminalNum}: ${promptFile}`);
    return false;
  }

  try {
    // ═══════════════════════════════════════════════════════════════════
    // AutoResearch Protocol Integration
    // ═══════════════════════════════════════════════════════════════════

    // 1. Create AutoResearch branch for this agent
    const branchName = `autoresearch/${role.toLowerCase()}/${sessionId}`;
    try {
      await execAsync(`git checkout -b "${branchName}" 2>nul || git checkout "${branchName}"`, { cwd: ROOT });
      console.log(`[overnight] Created AutoResearch branch: ${branchName}`);
    } catch (branchError) {
      console.warn(`[overnight] Branch creation warning (may already exist):`, branchError);
    }

    // 2. Initialize results.tsv if not exists
    if (!(await fileExists(RESULTS_TSV))) {
      await fs.writeFile(RESULTS_TSV, 'commit\tmetric\tmemory_gb\tstatus\tdescription\n', 'utf-8');
      console.log(`[overnight] Initialized results.tsv`);
    }

    // ═══════════════════════════════════════════════════════════════════

    // Create .cmd launcher with AutoResearch initialization
    const cmdContent = `@echo off
title Research: ${role} (T${terminalNum}) [${sessionId}]
cd /d "${ROOT}"
echo.
echo ========================================
echo   RESEARCH AGENT: ${role}
echo   Terminal ${terminalNum} of 8 (${groupLabel})
echo   Session: ${sessionId}
echo   Mode: INTERACTIVE (persistent)
echo   AutoResearch Branch: ${branchName}
echo ========================================
echo.
echo Initializing AutoResearch protocol...
git checkout -b "${branchName}" 2>nul || git checkout "${branchName}"
if not exist results.tsv (
  echo commit	metric	memory_gb	status	description > results.tsv
  echo [AutoResearch] Initialized results.tsv
)
echo.
echo Prompt file: ${promptFile}
echo.
echo Starting Claude Code in interactive mode...
echo.
claude --dangerously-skip-permissions --system-prompt "${promptFile}" "You are ${role}. Begin your PRIMARY WORKFLOW now. Execute all tasks autonomously. Do NOT ask questions. Do NOT wait for user input. Proceed immediately with your mission."
echo.
echo ========================================
echo   [Session ended - press any key to close]
echo ========================================
pause >nul
`;
    const cmdPath = path.join(OVERNIGHT_DIR, `terminal_${terminalNum}_run.cmd`);
    await fs.writeFile(cmdPath, cmdContent, 'utf-8');

    // Write status file (with AutoResearch metrics)
    const statusFile = path.join(OVERNIGHT_DIR, `terminal_${terminalNum}_status.json`);
    await fs.writeFile(statusFile, JSON.stringify({
      status: 'launching',
      role,
      terminal: terminalNum,
      group,
      sessionId,
      launchedAt: new Date().toISOString(),
      // AutoResearch additions:
      autoresearch: {
        branch: branchName,
        experimentsRun: 0,
        experimentsKept: 0,
        experimentsDiscarded: 0,
        currentMetric: null,
        bestMetric: null,
      },
    }, null, 2), 'utf-8');

    // Launch using Windows Terminal - MATCHES HALO PATTERN EXACTLY
    if (isFirstTerminal) {
      // First agent - create new WT window (matches HALO LAUNCH_AGENTS.ps1 line 113-124)
      exec(`wt new-tab --title "${role}" -d "${ROOT}" -- cmd.exe /k "${cmdPath}"`, { cwd: ROOT });
    } else {
      // Subsequent agents - add tab to most recent window using -w 0 (matches HALO line 128-141)
      exec(`wt -w 0 nt --title "${role}" -d "${ROOT}" -- cmd.exe /k "${cmdPath}"`, { cwd: ROOT });
    }

    console.log(`[overnight] Terminal ${terminalNum} (${role}) launched in window ${wtWindowName}`);
    return true;
  } catch (spawnError) {
    console.error(`[overnight] Failed to spawn terminal ${terminalNum}:`, spawnError);

    const statusFile = path.join(OVERNIGHT_DIR, `terminal_${terminalNum}_status.json`);
    await fs.writeFile(statusFile, JSON.stringify({
      status: 'error',
      role,
      terminal: terminalNum,
      group,
      sessionId,
      error: spawnError instanceof Error ? spawnError.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, null, 2), 'utf-8');

    return false;
  }
}

// ============================================================================
// Action Handlers
// ============================================================================

/**
 * Launch specific terminals by number (1-8).
 * Allows flexible agent selection from the UI.
 */
async function handleLaunchSpecific(terminals: number[]): Promise<NextResponse> {
  // Validate and dedupe terminals
  const validTerminals = [...new Set(terminals)]
    .filter(t => t >= 1 && t <= 8)
    .sort((a, b) => a - b);

  if (validTerminals.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'No valid terminals specified. Must be 1-8.',
      timestamp: new Date().toISOString(),
    }, { status: 400 });
  }

  const sessionId = generateSessionId();

  try {
    await ensureDir(OVERNIGHT_DIR);

    // Remove any existing stop signal
    try {
      await fs.unlink(STOP_SIGNAL_FILE);
    } catch {
      // File may not exist
    }

    // Generate prompts for all (simpler than selective generation)
    console.log(`[overnight] Generating prompts for terminals: ${validTerminals.join(', ')}...`);
    const generateScript = path.join(ROOT, 'scripts', 'generate_overnight_prompts.ts');

    let evalScoreBefore: number | null = null;
    try {
      const { stdout } = await execAsync(`"${NPX_PATH}" tsx "${generateScript}" --group all`, {
        cwd: ROOT,
        timeout: 120000,
      });

      const jsonMatch = stdout.match(/\{[\s\S]*\}$/);
      if (jsonMatch) {
        const summary = JSON.parse(jsonMatch[0]);
        evalScoreBefore = summary.evalComposite || null;
      }
    } catch (genError) {
      console.warn('[overnight] Prompt generation had issues:', genError);
    }

    // Spawn selected terminals
    const wtWindowName = `Research-${sessionId}`;
    let terminalsLaunched = 0;
    let terminalsGroup1 = 0;
    let terminalsGroup2 = 0;

    for (const terminalNum of validTerminals) {
      const isFirstTerminal = terminalsLaunched === 0;
      const success = await spawnSingleTerminal(sessionId, terminalNum, wtWindowName, isFirstTerminal);

      if (success) {
        terminalsLaunched++;
        if (terminalNum <= 4) {
          terminalsGroup1++;
        } else {
          terminalsGroup2++;
        }
      }

      // Wait 3 seconds between terminal launches
      if (terminalsLaunched < validTerminals.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Determine session group
    const hasGroup1 = terminalsGroup1 > 0;
    const hasGroup2 = terminalsGroup2 > 0;
    const sessionGroup = hasGroup1 && hasGroup2 ? 'both' : (hasGroup1 ? 'group1' : 'group2');

    // Save session
    saveSession({
      session_id: sessionId,
      status: 'running',
      session_group: sessionGroup,
      terminals_group1: terminalsGroup1,
      terminals_group2: terminalsGroup2,
      prompts_generated: validTerminals.length,
      eval_score_before: evalScoreBefore,
      notes: `Launched terminals [${validTerminals.join(', ')}] at ${new Date().toISOString()}`,
    });

    return NextResponse.json({
      success: true,
      sessionId,
      terminals: validTerminals,
      terminalsGroup1,
      terminalsGroup2,
      terminalsLaunched,
      evalScoreBefore,
      message: `Launched ${terminalsLaunched} agent(s): ${validTerminals.map(t => ALL_ROLES[t].role).join(', ')}`,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[overnight] Launch specific failed:', error);
    return NextResponse.json({
      success: false,
      sessionId,
      error: error instanceof Error ? error.message : 'Failed to launch specific terminals',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

async function handleLaunch(group: 'group1' | 'group2' | 'both'): Promise<NextResponse> {
  const sessionId = generateSessionId();

  try {
    await ensureDir(OVERNIGHT_DIR);

    // Remove any existing stop signal
    try {
      await fs.unlink(STOP_SIGNAL_FILE);
    } catch {
      // File may not exist
    }

    // Generate prompts for requested group(s)
    console.log(`[overnight] Generating prompts for ${group}...`);
    const generateScript = path.join(ROOT, 'scripts', 'generate_overnight_prompts.ts');

    let promptsGenerated = 0;
    let evalScoreBefore: number | null = null;

    try {
      const groupArg = group === 'both' ? '--group all' : `--group ${group.replace('group', '')}`;
      const { stdout } = await execAsync(`"${NPX_PATH}" tsx "${generateScript}" ${groupArg}`, {
        cwd: ROOT,
        timeout: 120000,
      });

      const jsonMatch = stdout.match(/\{[\s\S]*\}$/);
      if (jsonMatch) {
        const summary = JSON.parse(jsonMatch[0]);
        promptsGenerated = summary.prompts?.length || (group === 'both' ? 8 : 4);
        evalScoreBefore = summary.evalComposite || null;
      }
    } catch (genError) {
      console.warn('[overnight] Prompt generation had issues:', genError);
      promptsGenerated = group === 'both' ? 8 : 4;
    }

    // Spawn terminals
    let terminalsGroup1 = 0;
    let terminalsGroup2 = 0;

    if (group === 'group1' || group === 'both') {
      // Group 1 always creates a new window (windowExists = false)
      terminalsGroup1 = await spawnTerminals(sessionId, 'group1', 1, GROUP1_ROLES, false);
    }

    if (group === 'group2' || group === 'both') {
      // Group 2: if launching after Group 1 ('both'), window already exists
      const windowExists = group === 'both' && terminalsGroup1 > 0;
      terminalsGroup2 = await spawnTerminals(sessionId, 'group2', 5, GROUP2_ROLES, windowExists);
    }

    // Save session
    saveSession({
      session_id: sessionId,
      status: 'running',
      session_group: group,
      terminals_group1: terminalsGroup1,
      terminals_group2: terminalsGroup2,
      prompts_generated: promptsGenerated,
      eval_score_before: evalScoreBefore,
      notes: `Launched ${group} at ${new Date().toISOString()}`,
    });

    return NextResponse.json({
      success: true,
      sessionId,
      group,
      terminalsGroup1,
      terminalsGroup2,
      terminalsLaunched: terminalsGroup1 + terminalsGroup2,
      promptsGenerated,
      evalScoreBefore,
      message: `Overnight research ${group} launched successfully!`,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[overnight] Launch failed:', error);
    return NextResponse.json({
      success: false,
      sessionId,
      error: error instanceof Error ? error.message : 'Failed to launch overnight session',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

async function handleStatus(): Promise<NextResponse> {
  try {
    const session = getLatestSession();
    const stopSignalExists = await fileExists(STOP_SIGNAL_FILE);

    let elapsedMs = 0;
    if (session?.started_at) {
      const startTime = new Date(session.started_at).getTime();
      elapsedMs = Date.now() - startTime;
    }

    return NextResponse.json({
      success: true,
      running: session?.status === 'running' && !stopSignalExists,
      sessionId: session?.session_id || null,
      status: stopSignalExists && session?.status === 'running' ? 'stopping' : (session?.status || 'none'),
      group: session?.session_group || null,
      group1Running: (session?.terminals_group1 || 0) > 0 && session?.status === 'running',
      group2Running: (session?.terminals_group2 || 0) > 0 && session?.status === 'running',
      terminalsGroup1: session?.terminals_group1 || 0,
      terminalsGroup2: session?.terminals_group2 || 0,
      terminalsLaunched: (session?.terminals_group1 || 0) + (session?.terminals_group2 || 0),
      elapsedMs,
      evalScoreBefore: session?.eval_score_before || null,
      evalScoreAfter: session?.eval_score_after || null,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[overnight] Status check failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check status',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

async function handleStop(): Promise<NextResponse> {
  try {
    await ensureDir(OVERNIGHT_DIR);
    const stopContent = `STOP signal sent at ${new Date().toISOString()}\n`;
    await fs.writeFile(STOP_SIGNAL_FILE, stopContent);

    const session = getLatestSession();
    if (session && session.status === 'running') {
      db.prepare(`
        UPDATE overnight_sessions
        SET status = 'stopped', ended_at = CURRENT_TIMESTAMP
        WHERE session_id = ?
      `).run(session.session_id);
    }

    // ═══════════════════════════════════════════════════════════════════
    // AutoResearch Results Aggregation
    // ═══════════════════════════════════════════════════════════════════

    let autoresearchStats = {
      totalExperiments: 0,
      experimentsKept: 0,
      experimentsDiscarded: 0,
      branches: [] as string[],
      resultsByAgent: {} as Record<string, { kept: number; discarded: number; bestMetric: number | null }>,
    };

    try {
      // 1. Collect results from all autoresearch/* branches
      const { stdout: branchesRaw } = await execAsync('git branch -l "autoresearch/*"', { cwd: ROOT });
      const branches = branchesRaw.split('\n').map(b => b.trim().replace(/^\*\s*/, '')).filter(Boolean);
      autoresearchStats.branches = branches;

      // 2. Parse results.tsv for experiment counts
      if (await fileExists(RESULTS_TSV)) {
        const tsvContent = await fs.readFile(RESULTS_TSV, 'utf-8');
        const lines = tsvContent.split('\n').filter(l => l.trim() && !l.startsWith('commit'));

        for (const line of lines) {
          const [commit, metric, memory, status, description] = line.split('\t');
          autoresearchStats.totalExperiments++;

          if (status === 'keep') {
            autoresearchStats.experimentsKept++;
          } else if (status === 'discard') {
            autoresearchStats.experimentsDiscarded++;
          }
        }
      }

      // 3. Collect per-agent metrics from status files
      for (let t = 1; t <= 8; t++) {
        const statusFile = path.join(OVERNIGHT_DIR, `terminal_${t}_status.json`);
        if (await fileExists(statusFile)) {
          try {
            const statusData = JSON.parse(await fs.readFile(statusFile, 'utf-8'));
            if (statusData.autoresearch && statusData.role) {
              autoresearchStats.resultsByAgent[statusData.role] = {
                kept: statusData.autoresearch.experimentsKept || 0,
                discarded: statusData.autoresearch.experimentsDiscarded || 0,
                bestMetric: statusData.autoresearch.bestMetric,
              };
            }
          } catch {
            // Skip invalid status files
          }
        }
      }

      // 4. Save aggregated metrics for CHIEF monitoring
      await ensureDir(path.join(ROOT, 'data'));
      await fs.writeFile(AUTORESEARCH_METRICS_FILE, JSON.stringify({
        sessionId: session?.session_id,
        stoppedAt: new Date().toISOString(),
        ...autoresearchStats,
      }, null, 2), 'utf-8');

      console.log(`[overnight] AutoResearch aggregation: ${autoresearchStats.totalExperiments} experiments (${autoresearchStats.experimentsKept} kept, ${autoresearchStats.experimentsDiscarded} discarded)`);
    } catch (autoresearchError) {
      console.warn('[overnight] AutoResearch aggregation had issues:', autoresearchError);
    }

    // ═══════════════════════════════════════════════════════════════════

    // AUTO-TRIGGER: Parse accomplishments on session stop
    // Part of Research Agent Audit System — achieving 95%+ Accomplishment Aggregation score
    let accomplishmentsParsed = 0;
    try {
      const parseScript = path.join(ROOT, 'scripts', 'parse_accomplishments.ts');
      const { stdout } = await execAsync(`"${NPX_PATH}" tsx "${parseScript}" --save --json`, {
        cwd: ROOT,
        timeout: 60000,
      });

      const parseResult = JSON.parse(stdout.trim());
      accomplishmentsParsed = parseResult.length || 0;
      console.log(`[overnight] Auto-parsed ${accomplishmentsParsed} accomplishments on session stop`);
    } catch (parseError) {
      console.warn('[overnight] Accomplishment parsing had issues:', parseError);
    }

    // AUTO-TRIGGER: Generate morning report on session stop
    let morningReportGenerated = false;
    try {
      const reportScript = path.join(ROOT, 'scripts', 'generate_morning_report.ts');
      await execAsync(`"${NPX_PATH}" tsx "${reportScript}"`, {
        cwd: ROOT,
        timeout: 60000,
      });
      morningReportGenerated = true;
      console.log('[overnight] Auto-generated morning report on session stop');
    } catch (reportError) {
      console.warn('[overnight] Morning report generation had issues:', reportError);
    }

    return NextResponse.json({
      success: true,
      message: 'Stop signal sent. Terminals will exit gracefully at next checkpoint.',
      accomplishmentsParsed,
      morningReportGenerated,
      autoresearchStats,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[overnight] Stop failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send stop signal',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

async function handleMorningReport(): Promise<NextResponse> {
  try {
    const generateScript = path.join(ROOT, 'scripts', 'generate_morning_report.ts');
    const today = new Date().toISOString().slice(0, 10);

    await execAsync(`npx tsx "${generateScript}"`, {
      cwd: ROOT,
      timeout: 60000,
    });

    await ensureDir(MORNING_REPORTS_DIR);
    const reportPath = path.join(MORNING_REPORTS_DIR, `${today}.md`);

    let report = '';
    try {
      report = await fs.readFile(reportPath, 'utf-8');
    } catch {
      report = `# Morning Report - ${today}\n\nNo overnight data available for this date.`;
    }

    return NextResponse.json({
      success: true,
      report,
      reportPath,
      message: 'Morning report generated!',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[overnight] Morning report failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate morning report',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

async function handleSingleCycle(): Promise<NextResponse> {
  try {
    const evalScript = path.join(ROOT, 'skills', 'project-improvement', 'surgeon', 'eval_harness.ts');

    const { stdout } = await execAsync(`npx tsx "${evalScript}" --json`, {
      cwd: ROOT,
      timeout: 120000,
    });

    const evalResult = JSON.parse(stdout.trim());

    return NextResponse.json({
      success: true,
      before: evalResult.before?.composite ?? null,
      after: evalResult.after.composite,
      delta: evalResult.delta?.composite ?? null,
      verdict: evalResult.verdict,
      feedback: evalResult.feedback,
      message: 'Improvement cycle complete!',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[overnight] Single cycle failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run improvement cycle',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                   req.headers.get('x-real-ip') || 'unknown';
  const { allowed, remaining } = checkRateLimit(clientIp);

  if (!allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded', timestamp: new Date().toISOString() },
      { status: 429, headers: { 'X-RateLimit-Remaining': String(remaining) } }
    );
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: action',
        supportedActions: ['launch', 'launch-group-2', 'launch-all', 'launch-specific', 'status', 'stop', 'morning-report', 'single-cycle'],
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    switch (action.toLowerCase().replace(/_/g, '-')) {
      case 'launch':
        return handleLaunch('group1');
      case 'launch-group-2':
        return handleLaunch('group2');
      case 'launch-all':
        return handleLaunch('both');
      case 'launch-specific': {
        const { terminals } = body;
        if (!Array.isArray(terminals)) {
          return NextResponse.json({
            success: false,
            error: 'launch-specific requires "terminals" array (e.g., [1, 3, 5])',
            timestamp: new Date().toISOString(),
          }, { status: 400 });
        }
        return handleLaunchSpecific(terminals);
      }
      case 'status':
        return handleStatus();
      case 'stop':
        return handleStop();
      case 'morning-report':
        return handleMorningReport();
      case 'single-cycle':
        return handleSingleCycle();
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`,
          supportedActions: ['launch', 'launch-group-2', 'launch-all', 'launch-specific', 'status', 'stop', 'morning-report', 'single-cycle'],
          timestamp: new Date().toISOString(),
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[overnight] Request error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Request processing failed',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// ============================================================================
// GET Handler — Retrieve session status (read-only)
// ============================================================================

export async function GET(req: NextRequest): Promise<NextResponse> {
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                   req.headers.get('x-real-ip') || 'unknown';
  const { allowed, remaining } = checkRateLimit(clientIp, 60, 60);

  if (!allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded', timestamp: new Date().toISOString() },
      { status: 429, headers: { 'X-RateLimit-Remaining': String(remaining) } }
    );
  }

  return handleStatus();
}
