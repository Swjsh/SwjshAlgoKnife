#!/usr/bin/env npx tsx
/**
 * Morning Report Generator
 *
 * Generates a comprehensive morning summary from overnight session data.
 * Called by the overnight API route at:
 *   src/app/api/research/overnight/route.ts (action: 'morning-report')
 *
 * Reads:
 *   - SQLite table: overnight_sessions
 *   - Terminal result files: .claude/overnight/terminal_N_results.json
 *   - Terminal summaries: .claude/overnight/terminal_N_summary.md
 *   - Improver-specific: improver_results.json, improver_log.json
 *   - AutoResearch metrics: data/autoresearch-metrics.json
 *   - Git commits with 'overnight:' prefix
 *
 * Outputs:
 *   - data/morning-reports/YYYY-MM-DD.md  (human-readable report)
 *   - data/morning-reports/YYYY-MM-DD.json (structured summary)
 *
 * Usage:
 *   npx tsx scripts/generate_morning_report.ts
 *   npx tsx scripts/generate_morning_report.ts --date 2026-03-21  # specific date
 *   npx tsx scripts/generate_morning_report.ts --json             # JSON only output
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface OvernightSession {
  id: number;
  session_id: string;
  status: 'running' | 'completed' | 'stopped' | 'failed';
  started_at: string;
  ended_at: string | null;
  // Support both schema variants - the route.ts schema has group columns,
  // but older databases may have simpler schema with just terminals_launched
  session_group?: 'group1' | 'group2' | 'both';
  terminals_group1?: number;
  terminals_group2?: number;
  terminals_launched?: number;
  prompts_generated: number;
  eval_score_before: number | null;
  eval_score_after: number | null;
  notes: string | null;
}

interface TerminalResult {
  terminal: number;
  role: string;
  group: 'group1' | 'group2';
  status: 'success' | 'partial' | 'failed' | 'not_found';
  accomplishments: string[];
  failures: string[];
  metrics: Record<string, number | string>;
  duration_minutes?: number;
  commits?: string[];
}

interface ImproverAction {
  timestamp: string;
  action: string;
  target: string;
  result: string;
  score_delta?: number;
}

interface ImproverResults {
  eval_score_before?: number;
  eval_score_after?: number;
  improvements_attempted: number;
  improvements_successful: number;
  actions?: ImproverAction[];
}

interface OvernightCommit {
  hash: string;
  message: string;
  timestamp: string;
  files_changed: number;
}

interface AutoResearchAgentStats {
  kept: number;
  discarded: number;
  bestMetric: number | null;
}

interface AutoResearchMetrics {
  sessionId: string;
  stoppedAt: string;
  totalExperiments: number;
  experimentsKept: number;
  experimentsDiscarded: number;
  branches: string[];
  resultsByAgent: Record<string, AutoResearchAgentStats>;
}

interface MorningReportSummary {
  generated: string;
  date: string;
  session: {
    session_id: string | null;
    status: string;
    started_at: string | null;
    ended_at: string | null;
    duration_minutes: number | null;
    terminals_launched: number;
    group: string;
  };
  eval_scores: {
    before: number | null;
    after: number | null;
    delta: number | null;
  };
  terminals: TerminalResult[];
  commits: OvernightCommit[];
  accomplishments_count: number;
  failures_count: number;
  recommendations: string[];
  autoresearch: AutoResearchMetrics | null;
}

// ============================================================================
// Constants
// ============================================================================

const ROOT = process.cwd();
const OVERNIGHT_DIR = path.join(ROOT, '.claude', 'overnight');
const MORNING_REPORTS_DIR = path.join(ROOT, 'data', 'morning-reports');
const DB_PATH = path.join(ROOT, 'journal.db');
const AUTORESEARCH_METRICS_PATH = path.join(ROOT, 'data', 'autoresearch-metrics.json');

const ROLE_MAP: Record<number, { role: string; group: 'group1' | 'group2' }> = {
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
// Database Access
// ============================================================================

function getLatestSession(targetDate?: string): OvernightSession | null {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH, { readonly: true });

    let stmt;
    if (targetDate) {
      stmt = db.prepare(`
        SELECT * FROM overnight_sessions
        WHERE date(started_at) = ?
        ORDER BY started_at DESC
        LIMIT 1
      `);
    } else {
      stmt = db.prepare(`
        SELECT * FROM overnight_sessions
        ORDER BY started_at DESC
        LIMIT 1
      `);
    }

    const session = targetDate ? stmt.get(targetDate) : stmt.get();
    db.close();
    return session as OvernightSession | null;
  } catch (error) {
    console.warn('[morning-report] Could not query overnight_sessions:', error);
    return null;
  }
}

// ============================================================================
// File Readers
// ============================================================================

function readJsonFile<T>(filepath: string): T | null {
  try {
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, 'utf-8');
      return JSON.parse(content) as T;
    }
  } catch (error) {
    console.warn(`[morning-report] Could not read ${filepath}:`, error);
  }
  return null;
}

function readMarkdownFile(filepath: string): string | null {
  try {
    if (fs.existsSync(filepath)) {
      return fs.readFileSync(filepath, 'utf-8');
    }
  } catch (error) {
    console.warn(`[morning-report] Could not read ${filepath}:`, error);
  }
  return null;
}

function readTerminalResults(terminalNum: number): TerminalResult {
  const roleInfo = ROLE_MAP[terminalNum] || { role: `TERMINAL_${terminalNum}`, group: 'group1' as const };
  const resultsPath = path.join(OVERNIGHT_DIR, `terminal_${terminalNum}_results.json`);
  const summaryPath = path.join(OVERNIGHT_DIR, `terminal_${terminalNum}_summary.md`);

  const baseResult: TerminalResult = {
    terminal: terminalNum,
    role: roleInfo.role,
    group: roleInfo.group,
    status: 'not_found',
    accomplishments: [],
    failures: [],
    metrics: {},
  };

  // Try to read structured results JSON
  const results = readJsonFile<{
    accomplishments?: string[];
    failures?: string[];
    metrics?: Record<string, number | string>;
    duration_minutes?: number;
    commits?: string[];
    status?: string;
  }>(resultsPath);

  if (results) {
    baseResult.status = (results.status as TerminalResult['status']) || 'success';
    baseResult.accomplishments = results.accomplishments || [];
    baseResult.failures = results.failures || [];
    baseResult.metrics = results.metrics || {};
    baseResult.duration_minutes = results.duration_minutes;
    baseResult.commits = results.commits;
  }

  // Also read summary markdown for additional context
  const summary = readMarkdownFile(summaryPath);
  if (summary && baseResult.status === 'not_found') {
    // If we have a summary but no JSON results, parse key info from markdown
    baseResult.status = 'partial';

    // Extract accomplishments from markdown (look for checkmarks or bullet points)
    const accomplishmentMatches = summary.match(/[-*]\s+\[x\]\s+(.+)/gi) ||
                                   summary.match(/(?:completed|done|finished|implemented):\s*(.+)/gi);
    if (accomplishmentMatches) {
      baseResult.accomplishments = accomplishmentMatches.map(m =>
        m.replace(/[-*]\s+\[x\]\s+/i, '').replace(/(?:completed|done|finished|implemented):\s*/i, '').trim()
      ).slice(0, 10);
    }

    // Extract failures from markdown
    const failureMatches = summary.match(/[-*]\s+\[?\s*\]?\s*(?:failed|error|issue):\s*(.+)/gi);
    if (failureMatches) {
      baseResult.failures = failureMatches.map(m =>
        m.replace(/[-*]\s+\[?\s*\]?\s*/i, '').trim()
      ).slice(0, 10);
    }
  }

  return baseResult;
}

