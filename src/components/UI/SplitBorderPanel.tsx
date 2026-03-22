"use client";

import React from "react";
import { motion } from "framer-motion";
import styles from "./SplitBorderPanel.module.css";
import clsx from "clsx";

interface SplitBorderPanelProps {
    children: React.ReactNode;
    className?: string;
    /** P&L value to determine glow color */
    pnl: number;
    /** Threshold for "strong" glow intensity (default: 100) */
    threshold?: number;
}

/**
 * SplitBorderPanel - A card with animated border glow based on P&L
 * - Positive P&L: Green glow (#10b981)
 * - Negative P&L: Red glow (#ef4444)
 * - Neutral (near 0): Subtle gray glow
 *
 * Glow intensity scales with |P&L| / threshold
 */
export default function SplitBorderPanel({
    children,
    className,
    pnl,
    threshold = 100,
}: SplitBorderPanelProps) {
    // Calculate glow intensity (0 to 1)
    const intensity = Math.min(Math.abs(pnl) / threshold, 1);

    // Determine color based on P&L
    const getGlowColor = () => {
        if (pnl > 5) return `rgba(16, 185, 129, ${0.3 + intensity * 0.4})`; // Green
        if (pnl < -5) return `rgba(239, 68, 68, ${0.3 + intensity * 0.4})`; // Red
        return "rgba(148, 163, 184, 0.15)"; // Neutral gray
    };

    const glowColor = getGlowColor();

    // Gradient for border animation
    const gradient = pnl > 5
        ? `conic-gradient(from 0deg, transparent 0%, rgba(16, 185, 129, ${intensity}) 90deg, rgba(6, 182, 212, ${intensity * 0.5}) 180deg, transparent 270deg)`
        : pnl < -5
        ? `conic-gradient(from 0deg, transparent 0%, rgba(239, 68, 68, ${intensity}) 90deg, rgba(245, 158, 11, ${intensity * 0.5}) 180deg, transparent 270deg)`
        : `conic-gradient(from 0deg, transparent 0%, rgba(148, 163, 184, 0.2) 90deg, rgba(148, 163, 184, 0.1) 180deg, transparent 270deg)`;

    return (
        <div
            className={clsx(styles.wrapper, className)}
            style={{
                boxShadow: `0 0 ${20 + intensity * 20}px ${glowColor}`,
            }}
        >
            <motion.div
                className={styles.borderEffect}
                animate={{
                    rotate: [0, 360],
                }}
                transition={{
                    duration: 6 - intensity * 2, // Faster rotation for higher P&L
                    repeat: Infinity,
                    ease: "linear",
                }}
                style={{
                    background: gradient,
                }}
            />
            <div className={styles.innerPanel}>
                {children}
            </div>
        </div>
    );
}
