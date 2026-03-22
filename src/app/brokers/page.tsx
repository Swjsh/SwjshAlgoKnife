'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
    Shield,
    Plus,
    Check,
    X,
    RefreshCw,
    Trash2,
    Eye,
    EyeOff,
    AlertCircle,
    ExternalLink
} from 'lucide-react';
import styles from './Brokers.module.css';

interface BrokerConfig {
    id: string;
    broker: string;
    environment: string;
    label: string;
    isPrimary: boolean;
    isActive: boolean;
    connectionStatus: 'PENDING' | 'CONNECTED' | 'FAILED' | 'REVOKED';
    lastVerifiedAt?: string;
    lastErrorMessage?: string;
    accountId?: string;
    accountType?: string;
    buyingPower?: number;
    createdAt: string;
}

export default function BrokersPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [brokers, setBrokers] = useState<BrokerConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [verifying, setVerifying] = useState<string | null>(null);

    // Add broker form
    const [newBroker, setNewBroker] = useState({
        broker: 'ALPACA',
        environment: 'PAPER',
        label: '',
        apiKey: '',
        apiSecret: '',
    });
    const [showApiSecret, setShowApiSecret] = useState(false);
    const [addError, setAddError] = useState('');

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/sign-in');
        }
    }, [user, authLoading, router]);

    const fetchBrokers = async () => {
        try {
            const res = await fetch('/api/brokers');
            if (res.ok) {
                const data = await res.json();
                setBrokers(data.brokers || []);
            }
        } catch (error) {
            console.error('Failed to fetch brokers:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchBrokers();
        }
    }, [user]);

    const handleAddBroker = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddError('');

        try {
            // Create broker
            const createRes = await fetch('/api/brokers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newBroker),
            });

            if (!createRes.ok) {
                const error = await createRes.json();
                throw new Error(error.error || 'Failed to add broker');
            }

            const { broker } = await createRes.json();

            // Verify connection
            setVerifying(broker.id);
            const verifyRes = await fetch(`/api/brokers/${broker.id}/verify`, {
                method: 'POST',
            });

            if (!verifyRes.ok) {
                const error = await verifyRes.json();

                // Delete the failed broker config
                await fetch(`/api/brokers/${broker.id}`, {
                    method: 'DELETE',
                });

                // Show detailed error
                let errorMsg = error.error || 'Verification failed';
                if (error.details) {
                    errorMsg += '. ' + error.details;
                }
                setAddError(errorMsg + ' Please check your credentials and try again.');
                setVerifying(null);
                return;
            }

            // Success
            setShowAddModal(false);
            setNewBroker({
                broker: 'ALPACA',
                environment: 'PAPER',
                label: '',
                apiKey: '',
                apiSecret: '',
            });
            setVerifying(null);
            fetchBrokers();
        } catch (error: any) {
            setAddError(error.message);
            setVerifying(null);
        }
    };

    const handleVerifyBroker = async (id: string) => {
        setVerifying(id);
        try {
            const res = await fetch(`/api/brokers/${id}/verify`, {
                method: 'POST',
            });

            if (!res.ok) {
                const error = await res.json();
                alert(error.error || error.details || 'Verification failed');
            }

            fetchBrokers();
        } catch (error) {
            console.error('Verification failed:', error);
        } finally {
            setVerifying(null);
        }
    };

    const handleDeleteBroker = async (id: string) => {
        if (!confirm('Are you sure you want to delete this broker connection?')) {
            return;
        }

        try {
            const res = await fetch(`/api/brokers/${id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                fetchBrokers();
            }
        } catch (error) {
            console.error('Failed to delete broker:', error);
        }
    };

    if (authLoading || loading) {
        return (
            <div className={styles.loading}>
                <Shield size={32} className={styles.spinner} />
                <p>Loading broker connections...</p>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Broker Connections</h1>
                    <p className={styles.subtitle}>
                        Manage your trading broker API connections
                    </p>
                </div>
                <button
                    className={styles.addBtn}
                    onClick={() => setShowAddModal(true)}
                >
                    <Plus size={18} />
                    Add Broker
                </button>
            </div>

            {/* Brokers List */}
            {brokers.length === 0 ? (
                <div className={styles.emptyState}>
                    <Shield size={64} className={styles.emptyIcon} />
                    <h2>No Brokers Connected</h2>
                    <p>Connect a broker to start trading</p>
                    <button
                        className={styles.addBtn}
                        onClick={() => setShowAddModal(true)}
                    >
                        <Plus size={18} />
                        Connect Your First Broker
                    </button>
                </div>
            ) : (
                <div className={styles.brokersGrid}>
                    {brokers.map(broker => (
                        <div key={broker.id} className={styles.brokerCard}>
                            {/* Header */}
                            <div className={styles.brokerHeader}>
                                <div className={styles.brokerInfo}>
                                    <div className={styles.brokerIcon}>
                                        {broker.broker === 'ALPACA' && '🦙'}
                                    </div>
                                    <div>
                                        <h3 className={styles.brokerName}>{broker.label}</h3>
                                        <p className={styles.brokerMeta}>
                                            {broker.broker} • {broker.environment}
                                        </p>
                                    </div>
                                </div>
                                <div className={`${styles.statusBadge} ${styles[broker.connectionStatus.toLowerCase()]}`}>
                                    {broker.connectionStatus === 'CONNECTED' && <Check size={12} />}
                                    {(broker.connectionStatus === 'FAILED' || broker.connectionStatus === 'REVOKED') && <X size={12} />}
                                    {broker.connectionStatus === 'PENDING' && <RefreshCw size={12} className={styles.spin} />}
                                    {broker.connectionStatus}
                                </div>
                            </div>

                            {/* Connection Details */}
                            {broker.connectionStatus === 'CONNECTED' && (
                                <div className={styles.connectionDetails}>
                                    {broker.accountId && (
                                        <div className={styles.detailRow}>
                                            <span className={styles.detailLabel}>Account ID</span>
                                            <span className={styles.detailValue}>{broker.accountId}</span>
                                        </div>
                                    )}
                                    {broker.accountType && (
                                        <div className={styles.detailRow}>
                                            <span className={styles.detailLabel}>Account Type</span>
                                            <span className={styles.detailValue}>{broker.accountType}</span>
                                        </div>
                                    )}
                                    {broker.buyingPower !== undefined && (
                                        <div className={styles.detailRow}>
                                            <span className={styles.detailLabel}>Buying Power</span>
                                            <span className={styles.detailValue}>
                                                ${broker.buyingPower.toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                    {broker.lastVerifiedAt && (
                                        <div className={styles.detailRow}>
                                            <span className={styles.detailLabel}>Last Verified</span>
                                            <span className={styles.detailValue}>
                                                {new Date(broker.lastVerifiedAt).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Error Message */}
                            {broker.lastErrorMessage && (
                                <div className={styles.errorMessage}>
                                    <AlertCircle size={14} />
                                    <span>{broker.lastErrorMessage}</span>
                                </div>
                            )}

                            {/* Primary Badge */}
                            {broker.isPrimary && (
                                <div className={styles.primaryBadge}>
                                    Primary Broker
                                </div>
                            )}

                            {/* Actions */}
                            <div className={styles.brokerActions}>
                                {broker.connectionStatus === 'FAILED' ? (
                                    <>
                                        <button
                                            className={`${styles.actionBtn} ${styles.start}`}
                                            onClick={() => handleVerifyBroker(broker.id)}
                                            disabled={verifying === broker.id}
                                        >
                                            <RefreshCw size={16} className={verifying === broker.id ? styles.spin : ''} />
                                            {verifying === broker.id ? 'Retrying...' : 'Retry Connection'}
                                        </button>
                                        <button
                                            className={`${styles.actionBtn} ${styles.danger}`}
                                            onClick={() => handleDeleteBroker(broker.id)}
                                        >
                                            <Trash2 size={16} />
                                            Delete & Retry
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => handleVerifyBroker(broker.id)}
                                            disabled={verifying === broker.id}
                                        >
                                            <RefreshCw size={16} className={verifying === broker.id ? styles.spin : ''} />
                                            {verifying === broker.id ? 'Verifying...' : 'Test Connection'}
                                        </button>
                                        <button
                                            className={`${styles.actionBtn} ${styles.danger}`}
                                            onClick={() => handleDeleteBroker(broker.id)}
                                        >
                                            <Trash2 size={16} />
                                            Remove
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Broker Modal */}
            {showAddModal && (
                <div className={styles.modal} onClick={() => setShowAddModal(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <h2>Connect Broker</h2>
                        <p className={styles.modalSubtitle}>
                            Add your broker API credentials to enable trading
                        </p>

                        <form onSubmit={handleAddBroker} className={styles.form}>
                            {/* Broker Selection */}
                            <div className={styles.formGroup}>
                                <label>Broker</label>
                                <select
                                    value={newBroker.broker}
                                    onChange={(e) => setNewBroker({ ...newBroker, broker: e.target.value })}
                                    className={styles.select}
                                >
                                    <option value="ALPACA">Alpaca</option>
                                    <option value="WEBULL" disabled>Webull (Coming Soon)</option>
                                    <option value="ROBINHOOD" disabled>Robinhood (Coming Soon)</option>
                                </select>
                            </div>

                            {/* Environment */}
                            <div className={styles.formGroup}>
                                <label>Environment</label>
                                <div className={styles.envToggle}>
                                    <button
                                        type="button"
                                        className={newBroker.environment === 'PAPER' ? styles.active : ''}
                                        onClick={() => setNewBroker({ ...newBroker, environment: 'PAPER' })}
                                    >
                                        Paper Trading
                                    </button>
                                    <button
                                        type="button"
                                        className={newBroker.environment === 'LIVE' ? styles.active : ''}
                                        onClick={() => setNewBroker({ ...newBroker, environment: 'LIVE' })}
                                    >
                                        Live Trading
                                    </button>
                                </div>
                            </div>

                            {/* Label */}
                            <div className={styles.formGroup}>
                                <label>Label</label>
                                <input
                                    type="text"
                                    value={newBroker.label}
                                    onChange={(e) => setNewBroker({ ...newBroker, label: e.target.value })}
                                    placeholder="My Alpaca Paper Account"
                                    className={styles.input}
                                    required
                                />
                            </div>

                            {/* API Key */}
                            <div className={styles.formGroup}>
                                <label>API Key</label>
                                <input
                                    type="text"
                                    value={newBroker.apiKey}
                                    onChange={(e) => setNewBroker({ ...newBroker, apiKey: e.target.value })}
                                    placeholder="PK..."
                                    className={styles.input}
                                    required
                                />
                            </div>

                            {/* API Secret */}
                            <div className={styles.formGroup}>
                                <label>API Secret</label>
                                <div className={styles.passwordInput}>
                                    <input
                                        type={showApiSecret ? 'text' : 'password'}
                                        value={newBroker.apiSecret}
                                        onChange={(e) => setNewBroker({ ...newBroker, apiSecret: e.target.value })}
                                        placeholder="••••••••••••••••"
                                        className={styles.input}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowApiSecret(!showApiSecret)}
                                        className={styles.eyeBtn}
                                    >
                                        {showApiSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Help Link */}
                            <a
                                href="https://alpaca.markets/docs/api-references/trading-api/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.helpLink}
                            >
                                <ExternalLink size={14} />
                                How to get Alpaca API keys
                            </a>

                            {/* Error */}
                            {addError && (
                                <div className={styles.formError}>
                                    <AlertCircle size={16} />
                                    {addError}
                                </div>
                            )}

                            {/* Actions */}
                            <div className={styles.formActions}>
                                <button
                                    type="button"
                                    className={styles.cancelBtn}
                                    onClick={() => setShowAddModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={styles.submitBtn}
                                    disabled={verifying !== null}
                                >
                                    {verifying ? 'Verifying...' : 'Connect Broker'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
