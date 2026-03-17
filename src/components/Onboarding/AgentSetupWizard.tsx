'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useAgentContext } from '@/context/AgentContext';
import { LogoIcon } from '@/components/UI/LogoIcon';
import styles from './AgentSetupWizard.module.css';
import {
    Bot, TrendingUp, Bitcoin, DollarSign, BarChart3,
    Zap, Shield, Target, ArrowRight, ArrowLeft, Check,
    Sparkles, Rocket, ChevronRight, Activity, Globe,
    LineChart, PieChart, Cpu, Wifi
} from 'lucide-react';

interface AgentConfig {
    agentType: string;
    market: string;
    strategy: string;
    capital: number;
    riskReward: number;
    agentName: string;
}

const AGENT_TYPES = [
    {
        id: 'forex',
        name: 'Pivot Pete',
        icon: <DollarSign size={32} />,
        color: '#22c55e',
        description: 'FX pairs hunter who lives for those daily pivots',
        catchphrase: '"Pips don\'t sleep, and neither do I."',
        deployment: 'Currency Markets'
    },
    {
        id: 'crypto',
        name: 'Bitcoin Bob',
        icon: <Bitcoin size={32} />,
        color: '#f59e0b',
        description: 'Crypto degen with a plan. Catches pumps, dodges rugs.',
        catchphrase: '"WAGMI... but with actual risk management."',
        deployment: 'Digital Assets'
    },
    {
        id: 'futures',
        name: 'Futures Frank',
        icon: <BarChart3 size={32} />,
        color: '#3b82f6',
        description: 'Index futures specialist. ES, NQ, all day every day.',
        catchphrase: '"The trend is your friend until the bend."',
        deployment: 'Index Futures'
    },
    {
        id: 'options',
        name: 'Theta Tom',
        icon: <Target size={32} />,
        color: '#a855f7',
        description: 'Options strategist. Sells premium, collects theta.',
        catchphrase: '"Time decay waits for no one."',
        deployment: 'Derivatives'
    },
];

const MARKETS = {
    forex: [
        { id: 'eurusd', name: 'EUR/USD', description: 'Euro / US Dollar' },
        { id: 'gbpusd', name: 'GBP/USD', description: 'British Pound / US Dollar' },
        { id: 'usdjpy', name: 'USD/JPY', description: 'US Dollar / Japanese Yen' },
        { id: 'audusd', name: 'AUD/USD', description: 'Australian Dollar / US Dollar' },
    ],
    crypto: [
        { id: 'btcusd', name: 'BTC/USD', description: 'Bitcoin / US Dollar' },
        { id: 'ethusd', name: 'ETH/USD', description: 'Ethereum / US Dollar' },
        { id: 'solusd', name: 'SOL/USD', description: 'Solana / US Dollar' },
        { id: 'xrpusd', name: 'XRP/USD', description: 'Ripple / US Dollar' },
    ],
    futures: [
        { id: 'es', name: 'ES (S&P 500)', description: 'E-mini S&P 500 Futures' },
        { id: 'nq', name: 'NQ (Nasdaq)', description: 'E-mini Nasdaq-100 Futures' },
        { id: 'cl', name: 'CL (Crude Oil)', description: 'Crude Oil Futures' },
        { id: 'gc', name: 'GC (Gold)', description: 'Gold Futures' },
    ],
    options: [
        { id: 'spy', name: 'SPY Options', description: 'S&P 500 ETF Options' },
        { id: 'qqq', name: 'QQQ Options', description: 'Nasdaq-100 ETF Options' },
        { id: 'iwm', name: 'IWM Options', description: 'Russell 2000 ETF Options' },
        { id: 'aapl', name: 'AAPL Options', description: 'Apple Inc. Options' },
    ],
};

const STRATEGIES = [
    { id: 'momentum', name: 'Momentum Breakout', icon: <Zap size={24} />, description: 'Ride strong price movements' },
    { id: 'support_resistance', name: 'Support/Resistance', icon: <Shield size={24} />, description: 'Trade key price levels' },
    { id: 'mean_reversion', name: 'Mean Reversion', icon: <Activity size={24} />, description: 'Fade overextended moves' },
    { id: 'trend_following', name: 'Trend Following', icon: <TrendingUp size={24} />, description: 'Follow the dominant trend' },
];