function readImproverData(): ImproverResults | null {
  const resultsPath = path.join(OVERNIGHT_DIR, 'improver_results.json');
  const logPath = path.join(OVERNIGHT_DIR, 'improver_log.json');

  const results = readJsonFile<ImproverResults>(resultsPath);
  const log = readJsonFile<ImproverAction[]>(logPath);

  if (results) {
    if (log && !results.actions) {
      results.actions = log;
    }
    return results;
  }

  if (log && Array.isArray(log)) {
    // Reconstruct results from log
    const successful = log.filter(a => a.result === 'success').length;
    return {
      improvements_attempted: log.length,
      improvements_successful: successful,
      actions: log,
    };
  }

  return null;
}

function readAutoResearchMetrics(): AutoResearchMetrics | null {
  return readJsonFile<AutoResearchMetrics>(AUTORESEARCH_METRICS_PATH);
}

// ============================================================================
// Git Commit Parser
// ============================================================================

function getOvernightCommits(since?: string): OvernightCommit[] {
  try {
    const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const gitLogCmd = `git log --since="${sinceDate}" --pretty=format:"%H|%s|%ai" --shortstat --grep="overnight:"`;

    const output = execSync(gitLogCmd, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 30000,
    }).trim();

    if (!output) return [];

    const commits: OvernightCommit[] = [];
    const lines = output.split('\n');

    let currentCommit: Partial<OvernightCommit> | null = null;

    for (const line of lines) {
      if (line.includes('|')) {
        // Commit line: hash|message|timestamp
        if (currentCommit && currentCommit.hash) {
          commits.push(currentCommit as OvernightCommit);
        }
        const [hash, message, timestamp] = line.split('|');
        currentCommit = {
          hash: hash.trim(),
          message: message.trim(),
          timestamp: timestamp.trim(),
          files_changed: 0,
        };
      } else if (line.includes('file') && line.includes('changed') && currentCommit) {
        // Stats line: "X files changed, Y insertions(+), Z deletions(-)"
        const filesMatch = line.match(/(\d+)\s+file/);
        if (filesMatch) {
          currentCommit.files_changed = parseInt(filesMatch[1], 10);
        }
      }
    }

    // Push last commit
    if (currentCommit && currentCommit.hash) {
      commits.push(currentCommit as OvernightCommit);
    }

    return commits;
  } catch (error) {
    console.warn('[morning-report] Could not parse git commits:', error);
    return [];
  }
}

