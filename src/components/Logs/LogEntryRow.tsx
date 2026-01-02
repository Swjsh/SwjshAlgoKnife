'use client';

import React, { useState } from 'react';
import styles from './LogEntryRow.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { Trade } from '@/types';

interface LogEntryRowProps {
    trade: Trade & {
        agentName?: string;
        agentAvatar?: string;
        review?: { grade?: string; notes?: string };
    };
}

export default function LogEntryRow({ trade }: LogEntryRowProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const isWin = (trade.pnl || 0) > 0;
    const isLoss = (trade.pnl || 0) < 0;

    return (
        <div className={styles.rowContainer}>
            <div
                className={styles.collapsedHeader}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {/* Avatar / Status */}
                <div className={styles.agentAvatar}>
                    {trade.agentAvatar ? (
                        <img src={trade.agentAvatar} alt={trade.agentName} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                    ) : (
                        <span>{trade.agentName?.charAt(0) || '?'}</span>
                    )}
                    <div className={`${styles.statusDot} ${isWin ? styles.statusWin : isLoss ? styles.statusLoss : styles.statusOpen}`} />
                </div>

                {/* Main Info */}
                <div className={styles.mainInfo}>
                    <div className={styles.symbol}>
                        {trade.symbol}
                        <span className={`${styles.sideBadge} ${trade.direction === 'LONG' ? styles.long : styles.short}`}>
                            {trade.direction}
                        </span>
                    </div>
                    <span className={styles.agentName}>{trade.agentName || 'Unknown Agent'}</span>
                </div>

                {/* PnL */}
                <div className={styles.metric}>
                    <span className={styles.metricLabel}>Net PnL</span>
                    <span className={`${styles.metricValue} ${isWin ? styles.valPos : isLoss ? styles.valNeg : ''}`}>
                        {trade.pnl ? `$${trade.pnl.toFixed(2)}` : '--'}
                    </span>
                </div>

                {/* Date - Hide on mobile */}
                <div className={`${styles.metric} ${styles.hideMobile}`}>
                    <span className={styles.metricLabel}>Executed</span>
                    <span className={styles.metricValue}>
                        {new Date(trade.entry_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                </div>

                {/* Grade - Hide on mobile */}
                <div className={`${styles.metric} ${styles.hideMobile}`}>
                    <span className={styles.metricLabel}>Grade</span>
                    <span className={styles.metricValue}>
                        {trade.review?.grade || '-'}
                    </span>
                </div>

                {/* Expand Icon */}
                <ChevronDown
                    className={`${styles.expandIcon} ${isExpanded ? styles.rotate : ''}`}
                    size={20}
                />
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className={styles.expandedContent}
                    >
                        <div className={styles.intelGrid}>
                            <div className={styles.intelMain}>
                                <div className={styles.intelSection}>
                                    <h4>Mission Intel & Reasoning</h4>
                                    <div className={styles.reasoningText}>
                                        {trade.notes || trade.review?.notes || "No tactical notes available for this mission."}
                                    </div>
                                </div>

                                <div style={{ marginTop: 20 }} className={styles.intelSection}>
                                    <h4>Visual Confirmation</h4>
                                    <div className={styles.chartPlaceholder}>
                                        {trade.screenshot_url ? (
                                            <img src={trade.screenshot_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <span>No Visual Data Recorded</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className={styles.intelSidebar}>
                                <div className={styles.intelSection}>
                                    <h4>Telemetry</h4>
                                    <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Entry Price</span>
                                        <span className={styles.detailVal}>{trade.entry_price}</span>
                                    </div>
                                    <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Exit Price</span>
                                        <span className={styles.detailVal}>{trade.exit_price || '--'}</span>
                                    </div>
                                    <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Duration</span>
                                        <span className={styles.detailVal}>45m 12s</span>
                                    </div>
                                    <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Fees</span>
                                        <span className={styles.detailVal}>$1.20</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
