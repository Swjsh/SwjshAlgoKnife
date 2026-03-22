'use client';

import React, { useState, useEffect } from 'react';
import { Check, X, CheckCheck, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import styles from './PermissionQueue.module.css';
import type { PermissionRequest } from '@/hooks/useActivityFeed';

interface PermissionQueueProps {
    permissions: PermissionRequest[];
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
    onApproveAll: () => void;
}

// Trusted tools that can be auto-approved
const TRUSTED_TOOLS = [
    'Read',
    'Glob',
    'Grep',
    'WebSearch',
    'WebFetch',
];

function formatTimeAgo(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const seconds = Math.floor(diff / 1000);

    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
}

function truncateParams(params: Record<string, unknown>, maxLength = 100): string {
    const str = JSON.stringify(params, null, 0);
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength) + '...';
}

export function PermissionQueue({
    permissions,
    onApprove,
    onReject,
    onApproveAll,
}: PermissionQueueProps) {
    const [autoApprove, setAutoApprove] = useState<boolean>(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Auto-approve trusted tools
    useEffect(() => {
        if (!autoApprove) return;

        permissions.forEach((perm) => {
            if (TRUSTED_TOOLS.includes(perm.toolName)) {
                onApprove(perm.id);
            }
        });
    }, [permissions, autoApprove, onApprove]);

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <Shield size={16} className={styles.headerIcon} />
                    <span className={styles.title}>Permission Queue</span>
                    {permissions.length > 0 && (
                        <span className={styles.badge}>{permissions.length}</span>
                    )}
                </div>

                {/* Auto-approve Toggle */}
                <label className={styles.autoApproveToggle}>
                    <input
                        type="checkbox"
                        checked={autoApprove}
                        onChange={(e) => setAutoApprove(e.target.checked)}
                        className={styles.checkbox}
                    />
                    <span className={styles.toggleLabel}>Auto-approve trusted</span>
                </label>
            </div>

            {/* Queue Content */}
            <div className={styles.content}>
                {permissions.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Shield size={32} className={styles.emptyIcon} />
                        <span className={styles.emptyText}>No pending permissions</span>
                        <span className={styles.emptySubtext}>All clear</span>
                    </div>
                ) : (
                    <>
                        {/* Approve All Button */}
                        <button
                            className={styles.approveAllBtn}
                            onClick={onApproveAll}
                            title="Approve all pending permissions"
                        >
                            <CheckCheck size={14} />
                            <span>Approve All ({permissions.length})</span>
                        </button>

                        {/* Permission Cards */}
                        <div className={styles.cards}>
                            {permissions.map((perm) => (
                                <div
                                    key={perm.id}
                                    className={`${styles.card} ${perm.isNew ? styles.cardNew : ''}`}
                                >
                                    {/* Card Header */}
                                    <div className={styles.cardHeader}>
                                        <div className={styles.agentInfo}>
                                            <span className={styles.agentEmoji}>{perm.agentEmoji}</span>
                                            <span className={styles.agentName}>{perm.agentName}</span>
                                        </div>
                                        <span className={styles.timestamp}>{formatTimeAgo(perm.timestamp)}</span>
                                    </div>

                                    {/* Tool Info */}
                                    <div className={styles.toolInfo}>
                                        <span className={styles.toolName}>{perm.toolName}</span>
                                        {TRUSTED_TOOLS.includes(perm.toolName) && (
                                            <span className={styles.trustedBadge}>Trusted</span>
                                        )}
                                    </div>

                                    {/* Params Preview */}
                                    <div
                                        className={styles.paramsPreview}
                                        onClick={() => toggleExpand(perm.id)}
                                    >
                                        <code className={styles.paramsCode}>
                                            {expandedId === perm.id
                                                ? JSON.stringify(perm.params, null, 2)
                                                : truncateParams(perm.params)}
                                        </code>
                                        {Object.keys(perm.params).length > 0 && (
                                            <span className={styles.expandIcon}>
                                                {expandedId === perm.id ? (
                                                    <ChevronUp size={14} />
                                                ) : (
                                                    <ChevronDown size={14} />
                                                )}
                                            </span>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className={styles.actions}>
                                        <button
                                            className={`${styles.actionBtn} ${styles.approveBtn}`}
                                            onClick={() => onApprove(perm.id)}
                                            title="Approve (Press 1)"
                                        >
                                            <Check size={14} />
                                            <span>Approve</span>
                                        </button>
                                        <button
                                            className={`${styles.actionBtn} ${styles.rejectBtn}`}
                                            onClick={() => onReject(perm.id)}
                                            title="Reject (Press 2)"
                                        >
                                            <X size={14} />
                                            <span>Reject</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Keyboard Shortcuts Hint */}
            <div className={styles.shortcuts}>
                <span className={styles.shortcutKey}>1</span> Approve
                <span className={styles.shortcutKey}>2</span> Reject
                <span className={styles.shortcutKey}>A</span> All
            </div>
        </div>
    );
}

export default PermissionQueue;