// ============================================================================
// Report Generation
// ============================================================================

function calculateDurationMinutes(startedAt: string, endedAt: string | null): number | null {
  if (!startedAt) return null;

  // SQLite datetime may not include timezone - normalize by appending 'Z' if needed
  const normalizeTimestamp = (ts: string): string => {
    // If already has timezone indicator, return as-is
    if (ts.includes('Z') || ts.includes('+') || ts.includes('T')) {
      return ts;
    }
    // SQLite format "YYYY-MM-DD HH:MM:SS" -> ISO format with Z
    return ts.replace(' ', 'T') + 'Z';
  };

  const start = new Date(normalizeTimestamp(startedAt)).getTime();
  const end = endedAt ? new Date(normalizeTimestamp(endedAt)).getTime() : Date.now();

  const durationMs = end - start;
  // Sanity check - if duration is negative or unreasonably large, return null
  if (durationMs < 0 || durationMs > 24 * 60 * 60 * 1000) {
    // If negative, session hasn't ended yet relative to current time
    // Just calculate based on current time
    return Math.max(0, Math.round(durationMs / 60000));
  }

  return Math.round(durationMs / 60000);
}

function generateRecommendations(
  session: OvernightSession | null,
  terminals: TerminalResult[],
  evalDelta: number | null
): string[] {
  const recommendations: string[] = [];

  // Check for failed terminals
  const failedTerminals = terminals.filter(t => t.status === 'failed');
  if (failedTerminals.length > 0) {
    recommendations.push(
      `Review failed terminals: ${failedTerminals.map(t => t.role).join(', ')}`
    );
  }

  // Check for terminals with failures
  const terminalsWithIssues = terminals.filter(t => t.failures.length > 0);
  if (terminalsWithIssues.length > 0) {
    for (const t of terminalsWithIssues.slice(0, 3)) {
      recommendations.push(`Address ${t.role} issues: ${t.failures[0]}`);
    }
  }

  // Eval score recommendations
  if (evalDelta !== null) {
    if (evalDelta < 0) {
      recommendations.push(
        `Eval score dropped by ${Math.abs(evalDelta)} points - investigate regressions`
      );
    } else if (evalDelta === 0) {
      recommendations.push('No eval score change - consider more aggressive improvements');
    } else if (evalDelta > 0 && evalDelta < 5) {
      recommendations.push('Modest gains - continue current improvement trajectory');
    }
  }

  // Session status recommendations
  if (session?.status === 'stopped') {
    recommendations.push('Session was manually stopped - check if all tasks completed');
  } else if (session?.status === 'failed') {
    recommendations.push('Session failed - check logs for error details');
  }

  // Group coverage
  if (session?.session_group === 'group1') {
    recommendations.push('Consider running Group 2 (Security & Ops) for full coverage');
  } else if (session?.session_group === 'group2') {
    recommendations.push('Consider running Group 1 (Internal) for improvement cycles');
  }

  // Default if no recommendations
  if (recommendations.length === 0) {
    recommendations.push('All systems nominal - continue with planned work');
  }

  return recommendations.slice(0, 5);
}

