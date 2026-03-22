"use client";

import React from "react";
import { cn } from "@/lib/utils";
import styles from "./PulseIndicator.module.css";

export type StatusType = "LIVE" | "IDLE" | "OFF" | "ERROR" | "PENDING" | "PAUSED" | "active" | "idle" | "off" | "error" | "running" | "stopped" | "pending" | "paused";
type SizeType = "sm" | "md" | "lg";

interface PulseIndicatorProps {
    status: StatusType;
    size?: SizeType;
    className?: string;
    showLabel?: boolean;
}

const STATUS_CONFIG: Record<string, { color: string; pulse: boolean; label: string }> = {
    LIVE: { color: "#10b981", pulse: true, label: "LIVE" },
    active: { color: "#10b981", pulse: true, label: "LIVE" },
    running: { color: "#10b981", pulse: true, label: "CONNECTED" },
    IDLE: { color: "#f59e0b", pulse: false, label: "IDLE" },
    idle: { color: "#f59e0b", pulse: false, label: "IDLE" },
    PAUSED: { color: "#f59e0b", pulse: false, label: "PAUSED" },
    paused: { color: "#f59e0b", pulse: false, label: "PAUSED" },
    OFF: { color: "#374151", pulse: false, label: "OFF" },
    off: { color: "#374151", pulse: false, label: "OFF" },
    stopped: { color: "#64748b", pulse: false, label: "DISCONNECTED" },
    ERROR: { color: "#ef4444", pulse: true, label: "ERROR" },
    error: { color: "#ef4444", pulse: true, label: "ERROR" },
    PENDING: { color: "#06b6d4", pulse: true, label: "PENDING" },
    pending: { color: "#06b6d4", pulse: true, label: "PENDING" },
};

const SIZE_CONFIG: Record<SizeType, { dot: number; ring: number; fontSize: number }> = {
    sm: { dot: 6, ring: 12, fontSize: 8 },
    md: { dot: 8, ring: 16, fontSize: 9 },
    lg: { dot: 10, ring: 20, fontSize: 10 },
};

/**
 * Animated status indicator with pulse effect for active states.
 * Supports LIVE, IDLE, OFF, and ERROR statuses.
 */
export default function PulseIndicator({
    status,
    size = "md",
    className,
    showLabel = false,
}: PulseIndicatorProps) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.OFF;
    const sizeConfig = SIZE_CONFIG[size];

    return (
        <div className={cn(styles.container, className)}>
            <div
                className={styles.wrapper}
                style={{
                    width: sizeConfig.ring,
                    height: sizeConfig.ring,
                }}
            >
                {/* Outer pulse ring */}
                {config.pulse && (
                    <div
                        className={styles.pulseRing}
                        style={{
                            backgroundColor: config.color,
                            width: sizeConfig.ring,
                            height: sizeConfig.ring,
                        }}
                    />
                )}
                {/* Core dot */}
                <div
                    className={styles.dot}
                    style={{
                        backgroundColor: config.color,
                        width: sizeConfig.dot,
                        height: sizeConfig.dot,
                        boxShadow: config.pulse ? `0 0 ${sizeConfig.dot}px ${config.color}` : "none",
                    }}
                />
            </div>
            {showLabel && (
                <span
                    className={styles.label}
                    style={{
                        color: config.color,
                        fontSize: sizeConfig.fontSize,
                    }}
                >
                    {config.label}
                </span>
            )}
        </div>
    );
}
