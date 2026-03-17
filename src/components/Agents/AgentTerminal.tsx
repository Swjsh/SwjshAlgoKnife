"use client";

import React, { useState, useEffect, useRef } from 'react';
import styles from './AgentTerminal.module.css';
import { Terminal, Cpu, Crosshair, TrendingUp, AlertCircle } from 'lucide-react';

interface LogMessage {
    id: string;
    timestamp: string;
    level: 'INFO' | 'WARN' | 'SUCCESS' | 'ERROR' | 'ACTION';
    text: string;
}

export default function AgentTerminal() {
    const [logs, setLogs] = useState<LogMessage[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Initial greeting
    useEffect(() => {
        addLog('INFO', 'Initializing Swjsh Agent Interface v2.1.0...');
        setTimeout(() => addLog('SUCCESS', 'Connection established. Neural Engine ACTIVE.'), 800);
        setTimeout(() => addLog('INFO', 'Scanning active markets [EURUSD, GBPUSD, XAUUSD]...'), 1600);
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    // Simulate Agent "Thoughts"
    useEffect(() => {
        const thoughts = [
            { level: 'INFO', text: 'Analyzing M15 structure on EURUSD...' },
            { level: 'WARN', text: 'Potential supply zone detected at 1.0850. Watching reactions.' },
            { level: 'INFO', text: 'Volume profile indicates accumulation. Staying patient.' },
            { level: 'ACTION', text: 'Order filled! LONG GBPUSD @ 1.2640. Stop: 1.2610.' },
            { level: 'SUCCESS', text: 'Take Profit hit on XAUUSD! +1.5R secured.' },
            { level: 'INFO', text: 'Re-calibrating risk parameters for next session.' },
            { level: 'INFO', text: 'No high-probability setups found. Entering standby mode.' },
            { level: 'ACTION', text: 'Trailing stop moved to breakeven on active trade.' },
        ];

        const interval = setInterval(() => {
            const randomThought = thoughts[Math.floor(Math.random() * thoughts.length)];
            // 30% chance to add a log every 3-8 seconds
            if (Math.random() > 0.7) {
                addLog(randomThought.level as any, randomThought.text);
            }
        }, 4000);

        return () => clearInterval(interval);
    }, []);

    const addLog = (level: 'INFO' | 'WARN' | 'SUCCESS' | 'ERROR' | 'ACTION', text: string) => {
        const newLog: LogMessage = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
            level,
            text
        };
        setLogs(prev => [...prev.slice(-20), newLog]); // Keep last 20 logs
    };

    const getIcon = (level: string) => {
        switch (level) {
            case 'ACTION': return '⚡';
            case 'SUCCESS': return '✅';
            case 'WARN': return '⚠️';
            default: return '>';
        }
    };

    // Helper to highlight keywords
    const formatMessage = (text: string) => {
        const keywords = [
            { word: 'LONG', color: '#4ade80' },
            { word: 'SHORT', color: '#f472b6' },
            { word: 'BUY', color: '#4ade80' },
            { word: 'SELL', color: '#f472b6' },
            { word: 'WIN', color: '#4ade80' },
            { word: 'LOSS', color: '#f87171' },
            { word: 'PROFIT', color: '#4ade80' },
            { word: 'EURUSD', color: '#60a5fa' },
            { word: 'GBPUSD', color: '#60a5fa' },
            { word: 'XAUUSD', color: '#fbbf24' },
            { word: 'BTCUSD', color: '#fbbf24' },
            { word: 'ACTIVE', color: '#4ade80' },
            { word: 'PENDING', color: '#facc15' },
        ];

        const parts = text.split(' ');

        return parts.map((part, i) => {
            // strip punctuation for matching
            const cleanPart = part.replace(/[.,!?:;]/g, '');
            const match = keywords.find(k => k.word === cleanPart);

            if (match) {
                return (
                    <span key={i} style={{ color: match.color, fontWeight: 'bold' }}>
                        {part}{' '}
                    </span>
                );
            }
            return part + ' ';
        });
    };

    return (
        <div className={styles.terminalWindow}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <Cpu size={18} className={styles.cpuIcon} />
                    <span className={styles.title}>SWJSH_NEURAL_INTERFACE</span>
                </div>
                <div className={styles.status}>
                    <span className={styles.dot}></span>
                    LIVE MONITORING
                </div>
            </div>
            <div className={styles.content} ref={scrollRef}>
                {logs.map((log) => (
                    <div key={log.id} className={`${styles.logLine} ${styles[log.level.toLowerCase()]}`}>
                        <span className={styles.timestamp}>{log.timestamp}</span>
                        <span className={styles.icon}>{getIcon(log.level)}</span>
                        <span className={styles.message}>{formatMessage(log.text)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
