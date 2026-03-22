/**
 * SENTINEL Playbook Executor
 *
 * Executes self-healing playbooks for automated recovery.
 * Supports YAML playbook format with steps, conditions, and rollback.
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as yaml from 'yaml';

const execAsync = promisify(exec);

// Types
export type PlaybookStatus = 'pending' | 'running' | 'success' | 'failure' | 'rolled_back';

export interface PlaybookStep {
  name: string;
  action: string;
  args?: Record<string, unknown>;
  timeout_ms?: number;
  on_failure?: 'continue' | 'abort' | 'rollback';
  rollback?: PlaybookStep;
}

export interface PlaybookCondition {
  type: 'connection_status' | 'time_window' | 'retry_count' | 'circuit_state';
  value: unknown;
}

export interface Playbook {
  name: string;
  description: string;
  version: string;
  triggers: string[];
  conditions?: PlaybookCondition[];
  max_retries: number;
  cooldown_ms: number;
  steps: PlaybookStep[];
  rollback_steps?: PlaybookStep[];
}

export interface PlaybookExecution {
  id: string;
  playbookName: string;
  connectionId: string;
  status: PlaybookStatus;
  startedAt: string;
  completedAt?: string;
  currentStep?: number;
  stepResults: StepResult[];
  error?: string;
  retryCount: number;
}

export interface StepResult {
  stepIndex: number;
  stepName: string;
  status: 'success' | 'failure' | 'skipped';
  output?: string;
  error?: string;
  durationMs: number;
}

export interface ExecutionStore {
  version: string;
  lastUpdated: string;
  executions: PlaybookExecution[];
  activeExecutions: Record<string, string>; // connectionId -> executionId
}

// Action handlers
type ActionHandler = (args: Record<string, unknown>) => Promise<{ success: boolean; output?: string; error?: string }>;

const actionHandlers: Record<string, ActionHandler> = {
  'pm2_restart': async (args) => {
    const processName = args.process_name as string;
    try {
      const { stdout, stderr } = await execAsync(`pm2 restart ${processName}`);
      return { success: true, output: stdout || stderr };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  'pm2_stop': async (args) => {
    const processName = args.process_name as string;
    try {
      const { stdout } = await execAsync(`pm2 stop ${processName}`);
      return { success: true, output: stdout };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  'pm2_start': async (args) => {
    const processName = args.process_name as string;
    try {
      const { stdout } = await execAsync(`pm2 start ${processName}`);
      return { success: true, output: stdout };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  'http_request': async (args) => {
    const url = args.url as string;
    const method = (args.method as string) || 'GET';
    const timeout = (args.timeout_ms as number) || 5000;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return {
        success: response.ok,
        output: `${response.status} ${response.statusText}`,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  'wait': async (args) => {
    const ms = (args.duration_ms as number) || 1000;
    await new Promise(resolve => setTimeout(resolve, ms));
    return { success: true, output: `Waited ${ms}ms` };
  },

  'shell': async (args) => {
    const command = args.command as string;
    const timeout = (args.timeout_ms as number) || 30000;

    try {
      const { stdout, stderr } = await execAsync(command, { timeout });
      return { success: true, output: stdout || stderr };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  'write_file': async (args) => {
    const filePath = args.path as string;
    const content = args.content as string;

    try {
      await fs.promises.writeFile(filePath, content);
      return { success: true, output: `Wrote to ${filePath}` };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  'delete_file': async (args) => {
    const filePath = args.path as string;

    try {
      await fs.promises.unlink(filePath);
      return { success: true, output: `Deleted ${filePath}` };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  'write_to_inbox': async (args) => {
    const agentId = args.agent_id as string;
    const message = args.message as string;
    const inboxPath = `data/agent-inbox/${agentId}.json`;

    try {
      let inbox: { requests: { message: string; timestamp: string; from: string }[] } = { requests: [] };

      if (fs.existsSync(inboxPath)) {
        const content = await fs.promises.readFile(inboxPath, 'utf-8');
        inbox = JSON.parse(content);
      } else {
        await fs.promises.mkdir(path.dirname(inboxPath), { recursive: true });
      }

      inbox.requests.push({
        message,
        timestamp: new Date().toISOString(),
        from: 'sentinel',
      });

      await fs.promises.writeFile(inboxPath, JSON.stringify(inbox, null, 2));
      return { success: true, output: `Message sent to ${agentId}` };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  'clear_sessions': async (args) => {
    const maxAgeMs = (args.max_age_ms as number) || 24 * 60 * 60 * 1000;
    const sessionDir = (args.session_dir as string) || path.join(
      process.env.USERPROFILE || process.env.HOME || '',
      '.claude/projects'
    );

    try {
      const cutoff = Date.now() - maxAgeMs;
      let cleared = 0;

      const walkDir = async (dir: string) => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walkDir(fullPath);
          } else if (entry.name.endsWith('.jsonl')) {
            const stats = await fs.promises.stat(fullPath);
            if (stats.mtime.getTime() < cutoff) {
              await fs.promises.unlink(fullPath);
              cleared++;
            }
          }
        }
      };

      if (fs.existsSync(sessionDir)) {
        await walkDir(sessionDir);
      }

      return { success: true, output: `Cleared ${cleared} stale sessions` };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  'log': async (args) => {
    const message = args.message as string;
    const level = (args.level as string) || 'info';
    console.log(`[${level.toUpperCase()}] ${message}`);
    return { success: true, output: message };
  },

  'create_jira_ticket': async (args) => {
    const project = args.project as string;
    const summary = args.summary as string;
    const description = args.description as string;
    const priority = (args.priority as string) || 'high';
    const labels = (args.labels as string[]) || [];

    try {
      const response = await fetch('http://localhost:3000/api/jira/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, summary, description, priority, labels }),
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const ticket = await response.json();
      return { success: true, output: `Created ticket: ${JSON.stringify(ticket)}` };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  'check_health': async (args) => {
    const connectionId = args.connection_id as string;
    const expectedStatus = (args.expected_status as string) || 'healthy';

    try {
      // Would integrate with health checker
      // For now, do a simple check
      const healthPath = 'data/sentinel/health-status.json';
      if (!fs.existsSync(healthPath)) {
        return { success: false, error: 'Health status file not found' };
      }

      const content = await fs.promises.readFile(healthPath, 'utf-8');
      const health = JSON.parse(content);
      const result = health.results?.find((r: { connectionId: string }) => r.connectionId === connectionId);

      if (!result) {
        return { success: false, error: `Connection ${connectionId} not found` };
      }

      return {
        success: result.status === expectedStatus,
        output: `${connectionId}: ${result.status}`,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export class PlaybookExecutor {
  private playbooksDir: string;
  private storePath: string;
  private store: ExecutionStore;
  private playbooks: Map<string, Playbook> = new Map();

  constructor(
    playbooksDir: string = 'data/sentinel/playbooks',
    storePath: string = 'data/sentinel/playbook-executions.json'
  ) {
    this.playbooksDir = playbooksDir;
    this.storePath = storePath;
    this.store = this.loadStore();
    this.loadPlaybooks();
  }

  private loadStore(): ExecutionStore {
    try {
      if (fs.existsSync(this.storePath)) {
        const content = fs.readFileSync(this.storePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn(`Failed to load execution store: ${error}`);
    }

    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      executions: [],
      activeExecutions: {},
    };
  }

  private saveStore(): void {
    try {
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.store.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.storePath, JSON.stringify(this.store, null, 2));
    } catch (error) {
      console.error(`Failed to save execution store: ${error}`);
    }
  }

  private loadPlaybooks(): void {
    if (!fs.existsSync(this.playbooksDir)) {
      console.warn(`Playbooks directory not found: ${this.playbooksDir}`);
      return;
    }

    const files = fs.readdirSync(this.playbooksDir);
    for (const file of files) {
      if (file.endsWith('.yml') || file.endsWith('.yaml')) {
        try {
          const content = fs.readFileSync(path.join(this.playbooksDir, file), 'utf-8');
          const playbook = yaml.parse(content) as Playbook;
          this.playbooks.set(file.replace(/\.ya?ml$/, ''), playbook);
        } catch (error) {
          console.error(`Failed to load playbook ${file}: ${error}`);
        }
      }
    }

    console.log(`Loaded ${this.playbooks.size} playbooks`);
  }

  getPlaybook(name: string): Playbook | undefined {
    return this.playbooks.get(name);
  }

  getAllPlaybooks(): Map<string, Playbook> {
    return new Map(this.playbooks);
  }

  isPlaybookRunning(connectionId: string): boolean {
    return connectionId in this.store.activeExecutions;
  }

  async execute(
    playbookName: string,
    connectionId: string,
    context: Record<string, unknown> = {}
  ): Promise<PlaybookExecution> {
    const playbook = this.playbooks.get(playbookName);
    if (!playbook) {
      throw new Error(`Playbook not found: ${playbookName}`);
    }

    // Check if already running for this connection
    if (this.isPlaybookRunning(connectionId)) {
      throw new Error(`Playbook already running for ${connectionId}`);
    }

    // Create execution record
    const executionId = `${playbookName}-${connectionId}-${Date.now()}`;
    const execution: PlaybookExecution = {
      id: executionId,
      playbookName,
      connectionId,
      status: 'running',
      startedAt: new Date().toISOString(),
      currentStep: 0,
      stepResults: [],
      retryCount: 0,
    };

    this.store.executions.push(execution);
    this.store.activeExecutions[connectionId] = executionId;
    this.saveStore();

    console.log(`[PlaybookExecutor] Starting ${playbookName} for ${connectionId}`);

    try {
      // Execute steps
      for (let i = 0; i < playbook.steps.length; i++) {
        execution.currentStep = i;
        const step = playbook.steps[i];

        const stepResult = await this.executeStep(step, context);
        execution.stepResults.push({
          stepIndex: i,
          stepName: step.name,
          ...stepResult,
        });

        if (stepResult.status === 'failure') {
          const onFailure = step.on_failure || 'abort';

          if (onFailure === 'rollback') {
            // Execute rollback steps
            await this.executeRollback(playbook, execution, context);
            execution.status = 'rolled_back';
            break;
          } else if (onFailure === 'abort') {
            execution.status = 'failure';
            execution.error = stepResult.error;
            break;
          }
          // 'continue' - just proceed to next step
        }

        this.saveStore();
      }

      // If we completed all steps without failure
      if (execution.status === 'running') {
        execution.status = 'success';
      }
    } catch (error) {
      execution.status = 'failure';
      execution.error = String(error);
    }

    // Cleanup
    execution.completedAt = new Date().toISOString();
    delete this.store.activeExecutions[connectionId];
    this.saveStore();

    console.log(`[PlaybookExecutor] ${playbookName} for ${connectionId}: ${execution.status}`);

    return execution;
  }

  private async executeStep(
    step: PlaybookStep,
    context: Record<string, unknown>
  ): Promise<Omit<StepResult, 'stepIndex' | 'stepName'>> {
    const startTime = Date.now();

    const handler = actionHandlers[step.action];
    if (!handler) {
      return {
        status: 'failure',
        error: `Unknown action: ${step.action}`,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      // Merge step args with context
      const args = { ...context, ...step.args };

      // Execute with timeout
      const timeout = step.timeout_ms || 30000;
      const result = await Promise.race([
        handler(args),
        new Promise<{ success: boolean; error: string }>((_, reject) =>
          setTimeout(() => reject(new Error('Step timeout')), timeout)
        ),
      ]);

      return {
        status: result.success ? 'success' : 'failure',
        output: result.output,
        error: result.error,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'failure',
        error: String(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  private async executeRollback(
    playbook: Playbook,
    execution: PlaybookExecution,
    context: Record<string, unknown>
  ): Promise<void> {
    console.log(`[PlaybookExecutor] Rolling back ${playbook.name}`);

    const rollbackSteps = playbook.rollback_steps || [];

    for (let i = 0; i < rollbackSteps.length; i++) {
      const step = rollbackSteps[i];
      const result = await this.executeStep(step, context);

      execution.stepResults.push({
        stepIndex: playbook.steps.length + i,
        stepName: `[ROLLBACK] ${step.name}`,
        ...result,
      });
    }
  }

  getRecentExecutions(limit: number = 20): PlaybookExecution[] {
    return this.store.executions.slice(-limit);
  }

  getExecutionsByConnection(connectionId: string): PlaybookExecution[] {
    return this.store.executions.filter(e => e.connectionId === connectionId);
  }

  getActiveExecutions(): Record<string, string> {
    return { ...this.store.activeExecutions };
  }

  getSummary(): {
    total: number;
    success: number;
    failure: number;
    rolledBack: number;
    running: number;
  } {
    const executions = this.store.executions;
    return {
      total: executions.length,
      success: executions.filter(e => e.status === 'success').length,
      failure: executions.filter(e => e.status === 'failure').length,
      rolledBack: executions.filter(e => e.status === 'rolled_back').length,
      running: Object.keys(this.store.activeExecutions).length,
    };
  }
}

// CLI main
export async function main() {
  const executor = new PlaybookExecutor();

  console.log('\n=== SENTINEL PLAYBOOK EXECUTOR ===\n');

  const playbooks = executor.getAllPlaybooks();
  console.log(`Loaded playbooks: ${playbooks.size}`);

  for (const [name, playbook] of playbooks) {
    console.log(`  - ${name}: ${playbook.description}`);
    console.log(`    Steps: ${playbook.steps.length}, Triggers: ${playbook.triggers.join(', ')}`);
  }

  const summary = executor.getSummary();
  console.log('\n--- Execution Summary ---\n');
  console.log(`Total: ${summary.total}`);
  console.log(`Success: ${summary.success}`);
  console.log(`Failure: ${summary.failure}`);
  console.log(`Rolled back: ${summary.rolledBack}`);
  console.log(`Running: ${summary.running}`);

  const recent = executor.getRecentExecutions(5);
  if (recent.length > 0) {
    console.log('\n--- Recent Executions ---\n');
    for (const exec of recent) {
      console.log(`${exec.id}: ${exec.status}`);
      console.log(`  Connection: ${exec.connectionId}`);
      console.log(`  Started: ${exec.startedAt}`);
      if (exec.completedAt) {
        console.log(`  Completed: ${exec.completedAt}`);
      }
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}
