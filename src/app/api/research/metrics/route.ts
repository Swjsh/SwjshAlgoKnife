/**
 * /api/research/metrics — Research Lab Metrics API for CHIEF Monitoring
 *
 * GET  /api/research/metrics - Returns latest AutoResearch metrics
 * POST /api/research/metrics - Creates Jira tickets based on metrics analysis
 *
 * This endpoint supports the CHIEF workflow for Research Lab Monitoring:
 * - Reads autoresearch-metrics.json
 * - Calculates health score
 * - Creates INFRA-[RESEARCH] and INFRA-[DEVOPS] tickets as needed
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

// ============================================================================
// Constants
// ============================================================================

const ROOT = process.cwd();
const AUTORESEARCH_METRICS_FILE = path.join(ROOT, 'data', 'autoresearch-metrics.json');
const RESEARCH_LAB_HEALTH_FILE = path.join(ROOT, 'data', 'research-lab-health.json');
const RESULTS_TSV = path.join(ROOT, 'results.tsv');
const OVERNIGHT_DIR = path.join(ROOT, '.claude', 'overnight');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const JIRA_CLIENT_PATH = path.join(SCRIPTS_DIR, 'jira_client.py');

// ============================================================================
// Types
// ============================================================================

interface AutoResearchMetrics {
  sessionId: string;
  stoppedAt: string;
  totalExperiments: number;
  experimentsKept: number;
  experimentsDiscarded: number;
  branches: string[];
  resultsByAgent: Record<string, {
    kept: number;
    discarded: number;
    bestMetric: number | null;
  }>;
}

interface HealthScore {
  score: number;
  status: 'GREEN' | 'YELLOW' | 'RED';
  breakdown: {
    experimentsScore: number;
    keepRatioScore: number;
    crashScore: number;
    metricScore: number;
  };
  issues: string[];
  recommendations: string[];
}

interface ResearchLabHealth {
  sessionId: string;
  calculatedAt: string;
  metrics: AutoResearchMetrics;
  health: HealthScore;
  jiraTicketsCreated: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch {
    // Directory may already exist
  }
}

/**
 * Calculate health score based on AutoResearch metrics
 */
function calculateHealthScore(metrics: AutoResearchMetrics): HealthScore {
  const breakdown = {
    experimentsScore: 0,
    keepRatioScore: 0,
    crashScore: 0,
    metricScore: 0,
  };
  const issues: string[] = [];
  const recommendations: string[] = [];

  // 1. Experiments run: +20 if >10 experiments
  if (metrics.totalExperiments >= 10) {
    breakdown.experimentsScore = 20;
  } else if (metrics.totalExperiments >= 5) {
    breakdown.experimentsScore = 10;
    issues.push(`Only ${metrics.totalExperiments} experiments run (target: 10+)`);
  } else {
    breakdown.experimentsScore = 0;
    issues.push(`Low experiment count: ${metrics.totalExperiments}`);
    recommendations.push('Increase experiment throughput by parallelizing agent work');
  }

  // 2. Keep ratio: +30 if >60%, +20 if >40%
  const keepRatio = metrics.totalExperiments > 0
    ? (metrics.experimentsKept / metrics.totalExperiments) * 100
    : 0;

  if (keepRatio >= 60) {
    breakdown.keepRatioScore = 30;
  } else if (keepRatio >= 40) {
    breakdown.keepRatioScore = 20;
    issues.push(`Keep ratio ${keepRatio.toFixed(1)}% is below target (60%+)`);
  } else {
    breakdown.keepRatioScore = 10;
    issues.push(`Poor keep ratio: ${keepRatio.toFixed(1)}%`);
    recommendations.push('Review experiment methodology - many experiments being discarded');
  }

  // 3. No crashes: +20 if all agents completed
  const agentResults = Object.values(metrics.resultsByAgent);
  const activeAgents = agentResults.filter(a => a.kept + a.discarded > 0).length;
  const totalAgents = Object.keys(metrics.resultsByAgent).length;

  if (activeAgents >= totalAgents || totalAgents === 0) {
    breakdown.crashScore = 20;
  } else {
    const crashedCount = totalAgents - activeAgents;
    breakdown.crashScore = Math.max(0, 20 - crashedCount * 5);
    issues.push(`${crashedCount} agent(s) crashed or stalled`);

    // Identify which agents had issues
    for (const [agent, result] of Object.entries(metrics.resultsByAgent)) {
      if (result.kept + result.discarded === 0) {
        recommendations.push(`Investigate ${agent} - no experiments completed`);
      }
    }
  }

  // 4. Metrics improved: +30 if bestMetric exists
  let bestMetricFound = false;
  for (const result of agentResults) {
    if (result.bestMetric !== null && result.bestMetric > 0) {
      bestMetricFound = true;
      break;
    }
  }

  if (bestMetricFound) {
    breakdown.metricScore = 30;
  } else {
    breakdown.metricScore = 15;
    issues.push('No metric improvements recorded');
    recommendations.push('Ensure agents are logging metrics to results.tsv');
  }

  // Calculate total score
  const score = breakdown.experimentsScore +
    breakdown.keepRatioScore +
    breakdown.crashScore +
    breakdown.metricScore;

  // Determine status
  let status: 'GREEN' | 'YELLOW' | 'RED';
  if (score >= 80) {
    status = 'GREEN';
  } else if (score >= 50) {
    status = 'YELLOW';
  } else {
    status = 'RED';
  }

  return { score, status, breakdown, issues, recommendations };
}

