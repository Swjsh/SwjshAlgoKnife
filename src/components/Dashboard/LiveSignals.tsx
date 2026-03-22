'use client';

import React from 'react';
import styles from './LiveSignals.module.css';
import { Activity } from 'lucide-react';
import { motion } from 'framer-motion';

export interface Signal {
    id: string;
    timestamp: string;
    symbol: string;
    action: 'LONG' | 'SHORT' | 'BUY' | 'SELL';
    price: number;
    status: 'LIVE' | 'CLOSED';
}

interface LiveSignalsProps {
    signals: Signal[];
}

export default function LiveSignals({ signals }: LiveSignalsProps) {
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.title}>
                    <Activity size={16} className={styles.icon} />
                    Tactical Feed
                    <div className={styles.liveBadge}>LIVE</div>
                </div>
            </div>
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Ticker</th>
                            <th>Action</th>
                            <th>Price</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {signals && signals.length > 0 ? (
                            signals.map((signal) => (
                                <motion.tr
                                    key={signal.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                >
                                    <td>{new Date(signal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                    <td className={styles.ticker}>{signal.symbol}</td>
                                    <td>
                                        <span className={`${styles.typeBadge} ${styles[`type-${signal.action.toLowerCase()}`]}`}>
                                            {signal.action}
                                        </span>
                                    </td>
                                    <td>{signal.price.toFixed(2)}</td>
                                    <td>{signal.status}</td>
                                </motion.tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5}>
                                    <div className={styles.emptyState}>No active signals detected.</div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
