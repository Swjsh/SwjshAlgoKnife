'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Power, RefreshCw } from 'lucide-react';
import styles from './KillSwitchButton.module.css';

interface KillSwitchButtonProps {
    className?: string;
}

export default function KillSwitchButton({ className }: KillSwitchButtonProps) {
    const [isActive, setIsActive] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [actionType, setActionType] = useState<'trigger' | 'reset'>('trigger');

    // Check KillSwitch status on mount
    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const res = await fetch('/api/killswitch');
            if (res.ok) {
                const data = await res.json();
                setIsActive(data.isGlobalHaltActive || false);
            }
        } catch (error) {
            console.error('Failed to check KillSwitch status:', error);
        }
    };

    const handleAction = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/killswitch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: actionType,
                    agentId: 'global',
                    reason: actionType === 'trigger'
                        ? 'Emergency halt triggered by user'
                        : 'System reset by user'
                })
            });

            if (res.ok) {
                const data = await res.json();
                setIsActive(data.isActive);
                setShowConfirm(false);
            } else {
                console.error('KillSwitch action failed');
            }
        } catch (error) {
            console.error('KillSwitch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const openConfirmDialog = (type: 'trigger' | 'reset') => {
        setActionType(type);
        setShowConfirm(true);
    };

    return (
        <>
            <button
                className={`${styles.killSwitchBtn} ${isActive ? styles.active : ''} ${className || ''}`}
                onClick={() => openConfirmDialog(isActive ? 'reset' : 'trigger')}
                disabled={loading}
                title={isActive ? 'Reset KillSwitch' : 'Emergency KillSwitch'}
            >
                {loading ? (
                    <RefreshCw size={18} className={styles.spinning} />
                ) : isActive ? (
                    <Power size={18} />
                ) : (
                    <AlertTriangle size={18} />
                )}
                <span>{isActive ? 'HALTED' : 'KILL SWITCH'}</span>
            </button>

            {showConfirm && (
                <div className={styles.confirmOverlay} onClick={() => setShowConfirm(false)}>
                    <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.confirmIcon}>
                            {actionType === 'trigger' ? (
                                <AlertTriangle size={48} color="#ef4444" />
                            ) : (
                                <Power size={48} color="#10b981" />
                            )}
                        </div>
                        <h3 className={styles.confirmTitle}>
                            {actionType === 'trigger' ? 'Emergency Halt' : 'Reset System'}
                        </h3>
                        <p className={styles.confirmMessage}>
                            {actionType === 'trigger'
                                ? 'This will immediately halt ALL trading agents. All pending orders will be cancelled and no new trades will be executed until reset.'
                                : 'This will reset the emergency halt and allow agents to resume trading operations.'}
                        </p>
                        <div className={styles.confirmActions}>
                            <button
                                className={styles.confirmCancel}
                                onClick={() => setShowConfirm(false)}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                className={`${styles.confirmBtn} ${actionType === 'trigger' ? styles.danger : styles.success}`}
                                onClick={handleAction}
                                disabled={loading}
                            >
                                {loading ? 'Processing...' : actionType === 'trigger' ? 'HALT ALL AGENTS' : 'RESET SYSTEM'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
