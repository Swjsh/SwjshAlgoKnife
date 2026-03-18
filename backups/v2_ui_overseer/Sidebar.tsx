"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Command, FileText, Swords, Settings } from "lucide-react";
import styles from "./Sidebar.module.css";
import clsx from "clsx";
import { LogoIcon } from "../UI/LogoIcon";

const NAV_ITEMS = [
    { label: "Command", href: "/", icon: Command },
    { label: "Mission Logs", href: "/logs", icon: FileText },
    { label: "Arsenal", href: "/strategies", icon: Swords },
    { label: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
    const pathname = usePathname();

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
                            className={clsx(styles.navItem, isActive && styles.active)}
                        >
                            <Icon size={22} />
                            <span>{item.label}</span>
                            {isActive && <div className={styles.activeDot} />}
                        </Link>
                    );
                })}
            </nav>

            <div className={styles.footer}>
                <div className={styles.userProfile}>
                    <div className={styles.avatar}>CMD</div>
                    <div className={styles.userInfo}>
                        <h4>Commander</h4>
                        <p>Fleet Control</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
