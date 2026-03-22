'use client';

import React from 'react';
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';
import styles from './RecentExecutions.module.css';

interface ExecutionSummary {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'success' | 'error' | 'running' | 'waiting';
  startedAt: string;
  stoppedAt?: string;
  duration?: number;
}

interface RecentExecutionsProps {
  executions: ExecutionSummary[];
  className?: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatDuration(ms?: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function StatusIcon({ status }: { status: ExecutionSummary['status'] }) {
  switch (status) {
    case 'success':
      return <CheckCircle size={14} className={styles.iconSuccess} />;
    case 'error':
      return <XCircle size={14} className={styles.iconError} />;
    case 'running':
      return <Loader2 size={14} className={styles.iconRunning} />;
    case 'waiting':
      return <Clock size={14} className={styles.iconWaiting} />;
  }
}

export function RecentExecutions({ executions, className }: RecentExecutionsProps) {
  if (executions.length === 0) {
    return (
      <div className={`${styles.container} ${className || ''}`}>
        <div className={styles.header}>
          <span className={styles.label}>RECENT EXECUTIONS</span>
        </div>
        <div className={styles.empty}>
          <span>No recent executions</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className || ''}`}>
      {/* Corner brackets */}
      <div className={`${styles.corner} ${styles.topLeft}`} />
      <div className={`${styles.corner} ${styles.topRight}`} />
      <div className={`${styles.corner} ${styles.bottomLeft}`} />
      <div className={`${styles.corner} ${styles.bottomRight}`} />

      <div className={styles.header}>
        <span className={styles.label}>RECENT EXECUTIONS</span>
        <span className={styles.count}>{executions.length}</span>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Status</th>
              <th>Workflow</th>
              <th>Started</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {executions.map((exec, idx) => (
              <tr
                key={exec.id}
                className={styles.row}
                data-status={exec.status}
                style={{ '--row-delay': `${idx * 0.03}s` } as React.CSSProperties}
              >
                <td className={styles.statusCell}>
                  <StatusIcon status={exec.status} />
                  <span className={`${styles.statusBadge} ${styles[exec.status]}`}>
                    {exec.status.toUpperCase()}
                  </span>
                </td>
                <td className={styles.workflowCell}>
                  <span className={styles.workflowName}>{exec.workflowName}</span>
                  <span className={styles.workflowId}>{exec.workflowId.slice(0, 8)}</span>
                </td>
                <td className={styles.timeCell}>
                  {formatTime(exec.startedAt)}
                </td>
                <td className={styles.durationCell}>
                  {exec.status === 'running' ? (
                    <span className={styles.runningIndicator}>
                      <Loader2 size={12} className={styles.spinnerSmall} />
                      Running
                    </span>
                  ) : (
                    formatDuration(exec.duration)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RecentExecutions;
