/**
 * Unified Agents API Endpoint
 * ===========================
 * Returns status for ALL agents (Research + HALO + Trading) in a single view.
 *
 * GET /api/agents/unified
 *   Returns: Array of all agents with normalized status
 *
 * GET /api/agents/unified?type=research|halo|trading
 *   Returns: Filtered by agent type
 *
 * Part of Research Agent Audit System — achieving 95%+ Unified Agent View score
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface UnifiedAgent {
  id: string;
  name: string;
  type: 'research' | 'halo' | 'trading';
  group?: string;
  terminal?: number;
  status: 'online' | 'busy' | 'stale' | 'dead' | 'offline' | 'unknown';
  lastSeen: string | null;
  lastActivity: string | null;
  nudgeCount?: number;
  waitingForInput?: boolean;
  emoji?: string;
  color?: string;
  focus?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DATA_DIR = path.join(process.cwd(), 'data');

// Research agents (8 total)
const RESEARCH_AGENTS = [
  { id: 'improver', name: 'IMPROVER', terminal: 1, group: 'group1', emoji: '🔧', color: '#06b6d4', focus: 'Code quality' },
  { id: 'backtester', name: 'BACKTESTER', terminal: 2, group: 'group1', emoji: '📊', color: '#22c55e', focus: 'Strategy validation' },
  { id: 'researcher', name: 'RESEARCHER', terminal: 3, group: 'group1', emoji: '🔍', color: '#a855f7', focus: 'External patterns' },
  { id: 'brain_updater', name: 'BRAIN_UPDATER', terminal: 4, group: 'group1', emoji: '🧠', color: '#f59e0b', focus: 'Knowledge currency' },
  { id: 'security_auditor', name: 'SECURITY_AUDITOR', terminal: 5, group: 'group2', emoji: '🛡️', color: '#ef4444', focus: 'Security audit' },
  { id: 'integration_tester', name: 'INTEGRATION_TESTER', terminal: 6, group: 'group2', emoji: '🧪', color: '#3b82f6', focus: 'API contracts' },
  { id: 'intel_aggregator', name: 'INTEL_AGGREGATOR', terminal: 7, group: 'group2', emoji: '📡', color: '#8b5cf6', focus: 'Oracle data' },
  { id: 'devops_optimizer', name: 'DEVOPS_OPTIMIZER', terminal: 8, group: 'group2', emoji: '⚙️', color: '#14b8a6', focus: 'CI/CD ops' },
];

// HALO agents (6 total)
const HALO_AGENTS = [
  { id: 'chief', name: 'CHIEF', emoji: '👑', color: '#fbbf24', focus: 'Command & coordination' },
  { id: 'hunter', name: 'HUNTER', emoji: '🐛', color: '#ef4444', focus: 'INFRA tasks' },
  { id: 'ops', name: 'OPS', emoji: '🛡️', color: '#22c55e', focus: 'SCRUM tasks' },
  { id: 'scout', name: 'SCOUT', emoji: '🐕', color: '#06b6d4', focus: 'BACK research' },
  { id: 'arbiter', name: 'ARBITER', emoji: '⚖️', color: '#a855f7', focus: 'Quality gates' },
  { id: 'cortana', name: 'CORTANA', emoji: '🧠', color: '#ec4899', focus: 'Pattern learning' },
];

// Trading agents (5 total)
const TRADING_AGENTS = [
  { id: 'spx_sniper', name: 'SPX Sniper', emoji: '🎯', color: '#ef4444', focus: '0DTE options' },
  { id: 'boba_trades', name: 'Boba Trades', emoji: '🍵', color: '#f59e0b', focus: 'Options zones' },
  { id: 'sterling_fx', name: 'Sterling FX', emoji: '💷', color: '#06b6d4', focus: 'Forex VWAP' },
  { id: 'bitcoin_bob', name: 'Bitcoin Bob', emoji: '₿', color: '#f97316', focus: 'Crypto squeeze' },
  { id: 'pivot_pete', name: 'Pivot Pete', emoji: '📈', color: '#22c55e', focus: 'Futures pivots' },
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

function getStatusFromLastSeen(lastSeenStr: string | null): UnifiedAgent['status'] {
  if (!lastSeenStr) return 'unknown';

  const lastSeen = new Date(lastSeenStr);
  const now = new Date();
  const ageMs = now.getTime() - lastSeen.getTime();

  if (ageMs < 30000) return 'online';      // < 30 seconds
  if (ageMs < 180000) return 'stale';      // < 3 minutes
  if (ageMs < 600000) return 'dead';       // < 10 minutes
  return 'offline';
}

function getResearchAgentStatus(): UnifiedAgent[] {
  const agents: UnifiedAgent[] = [];
  const overnightDir = path.join(process.cwd(), '.claude', 'overnight');

  for (const agent of RESEARCH_AGENTS) {
    // Check terminal status file
    const statusFile = path.join(overnightDir, `terminal_${agent.terminal}_status.json`);
    const statusData = readJsonFile(statusFile) as { status?: string; launchedAt?: string } | null;

    let status: UnifiedAgent['status'] = 'offline';
    let lastSeen: string | null = null;

    if (statusData) {
      lastSeen = statusData.launchedAt || null;
      status = getStatusFromLastSeen(lastSeen);

      if (statusData.status === 'online') status = 'online';
      else if (statusData.status === 'busy') status = 'busy';
    }

    agents.push({
      id: agent.id,
      name: agent.name,
      type: 'research',
      group: agent.group,
      terminal: agent.terminal,
      status,
      lastSeen,
      lastActivity: lastSeen,
      emoji: agent.emoji,
      color: agent.color,
      focus: agent.focus,
    });
  }

  return agents;
}

function getHaloAgentStatus(): UnifiedAgent[] {
  const agents: UnifiedAgent[] = [];
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

    let status: UnifiedAgent['status'] = 'unknown';
    let lastSeen: string | null = null;
    let nudgeCount: number | undefined;
    let waitingForInput = false;

    if (agentData) {
      lastSeen = agentData.lastSeen || null;
      nudgeCount = agentData.nudgeCount;
      waitingForInput = agentData.waitingDetectedAt !== null && agentData.waitingDetectedAt !== undefined;

      // Map HALO status to unified status
      switch (agentData.status) {
        case 'alive': status = 'online'; break;
        case 'stale': status = 'stale'; break;
        case 'dead': status = 'dead'; break;
        default: status = getStatusFromLastSeen(lastSeen);
      }
    }

    agents.push({
      id: agent.id,
      name: agent.name,
      type: 'halo',
      status,
      lastSeen,
      lastActivity: lastSeen,
      nudgeCount,
      waitingForInput,
      emoji: agent.emoji,
      color: agent.color,
      focus: agent.focus,
    });
  }

  return agents;
}

function getTradingAgentStatus(): UnifiedAgent[] {
  const agents: UnifiedAgent[] = [];
  const healthFile = path.join(DATA_DIR, 'health_status.json');
  const healthData = readJsonFile(healthFile) as {
    trading_agents?: Record<string, {
      status?: string;
      last_heartbeat?: string;
    }>;
  } | null;

  for (const agent of TRADING_AGENTS) {
    const agentHealth = healthData?.trading_agents?.[agent.id];

    let status: UnifiedAgent['status'] = 'unknown';
    let lastSeen: string | null = null;

    if (agentHealth) {
      lastSeen = agentHealth.last_heartbeat || null;

      switch (agentHealth.status) {
        case 'HEALTHY': status = 'online'; break;
        case 'WARNING': status = 'stale'; break;
        case 'ALERT':
        case 'NOT_RUNNING': status = 'dead'; break;
        case 'WEEKEND_PAUSE': status = 'offline'; break;
        default: status = getStatusFromLastSeen(lastSeen);
      }
    }

    agents.push({
      id: agent.id,
      name: agent.name,
      type: 'trading',
      status,
      lastSeen,
      lastActivity: lastSeen,
      emoji: agent.emoji,
      color: agent.color,
      focus: agent.focus,
    });
  }

  return agents;
}

// ============================================================================
// API Handler
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type') as 'research' | 'halo' | 'trading' | null;

    let agents: UnifiedAgent[] = [];

    // Get agents based on filter
    if (!typeFilter || typeFilter === 'research') {
      agents.push(...getResearchAgentStatus());
    }
    if (!typeFilter || typeFilter === 'halo') {
      agents.push(...getHaloAgentStatus());
    }
    if (!typeFilter || typeFilter === 'trading') {
      agents.push(...getTradingAgentStatus());
    }

    // Calculate summary stats
    const summary = {
      total: agents.length,
      online: agents.filter(a => a.status === 'online').length,
      busy: agents.filter(a => a.status === 'busy').length,
      stale: agents.filter(a => a.status === 'stale').length,
      dead: agents.filter(a => a.status === 'dead').length,
      offline: agents.filter(a => a.status === 'offline' || a.status === 'unknown').length,
      byType: {
        research: agents.filter(a => a.type === 'research').length,
        halo: agents.filter(a => a.type === 'halo').length,
        trading: agents.filter(a => a.type === 'trading').length,
      },
    };

    return NextResponse.json({
      success: true,
      agents,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Unified Agents API] Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
