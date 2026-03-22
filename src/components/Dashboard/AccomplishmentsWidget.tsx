"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Clock, TrendingUp, GitCommit, FileText, Bug, RefreshCw } from 'lucide-react';
import styles from './AccomplishmentsWidget.module.css';

// ============================================================================
// Types
// ============================================================================

interface Accomplishment {
  id: number;
  session_id: string | null;
  agent_id: string;
  agent_type: 'research' | 'halo' | 'trading';
  timestamp: string;
  action_type: string;
  description: string;
  quantified_value: number | null;
  jira_ticket: string | null;
  git_commit: string | null;
}

interface AccomplishmentsSummary {
  total: number;
  byType: Record<string, number>;
  byAgent: Record<string, number>;
  last24h: number;
}

// ============================================================================
// Action Type Icons
// ============================================================================

const ACTION_ICONS: Record<string, React.ReactNode> = {
  bug_fix: <Bug size={14} />,
  pr_merged: <GitCommit size={14} />,
  doc_updated: <FileText size={14} />,
  test_added: <CheckCircle2 size={14} />,
  improvement: <TrendingUp size={14} />,
  default: <CheckCircle2 size={14} />,
};

const ACTION_COLORS: Record<string, string> = {
  bug_fix: 'var(--status-error)',
  pr_merged: 'var(--brand-primary)',
  doc_updated: 'var(--status-warning)',
  test_added: 'var(--status-success)',
  improvement: 'var(--accent-neon)',
  default: 'var(--text-muted)',
};

// ============================================================================
// Component
// ============================================================================

export default function AccomplishmentsWidget() {
  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>([]);
  const [summary, setSummary] = useState<AccomplishmentsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccomplishments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch from API (or fallback to mock data)
      const response = await fetch('/api/accomplishments?limit=10&hours=24');

      if (!response.ok) {
        throw new Error('Failed to fetch accomplishments');
      }

      const data = await response.json();
      setAccomplishments(data.accomplishments || []);
      setSummary(data.summary || null);
    } catch (err) {
      // Fallback to empty state - API may not exist yet
      setAccomplishments([]);
      setSummary({
        total: 0,
        byType: {},
        byAgent: {},
        last24h: 0,
      });
      setError(null); // Don't show error, just empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccomplishments();

    // Refresh every 30 seconds
    const interval = setInterval(fetchAccomplishments, 30000);
    return () => clearInterval(interval);
  }, [fetchAccomplishments]);

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getActionIcon = (actionType: string): React.ReactNode => {
    return ACTION_ICONS[actionType] || ACTION_ICONS.default;
  };

  const getActionColor = (actionType: string): string => {
    return ACTION_COLORS[actionType] || ACTION_COLORS.default;
  };

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <CheckCircle2 size={16} className={styles.headerIcon} />
          <h3 className={styles.title}>Today's Accomplishments</h3>
        </div>
        <button
          className={styles.refreshButton}
          onClick={fetchAccomplishments}
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? styles.spinning : ''} />
        </button>
      </div>

      {/* Summary Stats */}
      {summary && summary.total > 0 && (
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{summary.last24h}</span>
            <span className={styles.statLabel}>Last 24h</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{Object.keys(summary.byAgent).length}</span>
            <span className={styles.statLabel}>Agents</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{Object.keys(summary.byType).length}</span>
            <span className={styles.statLabel}>Types</span>
          </div>
        </div>
      )}

      {/* Accomplishments List */}
      <div className={styles.list}>
        {loading ? (
          <div className={styles.emptyState}>
            <Clock size={24} className={styles.emptyIcon} />
            <span>Loading...</span>
          </div>
        ) : accomplishments.length === 0 ? (
          <div className={styles.emptyState}>
            <CheckCircle2 size={24} className={styles.emptyIcon} />
            <span>No accomplishments yet today</span>
            <span className={styles.emptyHint}>
              Agent accomplishments will appear here
            </span>
          </div>
        ) : (
          accomplishments.map((item) => (
            <div key={item.id} className={styles.item}>
              <div
                className={styles.itemIcon}
                style={{ color: getActionColor(item.action_type) }}
              >
                {getActionIcon(item.action_type)}
              </div>
              <div className={styles.itemContent}>
                <div className={styles.itemDescription}>{item.description}</div>
                <div className={styles.itemMeta}>
                  <span className={styles.agentBadge}>{item.agent_id}</span>
                  <span className={styles.itemTime}>
                    <Clock size={10} />
                    {formatTime(item.timestamp)}
                  </span>
                  {item.jira_ticket && (
                    <span className={styles.jiraBadge}>{item.jira_ticket}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}
    </div>
  );
}
