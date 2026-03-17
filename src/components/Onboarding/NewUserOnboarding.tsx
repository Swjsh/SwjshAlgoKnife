'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { getIdToken } from '@/lib/firebase-client';
import { LogoIcon } from '@/components/UI/LogoIcon';
import {
    Bot, TrendingUp, Bitcoin, DollarSign, BarChart3,
    Zap, Shield, Target, ArrowRight, ArrowLeft, Check,
    Sparkles, Rocket, Activity, Globe, LineChart,
    ExternalLink, Eye, EyeOff, Clock, AlertTriangle
} from 'lucide-react';
import styles from './NewUserOnboarding.module.css';

/* ═══════════════════════════════════════════════════════════
   Data Constants
   ═══════════════════════════════════════════════════════════ */

const STEPS = ['Welcome', 'Legal', 'Broker', 'Agent', 'Configure', 'Deploy'];

const AGENT_TYPES = [
    {
        id: 'forex',
        name: 'Pivot Pete',
        icon: <DollarSign size={28} />,
        color: '#22c55e',
        description: 'FX pairs hunter — lives for daily pivots',
        quote: '"Pips don\'t sleep, and neither do I."',
        market: 'Currency Markets',
    },
    {
        id: 'crypto',
        name: 'Bitcoin Bob',
        icon: <Bitcoin size={28} />,
        color: '#f59e0b',
        description: 'Crypto degen with a plan. Catches pumps, dodges rugs.',
        quote: '"WAGMI... with actual risk management."',
        market: 'Digital Assets',
    },
    {
        id: 'futures',
        name: 'Futures Frank',
        icon: <BarChart3 size={28} />,
        color: '#3b82f6',
        description: 'Index futures specialist. ES, NQ, all day.',
        quote: '"The trend is your friend until the bend."',
        market: 'Index Futures',
    },
    {
        id: 'options',
        name: 'Theta Tom',
        icon: <Target size={28} />,
        color: '#a855f7',
        description: 'Options strategist. Sells premium, collects theta.',
        quote: '"Time decay waits for no one."',
        market: 'Derivatives',
    },
];

const MARKETS: Record<string, { id: string; name: string; desc: string }[]> = {
    forex: [
        { id: 'eurusd', name: 'EUR/USD', desc: 'Euro / US Dollar' },
        { id: 'gbpusd', name: 'GBP/USD', desc: 'British Pound / US Dollar' },
        { id: 'usdjpy', name: 'USD/JPY', desc: 'US Dollar / Japanese Yen' },
        { id: 'audusd', name: 'AUD/USD', desc: 'Australian Dollar / US Dollar' },
    ],
    crypto: [
        { id: 'btcusd', name: 'BTC/USD', desc: 'Bitcoin / US Dollar' },
        { id: 'ethusd', name: 'ETH/USD', desc: 'Ethereum / US Dollar' },
        { id: 'solusd', name: 'SOL/USD', desc: 'Solana / US Dollar' },
        { id: 'xrpusd', name: 'XRP/USD', desc: 'Ripple / US Dollar' },
    ],
    futures: [
        { id: 'es', name: 'ES (S&P 500)', desc: 'E-mini S&P 500 Futures' },
        { id: 'nq', name: 'NQ (Nasdaq)', desc: 'E-mini Nasdaq-100 Futures' },
        { id: 'cl', name: 'CL (Crude Oil)', desc: 'Crude Oil Futures' },
        { id: 'gc', name: 'GC (Gold)', desc: 'Gold Futures' },
    ],
    options: [
        { id: 'spy', name: 'SPY Options', desc: 'S&P 500 ETF Options' },
        { id: 'qqq', name: 'QQQ Options', desc: 'Nasdaq-100 ETF Options' },
        { id: 'iwm', name: 'IWM Options', desc: 'Russell 2000 ETF Options' },
        { id: 'aapl', name: 'AAPL Options', desc: 'Apple Inc. Options' },
    ],
};

const STRATEGIES = [
    { id: 'momentum', name: 'Momentum Breakout', icon: <Zap size={20} />, desc: 'Ride strong price movements' },
    { id: 'support_resistance', name: 'Support / Resistance', icon: <Shield size={20} />, desc: 'Trade key price levels' },
    { id: 'mean_reversion', name: 'Mean Reversion', icon: <Activity size={20} />, desc: 'Fade overextended moves' },
    { id: 'trend_following', name: 'Trend Following', icon: <TrendingUp size={20} />, desc: 'Follow the dominant trend' },
];

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

