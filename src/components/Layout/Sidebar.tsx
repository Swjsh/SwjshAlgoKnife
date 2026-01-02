"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Command, FileText, Swords, Settings, LogOut, FlaskConical, LayoutDashboard, Users, Plus } from "lucide-react";
import styles from "./Sidebar.module.css";
import clsx from "clsx";
import { motion } from "framer-motion";
import { LogoIcon } from "../UI/LogoIcon";
import { useAuth } from "@/context/AuthContext";
import AgentSetupWizard from "../Agents/AgentSetupWizard";

const NAV_ITEMS = [
    { label: "Command Center", href: "/agents", icon: LayoutDashboard },
    { label: "Break Room", href: "/breakroom", icon: Users },
    { label: "The Lab", href: "/lab", icon: FlaskConical },
    { label: "Mission Logs", href: "/logs", icon: FileText },
    { label: "Arsenal", href: "/strategies", icon: Swords },
    { label: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();
    const [isWizardOpen, setIsWizardOpen] = React.useState(false);

    const handleDeployAgent = async (agentData: any) => {
        const response = await fetch('/api/agents', {
            method: 'POST',
            body: JSON.stringify(agentData)
        });
        if (!response.ok) throw new Error('Failed to deploy');
        // Refresh or update context if needed
        router.refresh();
    };

    const handleSignOut = async () => {
        await logout();
        router.push('/login');
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.header}>
                <div className={styles.logoContainer}>
                    <LogoIcon size={38} className={styles.logo} />
                    <h1 className={styles.title}>
                        <span className={styles.nameSwjsh}>Swjsh</span>
                        <span className={styles.nameAK}>AK</span>
                    </h1>
                </div>
            </div>

            <nav className={styles.nav}>
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            style={{ textDecoration: 'none' }}
                        >
                            <motion.div
                                className={clsx(styles.navItem, isActive && styles.active)}
                                whileHover={{ x: 4 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                {/* Glowing Border Structure */}
                                <div className={styles.borderGradient} />
                                <div className={styles.innerBg} />

                                {/* Content Layer */}
                                <div className={styles.navContent}>
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeNav"
                                            className={styles.activeGlow}
                                            initial={false}
                                            transition={{
                                                type: "spring",
                                                stiffness: 380,
                                                damping: 30
                                            }}
                                        />
                                    )}
                                    <Icon size={22} className={styles.navIcon} />
                                    <span className={styles.navLabel}>{item.label}</span>
                                    {isActive && <div className={styles.activeDot} />}
                                </div>

                                <div className={styles.shimmer} />
                            </motion.div>
                        </Link>
                    );
                })}

                <div className={styles.deploySection}>
                    <motion.button
                        className={styles.deployBtn}
                        onClick={() => setIsWizardOpen(true)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <Plus size={18} />
                        <span>Deploy Agent</span>
                    </motion.button>
                </div>
            </nav>

            <div className={styles.footer}>
                <div className={styles.userProfile}>
                    <div className={styles.avatar}>{user?.email?.charAt(0).toUpperCase() || 'U'}</div>
                    <div className={styles.userInfo}>
                        <h4>{user?.email?.split('@')[0] || 'Commander'}</h4>
                        <p>Fleet Control</p>
                    </div>
                </div>
                <button onClick={handleSignOut} className={styles.signOutBtn} title="Sign Out">
                    <LogOut size={18} />
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
