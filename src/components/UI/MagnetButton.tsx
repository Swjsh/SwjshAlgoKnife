"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import styles from "./MagnetButton.module.css";
import clsx from "clsx";

interface MagnetButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    type?: "button" | "submit" | "reset";
}

/**
 * MagnetButton - Button that follows cursor with magnetic effect
 * Ideal for secondary actions like Pause, Configure
 */
export default function MagnetButton({
    children,
    onClick,
    disabled = false,
    className,
    type = "button",
}: MagnetButtonProps) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled) return;

        const button = buttonRef.current;
        if (!button) return;

        const rect = button.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Calculate distance from center (capped at 8px movement)
        const maxMove = 8;
        const x = ((e.clientX - centerX) / rect.width) * maxMove;
        const y = ((e.clientY - centerY) / rect.height) * maxMove;

        setPosition({ x, y });
    };

    const handleMouseLeave = () => {
        setPosition({ x: 0, y: 0 });
    };

    return (
        <motion.button
            ref={buttonRef}
            type={type}
            className={clsx(styles.button, className)}
            onClick={onClick}
            disabled={disabled}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            animate={{
                x: position.x,
                y: position.y,
            }}
            transition={{
                type: "spring",
                stiffness: 150,
                damping: 15,
                mass: 0.1,
            }}
            whileTap={{ scale: disabled ? 1 : 0.95 }}
        >
            <span className={styles.content}>{children}</span>
        </motion.button>
    );
}
