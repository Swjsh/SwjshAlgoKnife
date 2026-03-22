/**
 * Health Predictor Module
 * =======================
 * Simple trend-based health prediction for agents.
 * Uses recent heartbeat patterns to predict likelihood of agent failure.
 *
 * Part of Research Agent Audit System — achieving 95%+ Agent Health Monitoring score
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface HealthPrediction {
  agentId: string;
  currentStatus: 'healthy' | 'warning' | 'critical';
  predictedStatus: 'healthy' | 'warning' | 'critical';
  failureProbability: number; // 0-1
  timeToFailure: number | null; // seconds, null if not predicted to fail
  confidence: number; // 0-1
  signals: string[];
  recommendation: string;
}

interface HeartbeatEntry {
  timestamp: string;
  status: string;
  nudgeCount?: number;
  waitingDetectedAt?: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const DATA_DIR = path.join(process.cwd(), 'data');
const HEARTBEAT_FILE = path.join(DATA_DIR, 'heartbeat-status.json');

// Thresholds
const STALE_THRESHOLD_MS = 30000; // 30 seconds
const DEAD_THRESHOLD_MS = 180000; // 3 minutes
const HIGH_NUDGE_COUNT = 3;
const STUCK_WARNING_MS = 60000; // 1 minute stuck = warning

// ============================================================================
// Helper Functions
// ============================================================================

function readHeartbeatStatus(): Record<string, HeartbeatEntry> | null {
  try {
    if (fs.existsSync(HEARTBEAT_FILE)) {
      const content = fs.readFileSync(HEARTBEAT_FILE, 'utf-8');
      const data = JSON.parse(content);
      return data.agents || {};
    }
  } catch {
    // File doesn't exist or invalid
  }
  return null;
}

function calculateAgeMs(timestamp: string | null | undefined): number {
  if (!timestamp) return Infinity;
  const lastSeen = new Date(timestamp).getTime();
  return Date.now() - lastSeen;
}

function getCurrentStatus(ageMs: number): 'healthy' | 'warning' | 'critical' {
  if (ageMs < STALE_THRESHOLD_MS) return 'healthy';
  if (ageMs < DEAD_THRESHOLD_MS) return 'warning';
  return 'critical';
}

// ============================================================================
// Prediction Functions
// ============================================================================

/**
 * Simple trend-based prediction using:
 * - Heartbeat age (time since last seen)
 * - Nudge count (higher = more issues)
 * - Stuck detection (waitingDetectedAt)
 * - Status transitions (alive → stale → dead pattern)
 */
