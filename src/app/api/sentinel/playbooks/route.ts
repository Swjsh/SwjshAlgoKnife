/**
 * SENTINEL API - Playbook Executions Endpoint
 *
 * GET /api/sentinel/playbooks - Returns recent playbook executions
 */

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

interface StepResult {
  stepIndex: number;
  stepName: string;
  status: string;
  output?: string;
  error?: string;
  durationMs: number;
}

interface PlaybookExecution {
  id: string;
  playbookName: string;
  connectionId: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  currentStep?: number;
  stepResults: StepResult[];
  error?: string;
  retryCount: number;
}

interface PlaybookDefinition {
  name: string;
  description: string;
  version: string;
  triggers: string[];
  max_retries: number;
  cooldown_ms: number;
  steps: { name: string; action: string }[];
}

function loadJsonFile<T>(filePath: string): T | null {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error(`Failed to load ${filePath}:`, error);
  }
  return null;
}

function loadPlaybooks(): Record<string, PlaybookDefinition> {
  const playbooksDir = path.join(process.cwd(), 'data/sentinel/playbooks');
  const playbooks: Record<string, PlaybookDefinition> = {};

  try {
    if (fs.existsSync(playbooksDir)) {
      const files = fs.readdirSync(playbooksDir);
      for (const file of files) {
        if (file.endsWith('.yml') || file.endsWith('.yaml')) {
          // Basic YAML parsing (simple key-value extraction)
          const content = fs.readFileSync(path.join(playbooksDir, file), 'utf-8');
          const name = file.replace(/\.ya?ml$/, '');

          // Extract basic info from YAML
          const nameMatch = content.match(/^name:\s*(.+)$/m);
          const descMatch = content.match(/^description:\s*(.+)$/m);
          const versionMatch = content.match(/^version:\s*["']?(.+?)["']?\s*$/m);

          playbooks[name] = {
            name: nameMatch?.[1] || name,
            description: descMatch?.[1] || '',
            version: versionMatch?.[1] || '1.0.0',
            triggers: [],
            max_retries: 3,
            cooldown_ms: 60000,
            steps: [],
          };
        }
      }
    }
  } catch (error) {
    console.error('Failed to load playbooks:', error);
  }

  return playbooks;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const status = searchParams.get('status');
    const connectionId = searchParams.get('connection');

    // Load execution store
    const store = loadJsonFile<{
      executions: PlaybookExecution[];
      activeExecutions: Record<string, string>;
    }>('data/sentinel/playbook-executions.json');

    // Load playbook definitions
    const playbooks = loadPlaybooks();

    let executions = store?.executions || [];

    // Apply filters
    if (status) {
      executions = executions.filter(e => e.status === status);
    }
    if (connectionId) {
      executions = executions.filter(e => e.connectionId === connectionId);
    }

    // Limit results
    executions = executions.slice(-limit);

    // Calculate summary stats
    const total = store?.executions?.length ?? 0;
    const success = store?.executions?.filter(e => e.status === 'success').length ?? 0;
    const failure = store?.executions?.filter(e => e.status === 'failure').length ?? 0;
    const rolledBack = store?.executions?.filter(e => e.status === 'rolled_back').length ?? 0;

    return NextResponse.json({
      summary: {
        total,
        success,
        failure,
        rolledBack,
        running: Object.keys(store?.activeExecutions || {}).length,
      },
      activeExecutions: store?.activeExecutions || {},
      executions,
      availablePlaybooks: Object.keys(playbooks).map(playbookName => ({
        ...playbooks[playbookName],
        key: playbookName,
      })),
    });
  } catch (error) {
    console.error('SENTINEL playbooks error:', error);
    return NextResponse.json(
      {
        error: true,
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve playbook executions',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
