"use client";

import React, { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import styles from "./GlowHoverCard.module.css";

interface GlowHoverCardProps {
    children: React.ReactNode;
    glowColor?: string;
    className?: string;
    borderRadius?: number;
    glowIntensity?: "low" | "medium" | "high";
}

/**
 * Card component with interactive glow effect that follows cursor.
 * Perfect for metric cards and dashboard widgets.
 */
export default function GlowHoverCard({
    children,
    glowColor = "#a855f7",
    className,
    borderRadius = 12,
    glowIntensity = "medium",
}: GlowHoverCardProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const cardRef = useRef<HTMLDivElement>(null);

    const intensityConfig = {
        low: { blur: 40, opacity: 0.15 },
        medium: { blur: 60, opacity: 0.25 },
        high: { blur: 80, opacity: 0.35 },
    };

    const { blur, opacity } = intensityConfig[glowIntensity];

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        setMousePosition({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    }, []);

    return (
        <div
            ref={cardRef}
            className={cn(styles.card, className)}
            style={{
                borderRadius,
                ["--glow-color" as string]: glowColor,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onMouseMove={handleMouseMove}
        >
            {/* Glow effect */}
            <div
                className={styles.glow}
                style={{
                    opacity: isHovered ? opacity : 0,
                    background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, ${glowColor}, transparent 50%)`,
                    filter: `blur(${blur}px)`,
                }}
            />
            {/* Border glow */}
            <div
                className={styles.borderGlow}
                style={{
                    opacity: isHovered ? 1 : 0,
                    borderColor: `${glowColor}40`,
                    boxShadow: isHovered ? `0 0 20px ${glowColor}20, inset 0 0 20px ${glowColor}05` : "none",
                    borderRadius,
                }}
            />
            {/* Content */}
            <div className={styles.content} style={{ borderRadius }}>
                {children}
            </div>
        </div>
    );
}
