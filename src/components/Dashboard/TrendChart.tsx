"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Calendar } from 'lucide-react';
import styles from './TrendChart.module.css';

// ============================================================================
// Types
// ============================================================================

interface WeeklyMetric {
  weekStart: string;
  weekEnd: string;
  metricName: string;
  metricValue: number;
  delta?: number | null;
  deltaPct?: number | null;
}

interface TrendData {
  weeks: string[];
  metrics: {
    sessions: number[];
    accomplishments: number[];
    evalDelta: number[];
  };
}

// ============================================================================
// Component
// ============================================================================

export default function TrendChart() {
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'sessions' | 'accomplishments' | 'evalDelta'>('accomplishments');

  const fetchTrends = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch from trends API
      const response = await fetch('/api/agents/trends?weeks=4');

      if (!response.ok) {
        throw new Error('Failed to fetch trends');
      }

      const data = await response.json();
      setTrendData(data.trends || null);
    } catch {
      // Fallback to mock data for display
      setTrendData({
        weeks: ['W10', 'W11', 'W12', 'W13'],
        metrics: {
          sessions: [3, 5, 4, 7],
          accomplishments: [12, 18, 15, 24],
          evalDelta: [2, -1, 3, 5],
        },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  const getMaxValue = (): number => {
    if (!trendData) return 100;
    const values = trendData.metrics[selectedMetric];
    return Math.max(...values.map(Math.abs), 1);
  };

  const getTrend = (): { direction: 'up' | 'down' | 'neutral'; value: number } => {
    if (!trendData || trendData.weeks.length < 2) {
      return { direction: 'neutral', value: 0 };
    }

    const values = trendData.metrics[selectedMetric];
    const latest = values[values.length - 1];
    const previous = values[values.length - 2];
    const diff = latest - previous;

    if (diff > 0) return { direction: 'up', value: diff };
    if (diff < 0) return { direction: 'down', value: Math.abs(diff) };
    return { direction: 'neutral', value: 0 };
  };

  const renderTrendIcon = () => {
    const trend = getTrend();
    switch (trend.direction) {
      case 'up':
        return <TrendingUp size={16} className={styles.trendUp} />;
      case 'down':
        return <TrendingDown size={16} className={styles.trendDown} />;
      default:
        return <Minus size={16} className={styles.trendNeutral} />;
    }
  };

  const metricLabels = {
    sessions: 'Sessions',
    accomplishments: 'Accomplishments',
    evalDelta: 'Eval Score Δ',
  };

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Calendar size={16} className={styles.headerIcon} />
          <h3 className={styles.title}>Weekly Trends</h3>
        </div>
        <button
          className={styles.refreshButton}
          onClick={fetchTrends}
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? styles.spinning : ''} />
        </button>
      </div>

      {/* Metric Selector */}
      <div className={styles.metricSelector}>
        {Object.entries(metricLabels).map(([key, label]) => (
          <button
            key={key}
            className={`${styles.metricButton} ${selectedMetric === key ? styles.active : ''}`}
            onClick={() => setSelectedMetric(key as typeof selectedMetric)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Trend Summary */}
      <div className={styles.trendSummary}>
        {renderTrendIcon()}
        <span className={styles.trendValue}>
          {getTrend().direction === 'up' && '+'}
          {getTrend().direction === 'down' && '-'}
          {getTrend().value}
        </span>
        <span className={styles.trendLabel}>vs last week</span>
      </div>

      {/* Chart */}
      <div className={styles.chartContainer}>
        {loading ? (
          <div className={styles.loading}>Loading trends...</div>
        ) : !trendData ? (
          <div className={styles.empty}>No trend data available</div>
        ) : (
          <div className={styles.chart}>
            {trendData.weeks.map((week, index) => {
              const value = trendData.metrics[selectedMetric][index];
              const maxValue = getMaxValue();
              const heightPct = Math.abs(value) / maxValue * 100;
              const isNegative = value < 0;

              return (
                <div key={week} className={styles.barContainer}>
                  <div className={styles.barWrapper}>
                    <div
                      className={`${styles.bar} ${isNegative ? styles.negative : ''}`}
                      style={{ height: `${heightPct}%` }}
                    >
                      <span className={styles.barValue}>{value}</span>
                    </div>
                  </div>
                  <span className={styles.barLabel}>{week}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: 'hsl(var(--brand-primary))' }} />
          Last 4 weeks
        </span>
      </div>
    </div>
  );
}
