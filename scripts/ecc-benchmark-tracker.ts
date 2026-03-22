/**
 * ECC Benchmark Tracker
 *
 * Tracks ECC skill usage and effectiveness metrics across Halo agent sessions.
 * Run after each agent session to capture iteration data.
 *
 * Usage:
 *   npx tsx scripts/ecc-benchmark-tracker.ts <agent> [options]
 *
 * Examples:
 *   npx tsx scripts/ecc-benchmark-tracker.ts ops --build-success --test-coverage=82
 *   npx tsx scripts/ecc-benchmark-tracker.ts arbiter --code-quality=8.5 --skills-used=code-reviewer
 */

import * as fs from 'fs';
import * as path from 'path';

const BENCHMARK_DIR = path.join(__dirname, '..', 'data', 'ecc-benchmark');
const ITERATIONS_DIR = path.join(BENCHMARK_DIR, 'iterations');
const CONFIG_PATH = path.join(BENCHMARK_DIR, 'benchmark-config.json');

interface IterationMetrics {
  taskCompleted: boolean;
  eccSkillsUsed: string[];
  codeQualityScore?: number;
  buildSuccess?: boolean;
  securityIssuesFound?: number;
  testCoverage?: number;
  documentationUpdated?: boolean;
  notes?: string;
}

interface IterationRecord {
  timestamp: string;
  agent: string;
  sessionId: string;
  metrics: IterationMetrics;
  jiraTickets?: string[];
}

function generateSessionId(): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '');
  return `${date}-${time}`;
}

function loadConfig(): any {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('Benchmark config not found. Run setup first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function parseArgs(args: string[]): { agent: string; metrics: IterationMetrics } {
  const agent = args[0];
  if (!agent) {
    console.error('Usage: ecc-benchmark-tracker.ts <agent> [options]');
    console.error('Agents: chief, ops, hunter, arbiter, cortana, scout');
    process.exit(1);
  }

  const validAgents = ['chief', 'ops', 'hunter', 'arbiter', 'cortana', 'scout'];
  if (!validAgents.includes(agent.toLowerCase())) {
    console.error(`Invalid agent: ${agent}. Must be one of: ${validAgents.join(', ')}`);
    process.exit(1);
  }

  const metrics: IterationMetrics = {
    taskCompleted: true,
    eccSkillsUsed: [],
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--task-failed') {
      metrics.taskCompleted = false;
    } else if (arg === '--build-success') {
      metrics.buildSuccess = true;
    } else if (arg === '--build-failed') {
      metrics.buildSuccess = false;
    } else if (arg === '--docs-updated') {
      metrics.documentationUpdated = true;
    } else if (arg.startsWith('--skills-used=')) {
      metrics.eccSkillsUsed = arg.split('=')[1].split(',');
    } else if (arg.startsWith('--code-quality=')) {
      metrics.codeQualityScore = parseFloat(arg.split('=')[1]);
    } else if (arg.startsWith('--test-coverage=')) {
      metrics.testCoverage = parseFloat(arg.split('=')[1]);
    } else if (arg.startsWith('--security-issues=')) {
      metrics.securityIssuesFound = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--jira=')) {
      // Handle Jira tickets separately
    } else if (arg.startsWith('--notes=')) {
      metrics.notes = arg.split('=')[1];
    }
  }

  return { agent: agent.toLowerCase(), metrics };
}

function saveIteration(record: IterationRecord): void {
  // Ensure iterations directory exists
  if (!fs.existsSync(ITERATIONS_DIR)) {
    fs.mkdirSync(ITERATIONS_DIR, { recursive: true });
  }

  // Create monthly file for iterations
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthFile = path.join(ITERATIONS_DIR, `iterations-${month}.json`);

  let iterations: IterationRecord[] = [];
  if (fs.existsSync(monthFile)) {
    iterations = JSON.parse(fs.readFileSync(monthFile, 'utf-8'));
  }

  iterations.push(record);
  fs.writeFileSync(monthFile, JSON.stringify(iterations, null, 2));

  console.log(`✅ Iteration recorded for ${record.agent}`);
  console.log(`   Session: ${record.sessionId}`);
  console.log(`   Skills used: ${record.metrics.eccSkillsUsed.join(', ') || 'none'}`);
  console.log(`   Task completed: ${record.metrics.taskCompleted}`);
}

