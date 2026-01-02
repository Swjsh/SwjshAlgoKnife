"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { EngineManager } from '@/lib/engine/manager';
import { Signal } from '@/lib/engine/types';

export type Theme = 'standard' | 'nature';

interface StrategyContextType {
    lastSignal: Signal | null;
    isRunning: boolean;
    setIsRunning: (val: boolean) => void;
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
    agents: any | null;
}

const StrategyContext = createContext<StrategyContextType | undefined>(undefined);

export function StrategyProvider({ children }: { children: React.ReactNode }) {
    const [lastSignal, setLastSignal] = useState<Signal | null>(null);
    const [isRunning, setIsRunning] = useState(true);
    const [theme, setTheme] = useState<Theme>('standard');
    const [agents, setAgents] = useState<any | null>(null);
    const engineRef = useRef<EngineManager | null>(null);

    // Initial theme sync
    useEffect(() => {
        const savedTheme = document.body.getAttribute('data-theme') as Theme;
        if (savedTheme) setTheme(savedTheme);
    }, []);

    // Theme persistence
    useEffect(() => {
        document.body.setAttribute('data-theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'standard' ? 'nature' : 'standard');
    };

    // Agent Data Fetching
    useEffect(() => {
        const fetchAgents = async () => {
            try {
                const res = await fetch('/api/agents');
                if (res.ok) {
                    const data = await res.json();
                    setAgents(data);
                }
            } catch (err) {
                console.error("Failed to fetch agents in context", err);
            }
        };

        fetchAgents();
        const interval = setInterval(fetchAgents, 5000); // 5s updates for real-feel
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!engineRef.current) {
            engineRef.current = new EngineManager((signal) => {
                setLastSignal(signal);
                fetch('/api/webhook/tradingview', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        symbol: signal.symbol,
                        action: signal.action,
                        price: signal.price,
                        strategy: signal.strategy
                    })
                });
            });
            engineRef.current.start();
        }
    }, []);

    return (
        <StrategyContext.Provider value={{
            lastSignal,
            isRunning,
            setIsRunning,
            theme,
            setTheme,
            toggleTheme,
            agents
        }}>
            {children}
        </StrategyContext.Provider>
    );
}

export function useStrategy() {
    const context = useContext(StrategyContext);
    if (context === undefined) {
        throw new Error('useStrategy must be used within a StrategyProvider');
    }
    return context;
}
