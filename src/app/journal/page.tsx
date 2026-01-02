"use client";

import React, { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import TradeList from "@/components/Journal/TradeList";
import EntryForm from "@/components/Journal/EntryForm";
import AnalyticsHeader from "@/components/Journal/AnalyticsHeader";
import { Trade } from "@/types";

export default function JournalPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [trades, setTrades] = useState<Trade[]>([]);

    // Protect route
    useEffect(() => {
        if (!loading && !user) {
            router.replace('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0a0a12',
                color: 'rgba(255,255,255,0.5)'
            }}>
                <div>🔐 Verifying authentication...</div>
            </div>
        );
    }

    if (!user) return null;

    const handleSuccess = () => {
        setShowForm(false);
        setRefreshKey(prev => prev + 1);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight">TRADE JOURNAL</h2>
                    <p className="text-[var(--color-text-muted)] text-sm mt-1 uppercase tracking-widest">Performance Tracking & Strategy Refinement</p>
                </div>
                <button
                    className="flex items-center gap-2 bg-[hsl(var(--brand-primary))] text-black px-6 py-3 rounded-[var(--radius-md)] font-bold hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    onClick={() => setShowForm(true)}
                >
                    <Plus size={18} />
                    ADD ENTRY
                </button>
            </div>

            <AnalyticsHeader trades={trades} />

            <TradeList key={refreshKey} onDataLoad={setTrades} />

            {showForm && (
                <EntryForm
                    onClose={() => setShowForm(false)}
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    );
}

