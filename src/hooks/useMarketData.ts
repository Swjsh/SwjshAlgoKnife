import { useState, useEffect, useRef } from 'react';
import { CandlestickData, UTCTimestamp, SeriesMarker } from 'lightweight-charts';

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

interface UseMarketDataParams {
    symbol: string;
    initialPrice?: number;
    timeframe: Timeframe;
}

// Deterministic Pseudo-Random Number Generator (Linear Congruential Generator)
// This ensures that for a specific seed (symbol + index), we always get the same candle structure.
// This prevents the "dancing chart" on refresh.
class SeededRNG {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    // Returns float between 0 and 1
    next(): number {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    // Standard Normal Distribution (Box-Muller transform)
    nextGaussian(): number {
        let u = 0, v = 0;
        while (u === 0) u = this.next(); // Converting [0,1) to (0,1)
        while (v === 0) v = this.next();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }
}

const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '4h': 14400,
    '1d': 86400
};

export function useMarketData({ symbol, initialPrice = 50000, timeframe }: UseMarketDataParams) {
    const [data, setData] = useState<CandlestickData[]>([]);
    const [currentPrice, setCurrentPrice] = useState(initialPrice);
    const [liveCandle, setLiveCandle] = useState<CandlestickData | null>(null);
    const [markers, setMarkers] = useState<SeriesMarker<UTCTimestamp>[]>([]);

    // We use a ref to track the last "live" time to prevent duplicates during strict mode
    const lastTickRef = useRef<number>(0);

    // 1. Generate Historical Data (Deterministic)
    useEffect(() => {
        // Create a unique numeric seed from the symbol string
        const seedValue = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const rng = new SeededRNG(seedValue);

        const step = TIMEFRAME_SECONDS[timeframe];
        const now = Math.floor(Date.now() / 1000);
        // Align end time to the nearest step to make it clean
        const endTime = now - (now % step);

        const history: CandlestickData[] = [];
        let price = initialPrice;

        // Generate 200 candles backwards
        // We generate backwards but prepend to array so it's sorted by time
        const tempHistory: CandlestickData[] = [];
        const tempMarkers: SeriesMarker<UTCTimestamp>[] = [];

        // Volatility depends on timeframe
        const volatility = initialPrice * (step / 86400) * 2; // Rough daily vol scaling

        for (let i = 0; i < 200; i++) {
            // Generate standard movement
            const move = rng.nextGaussian() * volatility;
            const close = price;
            const open = price - move; // Reversing the move since we go backwards

            // Generate High/Low logic
            const high = Math.max(open, close) + (rng.next() * volatility * 0.5);
            const low = Math.min(open, close) - (rng.next() * volatility * 0.5);

            tempHistory.unshift({
                time: (endTime - (i * step)) as UTCTimestamp,
                open,
                high,
                low,
                close
            });

            // Randomly add historical trades
            if (rng.next() > 0.95) { // 5% chance of trade per bar
                const isBuy = rng.next() > 0.5;
                const time = (endTime - (i * step)) as UTCTimestamp;
                tempMarkers.unshift({
                    time,
                    position: isBuy ? 'belowBar' : 'aboveBar',
                    color: isBuy ? '#10b981' : '#ef4444',
                    shape: isBuy ? 'arrowUp' : 'arrowDown',
                    text: isBuy ? 'BUY' : 'SELL',
                });
            }

            price = open; // The open of this candle is the close of the PREVIOUS one
        }

        // Fix the trend direction (since we generated backwards, price flow might feel weird)
        // We actually want the *last* generated candle to match initialPrice
        // So we just take the generated shape and bias it
        const finalGeneratedPrice = tempHistory[tempHistory.length - 1].close;
        const bias = initialPrice - finalGeneratedPrice;

        const adjustedHistory = tempHistory.map(candle => ({
            ...candle,
            open: candle.open + bias,
            high: candle.high + bias,
            low: candle.low + bias,
            close: candle.close + bias
        }));

        setData(adjustedHistory);
        setMarkers(tempMarkers);
        setCurrentPrice(initialPrice);
        setLiveCandle(adjustedHistory[adjustedHistory.length - 1]);

    }, [symbol, timeframe, initialPrice]);

    // 2. Simulate Live Ticks
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            if (now - lastTickRef.current < 200) return; // Cap at 5 ticks/sec
            lastTickRef.current = now;

            const step = TIMEFRAME_SECONDS[timeframe];
            const nowSeconds = Math.floor(now / 1000);
            const candleTime = (nowSeconds - (nowSeconds % step)) as UTCTimestamp;

            setCurrentPrice(prev => {
                const volatility = prev * 0.0002; // Very small tick moves
                const change = (Math.random() - 0.5) * volatility;
                const newPrice = prev + change;

                setLiveCandle(prevCandle => {
                    if (!prevCandle) return null;

                    // If simple time rollover (new candle)
                    if (candleTime !== prevCandle.time) {
                        // New Candle - Check for trade entry on open
                        // 20% chance to trade on new candle open for demo purposes to make it obvious
                        if (Math.random() > 0.8) {
                            const isBuy = Math.random() > 0.5;
                            setMarkers(current => [...current, {
                                time: candleTime,
                                position: isBuy ? 'belowBar' : 'aboveBar',
                                color: isBuy ? '#10b981' : '#ef4444',
                                shape: isBuy ? 'arrowUp' : 'arrowDown',
                                text: isBuy ? 'ENTER' : 'SHORT',
                            }]);
                        }

                        return {
                            time: candleTime,
                            open: newPrice,
                            high: newPrice,
                            low: newPrice,
                            close: newPrice
                        };
                    }

                    // Update existing candle
                    return {
                        ...prevCandle,
                        high: Math.max(prevCandle.high, newPrice),
                        low: Math.min(prevCandle.low, newPrice),
                        close: newPrice,
                        // Persist open and time
                        open: prevCandle.open,
                        time: prevCandle.time
                    };
                });

                return newPrice;
            });

        }, 1000); // 1 tick per second for simulation

        return () => clearInterval(interval);
    }, [timeframe]); // Re-run if timeframe changes to adjust step logic

    return {
        data,
        currentPrice,
        liveCandle,
        markers
    };
}