function generateMarkdownReport(summary: MorningReportSummary): string {
  const lines: string[] = [];
  const { session, eval_scores, terminals, commits, recommendations } = summary;

  lines.push(`# Morning Report - ${summary.date}`);
  lines.push('');
  lines.push(`> Generated: ${summary.generated}`);
  lines.push('');

  // ── Session Overview ──────────────────────────────────────
  lines.push('## Session Overview');
  lines.push('');

  if (session.session_id) {
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Session ID | \`${session.session_id}\` |`);
    lines.push(`| Status | **${session.status.toUpperCase()}** |`);
    lines.push(`| Group | ${session.group} |`);
    lines.push(`| Started | ${session.started_at || 'N/A'} |`);
    lines.push(`| Ended | ${session.ended_at || 'Still running'} |`);
    lines.push(`| Duration | ${session.duration_minutes ? `${session.duration_minutes} min` : 'N/A'} |`);
    lines.push(`| Terminals | ${session.terminals_launched} |`);
  } else {
    lines.push('*No overnight session found for this date.*');
  }
  lines.push('');

  // ── Eval Score Delta ──────────────────────────────────────
  lines.push('## Eval Score Delta');
  lines.push('');

  if (eval_scores.before !== null || eval_scores.after !== null) {
    const beforeStr = eval_scores.before !== null ? `${eval_scores.before}` : 'N/A';
    const afterStr = eval_scores.after !== null ? `${eval_scores.after}` : 'N/A';
    const deltaStr = eval_scores.delta !== null
      ? (eval_scores.delta >= 0 ? `+${eval_scores.delta}` : `${eval_scores.delta}`)
      : 'N/A';

    const emoji = eval_scores.delta !== null
      ? (eval_scores.delta > 0 ? '📈' : eval_scores.delta < 0 ? '📉' : '➡️')
      : '❓';

    lines.push(`| Before | After | Delta |`);
    lines.push(`|--------|-------|-------|`);
    lines.push(`| ${beforeStr} | ${afterStr} | ${emoji} ${deltaStr} |`);
  } else {
    lines.push('*No eval scores recorded.*');
  }
  lines.push('');

  // ── Terminal Results ──────────────────────────────────────
  lines.push('## Terminal Results');
  lines.push('');

  const activeTerminals = terminals.filter(t => t.status !== 'not_found');

  if (activeTerminals.length > 0) {
    lines.push(`| Terminal | Role | Status | Accomplishments | Issues |`);
    lines.push(`|----------|------|--------|-----------------|--------|`);

    for (const t of activeTerminals) {
      const statusEmoji = {
        'success': '✅',
        'partial': '⚠️',
        'failed': '❌',
        'not_found': '❓',
      }[t.status];

      lines.push(`| ${t.terminal} | ${t.role} | ${statusEmoji} ${t.status} | ${t.accomplishments.length} | ${t.failures.length} |`);
    }
    lines.push('');

    // Detailed accomplishments per terminal
    lines.push('### Key Accomplishments');
    lines.push('');

    for (const t of activeTerminals) {
      if (t.accomplishments.length > 0) {
        lines.push(`**${t.role} (Terminal ${t.terminal}):**`);
        for (const a of t.accomplishments.slice(0, 5)) {
          lines.push(`- ${a}`);
        }
        lines.push('');
      }
    }

    // Issues/failures
    const totalFailures = terminals.reduce((sum, t) => sum + t.failures.length, 0);
    if (totalFailures > 0) {
      lines.push('### Issues Encountered');
      lines.push('');

      for (const t of activeTerminals) {
        if (t.failures.length > 0) {
          lines.push(`**${t.role}:**`);
          for (const f of t.failures.slice(0, 3)) {
            lines.push(`- ${f}`);
          }
          lines.push('');
        }
      }
    }
  } else {
    lines.push('*No terminal results found.*');
    lines.push('');
  }

  // ── Commits Made ──────────────────────────────────────────
  lines.push('## Commits Made');
  lines.push('');

  if (commits.length > 0) {
    lines.push(`| Hash | Message | Files |`);
    lines.push(`|------|---------|-------|`);

    for (const c of commits.slice(0, 10)) {
      const shortHash = c.hash.slice(0, 7);
      const truncatedMsg = c.message.length > 60 ? c.message.slice(0, 57) + '...' : c.message;
      lines.push(`| \`${shortHash}\` | ${truncatedMsg} | ${c.files_changed} |`);
    }

    if (commits.length > 10) {
      lines.push(`| ... | *${commits.length - 10} more commits* | |`);
    }
  } else {
    lines.push('*No overnight commits found.*');
  }
  lines.push('');

  // ── AutoResearch Statistics ────────────────────────────────
  if (summary.autoresearch) {
    const ar = summary.autoresearch;
    lines.push('## AutoResearch Statistics');
    lines.push('');

    // Overview stats
    const keepRatio = ar.totalExperiments > 0
      ? ((ar.experimentsKept / ar.totalExperiments) * 100).toFixed(1)
      : '0';

    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Session ID | \`${ar.sessionId}\` |`);
    lines.push(`| Stopped At | ${ar.stoppedAt} |`);
    lines.push(`| Total Experiments | ${ar.totalExperiments} |`);
    lines.push(`| Kept | ${ar.experimentsKept} (${keepRatio}%) |`);
    lines.push(`| Discarded | ${ar.experimentsDiscarded} |`);
    if (ar.branches.length > 0) {
      lines.push(`| Branches | ${ar.branches.join(', ')} |`);
    }
    lines.push('');

    // Per-agent breakdown
    const agents = Object.entries(ar.resultsByAgent);
    if (agents.length > 0) {
      lines.push('### Per-Agent Breakdown');
      lines.push('');
      lines.push(`| Agent | Kept | Discarded | Best Metric |`);
      lines.push(`|-------|------|-----------|-------------|`);

      for (const [agentName, stats] of agents) {
        const bestMetricStr = stats.bestMetric !== null ? stats.bestMetric.toFixed(2) : 'N/A';
        lines.push(`| ${agentName} | ${stats.kept} | ${stats.discarded} | ${bestMetricStr} |`);
      }
      lines.push('');
    }
  }

  // ── Recommendations ───────────────────────────────────────
  lines.push('## Recommendations for Today');
  lines.push('');

  for (let i = 0; i < recommendations.length; i++) {
    lines.push(`${i + 1}. ${recommendations[i]}`);
  }
  lines.push('');

  // ── Summary Stats ─────────────────────────────────────────
  lines.push('---');
  lines.push('');
  lines.push('**Summary:**');
  lines.push(`- Total Accomplishments: ${summary.accomplishments_count}`);
  lines.push(`- Total Issues: ${summary.failures_count}`);
  lines.push(`- Commits: ${commits.length}`);
  lines.push('');

  return lines.join('\n');
}

