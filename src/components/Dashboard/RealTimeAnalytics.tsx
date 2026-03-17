'use client';

import React, { useState, useEffect } from 'react';
import styles from './RealTimeAnalytics.module.css';
import TradingChart from './TradingChart';
import ChartToolbar, { Timeframe, ChartType, LayoutMode } from './ChartToolbar';
import { IndicatorState } from './IndicatorControls';
import { motion, AnimatePresence } from 'framer-motion';
import { useMarketData } from '@/hooks/useMarketData';

interface RealTimeAnalyticsProps {
    symbol?: string; // e.g. "BTC/USD"
    price?: number;
}

export default function RealTimeAnalytics({ symbol = 'BTC/USD', price = 98250 }: RealTimeAnalyticsProps) {
    // Local State for Controls
    const [timeframe, setTimeframe] = useState<Timeframe>('1h');
    const [chartType, setChartType] = useState<ChartType>('candles');
    const [layoutMode, setLayoutMode] = useState<LayoutMode>('standard');
    const [indicators, setIndicators] = useState<IndicatorState>({
        sma20: true,
        sma50: false,
        ema200: true,
        vwap: false,
        bbands: false,
        rsi: false
    });

    // Custom Hook for Stable Data
    const { data, currentPrice, liveCandle, markers } = useMarketData({
        symbol,
        initialPrice: price,
        timeframe
    });

    // Stats for HUD (Derived from live data)
    const [stats, setStats] = useState({
        change: 2.4,
        high: price * 1.02,
        low: price * 0.98,
    });

    // Update stats based on current price movement
    useEffect(() => {
        const startPrice = data[0]?.close || price;
        const changePct = ((currentPrice - startPrice) / startPrice) * 100;

        setStats(prev => ({
            change: parseFloat(changePct.toFixed(2)),
            high: Math.max(prev.high, currentPrice),
            low: Math.min(prev.low, currentPrice)
        }));
    }, [currentPrice, data, price]);

    const handleIndicatorToggle = (key: keyof IndicatorState) => {
        setIndicators(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const isPositive = stats.change >= 0;

    return (
        <div className={styles.container}>
            {/* HUD Overlay */}
            <div className={styles.headerOverlay}>
                <div className={styles.liveIndicator}>
                    <div className={styles.liveDot} />
                    <span className={styles.liveText}>Live Market</span>
                </div>

                <div className={styles.priceDisplay}>
                    <motion.div
                        key={Math.floor(currentPrice)} // Only animate on significant changes
                        initial={{ opacity: 0.8, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={styles.currentPrice}
                    >
                        ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </motion.div>

                    <div className={styles.priceMeta}>
                        <span className={`${styles.change} ${isPositive ? styles.changePositive : styles.changeNegative}`}>
                            {isPositive ? '+' : ''}{stats.change}%
                        </span>
                        <div className={styles.highLow}>
                            <span>H: {stats.high.toLocaleString()}</span>
                            <span>L: {stats.low.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Toolbar */}
            <div className={styles.toolbarOverlay}>
                <div className={styles.toolbarOverride}>
                    <ChartToolbar
                        timeframe={timeframe}
                        onTimeframeChange={setTimeframe}
                        chartType={chartType}
                        onChartTypeChange={setChartType}
                        layoutMode={layoutMode}
                        onLayoutChange={setLayoutMode}
                        indicators={indicators}
                        onIndicatorToggle={handleIndicatorToggle}
                    />
                </div>
            </div>

            {/* The Chart */}
            <div className={styles.chartWrapper}>
                <TradingChart
                    data={data}
                    timeframe={timeframe}
                    chartType={chartType}
                    layoutMode={layoutMode}
                    indicators={indicators}
                    currentPrice={currentPrice}
                    markers={markers}
                />
            </div>
        </div>
    );
}
