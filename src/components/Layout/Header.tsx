"use client";

import React, { useEffect, useState, useRef } from "react";
import { Bell, CheckCircle2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import UserMenu from "./UserMenu";
import styles from "./Header.module.css";

interface Notification {
    id: string;
    type: 'trade' | 'agent' | 'signal' | 'alert';
    title: string;
    message: string;
    time: string;
    read: boolean;
    color: string;
}

const TICKER_CONFIG = [
    { key: 'BTC',  label: 'BTC'  },
    { key: 'ETH',  label: 'ETH'  },
    { key: 'SOL',  label: 'SOL'  },
    { key: 'SPY',  label: 'SPY'  },
    { key: 'NVDA', label: 'NVDA' },
    { key: 'QQQ',  label: 'QQQ'  },
    { key: 'XRP',  label: 'XRP'  },
];

function formatPrice(price: number, key: string): string {
    if (key === 'BTC') return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (['ETH', 'SOL', 'SPY', 'QQQ', 'NVDA'].includes(key))
        return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

type SessionType = 'open' | 'prepost' | 'closed';
function getMarketSession(date: Date): { label: string; type: SessionType } {
    const et = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day   = et.getDay();
    const total = et.getHours() * 60 + et.getMinutes();
    if (day === 0 || day === 6) return { label: 'WEEKEND',   type: 'closed'  };
    if (total >= 240 && total < 570)  return { label: 'PRE-MKT',   type: 'prepost' };
    if (total >= 570 && total < 960)  return { label: 'MKT OPEN',  type: 'open'    };
    if (total >= 960 && total < 1200) return { label: 'AFTER-HRS', type: 'prepost' };
    return { label: 'CLOSED', type: 'closed' };
}

export default function Header() {
    const pathname = usePathname();
    const { user } = useAuth();

    const [prices,     setPrices]  = useState<Record<string, number>>({});
    const [prevPrices, setPrev]    = useState<Record<string, number>>({});
    const [basePrices, setBase]    = useState<Record<string, number>>({});
    const [flashKeys,  setFlash]   = useState<Set<string>>(new Set());
    const [now,        setNow]     = useState<Date | null>(null);

    // Notification state
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const notificationPanelRef = useRef<HTMLDivElement>(null);
    const notificationBtnRef = useRef<HTMLButtonElement>(null);

    const prevRef = useRef<Record<string, number>>({});
    const baseRef = useRef<Record<string, number>>({});

    // 1-second ET clock - only runs on client after mount
    useEffect(() => {
        setNow(new Date()); // Set initial time on client
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // Price polling — 30s
    useEffect(() => {
        let alive = true;
        const load = async () => {
            try {
                const r = await fetch('/api/prices');
                if (!r.ok) return;
                const raw = await r.json();
                const next: Record<string, number> = {};
                for (const [k, v] of Object.entries(raw)) {
                    if (typeof v === 'number') next[k] = v;
                }
                if (alive && Object.keys(next).length > 0) {
                    if (Object.keys(baseRef.current).length === 0) {
                        baseRef.current = { ...next };
                        setBase({ ...next });
                    }
                    const changed = new Set<string>();
                    for (const k of Object.keys(next)) {
                        if (prevRef.current[k] !== undefined && prevRef.current[k] !== next[k]) {
                            changed.add(k);
                        }
                    }
                    if (changed.size > 0) {
                        setFlash(changed);
                        setTimeout(() => setFlash(new Set()), 700);
                    }
                    setPrev({ ...prevRef.current });
                    prevRef.current = next;
                    setPrices(next);
                }
            } catch { /* network hiccup */ }
        };
        load();
        const t = setInterval(load, 30_000);
        return () => { alive = false; clearInterval(t); };
    }, []);

    // Fetch notifications — 30s
    useEffect(() => {
        let alive = true;
        const fetchNotifications = async () => {
            try {
                const now = new Date();
                const newNotifications: Notification[] = [];

                // Fetch agent status
                try {
                    const agentRes = await fetch('/api/agents');
                    if (agentRes.ok) {
                        const agents = await agentRes.json();
                        for (const agent of agents) {
                            if (agent.status === 'ACTIVE') {
                                const existingId = `agent-${agent.id}-active`;
                                const exists = notifications.some(n => n.id === existingId);
                                if (!exists) {
                                    newNotifications.push({
                                        id: existingId,
                                        type: 'agent',
                                        title: `${agent.name || 'Agent'} Active`,
                                        message: 'Trading agent is now running',
                                        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
                                        read: false,
                                        color: '#22c55e', // green
                                    });
                                }
                            } else if (agent.status === 'OFFLINE') {
                                const existingId = `agent-${agent.id}-offline`;
                                const exists = notifications.some(n => n.id === existingId);
                                if (!exists) {
                                    newNotifications.push({
                                        id: existingId,
                                        type: 'agent',
                                        title: `${agent.name || 'Agent'} Offline`,
                                        message: 'Trading agent went offline',
                                        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
                                        read: false,
                                        color: '#ef4444', // red
                                    });
                                }
                            }
                        }
                    }
                } catch { /* API error */ }

                // Fetch recent signals
                try {
                    const signalRes = await fetch('/api/signals?limit=5');
                    if (signalRes.ok) {
                        const signals = await signalRes.json();
                        for (const signal of signals) {
                            const existingId = `signal-${signal.id}`;
                            const exists = notifications.some(n => n.id === existingId);
                            if (!exists) {
                                newNotifications.push({
                                    id: existingId,
                                    type: 'signal',
                                    title: `New Signal: ${signal.symbol || 'Market'}`,
                                    message: `${signal.action || 'Action'} signal received`,
                                    time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
                                    read: false,
                                    color: '#06b6d4', // cyan
                                });
                            }
                        }
                    }
                } catch { /* API error */ }

                // Add new notifications to the beginning
                if (alive && newNotifications.length > 0) {
                    setNotifications(prev => [...newNotifications, ...prev].slice(0, 20)); // Keep max 20
                }
            } catch { /* fetch error */ }
        };

        fetchNotifications();
        const t = setInterval(fetchNotifications, 30_000);
        return () => { alive = false; clearInterval(t); };
    }, []);

    // Close notification panel on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                notificationPanelRef.current &&
                notificationBtnRef.current &&
                !notificationPanelRef.current.contains(event.target as Node) &&
                !notificationBtnRef.current.contains(event.target as Node)
            ) {
                setShowNotifications(false);
            }
        }

        if (showNotifications) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showNotifications]);

    const getBreadcrumb = () => {
        const paths = pathname.split('/').filter(p => p);
        if (paths.length === 0) return 'DASHBOARD';
        return paths[paths.length - 1].replace(/-/g, ' ').toUpperCase();
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    const handleMarkAllRead = () => {
        setNotifications(prev =>
            prev.map(n => ({ ...n, read: true }))
        );
    };

    const handleNotificationClick = (id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
    };

    const hasPrices = Object.keys(prices).length > 0;
    const tickerItems = [...TICKER_CONFIG, ...TICKER_CONFIG]
        .filter(t => prices[t.key] !== undefined)
        .map(t => {
            const price = prices[t.key];
            const base  = basePrices[t.key];
            const prev  = prevPrices[t.key];
            const pct   = base && base !== 0 ? ((price - base) / base) * 100 : null;
            const up    = prev !== undefined && price > prev;
            const down  = prev !== undefined && price < prev;
            const flash = flashKeys.has(t.key);
            return { symbol: t.label, price, pct, up, down, flash, key: t.key };
        });

    const session = now ? getMarketSession(now) : { label: '—', type: 'closed' as SessionType };
    const etTime  = now
        ? now.toLocaleTimeString('en-US', {
            timeZone: 'America/New_York',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false,
        })
        : '--:--:--';

    return (
        <header className={styles.header}>

            {/* ── Left: breadcrumb ── */}
            <div className={styles.leftSection}>
                <div className={styles.breadcrumbs}>
                    <span className={styles.crumbDivider}>/</span>
                    <span className={styles.crumbActive}>{getBreadcrumb()}</span>
                </div>
            </div>

            {/* ── Center: live price ticker ── */}
            <div className={styles.tickerContainer}>
                <div className={styles.tickerTrack}>
                    {hasPrices
                        ? tickerItems.map((item, i) => (
                            <div key={i} className={`${styles.tickerItem} ${item.flash ? styles.tickerFlash : ''}`}>
                                <span className={styles.tickerSymbol}>{item.symbol}</span>
                                <span className={`${styles.tickerPrice}${item.up ? ' ' + styles.priceUp : item.down ? ' ' + styles.priceDown : ''}`}>
                                    {formatPrice(item.price, item.key)}
                                </span>
                                {item.pct !== null && (
                                    <span className={item.pct >= 0 ? styles.changePct : styles.changePctNeg}>
                                        {item.pct >= 0 ? '▲' : '▼'}{Math.abs(item.pct).toFixed(2)}%
                                    </span>
                                )}
                            </div>
                        ))
                        : ['BTC','ETH','SOL','SPY','NVDA','QQQ','BTC','ETH','SOL','SPY','NVDA','QQQ'].map((sym, i) => (
                            <div key={i} className={styles.tickerItem}>
                                <span className={styles.tickerSymbol}>{sym}</span>
                                <span className={styles.tickerSkeleton}>——</span>
                            </div>
                        ))
                    }
                </div>
            </div>

            {/* ── Right: session clock · bell · user ── */}
            <div className={styles.actions}>
                <div className={`${styles.sessionPill} ${styles[`session_${session.type}`]}`}>
                    <div className={`${styles.sessionDot} ${session.type === 'open' ? styles.sessionDotPulse : ''}`} />
                    <span className={styles.sessionLabel}>{session.label}</span>
                    <span className={styles.sessionDivider}>|</span>
                    <span className={styles.sessionTime}>{etTime} ET</span>
                </div>

                <div className={styles.notificationContainer}>
                    <button
                        ref={notificationBtnRef}
                        className={styles.iconBtn}
                        title="Notifications"
                        onClick={() => setShowNotifications(!showNotifications)}
                    >
                        <Bell size={16} />
                        {unreadCount > 0 && (
                            <span className={styles.notificationBadge}>
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {showNotifications && (
                        <div
                            ref={notificationPanelRef}
                            className={styles.notificationPanel}
                        >
                            <div className={styles.notificationHeader}>
                                <h3 className={styles.notificationTitle}>Notifications</h3>
                                {unreadCount > 0 && (
                                    <button
                                        className={styles.markAllRead}
                                        onClick={handleMarkAllRead}
                                    >
                                        Mark all read
                                    </button>
                                )}
                            </div>

                            {notifications.length === 0 ? (
                                <div className={styles.notificationEmpty}>
                                    <Bell size={20} />
                                    <span>No notifications yet</span>
                                </div>
                            ) : (
                                <div className={styles.notificationList}>
                                    {notifications.map(notification => (
                                        <div
                                            key={notification.id}
                                            className={`${styles.notificationItem} ${!notification.read ? styles.notificationUnread : ''}`}
                                            onClick={() => handleNotificationClick(notification.id)}
                                        >
                                            <div
                                                className={styles.notificationDot}
                                                style={{ backgroundColor: notification.color }}
                                            />
                                            <div className={styles.notificationContent}>
                                                <div className={styles.notificationItemTitle}>
                                                    {notification.title}
                                                </div>
                                                <div className={styles.notificationItemMessage}>
                                                    {notification.message}
                                                </div>
                                                <div className={styles.notificationItemTime}>
                                                    {notification.time}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {user && <UserMenu />}
            </div>
        </header>
    );
}
