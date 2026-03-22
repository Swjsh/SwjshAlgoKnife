#!/usr/bin/env npx tsx
/**
 * Weekly Trend Aggregation Script
 * ================================
 * AutoResearch Pattern: Aggregates daily data into weekly trends
 *
 * Reads:
 *   - data/morning-reports/*.json (daily session reports)
 *   - accomplishments table (agent accomplishments)
 *   - overnight_sessions table (session data)
 *
 * Writes:
 *   - trend_metrics table (weekly aggregations)
 *   - data/trends/weekly-YYYY-WW.json (JSON export)
 *
 * Usage:
 *   npx tsx scripts/aggregate_weekly.ts              # Current week
 *   npx tsx scripts/aggregate_weekly.ts --week 2026-12  # Specific week
 *   npx tsx scripts/aggregate_weekly.ts --all        # All historical weeks
 *   npx tsx scripts/aggregate_weekly.ts --json       # JSON output
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface WeeklyMetric {
  weekStart: string;
  weekEnd: string;
  agentId: string | null;
  metricName: string;
  metricValue: number;
  previousValue: number | null;
  delta: number | null;
  deltaPct: number | null;
  sampleCount: number;
}

interface MorningReport {
  generated: string;
  date: string;
  session?: {
    session_id: string;
    status: string;
    duration_minutes?: number;
    terminals_launched?: number;
  };
  eval_scores?: {
    before: number | null;
    after: number | null;
    delta: number | null;
  };
  terminals?: Array<{
    terminal: number;
    role: string;
    status: string;
    accomplishments?: string[];
  }>;
}

interface WeeklyAggregate {
  weekStart: string;
  weekEnd: string;
  weekNumber: string;
  metrics: WeeklyMetric[];
  summary: {
    totalSessions: number;
    totalAccomplishments: number;
    avgEvalScoreDelta: number | null;
    avgSessionDuration: number | null;
    agentBreakdown: Record<string, number>;
  };
}

// ============================================================================
// Constants
// ============================================================================

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const MORNING_REPORTS_DIR = path.join(DATA_DIR, 'morning-reports');
const TRENDS_DIR = path.join(DATA_DIR, 'trends');

// ============================================================================
// Utility Functions
// ============================================================================

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getWeekNumber(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

function getWeekBounds(weekStr: string): { start: Date; end: Date } {
  // Parse YYYY-WXX format
  const match = weekStr.match(/(\d{4})-W(\d{2})/);
  if (!match) {
    const now = new Date();
    return {
      start: new Date(now.setDate(now.getDate() - now.getDay())),
      end: new Date(now.setDate(now.getDate() + 6)),
    };
  }

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // Calculate the start of ISO week
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return { start: weekStart, end: weekEnd };
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function readMorningReports(startDate: string, endDate: string): MorningReport[] {
  const reports: MorningReport[] = [];

  if (!fs.existsSync(MORNING_REPORTS_DIR)) {
    return reports;
  }

  const files = fs.readdirSync(MORNING_REPORTS_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;

    const fileDate = dateMatch[1];
    if (fileDate >= startDate && fileDate <= endDate) {
      try {
        const content = fs.readFileSync(path.join(MORNING_REPORTS_DIR, file), 'utf-8');
        const report = JSON.parse(content) as MorningReport;
        reports.push(report);
      } catch {
        // Skip invalid files
      }
    }
  }

  return reports.sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================================
// Aggregation Logic
// ============================================================================

function aggregateWeek(weekStr: string): WeeklyAggregate {
  const { start, end } = getWeekBounds(weekStr);
  const startDate = formatDate(start);
  const endDate = formatDate(end);

  const reports = readMorningReports(startDate, endDate);
  const metrics: WeeklyMetric[] = [];

  // Aggregate session metrics
  let totalSessions = 0;
  let totalAccomplishments = 0;
  let evalDeltas: number[] = [];
  let durations: number[] = [];
  const agentBreakdown: Record<string, number> = {};

  for (const report of reports) {
    if (report.session) {
      totalSessions++;
      if (report.session.duration_minutes) {
        durations.push(report.session.duration_minutes);
      }
    }

    if (report.eval_scores?.delta !== null && report.eval_scores?.delta !== undefined) {
      evalDeltas.push(report.eval_scores.delta);
    }

    if (report.terminals) {
      for (const terminal of report.terminals) {
        const accomplishmentCount = terminal.accomplishments?.length || 0;
        totalAccomplishments += accomplishmentCount;
        agentBreakdown[terminal.role] = (agentBreakdown[terminal.role] || 0) + accomplishmentCount;
      }
    }
  }

  // Create metrics
  const baseMetric = {
    weekStart: startDate,
    weekEnd: endDate,
    previousValue: null,
    delta: null,
    deltaPct: null,
  };

  // Total sessions metric
  metrics.push({
    ...baseMetric,
    agentId: null,
    metricName: 'total_sessions',
    metricValue: totalSessions,
    sampleCount: reports.length,
  });

  // Total accomplishments metric
  metrics.push({
    ...baseMetric,
    agentId: null,
    metricName: 'total_accomplishments',
    metricValue: totalAccomplishments,
    sampleCount: reports.length,
  });

  // Average eval delta
  if (evalDeltas.length > 0) {
    const avgDelta = evalDeltas.reduce((a, b) => a + b, 0) / evalDeltas.length;
    metrics.push({
      ...baseMetric,
      agentId: null,
      metricName: 'avg_eval_delta',
      metricValue: Math.round(avgDelta * 100) / 100,
      sampleCount: evalDeltas.length,
    });
  }

  // Average session duration
  if (durations.length > 0) {
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    metrics.push({
      ...baseMetric,
      agentId: null,
      metricName: 'avg_session_duration_minutes',
      metricValue: Math.round(avgDuration * 100) / 100,
      sampleCount: durations.length,
    });
  }

  // Per-agent metrics
  for (const [agentId, count] of Object.entries(agentBreakdown)) {
    metrics.push({
      ...baseMetric,
      agentId,
      metricName: 'accomplishments',
      metricValue: count,
      sampleCount: 1,
    });
  }

  return {
    weekStart: startDate,
    weekEnd: endDate,
    weekNumber: weekStr,
    metrics,
    summary: {
      totalSessions,
      totalAccomplishments,
      avgEvalScoreDelta: evalDeltas.length > 0
        ? Math.round((evalDeltas.reduce((a, b) => a + b, 0) / evalDeltas.length) * 100) / 100
        : null,
      avgSessionDuration: durations.length > 0
        ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 100) / 100
        : null,
      agentBreakdown,
    },
  };
}

function saveToDB(aggregate: WeeklyAggregate): void {
  // Try to save to SQLite
  try {
    const Database = require('better-sqlite3');
    const { DATABASE_PATH } = require('../src/lib/dataPaths');
    const db = new Database(DATABASE_PATH);

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO trend_metrics
      (week_start, week_end, agent_id, metric_name, metric_value, previous_value, delta, delta_pct, sample_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const metric of aggregate.metrics) {
      insertStmt.run(
        metric.weekStart,
        metric.weekEnd,
        metric.agentId,
        metric.metricName,
        metric.metricValue,
        metric.previousValue,
        metric.delta,
        metric.deltaPct,
        metric.sampleCount
      );
    }

    db.close();
    console.log(`✓ Saved ${aggregate.metrics.length} metrics to trend_metrics table`);
  } catch (error) {
    console.warn('⚠ Could not save to SQLite:', (error as Error).message);
  }
}

function saveToFile(aggregate: WeeklyAggregate): void {
  ensureDir(TRENDS_DIR);
  const filename = `weekly-${aggregate.weekNumber}.json`;
  const filepath = path.join(TRENDS_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(aggregate, null, 2));
  console.log(`✓ Saved ${filepath}`);
}

// ============================================================================
// CLI Entry Point
// ============================================================================

function main(): void {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const allWeeks = args.includes('--all');

  // Get week argument
  const weekArg = args.find(a => a.startsWith('--week='));
  let weekStr: string;

  if (weekArg) {
    weekStr = weekArg.split('=')[1];
  } else {
    weekStr = getWeekNumber(new Date());
  }

  if (!jsonOutput) {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║     WEEKLY TREND AGGREGATION                      ║');
    console.log('╠═══════════════════════════════════════════════════╣');
    console.log(`║  Week: ${weekStr.padEnd(42)}║`);
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log('');
  }

  const aggregate = aggregateWeek(weekStr);

  if (jsonOutput) {
    console.log(JSON.stringify(aggregate, null, 2));
  } else {
    // Save to both DB and file
    saveToDB(aggregate);
    saveToFile(aggregate);

    // Print summary
    console.log('');
    console.log('Summary:');
    console.log(`  Sessions: ${aggregate.summary.totalSessions}`);
    console.log(`  Accomplishments: ${aggregate.summary.totalAccomplishments}`);
    console.log(`  Avg Eval Delta: ${aggregate.summary.avgEvalScoreDelta ?? 'N/A'}`);
    console.log(`  Avg Duration: ${aggregate.summary.avgSessionDuration ?? 'N/A'} minutes`);

    if (Object.keys(aggregate.summary.agentBreakdown).length > 0) {
      console.log('');
      console.log('Agent Breakdown:');
      for (const [agent, count] of Object.entries(aggregate.summary.agentBreakdown)) {
        console.log(`  ${agent}: ${count} accomplishments`);
      }
    }
    console.log('');
  }
}

main();
