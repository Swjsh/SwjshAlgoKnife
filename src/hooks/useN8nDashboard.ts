'use client';

import { useState, useEffect, useCallback } from 'react';

// Types from API routes
interface WorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  category: 'system' | 'integration' | 'automation' | 'manual';
}

interface ExecutionSummary {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'success' | 'error' | 'running' | 'waiting';
  startedAt: string;
  stoppedAt?: string;
  duration?: number;
}

interface ExecutionStats {
  total24h: number;
  success: number;
  failed: number;
  running: number;
  avgDuration: number;
  successRate: number;
}

interface ConnectionStatus {
  status: 'healthy' | 'degraded' | 'error';
  connected: boolean;
  version?: string;
  workflows?: {
    total: number;
    active: number;
    inactive: number;
  };
  lastChecked?: string;
  message?: string;
}

export interface UseN8nDashboardReturn {
  connection: ConnectionStatus | null;
  workflows: WorkflowSummary[];
  executions: ExecutionSummary[];
  stats: ExecutionStats;
  isLoading: boolean;
  lastUpdate: Date | null;
  refresh: () => void;
  error: string | null;
}

const DEFAULT_STATS: ExecutionStats = {
  total24h: 0,
  success: 0,
  failed: 0,
  running: 0,
  avgDuration: 0,
  successRate: 100,
};

export function useN8nDashboard(): UseN8nDashboardReturn {
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [stats, setStats] = useState<ExecutionStats>(DEFAULT_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/n8n/health');
      const data = await res.json();
      setConnection(data);
      if (data.message) {
        setError(data.message);
      }
    } catch (err) {
      setConnection({ status: 'error', connected: false, message: 'Failed to fetch health' });
      setError(err instanceof Error ? err.message : 'Connection error');
    }
  }, []);

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch('/api/n8n/workflows');
      const data = await res.json();
      setWorkflows(data.workflows || []);
      if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workflows');
    }
  }, []);

  const fetchExecutions = useCallback(async () => {
    try {
      const res = await fetch('/api/n8n/executions');
      const data = await res.json();
      setExecutions(data.executions || []);
      setStats(data.stats || DEFAULT_STATS);
      if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch executions');
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    await Promise.all([fetchHealth(), fetchWorkflows(), fetchExecutions()]);
    setLastUpdate(new Date());
    setIsLoading(false);
  }, [fetchHealth, fetchWorkflows, fetchExecutions]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Polling intervals
  useEffect(() => {
    // Health: every 30 seconds
    const healthInterval = setInterval(fetchHealth, 30000);
    // Workflows: every 60 seconds
    const workflowsInterval = setInterval(fetchWorkflows, 60000);
    // Executions: every 15 seconds (more frequent for real-time feel)
    const executionsInterval = setInterval(fetchExecutions, 15000);

    return () => {
      clearInterval(healthInterval);
      clearInterval(workflowsInterval);
      clearInterval(executionsInterval);
    };
  }, [fetchHealth, fetchWorkflows, fetchExecutions]);

  return {
    connection,
    workflows,
    executions,
    stats,
    isLoading,
    lastUpdate,
    refresh,
    error,
  };
}
