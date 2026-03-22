"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import styles from "./ShimmerButton.module.css";

interface ShimmerButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    shimmerColor?: string;
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
    disabled?: boolean;
    className?: string;
    size?: "sm" | "md" | "lg";
}

/**
 * Premium button with animated shimmer effect.
 * Perfect for CTAs and important actions like kill switches.
 */
export default function ShimmerButton({
    children,
    onClick,
    shimmerColor = "#06b6d4",
    backgroundColor,
    borderColor,
    textColor,
    disabled = false,
    className,
    size = "md",
}: ShimmerButtonProps) {
    const [isHovered, setIsHovered] = useState(false);

    const bgColor = backgroundColor || `${shimmerColor}15`;
    const border = borderColor || `${shimmerColor}40`;
    const text = textColor || shimmerColor;

    const sizeStyles = {
        sm: { padding: "6px 12px", fontSize: 11 },
        md: { padding: "8px 16px", fontSize: 12 },
        lg: { padding: "10px 20px", fontSize: 14 },
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(styles.button, disabled && styles.disabled, className)}
            style={{
                ...sizeStyles[size],
                backgroundColor: isHovered && !disabled ? `${shimmerColor}25` : bgColor,
                borderColor: isHovered && !disabled ? `${shimmerColor}60` : border,
                color: text,
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
                ["--shimmer-color" as string]: shimmerColor,
            }}
        >
            {/* Shimmer overlay */}
            <div
                className={styles.shimmer}
                style={{
                    background: `linear-gradient(
                        110deg,
                        transparent 25%,
                        ${shimmerColor}30 45%,
                        ${shimmerColor}50 50%,
                        ${shimmerColor}30 55%,
                        transparent 75%
                    )`,
                }}
            />
            {/* Button content */}
            <span className={styles.content}>{children}</span>
        </button>
    );
}
