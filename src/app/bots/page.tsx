'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
    Bot,
    Plus,
    Play,
    Pause,
    Square,
    TrendingUp,
    TrendingDown,
    Activity,
    Settings,
    Trash2,
    RefreshCw,
    Shield,
    DollarSign,
    AlertCircle,
    CheckCircle,
    ArrowRight
} from 'lucide-react';
import styles from './Bots.module.css';

interface BotData {
    id: string;
    name: string;
    strategy: string;
    status: 'RUNNING' | 'STOPPED' | 'PAUSED';
    maxPositionSize: number;
    maxDailyLoss?: number;
    maxOpenPositions: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnl: number;
    winRate: number;
    broker?: {
        broker: string;
        environment: string;
        label: string;
    };
    createdAt: string;
}

export default function BotsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [bots, setBots] = useState<BotData[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newBot, setNewBot] = useState({
        name: '',
        strategy: 'ORB',
        maxPositionSize: 1000,
        maxOpenPositions: 1,
        maxDailyLoss: 500,
    });
    const [createError, setCreateError] = useState('');
    const [creating, setCreating] = useState(false);
    const [hasBroker, setHasBroker] = useState<boolean | null>(null);
    const [brokerInfo, setBrokerInfo] = useState<{ broker: string; environment: string } | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/sign-in');
        }
    }, [user, authLoading, router]);

    // Check broker status
    useEffect(() => {
        if (!user) return;
        const checkBroker = async () => {
            try {
                const res = await fetch('/api/brokers');
                if (res.ok) {
                    const data = await res.json();
                    const activeBroker = data.brokers?.find((b: any) =>
                        b.isActive && b.connectionStatus === 'CONNECTED'
                    );
                    setHasBroker(!!activeBroker);
                    if (activeBroker) {
                        setBrokerInfo({
                            broker: activeBroker.broker,
                            environment: activeBroker.environment,
                        });
                    }
                }
            } catch {
                setHasBroker(false);
            }
        };
        checkBroker();
    }, [user]);

    const fetchBots = async () => {
        try {
            const res = await fetch('/api/bots');
            if (res.ok) {
                const data = await res.json();
                setBots(data.bots || []);
            }
        } catch (error) {
            console.error('Failed to fetch bots:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchBots();
            const interval = setInterval(fetchBots, 10000); // Refresh every 10s
            return () => clearInterval(interval);
        }
    }, [user]);

    const handleBotControl = async (botId: string, action: 'start' | 'stop' | 'pause') => {
        try {
            const res = await fetch(`/api/bots/${botId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });

            if (res.ok) {
                fetchBots();
            }
        } catch (error) {
            console.error(`Failed to ${action} bot:`, error);
        }
    };

    const handleDeleteBot = async (botId: string) => {
        if (!confirm('Are you sure you want to delete this bot? This cannot be undone.')) {
            return;
        }

        try {
            const res = await fetch(`/api/bots?id=${botId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                fetchBots();
            }
        } catch (error) {
            console.error('Failed to delete bot:', error);
        }
    };

    const handleCreateBot = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError('');
        setCreating(true);

        try {
            const res = await fetch('/api/bots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newBot),
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.code === 'NO_BROKER') {
                    setCreateError('Please connect a broker first before creating a bot.');
                } else {
                    setCreateError(data.error || 'Failed to create bot');
                }
                setCreating(false);
                return;
            }

            // Success
            setShowCreateModal(false);
            setNewBot({
                name: '',
                strategy: 'ORB',
                maxPositionSize: 1000,
                maxOpenPositions: 1,
                maxDailyLoss: 500,
            });
            setCreating(false);
            fetchBots();
        } catch (error: any) {
            console.error('Failed to create bot:', error);
            setCreateError(error.message || 'Failed to create bot');
            setCreating(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className={styles.loading}>
                <Activity size={32} className={styles.spinner} />
                <p>Loading bots...</p>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>My Trading Bots</h1>
                    <p className={styles.subtitle}>
                        Manage your automated trading strategies
                        {brokerInfo && (
                            <span style={{
                                marginLeft: 12,
                                fontSize: 11,
                                padding: '3px 8px',
                                borderRadius: 4,
                                background: brokerInfo.environment === 'PAPER'
                                    ? 'rgba(6, 182, 212, 0.15)'
                                    : 'rgba(239, 68, 68, 0.15)',
                                color: brokerInfo.environment === 'PAPER' ? '#06b6d4' : '#ef4444',
                            }}>
                                {brokerInfo.broker} {brokerInfo.environment}
                            </span>
                        )}
                    </p>
                </div>
                {hasBroker === false ? (
                    <button
                        className={styles.createBtn}
                        onClick={() => router.push('/accounts')}
                        style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                    >
                        <AlertCircle size={18} />
                        Connect Broker
                    </button>
                ) : (
                    <button
                        className={styles.createBtn}
                        onClick={() => setShowCreateModal(true)}
                        disabled={hasBroker === null}
                    >
                        <Plus size={18} />
                        Create Bot
                    </button>
                )}
            </div>

            {/* Stats Summary */}
            {bots.length > 0 && (
                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <div className={styles.statLabel}>Total Bots</div>
                        <div className={styles.statValue}>{bots.length}</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statLabel}>Active</div>
                        <div className={styles.statValue}>
                            {bots.filter(b => b.status === 'RUNNING').length}
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statLabel}>Total Trades</div>
                        <div className={styles.statValue}>
                            {bots.reduce((sum, b) => sum + b.totalTrades, 0)}
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statLabel}>Combined P&L</div>
                        <div className={`${styles.statValue} ${bots.reduce((sum, b) => sum + b.totalPnl, 0) >= 0 ? styles.positive : styles.negative}`}>
                            ${bots.reduce((sum, b) => sum + b.totalPnl, 0).toFixed(2)}
                        </div>
                    </div>
                </div>
            )}

            {/* Bots Grid */}
            {bots.length === 0 ? (
                <div className={styles.emptyState}>
                    <Bot size={64} className={styles.emptyIcon} />
                    <h2>No Trading Bots Yet</h2>
                    <p style={{ maxWidth: 400, margin: '0 auto 24px', lineHeight: 1.6 }}>
                        Create an automated bot to start trading with one of our proven strategies.
                        Bots execute trades automatically based on your configured rules.
                    </p>

                    {/* Setup Checklist */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        marginBottom: 24,
                        padding: '16px 20px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.08)',
                        maxWidth: 320,
                        margin: '0 auto 24px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <CheckCircle size={16} style={{ color: '#10b981' }} />
                            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Account created</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {hasBroker ? (
                                <CheckCircle size={16} style={{ color: '#10b981' }} />
                            ) : (
                                <AlertCircle size={16} style={{ color: '#f59e0b' }} />
                            )}
                            <span style={{ color: hasBroker ? 'rgba(255,255,255,0.7)' : '#f59e0b', fontSize: 13 }}>
                                {hasBroker ? `Broker connected (${brokerInfo?.broker} ${brokerInfo?.environment})` : 'Connect a broker'}
                            </span>
                            {!hasBroker && (
                                <a href="/accounts" style={{
                                    marginLeft: 'auto',
                                    fontSize: 11,
                                    color: '#06b6d4',
                                    textDecoration: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                }}>
                                    Setup <ArrowRight size={12} />
                                </a>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                border: '2px solid rgba(255,255,255,0.2)',
                            }} />
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Create your first bot</span>
                        </div>
                    </div>

                    {hasBroker ? (
                        <button
                            className={styles.createBtn}
                            onClick={() => setShowCreateModal(true)}
                        >
                            <Plus size={18} />
                            Create Your First Bot
                        </button>
                    ) : (
                        <button
                            className={styles.createBtn}
                            onClick={() => router.push('/accounts')}
                            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                        >
                            <AlertCircle size={18} />
                            Connect Broker First
                        </button>
                    )}

                    <p style={{
                        marginTop: 16,
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.35)',
                    }}>
                        Tip: Start with Paper Trading to test strategies risk-free
                    </p>
                </div>
            ) : (
                <div className={styles.botsGrid}>
                    {bots.map(bot => (
                        <div key={bot.id} className={styles.botCard}>
                            {/* Header */}
                            <div className={styles.botHeader}>
                                <div className={styles.botInfo}>
                                    <div className={styles.botIcon}>
                                        <Bot size={20} />
                                    </div>
                                    <div>
                                        <h3 className={styles.botName}>{bot.name}</h3>
                                        <p className={styles.botStrategy}>{bot.strategy}</p>
                                    </div>
                                </div>
                                <div className={`${styles.statusBadge} ${styles[bot.status.toLowerCase()]}`}>
                                    {bot.status === 'RUNNING' && <Activity size={12} className={styles.pulse} />}
                                    {bot.status}
                                </div>
                            </div>

                            {/* Performance */}
                            <div className={styles.botPerformance}>
                                <div className={styles.perfRow}>
                                    <span className={styles.perfLabel}>Win Rate</span>
                                    <span className={styles.perfValue}>{bot.winRate}%</span>
                                </div>
                                <div className={styles.perfRow}>
                                    <span className={styles.perfLabel}>Trades</span>
                                    <span className={styles.perfValue}>
                                        <span className={styles.wins}>{bot.winningTrades}W</span>
                                        {' / '}
                                        <span className={styles.losses}>{bot.losingTrades}L</span>
                                    </span>
                                </div>
                                <div className={styles.perfRow}>
                                    <span className={styles.perfLabel}>Total P&L</span>
                                    <span className={`${styles.perfValue} ${bot.totalPnl >= 0 ? styles.positive : styles.negative}`}>
                                        {bot.totalPnl >= 0 ? '+' : ''}${bot.totalPnl.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* Broker Info */}
                            {bot.broker && (
                                <div className={styles.brokerInfo}>
                                    <span style={{ fontSize: '14px' }}>
                                        {bot.broker.broker === 'ALPACA' ? '🦙' : '🏦'}
                                    </span>
                                    <span>{bot.broker.label || bot.broker.broker}</span>
                                    <span style={{
                                        fontSize: '10px',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: bot.broker.environment === 'PAPER'
                                            ? 'rgba(6, 182, 212, 0.15)'
                                            : 'rgba(239, 68, 68, 0.15)',
                                        color: bot.broker.environment === 'PAPER'
                                            ? '#06b6d4'
                                            : '#ef4444',
                                    }}>
                                        {bot.broker.environment}
                                    </span>
                                </div>
                            )}

                            {/* Actions */}
                            <div className={styles.botActions}>
                                {bot.status === 'STOPPED' ? (
                                    <button
                                        className={`${styles.actionBtn} ${styles.start}`}
                                        onClick={() => handleBotControl(bot.id, 'start')}
                                    >
                                        <Play size={16} />
                                        Start
                                    </button>
                                ) : bot.status === 'RUNNING' ? (
                                    <>
                                        <button
                                            className={`${styles.actionBtn} ${styles.pause}`}
                                            onClick={() => handleBotControl(bot.id, 'pause')}
                                        >
                                            <Pause size={16} />
                                            Pause
                                        </button>
                                        <button
                                            className={`${styles.actionBtn} ${styles.stop}`}
                                            onClick={() => handleBotControl(bot.id, 'stop')}
                                        >
                                            <Square size={16} />
                                            Stop
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        className={`${styles.actionBtn} ${styles.start}`}
                                        onClick={() => handleBotControl(bot.id, 'start')}
                                    >
                                        <Play size={16} />
                                        Resume
                                    </button>
                                )}

                                <button
                                    className={`${styles.actionBtn} ${styles.iconOnly}`}
                                    onClick={() => router.push(`/bots/${bot.id}`)}
                                    title="Settings"
                                >
                                    <Settings size={16} />
                                </button>

                                <button
                                    className={`${styles.actionBtn} ${styles.iconOnly} ${styles.danger}`}
                                    onClick={() => handleDeleteBot(bot.id)}
                                    title="Delete"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Bot Modal */}
            {showCreateModal && (
                <div className={styles.modal} onClick={() => setShowCreateModal(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <h2>Create New Trading Bot</h2>
                        <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginBottom: '24px' }}>
                            Configure your automated trading bot
                        </p>

                        <form onSubmit={handleCreateBot} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Bot Name */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)' }}>
                                    Bot Name
                                </label>
                                <input
                                    type="text"
                                    value={newBot.name}
                                    onChange={(e) => setNewBot({ ...newBot, name: e.target.value })}
                                    placeholder="My Trading Bot"
                                    required
                                    style={{
                                        padding: '12px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        color: 'white',
                                        fontSize: '14px'
                                    }}
                                />
                            </div>

                            {/* Strategy */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)' }}>
                                    Strategy
                                </label>
                                <select
                                    value={newBot.strategy}
                                    onChange={(e) => setNewBot({ ...newBot, strategy: e.target.value })}
                                    style={{
                                        padding: '12px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        color: 'white',
                                        fontSize: '14px'
                                    }}
                                >
                                    <option value="ORB">Opening Range Breakout (ORB)</option>
                                    <option value="VWAP">VWAP Reversion</option>
                                    <option value="BBB">Bollinger Band Breakout</option>
                                    <option value="ThreeDucks">Three Ducks (Forex)</option>
                                    <option value="Grid">Grid Trading</option>
                                    <option value="Manual">Manual Trading</option>
                                </select>
                            </div>

                            {/* Max Position Size */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)' }}>
                                    Max Position Size ($)
                                </label>
                                <input
                                    type="number"
                                    value={newBot.maxPositionSize}
                                    onChange={(e) => setNewBot({ ...newBot, maxPositionSize: Number(e.target.value) })}
                                    min="100"
                                    required
                                    style={{
                                        padding: '12px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        color: 'white',
                                        fontSize: '14px'
                                    }}
                                />
                            </div>

                            {/* Max Open Positions */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)' }}>
                                    Max Open Positions
                                </label>
                                <input
                                    type="number"
                                    value={newBot.maxOpenPositions}
                                    onChange={(e) => setNewBot({ ...newBot, maxOpenPositions: Number(e.target.value) })}
                                    min="1"
                                    max="10"
                                    required
                                    style={{
                                        padding: '12px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        color: 'white',
                                        fontSize: '14px'
                                    }}
                                />
                            </div>

                            {/* Max Daily Loss */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)' }}>
                                    Max Daily Loss ($)
                                </label>
                                <input
                                    type="number"
                                    value={newBot.maxDailyLoss}
                                    onChange={(e) => setNewBot({ ...newBot, maxDailyLoss: Number(e.target.value) })}
                                    min="50"
                                    required
                                    style={{
                                        padding: '12px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        color: 'white',
                                        fontSize: '14px'
                                    }}
                                />
                            </div>

                            {/* Error */}
                            {createError && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '12px',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    color: '#ef4444'
                                }}>
                                    {createError}
                                </div>
                            )}

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        color: 'rgba(255, 255, 255, 0.8)',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: 'white',
                                        fontWeight: 600,
                                        cursor: creating ? 'not-allowed' : 'pointer',
                                        opacity: creating ? 0.6 : 1
                                    }}
                                >
                                    {creating ? 'Creating...' : 'Create Bot'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