function buildSummary(
  date: string,
  session: OvernightSession | null,
  terminals: TerminalResult[],
  commits: OvernightCommit[],
  improverData: ImproverResults | null,
  autoresearchMetrics: AutoResearchMetrics | null
): MorningReportSummary {
  const evalBefore = session?.eval_score_before ?? improverData?.eval_score_before ?? null;
  const evalAfter = session?.eval_score_after ?? improverData?.eval_score_after ?? null;
  const evalDelta = (evalBefore !== null && evalAfter !== null) ? evalAfter - evalBefore : null;

  const accomplishmentsCount = terminals.reduce((sum, t) => sum + t.accomplishments.length, 0);
  const failuresCount = terminals.reduce((sum, t) => sum + t.failures.length, 0);

  const recommendations = generateRecommendations(session, terminals, evalDelta);

  // Calculate terminals launched - support both schema variants
  const terminalsLaunched = session?.terminals_launched ??
    ((session?.terminals_group1 || 0) + (session?.terminals_group2 || 0));

  // Determine group from session or infer from session_id/notes
  let sessionGroup = session?.session_group || 'unknown';
  if (sessionGroup === 'unknown' && session?.notes) {
    if (session.notes.toLowerCase().includes('group1') || session.notes.toLowerCase().includes('group 1')) {
      sessionGroup = 'group1';
    } else if (session.notes.toLowerCase().includes('group2') || session.notes.toLowerCase().includes('group 2')) {
      sessionGroup = 'group2';
    } else if (session.notes.toLowerCase().includes('both') || session.notes.toLowerCase().includes('all')) {
      sessionGroup = 'both';
    }
  }
  // If still unknown, infer from terminal count
  if (sessionGroup === 'unknown' && terminalsLaunched > 0) {
    sessionGroup = terminalsLaunched >= 8 ? 'both' : terminalsLaunched >= 4 ? 'group1' : 'partial';
  }

  return {
    generated: new Date().toISOString(),
    date,
    session: {
      session_id: session?.session_id || null,
      status: session?.status || 'not_found',
      started_at: session?.started_at || null,
      ended_at: session?.ended_at || null,
      duration_minutes: session ? calculateDurationMinutes(session.started_at, session.ended_at) : null,
      terminals_launched: terminalsLaunched,
      group: sessionGroup,
    },
    eval_scores: {
      before: evalBefore,
      after: evalAfter,
      delta: evalDelta,
    },
    terminals,
    commits,
    accomplishments_count: accomplishmentsCount,
    failures_count: failuresCount,
    recommendations,
    autoresearch: autoresearchMetrics,
  };
}

