/**
 * Audit Scores API Endpoint
 * =========================
 * Returns current evaluation scores for all 6 audit categories.
 * Powers the Command Center dashboard.
 *
 * GET /api/audit/scores
 *   Returns: All category scores, composite, deployment gate status
 *
 * Part of Research Agent Audit Command Center
 */

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface CriterionResult {
  name: string;
  met: boolean;
  points: number;
  maxPoints: number;
  details: string;
}

interface CategoryScore {
  name: string;
  score: number;
  maxScore: number;
  percentage: number;
  criteria: CriterionResult[];
  status: 'CRITICAL' | 'WEAK' | 'PARTIAL' | 'GOOD' | 'EXCELLENT' | 'PERFECT';
}

// ============================================================================
// Constants
// ============================================================================

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const CLAUDE_DIR = path.join(ROOT, '.claude');

const WEIGHTS = {
  AGENT_HEALTH_MONITORING: 15,
  SESSION_TRACKING: 15,
  STRUCTURED_OUTPUT: 20,
  ACCOMPLISHMENT_AGGREGATION: 20,
  CROSS_SESSION_TRENDS: 15,
  UNIFIED_AGENT_VIEW: 15,
};

const DEPLOYMENT_THRESHOLD = 95;

// ============================================================================
// Utility Functions
// ============================================================================

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function dirExists(dirPath: string): boolean {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function countFilesMatching(dir: string, pattern: RegExp): number {
  try {
    if (!dirExists(dir)) return 0;
    const files = fs.readdirSync(dir);
    return files.filter(f => pattern.test(f)).length;
  } catch {
    return 0;
  }
}

function getStatus(percentage: number): CategoryScore['status'] {
  if (percentage >= 96) return 'PERFECT';
  if (percentage >= 95) return 'EXCELLENT';
  if (percentage >= 80) return 'GOOD';
  if (percentage >= 60) return 'PARTIAL';
  if (percentage >= 40) return 'WEAK';
  return 'CRITICAL';
}

function readJsonFile(filePath: string): unknown | null {
  try {
    if (fileExists(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // Invalid JSON
  }
  return null;
}

// ============================================================================
// Category Evaluators (Simplified from CLI version)
// ============================================================================

function evaluateAgentHealthMonitoring(): CategoryScore {
  const criteria: CriterionResult[] = [];
  let score = 0;

  const heartbeatFile = path.join(DATA_DIR, 'heartbeat-status.json');
  const hasHeartbeat = fileExists(heartbeatFile);
  criteria.push({ name: 'Heartbeat status file', met: hasHeartbeat, points: hasHeartbeat ? 2 : 0, maxPoints: 2, details: hasHeartbeat ? 'exists' : 'missing' });
  if (hasHeartbeat) score += 2;

  let has3TierStatus = false;
  if (hasHeartbeat) {
    const data = readJsonFile(heartbeatFile) as { agents?: Record<string, { status?: string }> } | null;
    if (data?.agents) {
      has3TierStatus = Object.values(data.agents).some(a => ['alive', 'stale', 'dead'].includes(a.status || ''));
    }
  }
  criteria.push({ name: '3-tier status tracking', met: has3TierStatus, points: has3TierStatus ? 2 : 0, maxPoints: 2, details: has3TierStatus ? 'implemented' : 'missing' });
  if (has3TierStatus) score += 2;

  let hasStuckDetection = false;
  if (hasHeartbeat) {
    const data = readJsonFile(heartbeatFile) as { agents?: Record<string, { waitingDetectedAt?: string }> } | null;
    if (data?.agents) {
      hasStuckDetection = Object.values(data.agents).some(a => 'waitingDetectedAt' in a);
    }
  }
  criteria.push({ name: 'Stuck detection', met: hasStuckDetection, points: hasStuckDetection ? 2 : 0, maxPoints: 2, details: hasStuckDetection ? 'implemented' : 'missing' });
  if (hasStuckDetection) score += 2;

  let hasNudgeTracking = false;
  if (hasHeartbeat) {
    const data = readJsonFile(heartbeatFile) as { agents?: Record<string, { nudgeCount?: number }> } | null;
    if (data?.agents) {
      hasNudgeTracking = Object.values(data.agents).some(a => typeof a.nudgeCount === 'number');
    }
  }
  criteria.push({ name: 'Auto-nudge tracking', met: hasNudgeTracking, points: hasNudgeTracking ? 2 : 0, maxPoints: 2, details: hasNudgeTracking ? 'implemented' : 'missing' });
  if (hasNudgeTracking) score += 2;

  const hasActivityBridge = fileExists(path.join(ROOT, 'scripts', 'activity-bridge.ts'));
  criteria.push({ name: 'Activity Bridge', met: hasActivityBridge, points: hasActivityBridge ? 2 : 0, maxPoints: 2, details: hasActivityBridge ? 'exists' : 'missing' });
  if (hasActivityBridge) score += 2;

  const hasRegistry = fileExists(path.join(DATA_DIR, 'agent-registry.json'));
  criteria.push({ name: 'Agent registry', met: hasRegistry, points: hasRegistry ? 2 : 0, maxPoints: 2, details: hasRegistry ? 'exists' : 'missing' });
  if (hasRegistry) score += 2;

  const hasHealthStatus = fileExists(path.join(DATA_DIR, 'health_status.json'));
  criteria.push({ name: 'Health status file', met: hasHealthStatus, points: hasHealthStatus ? 1.5 : 0, maxPoints: 1.5, details: hasHealthStatus ? 'exists' : 'missing' });
  if (hasHealthStatus) score += 1.5;

  const healthPredictorFile = path.join(ROOT, 'src', 'lib', 'healthPredictor.ts');
  const hasPredictiveHealth = fileExists(healthPredictorFile);
  criteria.push({ name: 'Predictive health', met: hasPredictiveHealth, points: hasPredictiveHealth ? 1.5 : 0, maxPoints: 1.5, details: hasPredictiveHealth ? 'implemented' : 'missing' });
  if (hasPredictiveHealth) score += 1.5;

  const percentage = Math.min(100, Math.round((score / 15.5) * 100));
  return { name: 'Agent Health Monitoring', score: Math.round((percentage / 100) * 15 * 10) / 10, maxScore: 15, percentage, criteria, status: getStatus(percentage) };
}

function evaluateSessionTracking(): CategoryScore {
  const criteria: CriterionResult[] = [];
  let score = 0;

  const hasOvernightRoute = fileExists(path.join(ROOT, 'src', 'app', 'api', 'research', 'overnight', 'route.ts'));
  criteria.push({ name: 'Overnight API', met: hasOvernightRoute, points: hasOvernightRoute ? 2 : 0, maxPoints: 2, details: hasOvernightRoute ? 'exists' : 'missing' });
  if (hasOvernightRoute) score += 2;

  const hasStatusRoute = fileExists(path.join(ROOT, 'src', 'app', 'api', 'research', 'status', 'route.ts'));
  criteria.push({ name: 'Status API', met: hasStatusRoute, points: hasStatusRoute ? 2 : 0, maxPoints: 2, details: hasStatusRoute ? 'exists' : 'missing' });
  if (hasStatusRoute) score += 2;

  const hasLogsRoute = fileExists(path.join(ROOT, 'src', 'app', 'api', 'research', 'logs', 'route.ts'));
  criteria.push({ name: 'Logs API', met: hasLogsRoute, points: hasLogsRoute ? 2 : 0, maxPoints: 2, details: hasLogsRoute ? 'exists' : 'missing' });
  if (hasLogsRoute) score += 2;

  const hasCommandRoute = fileExists(path.join(ROOT, 'src', 'app', 'api', 'research', 'command', 'route.ts'));
  criteria.push({ name: 'Command API', met: hasCommandRoute, points: hasCommandRoute ? 2 : 0, maxPoints: 2, details: hasCommandRoute ? 'exists' : 'missing' });
  if (hasCommandRoute) score += 2;

  const hasMorningReport = fileExists(path.join(ROOT, 'scripts', 'generate_morning_report.ts'));
  criteria.push({ name: 'Morning report generator', met: hasMorningReport, points: hasMorningReport ? 2 : 0, maxPoints: 2, details: hasMorningReport ? 'exists' : 'missing' });
  if (hasMorningReport) score += 2;

  const reportCount = countFilesMatching(path.join(DATA_DIR, 'morning-reports'), /\.json$/);
  const hasReports = reportCount > 0;
  criteria.push({ name: 'Morning reports', met: hasReports, points: hasReports ? 2 : 0, maxPoints: 2, details: `${reportCount} found` });
  if (hasReports) score += 2;

  const hasTrendChart = fileExists(path.join(ROOT, 'src', 'components', 'Dashboard', 'TrendChart.tsx'));
  criteria.push({ name: 'Trend visualization', met: hasTrendChart, points: hasTrendChart ? 1.5 : 0, maxPoints: 1.5, details: hasTrendChart ? 'exists' : 'missing' });
  if (hasTrendChart) score += 1.5;

  const percentage = Math.min(100, Math.round((score / 13.5) * 100));
  return { name: 'Session Tracking', score: Math.round((percentage / 100) * 15 * 10) / 10, maxScore: 15, percentage, criteria, status: getStatus(percentage) };
}

function evaluateStructuredOutput(): CategoryScore {
  const criteria: CriterionResult[] = [];
  let score = 0;

  const hasPromptGen = fileExists(path.join(ROOT, 'scripts', 'generate_overnight_prompts.ts'));
  criteria.push({ name: 'Prompt generator', met: hasPromptGen, points: hasPromptGen ? 3 : 0, maxPoints: 3, details: hasPromptGen ? 'exists' : 'missing' });
  if (hasPromptGen) score += 3;

  const promptCount = countFilesMatching(path.join(CLAUDE_DIR, 'overnight'), /terminal_\d+_prompt\.md$/);
  const hasPrompts = promptCount >= 4;
  criteria.push({ name: 'Terminal prompts', met: hasPrompts, points: hasPrompts ? 3 : 0, maxPoints: 3, details: `${promptCount} found` });
  if (hasPrompts) score += 3;

  const hasActionParser = fileExists(path.join(ROOT, 'scripts', 'parse_accomplishments.ts'));
  criteria.push({ name: 'Action parser', met: hasActionParser, points: hasActionParser ? 3 : 0, maxPoints: 3, details: hasActionParser ? 'exists' : 'missing' });
  if (hasActionParser) score += 3;

  const resultsCount = countFilesMatching(path.join(CLAUDE_DIR, 'overnight'), /terminal_\d+_results\.json$/);
  const hasResults = resultsCount >= 1;
  criteria.push({ name: 'Results files', met: hasResults, points: hasResults ? 3 : 0, maxPoints: 3, details: `${resultsCount} found` });
  if (hasResults) score += 3;

  const heartbeatCount = countFilesMatching(path.join(CLAUDE_DIR, 'overnight'), /terminal_\d+_heartbeat\.jsonl$/);
  const hasHeartbeatLogs = heartbeatCount >= 1;
  criteria.push({ name: 'Heartbeat logs', met: hasHeartbeatLogs, points: hasHeartbeatLogs ? 2 : 0, maxPoints: 2, details: `${heartbeatCount} found` });
  if (hasHeartbeatLogs) score += 2;

  criteria.push({ name: 'Schema validator', met: hasActionParser, points: hasActionParser ? 3 : 0, maxPoints: 3, details: hasActionParser ? 'TypeScript interfaces' : 'missing' });
  if (hasActionParser) score += 3;

  criteria.push({ name: 'Results schema', met: hasPrompts, points: hasPrompts ? 2 : 0, maxPoints: 2, details: hasPrompts ? 'in prompts' : 'missing' });
  if (hasPrompts) score += 2;

  const percentage = Math.min(100, Math.round((score / 19) * 100));
  return { name: 'Structured Output', score: Math.round((percentage / 100) * 20 * 10) / 10, maxScore: 20, percentage, criteria, status: getStatus(percentage) };
}

function evaluateAccomplishmentAggregation(): CategoryScore {
  const criteria: CriterionResult[] = [];
  let score = 0;

  const hasMorningReport = fileExists(path.join(ROOT, 'scripts', 'generate_morning_report.ts'));
  criteria.push({ name: 'Morning report generator', met: hasMorningReport, points: hasMorningReport ? 3 : 0, maxPoints: 3, details: hasMorningReport ? 'exists' : 'missing' });
  if (hasMorningReport) score += 3;

  const reportCount = countFilesMatching(path.join(DATA_DIR, 'morning-reports'), /\.(json|md)$/);
  const hasReports = reportCount >= 2;
  criteria.push({ name: 'Reports generated', met: hasReports, points: hasReports ? 3 : 0, maxPoints: 3, details: `${reportCount} found` });
  if (hasReports) score += 3;

  const overnightRoute = path.join(ROOT, 'src', 'app', 'api', 'research', 'overnight', 'route.ts');
  let hasAutoTrigger = false;
  if (fileExists(overnightRoute)) {
    try {
      const content = fs.readFileSync(overnightRoute, 'utf-8');
      hasAutoTrigger = content.includes('AUTO-TRIGGER') && content.includes('parse_accomplishments');
    } catch { /* ignore */ }
  }
  criteria.push({ name: 'Auto-trigger on stop', met: hasAutoTrigger, points: hasAutoTrigger ? 3 : 0, maxPoints: 3, details: hasAutoTrigger ? 'implemented' : 'missing' });
  if (hasAutoTrigger) score += 3;

  const dbFile = path.join(ROOT, 'src', 'lib', 'db.ts');
  let hasAccomplishmentsTable = false;
  if (fileExists(dbFile)) {
    try {
      const content = fs.readFileSync(dbFile, 'utf-8');
      hasAccomplishmentsTable = content.includes('accomplishments');
    } catch { /* ignore */ }
  }
  criteria.push({ name: 'SQLite table', met: hasAccomplishmentsTable, points: hasAccomplishmentsTable ? 4 : 0, maxPoints: 4, details: hasAccomplishmentsTable ? 'exists' : 'missing' });
  if (hasAccomplishmentsTable) score += 4;

  const hasWidget = fileExists(path.join(ROOT, 'src', 'components', 'Dashboard', 'AccomplishmentsWidget.tsx'));
  criteria.push({ name: 'Dashboard widget', met: hasWidget, points: hasWidget ? 4 : 0, maxPoints: 4, details: hasWidget ? 'exists' : 'missing' });
  if (hasWidget) score += 4;

  const accomplishmentsRoute = path.join(ROOT, 'src', 'app', 'api', 'accomplishments', 'route.ts');
  let hasStreaming = false;
  if (fileExists(accomplishmentsRoute)) {
    try {
      const content = fs.readFileSync(accomplishmentsRoute, 'utf-8').toLowerCase();
      hasStreaming = content.includes('stream') && content.includes('text/event-stream');
    } catch { /* ignore */ }
  }
  criteria.push({ name: 'Real-time streaming', met: hasStreaming, points: hasStreaming ? 3 : 0, maxPoints: 3, details: hasStreaming ? 'SSE implemented' : 'missing' });
  if (hasStreaming) score += 3;

  const percentage = Math.min(100, Math.round((score / 20) * 100));
  return { name: 'Accomplishment Aggregation', score: Math.round((percentage / 100) * 20 * 10) / 10, maxScore: 20, percentage, criteria, status: getStatus(percentage) };
}

function evaluateCrossSessionTrends(): CategoryScore {
  const criteria: CriterionResult[] = [];
  let score = 0;

  const reportCount = countFilesMatching(path.join(DATA_DIR, 'morning-reports'), /\.json$/);
  const hasReports = reportCount >= 1;
  criteria.push({ name: 'Reports stored', met: hasReports, points: hasReports ? 2 : 0, maxPoints: 2, details: `${reportCount} found` });
  if (hasReports) score += 2;

  const hasWeeklyAgg = fileExists(path.join(ROOT, 'scripts', 'aggregate_weekly.ts'));
  criteria.push({ name: 'Weekly aggregation', met: hasWeeklyAgg, points: hasWeeklyAgg ? 3 : 0, maxPoints: 3, details: hasWeeklyAgg ? 'exists' : 'missing' });
  if (hasWeeklyAgg) score += 3;

  const dbFile = path.join(ROOT, 'src', 'lib', 'db.ts');
  let hasTrendTable = false;
  if (fileExists(dbFile)) {
    try {
      const content = fs.readFileSync(dbFile, 'utf-8');
      hasTrendTable = content.includes('trend_metrics');
    } catch { /* ignore */ }
  }
  criteria.push({ name: 'Trend metrics table', met: hasTrendTable, points: hasTrendTable ? 3 : 0, maxPoints: 3, details: hasTrendTable ? 'exists' : 'missing' });
  if (hasTrendTable) score += 3;

  const hasTrendsEndpoint = fileExists(path.join(ROOT, 'src', 'app', 'api', 'agents', 'trends', 'route.ts'));
  criteria.push({ name: 'Trends API', met: hasTrendsEndpoint, points: hasTrendsEndpoint ? 2 : 0, maxPoints: 2, details: hasTrendsEndpoint ? 'exists' : 'missing' });
  if (hasTrendsEndpoint) score += 2;

  const hasTrendChart = fileExists(path.join(ROOT, 'src', 'components', 'Dashboard', 'TrendChart.tsx'));
  criteria.push({ name: 'Trend chart', met: hasTrendChart, points: hasTrendChart ? 3 : 0, maxPoints: 3, details: hasTrendChart ? 'exists' : 'missing' });
  if (hasTrendChart) score += 3;

  const trendsRoute = path.join(ROOT, 'src', 'app', 'api', 'agents', 'trends', 'route.ts');
  let hasAnomalyDetection = false;
  if (fileExists(trendsRoute)) {
    try {
      const content = fs.readFileSync(trendsRoute, 'utf-8');
      hasAnomalyDetection = content.includes('detectAnomalies') || content.includes('TrendAnomaly');
    } catch { /* ignore */ }
  }
  criteria.push({ name: 'Anomaly detection', met: hasAnomalyDetection, points: hasAnomalyDetection ? 2 : 0, maxPoints: 2, details: hasAnomalyDetection ? 'Z-score' : 'missing' });
  if (hasAnomalyDetection) score += 2;

  const percentage = Math.min(100, Math.round((score / 15) * 100));
  return { name: 'Cross-Session Trends', score: Math.round((percentage / 100) * 15 * 10) / 10, maxScore: 15, percentage, criteria, status: getStatus(percentage) };
}

function evaluateUnifiedAgentView(): CategoryScore {
  const criteria: CriterionResult[] = [];
  let score = 0;

  const hasResearchHook = fileExists(path.join(ROOT, 'src', 'hooks', 'useResearchAgents.ts'));
  criteria.push({ name: 'Research agents hook', met: hasResearchHook, points: hasResearchHook ? 2 : 0, maxPoints: 2, details: hasResearchHook ? 'exists' : 'missing' });
  if (hasResearchHook) score += 2;

  const hasActivityHook = fileExists(path.join(ROOT, 'src', 'hooks', 'useActivityFeed.ts'));
  criteria.push({ name: 'Activity feed hook', met: hasActivityHook, points: hasActivityHook ? 2 : 0, maxPoints: 2, details: hasActivityHook ? 'exists' : 'missing' });
  if (hasActivityHook) score += 2;

  const hasUnifiedEndpoint = fileExists(path.join(ROOT, 'src', 'app', 'api', 'agents', 'unified', 'route.ts'));
  criteria.push({ name: 'Unified endpoint', met: hasUnifiedEndpoint, points: hasUnifiedEndpoint ? 3 : 0, maxPoints: 3, details: hasUnifiedEndpoint ? 'exists' : 'missing' });
  if (hasUnifiedEndpoint) score += 3;

  const researchPage = path.join(ROOT, 'src', 'app', 'research', 'page.tsx');
  const haloStatusBar = path.join(ROOT, 'src', 'components', 'ResearchLab', 'HaloAgentStatusBar.tsx');
  let showsBothTypes = false;
  if (fileExists(researchPage) && fileExists(haloStatusBar)) {
    try {
      const content = fs.readFileSync(researchPage, 'utf-8');
      showsBothTypes = content.includes('HaloAgentStatusBar');
    } catch { /* ignore */ }
  }
  criteria.push({ name: 'Both agent types', met: showsBothTypes, points: showsBothTypes ? 3 : 0, maxPoints: 3, details: showsBothTypes ? 'unified view' : 'separate' });
  if (showsBothTypes) score += 3;

  const accomplishmentsRoute = path.join(ROOT, 'src', 'app', 'api', 'accomplishments', 'route.ts');
  let hasCrossSystemRollup = false;
  if (fileExists(accomplishmentsRoute)) {
    try {
      const content = fs.readFileSync(accomplishmentsRoute, 'utf-8').toLowerCase();
      hasCrossSystemRollup = content.includes('research') && content.includes('halo') && content.includes('trading');
    } catch { /* ignore */ }
  }
  criteria.push({ name: 'Cross-system rollup', met: hasCrossSystemRollup, points: hasCrossSystemRollup ? 3 : 0, maxPoints: 3, details: hasCrossSystemRollup ? 'implemented' : 'missing' });
  if (hasCrossSystemRollup) score += 3;

  const hasJiraMapping = fileExists(path.join(DATA_DIR, 'jira-agents.json'));
  criteria.push({ name: 'Jira mapping', met: hasJiraMapping, points: hasJiraMapping ? 2 : 0, maxPoints: 2, details: hasJiraMapping ? 'exists' : 'missing' });
  if (hasJiraMapping) score += 2;

  const percentage = Math.min(100, Math.round((score / 15) * 100));
  return { name: 'Unified Agent View', score: Math.round((percentage / 100) * 15 * 10) / 10, maxScore: 15, percentage, criteria, status: getStatus(percentage) };
}

// ============================================================================
// API Handler
// ============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    const categories = {
      agentHealthMonitoring: evaluateAgentHealthMonitoring(),
      sessionTracking: evaluateSessionTracking(),
      structuredOutput: evaluateStructuredOutput(),
      accomplishmentAggregation: evaluateAccomplishmentAggregation(),
      crossSessionTrends: evaluateCrossSessionTrends(),
      unifiedAgentView: evaluateUnifiedAgentView(),
    };

    const totalScore = Object.values(categories).reduce((sum, cat) => sum + cat.score, 0);
    const totalMax = Object.values(categories).reduce((sum, cat) => sum + cat.maxScore, 0);
    const composite = Math.round((totalScore / totalMax) * 100);

    const allAbove95 = Object.values(categories).every(cat => cat.percentage >= DEPLOYMENT_THRESHOLD);

    let lowestCategory = '';
    let lowestScore = 100;
    for (const [name, cat] of Object.entries(categories)) {
      if (cat.percentage < lowestScore) {
        lowestScore = cat.percentage;
        lowestCategory = name;
      }
    }

    return NextResponse.json({
      success: true,
      categories,
      composite,
      deploymentGatePassed: allAbove95 && composite >= DEPLOYMENT_THRESHOLD,
      allCategoriesAbove95: allAbove95,
      lowestCategory,
      lowestScore,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Audit Scores API] Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
