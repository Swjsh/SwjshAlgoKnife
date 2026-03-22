/**
 * CommandCenter Component
 * =======================
 * Main dashboard aggregating audit scores, health predictions, and anomalies.
 * Central command view for Research Agent Audit System.
 *
 * Part of Research Agent Audit Command Center
 */

"use client";

import React from "react";
import {
  RefreshCw,
  Activity,
  Shield,
  Users,
  TrendingUp,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { useCommandCenter } from "./useCommandCenter";
import SystemHealthGauge from "./SystemHealthGauge";
import DeploymentGateBanner from "./DeploymentGateBanner";
import AuditScoreCard from "./AuditScoreCard";
import HealthPredictionGrid from "./HealthPredictionGrid";
import AnomalyAlert from "./AnomalyAlert";
import styles from "./CommandCenter.module.css";

interface CommandCenterProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export default function CommandCenter({
  autoRefresh = true,
  refreshInterval = 30000,
}: CommandCenterProps) {
  const {
    audit,
    health,
    anomalies,
    isLoading,
    error,
    lastRefresh,
    refresh,
    dismissAnomaly,
  } = useCommandCenter({ autoRefresh, refreshInterval });

  const formatLastRefresh = (date: Date | null): string => {
    if (!date) return "Never";
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (error) {
    return (
      <div className={styles.errorState}>
        <AlertTriangle size={48} />
        <h3>Command Center Error</h3>
        <p>{error}</p>
        <button onClick={refresh} className={styles.retryButton}>
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <Shield size={24} className={styles.titleIcon} />
          <div>
            <h1 className={styles.title}>Research Agent Audit Command Center</h1>
            <p className={styles.subtitle}>
              Real-time monitoring for Research + HALO agents
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.lastUpdate}>
            <Clock size={14} />
            <span>Last update: {formatLastRefresh(lastRefresh)}</span>
          </div>
          <button
            className={`${styles.refreshButton} ${isLoading ? styles.spinning : ""}`}
            onClick={refresh}
            disabled={isLoading}
          >
            <RefreshCw size={16} />
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Anomaly Alerts (if any) */}
      {anomalies.length > 0 && (
        <div className={styles.alertSection}>
          <AnomalyAlert anomalies={anomalies} onDismiss={dismissAnomaly} />
        </div>
      )}

      {/* Deployment Gate Banner */}
      {audit && (
        <div className={styles.gateBanner}>
          <DeploymentGateBanner
            passed={audit.deploymentGatePassed}
            compositeScore={audit.composite}
            lowestCategory={audit.lowestCategory}
            lowestScore={audit.lowestScore}
          />
        </div>
      )}

      {/* Main Dashboard Grid */}
      <div className={styles.dashboard}>
        {/* Left Column: Health Gauge + Stats */}
        <div className={styles.leftColumn}>
          <div className={styles.gaugePanel}>
            <h2 className={styles.panelTitle}>
              <Activity size={18} />
              System Health
            </h2>
            <div className={styles.gaugeContainer}>
              <SystemHealthGauge
                score={health?.summary.systemHealthScore ?? 0}
                size="lg"
                label="Overall Health"
                animate={!isLoading}
              />
            </div>
            {health && (
              <div className={styles.quickStats}>
                <div className={styles.quickStat} data-status="healthy">
                  <span className={styles.quickStatValue}>{health.summary.healthy}</span>
                  <span className={styles.quickStatLabel}>Healthy</span>
                </div>
                <div className={styles.quickStat} data-status="warning">
                  <span className={styles.quickStatValue}>{health.summary.warning}</span>
                  <span className={styles.quickStatLabel}>Warning</span>
                </div>
                <div className={styles.quickStat} data-status="critical">
                  <span className={styles.quickStatValue}>{health.summary.critical}</span>
                  <span className={styles.quickStatLabel}>Critical</span>
                </div>
                <div className={styles.quickStat} data-status="offline">
                  <span className={styles.quickStatValue}>{health.summary.offline}</span>
                  <span className={styles.quickStatLabel}>Offline</span>
                </div>
              </div>
            )}
          </div>

          {/* Audit Composite Gauge */}
          {audit && (
            <div className={styles.auditGaugePanel}>
              <h2 className={styles.panelTitle}>
                <Shield size={18} />
                Audit Score
              </h2>
              <div className={styles.gaugeContainer}>
                <SystemHealthGauge
                  score={audit.composite}
                  size="md"
                  label="Composite"
                  animate={!isLoading}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Audit Categories */}
        <div className={styles.rightColumn}>
          <div className={styles.categoriesPanel}>
            <h2 className={styles.panelTitle}>
              <TrendingUp size={18} />
              Audit Categories
            </h2>
            <div className={styles.categoriesGrid}>
              {audit?.categories.map((cat) => (
                <AuditScoreCard
                  key={cat.category}
                  category={cat.category}
                  name={cat.name}
                  score={cat.score}
                  maxScore={cat.maxScore}
                  percentage={cat.percentage}
                  status={cat.status}
                  criteria={cat.criteria}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Health Predictions Grid */}
      <div className={styles.healthSection}>
        <h2 className={styles.sectionTitle}>
          <Users size={20} />
          Agent Health Predictions
          <span className={styles.agentCount}>
            {health?.predictions.length ?? 0} agents
          </span>
        </h2>
        {health && (
          <HealthPredictionGrid predictions={health.predictions} showFilters />
        )}
      </div>

      {/* Loading Overlay */}
      {isLoading && !audit && !health && (
        <div className={styles.loadingOverlay}>
          <RefreshCw size={32} className={styles.loadingIcon} />
          <span>Loading Command Center...</span>
        </div>
      )}
    </div>
  );
}
