"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useStrategy } from "@/context/StrategyContext";
import GlassPanel from "@/components/UI/GlassPanel";
import { Save, Check } from "lucide-react";
import styles from "./page.module.css";
import clsx from "clsx";

export default function SettingsPage() {
    const { theme } = useStrategy();
    const { user, loading, userPreferences, updatePreferences } = useAuth();
    const router = useRouter();

    // Form state
    const [accountBalance, setAccountBalance] = useState(10000);
    const [riskPerTrade, setRiskPerTrade] = useState(1);
    const [maxDailyLoss, setMaxDailyLoss] = useState(500);
    const [maxOpenPositions, setMaxOpenPositions] = useState(3);
    const [tradingHoursStart, setTradingHoursStart] = useState('09:30');
    const [tradingHoursEnd, setTradingHoursEnd] = useState('16:00');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Load preferences when available
    useEffect(() => {
        if (userPreferences) {
            if (userPreferences.accountBalance) setAccountBalance(userPreferences.accountBalance);
            if (userPreferences.riskPerTrade) setRiskPerTrade(userPreferences.riskPerTrade);
            if (userPreferences.maxDailyLoss) setMaxDailyLoss(userPreferences.maxDailyLoss);
            if (userPreferences.maxOpenPositions) setMaxOpenPositions(userPreferences.maxOpenPositions);
            if (userPreferences.tradingHoursStart) setTradingHoursStart(userPreferences.tradingHoursStart);
            if (userPreferences.tradingHoursEnd) setTradingHoursEnd(userPreferences.tradingHoursEnd);
        }
    }, [userPreferences]);

    // Protect route
    useEffect(() => {
        if (!loading && !user) {
            router.replace('/login');
        }
    }, [user, loading, router]);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveSuccess(false);

        await updatePreferences({
            accountBalance,
            riskPerTrade,
            maxDailyLoss,
            maxOpenPositions,
            tradingHoursStart,
            tradingHoursEnd,
            theme: theme
        });

        setIsSaving(false);
        setSaveSuccess(true);

        // Clear success message after 3 seconds
        setTimeout(() => setSaveSuccess(false), 3000);
    };

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
                <h1 className={styles.title}>Settings</h1>
                <p className={styles.subtitle}>System Configuration & Preferences</p>
            </header>

            <div className={styles.sectionsGrid}>
                {/* Appearance */}
                {/* Risk Management */}
                <GlassPanel className={styles.section}>
                    <h2 className={styles.sectionTitle}>Risk Management</h2>
                    <div className={styles.settingRow}>
                        <div className={styles.settingInfo}>
                            <h3>Account Balance</h3>
                            <p>Your current trading account balance</p>
                        </div>
                        <div className={styles.inputGroup}>
                            <span className={styles.inputPrefix}>$</span>
                            <input
                                type="number"
                                className={styles.input}
                                value={accountBalance}
                                onChange={(e) => setAccountBalance(Number(e.target.value))}
                                placeholder="10000"
                            />
                        </div>
                    </div>
                    <div className={styles.settingRow}>
                        <div className={styles.settingInfo}>
                            <h3>Risk Per Trade</h3>
                            <p>Maximum percentage of account to risk per trade</p>
                        </div>
                        <div className={styles.inputGroup}>
                            <input
                                type="number"
                                className={styles.input}
                                value={riskPerTrade}
                                onChange={(e) => setRiskPerTrade(Number(e.target.value))}
                                placeholder="1"
                                min="0.1"
                                max="10"
                                step="0.1"
                            />
                            <span className={styles.inputSuffix}>%</span>
                        </div>
                    </div>
                    <div className={styles.settingRow}>
                        <div className={styles.settingInfo}>
                            <h3>Max Daily Loss</h3>
                            <p>Stop all bots when daily loss exceeds this amount</p>
                        </div>
                        <div className={styles.inputGroup}>
                            <span className={styles.inputPrefix}>$</span>
                            <input
                                type="number"
                                className={styles.input}
                                value={maxDailyLoss}
                                onChange={(e) => setMaxDailyLoss(Number(e.target.value))}
                                placeholder="500"
                                min="50"
                            />
                        </div>
                    </div>
                    <div className={styles.settingRow}>
                        <div className={styles.settingInfo}>
                            <h3>Max Open Positions</h3>
                            <p>Maximum concurrent positions across all bots</p>
                        </div>
                        <div className={styles.inputGroup}>
                            <input
                                type="number"
                                className={styles.input}
                                value={maxOpenPositions}
                                onChange={(e) => setMaxOpenPositions(Number(e.target.value))}
                                placeholder="3"
                                min="1"
                                max="20"
                            />
                        </div>
                    </div>
                    <div className={styles.settingRow}>
                        <div className={styles.settingInfo}>
                            <h3>Trading Hours</h3>
                            <p>Restrict bot trading to specific hours (local time)</p>
                        </div>
                        <div className={styles.inputGroup} style={{ gap: '8px' }}>
                            <input
                                type="time"
                                className={styles.input}
                                value={tradingHoursStart}
                                onChange={(e) => setTradingHoursStart(e.target.value)}
                            />
                            <span style={{ color: 'rgba(255,255,255,0.5)' }}>to</span>
                            <input
                                type="time"
                                className={styles.input}
                                value={tradingHoursEnd}
                                onChange={(e) => setTradingHoursEnd(e.target.value)}
                            />
                        </div>
                    </div>
                </GlassPanel>

                {/* API Keys */}
                <GlassPanel className={styles.section}>
                    <h2 className={styles.sectionTitle}>API Configuration</h2>
                    <div className={styles.settingRow}>
                        <div className={styles.settingInfo}>
                            <h3>Webhook Secret</h3>
                            <p>Authentication key for TradingView webhooks</p>
                        </div>
                        <input
                            type="password"
                            className={styles.inputWide}
                            placeholder="••••••••••••"
                        />
                    </div>
                </GlassPanel>

                {/* System Info */}
                <GlassPanel className={styles.section}>
                    <h2 className={styles.sectionTitle}>System Info</h2>
                    <div className={styles.infoGrid}>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Version</span>
                            <span className={styles.infoValue}>1.0.0</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Database</span>
                            <span className={styles.infoValue}>SQLite (local)</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Environment</span>
                            <span className={styles.infoValue}>Development</span>
                        </div>
                    </div>
                </GlassPanel>

                {/* Onboarding Control */}
                <GlassPanel className={styles.section}>
                    <h2 className={styles.sectionTitle}>Guided Experience</h2>
                    <div className={styles.settingRow}>
                        <div className={styles.settingInfo}>
                            <h3>Restart Welcome Tour</h3>
                            <p>Reset your onboarding status to see the guided tour and brand introduction again.</p>
                        </div>
                        <button
                            className={styles.resetBtn}
                            onClick={async () => {
                                // Clear localStorage so onboarding will show again
                                if (typeof window !== 'undefined') {
                                    localStorage.removeItem('onboarding_dismissed');
                                }
                                await updatePreferences({ onboardingComplete: false });
                                window.location.reload(); // Reload to trigger the tour
                            }}
                        >
                            Restart Tour
                        </button>
                    </div>
                </GlassPanel>
            </div>

            {/* Save Button */}
            <div className={styles.saveContainer}>
                {saveSuccess && (
                    <div className={styles.successMessage}>
                        <Check size={16} />
                        Settings saved successfully
                    </div>
                )}
                <button
                    className={clsx(styles.saveButton, isSaving && styles.saving)}
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    <Save size={18} />
                    {isSaving ? "Saving..." : "Save Settings"}
                </button>
            </div>
        </div>
    );
}
