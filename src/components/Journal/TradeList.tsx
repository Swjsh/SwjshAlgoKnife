"use client";

import React, { useEffect, useState } from "react";
import GlassPanel from "@/components/UI/GlassPanel";
import styles from "./TradeList.module.css";
import { Trade } from "@/types";
import clsx from "clsx";
import { useFirebaseSync } from "@/lib/hooks/useFirebaseSync";

// Smart price formatting: FX gets 4-5 decimals, crypto/stocks get 2
function formatPrice(price: number): string {
    if (price < 200) return price.toFixed(price > 50 ? 3 : 5); // JPY=3, other FX=5
    if (price > 1000) return price.toFixed(2); // Crypto/indices
    return price.toFixed(2);
}

interface TradeListProps {
    onDataLoad?: (trades: Trade[]) => void;
}

export default function TradeList({ onDataLoad }: TradeListProps) {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);

    // Cloud Sync Hook
    useFirebaseSync(trades, (newTrades) => {
        setTrades(newTrades);
        if (onDataLoad) onDataLoad(newTrades);
    });

    useEffect(() => {
        async function fetchTrades() {
            try {
                const res = await fetch("/api/journal");
                if (res.ok) {
                    const data = await res.json();
                    setTrades(data);
                    if (onDataLoad) onDataLoad(data);
                }
            } catch (err) {
                console.error("Failed to fetch trades", err);
            } finally {
                setLoading(false);
            }
        }
        fetchTrades();
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-[var(--color-text-dim)]">Loading Journal...</div>;
    }

    return (
        <GlassPanel className={styles.panelOverride}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th className={styles.th}>Date</th>
                        <th className={styles.th}>Symbol</th>
                        <th className={styles.th}>Dir</th>
                        <th className={styles.th}>Strategy</th>
                        <th className={styles.th}>Entry</th>
                        <th className={styles.th}>Exit</th>
                        <th className={clsx(styles.th, "text-right")}>Size</th>
                        <th className={clsx(styles.th, "text-right")}>PnL</th>
                        <th className={styles.th}>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {trades.length === 0 ? (
                        <tr>
                            <td colSpan={9} className="text-center py-8 text-[var(--color-text-dim)]">
                                No trades recorded yet.
                            </td>
                        </tr>
                    ) : (
                        trades.map((trade) => (
                            <tr key={trade.id} className={styles.row}>
                                <td className={styles.td}>{new Date(trade.entry_date).toLocaleDateString()} {new Date(trade.entry_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                <td className={clsx(styles.td, styles.mono, styles.bold)}>{trade.symbol}</td>
                                <td className={styles.td}>
                                    <span className={clsx(styles.badge, trade.direction === 'LONG' ? styles.long : styles.short)}>
                                        {trade.direction}
                                    </span>
                                </td>
                                <td className={styles.td}>{trade.strategy}</td>
                                <td className={clsx(styles.td, styles.mono)}>{formatPrice(trade.entry_price)}</td>
                                <td className={clsx(styles.td, styles.mono)}>{trade.exit_price ? formatPrice(trade.exit_price) : '-'}</td>
                                <td className={clsx(styles.td, "text-right", styles.mono)}>{trade.size}</td>
                                <td className={clsx(styles.td, "text-right", styles.mono, trade.pnl && trade.pnl > 0 ? styles.win : trade.pnl && trade.pnl < 0 ? styles.loss : '')}>
                                    {trade.pnl ? (trade.pnl > 0 ? '+' + trade.pnl.toFixed(2) : trade.pnl.toFixed(2)) : '-'}
                                </td>
                                <td className={styles.td}>
                                    <span className={clsx(styles.statusDot,
                                        trade.status === 'WIN' ? styles.bgWin :
                                            trade.status === 'LOSS' ? styles.bgLoss :
                                                trade.status === 'OPEN' ? styles.bgOpen : '')}>
                                    </span>
                                    {trade.status}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </GlassPanel>
    );
}
