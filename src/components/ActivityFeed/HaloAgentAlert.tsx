'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { RefreshCw, Wrench, X, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import styles from './HaloAgentAlert.module.css';

interface AgentIssue {
  agent: string;
  status: 'dead' | 'error' | 'jira_fail' | 'stale';
  message: string;
  since: string;
  lastTask?: string;
}

interface HaloAlertProps {
  watchdogPort?: number;
}

const AGENT_META: Record<string, { avatar: string; role: string; color: string }> = {
  chief:   { avatar: '/avatars/halo/chief.png',   role: 'COO',       color: '#6B8E23' },
  arbiter: { avatar: '/avatars/halo/arbiter.png', role: 'QA Lead',   color: '#8B4513' },
  ops:     { avatar: '/avatars/halo/ops.png',     role: 'SRE',       color: '#DAA520' },
  hunter:  { avatar: '/avatars/halo/hunter.png',  role: 'Security',  color: '#8A2BE2' },
  cortana: { avatar: '/avatars/halo/cortana.png', role: 'Research',  color: '#6495ED' },
  scout:   { avatar: '/avatars/halo/scout.png',   role: 'Strategy',  color: '#2E8B57' },
};

function timeAgo(iso: string): string {
  if (!iso) return 'unknown';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

export default function HaloAgentAlert({ watchdogPort = 3002 }: HaloAlertProps) {
  const [issues, setIssues] = useState<AgentIssue[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [watchdogOnline, setWatchdogOnline] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      // Try dashboard API first (proxies to watchdog)
      const res = await fetch('/api/agents/halo');
      if (!res.ok) throw new Error('API down');
      const data = await res.json();

      setWatchdogOnline(data.watchdog?.running ?? false);

      const newIssues: AgentIssue[] = [];
      const agents = data.agents || {};

      for (const [id, agent] of Object.entries(agents) as [string, any][]) {
        if (agent.status === 'dead') {
          newIssues.push({
            agent: id,
            status: 'dead',
            message: `Session crashed or heartbeat missing`,
            since: agent.staleSince || agent.lastHeartbeat || new Date().toISOString(),
            lastTask: agent.lastTask,
          });
        } else if (agent.status === 'error') {
          newIssues.push({
            agent: id,
            status: 'error',
            message: agent.lastTask || 'Unknown error',
            since: agent.lastHeartbeat || new Date().toISOString(),
            lastTask: agent.lastTask,
          });
        }
      }

      setIssues(newIssues);
    } catch {
      setWatchdogOnline(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const t = setInterval(fetchStatus, 15_000);
    return () => clearInterval(t);
  }, [fetchStatus]);

  const handleRestart = useCallback(async (agentId: string) => {
    setActionLoading(`restart-${agentId}`);
    try {
      await fetch('/api/agents/halo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart', agent: agentId }),
      });
      // Remove from issues after restart
      setIssues(prev => prev.filter(i => i.agent !== agentId));
    } catch { /* watchdog handles it */ }
    finally { setActionLoading(null); }
  }, []);

  const handleRestartAll = useCallback(async () => {
    setActionLoading('restart-all');
    try {
      await fetch('/api/agents/halo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart-all' }),
      });
      setIssues([]);
    } catch {}
    finally { setActionLoading(null); }
  }, []);

  const handleDismiss = (agentId: string) => {
    setDismissed(prev => new Set([...prev, agentId]));
  };

  // Filter out dismissed alerts
  const activeIssues = issues.filter(i => !dismissed.has(i.agent));

  // Nothing to show
  if (activeIssues.length === 0) return null;

  return (
    <div className={styles.alertContainer}>
      {/* Pulsing red border glow */}
      <div className={styles.pulseGlow} />

      <div className={styles.alertInner}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.alertIcon}>
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className={styles.title}>
                HALO AGENT{activeIssues.length > 1 ? 'S' : ''} DOWN
              </h3>
              <p className={styles.subtitle}>
                {activeIssues.length} agent{activeIssues.length > 1 ? 's' : ''} need{activeIssues.length === 1 ? 's' : ''} attention
              </p>
            </div>
          </div>
          <div className={styles.headerRight}>
            <span className={`${styles.watchdogBadge} ${watchdogOnline ? styles.online : styles.offline}`}>
              {watchdogOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
              Watchdog {watchdogOnline ? 'ON' : 'OFF'}
            </span>
            {activeIssues.length > 1 && (
              <button
                className={styles.restartAllBtn}
                onClick={handleRestartAll}
                disabled={actionLoading === 'restart-all'}
              >
                <RefreshCw size={12} className={actionLoading === 'restart-all' ? styles.spinning : ''} />
                Restart All
              </button>
            )}
          </div>
        </div>

        {/* Agent issue cards */}
        <div className={styles.issueGrid}>
          {activeIssues.map(issue => {
            const meta = AGENT_META[issue.agent] || { emoji: '❓', role: 'Unknown', color: '#666' };
            const isLoading = actionLoading === `restart-${issue.agent}`;

            return (
              <div
                key={issue.agent}
                className={styles.issueCard}
                style={{ borderLeftColor: meta.color }}
              >
                {/* Dismiss X */}
                <button
                  className={styles.dismissBtn}
                  onClick={() => handleDismiss(issue.agent)}
                  aria-label={`Dismiss ${issue.agent} alert`}
                >
                  <X size={12} />
                </button>

                {/* Agent identity */}
                <div className={styles.agentRow}>
                  <div className={styles.agentAvatar} style={{ borderColor: meta.color }}>
                    <span className={styles.pulsingDot} />
                    <Image
                      src={meta.avatar}
                      alt={issue.agent}
                      width={36}
                      height={36}
                      className={styles.avatarImg}
                      unoptimized
                    />
                  </div>
                  <div className={styles.agentInfo}>
                    <span className={styles.agentName} style={{ color: meta.color }}>
                      {issue.agent.charAt(0).toUpperCase() + issue.agent.slice(1)}
                    </span>
                    <span className={styles.agentRole}>{meta.role}</span>
                  </div>
                  <span className={`${styles.statusBadge} ${styles[issue.status]}`}>
                    {issue.status.toUpperCase().replace('_', ' ')}
                  </span>
                </div>

                {/* Error message */}
                <p className={styles.errorMessage}>{issue.message}</p>
                <p className={styles.errorTime}>Down since {timeAgo(issue.since)}</p>

                {/* Action buttons */}
                <div className={styles.actionRow}>
                  <button
                    className={styles.restartBtn}
                    onClick={() => handleRestart(issue.agent)}
                    disabled={isLoading}
                  >
                    <RefreshCw size={13} className={isLoading ? styles.spinning : ''} />
                    {isLoading ? 'Restarting...' : 'Restart'}
                  </button>
                  <button
                    className={styles.fixBtn}
                    onClick={() => handleRestart(issue.agent)}
                    disabled={isLoading}
                  >
                    <Wrench size={13} />
                    Fix & Resume
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
