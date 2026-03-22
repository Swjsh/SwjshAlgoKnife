/**
 * SystemHealthGauge Component
 * ===========================
 * Animated circular gauge showing overall system health (0-100%).
 * Uses SVG with conic gradient effect and CounterAnimation.
 *
 * Part of Research Agent Audit Command Center
 */

"use client";

import React, { useEffect, useState } from "react";
import styles from "./SystemHealthGauge.module.css";

interface SystemHealthGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  label?: string;
  animate?: boolean;
}

const SIZE_MAP = {
  sm: 120,
  md: 180,
  lg: 240,
};

export default function SystemHealthGauge({
  score,
  size = "md",
  label = "System Health",
  animate = true,
}: SystemHealthGaugeProps) {
  const [displayScore, setDisplayScore] = useState(animate ? 0 : score);

  useEffect(() => {
    if (!animate) {
      setDisplayScore(score);
      return;
    }

    // Animate from 0 to score
    const duration = 1500;
    const startTime = Date.now();
    const startScore = displayScore;

    const animateScore = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out-cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startScore + (score - startScore) * eased);

      setDisplayScore(current);

      if (progress < 1) {
        requestAnimationFrame(animateScore);
      }
    };

    requestAnimationFrame(animateScore);
  }, [score, animate]);

  const dimension = SIZE_MAP[size];
  const strokeWidth = size === "sm" ? 8 : size === "md" ? 12 : 16;
  const radius = (dimension - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  // Color based on score
  const getColor = (s: number) => {
    if (s >= 95) return "var(--status-success, #10b981)";
    if (s >= 80) return "var(--status-warning, #f59e0b)";
    return "var(--status-danger, #ef4444)";
  };

  const getStatus = (s: number) => {
    if (s >= 96) return "PERFECT";
    if (s >= 95) return "EXCELLENT";
    if (s >= 80) return "GOOD";
    if (s >= 60) return "PARTIAL";
    return "CRITICAL";
  };

  const color = getColor(displayScore);
  const status = getStatus(displayScore);

  return (
    <div className={styles.container} data-size={size}>
      <svg
        width={dimension}
        height={dimension}
        viewBox={`0 0 ${dimension} ${dimension}`}
        className={styles.gauge}
      >
        {/* Background circle */}
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
        />

        {/* Progress circle */}
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${dimension / 2} ${dimension / 2})`}
          className={styles.progressCircle}
          style={{
            filter: `drop-shadow(0 0 ${size === "sm" ? 4 : 8}px ${color})`,
          }}
        />

        {/* Glow effect */}
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius - strokeWidth}
          fill="none"
          stroke={color}
          strokeWidth={1}
          opacity={0.3}
          className={styles.glowCircle}
        />
      </svg>

      <div className={styles.content}>
        <span className={styles.score} style={{ color }}>
          {displayScore}
          <span className={styles.percent}>%</span>
        </span>
        <span className={styles.status} style={{ color }}>
          {status}
        </span>
        {label && <span className={styles.label}>{label}</span>}
      </div>

      {/* Decorative rings */}
      <div
        className={styles.outerRing}
        style={{ borderColor: `${color}20` }}
      />
    </div>
  );
}
