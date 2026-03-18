'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
    User,
    Settings,
    LogOut,
    Bot,
    Wallet,
    ChevronDown,
    Shield
} from 'lucide-react';
import styles from './UserMenu.module.css';

export default function UserMenu() {
    const router = useRouter();
    const { user, isGuest, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const handleLogout = async () => {
        await logout();
        router.push('/sign-in');
    };

    const navigate = (path: string) => {
        setIsOpen(false);
        router.push(path);
    };

    // Get display name
    const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';
    const initials = displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    if (!user) return null;

    return (
        <div className={styles.container} ref={menuRef}>
            <button
                className={styles.trigger}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="User menu"
            >
                <div className={styles.avatar}>
                    {user.photoURL ? (
                        <img src={user.photoURL} alt={displayName} className={styles.avatarImg} />
                    ) : (
                        <span className={styles.initials}>{initials}</span>
                    )}
                </div>
                <span className={styles.name}>{displayName}</span>
                <ChevronDown
                    size={16}
                    className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
                />
            </button>

            {isOpen && (
                <div className={styles.dropdown}>
                    {/* User Info */}
                    <div className={styles.userInfo}>
                        <div className={styles.avatar}>
                            {user.photoURL ? (
                                <img src={user.photoURL} alt={displayName} className={styles.avatarImg} />
                            ) : (
                                <span className={styles.initials}>{initials}</span>
                            )}
                        </div>
                        <div className={styles.userDetails}>
                            <div className={styles.userName}>{displayName}</div>
                            <div className={styles.userEmail}>{user.email}</div>
                            {isGuest && (
                                <div className={styles.guestBadge}>
                                    Guest Mode
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.divider} />

                    {/* Menu Items */}
                    <div className={styles.menuItems}>
                        <button
                            className={styles.menuItem}
                            onClick={() => navigate('/profile')}
                        >
                            <User size={18} />
                            <span>Profile</span>
                        </button>

                        <button
                            className={styles.menuItem}
                            onClick={() => navigate('/bots')}
                        >
                            <Bot size={18} />
                            <span>My Bots</span>
                        </button>

                        <button
                            className={styles.menuItem}
                            onClick={() => navigate('/brokers')}
                        >
                            <Shield size={18} />
                            <span>Brokers</span>
                        </button>

                        <button
                            className={styles.menuItem}
                            onClick={() => navigate('/accounts')}
                        >
                            <Wallet size={18} />
                            <span>Accounts</span>
                        </button>

                        <button
                            className={styles.menuItem}
                            onClick={() => navigate('/settings')}
                        >
                            <Settings size={18} />
                            <span>Settings</span>
                        </button>
                    </div>

                    <div className={styles.divider} />

                    {/* Logout */}
                    <button
                        className={`${styles.menuItem} ${styles.logout}`}
                        onClick={handleLogout}
                    >
                        <LogOut size={18} />
                        <span>Sign Out</span>
                    </button>
                </div>
            )}
        </div>
    );
}
