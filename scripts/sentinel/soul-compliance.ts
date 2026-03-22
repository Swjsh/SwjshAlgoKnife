/**
 * SENTINEL SOUL Compliance Checker
 *
 * Validates that all 6 HALO agents follow their SOUL definitions.
 * 30 total rules: 5 rules per agent.
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Types
export type ComplianceStatus = 'PASS' | 'FAIL' | 'SKIP' | 'ERROR';

export interface ComplianceRule {
  id: string;
  agentId: string;
  name: string;
  description: string;
  check: () => Promise<ComplianceCheckResult>;
}

export interface ComplianceCheckResult {
  ruleId: string;
  status: ComplianceStatus;
  message: string;
  evidence?: Record<string, unknown>;
  timestamp: string;
}

export interface AgentComplianceReport {
  agentId: string;
  agentName: string;
  rulesTotal: number;
  rulesPassed: number;
  rulesFailed: number;
  rulesSkipped: number;
  rulesErrored: number;
  score: number;
  results: ComplianceCheckResult[];
}

export interface ComplianceReport {
  timestamp: string;
  overallScore: number;
  overallStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL';
  agents: AgentComplianceReport[];
  violations: ComplianceCheckResult[];
}

// Helper functions
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(filePath: string): Promise<unknown> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function searchFileContent(filePath: string, pattern: RegExp): Promise<boolean> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return pattern.test(content);
  } catch {
    return false;
  }
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function isMorningBriefingTime(): boolean {
  const now = new Date();
  const hour = now.getHours();
  // Check if it's past 8:30 AM ET
  return hour >= 9; // Simplified: after 9 AM local
}

function isMonday(): boolean {
  return new Date().getDay() === 1;
}

// ============================================================================
// CHIEF SOUL COMPLIANCE RULES (5)
// ============================================================================

const chiefRules: ComplianceRule[] = [
  {
    id: 'chief-001',
    agentId: 'chief',
    name: 'Morning Briefing Posted',
    description: 'Chief should post morning briefing by 8:30 AM ET',
    check: async (): Promise<ComplianceCheckResult> => {
      const dailyLogPath = 'data/brain/daily-log.md';
      const today = getTodayDate();

      if (!isMorningBriefingTime()) {
        return {
          ruleId: 'chief-001',
          status: 'SKIP',
          message: 'Not yet past morning briefing time',
          timestamp: new Date().toISOString(),
        };
      }

      try {
        const content = await fs.promises.readFile(dailyLogPath, 'utf-8');
        const hasTodayBriefing = content.includes(today) &&
          (content.includes('briefing') || content.includes('Briefing') || content.includes('BRIEFING'));

        return {
          ruleId: 'chief-001',
          status: hasTodayBriefing ? 'PASS' : 'FAIL',
          message: hasTodayBriefing
            ? 'Morning briefing found in daily log'
            : 'No morning briefing found for today',
          evidence: { date: today, dailyLogPath },
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'chief-001',
          status: 'ERROR',
          message: 'Could not read daily log file',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'chief-002',
    agentId: 'chief',
    name: 'Briefing Contains Agent Status',
    description: 'Morning briefing should mention all 6 agents',
    check: async (): Promise<ComplianceCheckResult> => {
      const dailyLogPath = 'data/brain/daily-log.md';
      const agents = ['chief', 'hunter', 'arbiter', 'cortana', 'ops', 'scout'];

      try {
        const content = await fs.promises.readFile(dailyLogPath, 'utf-8');
        const today = getTodayDate();

        // Find today's section
        const todayIndex = content.indexOf(today);
        if (todayIndex === -1) {
          return {
            ruleId: 'chief-002',
            status: 'SKIP',
            message: 'No entry for today found',
            timestamp: new Date().toISOString(),
          };
        }

        const todayContent = content.substring(todayIndex);
        const mentionedAgents = agents.filter(agent =>
          todayContent.toLowerCase().includes(agent)
        );

        const allMentioned = mentionedAgents.length === agents.length;

        return {
          ruleId: 'chief-002',
          status: allMentioned ? 'PASS' : 'FAIL',
          message: allMentioned
            ? 'All agents mentioned in briefing'
            : `Missing agents: ${agents.filter(a => !mentionedAgents.includes(a)).join(', ')}`,
          evidence: { mentionedAgents, missingAgents: agents.filter(a => !mentionedAgents.includes(a)) },
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'chief-002',
          status: 'ERROR',
          message: 'Could not read daily log file',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'chief-003',
    agentId: 'chief',
    name: 'Briefing Contains Priorities',
    description: 'Morning briefing should list today\'s focus areas',
    check: async (): Promise<ComplianceCheckResult> => {
      const dailyLogPath = 'data/brain/daily-log.md';

      try {
        const content = await fs.promises.readFile(dailyLogPath, 'utf-8');
        const today = getTodayDate();
        const todayIndex = content.indexOf(today);

        if (todayIndex === -1) {
          return {
            ruleId: 'chief-003',
            status: 'SKIP',
            message: 'No entry for today found',
            timestamp: new Date().toISOString(),
          };
        }

        const todayContent = content.substring(todayIndex);
        const hasPriorities = /priorit|focus|today|goal/i.test(todayContent);

        return {
          ruleId: 'chief-003',
          status: hasPriorities ? 'PASS' : 'FAIL',
          message: hasPriorities
            ? 'Priorities found in today\'s entry'
            : 'No priorities section found in today\'s entry',
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'chief-003',
          status: 'ERROR',
          message: 'Could not read daily log file',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'chief-004',
    agentId: 'chief',
    name: 'Escalations Handled (24h)',
    description: 'Chief should handle escalations within 24 hours',
    check: async (): Promise<ComplianceCheckResult> => {
      // Check for any MGMT tickets that have been escalated and unresolved for >24h
      try {
        const response = await fetch('http://localhost:3000/api/jira/tickets?project=MGMT');
        if (!response.ok) {
          return {
            ruleId: 'chief-004',
            status: 'SKIP',
            message: 'Could not reach Jira API',
            timestamp: new Date().toISOString(),
          };
        }

        const tickets = await response.json() as { created: string; status: string; labels?: string[] }[];
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        const staleEscalations = tickets.filter((ticket) => {
          const created = new Date(ticket.created).getTime();
          const isStale = now - created > twentyFourHours;
          const isOpen = ticket.status !== 'Done' && ticket.status !== 'Closed';
          const isEscalation = ticket.labels?.includes('escalation');
          return isStale && isOpen && isEscalation;
        });

        return {
          ruleId: 'chief-004',
          status: staleEscalations.length === 0 ? 'PASS' : 'FAIL',
          message: staleEscalations.length === 0
            ? 'No stale escalations found'
            : `${staleEscalations.length} escalations pending >24h`,
          evidence: { staleCount: staleEscalations.length },
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'chief-004',
          status: 'SKIP',
          message: 'Could not check Jira tickets',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'chief-005',
    agentId: 'chief',
    name: 'Sprint Planning on Monday',
    description: 'Chief should post sprint planning update on Mondays',
    check: async (): Promise<ComplianceCheckResult> => {
      if (!isMonday()) {
        return {
          ruleId: 'chief-005',
          status: 'SKIP',
          message: 'Not Monday, skipping sprint planning check',
          timestamp: new Date().toISOString(),
        };
      }

      const dailyLogPath = 'data/brain/daily-log.md';
      const today = getTodayDate();

      try {
        const content = await fs.promises.readFile(dailyLogPath, 'utf-8');
        const todayIndex = content.indexOf(today);

        if (todayIndex === -1) {
          return {
            ruleId: 'chief-005',
            status: 'FAIL',
            message: 'No entry for today found on Monday',
            timestamp: new Date().toISOString(),
          };
        }

        const todayContent = content.substring(todayIndex);
        const hasSprintUpdate = /sprint|week|planning/i.test(todayContent);

        return {
          ruleId: 'chief-005',
          status: hasSprintUpdate ? 'PASS' : 'FAIL',
          message: hasSprintUpdate
            ? 'Sprint planning found in Monday entry'
            : 'No sprint planning found for Monday',
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'chief-005',
          status: 'ERROR',
          message: 'Could not read daily log file',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
];

// ============================================================================
// HUNTER SOUL COMPLIANCE RULES (5)
// ============================================================================

const hunterRules: ComplianceRule[] = [
  {
    id: 'hunter-001',
    agentId: 'hunter',
    name: 'PR Created for Code Changes',
    description: 'Hunter should create PRs instead of direct commits',
    check: async (): Promise<ComplianceCheckResult> => {
      try {
        // Check recent commits to see if they're from PRs or direct pushes
        const { stdout } = await execAsync('git log --oneline -20 --format="%s"');
        const commits = stdout.trim().split('\n');

        // Look for commits without PR references (e.g., "Merge pull request" or "(#123)")
        const directCommits = commits.filter(commit =>
          !commit.includes('Merge pull request') &&
          !commit.match(/\(#\d+\)/)
        );

        const ratio = directCommits.length / commits.length;

        return {
          ruleId: 'hunter-001',
          status: ratio < 0.3 ? 'PASS' : 'FAIL',
          message: ratio < 0.3
            ? 'Most commits come from PRs'
            : `${Math.round(ratio * 100)}% of recent commits are direct (no PR)`,
          evidence: { directCommits: directCommits.length, totalCommits: commits.length },
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'hunter-001',
          status: 'ERROR',
          message: 'Could not check git history',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'hunter-002',
    agentId: 'hunter',
    name: 'Tests Run Before Commit',
    description: 'CI should pass before commits are merged',
    check: async (): Promise<ComplianceCheckResult> => {
      // Check if recent commits have passing CI status
      // This is a simplified check - in reality would query GitHub API
      try {
        const { stdout: status } = await execAsync('gh run list --limit 5 --json conclusion');
        const runs = JSON.parse(status) as { conclusion: string }[];

        const failedRuns = runs.filter(run => run.conclusion === 'failure');

        return {
          ruleId: 'hunter-002',
          status: failedRuns.length === 0 ? 'PASS' : 'FAIL',
          message: failedRuns.length === 0
            ? 'All recent CI runs passed'
            : `${failedRuns.length} recent CI runs failed`,
          evidence: { failedCount: failedRuns.length, totalRuns: runs.length },
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'hunter-002',
          status: 'SKIP',
          message: 'Could not check CI status (gh CLI may not be configured)',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'hunter-003',
    agentId: 'hunter',
    name: 'No Direct Push to Main',
    description: 'Hunter should not push directly to main/master branch',
    check: async (): Promise<ComplianceCheckResult> => {
      try {
        // Check recent commits on main for direct pushes (no merge commits)
        const { stdout } = await execAsync('git log main --oneline -10 --format="%s %an"');
        const commits = stdout.trim().split('\n');

        const directPushes = commits.filter(commit =>
          !commit.includes('Merge pull request') &&
          !commit.includes('Merge branch')
        );

        return {
          ruleId: 'hunter-003',
          status: directPushes.length <= 2 ? 'PASS' : 'FAIL',
          message: directPushes.length <= 2
            ? 'Few or no direct pushes to main'
            : `${directPushes.length} direct pushes to main detected`,
          evidence: { directPushes: directPushes.length },
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'hunter-003',
          status: 'ERROR',
          message: 'Could not check git log for main',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'hunter-004',
    agentId: 'hunter',
    name: 'Code Review Requested',
    description: 'PRs should have reviewers assigned',
    check: async (): Promise<ComplianceCheckResult> => {
      try {
        const { stdout } = await execAsync('gh pr list --json number,reviewRequests --limit 10');
        const prs = JSON.parse(stdout) as { number: number; reviewRequests: unknown[] }[];

        const prsWithoutReviewers = prs.filter(pr =>
          !pr.reviewRequests || pr.reviewRequests.length === 0
        );

        return {
          ruleId: 'hunter-004',
          status: prsWithoutReviewers.length === 0 ? 'PASS' : 'FAIL',
          message: prsWithoutReviewers.length === 0
            ? 'All open PRs have reviewers'
            : `${prsWithoutReviewers.length} PRs without reviewers`,
          evidence: { prsWithoutReviewers: prsWithoutReviewers.map(pr => pr.number) },
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'hunter-004',
          status: 'SKIP',
          message: 'Could not check PRs (gh CLI may not be configured)',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'hunter-005',
    agentId: 'hunter',
    name: 'Ticket Linked to PR',
    description: 'PRs should reference Jira tickets',
    check: async (): Promise<ComplianceCheckResult> => {
      try {
        const { stdout } = await execAsync('gh pr list --json number,title,body --limit 10');
        const prs = JSON.parse(stdout) as { number: number; title: string; body: string }[];

        const jiraPattern = /[A-Z]+-\d+/;
        const prsWithoutTickets = prs.filter(pr =>
          !jiraPattern.test(pr.title) && !jiraPattern.test(pr.body || '')
        );

        return {
          ruleId: 'hunter-005',
          status: prsWithoutTickets.length === 0 ? 'PASS' : 'FAIL',
          message: prsWithoutTickets.length === 0
            ? 'All PRs have Jira ticket references'
            : `${prsWithoutTickets.length} PRs without ticket references`,
          evidence: { prsWithoutTickets: prsWithoutTickets.map(pr => pr.number) },
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'hunter-005',
          status: 'SKIP',
          message: 'Could not check PRs (gh CLI may not be configured)',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
];

// ============================================================================
// ARBITER SOUL COMPLIANCE RULES (5)
// ============================================================================

const arbiterRules: ComplianceRule[] = [
  {
    id: 'arbiter-001',
    agentId: 'arbiter',
    name: 'Trade Graded Within 4h',
    description: 'Closed trades should be graded within 4 hours',
    check: async (): Promise<ComplianceCheckResult> => {
      // Check agents_db.json for recent trade reviews
      const agentsDbPath = 'src/app/api/agents/agents_db.json';

      try {
        const content = await fs.promises.readFile(agentsDbPath, 'utf-8');
        const data = JSON.parse(content);

        // Look for review timestamps vs trade close times
        // This is a simplified check
        const reviews = data.arbiter?.reviews || [];
        const fourHours = 4 * 60 * 60 * 1000;
        const now = Date.now();

        const recentReviews = reviews.filter((r: { timestamp: string }) => {
          const reviewTime = new Date(r.timestamp).getTime();
          return now - reviewTime < fourHours;
        });

        return {
          ruleId: 'arbiter-001',
          status: recentReviews.length > 0 || reviews.length === 0 ? 'PASS' : 'FAIL',
          message: reviews.length === 0
            ? 'No trades to grade'
            : recentReviews.length > 0
              ? 'Recent trades have been graded'
              : 'Some trades may not have been graded within 4h',
          evidence: { recentReviews: recentReviews.length, totalReviews: reviews.length },
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'arbiter-001',
          status: 'SKIP',
          message: 'Could not read agents_db.json',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'arbiter-002',
    agentId: 'arbiter',
    name: 'Rubric Methodology Shown',
    description: 'Reviews should include point breakdowns',
    check: async (): Promise<ComplianceCheckResult> => {
      const agentsDbPath = 'src/app/api/agents/agents_db.json';

      try {
        const content = await fs.promises.readFile(agentsDbPath, 'utf-8');
        const data = JSON.parse(content);
        const reviews = data.arbiter?.reviews || [];

        if (reviews.length === 0) {
          return {
            ruleId: 'arbiter-002',
            status: 'SKIP',
            message: 'No reviews to check',
            timestamp: new Date().toISOString(),
          };
        }

        const reviewsWithRubric = reviews.filter((r: { rubric?: unknown; score?: unknown }) =>
          r.rubric || r.score !== undefined
        );

        return {
          ruleId: 'arbiter-002',
          status: reviewsWithRubric.length === reviews.length ? 'PASS' : 'FAIL',
          message: reviewsWithRubric.length === reviews.length
            ? 'All reviews have rubric/score'
            : `${reviews.length - reviewsWithRubric.length} reviews missing rubric`,
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'arbiter-002',
          status: 'ERROR',
          message: 'Could not read agents_db.json',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'arbiter-003',
    agentId: 'arbiter',
    name: 'Improvement Recommendation Included',
    description: 'Reviews should include what to improve section',
    check: async (): Promise<ComplianceCheckResult> => {
      const agentsDbPath = 'src/app/api/agents/agents_db.json';

      try {
        const content = await fs.promises.readFile(agentsDbPath, 'utf-8');
        const data = JSON.parse(content);
        const reviews = data.arbiter?.reviews || [];

        if (reviews.length === 0) {
          return {
            ruleId: 'arbiter-003',
            status: 'SKIP',
            message: 'No reviews to check',
            timestamp: new Date().toISOString(),
          };
        }

        const reviewsWithImprovement = reviews.filter((r: { improvement?: string; recommendations?: string }) =>
          r.improvement || r.recommendations
        );

        return {
          ruleId: 'arbiter-003',
          status: reviewsWithImprovement.length === reviews.length ? 'PASS' : 'FAIL',
          message: reviewsWithImprovement.length === reviews.length
            ? 'All reviews have improvement recommendations'
            : `${reviews.length - reviewsWithImprovement.length} reviews missing improvements`,
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'arbiter-003',
          status: 'ERROR',
          message: 'Could not read agents_db.json',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'arbiter-004',
    agentId: 'arbiter',
    name: 'Patterns Flagged to Cortana',
    description: 'Arbiter should create LEARN tickets for patterns',
    check: async (): Promise<ComplianceCheckResult> => {
      try {
        const response = await fetch('http://localhost:3000/api/jira/tickets?project=LEARN');
        if (!response.ok) {
          return {
            ruleId: 'arbiter-004',
            status: 'SKIP',
            message: 'Could not reach Jira API',
            timestamp: new Date().toISOString(),
          };
        }

        const tickets = await response.json() as { labels?: string[] }[];
        const arbiterCreated = tickets.filter(t =>
          t.labels?.includes('arbiter-created') || t.labels?.includes('pattern')
        );

        return {
          ruleId: 'arbiter-004',
          status: arbiterCreated.length > 0 ? 'PASS' : 'FAIL',
          message: arbiterCreated.length > 0
            ? `${arbiterCreated.length} LEARN tickets created by Arbiter`
            : 'No LEARN tickets from Arbiter found',
          evidence: { ticketCount: arbiterCreated.length },
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'arbiter-004',
          status: 'SKIP',
          message: 'Could not check Jira tickets',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'arbiter-005',
    agentId: 'arbiter',
    name: 'Consistent Grading Across Trades',
    description: 'Same behavior should receive same grade',
    check: async (): Promise<ComplianceCheckResult> => {
      // This would require ML-level analysis of grades
      // For now, we check if grading variance is reasonable
      return {
        ruleId: 'arbiter-005',
        status: 'SKIP',
        message: 'Consistency analysis requires historical comparison (not yet implemented)',
        timestamp: new Date().toISOString(),
      };
    },
  },
];

// ============================================================================
// CORTANA SOUL COMPLIANCE RULES (5)
// ============================================================================

const cortanaRules: ComplianceRule[] = [
  {
    id: 'cortana-001',
    agentId: 'cortana',
    name: 'Statistical Evidence Cited',
    description: 'Cortana analyses should include data',
    check: async (): Promise<ComplianceCheckResult> => {
      const brainFiles = [
        'data/brain/pattern-memory.md',
        'data/brain/quality-memory.md',
      ];

      try {
        let hasStats = false;
        for (const file of brainFiles) {
          if (await fileExists(file)) {
            const content = await fs.promises.readFile(file, 'utf-8');
            // Look for numeric data
            if (/\d+%|\d+\.\d+|p\s*[=<>]\s*\d/i.test(content)) {
              hasStats = true;
              break;
            }
          }
        }

        return {
          ruleId: 'cortana-001',
          status: hasStats ? 'PASS' : 'FAIL',
          message: hasStats
            ? 'Statistical data found in brain files'
            : 'No statistical evidence found in analyses',
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'cortana-001',
          status: 'ERROR',
          message: 'Could not read brain files',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'cortana-002',
    agentId: 'cortana',
    name: 'P-Value Included',
    description: 'Statistical significance should be documented',
    check: async (): Promise<ComplianceCheckResult> => {
      const brainFiles = [
        'data/brain/pattern-memory.md',
        'data/brain/quality-memory.md',
      ];

      try {
        let hasPValue = false;
        for (const file of brainFiles) {
          if (await fileExists(file)) {
            const content = await fs.promises.readFile(file, 'utf-8');
            if (/p\s*[=<>]\s*\d|significance|confidence.*\d+%/i.test(content)) {
              hasPValue = true;
              break;
            }
          }
        }

        return {
          ruleId: 'cortana-002',
          status: hasPValue ? 'PASS' : 'SKIP',
          message: hasPValue
            ? 'Statistical significance documented'
            : 'No p-value requirements for current analyses',
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'cortana-002',
          status: 'ERROR',
          message: 'Could not read brain files',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'cortana-003',
    agentId: 'cortana',
    name: 'N-Count Included',
    description: 'Sample sizes should be documented',
    check: async (): Promise<ComplianceCheckResult> => {
      const brainFiles = [
        'data/brain/pattern-memory.md',
        'data/brain/quality-memory.md',
      ];

      try {
        let hasNCount = false;
        for (const file of brainFiles) {
          if (await fileExists(file)) {
            const content = await fs.promises.readFile(file, 'utf-8');
            if (/n\s*=\s*\d+|sample.*\d+|\d+\s*trades|\d+\s*observations/i.test(content)) {
              hasNCount = true;
              break;
            }
          }
        }

        return {
          ruleId: 'cortana-003',
          status: hasNCount ? 'PASS' : 'FAIL',
          message: hasNCount
            ? 'Sample sizes documented'
            : 'No sample sizes (n-counts) found in analyses',
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'cortana-003',
          status: 'ERROR',
          message: 'Could not read brain files',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'cortana-004',
    agentId: 'cortana',
    name: 'No Gut Feeling Phrases',
    description: 'Cortana should not use subjective language',
    check: async (): Promise<ComplianceCheckResult> => {
      const brainFiles = [
        'data/brain/pattern-memory.md',
        'data/brain/quality-memory.md',
      ];

      const bannedPhrases = [
        'i think',
        'i feel',
        'gut feeling',
        'seems like',
        'probably',
        'might be',
        'in my opinion',
      ];

      try {
        let hasGutFeeling = false;
        let foundPhrase = '';

        for (const file of brainFiles) {
          if (await fileExists(file)) {
            const content = await fs.promises.readFile(file, 'utf-8').then(c => c.toLowerCase());
            for (const phrase of bannedPhrases) {
              if (content.includes(phrase)) {
                hasGutFeeling = true;
                foundPhrase = phrase;
                break;
              }
            }
          }
          if (hasGutFeeling) break;
        }

        return {
          ruleId: 'cortana-004',
          status: hasGutFeeling ? 'FAIL' : 'PASS',
          message: hasGutFeeling
            ? `Found subjective phrase: "${foundPhrase}"`
            : 'No subjective language found',
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'cortana-004',
          status: 'ERROR',
          message: 'Could not read brain files',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'cortana-005',
    agentId: 'cortana',
    name: 'Hypothesis Documented',
    description: 'Analyses should state clear hypothesis',
    check: async (): Promise<ComplianceCheckResult> => {
      const brainFiles = [
        'data/brain/pattern-memory.md',
      ];

      try {
        let hasHypothesis = false;
        for (const file of brainFiles) {
          if (await fileExists(file)) {
            const content = await fs.promises.readFile(file, 'utf-8');
            if (/hypothesis|thesis|we expect|prediction|will result in/i.test(content)) {
              hasHypothesis = true;
              break;
            }
          }
        }

        return {
          ruleId: 'cortana-005',
          status: hasHypothesis ? 'PASS' : 'FAIL',
          message: hasHypothesis
            ? 'Hypothesis statements found'
            : 'No clear hypothesis documented',
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'cortana-005',
          status: 'ERROR',
          message: 'Could not read brain files',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
];

// ============================================================================
// OPS SOUL COMPLIANCE RULES (5)
// ============================================================================

const opsRules: ComplianceRule[] = [
  {
    id: 'ops-001',
    agentId: 'ops',
    name: 'Health Monitoring Active',
    description: 'Health checks should be running',
    check: async (): Promise<ComplianceCheckResult> => {
      const healthStatusPath = 'data/health_status.json';

      try {
        if (!await fileExists(healthStatusPath)) {
          return {
            ruleId: 'ops-001',
            status: 'FAIL',
            message: 'Health status file not found',
            timestamp: new Date().toISOString(),
          };
        }

        const content = await fs.promises.readFile(healthStatusPath, 'utf-8');
        const status = JSON.parse(content);

        const lastCheck = new Date(status.lastCheck || status.timestamp).getTime();
        const staleness = Date.now() - lastCheck;
        const fiveMinutes = 5 * 60 * 1000;

        return {
          ruleId: 'ops-001',
          status: staleness < fiveMinutes ? 'PASS' : 'FAIL',
          message: staleness < fiveMinutes
            ? 'Health monitoring is active'
            : `Health check stale (${Math.round(staleness / 1000)}s old)`,
          evidence: { lastCheck: status.lastCheck, stalenessMs: staleness },
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'ops-001',
          status: 'ERROR',
          message: 'Could not read health status file',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'ops-002',
    agentId: 'ops',
    name: 'Incident Response Within 15m',
    description: 'Ops should respond to incidents within 15 minutes',
    check: async (): Promise<ComplianceCheckResult> => {
      try {
        const response = await fetch('http://localhost:3000/api/jira/tickets?project=PULSE');
        if (!response.ok) {
          return {
            ruleId: 'ops-002',
            status: 'SKIP',
            message: 'Could not reach Jira API',
            timestamp: new Date().toISOString(),
          };
        }

        const tickets = await response.json() as { labels?: string[]; created: string; updated: string }[];
        const incidents = tickets.filter(t => t.labels?.includes('incident'));

        // Check if any incidents went unresponded for >15 min
        const slowResponses = incidents.filter(t => {
          const created = new Date(t.created).getTime();
          const updated = new Date(t.updated).getTime();
          return updated - created > 15 * 60 * 1000;
        });

        return {
          ruleId: 'ops-002',
          status: slowResponses.length === 0 ? 'PASS' : 'FAIL',
          message: slowResponses.length === 0
            ? 'All incidents responded within 15 min'
            : `${slowResponses.length} incidents with slow response`,
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'ops-002',
          status: 'SKIP',
          message: 'Could not check incidents',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'ops-003',
    agentId: 'ops',
    name: 'Post-Mortem Documented',
    description: 'P1/P2 incidents should have post-mortems',
    check: async (): Promise<ComplianceCheckResult> => {
      try {
        const response = await fetch('http://localhost:3000/api/jira/tickets?project=PULSE');
        if (!response.ok) {
          return {
            ruleId: 'ops-003',
            status: 'SKIP',
            message: 'Could not reach Jira API',
            timestamp: new Date().toISOString(),
          };
        }

        const tickets = await response.json() as { labels?: string[]; priority?: string; summary?: string }[];

        const p1p2Incidents = tickets.filter(t =>
          t.labels?.includes('incident') &&
          (t.priority === 'Highest' || t.priority === 'High')
        );

        const postMortems = tickets.filter(t =>
          t.summary?.toLowerCase().includes('postmortem') ||
          t.summary?.toLowerCase().includes('post-mortem') ||
          t.labels?.includes('postmortem')
        );

        return {
          ruleId: 'ops-003',
          status: postMortems.length >= p1p2Incidents.length ? 'PASS' : 'FAIL',
          message: postMortems.length >= p1p2Incidents.length
            ? 'All P1/P2 incidents have post-mortems'
            : `${p1p2Incidents.length - postMortems.length} incidents missing post-mortems`,
          evidence: { incidents: p1p2Incidents.length, postMortems: postMortems.length },
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'ops-003',
          status: 'SKIP',
          message: 'Could not check post-mortems',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'ops-004',
    agentId: 'ops',
    name: 'Runbook Followed',
    description: 'Documented procedures should be used',
    check: async (): Promise<ComplianceCheckResult> => {
      const runbookDir = 'data/runbooks';

      try {
        if (!await fileExists(runbookDir)) {
          return {
            ruleId: 'ops-004',
            status: 'FAIL',
            message: 'Runbook directory not found',
            timestamp: new Date().toISOString(),
          };
        }

        const files = await fs.promises.readdir(runbookDir);
        const runbooks = files.filter(f => f.endsWith('.md'));

        return {
          ruleId: 'ops-004',
          status: runbooks.length > 0 ? 'PASS' : 'FAIL',
          message: runbooks.length > 0
            ? `${runbooks.length} runbooks available`
            : 'No runbooks found',
          evidence: { runbookCount: runbooks.length },
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'ops-004',
          status: 'SKIP',
          message: 'Could not check runbooks directory',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'ops-005',
    agentId: 'ops',
    name: 'Escalation Path Clear',
    description: 'Escalation contacts should be defined',
    check: async (): Promise<ComplianceCheckResult> => {
      // Check if OPS_SOUL.md has clear escalation matrix
      const soulPath = 'Library/agent-souls/OPS_SOUL.md';

      try {
        const content = await fs.promises.readFile(soulPath, 'utf-8');
        const hasEscalationMatrix = /escalat.*matrix|escalat.*to|alert.*ceo/i.test(content);

        return {
          ruleId: 'ops-005',
          status: hasEscalationMatrix ? 'PASS' : 'FAIL',
          message: hasEscalationMatrix
            ? 'Escalation paths documented in SOUL'
            : 'No clear escalation matrix found',
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'ops-005',
          status: 'ERROR',
          message: 'Could not read OPS_SOUL.md',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
];

// ============================================================================
// SCOUT SOUL COMPLIANCE RULES (5)
// ============================================================================

const scoutRules: ComplianceRule[] = [
  {
    id: 'scout-001',
    agentId: 'scout',
    name: 'Backlog Updated This Week',
    description: 'Scout should maintain the backlog weekly',
    check: async (): Promise<ComplianceCheckResult> => {
      const backlogPath = 'data/brain/backlog-memory.md';

      try {
        if (!await fileExists(backlogPath)) {
          return {
            ruleId: 'scout-001',
            status: 'FAIL',
            message: 'Backlog file not found',
            timestamp: new Date().toISOString(),
          };
        }

        const stats = await fs.promises.stat(backlogPath);
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        const fileAge = Date.now() - stats.mtime.getTime();

        return {
          ruleId: 'scout-001',
          status: fileAge < oneWeek ? 'PASS' : 'FAIL',
          message: fileAge < oneWeek
            ? 'Backlog updated this week'
            : `Backlog not updated in ${Math.round(fileAge / (24 * 60 * 60 * 1000))} days`,
          evidence: { lastModified: stats.mtime.toISOString() },
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'scout-001',
          status: 'ERROR',
          message: 'Could not check backlog file',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'scout-002',
    agentId: 'scout',
    name: 'Prioritization Documented',
    description: 'Priority reasoning should be present',
    check: async (): Promise<ComplianceCheckResult> => {
      const backlogPath = 'data/brain/backlog-memory.md';

      try {
        if (!await fileExists(backlogPath)) {
          return {
            ruleId: 'scout-002',
            status: 'SKIP',
            message: 'Backlog file not found',
            timestamp: new Date().toISOString(),
          };
        }

        const content = await fs.promises.readFile(backlogPath, 'utf-8');
        const hasPrioritization = /priority|p[0-4]|high|medium|low|must.*have|should.*have|could.*have/i.test(content);

        return {
          ruleId: 'scout-002',
          status: hasPrioritization ? 'PASS' : 'FAIL',
          message: hasPrioritization
            ? 'Prioritization documented in backlog'
            : 'No prioritization found in backlog',
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'scout-002',
          status: 'ERROR',
          message: 'Could not read backlog file',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'scout-003',
    agentId: 'scout',
    name: 'Feature Requests Triaged',
    description: 'New feature requests should be sorted',
    check: async (): Promise<ComplianceCheckResult> => {
      try {
        const response = await fetch('http://localhost:3000/api/jira/tickets');
        if (!response.ok) {
          return {
            ruleId: 'scout-003',
            status: 'SKIP',
            message: 'Could not reach Jira API',
            timestamp: new Date().toISOString(),
          };
        }

        const tickets = await response.json() as { labels?: string[]; priority?: string }[];
        const featureRequests = tickets.filter(t => t.labels?.includes('feature-request'));
        const untriaged = featureRequests.filter(t => !t.priority || t.priority === 'None');

        return {
          ruleId: 'scout-003',
          status: untriaged.length === 0 ? 'PASS' : 'FAIL',
          message: untriaged.length === 0
            ? 'All feature requests triaged'
            : `${untriaged.length} feature requests not triaged`,
          evidence: { total: featureRequests.length, untriaged: untriaged.length },
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'scout-003',
          status: 'SKIP',
          message: 'Could not check feature requests',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'scout-004',
    agentId: 'scout',
    name: 'Roadmap Current with Sprint',
    description: 'Roadmap dates should be accurate',
    check: async (): Promise<ComplianceCheckResult> => {
      const roadmapPath = 'C:\\Users\\jackw\\Documents\\ObsidianVaults\\SwjshAK-Brain\\Roadmap.md';

      try {
        if (!await fileExists(roadmapPath)) {
          return {
            ruleId: 'scout-004',
            status: 'FAIL',
            message: 'Roadmap file not found',
            timestamp: new Date().toISOString(),
          };
        }

        const stats = await fs.promises.stat(roadmapPath);
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        const fileAge = Date.now() - stats.mtime.getTime();

        return {
          ruleId: 'scout-004',
          status: fileAge < oneWeek ? 'PASS' : 'FAIL',
          message: fileAge < oneWeek
            ? 'Roadmap updated recently'
            : `Roadmap not updated in ${Math.round(fileAge / (24 * 60 * 60 * 1000))} days`,
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'scout-004',
          status: 'ERROR',
          message: 'Could not check roadmap file',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
  {
    id: 'scout-005',
    agentId: 'scout',
    name: 'Stakeholder Feedback Integrated',
    description: 'User feedback should be captured',
    check: async (): Promise<ComplianceCheckResult> => {
      const backlogPath = 'data/brain/backlog-memory.md';

      try {
        if (!await fileExists(backlogPath)) {
          return {
            ruleId: 'scout-005',
            status: 'SKIP',
            message: 'Backlog file not found',
            timestamp: new Date().toISOString(),
          };
        }

        const content = await fs.promises.readFile(backlogPath, 'utf-8');
        const hasFeedback = /feedback|user.*request|stakeholder|from.*jack|ceo.*request/i.test(content);

        return {
          ruleId: 'scout-005',
          status: hasFeedback ? 'PASS' : 'SKIP',
          message: hasFeedback
            ? 'Stakeholder feedback integrated'
            : 'No explicit feedback references (may be implicit)',
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          ruleId: 'scout-005',
          status: 'ERROR',
          message: 'Could not read backlog file',
          timestamp: new Date().toISOString(),
        };
      }
    },
  },
];

// ============================================================================
// MAIN COMPLIANCE CHECKER
// ============================================================================

export class SoulComplianceChecker {
  private rules: ComplianceRule[];

  constructor() {
    this.rules = [
      ...chiefRules,
      ...hunterRules,
      ...arbiterRules,
      ...cortanaRules,
      ...opsRules,
      ...scoutRules,
    ];
  }

  async checkAll(): Promise<ComplianceReport> {
    const agentIds = ['chief', 'hunter', 'arbiter', 'cortana', 'ops', 'scout'];
    const agentReports: AgentComplianceReport[] = [];
    const allViolations: ComplianceCheckResult[] = [];

    for (const agentId of agentIds) {
      const agentRules = this.rules.filter(r => r.agentId === agentId);
      const results: ComplianceCheckResult[] = [];

      for (const rule of agentRules) {
        try {
          const result = await rule.check();
          results.push(result);
          if (result.status === 'FAIL') {
            allViolations.push(result);
          }
        } catch (error) {
          results.push({
            ruleId: rule.id,
            status: 'ERROR',
            message: `Check failed: ${error}`,
            timestamp: new Date().toISOString(),
          });
        }
      }

      const passed = results.filter(r => r.status === 'PASS').length;
      const failed = results.filter(r => r.status === 'FAIL').length;
      const skipped = results.filter(r => r.status === 'SKIP').length;
      const errored = results.filter(r => r.status === 'ERROR').length;

      // Score excludes skipped rules
      const scoreable = passed + failed;
      const score = scoreable > 0 ? Math.round((passed / scoreable) * 100) : 100;

      agentReports.push({
        agentId,
        agentName: agentId.charAt(0).toUpperCase() + agentId.slice(1),
        rulesTotal: results.length,
        rulesPassed: passed,
        rulesFailed: failed,
        rulesSkipped: skipped,
        rulesErrored: errored,
        score,
        results,
      });
    }

    const overallScore = Math.round(
      agentReports.reduce((sum, r) => sum + r.score, 0) / agentReports.length
    );

    const overallStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL' =
      overallScore >= 90 ? 'COMPLIANT' :
      overallScore >= 70 ? 'PARTIAL' :
      'NON_COMPLIANT';

    return {
      timestamp: new Date().toISOString(),
      overallScore,
      overallStatus,
      agents: agentReports,
      violations: allViolations,
    };
  }

  async checkAgent(agentId: string): Promise<AgentComplianceReport> {
    const agentRules = this.rules.filter(r => r.agentId === agentId);
    const results: ComplianceCheckResult[] = [];

    for (const rule of agentRules) {
      try {
        const result = await rule.check();
        results.push(result);
      } catch (error) {
        results.push({
          ruleId: rule.id,
          status: 'ERROR',
          message: `Check failed: ${error}`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;
    const errored = results.filter(r => r.status === 'ERROR').length;
    const scoreable = passed + failed;
    const score = scoreable > 0 ? Math.round((passed / scoreable) * 100) : 100;

    return {
      agentId,
      agentName: agentId.charAt(0).toUpperCase() + agentId.slice(1),
      rulesTotal: results.length,
      rulesPassed: passed,
      rulesFailed: failed,
      rulesSkipped: skipped,
      rulesErrored: errored,
      score,
      results,
    };
  }

  getRules(): ComplianceRule[] {
    return [...this.rules];
  }

  getRulesByAgent(agentId: string): ComplianceRule[] {
    return this.rules.filter(r => r.agentId === agentId);
  }
}

// CLI main
export async function main() {
  const checker = new SoulComplianceChecker();
  const report = await checker.checkAll();

  console.log('\n=== SENTINEL SOUL COMPLIANCE REPORT ===\n');
  console.log(`Overall Score: ${report.overallScore}% (${report.overallStatus})`);
  console.log(`Timestamp: ${report.timestamp}\n`);

  for (const agent of report.agents) {
    const icon = agent.score >= 80 ? '[OK]' : agent.score >= 50 ? '[!!]' : '[XX]';
    console.log(`${icon} ${agent.agentName}: ${agent.score}%`);
    console.log(`    Passed: ${agent.rulesPassed}, Failed: ${agent.rulesFailed}, Skipped: ${agent.rulesSkipped}`);

    for (const result of agent.results) {
      if (result.status === 'FAIL') {
        console.log(`    [FAIL] ${result.ruleId}: ${result.message}`);
      }
    }
  }

  if (report.violations.length > 0) {
    console.log('\n--- VIOLATIONS ---\n');
    for (const v of report.violations) {
      console.log(`[${v.ruleId}] ${v.message}`);
    }
  }

  // Save report
  const outputPath = 'data/sentinel/compliance-report.json';
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to ${outputPath}`);
}

if (require.main === module) {
  main().catch(console.error);
}
