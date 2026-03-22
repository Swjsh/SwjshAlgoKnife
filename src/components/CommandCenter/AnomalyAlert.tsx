/**
 * AnomalyAlert Component
 * ======================
 * Displays trend anomaly warnings from cross-session analysis.
 * Shows deviations from baseline patterns.
 *
 * Part of Research Agent Audit Command Center
 */

"use client";

import React from "react";
import { AlertTriangle, TrendingDown, TrendingUp, Activity, X } from "lucide-react";
import styles from "./AnomalyAlert.module.css";

interface Anomaly {
  type: "spike" | "drop" | "trend" | "pattern";
  severity: "low" | "medium" | "high";
  metric: string;
  description: string;
  value: number;
  baseline: number;
  deviation: number;
  timestamp: string;
}

interface AnomalyAlertProps {
  anomalies: Anomaly[];
  onDismiss?: (index: number) => void;
  compact?: boolean;
}

const SEVERITY_COLORS = {
  low: "#f59e0b",
  medium: "#f97316",
  high: "#ef4444",
};

const TYPE_ICONS = {
  spike: <TrendingUp size={16} />,
  drop: <TrendingDown size={16} />,
  trend: <Activity size={16} />,
  pattern: <AlertTriangle size={16} />,
};

export default function AnomalyAlert({
  anomalies,
  onDismiss,
  compact = false,
}: AnomalyAlertProps) {
  if (anomalies.length === 0) {
    return null;
  }

  const formatDeviation = (deviation: number): string => {
    const sign = deviation >= 0 ? "+" : "";
    return `${sign}${deviation.toFixed(1)}%`;
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ""}`}>
      <div className={styles.header}>
        <AlertTriangle size={18} className={styles.headerIcon} />
        <span className={styles.headerText}>
          {anomalies.length} Anomal{anomalies.length === 1 ? "y" : "ies"} Detected
        </span>
      </div>

      <div className={styles.alertList}>
        {anomalies.map((anomaly, idx) => (
          <div
            key={idx}
            className={styles.alert}
            data-severity={anomaly.severity}
            style={{ "--alert-color": SEVERITY_COLORS[anomaly.severity] } as React.CSSProperties}
          >
            <div className={styles.alertIcon}>
              {TYPE_ICONS[anomaly.type]}
            </div>

            <div className={styles.alertContent}>
              <div className={styles.alertHeader}>
                <span className={styles.metric}>{anomaly.metric}</span>
                <span className={styles.time}>{formatTime(anomaly.timestamp)}</span>
              </div>
              <p className={styles.description}>{anomaly.description}</p>
              <div className={styles.stats}>
                <span className={styles.stat}>
                  Current: <strong>{anomaly.value.toFixed(1)}</strong>
                </span>
                <span className={styles.stat}>
                  Baseline: <strong>{anomaly.baseline.toFixed(1)}</strong>
                </span>
                <span
                  className={styles.deviation}
                  data-positive={anomaly.deviation >= 0}
                >
                  {formatDeviation(anomaly.deviation)}
                </span>
              </div>
            </div>

            {onDismiss && (
              <button
                className={styles.dismissButton}
                onClick={() => onDismiss(idx)}
                aria-label="Dismiss alert"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
