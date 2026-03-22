"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import styles from "./SpotlightButton.module.css";
import clsx from "clsx";

interface SpotlightButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    /** Spotlight color (default: red #ef4444) */
    spotlightColor?: string;
    type?: "button" | "submit" | "reset";
}

/**
 * SpotlightButton - Button with cursor-following spotlight effect
 * Ideal for destructive/stop actions
 */
export default function SpotlightButton({
    children,
    onClick,
    disabled = false,
    className,
    spotlightColor = "#ef4444",
    type = "button",
}: SpotlightButtonProps) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [spotlightPosition, setSpotlightPosition] = useState({ x: 50, y: 50 });

    const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled) return;

        const button = buttonRef.current;
        if (!button) return;

        const rect = button.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        setSpotlightPosition({ x, y });
    };

    return (
        <motion.button
            ref={buttonRef}
            type={type}
            className={clsx(styles.button, className)}
            onClick={onClick}
            disabled={disabled}
            onMouseMove={handleMouseMove}
            whileHover={{ scale: disabled ? 1 : 1.02 }}
            whileTap={{ scale: disabled ? 1 : 0.95 }}
            style={{
                "--spotlight-color": spotlightColor,
                "--spotlight-x": `${spotlightPosition.x}%`,
                "--spotlight-y": `${spotlightPosition.y}%`,
            } as React.CSSProperties}
        >
            <div className={styles.spotlight} />
            <span className={styles.content}>{children}</span>
        </motion.button>
    );
}
