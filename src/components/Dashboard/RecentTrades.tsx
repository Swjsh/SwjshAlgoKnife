"use client";

import React, { useEffect, useState } from "react";
import GlassPanel from "@/components/UI/GlassPanel";
import styles from "./ActiveSignals.module.css"; // Reuse list styles or create specific ones
import dashStyles from "@/app/page.module.css";
import clsx from "clsx";

interface Trade {
    id: number;
    symbol: string;
    direction: string;
    entry_price: number;
    exit_price?: number;
    size: number;
    status: string;
    pnl?: number;
    entry_date: string;
}

export default function RecentTrades() {
    const [trades, setTrades] = useState<Trade[]>([]);

    useEffect(() => {
        const fetchTrades = async () => {
            try {
                const res = await fetch("/api/journal");
                if (res.ok) {
                    const data = await res.json();
                    setTrades(data.slice(0, 5)); // Just top 5
                }
            } catch (e) {
                console.error(e);
            }
        };

        fetchTrades();
        const interval = setInterval(fetchTrades, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <GlassPanel title="Recent Executions">
            <table className={dashStyles.table}>
                <thead>
                    <tr>
                        <th className={dashStyles.th}>Time</th>
                        <th className={dashStyles.th}>Pair</th>
                        <th className={dashStyles.th}>Side</th>
                        <th className={dashStyles.th}>Entry</th>
                        <th className={clsx(dashStyles.th, "text-right")}>PnL</th>
                    </tr>
                </thead>
                <tbody>
                    {trades.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="text-center py-8 text-sm text-[var(--color-text-muted)]">No recent trades found.</td>
                        </tr>
                    ) : (
                        trades.map((trade) => (
                            <tr key={trade.id} className={dashStyles.row}>
                                <td className={dashStyles.td}>
                                    {new Date(trade.entry_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className={clsx(dashStyles.td, dashStyles.mono)}>{trade.symbol}</td>
                                <td className={clsx(dashStyles.td, trade.direction === 'LONG' ? dashStyles.success : dashStyles.danger)}>
                                    {trade.direction}
                                </td>
                                <td className={clsx(dashStyles.td, dashStyles.mono)}>{trade.entry_price.toLocaleString()}</td>
                                <td className={clsx(dashStyles.td, "text-right", trade.pnl && trade.pnl >= 0 ? dashStyles.success : dashStyles.danger)}>
                                    {trade.status === 'OPEN' ? 'OPEN' : `$${trade.pnl?.toFixed(2)}`}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </GlassPanel>
    );
}
