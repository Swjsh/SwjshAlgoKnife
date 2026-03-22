'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './N8nHeartbeat.module.css';

interface N8nHealthData {
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

export function N8nHeartbeat() {
  const [health, setHealth] = useState<N8nHealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastPoll, setLastPoll] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/n8n/health');
      const data = await res.json();
      setHealth(data);
      setLastPoll(new Date());
    } catch {
      setHealth({ status: 'error', connected: false, message: 'Fetch failed' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const isConnected = health?.connected ?? false;
  const activeCount = health?.workflows?.active ?? 0;
  const totalCount = health?.workflows?.total ?? 0;
  const inactiveCount = health?.workflows?.inactive ?? 0;

  // Calculate health percentage for visual indicator
  const healthPercent = totalCount > 0 ? (activeCount / totalCount) * 100 : 0;

  return (
    <div className={styles.container} data-status={health?.status || 'loading'}>
      {/* Left: Animated Logo with Status Ring */}
      <div className={styles.logoSection}>
        <div className={styles.statusRing} data-connected={isConnected}>
          <div className={styles.pulseOuter} />
          <div className={styles.pulseInner} />
          <svg
            className={styles.logo}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* n8n hexagon */}
            <path
              d="M16 2L4 9v14l12 7 12-7V9L16 2z"
              fill={isConnected ? '#ff6d5a' : '#ef4444'}
              fillOpacity={0.95}
            />
            {/* Workflow nodes */}
            <circle cx="10" cy="16" r="2.5" fill="white" fillOpacity={0.95} />
            <circle cx="22" cy="16" r="2.5" fill="white" fillOpacity={0.95} />
            <circle cx="16" cy="10" r="2" fill="white" fillOpacity={0.7} />
            <circle cx="16" cy="22" r="2" fill="white" fillOpacity={0.7} />
            {/* Connection lines */}
            <line x1="12.5" y1="16" x2="19.5" y2="16" stroke="white" strokeWidth="1.5" strokeOpacity={0.9} />
            <line x1="16" y1="12" x2="16" y2="20" stroke="white" strokeWidth="1" strokeOpacity={0.6} />
          </svg>
        </div>
      </div>

      {/* Center: Stats Display */}
      <div className={styles.statsSection}>
        <div className={styles.headerRow}>
          <span className={styles.title}>n8n</span>
          <span className={styles.version}>{health?.version ? `v${health.version}` : ''}</span>
        </div>

        <div className={styles.workflowStats}>
          {/* Active workflows with green pulse */}
          <div className={styles.statItem} data-type="active">
            <div className={styles.statPulse} data-active={activeCount > 0} />
            <span className={styles.statValue}>{isLoading ? '-' : activeCount}</span>
            <span className={styles.statLabel}>ACTIVE</span>
          </div>

          {/* Separator */}
          <div className={styles.statDivider} />

          {/* Inactive workflows */}
          <div className={styles.statItem} data-type="inactive">
            <div className={styles.statIndicator} data-has-inactive={inactiveCount > 0} />
            <span className={styles.statValue}>{isLoading ? '-' : inactiveCount}</span>
            <span className={styles.statLabel}>PAUSED</span>
          </div>

          {/* Separator */}
          <div className={styles.statDivider} />

          {/* Total workflows */}
          <div className={styles.statItem} data-type="total">
            <span className={styles.statValue}>{isLoading ? '-' : totalCount}</span>
            <span className={styles.statLabel}>TOTAL</span>
          </div>
        </div>
      </div>

      {/* Right: Connection Status */}
      <div className={styles.statusSection}>
        <div className={styles.connectionBadge} data-connected={isConnected}>
          <div className={styles.connectionDot} />
          <span className={styles.connectionText}>
            {isLoading ? 'CHECKING' : isConnected ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </div>
        {/* Health bar */}
        <div className={styles.healthBar}>
          <div
            className={styles.healthFill}
            style={{ width: `${healthPercent}%` }}
            data-level={healthPercent >= 80 ? 'good' : healthPercent >= 50 ? 'warn' : 'low'}
          />
        </div>
      </div>
    </div>
  );
}