interface AccountPreview {
    id: string;
    accountNumber: string;
    status: string;
    currency: string;
    cash: number;
    buyingPower: number;
    equity: number;
    portfolioValue: number;
    patternDayTrader: boolean;
    tradingBlocked: boolean;
}

interface Props {
    onComplete: () => void;
    onSkip: () => void;
}

/* ═══════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════ */

export default function NewUserOnboarding({ onComplete, onSkip }: Props) {
    const router = useRouter();
    const { updatePreferences } = useAuth();

    // ── Wizard state ──
    const [step, setStep] = useState(0);

    // ── Legal state ──
    const [accepted, setAccepted] = useState({ tos: false, waiver: false });

    // ── Broker state ──
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [showSecret, setShowSecret] = useState(false);
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [brokerError, setBrokerError] = useState('');
    const [accountPreview, setAccountPreview] = useState<AccountPreview | null>(null);
    const [brokerConnected, setBrokerConnected] = useState(false);
    const [brokerSkipped, setBrokerSkipped] = useState(false);

    // ── Agent state ──
    const [agentType, setAgentType] = useState('');
    const [market, setMarket] = useState('');
    const [strategy, setStrategy] = useState('');
    const [capital, setCapital] = useState(10000);
    const [riskReward, setRiskReward] = useState(2);

    // ── Launch state ──
    const [isLaunching, setIsLaunching] = useState(false);

    // ── Legal persistence state ──
    const [legalSaved, setLegalSaved] = useState(false);
    const [legalSaving, setLegalSaving] = useState(false);

    // ── Derived ──
    const selectedAgent = AGENT_TYPES.find((a) => a.id === agentType);
    const availableMarkets = agentType ? MARKETS[agentType] ?? [] : [];

    /* ── Persist legal acceptance to server immediately on step transition ── */
    const saveLegalAcceptance = async (): Promise<boolean> => {
        if (legalSaved) return true;
        setLegalSaving(true);
        try {
            const token = await getIdToken();
            const res = await fetch('/api/onboarding/legal', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ acceptedTerms: true, acceptedWaiver: true }),
            });
            if (!res.ok) {
                console.error('Failed to save legal acceptance:', await res.text());
                return false;
            }
            setLegalSaved(true);
            return true;
        } catch (err) {
            console.error('Legal acceptance save error:', err);
            return false;
        } finally {
            setLegalSaving(false);
        }
    };

    /* ── Navigation helpers ── */
    const next = async () => {
        // When leaving the Legal step, persist acceptance to server FIRST
        if (step === 1) {
            const saved = await saveLegalAcceptance();
            if (!saved) {
                // Don't proceed if we couldn't save - show error
                setBrokerError('Failed to save legal acceptance. Please try again.');
                return;
            }
        }
        setStep((s) => Math.min(s + 1, STEPS.length - 1));
    };
    const prev = () => setStep((s) => Math.max(s - 1, 0));

    const canProceed = (): boolean => {
        switch (step) {
            case 0: return true; // welcome
            case 1: return accepted.tos && accepted.waiver; // legal
            case 2: return brokerConnected || brokerSkipped; // broker
            case 3: return agentType !== ''; // agent
            case 4: return market !== '' && strategy !== '' && capital >= 100 && riskReward >= 1; // configure
            default: return true;
        }
    };

    /* ── Broker handlers ── */
    const handleTestConnection = async () => {
        setBrokerError('');
        setTesting(true);
        setAccountPreview(null);
        try {
            const token = await getIdToken();
            const res = await fetch('/api/brokers/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ broker: 'ALPACA', environment: 'PAPER', apiKey, apiSecret }),
            });
            const data = await res.json();
            if (!data.success) {
                setBrokerError(data.error || 'Connection test failed');
                return;
            }
            setAccountPreview(data.account);
        } catch (err: any) {
            setBrokerError(err.message || 'Failed to test connection');
        } finally {
            setTesting(false);
        }
    };

    const handleSaveBroker = async () => {
        setBrokerError('');
        setSaving(true);
        try {
            const token = await getIdToken();
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            };

            const saveRes = await fetch('/api/brokers', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    broker: 'ALPACA',
                    environment: 'PAPER',
                    label: 'Paper Trading',
                    apiKey,
                    apiSecret,
                }),
            });

            if (!saveRes.ok) {
                const data = await saveRes.json();
                throw new Error(data.error || 'Failed to save broker');
            }

            const { broker: saved } = await saveRes.json();

            const verifyRes = await fetch(`/api/brokers/${saved.id}/verify`, {
                method: 'POST',
                headers,
            });

            if (!verifyRes.ok) {
                const data = await verifyRes.json();
                await fetch(`/api/brokers/${saved.id}`, { method: 'DELETE', headers });
                throw new Error(data.error || 'Verification failed. Check your credentials.');
            }

            setBrokerConnected(true);
        } catch (err: any) {
            setBrokerError(err.message || 'An error occurred');
        } finally {
            setSaving(false);
        }
    };

    const handleSkipBroker = () => {
        setBrokerSkipped(true);
    };

    /* ── Launch handler ── */
    const handleLaunch = async () => {
        setIsLaunching(true);

        try {
            // Ensure legal acceptance was persisted (safety net — should already be saved)
            if (!legalSaved) {
                const saved = await saveLegalAcceptance();
                if (!saved) {
                    setIsLaunching(false);
                    return;
                }
            }

            // Mark onboarding complete on server
            const token = await getIdToken();
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            };

            await fetch('/api/onboarding/complete', { method: 'POST', headers });

            // Save agent config + mark agent setup complete
            await updatePreferences({
                onboardingComplete: true,
                agentSetupComplete: true,
                firstAgentConfig: {
                    agentType,
                    market,
                    strategy,
                    capital,
                    riskReward,
                    agentName: selectedAgent?.name || 'Agent Alpha',
                },
            });

            // Give time for launch animation
            await new Promise((r) => setTimeout(r, 2200));

            onComplete();
            router.push('/command-center');
        } catch (err) {
            console.error('Onboarding completion error:', err);
            // Complete anyway to not block user
            onComplete();
            router.push('/command-center');
        }
    };

    /* ═══════════════════════════════════════════════════════
       Step renderers
       ═══════════════════════════════════════════════════════ */

    const renderWelcome = () => (
        <motion.div key="welcome" className={styles.stepPanel} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            <h2><Sparkles size={22} /> Welcome to SwjshAK</h2>
            <p className={styles.subtitle}>Your autonomous trading platform. We'll get you set up in about 3 minutes — connect a paper broker, pick your first trading agent, and deploy.</p>

            <div className={styles.welcomeFeatures}>
                {[
                    { icon: '🤖', bg: 'rgba(168,85,247,0.12)', title: 'Deploy Agents', desc: 'Autonomous bots that trade 24/7' },
                    { icon: '📊', bg: 'rgba(6,182,212,0.1)', title: 'Strategies', desc: 'ORB, VWAP, Grid & more' },
                    { icon: '📈', bg: 'rgba(34,197,94,0.1)', title: 'Track P&L', desc: 'Real-time performance analytics' },
                ].map((f) => (
                    <div key={f.title} className={styles.welcomeFeat}>
                        <div className={styles.welcomeFeatIcon} style={{ background: f.bg }}>{f.icon}</div>
                        <h3>{f.title}</h3>
                        <p>{f.desc}</p>
                    </div>
                ))}
            </div>

            <div className={styles.welcomeTimeline}>
                <Clock size={14} />
                <span>Takes about 3 minutes to complete</span>
            </div>
        </motion.div>
    );

    const renderLegal = () => (
        <motion.div key="legal" className={styles.stepPanel} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            <h2><Shield size={22} /> Legal & Risk Disclosure</h2>
            <p className={styles.subtitle}>Please review and acknowledge before proceeding.</p>

            <div className={styles.warningCard}>
                <div className={styles.warningTitle}>
                    <AlertTriangle size={16} /> Not Financial Advice
                </div>
                <div className={styles.warningBody}>
                    <p>SwjshAK is a software tool for automated trading. <strong>All trading involves substantial risk of loss.</strong> Past performance does not guarantee future results.</p>
                    <p><strong>You are solely responsible for your trading decisions.</strong></p>
                </div>
            </div>

            <div className={styles.waiverBox}>
                <p>By using SwjshAK, you acknowledge and agree that:</p>
                <ul className={styles.waiverList}>
                    <li>Trading involves substantial risk of loss</li>
                    <li>Automated systems can malfunction or produce unexpected results</li>
                    <li>You will only trade with funds you can afford to lose</li>
                    <li>You understand Paper Trading before attempting Live Trading</li>
                    <li>You will not hold SwjshAK liable for any trading losses</li>
                    <li>You are responsible for securing your API credentials</li>
                    <li>You are legally permitted to trade in your jurisdiction</li>
                </ul>
            </div>

            <div className={styles.checkboxes}>
                <label className={`${styles.checkLabel} ${accepted.tos ? styles.checked : ''}`}>
                    <div className={styles.checkWrap}>
                        <input type="checkbox" checked={accepted.tos} onChange={(e) => setAccepted({ ...accepted, tos: e.target.checked })} />
                        <div className={styles.checkBox}>
                            <svg viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
                                <polyline points="1.5,6 4.5,9 10.5,3" />
                            </svg>
                        </div>
                    </div>
                    <span className={styles.checkText}>
                        I have read and accept the <a href="/legal/terms" target="_blank" onClick={(e) => e.stopPropagation()}>Terms of Service</a> and <a href="/legal/privacy" target="_blank" onClick={(e) => e.stopPropagation()}>Privacy Policy</a>
                    </span>
                </label>
                <label className={`${styles.checkLabel} ${accepted.waiver ? styles.checked : ''}`}>
                    <div className={styles.checkWrap}>
                        <input type="checkbox" checked={accepted.waiver} onChange={(e) => setAccepted({ ...accepted, waiver: e.target.checked })} />
                        <div className={styles.checkBox}>
                            <svg viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
                                <polyline points="1.5,6 4.5,9 10.5,3" />
                            </svg>
                        </div>
                    </div>
                    <span className={styles.checkText}>
                        I understand the risks of algorithmic trading and accept the Liability Waiver
                    </span>
                </label>
            </div>
        </motion.div>
    );

    const renderBroker = () => (
        <motion.div key="broker" className={styles.stepPanel} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            <h2><Globe size={22} /> Connect Alpaca Paper Account</h2>
            <p className={styles.subtitle}>Link a free Alpaca paper trading account so your agents can execute simulated trades.</p>

            {/* Alpaca badge */}
            <div className={styles.brokerBadge}>
                <div className={styles.brokerLogo}>🦙</div>
                <div className={styles.brokerInfo}>
                    <h3>Alpaca Markets</h3>
                    <p>Commission-free stock & crypto trading API</p>
                </div>
                <span className={styles.brokerTag}>Paper</span>
            </div>

            {brokerConnected ? (
                /* Connected state */
                <div className={styles.accountPreview}>
                    <div className={styles.previewHeader}>
                        <div className={styles.previewCheck}>
                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="1.5,6 4.5,9 10.5,3" />
                            </svg>
                        </div>
                        <p className={styles.previewTitle}>Alpaca Paper Account Connected</p>
                    </div>
                    {accountPreview && (
                        <div className={styles.previewGrid}>
                            <div>
                                <p className={styles.previewLabel}>Account</p>
                                <p className={styles.previewVal}>{accountPreview.accountNumber}</p>
                            </div>
                            <div>
                                <p className={styles.previewLabel}>Status</p>
                                <p className={`${styles.previewVal} ${styles.green}`}>{accountPreview.status}</p>
                            </div>
                            <div>
                                <p className={styles.previewLabel}>Cash</p>
                                <p className={styles.previewVal}>${accountPreview.cash.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div>
                                <p className={styles.previewLabel}>Buying Power</p>
                                <p className={`${styles.previewVal} ${styles.cyan}`}>${accountPreview.buyingPower.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* Signup guide */}
                    <div className={styles.signupGuide}>
                        <h4>Need an Alpaca account?</h4>
                        <ol className={styles.signupSteps}>
                            <li>Visit <a href="https://app.alpaca.markets/signup" target="_blank" rel="noopener noreferrer">alpaca.markets/signup</a> and create a free account</li>
                            <li>Navigate to <strong style={{ color: '#e2e8f0' }}>Paper Trading</strong> in the left sidebar</li>
                            <li>Go to <strong style={{ color: '#e2e8f0' }}>API Keys</strong> and generate new keys</li>
                            <li>Copy your API Key and Secret Key into the fields below</li>
                        </ol>
                        <a href="https://app.alpaca.markets/signup" target="_blank" rel="noopener noreferrer" className={styles.signupCta}>
                            Create Free Alpaca Account <ExternalLink size={14} />
                        </a>
                    </div>

                    {/* API fields */}
                    <div className={styles.apiFields}>
                        <div className={styles.field}>
                            <label>API Key</label>
                            <input
                                type="text"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="PK..."
                                className={styles.apiInput}
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck={false}
                            />
                        </div>
                        <div className={styles.field}>
                            <label>Secret Key</label>
                            <div className={styles.inputWrap}>
                                <input
                                    type={showSecret ? 'text' : 'password'}
                                    value={apiSecret}
                                    onChange={(e) => setApiSecret(e.target.value)}
                                    placeholder="••••••••••••••••••••"
                                    className={`${styles.apiInput} ${styles.apiInputPw}`}
                                    autoComplete="new-password"
                                />
                                <button type="button" className={styles.pwToggle} onClick={() => setShowSecret(!showSecret)} tabIndex={-1}>
                                    {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        <div className={styles.testRow}>
                            <button type="button" disabled={testing || !apiKey || !apiSecret} className={styles.testBtn} onClick={handleTestConnection}>
                                {testing ? 'Testing...' : accountPreview ? 'Re-test' : 'Test Connection'}
                            </button>
                            <button type="button" disabled={saving || !apiKey || !apiSecret} className={styles.testBtn} onClick={handleSaveBroker} style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.35)', color: '#4ade80' }}>
                                {saving ? <span className={styles.spinner} /> : 'Connect & Save'}
                            </button>
                        </div>

                        {/* Account preview from test */}
                        {accountPreview && !brokerConnected && (
                            <div className={styles.accountPreview}>
                                <div className={styles.previewHeader}>
                                    <div className={styles.previewCheck}>
                                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="1.5,6 4.5,9 10.5,3" />
                                        </svg>
                                    </div>
                                    <p className={styles.previewTitle}>Connection Successful</p>
                                </div>
                                <div className={styles.previewGrid}>
                                    <div>
                                        <p className={styles.previewLabel}>Account</p>
                                        <p className={styles.previewVal}>{accountPreview.accountNumber}</p>
                                    </div>
                                    <div>
                                        <p className={styles.previewLabel}>Cash</p>
                                        <p className={styles.previewVal}>${accountPreview.cash.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {brokerError && (
                        <div className={styles.errorBox}>
                            <AlertTriangle size={14} style={{ color: '#fca5a5', flexShrink: 0, marginTop: '1px' }} />
                            <p>{brokerError}</p>
                        </div>
                    )}

                    {/* Skip option */}
                    {!brokerSkipped && (
                        <button type="button" onClick={handleSkipBroker} style={{ display: 'block', width: '100%', textAlign: 'center', background: 'none', border: 'none', fontFamily: 'inherit', fontSize: '0.72rem', color: '#374151', cursor: 'pointer', padding: '0.6rem', marginTop: '0.5rem', transition: 'color 0.15s' }}>
                            Skip for now — add broker later in Settings
                        </button>
                    )}
                </>
            )}
        </motion.div>
    );

    const renderAgentSelect = () => (
        <motion.div key="agent" className={styles.stepPanel} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            <h2><Bot size={22} /> Choose Your First Agent</h2>
            <p className={styles.subtitle}>Pick a specialist to trade for you. You can always add more agents later.</p>

            <div className={styles.agentGrid}>
                {AGENT_TYPES.map((agent) => (
                    <motion.button
                        key={agent.id}
                        className={`${styles.agentCard} ${agentType === agent.id ? styles.selected : ''}`}
                        onClick={() => {
                            setAgentType(agent.id);
                            setMarket('');
                        }}
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.98 }}
                        style={{ '--agent-color': agent.color } as React.CSSProperties}
                    >
                        <div className={styles.agentIcon} style={{ color: agent.color }}>
                            {agent.icon}
                        </div>
                        <h3>{agent.name}</h3>
                        <p>{agent.description}</p>
                        <span className={styles.agentQuote}>{agent.quote}</span>
                        <span className={styles.agentMarket}>{agent.market}</span>
                        {agentType === agent.id && (
                            <motion.div className={styles.selectedCheck} initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                <Check size={13} />
                            </motion.div>
                        )}
                    </motion.button>
                ))}
            </div>
        </motion.div>
    );

    const renderConfigure = () => (
        <motion.div key="config" className={styles.stepPanel} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            <h2><LineChart size={22} /> Configure {selectedAgent?.name}</h2>
            <p className={styles.subtitle}>Set up market, strategy, and risk parameters.</p>

            {/* Market pick */}
            <div className={styles.configSection}>
                <h3><Globe size={16} /> Market Focus</h3>
                <div className={styles.marketGrid}>
                    {availableMarkets.map((m) => (
                        <button
                            key={m.id}
                            className={`${styles.marketCard} ${market === m.id ? styles.selected : ''}`}
                            onClick={() => setMarket(m.id)}
                            style={{ '--agent-color': selectedAgent?.color } as React.CSSProperties}
                        >
                            <h4>{m.name}</h4>
                            <p>{m.desc}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Strategy pick */}
            <div className={styles.configSection}>
                <h3><Zap size={16} /> Trading Style</h3>
                <div className={styles.strategyGrid}>
                    {STRATEGIES.map((s) => (
                        <button
                            key={s.id}
                            className={`${styles.stratCard} ${strategy === s.id ? styles.selected : ''}`}
                            onClick={() => setStrategy(s.id)}
                            style={{ '--agent-color': selectedAgent?.color } as React.CSSProperties}
                        >
                            <div className={styles.stratIcon}>{s.icon}</div>
                            <div>
                                <h4>{s.name}</h4>
                                <p>{s.desc}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Risk params */}
            <div className={styles.configSection}>
                <h3><Shield size={16} /> Risk Parameters</h3>
                <div className={styles.riskInputs}>
                    <div className={styles.riskGroup}>
                        <label>Starting Capital</label>
                        <div className={styles.riskInputBox}>
                            <span className={styles.riskPrefix}>$</span>
                            <input type="number" value={capital} onChange={(e) => setCapital(Number(e.target.value))} min={100} step={100} />
                        </div>
                        <span className={styles.riskHint}>Minimum: $100</span>
                    </div>
                    <div className={styles.riskGroup}>
                        <label>Risk / Reward Ratio</label>
                        <div className={styles.riskInputBox}>
                            <span className={styles.riskPrefix}>1:</span>
                            <input type="number" value={riskReward} onChange={(e) => setRiskReward(Number(e.target.value))} min={1} max={10} step={0.5} />
                        </div>
                        <span className={styles.riskHint}>Recommended: 1:2 or higher</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );

    const renderDeploy = () => (
        <motion.div key="deploy" className={styles.stepPanel} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            <h2><Rocket size={22} /> Ready to Deploy</h2>
            <p className={styles.subtitle}>Review your configuration and launch your first agent.</p>

            <div className={styles.reviewCard}>
                <div className={styles.reviewHeader}>
                    <div className={styles.reviewAvatar} style={{ background: selectedAgent?.color }}>
                        {selectedAgent?.icon}
                    </div>
                    <div>
                        <h3>{selectedAgent?.name}</h3>
                        <p>{selectedAgent?.market}</p>
                    </div>
                </div>

                <div className={styles.reviewGrid}>
                    <div className={styles.reviewItem}>
                        <span>Market</span>
                        <strong>{availableMarkets.find((m) => m.id === market)?.name}</strong>
                    </div>
                    <div className={styles.reviewItem}>
                        <span>Strategy</span>
                        <strong>{STRATEGIES.find((s) => s.id === strategy)?.name}</strong>
                    </div>
                    <div className={styles.reviewItem}>
                        <span>Capital</span>
                        <strong>${capital.toLocaleString()}</strong>
                    </div>
                    <div className={styles.reviewItem}>
                        <span>Risk/Reward</span>
                        <strong>1:{riskReward}</strong>
                    </div>
                </div>

                <div className={styles.brokerStatus}>
                    <div className={`${styles.brokerStatusDot} ${brokerConnected ? styles.connected : styles.skipped}`} />
                    <span className={`${styles.brokerStatusText} ${brokerConnected ? '' : styles.skipped}`}>
                        {brokerConnected ? 'Alpaca Paper Account Connected' : 'Broker not connected — add in Settings'}
                    </span>
                </div>
            </div>
        </motion.div>
    );

    /* ═══════════════════════════════════════════════════════
       Launch screen
       ═══════════════════════════════════════════════════════ */

    if (isLaunching) {
        return (
            <div className={styles.overlay}>
                <div className={styles.gridBg} />
                <motion.div className={styles.wizardCard} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className={styles.launchScreen}>
                        <motion.div animate={{ rotate: 360, scale: [1, 1.15, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                            <Rocket size={64} className={styles.launchIcon} />
                        </motion.div>
                        <motion.h2 initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                            Deploying {selectedAgent?.name}...
                        </motion.h2>
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                            Setting up your trading agent. This will only take a moment.
                        </motion.p>
                        <div className={styles.progressTrack}>
                            <motion.div className={styles.progressFill} initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 2 }} />
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    /* ═══════════════════════════════════════════════════════
       Main render
       ═══════════════════════════════════════════════════════ */

    const stepRenderers = [renderWelcome, renderLegal, renderBroker, renderAgentSelect, renderConfigure, renderDeploy];

    return (
        <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className={styles.gridBg} />

            {/* Ambient orbs */}
            <div className={styles.orbs}>
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        className={styles.orb}
                        animate={{
                            x: [0, (i % 2 === 0 ? 40 : -40), 0],
                            y: [0, (i % 2 === 0 ? -30 : 30), 0],
                        }}
                        transition={{ duration: 10 + i * 3, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ left: `${15 + i * 30}%`, top: `${10 + i * 25}%` }}
                    />
                ))}
            </div>

            <motion.div
                className={styles.wizardCard}
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
            >
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.headerTop}>
                        <LogoIcon size={40} />
                        {/* Skip only available after legal acceptance (step > 1) to ensure ToS is recorded */}
                        {step > 1 && legalSaved && (
                            <button className={styles.skipBtn} onClick={onSkip}>Skip setup</button>
                        )}
                    </div>
                    <h1>{step === 0 ? 'Welcome to SwjshAK' : STEPS[step]}</h1>
                    <p>
                        {step === 0
                            ? 'Your autonomous trading command center'
                            : `Step ${step + 1} of ${STEPS.length}`}
                    </p>
                </div>

                {/* Progress */}
                <div className={styles.progressBar}>
                    {STEPS.map((name, idx) => (
                        <React.Fragment key={name}>
                            <div className={`${styles.progressStep} ${idx === step ? styles.active : ''} ${idx < step ? styles.done : ''}`}>
                                <div className={styles.stepDot}>
                                    {idx < step ? <Check size={13} /> : idx + 1}
                                </div>
                                <span className={styles.stepName}>{name}</span>
                            </div>
                            {idx < STEPS.length - 1 && (
                                <div className={`${styles.stepLine} ${idx < step ? styles.stepLineDone : ''}`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* Step content */}
                <div className={styles.stepContent}>
                    <AnimatePresence mode="wait">
                        {stepRenderers[step]()}
                    </AnimatePresence>
                </div>

                {/* Footer nav */}
                <div className={styles.footer}>
                    <motion.button
                        className={styles.prevBtn}
                        onClick={prev}
                        disabled={step === 0}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                    >
                        <ArrowLeft size={16} /> Back
                    </motion.button>

                    {step < STEPS.length - 1 ? (
                        <motion.button
                            className={styles.nextBtn}
                            onClick={next}
                            disabled={!canProceed()}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            {legalSaving ? (
                                <><span className={styles.spinner} /> Saving...</>
                            ) : (
                                <>{step === 0 ? "Let's Go" : 'Next'} <ArrowRight size={16} /></>
                            )}
                        </motion.button>
                    ) : (
                        <motion.button
                            className={styles.launchBtn}
                            onClick={handleLaunch}
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            <Rocket size={17} /> Deploy Agent <Sparkles size={17} />
                        </motion.button>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
