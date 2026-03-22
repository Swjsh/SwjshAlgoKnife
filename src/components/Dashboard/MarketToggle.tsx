"use client";

import React, { useState, useRef, useEffect } from 'react';
import styles from './MarketToggle.module.css';
import { Bitcoin, DollarSign, TrendingUp, BarChart3, ChevronDown } from 'lucide-react';

export type MarketType = 'crypto' | 'forex' | 'options' | 'futures';

interface MarketToggleProps {
    selected: MarketType;
    onChange: (market: MarketType) => void;
}

const markets: { type: MarketType; label: string; icon: React.ReactNode }[] = [
    { type: 'crypto', label: 'Crypto', icon: <Bitcoin size={18} /> },
    { type: 'forex', label: 'Forex', icon: <DollarSign size={18} /> },
    { type: 'options', label: 'Options', icon: <TrendingUp size={18} /> },
    { type: 'futures', label: 'Futures', icon: <BarChart3 size={18} /> },
];

export default function MarketToggle({ selected, onChange }: MarketToggleProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedMarket = markets.find(m => m.type === selected) || markets[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (type: MarketType) => {
        onChange(type);
        setIsOpen(false);
    };

    return (
        <div className={styles.wrapper} ref={containerRef}>
            <div className={styles.label}>MARKET</div>
            <div className={styles.dropdownContainer}>
                <button
                    className={`${styles.trigger} ${isOpen ? styles.open : ''}`}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <span className={styles.iconWrapper}>
                        {selectedMarket.icon}
                    </span>
                    <span className={styles.selectedLabel}>{selectedMarket.label.toUpperCase()}</span>
                    <ChevronDown size={14} className={`${styles.chevron} ${isOpen ? styles.chevronRotate : ''}`} />
                </button>

                {isOpen && (
                    <div className={styles.menu}>
                        {markets.map((market) => (
                            <button
                                key={market.type}
                                className={`${styles.option} ${selected === market.type ? styles.selectedOption : ''}`}
                                onClick={() => handleSelect(market.type)}
                            >
                                <span className={styles.optionIcon}>{market.icon}</span>
                                {market.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
