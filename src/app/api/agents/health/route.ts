/**
 * Agent Health Predictions API
 * ============================
 * Returns health predictions for all agents (Research + HALO).
 *
 * GET /api/agents/health
 *   Returns: Health predictions for all agents with failure probability
 *
 * Part of Research Agent Audit Command Center
 */

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface HealthPrediction {
  agentId: string;
  agentName: string;
  agentType: 'research' | 'halo' | 'trading';
  group?: string;
  currentStatus: 'healthy' | 'warning' | 'critical' | 'offline';
  predictedStatus: 'healthy' | 'warning' | 'critical';
  failureProbability: number;
  timeToFailure: number | null;
  confidence: number;
  signals: string[];
  recommendation: string;
  emoji?: string;
  color?: string;
}

// ============================================================================
// Constants
// ============================================================================

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const OVERNIGHT_DIR = path.join(ROOT, '.claude', 'overnight');

const STALE_THRESHOLD_MS = 30000;
const DEAD_THRESHOLD_MS = 180000;

// Research agents mapping
const RESEARCH_AGENTS = [
  { id: 'improver', name: 'IMPROVER', terminal: 1, group: 'group1', emoji: '🔧', color: '#06b6d4' },
  { id: 'backtester', name: 'BACKTESTER', terminal: 2, group: 'group1', emoji: '📊', color: '#22c55e' },
  { id: 'researcher', name: 'RESEARCHER', terminal: 3, group: 'group1', emoji: '🔍', color: '#a855f7' },
  { id: 'brain_updater', name: 'BRAIN_UPDATER', terminal: 4, group: 'group1', emoji: '🧠', color: '#f59e0b' },
  { id: 'security_auditor', name: 'SECURITY_AUDITOR', terminal: 5, group: 'group2', emoji: '🛡️', color: '#ef4444' },
  { id: 'integration_tester', name: 'INTEGRATION_TESTER', terminal: 6, group: 'group2', emoji: '🧪', color: '#3b82f6' },
  { id: 'intel_aggregator', name: 'INTEL_AGGREGATOR', terminal: 7, group: 'group2', emoji: '📡', color: '#8b5cf6' },
  { id: 'devops_optimizer', name: 'DEVOPS_OPTIMIZER', terminal: 8, group: 'group2', emoji: '⚙️', color: '#14b8a6' },
];

// HALO agents mapping
const HALO_AGENTS = [
  { id: 'chief', name: 'CHIEF', emoji: '👑', color: '#fbbf24' },
  { id: 'hunter', name: 'HUNTER', emoji: '🐛', color: '#ef4444' },
  { id: 'ops', name: 'OPS', emoji: '🛡️', color: '#22c55e' },
  { id: 'scout', name: 'SCOUT', emoji: '🐕', color: '#06b6d4' },
  { id: 'arbiter', name: 'ARBITER', emoji: '⚖️', color: '#a855f7' },
  { id: 'cortana', name: 'CORTANA', emoji: '🧠', color: '#ec4899' },
];

// ============================================================================
// Helper Functions
// ============================================================================

function readJsonFile(filePath: string): unknown | null {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // Invalid or missing file
  }
  return null;
}

function calculateAgeMs(timestamp: string | null | undefined): number {
  if (!timestamp) return Infinity;
  const lastSeen = new Date(timestamp).getTime();
  return Date.now() - lastSeen;
}

function getCurrentStatus(ageMs: number): 'healthy' | 'warning' | 'critical' | 'offline' {
  if (ageMs === Infinity) return 'offline';
  if (ageMs < STALE_THRESHOLD_MS) return 'healthy';
  if (ageMs < DEAD_THRESHOLD_MS) return 'warning';
  return 'critical';
}

