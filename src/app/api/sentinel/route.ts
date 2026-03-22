/**
 * SENTINEL API - Main Health Status Endpoint
 *
 * GET /api/sentinel - Returns overall system health status
 */

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

interface ConnectionStatus {
  total: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
}

interface AgentStatus {
  total: number;
  compliant: number;
  violations: number;
}

interface SelfHealingStatus {
  executions24h: number;
  successRate: number;
}

interface SentinelStatus {
  overallHealth: number;
  severity: 'GREEN' | 'YELLOW' | 'RED' | 'CRITICAL';
  trend: 'improving' | 'stable' | 'degrading';
  connections: ConnectionStatus;
  agents: AgentStatus;
  selfHealing: SelfHealingStatus;
  lastCheck: string;
  circuitBreakers: {
    open: number;
    halfOpen: number;
    closed: number;
  };
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

export async function GET() {
  try {
    // Load health status
    const healthStatus = loadJsonFile<{
      overallScore: number;
      severity: string;
      trend: string;
      connections: { total: number; healthy: number; degraded: number; unhealthy: number; unknown: number };
      lastCheck: string;
    }>('data/sentinel/health-status.json');

    // Load compliance report
    const complianceReport = loadJsonFile<{
      overallScore: number;
      violations: unknown[];
      agents: { rulesFailed: number }[];
    }>('data/sentinel/compliance-report.json');

    // Load circuit breaker states
    const circuitBreakers = loadJsonFile<{
      breakers: Record<string, { state: string }>;
    }>('data/sentinel/circuit-breakers.json');

    // Load playbook executions
    const executions = loadJsonFile<{
      executions: { status: string; completedAt: string }[];
    }>('data/sentinel/playbook-executions.json');

    // Calculate circuit breaker counts
    const breakerStates = circuitBreakers?.breakers || {};
    const breakerValues = Object.values(breakerStates);
    const openCount = breakerValues.filter(b => b.state === 'open').length;
    const halfOpenCount = breakerValues.filter(b => b.state === 'half-open').length;
    const closedCount = breakerValues.filter(b => b.state === 'closed').length;

    // Calculate self-healing stats (last 24h)
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const recentExecutions = (executions?.executions || []).filter(e => {
      if (!e.completedAt) return false;
      return now - new Date(e.completedAt).getTime() < twentyFourHours;
    });
    const successfulExecutions = recentExecutions.filter(e => e.status === 'success');
    const successRate = recentExecutions.length > 0
      ? Math.round((successfulExecutions.length / recentExecutions.length) * 100)
      : 100;

    // Build status response
    const status: SentinelStatus = {
      overallHealth: healthStatus?.overallScore ?? 100,
      severity: (healthStatus?.severity as SentinelStatus['severity']) ?? 'GREEN',
      trend: (healthStatus?.trend as SentinelStatus['trend']) ?? 'stable',
      connections: {
        total: healthStatus?.connections?.total ?? 34,
        healthy: healthStatus?.connections?.healthy ?? 34,
        degraded: healthStatus?.connections?.degraded ?? 0,
        unhealthy: healthStatus?.connections?.unhealthy ?? 0,
      },
      agents: {
        total: 6,
        compliant: 6 - (complianceReport?.agents?.filter(a => a.rulesFailed > 0).length ?? 0),
        violations: complianceReport?.violations?.length ?? 0,
      },
      selfHealing: {
        executions24h: recentExecutions.length,
        successRate,
      },
      lastCheck: healthStatus?.lastCheck ?? new Date().toISOString(),
      circuitBreakers: {
        open: openCount,
        halfOpen: halfOpenCount,
        closed: closedCount,
      },
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error('SENTINEL status error:', error);
    return NextResponse.json(
      {
        error: true,
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve SENTINEL status',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
