'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
    User,
    Mail,
    Shield,
    Calendar,
    Check,
    X,
    AlertTriangle,
    Trash2
} from 'lucide-react';
import styles from './Profile.module.css';

export default function ProfilePage() {
    const router = useRouter();
    const { user, loading: authLoading, logout } = useAuth();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteInput, setDeleteInput] = useState('');

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/sign-in');
        }
    }, [user, authLoading, router]);

    const handleDeleteAccount = async () => {
        if (deleteInput !== 'DELETE') {
            alert('Please type DELETE to confirm');
            return;
        }

        if (!confirm('This action cannot be undone. All your data will be permanently deleted.')) {
            return;
        }

        try {
            // TODO: Implement account deletion API
            alert('Account deletion will be implemented soon. For now, please contact support.');
        } catch (error) {
            console.error('Failed to delete account:', error);
        }
    };

    const handleSendVerificationEmail = async () => {
        try {
            // Firebase send verification email
            alert('Verification email functionality coming soon');
        } catch (error) {
            console.error('Failed to send verification email:', error);
        }
    };

    if (authLoading) {
        return (
            <div className={styles.loading}>
                <User size={32} className={styles.spinner} />
                <p>Loading profile...</p>
            </div>
        );
    }

    if (!user) return null;

    const joinedDate = user.metadata.creationTime
        ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
          })
        : 'Unknown';

    const lastSignIn = user.metadata.lastSignInTime
        ? new Date(user.metadata.lastSignInTime).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: 'numeric'
          })
        : 'Unknown';

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <h1 className={styles.title}>Profile</h1>
                <p className={styles.subtitle}>Manage your account settings</p>
            </div>

            {/* Profile Card */}
            <div className={styles.profileCard}>
                <div className={styles.avatarSection}>
                    <div className={styles.avatarLarge}>
                        {user.photoURL ? (
                            <img src={user.photoURL} alt="Profile" className={styles.avatarImg} />
                        ) : (
                            <span className={styles.initials}>
                                {user.displayName
                                    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                                    : user.email?.[0].toUpperCase() || 'U'}
                            </span>
                        )}
                    </div>
                    <div className={styles.profileInfo}>
                        <h2 className={styles.displayName}>
                            {user.displayName || 'User'}
                        </h2>
                        <p className={styles.email}>{user.email}</p>
                        <div className={styles.verificationBadge}>
                            {user.emailVerified ? (
                                <>
                                    <Check size={14} className={styles.verified} />
                                    <span className={styles.verifiedText}>Email Verified</span>
                                </>
                            ) : (
                                <>
                                    <X size={14} className={styles.notVerified} />
                                    <span className={styles.notVerifiedText}>Email Not Verified</span>
                                    <button
                                        className={styles.verifyBtn}
                                        onClick={handleSendVerificationEmail}
                                    >
                                        Send Verification Email
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Account Details */}
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Account Details</h3>
                <div className={styles.detailsGrid}>
                    <div className={styles.detailItem}>
                        <div className={styles.detailIcon}>
                            <User size={18} />
                        </div>
                        <div className={styles.detailContent}>
                            <div className={styles.detailLabel}>User ID</div>
                            <div className={styles.detailValue}>{user.uid}</div>
                        </div>
                    </div>

                    <div className={styles.detailItem}>
                        <div className={styles.detailIcon}>
                            <Mail size={18} />
                        </div>
                        <div className={styles.detailContent}>
                            <div className={styles.detailLabel}>Email Address</div>
                            <div className={styles.detailValue}>{user.email}</div>
                        </div>
                    </div>

                    <div className={styles.detailItem}>
                        <div className={styles.detailIcon}>
                            <Calendar size={18} />
                        </div>
                        <div className={styles.detailContent}>
                            <div className={styles.detailLabel}>Member Since</div>
                            <div className={styles.detailValue}>{joinedDate}</div>
                        </div>
                    </div>

                    <div className={styles.detailItem}>
                        <div className={styles.detailIcon}>
                            <Shield size={18} />
                        </div>
                        <div className={styles.detailContent}>
                            <div className={styles.detailLabel}>Last Sign In</div>
                            <div className={styles.detailValue}>{lastSignIn}</div>
                        </div>
                    </div>

                    {user.providerData && user.providerData.length > 0 && (
                        <div className={styles.detailItem}>
                            <div className={styles.detailIcon}>
                                <Shield size={18} />
                            </div>
                            <div className={styles.detailContent}>
                                <div className={styles.detailLabel}>Sign-in Method</div>
                                <div className={styles.detailValue}>
                                    {user.providerData.map(p => p.providerId).join(', ').replace('google.com', 'Google').replace('password', 'Email/Password')}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Danger Zone */}
            <div className={styles.section}>
                <h3 className={`${styles.sectionTitle} ${styles.danger}`}>Danger Zone</h3>
                <div className={styles.dangerCard}>
                    <div className={styles.dangerContent}>
                        <div className={styles.dangerIcon}>
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <h4 className={styles.dangerTitle}>Delete Account</h4>
                            <p className={styles.dangerDescription}>
                                Permanently delete your account and all associated data. This action cannot be undone.
                            </p>
                        </div>
                    </div>
                    <button
                        className={styles.dangerBtn}
                        onClick={() => setShowDeleteConfirm(true)}
                    >
                        <Trash2 size={18} />
                        Delete Account
                    </button>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className={styles.modal} onClick={() => setShowDeleteConfirm(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalIcon}>
                            <AlertTriangle size={48} />
                        </div>
                        <h2 className={styles.modalTitle}>Delete Account?</h2>
                        <p className={styles.modalDescription}>
                            This will permanently delete your account and all associated data including:
                        </p>
                        <ul className={styles.deleteList}>
                            <li>All trading bots</li>
                            <li>Trade history</li>
                            <li>Journal entries</li>
                            <li>Broker connections</li>
                            <li>Account settings</li>
                        </ul>
                        <p className={styles.modalWarning}>
                            <strong>This action cannot be undone.</strong> Type <code>DELETE</code> to confirm.
                        </p>
                        <input
                            type="text"
                            className={styles.deleteInput}
                            value={deleteInput}
                            onChange={(e) => setDeleteInput(e.target.value)}
                            placeholder="Type DELETE to confirm"
                        />
                        <div className={styles.modalActions}>
                            <button
                                className={styles.cancelBtn}
                                onClick={() => {
                                    setShowDeleteConfirm(false);
                                    setDeleteInput('');
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.confirmDeleteBtn}
                                onClick={handleDeleteAccount}
                                disabled={deleteInput !== 'DELETE'}
                            >
                                Delete My Account
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
