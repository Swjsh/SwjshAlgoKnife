"use client";

import { useState, useEffect } from "react";
import { db as cloudDb } from "@/lib/firebase";
import { ref, onValue, off } from "firebase/database";
import { Trade } from "@/types";

const CLOUD_SYNC_ENABLED = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

export function useFirebaseSync(localTrades: Trade[], setLocalTrades: (trades: Trade[]) => void) {
    useEffect(() => {
        if (!CLOUD_SYNC_ENABLED || !cloudDb) return;

        console.log("[Firebase] Syncing cloud trades to local UI...");
        const tradesRef = ref(cloudDb, 'trades');

        const unsubscribe = onValue(tradesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // Convert Firebase object to array and sort by date desc
                const tradeList: Trade[] = Object.values(data);
                tradeList.sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
                setLocalTrades(tradeList);
            }
        });

        return () => off(tradesRef, 'value', unsubscribe);
    }, [setLocalTrades]);
}
