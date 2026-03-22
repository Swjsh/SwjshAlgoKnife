/**
 * HealthPredictionGrid Component
 * ==============================
 * Displays health predictions for all agents (Research + HALO).
 * Shows failure probability, time-to-failure, and recommendations.
 *
 * Part of Research Agent Audit Command Center
 */

"use client";

import React, { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Filter,
  ChevronDown,
} from "lucide-react";
import styles from "./HealthPredictionGrid.module.css";

interface HealthPrediction {
  agentId: string;
  agentName: string;
  agentType: "research" | "halo";
  group?: string;
  currentStatus: "healthy" | "warning" | "critical" | "offline";
  predictedStatus: "healthy" | "warning" | "critical";
  failureProbability: number;
  timeToFailure: number | null;
  confidence: number;
  signals: string[];
  recommendation: string;
  emoji?: string;
  color?: string;
}

interface HealthPredictionGridProps {
  predictions: HealthPrediction[];
  showFilters?: boolean;
}

type FilterType = "all" | "research" | "halo" | "critical" | "warning";

const STATUS_ICONS = {
  healthy: <CheckCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  critical: <Zap size={16} />,
  offline: <Activity size={16} />,
};

const STATUS_COLORS = {
  healthy: "#10b981",
  warning: "#f59e0b",
  critical: "#ef4444",
  offline: "#64748b",
};

export default function HealthPredictionGrid({
  predictions,
  showFilters = true,
}: HealthPredictionGridProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const filteredPredictions = predictions.filter((p) => {
    switch (filter) {
      case "research":
        return p.agentType === "research";
      case "halo":
        return p.agentType === "halo";
      case "critical":
        return p.predictedStatus === "critical";
      case "warning":
        return p.predictedStatus === "warning" || p.predictedStatus === "critical";
      default:
        return true;
    }
  });

  const stats = {
    total: predictions.length,
    healthy: predictions.filter((p) => p.predictedStatus === "healthy").length,
    warning: predictions.filter((p) => p.predictedStatus === "warning").length,
    critical: predictions.filter((p) => p.predictedStatus === "critical").length,
    offline: predictions.filter((p) => p.currentStatus === "offline").length,
  };

  const formatTimeToFailure = (seconds: number | null): string => {
    if (seconds === null) return "—";
    if (seconds === 0) return "NOW";
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  return (
    <div className={styles.container}>
      {showFilters && (
        <div className={styles.header}>
          <div className={styles.statsBar}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{stats.total}</span>
              <span className={styles.statLabel}>Total</span>
            </div>
            <div className={styles.statItem} data-status="healthy">
              <span className={styles.statValue}>{stats.healthy}</span>
              <span className={styles.statLabel}>Healthy</span>
            </div>
            <div className={styles.statItem} data-status="warning">
              <span className={styles.statValue}>{stats.warning}</span>
              <span className={styles.statLabel}>Warning</span>
            </div>
            <div className={styles.statItem} data-status="critical">
              <span className={styles.statValue}>{stats.critical}</span>
              <span className={styles.statLabel}>Critical</span>
            </div>
            <div className={styles.statItem} data-status="offline">
              <span className={styles.statValue}>{stats.offline}</span>
              <span className={styles.statLabel}>Offline</span>
            </div>
          </div>

          <div className={styles.filters}>
            <Filter size={14} />
            {(["all", "research", "halo", "critical", "warning"] as FilterType[]).map((f) => (
              <button
                key={f}
                className={`${styles.filterButton} ${filter === f ? styles.active : ""}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.grid}>
        {filteredPredictions.map((prediction) => (
          <div
            key={prediction.agentId}
            className={styles.card}
            data-status={prediction.predictedStatus}
            data-type={prediction.agentType}
          >
            <div className={styles.cardHeader}>
              <div className={styles.agentInfo}>
                <span className={styles.emoji}>{prediction.emoji || "🤖"}</span>
                <div className={styles.nameGroup}>
                  <span className={styles.agentName}>{prediction.agentName}</span>
                  <span className={styles.agentType}>{prediction.agentType.toUpperCase()}</span>
                </div>
              </div>
              <div
                className={styles.statusIndicator}
                style={{ backgroundColor: STATUS_COLORS[prediction.currentStatus] }}
              >
                {STATUS_ICONS[prediction.currentStatus]}
              </div>
            </div>

            <div className={styles.metrics}>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>Failure Risk</span>
                <span
                  className={styles.metricValue}
                  style={{ color: STATUS_COLORS[prediction.predictedStatus] }}
                >
                  {Math.round(prediction.failureProbability * 100)}%
                </span>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>TTF</span>
                <span className={styles.metricValue}>
                  {formatTimeToFailure(prediction.timeToFailure)}
                </span>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>Confidence</span>
                <span className={styles.metricValue}>
                  {Math.round(prediction.confidence * 100)}%
                </span>
              </div>
            </div>

            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${Math.min(100, prediction.failureProbability * 100)}%`,
                  backgroundColor: STATUS_COLORS[prediction.predictedStatus],
                }}
              />
            </div>

            <button
              className={styles.expandButton}
              onClick={() =>
                setExpandedAgent(expandedAgent === prediction.agentId ? null : prediction.agentId)
              }
            >
              <span>{prediction.signals.length} signals</span>
              <ChevronDown
                size={14}
                className={expandedAgent === prediction.agentId ? styles.rotated : ""}
              />
            </button>

            {expandedAgent === prediction.agentId && (
              <div className={styles.expandedContent}>
                <div className={styles.signals}>
                  {prediction.signals.length > 0 ? (
                    prediction.signals.map((signal, idx) => (
                      <div key={idx} className={styles.signal}>
                        <Clock size={12} />
                        <span>{signal}</span>
                      </div>
                    ))
                  ) : (
                    <div className={styles.signal}>
                      <CheckCircle size={12} />
                      <span>No warning signals</span>
                    </div>
                  )}
                </div>
                <div className={styles.recommendation}>
                  {prediction.recommendation}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredPredictions.length === 0 && (
        <div className={styles.emptyState}>
          <Activity size={32} />
          <span>No agents match the current filter</span>
        </div>
      )}
    </div>
  );
}
