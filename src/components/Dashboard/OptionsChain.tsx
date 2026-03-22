"use client";

import React, { useState } from 'react';
import GlassPanel from '@/components/UI/GlassPanel';
import styles from './OptionsChain.module.css';
import { Layers } from 'lucide-react';

interface OptionRow {
    strike: number;
    callBid: number;
    callAsk: number;
    callVol: number;
    callDelta: number;
    putBid: number;
    putAsk: number;
    putVol: number;
    putDelta: number;
}

// Generate some mock SPX data centered around 5800
const generateMockChain = (center: number): OptionRow[] => {
    const rows: OptionRow[] = [];
    for (let i = -10; i <= 10; i++) {
        const strike = center + i * 5;
        const dist = (strike - center) / center;

        // Simple mock pricing logic
        const callPrice = Math.max(0.1, (center - strike) + 15 * Math.exp(-Math.abs(i) / 5));
        const putPrice = Math.max(0.1, (strike - center) + 15 * Math.exp(-Math.abs(i) / 5));

        rows.push({
            strike,
            callBid: Number((callPrice * 0.98).toFixed(2)),
            callAsk: Number((callPrice * 1.02).toFixed(2)),
            callVol: Math.floor(Math.random() * 5000 * Math.exp(-Math.abs(i) / 5)),
            callDelta: Number((0.5 - dist * 5).toFixed(2)), // Very rough delta approx
            putBid: Number((putPrice * 0.98).toFixed(2)),
            putAsk: Number((putPrice * 1.02).toFixed(2)),
            putVol: Math.floor(Math.random() * 5000 * Math.exp(-Math.abs(i) / 5)),
            putDelta: Number((-0.5 - dist * 5).toFixed(2))
        });
    }
    return rows;
};

export default function OptionsChain({ currentPrice }: { currentPrice: number }) {
    // Round to nearest 5
    const centerStrike = Math.round(currentPrice / 5) * 5;
    const [data] = useState(() => generateMockChain(centerStrike || 5800));

    return (
        <GlassPanel className={styles.container}>
            <div className={styles.header}>
                <div className={styles.title}>
                    <Layers size={20} color="var(--accent-purple)" />
                    OPTION CHAIN (SPX)
                </div>
                <select className={styles.expirationSelect}>
                    <option>0 DTE (Today)</option>
                    <option>1 DTE (Tomorrow)</option>
                    <option>4 DTE (Weekly)</option>
                </select>
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th colSpan={4} className={styles.th}>CALLS</th>
                            <th className={styles.th}>STRIKE</th>
                            <th colSpan={4} className={styles.th}>PUTS</th>
                        </tr>
                        <tr>
                            <th className={styles.th}>Delta</th>
                            <th className={styles.th}>Vol</th>
                            <th className={styles.th}>Bid</th>
                            <th className={styles.th}>Ask</th>
                            <th className={`${styles.th} ${styles.strikeHead}`}></th>
                            <th className={styles.th}>Bid</th>
                            <th className={styles.th}>Ask</th>
                            <th className={styles.th}>Vol</th>
                            <th className={styles.th}>Delta</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row) => {
                            const isAtm = Math.abs(row.strike - centerStrike) < 2.5;
                            return (
                                <tr key={row.strike} className={isAtm ? styles.atmRow : ''}>
                                    <td className={`${styles.td} ${row.strike < centerStrike ? styles.itmCall : ''}`}>{row.callDelta}</td>
                                    <td className={`${styles.td} ${row.strike < centerStrike ? styles.itmCall : ''}`}>{row.callVol}</td>
                                    <td className={`${styles.td} ${styles.callText} ${row.strike < centerStrike ? styles.itmCall : ''}`}>{row.callBid}</td>
                                    <td className={`${styles.td} ${styles.callText} ${row.strike < centerStrike ? styles.itmCall : ''}`}>{row.callAsk}</td>

                                    <td className={`${styles.td} ${styles.strikeCell}`}>{row.strike}</td>

                                    <td className={`${styles.td} ${styles.putText} ${row.strike > centerStrike ? styles.itmPut : ''}`}>{row.putBid}</td>
                                    <td className={`${styles.td} ${styles.putText} ${row.strike > centerStrike ? styles.itmPut : ''}`}>{row.putAsk}</td>
                                    <td className={`${styles.td} ${row.strike > centerStrike ? styles.itmPut : ''}`}>{row.putVol}</td>
                                    <td className={`${styles.td} ${row.strike > centerStrike ? styles.itmPut : ''}`}>{row.putDelta}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </GlassPanel>
    );
}
