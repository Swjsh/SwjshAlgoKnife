'use client';

import React from 'react';
import { RefreshCw, Workflow } from 'lucide-react';
import { useN8nDashboard } from '@/hooks/useN8nDashboard';
import {
  ConnectionStatus,
  ExecutionStats,
  WorkflowGrid,
  RecentExecutions,
} from '@/components/N8nDashboard';
import styles from './page.module.css';

export default function N8nDashboardPage() {
  const {
    connection,
    workflows,
    executions,
    stats,
    isLoading,
    lastUpdate,
    refresh,
    error,
  } = useN8nDashboard();

  const formatLastUpdate = (date: Date | null) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleIcon}>
            <Workflow size={20} />
          </div>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>n8n Control Center</h1>
            <span className={styles.subtitle}>Workflow Automation Dashboard</span>
          </div>
        </div>

        <div className={styles.headerRight}>
          {error && (
            <div className={styles.errorBadge}>
              {error}
            </div>
          )}

          <div className={styles.lastUpdate}>
            <span className={styles.lastUpdateLabel}>Last sync:</span>
            <span className={styles.lastUpdateTime}>{formatLastUpdate(lastUpdate)}</span>
          </div>

          <button
            className={styles.refreshBtn}
            onClick={refresh}
            disabled={isLoading}
            title="Refresh all data"
          >
            <RefreshCw size={16} className={isLoading ? styles.spinning : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Top Row: Connection + Stats */}
        <section className={styles.topRow}>
          <ConnectionStatus
            status={connection?.status || 'error'}
            connected={connection?.connected || false}
            version={connection?.version}
            lastChecked={connection?.lastChecked}
            message={connection?.message}
          />

          <div className={styles.statsWrapper}>
            <ExecutionStats
              total24h={stats.total24h}
              success={stats.success}
              failed={stats.failed}
              running={stats.running}
              avgDuration={stats.avgDuration}
              successRate={stats.successRate}
            />
          </div>
        </section>

        {/* Bottom Row: Workflows + Executions side-by-side */}
        <div className={styles.bottomRow}>
          <section className={styles.workflowSection}>
            <WorkflowGrid workflows={workflows} />
          </section>

          <section className={styles.executionsSection}>
            <RecentExecutions executions={executions} />
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <span className={styles.footerText}>
          Secure read-only dashboard • No command execution
        </span>
        <span className={styles.footerDivider}>|</span>
        <span className={styles.footerText}>
          Data refreshes automatically every 15-60 seconds
        </span>
      </footer>
    </div>
  );
}
