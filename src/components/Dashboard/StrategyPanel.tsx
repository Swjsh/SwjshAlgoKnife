"use client";

import React, { useState } from 'react';
import GlassPanel from '@/components/UI/GlassPanel';
import styles from './StrategyPanel.module.css';
import { ClipboardList, ArrowLeftRight, History, FileText } from 'lucide-react';

type Tab = 'positions' | 'orders' | 'history' | 'journal';

import { useStrategy } from '@/context/StrategyContext';

export default function StrategyPanel() {
    const [activeTab, setActiveTab] = useState<Tab>('positions');
    const { agents } = useStrategy();

    const fxAgent = agents?.fx;
    const cryptoAgent = agents?.crypto;

    // Derive positions from pending/closed trades for now (mocking the relationship)
    // In a real system, there would be a dedicated 'positions' API
    const positions = [];
    if (fxAgent?.pending_orders?.length > 0) {
        positions.push({
            symbol: fxAgent.pending_orders[0].ticker,
            side: fxAgent.pending_orders[0].type === 'SUPPLY' ? 'SHORT' : 'LONG',
            size: 1.0,
            entry: fxAgent.pending_orders[0].entry,
            mark: fxAgent.pending_orders[0].entry + 0.0005, // simulated mark
            pnl: 125.00
        });
    } else if (cryptoAgent?.pending_orders?.length > 0) {
        positions.push({
            symbol: cryptoAgent.pending_orders[0].ticker,
            side: cryptoAgent.pending_orders[0].type === 'SUPPLY' ? 'SHORT' : 'LONG',
            size: 0.5,
            entry: cryptoAgent.pending_orders[0].entry,
            mark: cryptoAgent.pending_orders[0].entry + 450, // simulated mark
            pnl: 228.75
        });
    }

    return (
        <GlassPanel className={styles.container}>
            <div className={styles.header}>
                <button
                    className={`${styles.tab} ${activeTab === 'positions' ? styles.active : ''}`}
                    onClick={() => setActiveTab('positions')}
                >
                    <ArrowLeftRight size={16} /> Positions
                    <span className={styles.badge}>{positions.length}</span>
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'orders' ? styles.active : ''}`}
                    onClick={() => setActiveTab('orders')}
                >
                    <ClipboardList size={16} /> Orders
                    <span className={styles.badge}>
                        {(fxAgent?.pending_orders?.length || 0) + (cryptoAgent?.pending_orders?.length || 0)}
                    </span>
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'history' ? styles.active : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    <History size={16} /> History
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'journal' ? styles.active : ''}`}
                    onClick={() => setActiveTab('journal')}
                >
                    <FileText size={16} /> Journal
                </button>
            </div>

            <div className={styles.content}>
                {activeTab === 'positions' && (
                    positions.length > 0 ? (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Symbol</th>
                                    <th>Side</th>
                                    <th>Size</th>
                                    <th>Entry Price</th>
                                    <th>Mark Price</th>
                                    <th>PNL (ROU)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {positions.map((pos, i) => (
                                    <tr key={i}>
                                        <td className={styles.symbol}>{pos.symbol}</td>
                                        <td className={pos.side === 'LONG' ? styles.long : styles.short}>{pos.side}</td>
                                        <td>{pos.size}</td>
                                        <td>{pos.entry.toLocaleString()}</td>
                                        <td>{pos.mark.toLocaleString()}</td>
                                        <td className={pos.pnl >= 0 ? styles.profit : styles.loss}>
                                            {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className={styles.emptyState}>No Open Positions</div>
                    )
                )}

                {activeTab === 'orders' && (
                    <div className={styles.emptyState}>
                        {((fxAgent?.pending_orders?.length || 0) + (cryptoAgent?.pending_orders?.length || 0)) > 0
                            ? `${(fxAgent?.pending_orders?.length || 0) + (cryptoAgent?.pending_orders?.length || 0)} Pending Zone Orders`
                            : "No Open Orders"}
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className={styles.emptyState}>
                        {fxAgent?.closed_trades?.length || 0} Past Trades Found
                    </div>
                )}

                {activeTab === 'journal' && (
                    <div className={styles.emptyState}>Trading Journal - Connect Firebase to Sync</div>
                )}
            </div>
        </GlassPanel>
    );
}
