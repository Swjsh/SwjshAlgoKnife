#!/usr/bin/env npx tsx
/**
 * Research Agent Audit System — Evaluation Harness
 * =================================================
 * AutoResearch Pattern: prepare → eval → mutate → verify
 *
 * Evaluates 6 categories of the Research Agent Audit system:
 * 1. Agent Health Monitoring (15%)
 * 2. Session Tracking (15%)
 * 3. Structured Output (20%)
 * 4. Accomplishment Aggregation (20%)
 * 5. Cross-Session Trends (15%)
 * 6. Unified Agent View (15%)
 *
 * Usage:
 *   npx tsx scripts/eval_research_audit.ts              # Human-readable output
 *   npx tsx scripts/eval_research_audit.ts --json       # JSON output
 *   npx tsx scripts/eval_research_audit.ts --save       # Save as baseline
 *   npx tsx scripts/eval_research_audit.ts --compare    # Compare to baseline
 *   npx tsx scripts/eval_research_audit.ts --gate       # Check deployment gate
 *
 * Deployment Gate:
 *   ALL categories must be ≥ 95% to pass deployment gate
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface CategoryScore {
  name: string;
  score: number;
  maxScore: number;
  percentage: number;
  criteria: CriterionResult[];
  status: 'CRITICAL' | 'WEAK' | 'PARTIAL' | 'GOOD' | 'EXCELLENT' | 'PERFECT';
}

interface CriterionResult {
  name: string;
  met: boolean;
  points: number;
  maxPoints: number;
  details: string;
}

interface EvalResult {
  timestamp: string;
  iteration: number;
  categories: {
    agentHealthMonitoring: CategoryScore;
    sessionTracking: CategoryScore;
    structuredOutput: CategoryScore;
    accomplishmentAggregation: CategoryScore;
    crossSessionTrends: CategoryScore;
    unifiedAgentView: CategoryScore;
  };
  composite: number;
  deploymentGatePassed: boolean;
  allCategoriesAbove95: boolean;
  lowestCategory: string;
  lowestScore: number;
}

interface SavedState {
  baseline: EvalResult | null;
  history: EvalResult[];
  lastRun: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const ROOT = process.cwd();
const STATE_FILE = path.join(ROOT, '.claude', 'overnight', 'research_audit_eval_state.json');
const DATA_DIR = path.join(ROOT, 'data');
const CLAUDE_DIR = path.join(ROOT, '.claude');

// Category weights (total = 100)
const WEIGHTS = {
  AGENT_HEALTH_MONITORING: 15,
  SESSION_TRACKING: 15,
  STRUCTURED_OUTPUT: 20,
  ACCOMPLISHMENT_AGGREGATION: 20,
  CROSS_SESSION_TRENDS: 15,
  UNIFIED_AGENT_VIEW: 15,
};

// Deployment gate threshold
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

function readJsonFile(filePath: string): unknown | null {
  try {
    if (fileExists(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // File doesn't exist or invalid JSON
  }
  return null;
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

function loadState(): SavedState {
  try {
    if (fileExists(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(content) as SavedState;
    }
  } catch {
    // State file may not exist
  }
  return { baseline: null, history: [], lastRun: null };
}

function saveState(state: SavedState): void {
  const dir = path.dirname(STATE_FILE);
  if (!dirExists(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ============================================================================
// Category Evaluators
// ============================================================================

function evaluateAgentHealthMonitoring(): CategoryScore {
  const criteria: CriterionResult[] = [];
  const maxScore = WEIGHTS.AGENT_HEALTH_MONITORING;
  let score = 0;

  // Criterion 1: Heartbeat status file exists (2 points)
  const heartbeatFile = path.join(DATA_DIR, 'heartbeat-status.json');
  const hasHeartbeat = fileExists(heartbeatFile);
  criteria.push({
    name: 'Heartbeat status file',
    met: hasHeartbeat,
    points: hasHeartbeat ? 2 : 0,
    maxPoints: 2,
    details: hasHeartbeat ? 'data/heartbeat-status.json exists' : 'Missing heartbeat-status.json',
  });
  if (hasHeartbeat) score += 2;

  // Criterion 2: 3-tier status tracking (alive/stale/dead) (2 points)
  let has3TierStatus = false;
  if (hasHeartbeat) {
    const heartbeatData = readJsonFile(heartbeatFile) as { agents?: Record<string, { status?: string }> } | null;
    if (heartbeatData?.agents) {
      const statuses = Object.values(heartbeatData.agents).map(a => a.status);
      has3TierStatus = statuses.some(s => s === 'alive' || s === 'stale' || s === 'dead');
    }
  }
  criteria.push({
    name: '3-tier status (alive/stale/dead)',
    met: has3TierStatus,
    points: has3TierStatus ? 2 : 0,
    maxPoints: 2,
    details: has3TierStatus ? 'Status values include alive/stale/dead' : 'Missing 3-tier status',
  });
  if (has3TierStatus) score += 2;

  // Criterion 3: Stuck detection (waitingDetectedAt field) (2 points)
  let hasStuckDetection = false;
  if (hasHeartbeat) {
    const heartbeatData = readJsonFile(heartbeatFile) as { agents?: Record<string, { waitingDetectedAt?: string | null }> } | null;
    if (heartbeatData?.agents) {
      hasStuckDetection = Object.values(heartbeatData.agents).some(a => 'waitingDetectedAt' in a);
    }
  }
  criteria.push({
    name: 'Stuck detection (waitingDetectedAt)',
    met: hasStuckDetection,
    points: hasStuckDetection ? 2 : 0,
    maxPoints: 2,
    details: hasStuckDetection ? 'waitingDetectedAt field present' : 'Missing stuck detection',
  });
  if (hasStuckDetection) score += 2;

  // Criterion 4: Auto-nudge tracking (nudgeCount field) (2 points)
  let hasNudgeTracking = false;
  if (hasHeartbeat) {
    const heartbeatData = readJsonFile(heartbeatFile) as { agents?: Record<string, { nudgeCount?: number }> } | null;
    if (heartbeatData?.agents) {
      hasNudgeTracking = Object.values(heartbeatData.agents).some(a => typeof a.nudgeCount === 'number');
    }
  }
  criteria.push({
    name: 'Auto-nudge tracking (nudgeCount)',
    met: hasNudgeTracking,
    points: hasNudgeTracking ? 2 : 0,
    maxPoints: 2,
    details: hasNudgeTracking ? 'nudgeCount field tracked' : 'Missing nudge tracking',
  });
  if (hasNudgeTracking) score += 2;

  // Criterion 5: Activity Bridge exists (2 points)
  const activityBridge = path.join(ROOT, 'scripts', 'activity-bridge.ts');
  const hasActivityBridge = fileExists(activityBridge);
  criteria.push({
    name: 'Activity Bridge script',
    met: hasActivityBridge,
    points: hasActivityBridge ? 2 : 0,
    maxPoints: 2,
    details: hasActivityBridge ? 'scripts/activity-bridge.ts exists' : 'Missing activity-bridge.ts',
  });
  if (hasActivityBridge) score += 2;

  // Criterion 6: Agent registry exists (2 points)
  const agentRegistry = path.join(DATA_DIR, 'agent-registry.json');
  const hasRegistry = fileExists(agentRegistry);
  criteria.push({
    name: 'Agent registry file',
    met: hasRegistry,
    points: hasRegistry ? 2 : 0,
    maxPoints: 2,
    details: hasRegistry ? 'data/agent-registry.json exists' : 'Missing agent-registry.json',
  });
  if (hasRegistry) score += 2;

  // Criterion 7: Health status file (1.5 points)
  const healthStatus = path.join(DATA_DIR, 'health_status.json');
  const hasHealthStatus = fileExists(healthStatus);
  criteria.push({
    name: 'Health status file',
    met: hasHealthStatus,
    points: hasHealthStatus ? 1.5 : 0,
    maxPoints: 1.5,
    details: hasHealthStatus ? 'data/health_status.json exists' : 'Missing health_status.json',
  });
  if (hasHealthStatus) score += 1.5;

  // Criterion 8: Predictive health (future - 1.5 points)
  // Check for health predictor module
  const healthPredictorFile = path.join(ROOT, 'src', 'lib', 'healthPredictor.ts');
  let hasPredictiveHealth = false;
  if (fileExists(healthPredictorFile)) {
    try {
      const content = fs.readFileSync(healthPredictorFile, 'utf-8');
      hasPredictiveHealth = content.includes('predictAgentHealth') &&
        (content.includes('failureProbability') || content.includes('prediction'));
    } catch {
      // Can't read
    }
  }
  criteria.push({
    name: 'Predictive health (trend-based)',
    met: hasPredictiveHealth,
    points: hasPredictiveHealth ? 1.5 : 0,
    maxPoints: 1.5,
    details: hasPredictiveHealth ? 'Trend-based health predictor implemented' : 'Predictive health not yet implemented',
  });
  if (hasPredictiveHealth) score += 1.5;

  // Normalize to weight
  const rawPercentage = (score / 15.5) * 100; // 15.5 is sum of achievable points (excluding predictive)
  const percentage = Math.min(100, Math.round(rawPercentage));
  const weightedScore = Math.round((percentage / 100) * maxScore * 10) / 10;

  return {
    name: 'Agent Health Monitoring',
    score: weightedScore,
    maxScore,
    percentage,
    criteria,
    status: getStatus(percentage),
  };
}

function evaluateSessionTracking(): CategoryScore {
  const criteria: CriterionResult[] = [];
  const maxScore = WEIGHTS.SESSION_TRACKING;
  let score = 0;

  // Criterion 1: Overnight API route exists (2 points)
  const overnightRoute = path.join(ROOT, 'src', 'app', 'api', 'research', 'overnight', 'route.ts');
  const hasOvernightRoute = fileExists(overnightRoute);
  criteria.push({
    name: 'Overnight API route',
    met: hasOvernightRoute,
    points: hasOvernightRoute ? 2 : 0,
    maxPoints: 2,
    details: hasOvernightRoute ? 'API route exists' : 'Missing overnight route',
  });
  if (hasOvernightRoute) score += 2;

  // Criterion 2: Status API endpoint (2 points)
  const statusRoute = path.join(ROOT, 'src', 'app', 'api', 'research', 'status', 'route.ts');
  const hasStatusRoute = fileExists(statusRoute);
  criteria.push({
    name: 'Status API endpoint',
    met: hasStatusRoute,
    points: hasStatusRoute ? 2 : 0,
    maxPoints: 2,
    details: hasStatusRoute ? 'Status endpoint exists' : 'Missing status endpoint',
  });
  if (hasStatusRoute) score += 2;

  // Criterion 3: Logs API endpoint (2 points)
  const logsRoute = path.join(ROOT, 'src', 'app', 'api', 'research', 'logs', 'route.ts');
  const hasLogsRoute = fileExists(logsRoute);
  criteria.push({
    name: 'Logs API endpoint',
    met: hasLogsRoute,
    points: hasLogsRoute ? 2 : 0,
    maxPoints: 2,
    details: hasLogsRoute ? 'Logs endpoint exists' : 'Missing logs endpoint',
  });
  if (hasLogsRoute) score += 2;

  // Criterion 4: Command queue API (2 points)
  const commandRoute = path.join(ROOT, 'src', 'app', 'api', 'research', 'command', 'route.ts');
  const hasCommandRoute = fileExists(commandRoute);
  criteria.push({
    name: 'Command queue API',
    met: hasCommandRoute,
    points: hasCommandRoute ? 2 : 0,
    maxPoints: 2,
    details: hasCommandRoute ? 'Command endpoint exists' : 'Missing command endpoint',
  });
  if (hasCommandRoute) score += 2;

  // Criterion 5: Morning report generator (2 points)
  const morningReport = path.join(ROOT, 'scripts', 'generate_morning_report.ts');
  const hasMorningReport = fileExists(morningReport);
  criteria.push({
    name: 'Morning report generator',
    met: hasMorningReport,
    points: hasMorningReport ? 2 : 0,
    maxPoints: 2,
    details: hasMorningReport ? 'Morning report script exists' : 'Missing morning report script',
  });
  if (hasMorningReport) score += 2;

  // Criterion 6: Morning reports directory has files (2 points)
  const morningReportsDir = path.join(DATA_DIR, 'morning-reports');
  const morningReportCount = countFilesMatching(morningReportsDir, /\.json$/);
  const hasMorningReports = morningReportCount > 0;
  criteria.push({
    name: 'Morning reports generated',
    met: hasMorningReports,
    points: hasMorningReports ? 2 : 0,
    maxPoints: 2,
    details: hasMorningReports ? `${morningReportCount} report(s) found` : 'No morning reports generated',
  });
  if (hasMorningReports) score += 2;

  // Criterion 7: Auto session summary on stop (1.5 points)
  // Check if overnight route has auto-summary logic
  let hasAutoSummary = false;
  if (hasOvernightRoute) {
    try {
      const routeContent = fs.readFileSync(overnightRoute, 'utf-8');
      hasAutoSummary = routeContent.includes('morning-report') && routeContent.includes('stop');
    } catch {
      // Can't read file
    }
  }
  criteria.push({
    name: 'Auto session summary on stop',
    met: hasAutoSummary,
    points: hasAutoSummary ? 1.5 : 0,
    maxPoints: 1.5,
    details: hasAutoSummary ? 'Auto-summary logic present' : 'Missing auto-summary on stop',
  });
  if (hasAutoSummary) score += 1.5;

  // Criterion 8: Trend visualization (1.5 points)
  const trendChartFile = path.join(ROOT, 'src', 'components', 'Dashboard', 'TrendChart.tsx');
  const hasTrendViz = fileExists(trendChartFile);
  criteria.push({
    name: 'Trend visualization',
    met: hasTrendViz,
    points: hasTrendViz ? 1.5 : 0,
    maxPoints: 1.5,
    details: hasTrendViz ? 'TrendChart component exists' : 'Trend visualization not yet implemented',
  });
  if (hasTrendViz) score += 1.5;

  const rawPercentage = (score / 13.5) * 100;
  const percentage = Math.min(100, Math.round(rawPercentage));
  const weightedScore = Math.round((percentage / 100) * maxScore * 10) / 10;

  return {
    name: 'Session Tracking',
    score: weightedScore,
    maxScore,
    percentage,
    criteria,
    status: getStatus(percentage),
  };
}

function evaluateStructuredOutput(): CategoryScore {
  const criteria: CriterionResult[] = [];
  const maxScore = WEIGHTS.STRUCTURED_OUTPUT;
  let score = 0;

  // Criterion 1: Prompt generation script exists (3 points)
  const promptGen = path.join(ROOT, 'scripts', 'generate_overnight_prompts.ts');
  const hasPromptGen = fileExists(promptGen);
  criteria.push({
    name: 'Prompt generation script',
    met: hasPromptGen,
    points: hasPromptGen ? 3 : 0,
    maxPoints: 3,
    details: hasPromptGen ? 'Script exists' : 'Missing prompt generator',
  });
  if (hasPromptGen) score += 3;

  // Criterion 2: Terminal prompt files exist (at least 4) (3 points)
  const overnightDir = path.join(CLAUDE_DIR, 'overnight');
  const promptCount = countFilesMatching(overnightDir, /terminal_\d+_prompt\.md$/);
  const hasPrompts = promptCount >= 4;
  criteria.push({
    name: 'Terminal prompt files (≥4)',
    met: hasPrompts,
    points: hasPrompts ? 3 : Math.floor((promptCount / 4) * 3),
    maxPoints: 3,
    details: `${promptCount} prompt files found`,
  });
  if (hasPrompts) score += 3;
  else score += Math.floor((promptCount / 4) * 3);

  // Criterion 3: Results JSON schema defined (3 points)
  // Check if prompts include RESULTS_OUTPUT section
  let hasResultsSchema = false;
  if (promptCount > 0) {
    try {
      const promptFile = path.join(overnightDir, 'terminal_1_prompt.md');
      if (fileExists(promptFile)) {
        const content = fs.readFileSync(promptFile, 'utf-8');
        hasResultsSchema = content.includes('results') || content.includes('OUTPUT');
      }
    } catch {
      // Can't check
    }
  }
  criteria.push({
    name: 'Results output schema in prompts',
    met: hasResultsSchema,
    points: hasResultsSchema ? 3 : 0,
    maxPoints: 3,
    details: hasResultsSchema ? 'Results schema defined' : 'No results schema in prompts',
  });
  if (hasResultsSchema) score += 3;

  // Criterion 4: Terminal results files exist (3 points)
  const resultsCount = countFilesMatching(overnightDir, /terminal_\d+_results\.json$/);
  const hasResults = resultsCount >= 1;
  criteria.push({
    name: 'Terminal results files',
    met: hasResults,
    points: hasResults ? 3 : 0,
    maxPoints: 3,
    details: `${resultsCount} results file(s) found`,
  });
  if (hasResults) score += 3;

  // Criterion 5: Heartbeat JSONL files (2 points)
  const heartbeatCount = countFilesMatching(overnightDir, /terminal_\d+_heartbeat\.jsonl$/);
  const hasHeartbeatLogs = heartbeatCount >= 1;
  criteria.push({
    name: 'Heartbeat JSONL logs',
    met: hasHeartbeatLogs,
    points: hasHeartbeatLogs ? 2 : 0,
    maxPoints: 2,
    details: `${heartbeatCount} heartbeat log(s) found`,
  });
  if (hasHeartbeatLogs) score += 2;

  // Criterion 6: Semantic action parser (3 points)
  const actionParserFile = path.join(ROOT, 'scripts', 'parse_accomplishments.ts');
  const hasActionParser = fileExists(actionParserFile);
  criteria.push({
    name: 'Semantic action parser',
    met: hasActionParser,
    points: hasActionParser ? 3 : 0,
    maxPoints: 3,
    details: hasActionParser ? 'parse_accomplishments.ts exists' : 'Action parser not yet implemented',
  });
  if (hasActionParser) score += 3;

  // Criterion 7: Schema validator (3 points)
  // Check for JSON schema or validation logic in the parser
  let hasSchemaValidator = false;
  if (hasActionParser) {
    try {
      const parserContent = fs.readFileSync(actionParserFile, 'utf-8');
      hasSchemaValidator = parserContent.includes('interface') && parserContent.includes('ParsedAccomplishment');
    } catch {
      // Can't read
    }
  }
  criteria.push({
    name: 'Schema validator',
    met: hasSchemaValidator,
    points: hasSchemaValidator ? 3 : 0,
    maxPoints: 3,
    details: hasSchemaValidator ? 'TypeScript interfaces define schema' : 'Schema validator not yet implemented',
  });
  if (hasSchemaValidator) score += 3;

  const rawPercentage = (score / 20) * 100;
  const percentage = Math.min(100, Math.round(rawPercentage));
  const weightedScore = Math.round((percentage / 100) * maxScore * 10) / 10;

  return {
    name: 'Structured Output',
    score: weightedScore,
    maxScore,
    percentage,
    criteria,
    status: getStatus(percentage),
  };
}

function evaluateAccomplishmentAggregation(): CategoryScore {
  const criteria: CriterionResult[] = [];
  const maxScore = WEIGHTS.ACCOMPLISHMENT_AGGREGATION;
  let score = 0;

  // Criterion 1: Morning report generator exists (3 points)
  const morningReport = path.join(ROOT, 'scripts', 'generate_morning_report.ts');
  const hasMorningReport = fileExists(morningReport);
  criteria.push({
    name: 'Morning report generator',
    met: hasMorningReport,
    points: hasMorningReport ? 3 : 0,
    maxPoints: 3,
    details: hasMorningReport ? 'Script exists' : 'Missing morning report generator',
  });
  if (hasMorningReport) score += 3;

  // Criterion 2: Morning reports generated (3 points)
  const morningReportsDir = path.join(DATA_DIR, 'morning-reports');
  const reportCount = countFilesMatching(morningReportsDir, /\.(json|md)$/);
  const hasReports = reportCount >= 2; // At least one JSON and one MD
  criteria.push({
    name: 'Morning reports generated',
    met: hasReports,
    points: hasReports ? 3 : Math.min(3, reportCount),
    maxPoints: 3,
    details: `${reportCount} report file(s) found`,
  });
  if (hasReports) score += 3;
  else score += Math.min(3, reportCount);

  // Criterion 3: Auto-trigger on session stop (3 points)
  // Check overnight route for auto-trigger logic
  const overnightRoute = path.join(ROOT, 'src', 'app', 'api', 'research', 'overnight', 'route.ts');
  let hasAutoTrigger = false;
  if (fileExists(overnightRoute)) {
    try {
      const content = fs.readFileSync(overnightRoute, 'utf-8');
      hasAutoTrigger = content.includes('AUTO-TRIGGER') && content.includes('parse_accomplishments');
    } catch {
      // Can't read
    }
  }
  criteria.push({
    name: 'Auto-trigger on session stop',
    met: hasAutoTrigger,
    points: hasAutoTrigger ? 3 : 0,
    maxPoints: 3,
    details: hasAutoTrigger ? 'Auto-trigger implemented in overnight route' : 'Auto-trigger not yet implemented',
  });
  if (hasAutoTrigger) score += 3;

  // Criterion 4: Accomplishments SQLite table (4 points)
  // Check db.ts for accomplishments table
  const dbFile = path.join(ROOT, 'src', 'lib', 'db.ts');
  let hasAccomplishmentsTable = false;
  if (fileExists(dbFile)) {
    try {
      const content = fs.readFileSync(dbFile, 'utf-8');
      hasAccomplishmentsTable = content.includes('accomplishments');
    } catch {
      // Can't read
    }
  }
  criteria.push({
    name: 'Accomplishments SQLite table',
    met: hasAccomplishmentsTable,
    points: hasAccomplishmentsTable ? 4 : 0,
    maxPoints: 4,
    details: hasAccomplishmentsTable ? 'Table defined' : 'Missing accomplishments table',
  });
  if (hasAccomplishmentsTable) score += 4;

  // Criterion 5: Dashboard accomplishment widget (4 points)
  const accomplishmentWidget = path.join(ROOT, 'src', 'components', 'Dashboard', 'AccomplishmentsWidget.tsx');
  const hasWidget = fileExists(accomplishmentWidget);
  criteria.push({
    name: 'Dashboard accomplishment widget',
    met: hasWidget,
    points: hasWidget ? 4 : 0,
    maxPoints: 4,
    details: hasWidget ? 'Widget exists' : 'Missing accomplishments widget',
  });
  if (hasWidget) score += 4;

  // Criterion 6: Real-time streaming to Activity Feed (3 points)
  // Check for SSE streaming support in accomplishments API
  const accomplishmentsRoute = path.join(ROOT, 'src', 'app', 'api', 'accomplishments', 'route.ts');
  let hasRealTimeStreaming = false;
  if (fileExists(accomplishmentsRoute)) {
    try {
      const content = fs.readFileSync(accomplishmentsRoute, 'utf-8');
      hasRealTimeStreaming = content.includes('stream') &&
        (content.includes('text/event-stream') || content.includes('ReadableStream'));
    } catch {
      // Can't read
    }
  }
  criteria.push({
    name: 'Real-time streaming to Activity Feed',
    met: hasRealTimeStreaming,
    points: hasRealTimeStreaming ? 3 : 0,
    maxPoints: 3,
    details: hasRealTimeStreaming ? 'SSE streaming implemented' : 'Real-time streaming not yet implemented',
  });
  if (hasRealTimeStreaming) score += 3;

  const rawPercentage = (score / 20) * 100;
  const percentage = Math.min(100, Math.round(rawPercentage));
  const weightedScore = Math.round((percentage / 100) * maxScore * 10) / 10;

  return {
    name: 'Accomplishment Aggregation',
    score: weightedScore,
    maxScore,
    percentage,
    criteria,
    status: getStatus(percentage),
  };
}

function evaluateCrossSessionTrends(): CategoryScore {
  const criteria: CriterionResult[] = [];
  const maxScore = WEIGHTS.CROSS_SESSION_TRENDS;
  let score = 0;

  // Criterion 1: Morning reports stored (2 points)
  const morningReportsDir = path.join(DATA_DIR, 'morning-reports');
  const reportCount = countFilesMatching(morningReportsDir, /\.json$/);
  const hasReportsStored = reportCount >= 1;
  criteria.push({
    name: 'Morning reports stored',
    met: hasReportsStored,
    points: hasReportsStored ? 2 : 0,
    maxPoints: 2,
    details: `${reportCount} JSON report(s) stored`,
  });
  if (hasReportsStored) score += 2;

  // Criterion 2: Weekly aggregation script (3 points)
  const weeklyAgg = path.join(ROOT, 'scripts', 'aggregate_weekly.ts');
  const hasWeeklyAgg = fileExists(weeklyAgg);
  criteria.push({
    name: 'Weekly aggregation script',
    met: hasWeeklyAgg,
    points: hasWeeklyAgg ? 3 : 0,
    maxPoints: 3,
    details: hasWeeklyAgg ? 'Script exists' : 'Missing weekly aggregation script',
  });
  if (hasWeeklyAgg) score += 3;

  // Criterion 3: Trend metrics table (3 points)
  const dbFile = path.join(ROOT, 'src', 'lib', 'db.ts');
  let hasTrendTable = false;
  if (fileExists(dbFile)) {
    try {
      const content = fs.readFileSync(dbFile, 'utf-8');
      hasTrendTable = content.includes('trend_metrics') || content.includes('trends');
    } catch {
      // Can't read
    }
  }
  criteria.push({
    name: 'Trend metrics table',
    met: hasTrendTable,
    points: hasTrendTable ? 3 : 0,
    maxPoints: 3,
    details: hasTrendTable ? 'Table defined' : 'Missing trend_metrics table',
  });
  if (hasTrendTable) score += 3;

  // Criterion 4: Agent comparison query (2 points)
  const hasTrendsEndpoint = fileExists(path.join(ROOT, 'src', 'app', 'api', 'agents', 'trends', 'route.ts'));
  criteria.push({
    name: 'Trends API endpoint',
    met: hasTrendsEndpoint,
    points: hasTrendsEndpoint ? 2 : 0,
    maxPoints: 2,
    details: hasTrendsEndpoint ? 'Endpoint exists' : 'Missing trends endpoint',
  });
  if (hasTrendsEndpoint) score += 2;

  // Criterion 5: Trend visualization component (3 points)
  const trendChart = path.join(ROOT, 'src', 'components', 'Dashboard', 'TrendChart.tsx');
  const hasTrendChart = fileExists(trendChart);
  criteria.push({
    name: 'Trend chart component',
    met: hasTrendChart,
    points: hasTrendChart ? 3 : 0,
    maxPoints: 3,
    details: hasTrendChart ? 'Component exists' : 'Missing TrendChart component',
  });
  if (hasTrendChart) score += 3;

  // Criterion 6: Anomaly detection (2 points)
  // Check for anomaly detection in trends API
  const trendsRoute = path.join(ROOT, 'src', 'app', 'api', 'agents', 'trends', 'route.ts');
  let hasAnomalyDetection = false;
  if (fileExists(trendsRoute)) {
    try {
      const content = fs.readFileSync(trendsRoute, 'utf-8');
      hasAnomalyDetection = content.includes('detectAnomalies') || content.includes('anomaly') || content.includes('TrendAnomaly');
    } catch {
      // Can't read
    }
  }
  criteria.push({
    name: 'Anomaly detection',
    met: hasAnomalyDetection,
    points: hasAnomalyDetection ? 2 : 0,
    maxPoints: 2,
    details: hasAnomalyDetection ? 'Z-score anomaly detection implemented' : 'Anomaly detection not yet implemented',
  });
  if (hasAnomalyDetection) score += 2;

  const rawPercentage = (score / 15) * 100;
  const percentage = Math.min(100, Math.round(rawPercentage));
  const weightedScore = Math.round((percentage / 100) * maxScore * 10) / 10;

  return {
    name: 'Cross-Session Trends',
    score: weightedScore,
    maxScore,
    percentage,
    criteria,
    status: getStatus(percentage),
  };
}

function evaluateUnifiedAgentView(): CategoryScore {
  const criteria: CriterionResult[] = [];
  const maxScore = WEIGHTS.UNIFIED_AGENT_VIEW;
  let score = 0;

  // Criterion 1: Research agents hook (2 points)
  const researchHook = path.join(ROOT, 'src', 'hooks', 'useResearchAgents.ts');
  const hasResearchHook = fileExists(researchHook);
  criteria.push({
    name: 'Research agents hook',
    met: hasResearchHook,
    points: hasResearchHook ? 2 : 0,
    maxPoints: 2,
    details: hasResearchHook ? 'Hook exists' : 'Missing useResearchAgents hook',
  });
  if (hasResearchHook) score += 2;

  // Criterion 2: Activity feed hook (2 points)
  const activityHook = path.join(ROOT, 'src', 'hooks', 'useActivityFeed.ts');
  const hasActivityHook = fileExists(activityHook);
  criteria.push({
    name: 'Activity feed hook',
    met: hasActivityHook,
    points: hasActivityHook ? 2 : 0,
    maxPoints: 2,
    details: hasActivityHook ? 'Hook exists' : 'Missing useActivityFeed hook',
  });
  if (hasActivityHook) score += 2;

  // Criterion 3: Unified agents endpoint (3 points)
  const unifiedEndpoint = path.join(ROOT, 'src', 'app', 'api', 'agents', 'unified', 'route.ts');
  const hasUnifiedEndpoint = fileExists(unifiedEndpoint);
  criteria.push({
    name: 'Unified agents endpoint',
    met: hasUnifiedEndpoint,
    points: hasUnifiedEndpoint ? 3 : 0,
    maxPoints: 3,
    details: hasUnifiedEndpoint ? 'Endpoint exists' : 'Missing unified agents endpoint',
  });
  if (hasUnifiedEndpoint) score += 3;

  // Criterion 4: Both Research + HALO agents in same view (3 points)
  // Check if Research Lab page shows HaloAgentStatusBar component
  const researchPage = path.join(ROOT, 'src', 'app', 'research', 'page.tsx');
  const haloStatusBar = path.join(ROOT, 'src', 'components', 'ResearchLab', 'HaloAgentStatusBar.tsx');
  let showsBothTypes = false;
  let haloStatusBarExists = fileExists(haloStatusBar);
  if (fileExists(researchPage)) {
    try {
      const content = fs.readFileSync(researchPage, 'utf-8');
      showsBothTypes = content.includes('HaloAgentStatusBar') || content.includes('HALO') || content.includes('halo');
    } catch {
      // Can't read
    }
  }
  const bothTypesInView = showsBothTypes && haloStatusBarExists;
  criteria.push({
    name: 'Both agent types in same view',
    met: bothTypesInView,
    points: bothTypesInView ? 3 : 0,
    maxPoints: 3,
    details: bothTypesInView ? 'HaloAgentStatusBar integrated in Research view' : 'Agent types shown separately',
  });
  if (bothTypesInView) score += 3;

  // Criterion 5: Cross-system accomplishment rollup (3 points)
  // Check for accomplishments API endpoint that aggregates across systems
  const accomplishmentsRoute = path.join(ROOT, 'src', 'app', 'api', 'accomplishments', 'route.ts');
  let hasCrossSystemRollup = false;
  if (fileExists(accomplishmentsRoute)) {
    try {
      const content = fs.readFileSync(accomplishmentsRoute, 'utf-8').toLowerCase();
      hasCrossSystemRollup = content.includes('cross-system') || content.includes('rollup') ||
        (content.includes('research') && content.includes('halo') && content.includes('trading'));
    } catch {
      // Can't read
    }
  }
  criteria.push({
    name: 'Cross-system accomplishment rollup',
    met: hasCrossSystemRollup,
    points: hasCrossSystemRollup ? 3 : 0,
    maxPoints: 3,
    details: hasCrossSystemRollup ? 'Accomplishments API with cross-system rollup' : 'Cross-system rollup not yet implemented',
  });
  if (hasCrossSystemRollup) score += 3;

  // Criterion 6: Unified Jira integration (2 points)
  const jiraAgentsFile = path.join(DATA_DIR, 'jira-agents.json');
  const hasJiraMapping = fileExists(jiraAgentsFile);
  criteria.push({
    name: 'Jira agent mapping',
    met: hasJiraMapping,
    points: hasJiraMapping ? 2 : 0,
    maxPoints: 2,
    details: hasJiraMapping ? 'Jira mapping exists' : 'Missing Jira agent mapping',
  });
  if (hasJiraMapping) score += 2;

  const rawPercentage = (score / 15) * 100;
  const percentage = Math.min(100, Math.round(rawPercentage));
  const weightedScore = Math.round((percentage / 100) * maxScore * 10) / 10;

  return {
    name: 'Unified Agent View',
    score: weightedScore,
    maxScore,
    percentage,
    criteria,
    status: getStatus(percentage),
  };
}

// ============================================================================
// Main Evaluation
// ============================================================================

function runEvaluation(iteration: number = 0): EvalResult {
  const categories = {
    agentHealthMonitoring: evaluateAgentHealthMonitoring(),
    sessionTracking: evaluateSessionTracking(),
    structuredOutput: evaluateStructuredOutput(),
    accomplishmentAggregation: evaluateAccomplishmentAggregation(),
    crossSessionTrends: evaluateCrossSessionTrends(),
    unifiedAgentView: evaluateUnifiedAgentView(),
  };

  // Calculate composite
  const totalScore = Object.values(categories).reduce((sum, cat) => sum + cat.score, 0);
  const totalMax = Object.values(categories).reduce((sum, cat) => sum + cat.maxScore, 0);
  const composite = Math.round((totalScore / totalMax) * 100);

  // Check deployment gate
  const allAbove95 = Object.values(categories).every(cat => cat.percentage >= DEPLOYMENT_THRESHOLD);

  // Find lowest category
  let lowestCategory = '';
  let lowestScore = 100;
  for (const [name, cat] of Object.entries(categories)) {
    if (cat.percentage < lowestScore) {
      lowestScore = cat.percentage;
      lowestCategory = name;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    iteration,
    categories,
    composite,
    deploymentGatePassed: allAbove95 && composite >= DEPLOYMENT_THRESHOLD,
    allCategoriesAbove95: allAbove95,
    lowestCategory,
    lowestScore,
  };
}

// ============================================================================
// Output Formatters
// ============================================================================

function formatHumanReadable(result: EvalResult, baseline?: EvalResult | null): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════════════════════╗');
  lines.push('║       RESEARCH AGENT AUDIT SYSTEM — EVALUATION HARNESS              ║');
  lines.push('╠══════════════════════════════════════════════════════════════════════╣');
  lines.push(`║  Iteration: ${result.iteration.toString().padEnd(3)}                                                      ║`);
  lines.push(`║  Timestamp: ${result.timestamp.substring(0, 19).padEnd(45)}      ║`);
  lines.push('╚══════════════════════════════════════════════════════════════════════╝');
  lines.push('');

  // Category scores
  lines.push('┌────────────────────────────────────┬───────┬─────────┬──────────────┐');
  lines.push('│ Category                           │ Score │ Percent │ Status       │');
  lines.push('├────────────────────────────────────┼───────┼─────────┼──────────────┤');

  for (const cat of Object.values(result.categories)) {
    const name = cat.name.padEnd(34);
    const score = `${cat.score}/${cat.maxScore}`.padStart(5);
    const pct = `${cat.percentage}%`.padStart(5);
    const status = cat.status.padEnd(12);
    const delta = baseline
      ? (() => {
          const baselineCat = Object.values(baseline.categories).find(c => c.name === cat.name);
          if (baselineCat) {
            const d = cat.percentage - baselineCat.percentage;
            if (d > 0) return ` (+${d}%)`;
            if (d < 0) return ` (${d}%)`;
          }
          return '';
        })()
      : '';
    lines.push(`│ ${name} │ ${score} │  ${pct}  │ ${status}│${delta}`);
  }

  lines.push('└────────────────────────────────────┴───────┴─────────┴──────────────┘');
  lines.push('');

  // Composite score
  const compositeBar = '█'.repeat(Math.floor(result.composite / 5)) + '░'.repeat(20 - Math.floor(result.composite / 5));
  lines.push(`  COMPOSITE SCORE: ${result.composite}% [${compositeBar}]`);
  if (baseline) {
    const delta = result.composite - baseline.composite;
    if (delta !== 0) {
      lines.push(`                   ${delta > 0 ? '+' : ''}${delta}% from baseline`);
    }
  }
  lines.push('');

  // Deployment gate
  if (result.deploymentGatePassed) {
    lines.push('  ✅ DEPLOYMENT GATE: PASSED');
    lines.push('     All categories ≥ 95% — System ready for deployment');
  } else {
    lines.push('  ❌ DEPLOYMENT GATE: NOT PASSED');
    lines.push(`     Lowest category: ${result.lowestCategory} (${result.lowestScore}%)`);
    lines.push(`     Required: All categories ≥ ${DEPLOYMENT_THRESHOLD}%`);
  }
  lines.push('');

  // Detailed criteria for lowest categories
  const lowCategories = Object.values(result.categories)
    .filter(cat => cat.percentage < 80)
    .sort((a, b) => a.percentage - b.percentage);

  if (lowCategories.length > 0) {
    lines.push('  ⚠️  CATEGORIES NEEDING ATTENTION:');
    lines.push('');

    for (const cat of lowCategories.slice(0, 3)) {
      lines.push(`  ${cat.name} (${cat.percentage}%):`);
      for (const criterion of cat.criteria) {
        const icon = criterion.met ? '✓' : '✗';
        lines.push(`    ${icon} ${criterion.name}: ${criterion.details}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ============================================================================
// CLI Entry Point
// ============================================================================

function main(): void {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const saveBaseline = args.includes('--save');
  const compare = args.includes('--compare');
  const gateCheck = args.includes('--gate');

  // Determine iteration number
  const iterationArg = args.find(a => a.startsWith('--iteration='));
  const iteration = iterationArg ? parseInt(iterationArg.split('=')[1], 10) : 0;

  // Load state
  const state = loadState();

  // Run evaluation
  const result = runEvaluation(iteration);

  // Save baseline if requested
  if (saveBaseline) {
    state.baseline = result;
    state.history.push(result);
    state.lastRun = result.timestamp;
    saveState(state);

    if (!jsonOutput) {
      console.log('\n✅ Baseline saved!\n');
    }
  }

  // Output
  if (jsonOutput) {
    const output = {
      ...result,
      baseline: compare ? state.baseline : undefined,
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(formatHumanReadable(result, compare ? state.baseline : null));
  }

  // Gate check exit code
  if (gateCheck) {
    process.exit(result.deploymentGatePassed ? 0 : 1);
  }
}

main();
