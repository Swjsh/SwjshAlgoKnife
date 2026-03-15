"use client";

import React, { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
    Bot, Monitor, TrendingUp,
    Brain, Swords, BookOpen,
    Wallet, Plug, Coffee, Settings,
    Plus, LogOut,
    Activity, FlaskConical, Layers, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./Sidebar.module.css";
import { LogoIcon } from "../UI/LogoIcon";
import { useAuth } from "@/context/AuthContext";
import AgentSetupWizard from "../Agents/AgentSetupWizard";

interface SubItem {
    label: string;
    href: string;
    icon: React.ElementType;
    desc: string;
}

interface NavGroup {
    id: string;
    label: string;
    icon: React.ElementType;
    color: string;
    items: SubItem[];
}

// All nav items live in flyout groups
const NAV_GROUPS: NavGroup[] = [
    {
        id: 'operations',
        label: 'Ops',
        icon: Activity,
        color: '#a855f7',
        items: [
            { label: 'Command Center', href: '/command-center', icon: Monitor,         desc: 'Fleet overview & control'  },
            { label: 'Agents',         href: '/agents',         icon: Bot,             desc: 'Autonomous trading fleet'  },
            { label: 'Trades',         href: '/trades',         icon: TrendingUp,      desc: 'Positions & execution'     },
            { label: 'Coffee Room',    href: '/coffeeroom',     icon: Coffee,          desc: 'Agent lounge'              },
        ],
    },
    {
        id: 'research',
        label: 'Research',
        icon: FlaskConical,
        color: '#06b6d4',
        items: [
            { label: 'Intel',    href: '/intel',      icon: Brain,    desc: 'Market intelligence' },
            { label: 'Arsenal',  href: '/strategies', icon: Swords,   desc: 'Strategy library'    },
            { label: 'Journal',  href: '/journal',    icon: BookOpen, desc: 'Trade review log'    },
        ],
    },
    {
        id: 'system',
        label: 'System',
        icon: Layers,
        color: '#64748b',
        items: [
            { label: 'Accounts',     href: '/accounts',     icon: Wallet,   desc: 'Balances & funding'   },
            { label: 'Connections',  href: '/connections',  icon: Plug,     desc: 'Broker integrations'  },
            { label: 'Settings',     href: '/settings',     icon: Settings, desc: 'Preferences & config' },
        ],
    },
];

export default function Sidebar() {
    const pathname  = usePathname();
    const router    = useRouter();
    const { user, logout } = useAuth();

    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [openGroup, setOpenGroup]        = useState<string | null>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleDeployAgent = async (agentData: any) => {
        await fetch('/api/agents', { method: 'POST', body: JSON.stringify(agentData) });
        router.refresh();
    };

    const handleSignOut = async () => {
        await logout();
        router.push('/login');
    };

    // Hover helpers with a small delay to avoid flicker
    const handleGroupEnter = (id: string) => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        setOpenGroup(id);
    };
    const handleGroupLeave = () => {
        closeTimer.current = setTimeout(() => setOpenGroup(null), 120);
    };
    const handleFlyoutEnter = () => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
    };

    // Active group: any sub-item's href matches current path
    const activeGroupId = NAV_GROUPS.find(g =>
        g.items.some(item =>
            pathname === item.href || pathname.startsWith(item.href + '/')
        )
    )?.id ?? null;

    return (
        <aside className={styles.sidebar}>
            {/* ── Logo ── */}
            <div className={styles.header}>
                <Link href="/command-center" className={styles.logoContainer}>
                    <LogoIcon size={34} className={styles.logo} />
                    <h1 className={styles.title}>
                        <span className={styles.nameSwjsh}>Swjsh</span>
                        <span className={styles.nameAK}>AK</span>
                    </h1>
                </Link>
            </div>

            {/* ── Nav ── */}
            <nav className={styles.nav}>

                {/* Grouped nav items with flyouts */}
                {NAV_GROUPS.map((group) => {
                    const GroupIcon = group.icon;
                    const isGroupActive = group.id === activeGroupId;
                    const isOpen = openGroup === group.id;

                    return (
                        <div
                            key={group.id}
                            className={styles.groupWrapper}
                            onMouseEnter={() => handleGroupEnter(group.id)}
                            onMouseLeave={handleGroupLeave}
                        >
                            {/* Group trigger button */}
                            <button
                                className={`${styles.groupBtn} ${isGroupActive ? styles.groupBtnActive : ''} ${isOpen ? styles.groupBtnOpen : ''}`}
                                style={isGroupActive || isOpen
                                    ? { '--group-color': group.color } as React.CSSProperties
                                    : undefined
                                }
                            >
                                <GroupIcon
                                    size={18}
                                    className={styles.groupIcon}
                                    style={isGroupActive || isOpen ? { color: group.color } : undefined}
                                />
                                <span className={styles.groupLabel}>{group.label}</span>
                                <ChevronRight
                                    size={13}
                                    className={`${styles.groupChevron} ${isOpen ? styles.groupChevronOpen : ''}`}
                                />
                            </button>

                            {/* Flyout panel */}
                            <AnimatePresence>
                                {isOpen && (
                                    <motion.div
                                        className={styles.flyout}
                                        onMouseEnter={handleFlyoutEnter}
                                        onMouseLeave={handleGroupLeave}
                                        initial={{ opacity: 0, x: -8, scale: 0.97 }}
                                        animate={{ opacity: 1, x: 0,  scale: 1    }}
                                        exit={{    opacity: 0, x: -8, scale: 0.97 }}
                                        transition={{ duration: 0.18, ease: 'easeOut' }}
                                    >
                                        <div className={styles.flyoutHeader}>
                                            <span style={{ color: group.color }}>{group.label.toUpperCase()}</span>
                                        </div>
                                        {group.items.map((item) => {
                                            const ItemIcon = item.icon;
                                            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    className={`${styles.flyoutItem} ${isActive ? styles.flyoutItemActive : ''}`}
                                                    onClick={() => setOpenGroup(null)}
                                                >
                                                    <div
                                                        className={styles.flyoutItemIconBox}
                                                        style={isActive ? { background: group.color + '22', color: group.color } : undefined}
                                                    >
                                                        <ItemIcon size={15} />
                                                    </div>
                                                    <div className={styles.flyoutItemText}>
                                                        <span className={styles.flyoutItemLabel}>{item.label}</span>
                                                        <span className={styles.flyoutItemDesc}>{item.desc}</span>
                                                    </div>
                                                    {isActive && (
                                                        <div
                                                            className={styles.flyoutItemDot}
                                                            style={{ background: group.color }}
                                                        />
                                                    )}
                                                </Link>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}

                {/* Spacer pushes deploy button to bottom of nav */}
                <div style={{ flex: 1 }} />

                {/* Create Bot */}
                <div className={styles.deploySection}>
                    <button className={styles.deployBtn} onClick={() => setIsWizardOpen(true)}>
                        <Plus size={16} />
                        <span>Create Bot</span>
                    </button>
                </div>
            </nav>

            {/* ── Footer ── */}
            <div className={styles.footer}>
                <div className={styles.userProfile}>
                    <div className={styles.avatar}>
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className={styles.userInfo}>
                        <h4>{user?.email?.split('@')[0] || 'Commander'}</h4>
                        <p>Fleet Control</p>
                    </div>
                </div>
                <button onClick={handleSignOut} className={styles.signOutBtn} title="Sign Out">
                    <LogOut size={16} />
                </button>
            </div>

            <AgentSetupWizard
                isOpen={isWizardOpen}
                onClose={() => setIsWizardOpen(false)}
                onDeploy={handleDeployAgent}
            />
        </aside>
    );
}
