import { NextResponse } from 'next/server';

const N8N_API_URL = process.env.N8N_API_URL || 'http://209.145.55.101:5678/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

export interface N8nHealthResponse {
  status: 'healthy' | 'degraded' | 'error';
  connected: boolean;
  version?: string;
  workflows?: {
    total: number;
    active: number;
    inactive: number;
  };
  lastChecked: string;
  message?: string;
}

export async function GET(): Promise<NextResponse<N8nHealthResponse>> {
  const lastChecked = new Date().toISOString();

  if (!N8N_API_KEY) {
    return NextResponse.json({
      status: 'error',
      connected: false,
      message: 'N8N_API_KEY not configured',
      lastChecked,
    });
  }

  try {
    const response = await fetch(`${N8N_API_URL}/workflows`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({
        status: 'error',
        connected: false,
        message: `n8n API returned ${response.status}`,
        lastChecked,
      });
    }

    const data = await response.json();
    const workflows = data.data || [];
    const activeCount = workflows.filter((w: { active: boolean }) => w.active).length;

    return NextResponse.json({
      status: 'healthy',
      connected: true,
      version: '2.37.4',
      workflows: {
        total: workflows.length,
        active: activeCount,
        inactive: workflows.length - activeCount,
      },
      lastChecked,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      status: 'error',
      connected: false,
      message,
      lastChecked,
    });
  }
}
