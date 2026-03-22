/**
 * DeploymentGateBanner Component
 * ==============================
 * Shows pass/fail status for deployment readiness.
 * Displays shimmer effect when passing, warning pulse when failing.
 *
 * Part of Research Agent Audit Command Center
 */

"use client";

import React from "react";
import { Shield, ShieldCheck, ShieldAlert, AlertTriangle, ChevronRight } from "lucide-react";
import styles from "./DeploymentGateBanner.module.css";

interface DeploymentGateBannerProps {
  passed: boolean;
  compositeScore: number;
  lowestCategory: string;
  lowestScore: number;
  threshold?: number;
  onViewDetails?: () => void;
}

export default function DeploymentGateBanner({
  passed,
  compositeScore,
  lowestCategory,
  lowestScore,
  threshold = 95,
  onViewDetails,
}: DeploymentGateBannerProps) {
  const gap = threshold - lowestScore;

  return (
    <div className={`${styles.banner} ${passed ? styles.passed : styles.failed}`}>
      {/* Background shimmer effect */}
      <div className={styles.shimmerOverlay} />

      <div className={styles.content}>
        <div className={styles.iconSection}>
          <div className={styles.iconWrapper}>
            {passed ? (
              <ShieldCheck size={32} className={styles.iconSuccess} />
            ) : (
              <ShieldAlert size={32} className={styles.iconWarning} />
            )}
          </div>
        </div>

        <div className={styles.info}>
          <div className={styles.status}>
            {passed ? "DEPLOYMENT GATE PASSED" : "DEPLOYMENT GATE FAILED"}
          </div>
          <div className={styles.details}>
            {passed ? (
              <>
                All categories above {threshold}% threshold.
                Composite score: <strong>{compositeScore}%</strong>
              </>
            ) : (
              <>
                <AlertTriangle size={14} className={styles.inlineWarning} />
                <span className={styles.failReason}>
                  {lowestCategory} at {lowestScore}% ({gap}% below threshold)
                </span>
              </>
            )}
          </div>
        </div>

        <div className={styles.scoreSection}>
          <div className={styles.scoreValue}>{compositeScore}%</div>
          <div className={styles.scoreLabel}>Composite</div>
        </div>

        {onViewDetails && (
          <button className={styles.detailsButton} onClick={onViewDetails}>
            <span>Details</span>
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* Animated border */}
      <div className={styles.borderGlow} />
    </div>
  );
}