function generateReport(): void {
  const month = new Date().toISOString().slice(0, 7);
  const monthFile = path.join(ITERATIONS_DIR, `iterations-${month}.json`);

  if (!fs.existsSync(monthFile)) {
    console.log('No iterations recorded this month yet.');
    return;
  }

  const iterations: IterationRecord[] = JSON.parse(fs.readFileSync(monthFile, 'utf-8'));
  const config = loadConfig();

  console.log('\n📊 ECC Benchmark Report');
  console.log('═'.repeat(50));
  console.log(`Period: ${month}`);
  console.log(`Total sessions: ${iterations.length}`);

  // Aggregate by agent
  const byAgent: Record<string, IterationRecord[]> = {};
  for (const iter of iterations) {
    if (!byAgent[iter.agent]) byAgent[iter.agent] = [];
    byAgent[iter.agent].push(iter);
  }

  console.log('\nPer-Agent Summary:');
  console.log('─'.repeat(50));

  for (const [agent, records] of Object.entries(byAgent)) {
    const completed = records.filter(r => r.metrics.taskCompleted).length;
    const skillUsage = records.filter(r => r.metrics.eccSkillsUsed.length > 0).length;
    const avgQuality = records
      .filter(r => r.metrics.codeQualityScore !== undefined)
      .reduce((sum, r) => sum + (r.metrics.codeQualityScore || 0), 0) /
      (records.filter(r => r.metrics.codeQualityScore !== undefined).length || 1);

    console.log(`\n${agent.toUpperCase()}:`);
    console.log(`  Sessions: ${records.length}`);
    console.log(`  Task completion: ${((completed / records.length) * 100).toFixed(1)}%`);
    console.log(`  ECC skill usage: ${((skillUsage / records.length) * 100).toFixed(1)}%`);
    if (avgQuality > 0) {
      console.log(`  Avg code quality: ${avgQuality.toFixed(1)}/10`);
    }
  }

  // Overall metrics
  const totalCompleted = iterations.filter(i => i.metrics.taskCompleted).length;
  const totalSkillUsage = iterations.filter(i => i.metrics.eccSkillsUsed.length > 0).length;

  console.log('\n' + '═'.repeat(50));
  console.log('Overall Metrics vs Targets:');
  console.log(`  Task Completion: ${((totalCompleted / iterations.length) * 100).toFixed(1)}% (target: ${config.metrics.taskCompletionRate.target}%)`);
  console.log(`  ECC Skill Usage: ${((totalSkillUsage / iterations.length) * 100).toFixed(1)}% (target: ${config.metrics.eccSkillUtilization.target}%)`);
}

// Main execution
const args = process.argv.slice(2);

if (args[0] === '--report' || args[0] === '-r') {
  generateReport();
} else if (args.length > 0) {
  const { agent, metrics } = parseArgs(args);
  const config = loadConfig();

  // Validate agent has ECC skills configured
  if (!config.agents[agent]) {
    console.error(`Agent ${agent} not found in benchmark config`);
    process.exit(1);
  }

  const record: IterationRecord = {
    timestamp: new Date().toISOString(),
    agent,
    sessionId: generateSessionId(),
    metrics,
  };

  // Parse Jira tickets if provided
  const jiraArg = args.find(a => a.startsWith('--jira='));
  if (jiraArg) {
    record.jiraTickets = jiraArg.split('=')[1].split(',');
  }

  saveIteration(record);
} else {
  console.log('ECC Benchmark Tracker');
  console.log('═'.repeat(40));
  console.log('\nUsage:');
  console.log('  Record iteration:');
  console.log('    npx tsx scripts/ecc-benchmark-tracker.ts <agent> [options]');
  console.log('\n  Generate report:');
  console.log('    npx tsx scripts/ecc-benchmark-tracker.ts --report');
  console.log('\nOptions:');
  console.log('  --task-failed          Mark task as not completed');
  console.log('  --build-success        Build passed');
  console.log('  --build-failed         Build failed');
  console.log('  --docs-updated         Documentation was updated');
  console.log('  --skills-used=a,b,c    ECC skills invoked');
  console.log('  --code-quality=N       Code review score (1-10)');
  console.log('  --test-coverage=N      Test coverage percentage');
  console.log('  --security-issues=N    Security issues found');
  console.log('  --jira=PROJ-1,PROJ-2   Associated Jira tickets');
  console.log('  --notes="text"         Session notes');
  console.log('\nAgents: chief, ops, hunter, arbiter, cortana, scout');
}
