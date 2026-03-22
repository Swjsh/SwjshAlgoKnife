"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./EncryptButton.module.css";
import clsx from "clsx";

interface EncryptButtonProps {
    children: React.ReactNode;
    onClick?: () => void | Promise<void>;
    isLoading?: boolean;
    isSuccess?: boolean;
    isError?: boolean;
    loadingText?: string;
    successText?: string;
    errorText?: string;
    className?: string;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
}

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";

/**
 * EncryptButton - A cyberpunk-style button with scrambling text animation
 * during loading state, and visual feedback for success/error states.
 */
export default function EncryptButton({
    children,
    onClick,
    isLoading = false,
    isSuccess = false,
    isError = false,
    loadingText = "PROCESSING...",
    successText = "SUCCESS",
    errorText = "ERROR",
    className,
    disabled = false,
    type = "button",
}: EncryptButtonProps) {
    const [displayText, setDisplayText] = useState<string>("");
    const [isScrambling, setIsScrambling] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const originalText = typeof children === "string" ? children : "";

    // Get current target text based on state
    const getTargetText = useCallback(() => {
        if (isSuccess) return successText;
        if (isError) return errorText;
        if (isLoading) return loadingText;
        return originalText;
    }, [isLoading, isSuccess, isError, loadingText, successText, errorText, originalText]);

    // Scramble effect on state changes
    useEffect(() => {
        const targetText = getTargetText();
        if (!targetText) return;

        // Clear any existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        if (isLoading) {
            // Continuous scrambling during loading
            setIsScrambling(true);
            let frame = 0;
            intervalRef.current = setInterval(() => {
                const scrambled = targetText
                    .split("")
                    .map((char, idx) => {
                        if (char === " ") return " ";
                        // Occasionally show correct char for visual effect
                        if ((frame + idx) % 4 === 0) return char;
                        return CHARS[Math.floor(Math.random() * CHARS.length)];
                    })
                    .join("");
                setDisplayText(scrambled);
                frame++;
            }, 50);
        } else {
            // Decrypt animation to reveal final text
            setIsScrambling(true);
            let iteration = 0;
            const textLength = targetText.length;

            intervalRef.current = setInterval(() => {
                const decrypted = targetText
                    .split("")
                    .map((char, idx) => {
                        if (char === " ") return " ";
                        if (idx < iteration) return char;
                        return CHARS[Math.floor(Math.random() * CHARS.length)];
                    })
                    .join("");

                setDisplayText(decrypted);
                iteration += 0.5;

                if (iteration >= textLength) {
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                    }
                    setDisplayText(targetText);
                    setIsScrambling(false);
                }
            }, 30);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isLoading, isSuccess, isError, getTargetText]);

    // Initialize display text
    useEffect(() => {
        if (!isLoading && !isSuccess && !isError && originalText) {
            setDisplayText(originalText);
        }
    }, [originalText, isLoading, isSuccess, isError]);

    const handleClick = async () => {
        if (disabled || isLoading) return;
        if (onClick) {
            await onClick();
        }
    };

    const buttonState = isSuccess ? "success" : isError ? "error" : isLoading ? "loading" : "idle";

    return (
        <motion.button
            type={type}
            className={clsx(
                styles.button,
                styles[buttonState],
                { [styles.disabled]: disabled || isLoading },
                className
            )}
            onClick={handleClick}
            disabled={disabled || isLoading}
            whileHover={!disabled && !isLoading ? { scale: 1.02 } : undefined}
            whileTap={!disabled && !isLoading ? { scale: 0.98 } : undefined}
        >
            {/* Glow effect layer */}
            <div className={styles.glow} />

            {/* Scan line effect during loading */}
            {isLoading && <div className={styles.scanLine} />}

            {/* Icon indicator */}
            <AnimatePresence mode="wait">
                {isSuccess && (
                    <motion.span
                        key="check"
                        className={styles.icon}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </motion.span>
                )}
                {isError && (
                    <motion.span
                        key="x"
                        className={styles.icon}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </motion.span>
                )}
                {isLoading && (
                    <motion.span
                        key="loading"
                        className={styles.icon}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, rotate: 360 }}
                        exit={{ opacity: 0 }}
                        transition={{
                            opacity: { duration: 0.2 },
                            rotate: { duration: 1, repeat: Infinity, ease: "linear" }
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10" />
                        </svg>
                    </motion.span>
                )}
            </AnimatePresence>

            {/* Text content */}
            <span className={clsx(styles.text, { [styles.scrambling]: isScrambling })}>
                {displayText || children}
            </span>

            {/* Border animation */}
            <div className={styles.borderTop} />
            <div className={styles.borderBottom} />
        </motion.button>
    );
}
