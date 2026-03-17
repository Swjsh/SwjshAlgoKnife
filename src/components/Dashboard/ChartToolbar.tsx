"use client";

import React from 'react';
import styles from './ChartToolbar.module.css';
import { CandlestickChart, LineChart, AreaChart, Settings2, BarChart3 } from 'lucide-react';
import clsx from 'clsx';

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export type ChartType = 'candles' | 'line' | 'area';
export type LayoutMode = 'standard' | 'kiss' | 'orb';

interface ChartToolbarProps {
    timeframe: Timeframe;
    onTimeframeChange: (tf: Timeframe) => void;
    chartType: ChartType;
    onChartTypeChange: (type: ChartType) => void;
    layoutMode: LayoutMode;
    onLayoutChange: (mode: LayoutMode) => void;
    indicators: {
        sma20: boolean;
        sma50: boolean;
        ema200: boolean;
    };
    onIndicatorToggle: (indicator: 'sma20' | 'sma50' | 'ema200') => void;
}

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

export default function ChartToolbar({
    timeframe,
    onTimeframeChange,
    chartType,
    onChartTypeChange,
    layoutMode,
    onLayoutChange,
    indicators,
    onIndicatorToggle
}: ChartToolbarProps) {
    return (
        <div className={styles.toolbar}>
            {/* Timeframe Toggles */}
            <div className={styles.section}>
                {TIMEFRAMES.map((tf) => (
                    <button
                        key={tf}
                        className={clsx(styles.toolBtn, timeframe === tf && styles.active)}
                        onClick={() => onTimeframeChange(tf)}
                    >
                        {tf}
                    </button>
                ))}
            </div>

            <div className={styles.divider} />

            {/* Chart Type Toggles */}
            <div className={styles.section}>
                <button
                    className={clsx(styles.toolBtn, chartType === 'candles' && styles.active)}
                    onClick={() => onChartTypeChange('candles')}
                    title="Candlesticks"
                >
                    <CandlestickChart size={18} />
                </button>
                <button
                    className={clsx(styles.toolBtn, chartType === 'line' && styles.active)}
                    onClick={() => onChartTypeChange('line')}
                    title="Line"
                >
                    <LineChart size={18} />
                </button>
                <button
                    className={clsx(styles.toolBtn, chartType === 'area' && styles.active)}
                    onClick={() => onChartTypeChange('area')}
                    title="Area"
                >
                    <AreaChart size={18} />
                </button>
            </div>

            <div className={styles.divider} />

            {/* Indicator Toggles */}
            <div className={styles.section}>
                <button
                    className={clsx(styles.toolBtn, indicators.sma20 && styles.active)}
                    onClick={() => onIndicatorToggle('sma20')}
                >
                    SMA 20
                </button>
                <button
                    className={clsx(styles.toolBtn, indicators.sma50 && styles.active)}
                    onClick={() => onIndicatorToggle('sma50')}
                >
                    SMA 50
                </button>
                <button
                    className={clsx(styles.toolBtn, indicators.ema200 && styles.active)}
                    onClick={() => onIndicatorToggle('ema200')}
                >
                    EMA 200
                </button>
            </div>

            {/* Layout Toggles */}
            <div className={styles.section}>
                <select
                    className={styles.layoutSelect}
                    value={layoutMode}
                    onChange={(e) => onLayoutChange(e.target.value as LayoutMode)}
                >
                    <option value="standard">Standard</option>
                    <option value="kiss">K.I.S.S.</option>
                    <option value="orb">ORB GOAT</option>
                </select>
            </div>

            <div className={styles.divider} />

            <div className={styles.spacer} />

            {/* Tools/Settings */}
            <div className={styles.section}>
                <button className={styles.toolBtn} title="Chart Settings">
                    <Settings2 size={18} />
                </button>
                <button className={styles.toolBtn} title="Technical Analysis">
                    <BarChart3 size={18} />
                </button>
            </div>
        </div>
    );
}