export function predictAgentHealth(agentId: string, entry: HeartbeatEntry): HealthPrediction {
  const signals: string[] = [];
  let failureProbability = 0;
  let timeToFailure: number | null = null;

  // Factor 1: Heartbeat age
  const ageMs = calculateAgeMs(entry.timestamp);
  const currentStatus = getCurrentStatus(ageMs);

  if (ageMs > STALE_THRESHOLD_MS) {
    const staleDuration = ageMs - STALE_THRESHOLD_MS;
    const timeToDeadMs = DEAD_THRESHOLD_MS - ageMs;

    if (timeToDeadMs > 0) {
      signals.push(`Agent stale for ${Math.round(staleDuration / 1000)}s`);
      failureProbability += 0.3;
      timeToFailure = Math.round(timeToDeadMs / 1000);
    } else {
      signals.push(`Agent dead for ${Math.round((ageMs - DEAD_THRESHOLD_MS) / 1000)}s`);
      failureProbability += 0.8;
    }
  }

  // Factor 2: Nudge count
  const nudgeCount = entry.nudgeCount || 0;
  if (nudgeCount >= HIGH_NUDGE_COUNT) {
    signals.push(`High nudge count (${nudgeCount})`);
    failureProbability += 0.2;
  } else if (nudgeCount > 0) {
    signals.push(`${nudgeCount} nudge(s) sent`);
    failureProbability += 0.05 * nudgeCount;
  }

  // Factor 3: Stuck detection
  if (entry.waitingDetectedAt) {
    const stuckDuration = calculateAgeMs(entry.waitingDetectedAt);
    signals.push(`Agent waiting for input (${Math.round(stuckDuration / 1000)}s)`);

    if (stuckDuration > STUCK_WARNING_MS * 3) {
      failureProbability += 0.4;
    } else if (stuckDuration > STUCK_WARNING_MS) {
      failureProbability += 0.2;
    }
  }

  // Factor 4: Status pattern
  if (entry.status === 'stale') {
    signals.push('Status: stale (trending toward dead)');
    failureProbability += 0.15;

    // Estimate time to failure based on typical stale→dead duration
    if (timeToFailure === null) {
      timeToFailure = Math.round((DEAD_THRESHOLD_MS - ageMs) / 1000);
    }
  } else if (entry.status === 'dead') {
    signals.push('Status: dead (immediate attention needed)');
    failureProbability += 0.5;
    timeToFailure = 0;
  }

  // Normalize probability to 0-1
  failureProbability = Math.min(1, Math.max(0, failureProbability));

  // Determine predicted status
  let predictedStatus: 'healthy' | 'warning' | 'critical';
  if (failureProbability < 0.2) {
    predictedStatus = 'healthy';
  } else if (failureProbability < 0.5) {
    predictedStatus = 'warning';
  } else {
    predictedStatus = 'critical';
  }

  // Calculate confidence based on data quality
  let confidence = 0.7; // Base confidence
  if (ageMs < 60000) confidence += 0.2; // Recent data = higher confidence
  if (nudgeCount !== undefined) confidence += 0.05;
  if (entry.waitingDetectedAt !== undefined) confidence += 0.05;
  confidence = Math.min(1, confidence);

  // Generate recommendation
  let recommendation: string;
  if (failureProbability > 0.7) {
    recommendation = 'CRITICAL: Agent likely to fail. Consider manual intervention or restart.';
  } else if (failureProbability > 0.4) {
    recommendation = 'WARNING: Agent showing stress signals. Monitor closely.';
  } else if (failureProbability > 0.2) {
    recommendation = 'CAUTION: Minor issues detected. No immediate action needed.';
  } else {
    recommendation = 'HEALTHY: Agent operating normally.';
  }

  return {
    agentId,
    currentStatus,
    predictedStatus,
    failureProbability: Math.round(failureProbability * 100) / 100,
    timeToFailure,
    confidence: Math.round(confidence * 100) / 100,
    signals,
    recommendation,
  };
}

/**
 * Get predictions for all tracked agents
 */
export function getAllHealthPredictions(): HealthPrediction[] {
  const agents = readHeartbeatStatus();
  if (!agents) return [];

  const predictions: HealthPrediction[] = [];

  for (const [agentId, entry] of Object.entries(agents)) {
    predictions.push(predictAgentHealth(agentId, entry as HeartbeatEntry));
  }

  // Sort by failure probability (highest first)
  predictions.sort((a, b) => b.failureProbability - a.failureProbability);

  return predictions;
}

/**
 * Get summary health score for all agents
 */
export function getSystemHealthScore(): {
  score: number;
  healthy: number;
  warning: number;
  critical: number;
  predictions: HealthPrediction[];
} {
  const predictions = getAllHealthPredictions();

  let healthy = 0;
  let warning = 0;
  let critical = 0;

  for (const p of predictions) {
    if (p.predictedStatus === 'healthy') healthy++;
    else if (p.predictedStatus === 'warning') warning++;
    else critical++;
  }

  const total = predictions.length;
  const score = total > 0
    ? Math.round(((healthy * 1 + warning * 0.5 + critical * 0) / total) * 100)
    : 100;

  return { score, healthy, warning, critical, predictions };
}
