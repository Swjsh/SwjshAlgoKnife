"use client";

import React from "react";
import GlassPanel from "@/components/UI/GlassPanel";
import { TrendingUp, Target, BarChart3, Wallet } from "lucide-react";
import styles from "./AnalyticsHeader.module.css";
import clsx from "clsx";

interface Trade {
    pnl?: number;
    status: string;
}

interface AnalyticsHeaderProps {
    trades: Trade[];
}

export default function AnalyticsHeader({ trades }: AnalyticsHeaderProps) {
    // Only count trades that have actually been completed (not raw signals or open positions)
    const CLOSED_STATUSES = ['WIN', 'LOSS', 'CLOSED', 'BE', 'CANCELLED'];
    const closedTrades = trades.filter(t => CLOSED_STATUSES.includes(t.status?.toUpperCase?.() ?? t.status));

    const totalTrades = closedTrades.length;
    const wins = closedTrades.filter(t => t.status === 'WIN').length;
    const winRate = totalTrades > 0 ? (wins / totalTrades * 100).toFixed(1) : "0.0";

    const totalPnL = trades.reduce((acc, t) => acc + (t.pnl || 0), 0);

    const grossProfit = closedTrades.filter(t => (t.pnl || 0) > 0).reduce((acc, t) => acc + (t.pnl || 0), 0);
    const grossLoss = Math.abs(closedTrades.filter(t => (t.pnl || 0) < 0).reduce((acc, t) => acc + (t.pnl || 0), 0));
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : (grossProfit > 0 ? "∞" : "0.00");

    return (
        <div className={styles.grid}>
            <GlassPanel className={styles.statCard}>
                <div className={styles.statContent}>
                    <div className={styles.label}>
                        <Wallet size={16} /> Total PnL
                    </div>
                    <div className={clsx(styles.value, totalPnL >= 0 ? styles.success : styles.danger)}>
                        ${totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
            </GlassPanel>

            <GlassPanel className={styles.statCard}>
                <div className={styles.statContent}>
                    <div className={styles.label}>
                        <Target size={16} /> Win Rate
                    </div>
                    <div className={styles.value}>{winRate}%</div>
                    <div className={styles.sublabel}>{wins} Wins / {totalTrades} Total</div>
                </div>
            </GlassPanel>

            <GlassPanel className={styles.statCard}>
                <div className={styles.statContent}>
                    <div className={styles.label}>
                        <TrendingUp size={16} /> Profit Factor
                    </div>
                    <div className={styles.value}>{profitFactor}</div>
                    <div className={styles.sublabel}>Ratio W/L</div>
                </div>
            </GlassPanel>

            <GlassPanel className={styles.statCard}>
                <div className={styles.statContent}>
                    <div className={styles.label}>
                        <BarChart3 size={16} /> Total Trades
                    </div>
                    <div className={styles.value}>{totalTrades}</div>
                    <div className={styles.sublabel}>Closed Trades</div>
                </div>
            </GlassPanel>
        </div>
    );
}
