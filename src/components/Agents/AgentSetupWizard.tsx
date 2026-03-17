"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bot, Globe, Swords, DollarSign, Rocket, ArrowRight, ArrowLeft, CheckCircle, Shield, Brain, Zap } from 'lucide-react';
import styles from './AgentSetupWizard.module.css';

interface AgentSetupWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onDeploy: (agentData: any) => Promise<void>;
}

const MARKETS = [
    { id: 'FOREX', name: 'Forex', icon: <Globe size={24} />, description: 'Trade global currency pairs' },
    { id: 'CRYPTO', name: 'Crypto', icon: <Zap size={24} />, description: 'Autonomous blockchain asset execution' },
    { id: 'OPTIONS', name: 'Options', icon: <Brain size={24} />, description: 'Risk-defined derivatives strategy' },
    { id: 'FUTURES', name: 'Futures', icon: <Shield size={24} />, description: 'High-leverage index & commodity focus' },
];

const STRATEGIES = [
    { id: 'orb_15m', name: 'ORB 15m', market: 'FUTURES', desc: 'Opening Range Breakout' },
    { id: 'never_stopped_out', name: 'NeverStoppedOut', market: 'FUTURES', desc: 'Advanced Session-based ORB' },
    { id: 'supp_res', name: 'S&R Rejection', markets: ['CRYPTO', 'FOREX'], desc: 'Supply/Demand Zone Trading' },
    { id: 'vwap_reversion', name: 'VWAP Reversion', market: 'CRYPTO', desc: 'Institutional Mean Reversion' },
    { id: 'bb_breakout', name: 'BB Squeeze', markets: ['CRYPTO', 'FOREX'], desc: 'Volatility Expansion Breakout' },
    { id: 'grid_trading', name: 'Grid Trading', markets: ['CRYPTO', 'FOREX'], desc: 'Range Profit Accumulation' },
    { id: 'three_ducks', name: 'Three Ducks', market: 'FOREX', desc: 'Triple Timeframe Trend Alignment' },
];

const PERSONAS = [
    { id: 'fx', name: 'Sterling', market: 'FOREX', voice: 'Calm & Deliberate' },
    { id: 'crypto', name: 'Bitcoin Bob', market: 'CRYPTO', voice: 'Chill HODL' },
    { id: 'spx', name: 'SPX Sniper', market: 'OPTIONS', voice: 'Tactical Elite' },
    { id: 'futures', name: 'Pivot Pete', market: 'FUTURES', voice: 'Methodical' },
    { id: 'custom', name: 'Custom Agent', market: 'ANY', voice: 'Adaptive' },
];

