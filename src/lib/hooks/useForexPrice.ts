"use client";

import { useState, useEffect } from 'react';

const FINNHUB_KEY = process.env.NEXT_PUBLIC_FINNHUB_KEY || 'your_free_key_here';

export function useForexPrice(symbol: string = 'OANDA:EUR_USD') {
    const [price, setPrice] = useState<string>('0.00000');
    const [change, setChange] = useState<string>('0.00%');

    useEffect(() => {
        if (!FINNHUB_KEY || FINNHUB_KEY === 'your_free_key_here') {
            console.warn("Finnhub Key not set. Forex live feed disabled.");
            return;
        }

        const socket = new WebSocket(`wss://ws.finnhub.io?token=${FINNHUB_KEY}`);

        socket.onopen = () => {
            socket.send(JSON.stringify({ 'type': 'subscribe', 'symbol': symbol }));
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'trade') {
                const lastTrade = data.data[0];
                setPrice(lastTrade.p.toFixed(5));
            }
        };

        socket.onerror = (error) => console.error("Finnhub Error:", error);

        return () => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ 'type': 'unsubscribe', 'symbol': symbol }));
                socket.close();
            }
        };
    }, [symbol]);

    return { price, change };
}
