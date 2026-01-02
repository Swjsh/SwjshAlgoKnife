"use client";

import { useState, useEffect } from 'react';

export function useCryptoPrice(symbol: string = 'btcusdt') {
    const [price, setPrice] = useState<string>('0.00');
    const [change, setChange] = useState<string>('0.00%');
    const [volume, setVolume] = useState<string>('0.00');

    useEffect(() => {
        console.log(`Connecting to Binance.us WebSocket for ${symbol}...`);
        // Trying binance.us for US-based connectivity
        const ws = new WebSocket(`wss://stream.binance.us:9443/ws/${symbol}@ticker`);

        ws.onopen = () => {
            console.log(`Binance WebSocket connected for ${symbol}`);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // c: last price, p: price change, P: price change percent, v: total traded base asset volume
                if (data.c) {
                    setPrice(parseFloat(data.c).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                    setChange(`${parseFloat(data.P) >= 0 ? '+' : ''}${parseFloat(data.P).toFixed(2)}%`);
                    setVolume(parseFloat(data.v).toLocaleString(undefined, { maximumFractionDigits: 0 }));
                }
            } catch (err) {
                console.error("Error parsing Binance WebSocket message:", err);
            }
        };

        ws.onerror = (error) => {
            console.error(`Binance WebSocket error for ${symbol}:`, error);
        };

        ws.onclose = (event) => {
            console.log(`Binance WebSocket closed for ${symbol}. Code: ${event.code}, Reason: ${event.reason}`);
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }
        };
    }, [symbol]);

    return { price, change, volume };
}
