"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import GlassPanel from "@/components/UI/GlassPanel";
import { ScannerEngine } from "@/lib/scanner/engine";
import { MockDataFeed } from "@/lib/scanner/dataFeed";
import { ScanResult } from "@/lib/scanner/types";
import { Play, Pause, RefreshCw, TrendingUp, Activity } from "lucide-react";
import styles from "./Scanner.module.css";
import clsx from "clsx";

export default function ScannerPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [scanner] = useState(() => new ScannerEngine());
    const [results, setResults] = useState<ScanResult[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [selectedStrategies, setSelectedStrategies] = useState<string[]>(['Breakout Scanner']);
    const [combinationMode, setCombinationMode] = useState<'AND' | 'OR'>('OR');

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

    useEffect(() => {
        // Initialize watchlist
        scanner.setWatchlist(MockDataFeed.generateMockWatchlist());
    }, [scanner]);

    const runScan = () => {
        if (selectedStrategies.length === 0) {
            const scanResults = scanner.scan();
            setResults(scanResults);
        } else if (selectedStrategies.length === 1) {
            const scanResults = scanner.scanWithStrategy(selectedStrategies[0]);
            setResults(scanResults);
        } else {
            const scanResults = scanner.combineStrategies(selectedStrategies, combinationMode);
            setResults(scanResults);
        }
    };

    const toggleStrategy = (strategyName: string) => {
        setSelectedStrategies(prev =>
            prev.includes(strategyName)
                ? prev.filter(s => s !== strategyName)
                : [...prev, strategyName]
        );
    };

    const toggleAutoScan = () => {
        setIsScanning(!isScanning);
        if (!isScanning) {
            const interval = setInterval(runScan, 5000);
            return () => clearInterval(interval);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h2 className="text-2xl font-bold">Options Setup Scanner</h2>
                    <p className="text-[var(--color-text-dim)]">
                        Multi-strategy breakout and setup detector
                    </p>
                </div>
                <div className={styles.headerActions}>
                    <button
                        onClick={runScan}
                        className={clsx(styles.scanBtn, styles.btnPrimary)}
                    >
                        <RefreshCw size={16} />
                        Scan Now
                    </button>
                    <button
                        onClick={toggleAutoScan}
                        className={clsx(styles.scanBtn, isScanning ? styles.btnDanger : styles.btnSuccess)}
                    >
                        {isScanning ? <Pause size={16} /> : <Play size={16} />}
                        {isScanning ? 'Stop' : 'Auto Scan'}
                    </button>
                </div>
            </header>

            {/* Strategy Selector */}
            <GlassPanel title="Active Strategies">
                <div className={styles.strategyGrid}>
                    {scanner.getAvailableStrategies().map(strategy => (
                        <label key={strategy} className={styles.strategyCheckbox}>
                            <input
                                type="checkbox"
                                checked={selectedStrategies.includes(strategy)}
                                onChange={() => toggleStrategy(strategy)}
                            />
                            <span>{strategy}</span>
                        </label>
                    ))}
                </div>

                {selectedStrategies.length > 1 && (
                    <div className={styles.combinationMode}>
                        <span>Combination Mode:</span>
                        <select
                            value={combinationMode}
                            onChange={(e) => setCombinationMode(e.target.value as 'AND' | 'OR')}
                            className={styles.modeSelect}
                        >
                            <option value="OR">OR (Any Match)</option>
                            <option value="AND">AND (All Match)</option>
                        </select>
                    </div>
                )}
            </GlassPanel>

            {/* Results Table */}
            <GlassPanel title={`Scan Results (${results.length})`}>
                {results.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Activity size={48} opacity={0.3} />
                        <p>No setups found. Click "Scan Now" to search for opportunities.</p>
                    </div>
                ) : (
                    <div className={styles.resultsTable}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Ticker</th>
                                    <th>Setup</th>
                                    <th>Confidence</th>
                                    <th>Price</th>
                                    <th>Volume</th>
                                    <th>Metrics</th>
                                    <th>Option Play</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((result, idx) => (
                                    <tr key={idx} className={styles[`confidence${result.confidence}`]}>
                                        <td className={styles.ticker}>{result.ticker}</td>
                                        <td>
                                            <span className={clsx(styles.badge, styles.badgeSetup)}>
                                                {result.setup}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={clsx(styles.badge, styles[`badge${result.confidence}`])}>
                                                {result.confidence}
                                            </span>
                                        </td>
                                        <td>${result.price.toFixed(2)}</td>
                                        <td>{(result.volume / 1000000).toFixed(1)}M</td>
                                        <td className={styles.metrics}>
                                            <div>Vol: {result.metrics.volumeRatio.toFixed(1)}x</div>
                                            <div>Move: {(result.metrics.priceMove * 100).toFixed(1)}%</div>
                                        </td>
                                        <td>
                                            {result.optionPlay && (
                                                <div className={styles.optionPlay}>
                                                    <div>${result.optionPlay.suggestedStrike} {result.optionPlay.expiry}</div>
                                                    <div className={styles.optionTarget}>
                                                        Target: {result.optionPlay.targetReturn}%
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </GlassPanel>
        </div>
    );
}
