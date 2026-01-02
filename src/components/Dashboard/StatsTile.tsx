'use client';

import React from 'react';
import styles from './StatsTile.module.css';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatsTileProps {
    label: string;
    value: string | number;
    subValue?: string;
    icon: LucideIcon;
    trend?: 'positive' | 'negative' | 'neutral';
    progress?: number; // 0 to 100 for the bar
}

export default function StatsTile({ label, value, subValue, icon: Icon, trend = 'neutral', progress }: StatsTileProps) {

    const trendColor = {
        positive: '#10b981',
        negative: '#ef4444',
        neutral: '#64748b'
    }[trend];

    return (
        <motion.div
            className={styles.tile}
            whileHover={{ y: -2 }}
            style={{ '--glow-color': `${trendColor}33` } as React.CSSProperties} // 33 = 20% opacity hex
        >
            <div className={styles.glow} />

            <div className={styles.header}>
                <span className={styles.label}>
                    {label}
                </span>
                <Icon size={16} className={styles.icon} />
            </div>

            <div className={styles.content}>
                <span className={`
                    ${styles.value} 
                    ${trend === 'positive' ? styles.valuePositive : ''}
                    ${trend === 'negative' ? styles.valueNegative : ''}
                `}>
                    {value}
                </span>
                {subValue && <span className={styles.subtext}>{subValue}</span>}
            </div>

            {progress !== undefined && (
                <div className={styles.progressContainer}>
                    <motion.div
                        className={`
                            ${styles.progressBar}
                            ${trend === 'positive' ? styles.progressBarPositive : ''}
                            ${trend === 'negative' ? styles.progressBarNegative : ''}
                            ${trend === 'neutral' ? styles.progressBarNeutral : ''}
                        `}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                    />
                </div>
            )}
        </motion.div>
    );
}