export default function AgentSetupWizard({ isOpen, onClose, onDeploy }: AgentSetupWizardProps) {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        market: '',
        strategy: '',
        capital: '5000',
        risk: '1',
    });
    const [isDeploying, setIsDeploying] = useState(false);
    const [isComplete, setIsComplete] = useState(false);

    if (!isOpen) return null;

    const handleNext = () => setStep(prev => Math.min(prev + 1, 5));
    const handlePrev = () => setStep(prev => Math.max(prev - 1, 1));

    const handleSelectPersona = (p: any) => {
        setFormData({ ...formData, id: p.id, name: p.name, market: p.market === 'ANY' ? '' : p.market });
        handleNext();
    };

    const handleSelectMarket = (m: string) => {
        setFormData({ ...formData, market: m, strategy: '' });
        handleNext();
    };

    const handleSelectStrategy = (s: string) => {
        setFormData({ ...formData, strategy: s });
        handleNext();
    };

    const handleDeploy = async () => {
        setIsDeploying(true);
        try {
            await onDeploy(formData);
            setIsComplete(true);
            setTimeout(() => {
                onClose();
                // Reset for next use
                setStep(1);
                setIsComplete(false);
                setIsDeploying(false);
            }, 2000);
        } catch (error) {
            console.error("Deployment failed", error);
            setIsDeploying(false);
        }
    };

    const filteredStrategies = STRATEGIES.filter(s =>
        s.market === formData.market || s.markets?.includes(formData.market as any)
    );

    const variants = {
        enter: { x: 50, opacity: 0 },
        center: { x: 0, opacity: 1 },
        exit: { x: -50, opacity: 0 }
    };

    return (
        <div className={styles.overlay}>
            <motion.div
                className={styles.modal}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
            >
                <button className={styles.closeBtn} onClick={onClose}>
                    <X size={24} />
                </button>

                <div className={styles.header}>
                    <h2>Deploy New Agent</h2>
                    <p>Step {step} of 5 — {step === 1 ? 'Choose Soul' : step === 2 ? 'Target Market' : step === 3 ? 'Select Tactics' : step === 4 ? 'Balance Risk' : 'Final Review'}</p>
                </div>

                <div className={styles.stepIndicator}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <div
                            key={i}
                            className={`${styles.indicatorDot} ${i <= step ? styles.indicatorDotActive : ''}`}
                        />
                    ))}
                </div>

                <div className={styles.content}>
                    <AnimatePresence mode="wait">
                        {isComplete ? (
                            <motion.div
                                key="complete"
                                className={styles.completeScreen}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                style={{ textAlign: 'center', padding: '40px 0' }}
                            >
                                <CheckCircle size={80} color="var(--status-success)" style={{ margin: '0 auto 20px' }} />
                                <h3>Agent Deployed!</h3>
                                <p>Neural link established. Initializing {formData.name}...</p>
                            </motion.div>
                        ) : (
                            <motion.div
                                key={step}
                                variants={variants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.3 }}
                            >
                                {step === 1 && (
                                    <div className={styles.step}>
                                        <h3 className={styles.stepTitle}><Bot size={20} /> Choose Agent Persona</h3>
                                        <div className={styles.grid}>
                                            {PERSONAS.map(p => (
                                                <div
                                                    key={p.id}
                                                    className={`${styles.optionCard} ${formData.id === p.id ? styles.optionCardSelected : ''}`}
                                                    onClick={() => handleSelectPersona(p)}
                                                >
                                                    <div className={styles.avatar}><Bot size={24} color={formData.id === p.id ? 'var(--brand-primary)' : 'var(--text-muted)'} /></div>
                                                    <span className={styles.optionName}>{p.name}</span>
                                                    <span className={styles.optionDesc}>{p.voice} Voice</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {step === 2 && (
                                    <div className={styles.step}>
                                        <h3 className={styles.stepTitle}><Globe size={20} /> Deployment Field</h3>
                                        <div className={styles.grid}>
                                            {MARKETS.map(m => (
                                                <div
                                                    key={m.id}
                                                    className={`${styles.optionCard} ${formData.market === m.id ? styles.optionCardSelected : ''}`}
                                                    onClick={() => handleSelectMarket(m.id)}
                                                >
                                                    {m.icon}
                                                    <span className={styles.optionName}>{m.name}</span>
                                                    <span className={styles.optionDesc}>{m.description}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {step === 3 && (
                                    <div className={styles.step}>
                                        <h3 className={styles.stepTitle}><Swords size={20} /> Tactical Strategy</h3>
                                        <div className={styles.grid}>
                                            {filteredStrategies.map(s => (
                                                <div
                                                    key={s.id}
                                                    className={`${styles.optionCard} ${formData.strategy === s.name ? styles.optionCardSelected : ''}`}
                                                    onClick={() => handleSelectStrategy(s.name)}
                                                >
                                                    <span className={styles.optionName}>{s.name}</span>
                                                    <span className={styles.optionDesc}>{s.desc}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {step === 4 && (
                                    <div className={styles.step}>
                                        <h3 className={styles.stepTitle}><DollarSign size={20} /> Operational Parameters</h3>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.label}>Starting Capital ($)</label>
                                            <input
                                                className={styles.input}
                                                type="number"
                                                value={formData.capital}
                                                onChange={(e) => setFormData({ ...formData, capital: e.target.value })}
                                            />
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label className={styles.label}>Risk Per Trade (%)</label>
                                            <input
                                                className={styles.input}
                                                type="number"
                                                step="0.1"
                                                value={formData.risk}
                                                onChange={(e) => setFormData({ ...formData, risk: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                )}

                                {step === 5 && (
                                    <div className={styles.step}>
                                        <h3 className={styles.stepTitle}><Rocket size={20} /> Mission Briefing</h3>
                                        <div className={styles.summary}>
                                            <div className={styles.summaryItem}>
                                                <span className={styles.summaryLabel}>Agent Name</span>
                                                <span className={styles.summaryValue}>{formData.name}</span>
                                            </div>
                                            <div className={styles.summaryItem}>
                                                <span className={styles.summaryLabel}>Field of Operation</span>
                                                <span className={`${styles.summaryValue} ${styles.highlight}`}>{formData.market}</span>
                                            </div>
                                            <div className={styles.summaryItem}>
                                                <span className={styles.summaryLabel}>Tactical Protocol</span>
                                                <span className={styles.summaryValue}>{formData.strategy}</span>
                                            </div>
                                            <div className={styles.summaryItem}>
                                                <span className={styles.summaryLabel}>Assigned Capital</span>
                                                <span className={styles.summaryValue}>${formData.capital}</span>
                                            </div>
                                            <div className={styles.summaryItem}>
                                                <span className={styles.summaryLabel}>Risk Tolerance</span>
                                                <span className={styles.summaryValue}>{formData.risk}% / Trade</span>
                                            </div>
                                            <div className={styles.summaryItem}>
                                                <span className={styles.summaryLabel}>Data Source</span>
                                                <span className={styles.summaryValue}>Real-time {formData.market === 'CRYPTO' ? 'Binance' : formData.market === 'FOREX' ? 'Yahoo Finance' : 'Finnhub'}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {!isComplete && (
                    <div className={styles.footer}>
                        {step > 1 && (
                            <button className={styles.prevBtn} onClick={handlePrev}>
                                <ArrowLeft size={18} /> Back
                            </button>
                        )}
                        <div style={{ flex: 1 }} />
                        {step < 5 ? (
                            <button
                                className={styles.nextBtn}
                                onClick={handleNext}
                                disabled={
                                    (step === 1 && !formData.id) ||
                                    (step === 2 && !formData.market) ||
                                    (step === 3 && !formData.strategy)
                                }
                            >
                                Next <ArrowRight size={18} />
                            </button>
                        ) : (
                            <button
                                className={`${styles.nextBtn} ${styles.deployBtn}`}
                                onClick={handleDeploy}
                                disabled={isDeploying}
                            >
                                {isDeploying ? 'Establishing Link...' : 'Deploy Agent'} <Rocket size={18} />
                            </button>
                        )}
                    </div>
                )}
            </motion.div>
        </div>
    );
}