/**
 * Execute jira_client.py with given arguments
 */
async function execJiraClient(args: string[]): Promise<{ raw: string; success: boolean }> {
  return new Promise((resolve) => {
    const proc = spawn('python', [JIRA_CLIENT_PATH, ...args], {
      cwd: SCRIPTS_DIR,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ raw: stdout, success: code === 0 });
    });

    proc.on('error', () => {
      resolve({ raw: '', success: false });
    });

    setTimeout(() => {
      proc.kill();
      resolve({ raw: '', success: false });
    }, 15000);
  });
}

/**
 * Create a Jira ticket for Research Lab tracking
 */
async function createResearchTicket(
  sessionId: string,
  metrics: AutoResearchMetrics,
  health: HealthScore
): Promise<string | null> {
  const keepRatio = metrics.totalExperiments > 0
    ? ((metrics.experimentsKept / metrics.totalExperiments) * 100).toFixed(1)
    : '0';

  // Find best performing agent
  let bestAgent = 'N/A';
  let bestAgentMetric = 0;
  for (const [agent, result] of Object.entries(metrics.resultsByAgent)) {
    if (result.bestMetric !== null && result.bestMetric > bestAgentMetric) {
      bestAgentMetric = result.bestMetric;
      bestAgent = agent;
    }
  }

  const summary = `[RESEARCH] Session ${sessionId} Results`;
  const description = `
Research Lab Session Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Experiments: ${metrics.totalExperiments} (${metrics.experimentsKept} kept, ${metrics.experimentsDiscarded} discarded)
Keep Ratio: ${keepRatio}%
Best Metric: ${bestAgentMetric > 0 ? bestAgentMetric.toFixed(3) : 'N/A'} (${bestAgent})
Agents Active: ${Object.keys(metrics.resultsByAgent).length}/8

Health: ${health.status} (Score: ${health.score})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Per-Agent Breakdown:
${Object.entries(metrics.resultsByAgent)
    .map(([agent, result]) =>
      `• ${agent}: ${result.kept + result.discarded} experiments (${result.kept} kept)`
    )
    .join('\n')}

${health.issues.length > 0 ? `\nIssues:\n${health.issues.map(i => `• ${i}`).join('\n')}` : ''}
${health.recommendations.length > 0 ? `\nRecommendations:\n${health.recommendations.map(r => `• ${r}`).join('\n')}` : ''}
`.trim();

  const args = [
    'create', 'INFRA', summary,
    '--desc', description,
    '--labels', 'research-lab', 'autoresearch', health.status.toLowerCase(),
  ];

  const result = await execJiraClient(args);
  if (result.success) {
    const keyMatch = result.raw.match(/([A-Z]+-\d+)/);
    return keyMatch ? keyMatch[1] : null;
  }
  return null;
}

/**
 * Create a DevOps ticket for Research Lab issues
 */
async function createDevOpsTicket(
  sessionId: string,
  issue: string,
  recommendation: string,
  priority: 'High' | 'Medium'
): Promise<string | null> {
  const summary = `[DEVOPS] Research Lab: ${issue.substring(0, 50)}`;
  const description = `
Research Lab DevOps Task
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Session: ${sessionId}
Priority: ${priority}

Issue Identified:
${issue}

Recommended Action:
${recommendation}

Steps to Investigate:
1. Check terminal status files in .claude/overnight/
2. Review results.tsv for experiment history
3. Check agent prompts for configuration issues
4. Test affected agent in isolation

Blocking: Research Lab capacity may be reduced
`.trim();

  const args = [
    'create', 'INFRA', summary,
    '--desc', description,
    '--priority', priority,
    '--labels', 'devops', 'research-lab', 'autoresearch',
  ];

  const result = await execJiraClient(args);
  if (result.success) {
    const keyMatch = result.raw.match(/([A-Z]+-\d+)/);
    return keyMatch ? keyMatch[1] : null;
  }
  return null;
}