function predictHealth(
  agentId: string,
  agentName: string,
  agentType: 'research' | 'halo',
  lastSeen: string | null,
  status?: string,
  nudgeCount?: number,
  waitingDetectedAt?: string | null,
  group?: string,
  emoji?: string,
  color?: string
): HealthPrediction {
  const signals: string[] = [];
  let failureProbability = 0;
  let timeToFailure: number | null = null;

  const ageMs = calculateAgeMs(lastSeen);
  const currentStatus = getCurrentStatus(ageMs);

  // Factor 1: Age-based risk
  if (currentStatus === 'offline') {
    signals.push('Agent offline (no recent heartbeat)');
    failureProbability += 0.1; // Low risk if never started
  } else if (ageMs > STALE_THRESHOLD_MS) {
    const staleDuration = ageMs - STALE_THRESHOLD_MS;
    const timeToDeadMs = DEAD_THRESHOLD_MS - ageMs;

    if (timeToDeadMs > 0) {
      signals.push(`Stale for ${Math.round(staleDuration / 1000)}s`);
      failureProbability += 0.3;
      timeToFailure = Math.round(timeToDeadMs / 1000);
    } else {
      signals.push(`Dead for ${Math.round((ageMs - DEAD_THRESHOLD_MS) / 1000)}s`);
      failureProbability += 0.8;
    }
  }

  // Factor 2: Nudge count
  if (nudgeCount !== undefined && nudgeCount > 0) {
    if (nudgeCount >= 3) {
      signals.push(`High nudge count (${nudgeCount})`);
      failureProbability += 0.2;
    } else {
      signals.push(`${nudgeCount} nudge(s)`);
      failureProbability += 0.05 * nudgeCount;
    }
  }

  // Factor 3: Stuck detection
  if (waitingDetectedAt) {
    const stuckDuration = calculateAgeMs(waitingDetectedAt);
    signals.push(`Waiting for input (${Math.round(stuckDuration / 1000)}s)`);
    if (stuckDuration > 180000) {
      failureProbability += 0.4;
    } else if (stuckDuration > 60000) {
      failureProbability += 0.2;
    }
  }

  // Factor 4: Status string
  if (status === 'stale') {
    failureProbability += 0.15;
  } else if (status === 'dead') {
    failureProbability += 0.5;
    timeToFailure = 0;
  }

  // Normalize
  failureProbability = Math.min(1, Math.max(0, failureProbability));

  // Predicted status
  let predictedStatus: 'healthy' | 'warning' | 'critical';
  if (failureProbability < 0.2) {
    predictedStatus = 'healthy';
  } else if (failureProbability < 0.5) {
    predictedStatus = 'warning';
  } else {
    predictedStatus = 'critical';
  }

  // Confidence
  let confidence = 0.7;
  if (ageMs < 60000) confidence += 0.2;
  if (nudgeCount !== undefined) confidence += 0.05;
  if (waitingDetectedAt !== undefined) confidence += 0.05;
  confidence = Math.min(1, confidence);

  // Recommendation
  let recommendation: string;
  if (failureProbability > 0.7) {
    recommendation = 'CRITICAL: Immediate intervention needed';
  } else if (failureProbability > 0.4) {
    recommendation = 'WARNING: Monitor closely';
  } else if (failureProbability > 0.2) {
    recommendation = 'CAUTION: Minor issues detected';
  } else if (currentStatus === 'offline') {
    recommendation = 'OFFLINE: Agent not running';
  } else {
    recommendation = 'HEALTHY: Operating normally';
  }

  return {
    agentId,
    agentName,
    agentType,
    group,
    currentStatus,
    predictedStatus,
    failureProbability: Math.round(failureProbability * 100) / 100,
    timeToFailure,
    confidence: Math.round(confidence * 100) / 100,
    signals,
    recommendation,
    emoji,
    color,
  };
}

function getResearchAgentPredictions(): HealthPrediction[] {
  const predictions: HealthPrediction[] = [];

  for (const agent of RESEARCH_AGENTS) {
    const statusFile = path.join(OVERNIGHT_DIR, `terminal_${agent.terminal}_status.json`);
    const statusData = readJsonFile(statusFile) as {
      status?: string;
      launchedAt?: string;
    } | null;

    predictions.push(predictHealth(
      agent.id,
      agent.name,
      'research',
      statusData?.launchedAt || null,
      statusData?.status,
      undefined,
      undefined,
      agent.group,
      agent.emoji,
      agent.color
    ));
  }

  return predictions;
}

function getHaloAgentPredictions(): HealthPrediction[] {
  const predictions: HealthPrediction[] = [];
  const heartbeatFile = path.join(DATA_DIR, 'heartbeat-status.json');
  const heartbeatData = readJsonFile(heartbeatFile) as {
    agents?: Record<string, {
      lastSeen?: string;
      status?: string;
      nudgeCount?: number;
      waitingDetectedAt?: string | null;
    }>;
  } | null;

  for (const agent of HALO_AGENTS) {
    const agentData = heartbeatData?.agents?.[agent.id];

    predictions.push(predictHealth(
      agent.id,
      agent.name,
      'halo',
      agentData?.lastSeen || null,
      agentData?.status,
      agentData?.nudgeCount,
      agentData?.waitingDetectedAt,
      undefined,
      agent.emoji,
      agent.color
    ));
  }

  return predictions;
}

// ============================================================================
// API Handler
// ============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    const researchPredictions = getResearchAgentPredictions();
    const haloPredictions = getHaloAgentPredictions();

    const allPredictions = [...researchPredictions, ...haloPredictions];

    // Sort by failure probability (highest first)
    allPredictions.sort((a, b) => b.failureProbability - a.failureProbability);

    // Calculate summary
    const summary = {
      total: allPredictions.length,
      healthy: allPredictions.filter(p => p.predictedStatus === 'healthy').length,
      warning: allPredictions.filter(p => p.predictedStatus === 'warning').length,
      critical: allPredictions.filter(p => p.predictedStatus === 'critical').length,
      offline: allPredictions.filter(p => p.currentStatus === 'offline').length,
      systemHealthScore: 0,
    };

    // System health score (0-100)
    const activeAgents = allPredictions.filter(p => p.currentStatus !== 'offline');
    if (activeAgents.length > 0) {
      const healthyCount = activeAgents.filter(p => p.predictedStatus === 'healthy').length;
      const warningCount = activeAgents.filter(p => p.predictedStatus === 'warning').length;
      summary.systemHealthScore = Math.round(((healthyCount * 1 + warningCount * 0.5) / activeAgents.length) * 100);
    } else {
      summary.systemHealthScore = 100; // No agents running = no issues
    }

    return NextResponse.json({
      success: true,
      predictions: allPredictions,
      research: researchPredictions,
      halo: haloPredictions,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Agent Health API] Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
