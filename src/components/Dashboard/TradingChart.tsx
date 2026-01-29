"use client";

import React, { useEffect, useRef } from 'react';
import {
    createChart,
    ColorType,
    IChartApi,
    ISeriesApi,
    Time,
    LineStyle,
    CandlestickData,
    UTCTimestamp,
    AreaSeries,
    CandlestickSeries,
    LineSeries,
    MouseEventParams,
    IPriceLine,
    SeriesMarker,
    createSeriesMarkers,
    ISeriesMarkersPluginApi
} from 'lightweight-charts';
import { IndicatorState } from './IndicatorControls';
import { LayoutMode } from './ChartToolbar';

interface ChartProps {
    data?: CandlestickData[];
    indicators?: IndicatorState;
    chartType?: 'candles' | 'line' | 'area';
    layoutMode?: LayoutMode;
    timeframe?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
    currentPrice?: number;
    onMarkLevel?: (price: number) => void;
    markers?: SeriesMarker<Time>[];
}

// Sample Data Generator
// Sample Data Generator matches current price to prevent jumps
const generateSampleData = (timeframe: string = '15m', endPrice: number = 98000) => {
    const data = [];
    const tfSeconds: Record<string, number> = {
        '1m': 60,
        '5m': 300,
        '15m': 900,
        '1h': 3600,
        '4h': 14400,
        '1d': 86400
    };
    const step = tfSeconds[timeframe] || 900;

    // Generate BACKWARDS from now to ensure the last candle aligns with live price
    let time = Math.floor(Date.now() / 1000);
    // Align time to step
    time = time - (time % step);

    let currentClose = endPrice;

    // Generate 100 candles going backwards
    for (let i = 0; i < 100; i++) {
        const volatility = currentClose * 0.001; // 0.1% volatility
        const close = currentClose;
        const open = close + (Math.random() - 0.5) * volatility * 2;
        const high = Math.max(open, close) + Math.random() * volatility;
        const low = Math.min(open, close) - Math.random() * volatility;

        // Prepend to array because we are going backwards
        data.unshift({
            time: (time - (i * step)) as UTCTimestamp,
            open,
            high,
            low,
            close,
        });

        // The "previous" candle's close (which is next in loop) should be near this open
        currentClose = open;
    }
    return data;
};

// Calculate SMA
const calculateSMA = (data: CandlestickData[], period: number) => {
    const result: { time: Time; value: number }[] = [];
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j].close;
        }
        result.push({
            time: data[i].time,
            value: sum / period,
        });
    }
    return result;
};

// Calculate EMA
const calculateEMA = (data: CandlestickData[], period: number) => {
    const result: { time: Time; value: number }[] = [];
    // Standard EMA formula: Price(t) * k + EMA(y) * (1 – k)
    // k = 2 / (N + 1)
    const k = 2 / (period + 1);

    // Seed with SMA for the first point or just close
    let ema = data[0].close;
    result.push({ time: data[0].time as Time, value: ema });

    for (let i = 1; i < data.length; i++) {
        ema = data[i].close * k + ema * (1 - k);
        result.push({
            time: data[i].time as Time,
            value: ema,
        });
    }
    return result;
};

