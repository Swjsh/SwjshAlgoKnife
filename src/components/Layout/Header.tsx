"use client";

import React from "react";
import { Bell, Coffee } from "lucide-react";
import { usePathname } from "next/navigation";
import { useStrategy } from "@/context/StrategyContext";
import StrategyMenu from "@/components/Header/StrategyMenu";
import styles from "./Header.module.css";

// Standard Ticker Data
const TICKER_ITEMS_STANDARD = [
    { symbol: "BTC", price: "97,420", change: "+2.4%", up: true },
    { symbol: "ETH", price: "2,840", change: "+1.1%", up: true },
    { symbol: "SPX", price: "5,820", change: "-0.2%", up: false },
    { symbol: "EURUSD", price: "1.0840", change: "+0.05%", up: true },
    { symbol: "NVDA", price: "142.50", change: "+3.2%", up: true },
    // Duplicate for scroll
    { symbol: "BTC", price: "97,420", change: "+2.4%", up: true },
    { symbol: "ETH", price: "2,840", change: "+1.1%", up: true },
    { symbol: "SPX", price: "5,820", change: "-0.2%", up: false },
    { symbol: "EURUSD", price: "1.0840", change: "+0.05%", up: true },
    { symbol: "NVDA", price: "142.50", change: "+3.2%", up: true },
];

// Coffee-themed Ticker Data for light mode
const TICKER_ITEMS_COFFEE = [
    { symbol: "ESPRESSO", price: "5,820", change: "-0.7%", up: false },
    { symbol: "LATTE/USDT", price: "1.0840", change: "+0.05%", up: true },
    { symbol: "MOCHA", price: "142.5", change: "", up: true },
    { symbol: "ARABICA", price: "2,840", change: "+1.1%", up: true },
    { symbol: "ROBUSTA", price: "97,420", change: "+2.4%", up: true },
    // Duplicate for scroll
    { symbol: "ESPRESSO", price: "5,820", change: "-0.7%", up: false },
    { symbol: "LATTE/USDT", price: "1.0840", change: "+0.05%", up: true },
    { symbol: "MOCHA", price: "142.5", change: "", up: true },
    { symbol: "ARABICA", price: "2,840", change: "+1.1%", up: true },
    { symbol: "ROBUSTA", price: "97,420", change: "+2.4%", up: true },
];

export default function Header() {
    const pathname = usePathname();
    const { theme } = useStrategy();

    // Use coffee-themed tickers in nature/light mode
    const isCoffeeMode = theme === 'nature';
    const tickerItems = isCoffeeMode ? TICKER_ITEMS_COFFEE : TICKER_ITEMS_STANDARD;

    // Generate breadcrumbs from path
    const getBreadcrumbs = () => {
        const paths = pathname.split('/').filter(p => p);
        if (paths.length === 0) return <span className={styles.crumbActive}>DASHBOARD</span>;

        return (
            <>
                <span className={styles.crumbDivider}>/</span>
                <span className={styles.crumbActive}>
                    {paths[paths.length - 1].toUpperCase()}
                </span>
            </>
        );
    };

    return (
        <header className={styles.header}>
            {/* Strategy Selection & Breadcrumbs */}
            <div className={styles.leftSection}>
                <StrategyMenu />
                <div className={styles.breadcrumbs}>
                    {/* Visual Divider is handled in CSS now to be cleaner */}
                    {getBreadcrumbs()}
                </div>
            </div>

            {/* Compact Ticker */}
            <div className={styles.tickerContainer}>
                <div className={styles.tickerTrack}>
                    {tickerItems.map((item, i) => (
                        <div key={i} className={styles.tickerItem}>
                            <span className={styles.tickerSymbol}>{item.symbol}</span>
                            <span className={styles.tickerPrice}>{item.price}</span>
                            {item.change && (
                                <span className={item.up ? styles.tickerChangePositive : styles.tickerChangeNegative}>
                                    {item.change}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className={styles.actions}>
                <div className={`${styles.statusPill} ${isCoffeeMode ? styles.statusCoffee : ''}`}>
                    {isCoffeeMode ? (
                        <>
                            <Coffee size={12} strokeWidth={3} />
                            <span>BREWING</span>
                        </>
                    ) : (
                        <>
                            <div className={styles.pulseDot} />
                            <span>SYSTEM ONLINE</span>
                        </>
                    )}
                </div>
                <button className={styles.iconBtn}>
                    <Bell size={18} />
                    {/* Optional: Add badge logic here if needed, removing static '3' for cleaner look unless real */}
                </button>
            </div>
        </header>
    );
}
