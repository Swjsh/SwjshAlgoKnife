'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Play, Square, Activity, Wifi, WifiOff, Rocket } from 'lucide-react';
import HaloAgentSelector, { HALO_AGENTS } from './HaloAgentSelector';
import HaloTerminalCard from './HaloTerminalCard';
import styles from './HaloControlPanel.module.css';

// Type definitions for API response
interface Agent {
  name: string;
  role: string;
  status: 'online' | 'dead' | 'idle';
  lastHeartbeat: string;
  lastTask: string;
  cycleCount: number;
  staleSince?: string;
  sessionId: string;
}

interface Watchdog {
  running: boolean;
  port: number;
}

interface SystemStatus {
  totalOnline: number;
  totalDead: number;
  uptime: number | string;
}

interface HaloResponse {
  agents: Record<string, Agent>;
  watchdog: Watchdog;
  system: SystemStatus;
}

interface LogEntry {
  id: string;
  timestamp: string;
  text: string;
  level: 'info' | 'success' | 'warn' | 'error';
}

export default function HaloControlPanel() {
  const [data, setData] = useState<HaloResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [agentLogs, setAgentLogs] = useState<Record<string, LogEntry[]>>({});

  // Fetch agent status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/agents/halo');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Perform an action (restart/stop/restart-all/stop-all)
  const performAction = useCallback(
    async (action: string, agentId?: string) => {
      const key = agentId ? `${action}-${agentId}` : action;
      setActionLoading(key);
      try {
        const payload: Record<string, string> = { action };
        if (agentId) payload.agent = agentId;

        const response = await fetch('/api/agents/halo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await fetchStatus();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed');
      } finally {
        setActionLoading(null);
      }
    },
    [fetchStatus]
  );

  // Launch selected agents
  const launchSelected = useCallback(async () => {
    if (selected.size === 0) return;
    setActionLoading('launch-selected');

    try {
      // Launch each selected agent sequentially
      for (const agentId of selected) {
        await performAction('restart', agentId);
      }
    } finally {
      setActionLoading(null);
    }
  }, [selected, performAction]);

  // Send command to agent (placeholder - needs WebSocket integration)
  const sendCommand = useCallback((agentId: string, command: string) => {
    // Add to local logs for immediate feedback
    const newLog: LogEntry = {
      id: `cmd-${Date.now()}`,
      timestamp: new Date().toISOString(),
      text: `> ${command}`,
      level: 'info',
    };
    setAgentLogs(prev => ({
      ...prev,
      [agentId]: [...(prev[agentId] || []), newLog],
    }));

    // TODO: Send via WebSocket or API
    console.log(`[HALO] Command to ${agentId}: ${command}`);
  }, []);

  // Get agent status map for selector
  const agentStatusMap = data?.agents
    ? Object.fromEntries(
        Object.entries(data.agents).map(([id, agent]) => [id, agent.status])
      )
    : {};

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>Loading HALO system...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          {error ? `Error: ${error}` : 'No data received'}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header Bar */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <div className={styles.title}>HALO COMMAND CENTER</div>
          <div className={styles.subtitle}>
            Select agents below, then Launch to deploy
          </div>
        </div>

        <div className={styles.headerRight}>
          {/* Watchdog Status */}
          <div className={`${styles.watchdogStatus} ${data.watchdog.running ? styles.online : styles.offline}`}>
            {data.watchdog.running ? (
              <>
                <Wifi size={14} />
                <span>Watchdog Online</span>
              </>
            ) : (
              <>
                <WifiOff size={14} />
                <span>Watchdog Offline</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Agent Selector */}
      <div className={styles.selectorSection}>
        <HaloAgentSelector
          selected={selected}
          onSelectionChange={setSelected}
          agentStatus={agentStatusMap}
          disabled={actionLoading !== null}
        />
      </div>

      {/* Action Bar */}
      <div className={styles.actionBar}>
        <div className={styles.actionLeft}>
          <span className={styles.selectionCount}>
            {selected.size > 0 ? `${selected.size} selected` : 'Select agents above'}
          </span>
        </div>

        <div className={styles.actionCenter}>
          <span className={styles.systemStats}>
            <Activity size={12} />
            <span className={styles.statOnline}>{data.system.totalOnline} online</span>
            <span className={styles.statDivider}>·</span>
            <span className={styles.statDead}>{data.system.totalDead} dead</span>
          </span>
        </div>

        <div className={styles.actionRight}>
          <button
            className={`${styles.actionBtn} ${styles.launchBtn}`}
            onClick={launchSelected}
            disabled={selected.size === 0 || actionLoading !== null}
          >
            <Rocket size={14} />
            Launch ({selected.size})
          </button>

          <button
            className={`${styles.actionBtn} ${styles.launchAllBtn}`}
            onClick={() => performAction('restart-all')}
            disabled={actionLoading === 'restart-all'}
          >
            <Play size={14} />
            All
          </button>

          <button
            className={`${styles.actionBtn} ${styles.stopAllBtn}`}
            onClick={() => performAction('stop-all')}
            disabled={actionLoading === 'stop-all'}
          >
            <Square size={14} />
            Stop
          </button>
        </div>
      </div>

      {/* Terminal Grid */}
      <div className={styles.terminalGrid}>
        {HALO_AGENTS.map((agentDef) => {
          const agent = data.agents[agentDef.id];
          if (!agent) return null;

          return (
            <HaloTerminalCard
              key={agentDef.id}
              agentId={agentDef.id}
              emoji={agentDef.emoji}
              name={agent.name || agentDef.name}
              accent={agentDef.accent}
              status={agent.status}
              lastHeartbeat={agent.lastHeartbeat}
              lastTask={agent.lastTask}
              cycleCount={agent.cycleCount}
              logs={agentLogs[agentDef.id] || []}
              onStart={(id) => performAction('restart', id)}
              onStop={(id) => performAction('stop', id)}
              onRestart={(id) => performAction('restart', id)}
              onSendCommand={sendCommand}
              isActionLoading={actionLoading?.includes(agentDef.id) ?? false}
            />
          );
        })}
      </div>
    </div>
  );
}