export default function TradingChart({ data = [], indicators, chartType, layoutMode = 'standard', timeframe, currentPrice, onMarkLevel, markers = [] }: ChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const sma20Ref = useRef<ISeriesApi<"Line"> | null>(null);
    const sma50Ref = useRef<ISeriesApi<"Line"> | null>(null);
    const ema200Ref = useRef<ISeriesApi<"Line"> | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
    const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const areaSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
    const levelsRef = useRef<Map<number, IPriceLine>>(new Map());

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: 'rgba(255, 255, 255, 0.7)',
                fontSize: 12,
                fontFamily: 'Inter, system-ui, sans-serif'
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.08)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.08)' },
            },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight || 480,
            timeScale: {
                borderColor: 'rgba(255, 255, 255, 0.15)',
                timeVisible: true,
                secondsVisible: false,
            },
            rightPriceScale: {
                borderColor: 'rgba(255, 255, 255, 0.15)',
            },
            crosshair: {
                vertLine: {
                    color: 'rgba(255, 255, 255, 0.3)',
                    width: 1,
                    style: LineStyle.Dashed,
                },
                horzLine: {
                    color: 'rgba(255, 255, 255, 0.3)',
                    width: 1,
                    style: LineStyle.Dashed,
                },
            }
        });

        chartRef.current = chart;

        // Area Series (Line/Area mode)
        const areaSeries = chart.addSeries(AreaSeries, {
            lineColor: '#8B5CF6',
            topColor: 'rgba(139, 92, 246, 0.4)',
            bottomColor: 'rgba(139, 92, 246, 0.0)',
            lineWidth: 2,
            visible: chartType === 'area' || chartType === 'line',
        });
        areaSeriesRef.current = areaSeries;

        // Candlesticks
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#F7931A',
            downColor: '#F472B6',
            borderVisible: false,
            wickUpColor: '#F7931A',
            wickDownColor: '#F472B6',
            visible: chartType === 'candles' || !chartType,
        });
        candleSeriesRef.current = candleSeries;

        // Use currentPrice to seed history, or default to 95000 if not yet available (prevent 0 issue)
        // If currentPrice is small (like Forex 1.05), use that.
        const seedPrice = currentPrice && currentPrice > 0 ? currentPrice : 95000;

        const chartData = data.length > 0 ? data : generateSampleData(timeframe, seedPrice);
        candleSeries.setData(chartData);
        areaSeries.setData(chartData.map(d => ({ time: d.time, value: d.close })));

        // Update the ref to the last candle so live updates are smooth immediately
        if (chartData.length > 0) {
            currentCandleRef.current = chartData[chartData.length - 1];
        }

        // Initialize markers plugin
        const markersPlugin = createSeriesMarkers(candleSeries, markers || []);
        markersPluginRef.current = markersPlugin;

        // Logic for Layout Modes
        if (layoutMode === 'kiss') {
            // K.I.S.S. Ribbon (EMA 8, 21, 34, 50, 200)
            const ribbons = [
                { period: 8, color: '#4ade80', width: 2 },   // Green (Fast)
                { period: 21, color: '#facc15', width: 2 },  // Yellow
                { period: 34, color: '#fb923c', width: 2 },  // Orange
                { period: 50, color: '#f87171', width: 2 },  // Red (Slow)
                { period: 200, color: '#fff', width: 3, style: LineStyle.Dashed }, // 200 Trend
            ];

            // Correct Loop with valid API usage
            ribbons.forEach(r => {
                const series = chart.addSeries(LineSeries, {
                    color: r.color,
                    lineWidth: r.width as any,
                    lineStyle: r.style || LineStyle.Solid,
                    crosshairMarkerVisible: false,
                    priceLineVisible: false,
                });
                series.setData(calculateEMA(chartData, r.period));
            });

        } else if (layoutMode === 'orb') {
            // ORB GOAT Mode
            // Simulate Opening Range Breakout: High/Low of the first few candles
            if (chartData.length > 5) {
                // Take first 4 candles of the dataset as the "Opening Range"
                const orbRange = chartData.slice(0, 4);
                const orbHigh = Math.max(...orbRange.map(d => d.high));
                const orbLow = Math.min(...orbRange.map(d => d.low));

                // High Line
                const highSeries = chart.addSeries(LineSeries, {
                    color: '#0ea5e9', // Sky Blue
                    lineWidth: 2,
                    title: 'ORB HIGH',
                });
                highSeries.setData(chartData.map(d => ({ time: d.time as Time, value: orbHigh })));

                // Low Line
                const lowSeries = chart.addSeries(LineSeries, {
                    color: '#d946ef', // Fuchsia
                    lineWidth: 2,
                    title: 'ORB LOW',
                });
                lowSeries.setData(chartData.map(d => ({ time: d.time as Time, value: orbLow })));
            }

        } else {
            // STANDARD MODE: Uses User Toggles

            // SMA 20 - Blue
            const sma20Series = chart.addSeries(LineSeries, {
                color: '#3B82F6',
                lineWidth: 2,
                visible: indicators?.sma20 ?? false,
            });
            sma20Series.setData(calculateSMA(chartData, 20));
            sma20Ref.current = sma20Series;

            // SMA 50 - Yellow
            const sma50Series = chart.addSeries(LineSeries, {
                color: '#F59E0B',
                lineWidth: 2,
                visible: indicators?.sma50 ?? false,
            });
            sma50Series.setData(calculateSMA(chartData, 50));
            sma50Ref.current = sma50Series;

            // EMA 200 - Purple
            const ema200Series = chart.addSeries(LineSeries, {
                color: '#8B5CF6',
                lineWidth: 2,
                visible: indicators?.ema200 ?? false,
            });
            ema200Series.setData(calculateEMA(chartData, 200));
            ema200Ref.current = ema200Series;
        }

        chart.timeScale().fitContent();

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [data, timeframe]);

    // Update markers safely
    // In lightweight-charts, setMarkers is called directly on the series
    useEffect(() => {
        if (!markersPluginRef.current) return;

        try {
            markersPluginRef.current.setMarkers(markers || []);
        } catch (e) {
            console.error("Failed to update markers", e);
        }
    }, [markers]);

    // Update chart type visibility
    useEffect(() => {
        if (!candleSeriesRef.current || !areaSeriesRef.current) return;

        candleSeriesRef.current.applyOptions({ visible: chartType === 'candles' });
        areaSeriesRef.current.applyOptions({
            visible: chartType === 'area' || chartType === 'line',
            lineVisible: true,
            topColor: chartType === 'area' ? 'rgba(139, 92, 246, 0.4)' : 'transparent',
        });
    }, [chartType]);

    // Update indicator visibility
    useEffect(() => {
        if (sma20Ref.current) {
            sma20Ref.current.applyOptions({ visible: indicators?.sma20 ?? false });
        }
        if (sma50Ref.current) {
            sma50Ref.current.applyOptions({ visible: indicators?.sma50 ?? false });
        }
        if (ema200Ref.current) {
            ema200Ref.current.applyOptions({ visible: indicators?.ema200 ?? false });
        }
    }, [indicators]);

    // Track the current candle state to prevent jitter
    const currentCandleRef = useRef<CandlestickData | null>(null);

    // Reset current candle ref when data or timeframe changes
    useEffect(() => {
        currentCandleRef.current = null;
    }, [data, timeframe]);

    // Update with live price
    useEffect(() => {
        if (!candleSeriesRef.current || !areaSeriesRef.current || !currentPrice) return;

        const tfSeconds: Record<string, number> = {
            '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400
        };
        const step = tfSeconds[timeframe || '15m'] || 900;
        const now = Math.floor(Date.now() / 1000);
        const quantizedTime = (now - (now % step)) as UTCTimestamp;

        if (chartType === 'area' || chartType === 'line') {
            areaSeriesRef.current.update({ time: quantizedTime, value: currentPrice });
        } else {
            // Check if we already have a candle for this time slot
            let candle = currentCandleRef.current;

            // If it's a new time slot or we don't have a candle yet, start fresh
            if (!candle || candle.time !== quantizedTime) {
                // Try to see if the last data point matches this time (unlikely if data is historical, but good check)
                const lastData = data[data.length - 1];
                if (lastData && lastData.time === quantizedTime) {
                    candle = { ...lastData };
                } else {
                    // Start new candle from current price
                    candle = {
                        time: quantizedTime,
                        open: currentPrice,
                        high: currentPrice,
                        low: currentPrice,
                        close: currentPrice,
                    };
                }
            }

            // Update High/Low/Close based on new price
            if (candle) {
                candle.close = currentPrice;
                candle.high = Math.max(candle.high, currentPrice);
                candle.low = Math.min(candle.low, currentPrice);

                // Update the ref
                currentCandleRef.current = candle;

                // Update the chart
                candleSeriesRef.current.update(candle);
            }
        }
    }, [currentPrice, timeframe, chartType]);

    // Handle Level Marking
    useEffect(() => {
        if (!chartRef.current || !candleSeriesRef.current) return;

        const handleChartClick = (param: MouseEventParams) => {
            if (!param.point || !candleSeriesRef.current || !chartRef.current) return;

            const price = candleSeriesRef.current.coordinateToPrice(param.point.y);

            if (price && onMarkLevel) {
                onMarkLevel(price);

                // Draw a horizontal line for this level
                const priceLine = candleSeriesRef.current.createPriceLine({
                    price: price,
                    color: '#FBBF24',
                    lineWidth: 2,
                    lineStyle: LineStyle.Dashed,
                    axisLabelVisible: true,
                    title: 'S/R Level',
                });

                console.log(`Placed S/R Level at ${price.toFixed(2)}`);
            }
        };

        chartRef.current.subscribeClick(handleChartClick);
        return () => chartRef.current?.unsubscribeClick(handleChartClick);
    }, [onMarkLevel]);

    return <div ref={chartContainerRef} className="chartContainer" style={{ width: '100%', height: '100%', minHeight: '480px' }} />;
}
