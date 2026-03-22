"use client";

import React, { useState, useEffect, useCallback } from "react";
import styles from "./AutoResearchControl.module.css";
import { RESEARCH_AGENT_DEFINITIONS, type ResearchAgentState } from "@/hooks/useResearchAgents";

// Type for agent definition (without runtime state)
type AgentDefinition = Omit<ResearchAgentState, 'status' | 'logs' | 'lastActivity'>;

interface SessionStatus {
  running: boolean;
  sessionId: string | null;
  status: string;
  group: 'group1' | 'group2' | 'both' | null;
  group1Running: boolean;
  group2Running: boolean;
  terminalsGroup1: number;
  terminalsGroup2: number;
  terminalsLaunched: number;
  elapsedMs: number;
  evalScoreBefore: number | null;
  evalScoreAfter: number | null;
}

interface AutoResearchControlProps {
  onStatusChange?: (status: SessionStatus | null) => void;
}

// Agent definitions for the grid
const AGENTS: AgentDefinition[] = Object.values(RESEARCH_AGENT_DEFINITIONS).sort(
  (a, b) => a.terminalNumber - b.terminalNumber
);

export default function AutoResearchControl({ onStatusChange }: AutoResearchControlProps) {
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [selectedTerminals, setSelectedTerminals] = useState<Set<number>>(new Set());
  const [isLaunching, setIsLaunching] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/research/overnight');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        onStatusChange?.(data);
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  }, [onStatusChange]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Toggle a single terminal
  const toggleTerminal = (terminalNum: number) => {
    setSelectedTerminals(prev => {
      const next = new Set(prev);
      if (next.has(terminalNum)) {
        next.delete(terminalNum);
      } else {
        next.add(terminalNum);
      }
      return next;
    });
  };

  // Quick select functions
  const selectGroup1 = () => setSelectedTerminals(new Set([1, 2, 3, 4]));
  const selectGroup2 = () => setSelectedTerminals(new Set([5, 6, 7, 8]));
  const selectAll = () => setSelectedTerminals(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
  const clearAll = () => setSelectedTerminals(new Set());

  // Launch selected terminals
  const launchSelected = async () => {
    if (selectedTerminals.size === 0) {
      setLastAction('Select at least 1 agent');
      setTimeout(() => setLastAction(null), 3000);
      return;
    }

    setIsLaunching(true);
    setLastAction(`Launching ${selectedTerminals.size} agent(s)...`);

    try {
      const res = await fetch('/api/research/overnight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'launch-specific',
          terminals: Array.from(selectedTerminals).sort((a, b) => a - b),
        }),
      });

      const data = await res.json();

      if (data.success) {
        setLastAction(`${data.terminalsLaunched} agent(s) launched!`);
        fetchStatus();
      } else {
        setLastAction(`Error: ${data.error}`);
      }
    } catch (err) {
      setLastAction(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setIsLaunching(false);
      setTimeout(() => setLastAction(null), 3000);
    }
  };

  // Stop all agents
  const stopAll = async () => {
    setIsStopping(true);
    setLastAction('Stopping...');

    try {
      const res = await fetch('/api/research/overnight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });

      const data = await res.json();

      if (data.success) {
        setLastAction('Stop signal sent');
        fetchStatus();
      } else {
        setLastAction(`Error: ${data.error}`);
      }
    } catch (err) {
      setLastAction(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setIsStopping(false);
      setTimeout(() => setLastAction(null), 3000);
    }
  };

  const formatElapsed = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const totalRunning = (status?.terminalsGroup1 || 0) + (status?.terminalsGroup2 || 0);
  const selectedCount = selectedTerminals.size;

  return (
    <div className={styles.controlPanel}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerTitle}>Select Agents to Launch</span>
        <span className={styles.headerHint}>Click agents below, then press Launch</span>
      </div>

      {/* Agent Selection Grid */}
      <div className={styles.agentGrid}>
        {AGENTS.map((agent) => {
          const isSelected = selectedTerminals.has(agent.terminalNumber);
          const isGroup1 = agent.terminalNumber <= 4;

          return (
            <button
              key={agent.id}
              className={`${styles.agentToggle} ${isSelected ? styles.selected : ''}`}
              data-group={isGroup1 ? 'group1' : 'group2'}
              onClick={() => toggleTerminal(agent.terminalNumber)}
              disabled={isLaunching}
              title={`Click to select ${agent.name} (Terminal ${agent.terminalNumber})`}
            >
              <span className={styles.agentEmoji}>{agent.emoji}</span>
              <span className={styles.agentNum}>{agent.terminalNumber}</span>
              <span className={styles.agentName}>{agent.name.replace('_', ' ')}</span>
              <span
                className={styles.agentDot}
                style={{ backgroundColor: agent.color }}
              />
            </button>
          );
        })}
      </div>

      {/* Quick Select Row */}
      <div className={styles.quickSelectRow}>
        <button
          className={styles.quickBtn}
          onClick={selectGroup1}
          disabled={isLaunching}
        >
          Group 1
        </button>
        <button
          className={styles.quickBtn}
          onClick={selectGroup2}
          disabled={isLaunching}
        >
          Group 2
        </button>
        <button
          className={styles.quickBtn}
          onClick={selectAll}
          disabled={isLaunching}
        >
          All 8
        </button>
        <button
          className={`${styles.quickBtn} ${styles.clearBtn}`}
          onClick={clearAll}
          disabled={isLaunching || selectedCount === 0}
        >
          Clear
        </button>
      </div>

      {/* Action Bar */}
      <div className={styles.actionBar}>
        {/* Left: Selection count */}
        <div className={styles.selectionInfo}>
          {selectedCount > 0 ? (
            <span className={styles.selectedCount}>{selectedCount} selected</span>
          ) : (
            <span className={styles.noneSelected}>Select agents above</span>
          )}
        </div>

        {/* Center: Status */}
        <div className={styles.statusSection}>
          {status?.running ? (
            <>
              <span className={styles.runningIndicator} />
              <span className={styles.statusText}>
                {totalRunning} running • {formatElapsed(status.elapsedMs)}
              </span>
            </>
          ) : lastAction ? (
            <span className={styles.actionText}>{lastAction}</span>
          ) : (
            <span className={styles.idleText}>Ready</span>
          )}
        </div>

        {/* Right: Buttons */}
        <div className={styles.actionButtons}>
          {status?.running && (
            <button
              className={styles.stopBtn}
              onClick={stopAll}
              disabled={isStopping}
            >
              {isStopping ? 'Stopping...' : 'Stop All'}
            </button>
          )}
          <button
            className={styles.launchBtn}
            onClick={launchSelected}
            disabled={isLaunching || selectedCount === 0}
          >
            {isLaunching ? 'Launching...' : `Launch (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}
