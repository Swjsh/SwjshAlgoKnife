'use client';

import React, { useMemo } from 'react';
import { SeriesMarker, UTCTimestamp } from 'lightweight-charts';
import TradingChart from './TradingChart';
import { useMarketData, Timeframe } from '@/hooks/useMarketData';
import { AgentState } from '@/context/AgentContext';
import { IndicatorState } from './IndicatorControls';
import { LayoutMode } from './ChartToolbar';

// Map agent IDs to their primary symbols and default prices
const AGENT_SYMBOLS: Record<string, { symbol: string; defaultPrice: number }> = {
    fx: { symbol: 'EURUSD', defaultPrice: 1.0850 },
    crypto: { symbol: 'BTCUSD', defaultPrice: 95000 },
    spx: { symbol: 'SPY', defaultPrice: 580 },
    futures: { symbol: 'ES', defaultPrice: 5800 },
    boba: { symbol: 'SPY', defaultPrice: 580 },
    professor: { symbol: 'BTCUSD', defaultPrice: 95000 },
    auditor: { symbol: 'BTCUSD', defaultPrice: 95000 },
};

// Map agent IDs to their preferred indicators
const AGENT_INDICATORS: Record<string, IndicatorState> = {
    fx: { sma20: true, sma50: true, ema200: true, vwap: false, bbands: false, rsi: false },
    crypto: { sma20: false, sma50: false, ema200: true, vwap: false, bbands: true, rsi: false },
    spx: { sma20: true, sma50: false, ema200: false, vwap: true, bbands: false, rsi: false },
    futures: { sma20: false, sma50: true, ema200: true, vwap: false, bbands: false, rsi: false },
    boba: { sma20: true, sma50: false, ema200: false, vwap: true, bbands: false, rsi: false },
    professor: { sma20: false, sma50: false, ema200: false, vwap: false, bbands: false, rsi: false },
    auditor: { sma20: false, sma50: false, ema200: false, vwap: false, bbands: false, rsi: false },
};

// Map agent IDs to their preferred layout mode
const AGENT_LAYOUT: Record<string, LayoutMode> = {
    fx: 'orb',       // FX uses ORB strategy
    crypto: 'standard',
    spx: 'orb',
    futures: 'standard',
    boba: 'standard',
    professor: 'standard',
    auditor: 'standard',
};

// Map agent IDs to their preferred timeframe
const AGENT_TIMEFRAME: Record<string, Timeframe> = {
    fx: '15m',
    crypto: '15m',
    spx: '5m',
    futures: '15m',
    boba: '5m',
    professor: '1h',
    auditor: '1h',
};

interface AgentChartViewProps {
    agentId: string;
    agent: AgentState;
    height?: string;
}

export default function AgentChartView({ agentId, agent, height = '400px' }: AgentChartViewProps) {
    const config = AGENT_SYMBOLS[agentId] || AGENT_SYMBOLS.crypto;
    const indicators = AGENT_INDICATORS[agentId] || {};
    const layoutMode = AGENT_LAYOUT[agentId] || 'standard';
    const timeframe = AGENT_TIMEFRAME[agentId] || '15m';

    // Get market data for this agent's symbol
    const { data, currentPrice, markers: baseMarkers } = useMarketData({
        symbol: config.symbol,
        initialPrice: config.defaultPrice,
        timeframe,
    });

    // Convert agent's pending orders and active trades to chart markers
    const tradeMarkers: SeriesMarker<UTCTimestamp>[] = useMemo(() => {
        const markers: SeriesMarker<UTCTimestamp>[] = [];

        // Add markers for pending orders (zones the agent is watching)
        agent.pending_orders?.forEach((order, idx) => {
            const now = Math.floor(Date.now() / 1000) as UTCTimestamp;
            markers.push({
                time: now,
                position: order.type === 'DEMAND' || order.side === 'LONG' ? 'belowBar' : 'aboveBar',
                color: '#fbbf24', // Amber for pending
                shape: 'circle',
                text: `📍 ${order.ticker} @ ${order.entry}`,
            });
        });

        // Add markers for active trades
        agent.active_trades?.forEach((trade) => {
            const now = Math.floor(Date.now() / 1000) as UTCTimestamp;
            const isLong = trade.side === 'LONG' || trade.type === 'DEMAND';
            markers.push({
                time: now,
                position: isLong ? 'belowBar' : 'aboveBar',
                color: isLong ? '#10b981' : '#ef4444',
                shape: isLong ? 'arrowUp' : 'arrowDown',
                text: `🔥 ${trade.ticker} ACTIVE`,
            });
        });

        return markers;
    }, [agent.pending_orders, agent.active_trades]);

    // Combine base markers with trade markers
    const allMarkers = useMemo(() => {
        return [...baseMarkers, ...tradeMarkers];
    }, [baseMarkers, tradeMarkers]);

    return (
        <div className="relative w-full rounded-xl overflow-hidden bg-black/20 border border-white/10" style={{ height }}>
            {/* Symbol Badge */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-white/10 backdrop-blur-md text-sm font-mono text-white/80 border border-white/10">
                    {config.symbol}
                </span>
                <span className="px-2 py-1 rounded-lg bg-purple-500/20 backdrop-blur-md text-xs font-medium text-purple-300 border border-purple-500/30">
                    {timeframe}
                </span>
                <span className="px-2 py-1 rounded-lg bg-blue-500/20 backdrop-blur-md text-xs font-medium text-blue-300 border border-blue-500/30 uppercase">
                    {layoutMode}
                </span>
            </div>

            {/* Live Price */}
            <div className="absolute top-3 right-3 z-10">
                <span className="px-3 py-1 rounded-lg bg-emerald-500/20 backdrop-blur-md text-sm font-mono text-emerald-300 border border-emerald-500/30">
                    {currentPrice.toFixed(config.symbol === 'EURUSD' ? 5 : 2)}
                </span>
            </div>

            {/* Active Trade Indicator */}
            {agent.active_trades && agent.active_trades.length > 0 && (
                <div className="absolute top-12 right-3 z-10">
                    <div className="px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500/30 to-blue-500/30 backdrop-blur-md border border-emerald-500/50 animate-pulse">
                        <span className="text-xs font-bold text-white">
                            🔥 IN TRADE: {agent.active_trades[0].ticker} {agent.active_trades[0].side}
                        </span>
                    </div>
                </div>
            )}

            {/* Pending Zones */}
            {agent.pending_orders && agent.pending_orders.length > 0 && (
                <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-1 max-w-[60%]">
                    {agent.pending_orders.slice(0, 3).map((order, idx) => (
                        <span
                            key={idx}
                            className="px-2 py-1 rounded bg-amber-500/20 backdrop-blur-md text-[10px] font-mono text-amber-300 border border-amber-500/30"
                        >
                            {order.type || order.side}: {order.ticker} @ {order.entry}
                        </span>
                    ))}
                </div>
            )}

            {/* The Chart */}
            <TradingChart
                data={data}
                indicators={indicators}
                chartType="candles"
                layoutMode={layoutMode}
                timeframe={timeframe}
                currentPrice={currentPrice}
                markers={allMarkers}
            />
        </div>
    );
}
