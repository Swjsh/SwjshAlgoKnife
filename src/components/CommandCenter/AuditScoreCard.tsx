/**
 * AuditScoreCard Component
 * ========================
 * Displays a single audit category score with glow effect.
 * Expandable to show detailed criteria breakdown.
 *
 * Part of Research Agent Audit Command Center
 */

"use client";

import React, { useState } from "react";
import {
  Activity,
  Clock,
  FileText,
  Trophy,
  TrendingUp,
  Users,
  ChevronDown,
  ChevronUp,
  Check,
  X,
} from "lucide-react";
import styles from "./AuditScoreCard.module.css";

interface Criterion {
  name: string;
  met: boolean;
  points: number;
  maxPoints: number;
  details: string;
}

interface AuditScoreCardProps {
  category: string;
  name: string;
  score: number;
  maxScore: number;
  percentage: number;
  status: "PERFECT" | "EXCELLENT" | "GOOD" | "PARTIAL" | "WEAK" | "CRITICAL";
  criteria?: Criterion[];
  compact?: boolean;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  agentHealthMonitoring: <Activity size={20} />,
  sessionTracking: <Clock size={20} />,
  structuredOutput: <FileText size={20} />,
  accomplishmentAggregation: <Trophy size={20} />,
  crossSessionTrends: <TrendingUp size={20} />,
  unifiedAgentView: <Users size={20} />,
};

const STATUS_COLORS: Record<string, string> = {
  PERFECT: "#10b981",
  EXCELLENT: "#10b981",
  GOOD: "#22c55e",
  PARTIAL: "#f59e0b",
  WEAK: "#f97316",
  CRITICAL: "#ef4444",
};

export default function AuditScoreCard({
  category,
  name,
  score,
  maxScore,
  percentage,
  status,
  criteria = [],
  compact = false,
}: AuditScoreCardProps) {
  const [expanded, setExpanded] = useState(false);

  const icon = CATEGORY_ICONS[category] || <Activity size={20} />;
  const color = STATUS_COLORS[status];
  const progressWidth = Math.min(100, Math.max(0, percentage));

  return (
    <div
      className={`${styles.card} ${compact ? styles.compact : ""}`}
      style={{ "--accent-color": color } as React.CSSProperties}
      data-status={status}
    >
      <div className={styles.header}>
        <div className={styles.iconWrapper} style={{ color }}>
          {icon}
        </div>
        <div className={styles.info}>
          <span className={styles.name}>{name}</span>
          <span className={styles.scoreText}>
            {score}/{maxScore}
          </span>
        </div>
        <div className={styles.percentageWrapper}>
          <span className={styles.percentage} style={{ color }}>
            {percentage}%
          </span>
          <span className={styles.statusBadge} style={{ backgroundColor: `${color}20`, color }}>
            {status}
          </span>
        </div>
      </div>

      <div className={styles.progressContainer}>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{
              width: `${progressWidth}%`,
              backgroundColor: color,
              boxShadow: `0 0 8px ${color}60`,
            }}
          />
          {/* 95% threshold marker */}
          <div className={styles.thresholdMarker} />
        </div>
      </div>

      {criteria.length > 0 && !compact && (
        <>
          <button
            className={styles.expandButton}
            onClick={() => setExpanded(!expanded)}
          >
            <span>Criteria ({criteria.filter(c => c.met).length}/{criteria.length})</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {expanded && (
            <div className={styles.criteriaList}>
              {criteria.map((c, idx) => (
                <div key={idx} className={styles.criterionRow} data-met={c.met}>
                  <span className={styles.criterionIcon}>
                    {c.met ? <Check size={12} /> : <X size={12} />}
                  </span>
                  <span className={styles.criterionName}>{c.name}</span>
                  <span className={styles.criterionPoints}>
                    {c.points}/{c.maxPoints}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Glow effect on hover */}
      <div className={styles.glowOverlay} style={{ background: `radial-gradient(circle at center, ${color}10 0%, transparent 70%)` }} />
    </div>
  );
}
