import { NextResponse } from 'next/server';

const N8N_API_URL = process.env.N8N_API_URL || 'http://209.145.55.101:5678/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

export interface ExecutionSummary {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'success' | 'error' | 'running' | 'waiting';
  startedAt: string;
  stoppedAt?: string;
  duration?: number; // milliseconds
}

export interface ExecutionsResponse {
  executions: ExecutionSummary[];
  stats: {
    total24h: number;
    success: number;
    failed: number;
    running: number;
    avgDuration: number;
    successRate: number;
  };
  lastChecked: string;
  error?: string;
}

export async function GET(): Promise<NextResponse<ExecutionsResponse>> {
  const lastChecked = new Date().toISOString();

  if (!N8N_API_KEY) {
    return NextResponse.json({
      executions: [],
      stats: { total24h: 0, success: 0, failed: 0, running: 0, avgDuration: 0, successRate: 0 },
      lastChecked,
      error: 'N8N_API_KEY not configured',
    });
  }

  try {
    // Fetch recent executions
    const response = await fetch(`${N8N_API_URL}/executions?limit=50`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({
        executions: [],
        stats: { total24h: 0, success: 0, failed: 0, running: 0, avgDuration: 0, successRate: 0 },
        lastChecked,
        error: `n8n API returned ${response.status}`,
      });
    }

    const data = await response.json();
    const rawExecutions = data.data || [];

    // Calculate 24h cutoff
    const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;

    const executions: ExecutionSummary[] = rawExecutions.map((e: {
      id: string;
      workflowId: string;
      workflowData?: { name?: string };
      status: string;
      startedAt: string;
      stoppedAt?: string;
    }) => {
      const startTime = new Date(e.startedAt).getTime();
      const endTime = e.stoppedAt ? new Date(e.stoppedAt).getTime() : undefined;

      let status: ExecutionSummary['status'] = 'running';
      if (e.status === 'success') status = 'success';
      else if (e.status === 'error' || e.status === 'crashed') status = 'error';
      else if (e.status === 'waiting') status = 'waiting';

      return {
        id: e.id,
        workflowId: e.workflowId,
        workflowName: e.workflowData?.name || `Workflow ${e.workflowId}`,
        status,
        startedAt: e.startedAt,
        stoppedAt: e.stoppedAt,
        duration: endTime ? endTime - startTime : undefined,
      };
    });

    // Filter for 24h stats
    const executions24h = executions.filter(e => new Date(e.startedAt).getTime() > cutoff24h);
    const successCount = executions24h.filter(e => e.status === 'success').length;
    const failedCount = executions24h.filter(e => e.status === 'error').length;
    const runningCount = executions24h.filter(e => e.status === 'running').length;

    const completedWithDuration = executions24h.filter(e => e.duration !== undefined);
    const avgDuration = completedWithDuration.length > 0
      ? completedWithDuration.reduce((sum, e) => sum + (e.duration || 0), 0) / completedWithDuration.length
      : 0;

    const total = successCount + failedCount;
    const successRate = total > 0 ? (successCount / total) * 100 : 100;

    return NextResponse.json({
      executions: executions.slice(0, 20), // Return last 20 for display
      stats: {
        total24h: executions24h.length,
        success: successCount,
        failed: failedCount,
        running: runningCount,
        avgDuration: Math.round(avgDuration),
        successRate: Math.round(successRate * 10) / 10,
      },
      lastChecked,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      executions: [],
      stats: { total24h: 0, success: 0, failed: 0, running: 0, avgDuration: 0, successRate: 0 },
      lastChecked,
      error: message,
    });
  }
}