const WIZARD_STEPS = ['Select Agent', 'Assign Market', 'Trading Style', 'Risk Setup', 'Deploy'];

interface AgentSetupWizardProps {
    onComplete: (config: AgentConfig) => void;
    onSkip: () => void;
}

export default function AgentSetupWizard({ onComplete, onSkip }: AgentSetupWizardProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [config, setConfig] = useState<AgentConfig>({
        agentType: '',
        market: '',
        strategy: '',
        capital: 10000,
        riskReward: 2,
        agentName: '',
    });
    const [isLaunching, setIsLaunching] = useState(false);

    const handleNext = () => {
        if (currentStep < WIZARD_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleLaunch = async () => {
        setIsLaunching(true);

        // Generate agent name if not set
        const finalConfig = {
            ...config,
            agentName: config.agentName || generateAgentName(config.agentType),
        };

        // Simulate launch animation
        await new Promise(resolve => setTimeout(resolve, 2000));

        onComplete(finalConfig);
    };

    const generateAgentName = (type: string): string => {
        // Use the agent's actual name from AGENT_TYPES
        const agent = AGENT_TYPES.find(a => a.id === type);
        return agent?.name || 'Agent Alpha';
    };

    const canProceed = () => {
        switch (currentStep) {
            case 0: return config.agentType !== '';
            case 1: return config.market !== '';
            case 2: return config.strategy !== '';
            case 3: return config.capital >= 100 && config.riskReward >= 1;
            default: return true;
        }
    };

    const selectedType = AGENT_TYPES.find(t => t.id === config.agentType);
    const availableMarkets = config.agentType ? MARKETS[config.agentType as keyof typeof MARKETS] : [];

    return (
        <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            {/* Animated background grid */}
            <div className={styles.gridBackground} />

            {/* Floating orbs */}
            <div className={styles.orbs}>
                {[...Array(5)].map((_, i) => (
                    <motion.div
                        key={i}
                        className={styles.orb}
                        animate={{
                            x: [0, Math.random() * 100 - 50, 0],
                            y: [0, Math.random() * 100 - 50, 0],
                            scale: [1, 1.2, 1],
                        }}
                        transition={{
                            duration: 8 + Math.random() * 4,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                        style={{
                            left: `${20 + i * 15}%`,
                            top: `${10 + i * 20}%`,
                        }}
                    />
                ))}
            </div>

            <motion.div
                className={styles.wizardCard}
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
            >
                {isLaunching ? (
                    <motion.div
                        className={styles.launchScreen}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <motion.div
                            animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            <Rocket size={80} className={styles.launchIcon} />
                        </motion.div>
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            Deploying Your Agent...
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            {config.agentName || generateAgentName(config.agentType)} is coming online
                        </motion.p>
                        <div className={styles.launchProgress}>
                            <motion.div
                                className={styles.launchProgressBar}
                                initial={{ width: 0 }}
                                animate={{ width: '100%' }}
                                transition={{ duration: 2 }}
                            />
                        </div>
                    </motion.div>
                ) : (
                    <>
                        {/* Header */}
                        <div className={styles.header}>
                            <div className={styles.headerTop}>
                                <LogoIcon size={48} />
                                <motion.button
                                    className={styles.skipBtn}
                                    onClick={onSkip}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    Skip for now
                                </motion.button>
                            </div>
                            <h1>Recruit Your First Agent</h1>
                            <p>Pick a specialist to trade for you around the clock</p>

                            {/* Data source badge */}
                            <motion.div
                                className={styles.dataBadge}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                <Wifi size={14} />
                                <span>Real-time data powered by Yahoo Finance</span>
                                <div className={styles.liveIndicator} />
                            </motion.div>
                        </div>

                        {/* Progress steps */}
                        <div className={styles.progressSteps}>
                            {WIZARD_STEPS.map((step, idx) => (
                                <div
                                    key={step}
                                    className={`${styles.progressStep} ${idx === currentStep ? styles.active : ''} ${idx < currentStep ? styles.completed : ''}`}
                                >
                                    <div className={styles.stepCircle}>
                                        {idx < currentStep ? <Check size={14} /> : idx + 1}
                                    </div>
                                    <span className={styles.stepLabel}>{step}</span>
                                    {idx < WIZARD_STEPS.length - 1 && <div className={styles.stepLine} />}
                                </div>
                            ))}
                        </div>

                        {/* Step content */}
                        <div className={styles.stepContent}>
                            <AnimatePresence mode="wait">
                                {/* Step 0: Agent Type */}
                                {currentStep === 0 && (
                                    <motion.div
                                        key="step0"
                                        className={styles.stepPanel}
                                        initial={{ opacity: 0, x: 50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -50 }}
                                    >
                                        <h2><Bot size={24} /> Who's joining your squad?</h2>
                                        <div className={styles.optionGrid}>
                                            {AGENT_TYPES.map((type) => (
                                                <motion.button
                                                    key={type.id}
                                                    className={`${styles.optionCard} ${config.agentType === type.id ? styles.selected : ''}`}
                                                    onClick={() => setConfig({ ...config, agentType: type.id, market: '', agentName: type.name })}
                                                    whileHover={{ scale: 1.02, y: -5 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    style={{ '--accent-color': type.color } as React.CSSProperties}
                                                >
                                                    <div className={styles.optionIcon} style={{ color: type.color }}>
                                                        {type.icon}
                                                    </div>
                                                    <h3>{type.name}</h3>
                                                    <p>{type.description}</p>
                                                    <span className={styles.catchphrase}>{type.catchphrase}</span>
                                                    <span className={styles.deploymentBadge}>{type.deployment}</span>
                                                    {config.agentType === type.id && (
                                                        <motion.div
                                                            className={styles.checkBadge}
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                        >
                                                            <Check size={14} />
                                                        </motion.div>
                                                    )}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 1: Market */}
                                {currentStep === 1 && (
                                    <motion.div
                                        key="step1"
                                        className={styles.stepPanel}
                                        initial={{ opacity: 0, x: 50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -50 }}
                                    >
                                        <h2><Globe size={24} /> Where should {selectedType?.name} focus?</h2>
                                        <div className={styles.optionGrid}>
                                            {availableMarkets.map((market) => (
                                                <motion.button
                                                    key={market.id}
                                                    className={`${styles.optionCard} ${styles.marketCard} ${config.market === market.id ? styles.selected : ''}`}
                                                    onClick={() => setConfig({ ...config, market: market.id })}
                                                    whileHover={{ scale: 1.02, y: -5 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    style={{ '--accent-color': selectedType?.color } as React.CSSProperties}
                                                >
                                                    <h3>{market.name}</h3>
                                                    <p>{market.description}</p>
                                                    {config.market === market.id && (
                                                        <motion.div
                                                            className={styles.checkBadge}
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                        >
                                                            <Check size={14} />
                                                        </motion.div>
                                                    )}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 2: Strategy */}
                                {currentStep === 2 && (
                                    <motion.div
                                        key="step2"
                                        className={styles.stepPanel}
                                        initial={{ opacity: 0, x: 50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -50 }}
                                    >
                                        <h2><LineChart size={24} /> How should {selectedType?.name} trade?</h2>
                                        <div className={styles.optionGrid}>
                                            {STRATEGIES.map((strat) => (
                                                <motion.button
                                                    key={strat.id}
                                                    className={`${styles.optionCard} ${config.strategy === strat.id ? styles.selected : ''}`}
                                                    onClick={() => setConfig({ ...config, strategy: strat.id })}
                                                    whileHover={{ scale: 1.02, y: -5 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    style={{ '--accent-color': selectedType?.color } as React.CSSProperties}
                                                >
                                                    <div className={styles.optionIcon} style={{ color: selectedType?.color }}>
                                                        {strat.icon}
                                                    </div>
                                                    <h3>{strat.name}</h3>
                                                    <p>{strat.description}</p>
                                                    {config.strategy === strat.id && (
                                                        <motion.div
                                                            className={styles.checkBadge}
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                        >
                                                            <Check size={14} />
                                                        </motion.div>
                                                    )}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 3: Capital & Risk */}
                                {currentStep === 3 && (
                                    <motion.div
                                        key="step3"
                                        className={styles.stepPanel}
                                        initial={{ opacity: 0, x: 50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -50 }}
                                    >
                                        <h2><PieChart size={24} /> Set {selectedType?.name}'s bankroll</h2>
                                        <div className={styles.inputsGrid}>
                                            <div className={styles.inputGroup}>
                                                <label>Starting Capital</label>
                                                <div className={styles.inputWrapper}>
                                                    <span className={styles.inputPrefix}>$</span>
                                                    <input
                                                        type="number"
                                                        value={config.capital}
                                                        onChange={(e) => setConfig({ ...config, capital: Number(e.target.value) })}
                                                        min={100}
                                                        step={100}
                                                    />
                                                </div>
                                                <span className={styles.inputHint}>Minimum: $100</span>
                                            </div>

                                            <div className={styles.inputGroup}>
                                                <label>Risk / Reward Ratio</label>
                                                <div className={styles.inputWrapper}>
                                                    <span className={styles.inputPrefix}>1:</span>
                                                    <input
                                                        type="number"
                                                        value={config.riskReward}
                                                        onChange={(e) => setConfig({ ...config, riskReward: Number(e.target.value) })}
                                                        min={1}
                                                        max={10}
                                                        step={0.5}
                                                    />
                                                </div>
                                                <span className={styles.inputHint}>Recommended: 1:2 or higher</span>
                                            </div>

                                            <div className={styles.inputGroup}>
                                                <label>Agent Name (Optional)</label>
                                                <div className={styles.inputWrapper}>
                                                    <input
                                                        type="text"
                                                        value={config.agentName}
                                                        onChange={(e) => setConfig({ ...config, agentName: e.target.value })}
                                                        placeholder={generateAgentName(config.agentType)}
                                                    />
                                                </div>
                                                <span className={styles.inputHint}>Leave blank for auto-generated name</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 4: Review & Launch */}
                                {currentStep === 4 && (
                                    <motion.div
                                        key="step4"
                                        className={styles.stepPanel}
                                        initial={{ opacity: 0, x: 50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -50 }}
                                    >
                                        <h2><Rocket size={24} /> {selectedType?.name} is ready to deploy!</h2>
                                        <div className={styles.reviewCard}>
                                            <div className={styles.reviewHeader}>
                                                <div className={styles.agentAvatar} style={{ background: selectedType?.color }}>
                                                    {selectedType?.icon}
                                                </div>
                                                <div>
                                                    <h3>{selectedType?.name}</h3>
                                                    <p>{selectedType?.deployment}</p>
                                                </div>
                                            </div>
                                            <div className={styles.reviewDetails}>
                                                <div className={styles.reviewItem}>
                                                    <span>Market</span>
                                                    <strong>{availableMarkets.find(m => m.id === config.market)?.name}</strong>
                                                </div>
                                                <div className={styles.reviewItem}>
                                                    <span>Strategy</span>
                                                    <strong>{STRATEGIES.find(s => s.id === config.strategy)?.name}</strong>
                                                </div>
                                                <div className={styles.reviewItem}>
                                                    <span>Capital</span>
                                                    <strong>${config.capital.toLocaleString()}</strong>
                                                </div>
                                                <div className={styles.reviewItem}>
                                                    <span>Risk/Reward</span>
                                                    <strong>1:{config.riskReward}</strong>
                                                </div>
                                            </div>
                                            <div className={styles.dataSourceInfo}>
                                                <Cpu size={16} />
                                                <span>Powered by real-time market data from Yahoo Finance API</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Footer */}
                        <div className={styles.footer}>
                            <motion.button
                                className={styles.prevBtn}
                                onClick={handlePrev}
                                disabled={currentStep === 0}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <ArrowLeft size={18} />
                                Back
                            </motion.button>

                            {currentStep < WIZARD_STEPS.length - 1 ? (
                                <motion.button
                                    className={styles.nextBtn}
                                    onClick={handleNext}
                                    disabled={!canProceed()}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    style={{ '--accent-color': selectedType?.color || '#a855f7' } as React.CSSProperties}
                                >
                                    Next
                                    <ArrowRight size={18} />
                                </motion.button>
                            ) : (
                                <motion.button
                                    className={styles.launchBtn}
                                    onClick={handleLaunch}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <Rocket size={18} />
                                    Deploy Agent
                                    <Sparkles size={18} />
                                </motion.button>
                            )}
                        </div>
                    </>
                )}
            </motion.div>
        </motion.div>
    );
}
