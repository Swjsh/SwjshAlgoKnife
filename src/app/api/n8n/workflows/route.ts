import { NextResponse } from 'next/server';

const N8N_API_URL = process.env.N8N_API_URL || 'http://209.145.55.101:5678/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

export interface WorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  category: 'system' | 'integration' | 'automation' | 'manual';
}

export interface WorkflowsResponse {
  workflows: WorkflowSummary[];
  total: number;
  active: number;
  inactive: number;
  lastChecked: string;
  error?: string;
}

function categorizeWorkflow(name: string): WorkflowSummary['category'] {
  if (name.startsWith('WF-S')) return 'system';
  if (name.startsWith('WF-I')) return 'integration';
  if (name.startsWith('WF-A')) return 'automation';
  return 'manual';
}

export async function GET(): Promise<NextResponse<WorkflowsResponse>> {
  const lastChecked = new Date().toISOString();

  if (!N8N_API_KEY) {
    return NextResponse.json({
      workflows: [],
      total: 0,
      active: 0,
      inactive: 0,
      lastChecked,
      error: 'N8N_API_KEY not configured',
    });
  }

  try {
    const response = await fetch(`${N8N_API_URL}/workflows`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({
        workflows: [],
        total: 0,
        active: 0,
        inactive: 0,
        lastChecked,
        error: `n8n API returned ${response.status}`,
      });
    }

    const data = await response.json();
    const rawWorkflows = data.data || [];

    const workflows: WorkflowSummary[] = rawWorkflows.map((w: {
      id: string;
      name: string;
      active: boolean;
      createdAt: string;
      updatedAt: string;
      tags?: Array<{ name: string }>;
    }) => ({
      id: w.id,
      name: w.name,
      active: w.active,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      tags: w.tags?.map(t => t.name) || [],
      category: categorizeWorkflow(w.name),
    }));

    const activeCount = workflows.filter(w => w.active).length;

    return NextResponse.json({
      workflows,
      total: workflows.length,
      active: activeCount,
      inactive: workflows.length - activeCount,
      lastChecked,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      workflows: [],
      total: 0,
      active: 0,
      inactive: 0,
      lastChecked,
      error: message,
    });
  }
}
