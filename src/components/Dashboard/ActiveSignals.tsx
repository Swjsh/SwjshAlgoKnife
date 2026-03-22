"use client";

import React, { useEffect, useState } from "react";
import GlassPanel from "@/components/UI/GlassPanel";
import { ArrowUpRight, ArrowDownRight, Activity, ZapOff } from "lucide-react";
import styles from "./ActiveSignals.module.css";

interface Signal {
    id: number;
    timestamp: string;
    symbol: string;
    action: string;
    price: number;
    strategy?: string;
}

export default function ActiveSignals() {
    const [signals, setSignals] = useState<Signal[]>([]);

    useEffect(() => {
        const fetchSignals = async () => {
            try {
                const res = await fetch("/api/signals");
                if (res.ok) {
                    const data = await res.json();
                    setSignals(data);
                }
            } catch (e) {
                console.error(e);
            }
        };

        fetchSignals();
        const interval = setInterval(fetchSignals, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    return (
        <GlassPanel
            title="Active Signals"
            action={<span className={styles.liveBadge}>LISTENING</span>}
            className={styles.panelHeight}
        >
            <div className={styles.list}>
                {signals.length === 0 ? (
                    <div className={styles.emptyState}>
                        <ZapOff size={24} />
                        <div className={styles.emptyText}>Waiting for TV Hookup</div>
                    </div>
                ) : (
                    signals.map((signal) => (
                        <div key={signal.id} className={styles.signalItem}>
                            <div className={styles.signalMain}>
                                <div className={styles.pair}>{signal.symbol}</div>
                                <div className={styles.strategy}>{signal.strategy || 'Price Action'}</div>
                            </div>

                            <div className={styles.signalInfo}>
                                <div className={styles.tag} data-type={signal.action}>
                                    {signal.action === "BUY" || signal.action === "LONG" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                    {signal.action}
                                </div>
                                <div className={styles.price}>
                                    {signal.price}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </GlassPanel>
    );
}
