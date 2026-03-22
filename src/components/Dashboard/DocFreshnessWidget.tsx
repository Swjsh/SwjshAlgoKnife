"use client";

import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { GlowHoverCard, PulseIndicator } from "@/components/UI";
import { RefreshCw, ChevronDown, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import styles from "./DocFreshnessWidget.module.css";

interface StaleFile {
  name: string;
  path: string;
  category: string;
  priority: string;
  exists: boolean;
  modified: string | null;
  ageMs: number | null;
  ageDays: number | null;
  ageRelative: string;
  stale: boolean;
  staleDays: number;
  size: number;
}

interface CategorySummary {
  label: string;
  total: number;
  fresh: number;
  stale: number;
  missing: number;
  priority: string;
}

interface FreshnessData {
  healthStatus: "healthy" | "warning" | "critical";
  totalFiles: number;
  freshCount: number;
  staleCount: number;
  categories: Record<string, CategorySummary>;
  staleFiles: StaleFile[];
  lastScanned: string;
  healthScore: number;
}

interface DocFreshnessWidgetProps {
  className?: string;
  refreshInterval?: number; // in milliseconds, default 5 minutes
}

const STATUS_TO_PULSE: Record<string, "LIVE" | "IDLE" | "ERROR"> = {
  healthy: "LIVE",
  warning: "IDLE",
  critical: "ERROR",
};

/**
 * Documentation Freshness Dashboard Widget
 * Displays the health status of tracked documentation files across categories.
 */
export default function DocFreshnessWidget({
  className,
  refreshInterval = 5 * 60 * 1000, // 5 minutes default
}: DocFreshnessWidgetProps) {
  const [data, setData] = useState<FreshnessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setIsRefreshing(true);
      }

      const response = await fetch("/api/brain/freshness", {
        method: forceRefresh ? "POST" : "GET",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh interval
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  const handleRefresh = () => {
    fetchData(true);
  };

  const formatLastScanned = (isoDate: string): string => {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getCategoryStatus = (category: CategorySummary): "healthy" | "warning" | "critical" => {
    if (category.stale === 0) return "healthy";
    if (category.stale <= 2) return "warning";
    return "critical";
  };

  // Loading state
  if (loading) {
    return (
      <GlowHoverCard className={className} glowColor="#a855f7" glowIntensity="low">
        <div className={styles.widget}>
          <div className={styles.loading}>
            <div className={styles.loadingSpinner} />
            <span>Loading documentation status...</span>
          </div>
        </div>
      </GlowHoverCard>
    );
  }

  // Error state
  if (error) {
    return (
      <GlowHoverCard className={className} glowColor="#ef4444" glowIntensity="low">
        <div className={styles.widget}>
          <div className={styles.error}>
            <AlertCircle size={24} />
            <span className={styles.errorText}>{error}</span>
            <button className={styles.retryButton} onClick={() => fetchData()}>
              Retry
            </button>
          </div>
        </div>
      </GlowHoverCard>
    );
  }

  if (!data) return null;

  const glowColor =
    data.healthStatus === "healthy"
      ? "#10b981"
      : data.healthStatus === "warning"
      ? "#f59e0b"
      : "#ef4444";

  const visibleStaleFiles = expanded ? data.staleFiles : data.staleFiles.slice(0, 3);
  const hasMoreFiles = data.staleFiles.length > 3;

  return (
    <GlowHoverCard className={className} glowColor={glowColor} glowIntensity="medium">
      <div className={styles.widget}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <PulseIndicator status={STATUS_TO_PULSE[data.healthStatus]} size="sm" />
            <h3 className={styles.title}>Doc Freshness</h3>
          </div>
          <button
            className={cn(styles.refreshButton, isRefreshing && styles.spinning)}
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Stats Row */}
        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{data.totalFiles}</span>
            <span className={styles.statLabel}>Tracked</span>
          </div>
          <div className={styles.statItem}>
            <span className={cn(styles.statValue, styles.healthy)}>{data.freshCount}</span>
            <span className={styles.statLabel}>Fresh</span>
          </div>
          <div className={styles.statItem}>
            <span
              className={cn(
                styles.statValue,
                data.staleCount === 0 && styles.healthy,
                data.staleCount > 0 && data.staleCount <= 5 && styles.warning,
                data.staleCount > 5 && styles.critical
              )}
            >
              {data.staleCount}
            </span>
            <span className={styles.statLabel}>Stale</span>
          </div>
        </div>

        {/* Category Pills */}
        <div className={styles.categories}>
          {Object.entries(data.categories).map(([key, category]) => {
            const status = getCategoryStatus(category);
            return (
              <div key={key} className={cn(styles.categoryPill, styles[status])}>
                <span>{category.label}</span>
                <span className={styles.categoryCount}>
                  {category.fresh}/{category.total}
                </span>
              </div>
            );
          })}
        </div>

        {/* Stale Files List */}
        {data.staleCount > 0 ? (
          <div className={styles.staleSection}>
            <div className={styles.staleSectionHeader}>
              <span className={styles.staleLabel}>Stale Files</span>
              {hasMoreFiles && (
                <button className={styles.expandButton} onClick={() => setExpanded(!expanded)}>
                  {expanded ? "Show less" : `+${data.staleFiles.length - 3} more`}
                  <ChevronDown
                    size={12}
                    className={cn(styles.expandIcon, expanded && styles.expanded)}
                  />
                </button>
              )}
            </div>
            <div className={cn(styles.staleList, !expanded && styles.collapsed)}>
              {visibleStaleFiles.map((file, index) => (
                <div
                  key={index}
                  className={cn(
                    styles.staleFile,
                    file.priority === "critical" && styles.critical,
                    file.priority === "warning" && styles.warning
                  )}
                >
                  <div className={styles.fileInfo}>
                    <span className={styles.fileName}>
                      <FileText size={12} style={{ marginRight: 6, opacity: 0.6 }} />
                      {file.name}
                    </span>
                    <span className={styles.fileCategory}>
                      {data.categories[file.category]?.label || file.category}
                      {!file.exists && " (missing)"}
                    </span>
                  </div>
                  <span
                    className={cn(
                      styles.fileAge,
                      file.priority === "critical" && styles.critical,
                      file.priority === "warning" && styles.warning
                    )}
                  >
                    {file.ageRelative}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <CheckCircle2 size={32} className={styles.emptyIcon} />
            <span className={styles.emptyText}>All documentation is fresh!</span>
          </div>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.lastScanned}>
            Scanned: {formatLastScanned(data.lastScanned)}
          </span>
          <span className={cn(styles.healthScore, styles[data.healthStatus])}>
            {data.healthScore}% healthy
          </span>
        </div>
      </div>
    </GlowHoverCard>
  );
}
