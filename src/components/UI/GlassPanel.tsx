"use client";

import React from "react";
import clsx from "clsx";
import styles from "./GlassPanel.module.css";

interface GlassPanelProps {
    children: React.ReactNode;
    className?: string;
    title?: React.ReactNode;
    action?: React.ReactNode;
}

export default function GlassPanel({ children, className, title, action }: GlassPanelProps) {
    return (
        <div className={clsx(styles.panel, className)}>
            {(title || action) && (
                <div className={styles.header}>
                    <div className={styles.title}>{title}</div>
                    <div className={styles.action}>{action}</div>
                </div>
            )}
            <div className={styles.content}>
                {children}
            </div>
        </div>
    );
}
