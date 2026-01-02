"use client";

import React from 'react';
import styles from './IndicatorControls.module.css';

export interface IndicatorState {
    sma20: boolean;
    sma50: boolean;
    ema200: boolean;
}

interface IndicatorControlsProps {
    indicators: IndicatorState;
    onChange: (indicators: IndicatorState) => void;
}

export default function IndicatorControls({ indicators, onChange }: IndicatorControlsProps) {
    const toggle = (key: keyof IndicatorState) => {
        onChange({ ...indicators, [key]: !indicators[key] });
    };

    return (
        <div className={styles.container}>
            <span className={styles.label}>Indicators:</span>
            <button
                className={`${styles.toggle} ${indicators.sma20 ? styles.active : ''}`}
                onClick={() => toggle('sma20')}
                style={{ '--indicator-color': '#3B82F6' } as React.CSSProperties}
            >
                SMA 20
            </button>
            <button
                className={`${styles.toggle} ${indicators.sma50 ? styles.active : ''}`}
                onClick={() => toggle('sma50')}
                style={{ '--indicator-color': '#F59E0B' } as React.CSSProperties}
            >
                SMA 50
            </button>
            <button
                className={`${styles.toggle} ${indicators.ema200 ? styles.active : ''}`}
                onClick={() => toggle('ema200')}
                style={{ '--indicator-color': '#8B5CF6' } as React.CSSProperties}
            >
                EMA 200
            </button>
        </div>
    );
}
