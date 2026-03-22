/**
 * useCommandCenter Hook
 * =====================
 * Aggregates data from audit scores, health predictions, and anomaly APIs.
 * Provides unified state for the Command Center dashboard.
 *
 * Part of Research Agent Audit Command Center
 */

import { useState, useEffect, useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

interface Criterion {
  name: string;
  met: boolean;
  points: number;
  maxPoints: number;
  details: string;
}

interface CategoryScore {
  category: string;
  name: string;
  score: number;
  maxScore: number;
  percentage: number;
  status: "PERFECT" | "EXCELLENT" | "GOOD" | "PARTIAL" | "WEAK" | "CRITICAL";
  criteria?: Criterion[];
}

interface AuditData {
  categories: CategoryScore[];
  composite: number;
  deploymentGatePassed: boolean;
  lowestCategory: string;
  lowestScore: number;
  timestamp: string;
}

interface HealthPrediction {
  agentId: string;
  agentName: string;
  agentType: "research" | "halo";
  group?: string;
  currentStatus: "healthy" | "warning" | "critical" | "offline";
  predictedStatus: "healthy" | "warning" | "critical";
  failureProbability: number;
  timeToFailure: number | null;
  confidence: number;
  signals: string[];
  recommendation: string;
  emoji?: string;
  color?: string;
}

interface HealthSummary {
  total: number;
  healthy: number;
  warning: number;
  critical: number;
  offline: number;
  systemHealthScore: number;
}

interface HealthData {
  predictions: HealthPrediction[];
  research: HealthPrediction[];
  halo: HealthPrediction[];
  summary: HealthSummary;
  timestamp: string;
}

interface Anomaly {
  type: "spike" | "drop" | "trend" | "pattern";
  severity: "low" | "medium" | "high";
  metric: string;
  description: string;
  value: number;
  baseline: number;
  deviation: number;
  timestamp: string;
}

interface CommandCenterState {
  audit: AuditData | null;
  health: HealthData | null;
  anomalies: Anomaly[];
  isLoading: boolean;
  error: string | null;
  lastRefresh: Date | null;
}

interface UseCommandCenterOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// ============================================================================
// Hook
// ============================================================================

export function useCommandCenter(options: UseCommandCenterOptions = {}) {
  const { autoRefresh = true, refreshInterval = 30000 } = options;

  const [state, setState] = useState<CommandCenterState>({
    audit: null,
    health: null,
    anomalies: [],
    isLoading: true,
    error: null,
    lastRefresh: null,
  });

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Fetch all data in parallel
      const [auditRes, healthRes, trendsRes] = await Promise.all([
        fetch("/api/audit/scores"),
        fetch("/api/agents/health"),
        fetch("/api/agents/trends"),
      ]);

      const [auditData, healthData, trendsData] = await Promise.all([
        auditRes.json(),
        healthRes.json(),
        trendsRes.json(),
      ]);

      // Extract anomalies from trends data
      const anomalies: Anomaly[] = [];
      if (trendsData.success && trendsData.anomalies) {
        for (const a of trendsData.anomalies) {
          anomalies.push({
            type: a.type || "pattern",
            severity: a.severity || "medium",
            metric: a.metric || "Unknown",
            description: a.description || "Anomaly detected",
            value: a.value || 0,
            baseline: a.baseline || 0,
            deviation: a.deviation || 0,
            timestamp: a.timestamp || new Date().toISOString(),
          });
        }
      }

      setState({
        audit: auditData.success ? {
          categories: auditData.categories || [],
          composite: auditData.composite || 0,
          deploymentGatePassed: auditData.deploymentGatePassed || false,
          lowestCategory: auditData.lowestCategory || "",
          lowestScore: auditData.lowestScore || 0,
          timestamp: auditData.timestamp || new Date().toISOString(),
        } : null,
        health: healthData.success ? {
          predictions: healthData.predictions || [],
          research: healthData.research || [],
          halo: healthData.halo || [],
          summary: healthData.summary || {
            total: 0,
            healthy: 0,
            warning: 0,
            critical: 0,
            offline: 0,
            systemHealthScore: 100,
          },
          timestamp: healthData.timestamp || new Date().toISOString(),
        } : null,
        anomalies,
        isLoading: false,
        error: null,
        lastRefresh: new Date(),
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: (err as Error).message,
      }));
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchData]);

  const dismissAnomaly = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      anomalies: prev.anomalies.filter((_, i) => i !== index),
    }));
  }, []);

  return {
    ...state,
    refresh: fetchData,
    dismissAnomaly,
  };
}

export type {
  CommandCenterState,
  AuditData,
  HealthData,
  HealthPrediction,
  Anomaly,
  CategoryScore,
  Criterion,
};
