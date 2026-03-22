/**
 * HaloAgentStatusBar Component
 * ============================
 * Displays HALO agent status in a compact bar format.
 * Shows alongside Research agents for unified view.
 *
 * Part of Research Agent Audit System — achieving 95%+ Unified Agent View score
 */

"use client";

import React, { useEffect, useState, useCallback } from "react";
import styles from "./HaloAgentStatusBar.module.css";

interface HaloAgent {
  id: string;
  name: string;
  status: "online" | "busy" | "stale" | "dead" | "offline" | "unknown";
  lastSeen: string | null;
  nudgeCount?: number;
  waitingForInput?: boolean;
  emoji?: string;
  color?: string;
  focus?: string;
}

interface HaloAgentStatusBarProps {
  refreshInterval?: number;
  compact?: boolean;
}

export default function HaloAgentStatusBar({
  refreshInterval = 10000,
  compact = false,
}: HaloAgentStatusBarProps) {
  const [agents, setAgents] = useState<HaloAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHaloAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/unified?type=halo");
      if (!res.ok) throw new Error("Failed to fetch HALO agents");

      const data = await res.json();
      if (data.success && data.agents) {
        setAgents(data.agents);
        setError(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHaloAgents();
    const interval = setInterval(fetchHaloAgents, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchHaloAgents, refreshInterval]);

  const onlineCount = agents.filter(
    (a) => a.status === "online" || a.status === "busy"
  ).length;
  const totalCount = agents.length;

  if (loading) {
    return (
      <div className={`${styles.container} ${compact ? styles.compact : ""}`}>
        <div className={styles.loading}>Loading HALO agents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.container} ${compact ? styles.compact : ""}`}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ""}`}>
      <div className={styles.header}>
        <span className={styles.label}>HALO AGENTS</span>
        <span className={styles.count}>
          <span className={styles.onlineCount}>{onlineCount}</span>
          <span className={styles.slash}>/</span>
          <span>{totalCount}</span>
        </span>
      </div>
      <div className={styles.agentGrid}>
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`${styles.agentPill} ${styles[agent.status]}`}
            title={`${agent.name}: ${agent.focus || "No focus"}\nStatus: ${agent.status}${agent.nudgeCount ? `\nNudges: ${agent.nudgeCount}` : ""}${agent.waitingForInput ? "\nWaiting for input" : ""}`}
          >
            <span className={styles.emoji}>{agent.emoji}</span>
            <span className={styles.agentName}>{agent.name}</span>
            <span
              className={styles.statusDot}
              data-status={agent.status}
            />
            {agent.waitingForInput && (
              <span className={styles.waitingIcon}>⏳</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
