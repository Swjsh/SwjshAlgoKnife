"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Swords, Settings, LogOut, LayoutDashboard, Plus } from "lucide-react";
import styles from "./Sidebar.module.css";
import clsx from "clsx";
import { LogoIcon } from "../UI/LogoIcon";
import { useAuth } from "@/context/AuthContext";
import AgentSetupWizard from "../Agents/AgentSetupWizard";

const NAV_ITEMS = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
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
                        <a
                            key={item.href}
                            href={item.href}
                            className={clsx(styles.navLink, isActive && styles.active)}
                        >
                            <Icon size={20} className={styles.navIcon} />
                            <span className={styles.navLabel}>{item.label}</span>
                        </a>
                    );
                })}

                <div className={styles.deploySection}>
                    <button
                        className={styles.deployBtn}
                        onClick={() => setIsWizardOpen(true)}
                    >
                        <Plus size={18} />
                        <span>Deploy Agent</span>
                    </button>
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
