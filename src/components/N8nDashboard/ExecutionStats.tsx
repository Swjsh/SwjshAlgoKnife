'use client';

import React from 'react';
import { Activity, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import styles from './ExecutionStats.module.css';

interface ExecutionStatsProps {
  total24h: number;
  success: number;
  failed: number;
  running: number;
  avgDuration: number;
  successRate: number;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function ExecutionStats({
  total24h,
  success,
  failed,
  running,
  avgDuration,
  successRate,
}: ExecutionStatsProps) {
  const stats = [
    {
      label: 'Total (24h)',
      value: total24h.toString(),
      icon: Activity,
      color: 'hsl(188 95% 43%)',
      accent: 'cyan',
    },
    {
      label: 'Success Rate',
      value: `${successRate}%`,
      icon: TrendingUp,
      color: successRate >= 95 ? 'hsl(142 70% 50%)' : successRate >= 80 ? 'hsl(45 90% 50%)' : 'hsl(0 70% 50%)',
      accent: successRate >= 95 ? 'green' : successRate >= 80 ? 'yellow' : 'red',
    },
    {
      label: 'Successful',
      value: success.toString(),
      icon: CheckCircle,
      color: 'hsl(142 70% 50%)',
      accent: 'green',
    },
    {
      label: 'Failed',
      value: failed.toString(),
      icon: XCircle,
      color: failed > 0 ? 'hsl(0 70% 50%)' : 'hsl(220 10% 50%)',
      accent: failed > 0 ? 'red' : 'neutral',
    },
    {
      label: 'Running',
      value: running.toString(),
      icon: Activity,
      color: running > 0 ? 'hsl(271 77% 62%)' : 'hsl(220 10% 50%)',
      accent: running > 0 ? 'purple' : 'neutral',
    },
    {
      label: 'Avg Duration',
      value: formatDuration(avgDuration),
      icon: Clock,
      color: 'hsl(220 10% 60%)',
      accent: 'neutral',
    },
  ];

  return (
    <div className={styles.container}>
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className={styles.card} data-accent={stat.accent}>
            <div className={styles.cardCorner} />
            <div className={styles.iconWrapper} style={{ '--stat-color': stat.color } as React.CSSProperties}>
              <Icon size={18} />
            </div>
            <div className={styles.info}>
              <span className={styles.value} style={{ color: stat.color }}>{stat.value}</span>
              <span className={styles.label}>{stat.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ExecutionStats;
