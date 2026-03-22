/**
 * SENTINEL API - Connection Status Endpoint
 *
 * GET /api/sentinel/connections - Returns all connection statuses
 */

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

interface ConnectionResult {
  connectionId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latencyMs: number;
  timestamp: string;
  message?: string;
  error?: string;
}

interface Connection {
  id: string;
  name: string;
  type: string;
  category: string;
  criticality: string;
}

interface ConnectionWithStatus extends Connection {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latencyMs: number;
  lastChecked: string;
  message?: string;
  error?: string;
  circuitBreakerState?: string;
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const criticality = searchParams.get('criticality');

    // Load connection registry
    const registry = loadJsonFile<{
      connections: Connection[];
    }>('data/sentinel/connection-registry.json');

    // Load health status
    const healthStatus = loadJsonFile<{
      results: ConnectionResult[];
    }>('data/sentinel/health-status.json');

    // Load circuit breakers
    const circuitBreakers = loadJsonFile<{
      breakers: Record<string, { state: string }>;
    }>('data/sentinel/circuit-breakers.json');

    if (!registry) {
      return NextResponse.json(
        {
          error: true,
          code: 'REGISTRY_NOT_FOUND',
          message: 'Connection registry not found',
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Build results map
    const resultsMap = new Map<string, ConnectionResult>();
    for (const result of healthStatus?.results || []) {
      resultsMap.set(result.connectionId, result);
    }

    // Merge connection definitions with results
    let connections: ConnectionWithStatus[] = registry.connections.map(conn => {
      const result = resultsMap.get(conn.id);
      const breaker = circuitBreakers?.breakers?.[conn.id];

      return {
        ...conn,
        status: result?.status ?? 'unknown',
        latencyMs: result?.latencyMs ?? 0,
        lastChecked: result?.timestamp ?? '',
        message: result?.message,
        error: result?.error,
        circuitBreakerState: breaker?.state,
      };
    });

    // Apply filters
    if (category) {
      connections = connections.filter(c => c.category === category);
    }
    if (status) {
      connections = connections.filter(c => c.status === status);
    }
    if (criticality) {
      connections = connections.filter(c => c.criticality === criticality);
    }

    // Group by category
    const grouped = connections.reduce((acc, conn) => {
      if (!acc[conn.category]) {
        acc[conn.category] = [];
      }
      acc[conn.category].push(conn);
      return acc;
    }, {} as Record<string, ConnectionWithStatus[]>);

    return NextResponse.json({
      total: connections.length,
      byCategory: grouped,
      connections,
    });
  } catch (error) {
    console.error('SENTINEL connections error:', error);
    return NextResponse.json(
      {
        error: true,
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve connection status',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
