'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import styles from "@/app/layout.module.css";

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Pages that DON'T have the sidebar/header
    const isAuthPage = pathname === '/login';
    const isLandingPage = pathname === '/';
    const noNav = isAuthPage || isLandingPage;

    if (noNav) {
        return <>{children}</>;
    }

    return (
        <div className={styles.container}>
            <Sidebar />
            <div className={styles.mainWrapper}>
                <Header />
                <main className={styles.content}>
                    {children}
                </main>
            </div>
        </div>
    );
}
