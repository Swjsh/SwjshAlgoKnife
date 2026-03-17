"use client";

import React from "react";
import { motion } from "framer-motion";
import styles from "./DynamicBorderCard.module.css";
import clsx from "clsx";

interface DynamicBorderCardProps {
    children: React.ReactNode;
    className?: string;
    gradient?: string;
}

export default function DynamicBorderCard({
    children,
    className,
    gradient = "conic-gradient(from 0deg, transparent 0, #a855f7 90deg, #e84393 180deg, transparent 270deg)"
}: DynamicBorderCardProps) {
    return (
        <div className={clsx(styles.cardWrapper, className)}>
            <motion.div
                className={styles.borderEffect}
                animate={{
                    rotate: [0, 360]
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "linear"
                }}
                style={{
                    background: gradient
                }}
            />
            <div className={styles.innerCard}>
                {children}
            </div>
        </div>
    );
}
