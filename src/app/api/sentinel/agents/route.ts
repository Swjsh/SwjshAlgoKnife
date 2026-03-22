/**
 * SENTINEL API - Agent Compliance Endpoint
 *
 * GET /api/sentinel/agents - Returns agent compliance details
 */

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

interface AgentComplianceReport {
  agentId: string;
  agentName: string;
  rulesTotal: number;
  rulesPassed: number;
  rulesFailed: number;
  rulesSkipped: number;
  rulesErrored: number;
  score: number;
  results: {
    ruleId: string;
    status: string;
    message: string;
  }[];
}

interface ComplianceReport {
  timestamp: string;
  overallScore: number;
  overallStatus: string;
  agents: AgentComplianceReport[];
  violations: { ruleId: string; message: string }[];
}

interface AgentRegistryEntry {
  agentId: string;
  sessionId: string;
  startedAt: string;
  status: string;
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
    const agentId = searchParams.get('agent');

    // Load compliance report
    const complianceReport = loadJsonFile<ComplianceReport>(
      'data/sentinel/compliance-report.json'
    );

    // Load agent registry
    const registry = loadJsonFile<{
      agents: Record<string, AgentRegistryEntry>;
      lastUpdated: string;
    }>('data/agent-registry.json');

    // Build response
    const agents = complianceReport?.agents || [];
    const registryAgents = registry?.agents || {};

    const enrichedAgents = agents.map(agent => {
      const regEntry = registryAgents[agent.agentId];
      return {
        ...agent,
        sessionId: regEntry?.sessionId,
        startedAt: regEntry?.startedAt,
        processStatus: regEntry?.status ?? 'unknown',
      };
    });

    // Filter by agent if requested
    let result = enrichedAgents;
    if (agentId) {
      result = result.filter(a => a.agentId === agentId);
    }

    return NextResponse.json({
      timestamp: complianceReport?.timestamp ?? new Date().toISOString(),
      overallScore: complianceReport?.overallScore ?? 100,
      overallStatus: complianceReport?.overallStatus ?? 'UNKNOWN',
      agents: result,
      violations: complianceReport?.violations ?? [],
      registryLastUpdated: registry?.lastUpdated,
    });
  } catch (error) {
    console.error('SENTINEL agents error:', error);
    return NextResponse.json(
      {
        error: true,
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve agent compliance',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
