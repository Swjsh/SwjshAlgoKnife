"use client";

import React, { useEffect, useState } from "react";
import { motion, useSpring } from "framer-motion";
import styles from "./CounterAnimation.module.css";
import clsx from "clsx";

interface CounterAnimationProps {
    value: number;
    /** Prefix to display (e.g., "$", "+") */
    prefix?: string;
    /** Suffix to display (e.g., "%", "pts") */
    suffix?: string;
    /** Number of decimal places (default: 2) */
    decimals?: number;
    /** Animation duration in seconds (default: 1) */
    duration?: number;
    /** Apply positive/negative color styling */
    colorize?: boolean;
    className?: string;
}

/**
 * CounterAnimation - Animated number counter with spring physics
 * Smoothly animates from previous value to new value
 */
export default function CounterAnimation({
    value,
    prefix = "",
    suffix = "",
    decimals = 2,
    duration = 1,
    colorize = true,
    className,
}: CounterAnimationProps) {
    const [displayValue, setDisplayValue] = useState(value);

    // Spring animation for smooth transitions
    const spring = useSpring(value, {
        stiffness: 100,
        damping: 30,
        duration: duration * 1000,
    });

    useEffect(() => {
        spring.set(value);
    }, [value, spring]);

    useEffect(() => {
        const unsubscribe = spring.on("change", (latest) => {
            setDisplayValue(latest);
        });
        return unsubscribe;
    }, [spring]);

    // Format the display value
    const formattedValue = displayValue.toFixed(decimals);

    // Determine if we should show +/- prefix
    const signPrefix = value > 0 ? "+" : "";
    const finalPrefix = colorize && value !== 0 ? signPrefix + prefix : prefix;

    // Determine color class
    const colorClass = colorize
        ? value > 0
            ? styles.positive
            : value < 0
            ? styles.negative
            : styles.neutral
        : "";

    return (
        <motion.span
            className={clsx(styles.counter, colorClass, className)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            {finalPrefix}
            {formattedValue}
            {suffix}
        </motion.span>
    );
}