// ============================================================================
// Main
// ============================================================================

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const jsonOnly = args.includes('--json');

  // Parse --date argument
  let targetDate: string | undefined;
  const dateIndex = args.indexOf('--date');
  if (dateIndex !== -1 && args[dateIndex + 1]) {
    targetDate = args[dateIndex + 1];
  }

  const reportDate = targetDate || new Date().toISOString().slice(0, 10);

  console.log('=== Morning Report Generator ===\n');
  console.log(`Date: ${reportDate}\n`);

  // 1. Get session from database
  const session = getLatestSession(targetDate);
  if (session) {
    console.log(`Found session: ${session.session_id} (${session.status})`);
  } else {
    console.log('No overnight session found for this date');
  }

  // 2. Read terminal results
  const terminals: TerminalResult[] = [];
  for (let i = 1; i <= 8; i++) {
    const result = readTerminalResults(i);
    terminals.push(result);
    if (result.status !== 'not_found') {
      console.log(`Terminal ${i} (${result.role}): ${result.status} - ${result.accomplishments.length} accomplishments`);
    }
  }

  // 3. Read improver-specific data
  const improverData = readImproverData();
  if (improverData) {
    console.log(`Improver: ${improverData.improvements_successful}/${improverData.improvements_attempted} improvements`);
  }

  // 4. Read AutoResearch metrics
  const autoresearchMetrics = readAutoResearchMetrics();
  if (autoresearchMetrics) {
    const keepRatio = autoresearchMetrics.totalExperiments > 0
      ? ((autoresearchMetrics.experimentsKept / autoresearchMetrics.totalExperiments) * 100).toFixed(1)
      : '0';
    console.log(`AutoResearch: ${autoresearchMetrics.totalExperiments} experiments, ${autoresearchMetrics.experimentsKept} kept (${keepRatio}%)`);
  }

  // 5. Get overnight commits
  const since = session?.started_at || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const commits = getOvernightCommits(since);
  console.log(`Found ${commits.length} overnight commits`);

  // 6. Build summary
  const summary = buildSummary(reportDate, session, terminals, commits, improverData, autoresearchMetrics);

  // 7. Generate and write reports
  ensureDir(MORNING_REPORTS_DIR);

  const mdPath = path.join(MORNING_REPORTS_DIR, `${reportDate}.md`);
  const jsonPath = path.join(MORNING_REPORTS_DIR, `${reportDate}.json`);

  // Write JSON
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`\nWrote JSON: ${jsonPath}`);

  // Write Markdown
  if (!jsonOnly) {
    const markdown = generateMarkdownReport(summary);
    fs.writeFileSync(mdPath, markdown, 'utf-8');
    console.log(`Wrote Markdown: ${mdPath}`);
  }

  console.log('\nMorning report generated successfully!');

  // Output summary for API callers
  if (jsonOnly) {
    console.log('\n' + JSON.stringify(summary, null, 2));
  }
}

main();
