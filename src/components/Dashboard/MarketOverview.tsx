"use client";

import React from "react";
import GlassPanel from "@/components/UI/GlassPanel";
import { TrendingUp, DollarSign, BarChart3, Activity } from "lucide-react";
import { useCryptoPrice } from "@/lib/hooks/useCryptoPrice";
import styles from "./MarketOverview.module.css";

interface MarketOverviewProps {
    price: string;
    change: string;
    volume: string;
    high?: string;
    low?: string;
    spread?: string;
}

export default function MarketOverview({ price, change, volume, high = "0.00", low = "0.00", spread = "0.00" }: MarketOverviewProps) {

    return (
        <GlassPanel className={styles.panelOverride}>
            <div className={styles.container}>
                <div className={styles.brandInfo}>
                    <div className={styles.iconBox}>
                        <Activity className={styles.brandIcon} size={20} />
                    </div>
                    <div>
                        <h2 className={styles.title}>
                            Market Pulse
                        </h2>
                        <p className={styles.subtitle}>
                            BTC/USDT Aggregated Feed • <span className={styles.live}>LIVE</span>
                        </p>
                    </div>
                </div>

                <div className={styles.statItem}>
                    <div className={styles.label}><DollarSign size={12} /> BTC Price</div>
                    <div className={styles.statValue}>${price}</div>
                    <div className={change.startsWith('+') ? styles.statDelta : styles.statDeltaNegative}>{change}</div>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.statItem}>
                    <div className={styles.label}>24h High</div>
                    <div className={styles.statValue}>${high}</div>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.statItem}>
                    <div className={styles.label}>24h Low</div>
                    <div className={styles.statValue}>${low}</div>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.statItem}>
                    <div className={styles.label}>Spread</div>
                    <div className={styles.statValueAccent}>${spread}</div>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.statItem}>
                    <div className={styles.label}><TrendingUp size={12} /> 24h Vol</div>
                    <div className={styles.statValue}>${volume}</div>
                </div>
            </div>
        </GlassPanel>
    );
}

