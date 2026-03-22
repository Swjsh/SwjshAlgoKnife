"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import GlassPanel from "@/components/UI/GlassPanel";
import { Book, Lightbulb, TrendingUp, Target, ShieldCheck } from "lucide-react";
import styles from "./Research.module.css";

const RESEARCH_DATA = [
    {
        id: 'vwap',
        title: "The VWAP Hypothesis",
        source: "r/algotrading",
        icon: <Target size={20} className={styles.iconCyan} />,
        thesis: "Institutional traders use VWAP as a gold standard for 'Fair Value'. When price deviates significantly without news, liquidity providers push it back to the mean.",
        edge: "Identifies overextended markets where others are 'chasing'."
    },
    {
        id: 'squeeze',
        title: "Volatility Squeeze",
        source: "John Carter / Reddit",
        icon: <ShieldCheck size={20} className={styles.iconPurple} />,
        thesis: "Price moves from periods of low volatility to high volatility. The 'Squeeze' identifies compressed energy before a massive directional release.",
        edge: "Catch moves before they happen on the chart."
    },
    {
        id: 'three_ducks',
        title: "Three Ducks System",
        source: "Andy Perry / Captain Currency",
        icon: <TrendingUp size={20} className={styles.iconGreen} />,
        thesis: "Probability increases when 3 timeframes align. Using a 60 SMA on 4H, 1H, and 15m provides a powerful filter against counter-trend mistakes.",
        edge: "Extremely high win rate in trending crypto regimes."
    }
];

export default function ResearchLedger() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.replace('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0a0a12',
                color: 'rgba(255,255,255,0.5)'
            }}>
                <div>🔐 Verifying authentication...</div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h2 className="text-2xl font-bold">Research Ledger</h2>
                <p className="text-[var(--color-text-dim)]">Deep-dive into the mathematical edge of your selected algorithms.</p>
            </header>

            <div className={styles.ledgerGrid}>
                {RESEARCH_DATA.map((entry) => (
                    <GlassPanel key={entry.id} title={entry.title}>
                        <div className={styles.entry}>
                            <div className={styles.entryHeader}>
                                {entry.icon}
                                <span className={styles.sourceTag}>{entry.source}</span>
                            </div>
                            <p className={styles.thesis}><strong>Thesis:</strong> {entry.thesis}</p>
                            <div className={styles.edgeBox}>
                                <strong>The Edge:</strong> {entry.edge}
                            </div>
                        </div>
                    </GlassPanel>
                ))}
            </div>
        </div>
    );
}