// ============================================================================
// GET Handler — Retrieve Research Lab metrics
// ============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    // Read latest metrics
    if (!(await fileExists(AUTORESEARCH_METRICS_FILE))) {
      return NextResponse.json({
        success: false,
        error: 'No AutoResearch metrics found. Run an overnight session first.',
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    const metricsRaw = await fs.readFile(AUTORESEARCH_METRICS_FILE, 'utf-8');
    const metrics: AutoResearchMetrics = JSON.parse(metricsRaw);

    // Calculate health score
    const health = calculateHealthScore(metrics);

    // Read historical health if exists
    let previousHealth: ResearchLabHealth | null = null;
    if (await fileExists(RESEARCH_LAB_HEALTH_FILE)) {
      try {
        const healthRaw = await fs.readFile(RESEARCH_LAB_HEALTH_FILE, 'utf-8');
        previousHealth = JSON.parse(healthRaw);
      } catch {
        // Ignore parse errors
      }
    }

    return NextResponse.json({
      success: true,
      sessionId: metrics.sessionId,
      stoppedAt: metrics.stoppedAt,
      metrics: {
        totalExperiments: metrics.totalExperiments,
        experimentsKept: metrics.experimentsKept,
        experimentsDiscarded: metrics.experimentsDiscarded,
        keepRatio: metrics.totalExperiments > 0
          ? ((metrics.experimentsKept / metrics.totalExperiments) * 100).toFixed(1) + '%'
          : '0%',
        branchCount: metrics.branches.length,
        agentCount: Object.keys(metrics.resultsByAgent).length,
      },
      health,
      previousSession: previousHealth ? {
        sessionId: previousHealth.sessionId,
        score: previousHealth.health.score,
        status: previousHealth.health.status,
      } : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[research/metrics] GET failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch metrics',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// ============================================================================
// POST Handler — Create Jira tickets for Research Lab
// ============================================================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { action } = body;

    // Read latest metrics
    if (!(await fileExists(AUTORESEARCH_METRICS_FILE))) {
      return NextResponse.json({
        success: false,
        error: 'No AutoResearch metrics found. Run an overnight session first.',
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    const metricsRaw = await fs.readFile(AUTORESEARCH_METRICS_FILE, 'utf-8');
    const metrics: AutoResearchMetrics = JSON.parse(metricsRaw);
    const health = calculateHealthScore(metrics);

    const jiraTicketsCreated: string[] = [];

    if (action === 'create-tickets' || action === 'full-analysis') {
      // 1. Create RESEARCH ticket for session results
      const researchTicket = await createResearchTicket(
        metrics.sessionId,
        metrics,
        health
      );
      if (researchTicket) {
        jiraTicketsCreated.push(researchTicket);
        console.log(`[research/metrics] Created RESEARCH ticket: ${researchTicket}`);
      }

      // 2. Create DEVOPS tickets for issues (only if YELLOW or RED)
      if (health.status !== 'GREEN' && health.issues.length > 0) {
        const priority = health.status === 'RED' ? 'High' : 'Medium';

        for (let i = 0; i < Math.min(health.issues.length, 3); i++) {
          const issue = health.issues[i];
          const recommendation = health.recommendations[i] || 'Investigate and resolve the issue';

          const devopsTicket = await createDevOpsTicket(
            metrics.sessionId,
            issue,
            recommendation,
            priority
          );
          if (devopsTicket) {
            jiraTicketsCreated.push(devopsTicket);
            console.log(`[research/metrics] Created DEVOPS ticket: ${devopsTicket}`);
          }
        }
      }

      // 3. Save health state for tracking
      await ensureDir(path.join(ROOT, 'data'));
      const healthState: ResearchLabHealth = {
        sessionId: metrics.sessionId,
        calculatedAt: new Date().toISOString(),
        metrics,
        health,
        jiraTicketsCreated,
      };
      await fs.writeFile(RESEARCH_LAB_HEALTH_FILE, JSON.stringify(healthState, null, 2), 'utf-8');

      return NextResponse.json({
        success: true,
        action: 'create-tickets',
        sessionId: metrics.sessionId,
        health: {
          score: health.score,
          status: health.status,
        },
        jiraTicketsCreated,
        message: jiraTicketsCreated.length > 0
          ? `Created ${jiraTicketsCreated.length} Jira ticket(s): ${jiraTicketsCreated.join(', ')}`
          : 'No Jira tickets needed (session healthy)',
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: false,
      error: `Unknown action: ${action}. Supported: create-tickets, full-analysis`,
      timestamp: new Date().toISOString(),
    }, { status: 400 });
  } catch (error) {
    console.error('[research/metrics] POST failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process metrics',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
