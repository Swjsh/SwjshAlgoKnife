
import { PriceUpdate } from './MarketData';

export interface Signal {
    type: 'ENTRY' | 'EXIT' | 'ZONE_FOUND';
    ticker: string;
    side: 'LONG' | 'SHORT';
    price?: number;
    reason: string;
    meta?: any;
}

interface Zone {
    id: string;
    ticker: string;
    type: 'SUPPLY' | 'DEMAND';
    entry: number;
    stop: number;
    created_at: number;
}

interface PricePoint {
    price: number;
    timestamp: number;
}

export class StrategyLoop {
    private activeZones: Zone[] = [];
    private lastPrice: Map<string, number> = new Map();

    // Rolling price history for impulse detection
    private priceHistory: Map<string, PricePoint[]> = new Map();

    // Configuration
    private readonly LOOKBACK_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
    private readonly FX_IMPULSE_PIPS = 15;  // 15 pips = significant move for FX
    private readonly CRYPTO_IMPULSE = 150;   // $150 for BTC
    private readonly ZONE_COOLDOWN_MS = 2 * 60 * 1000; // 2 min cooldown per ticker

    private lastZoneCreated: Map<string, number> = new Map();

    processTick(tick: PriceUpdate): Signal | null {
        // Update rolling history
        this.updatePriceHistory(tick);

        const prev = this.lastPrice.get(tick.ticker);
        this.lastPrice.set(tick.ticker, tick.price);

        // Debug logging every tick
        console.log(`📊 [TICK] ${tick.ticker}: ${tick.price.toFixed(tick.ticker === 'BTCUSD' ? 2 : 5)}`);

        // 1. Check for Fills on Existing Zones
        for (const zone of this.activeZones) {
            if (zone.ticker === tick.ticker) {
                if (zone.type === 'DEMAND' && tick.price <= zone.entry && tick.price > zone.stop) {
                    this.removeZone(zone.id);
                    return { type: 'ENTRY', side: 'LONG', ticker: tick.ticker, price: tick.price, reason: 'Demand Zone Hit', meta: { stop: zone.stop, zoneId: zone.id } };
                }
                if (zone.type === 'SUPPLY' && tick.price >= zone.entry && tick.price < zone.stop) {
                    this.removeZone(zone.id);
                    return { type: 'ENTRY', side: 'SHORT', ticker: tick.ticker, price: tick.price, reason: 'Supply Zone Hit', meta: { stop: zone.stop, zoneId: zone.id } };
                }
            }
        }

        // 2. Zone Creation: Rolling Window Impulse Detection
        const signal = this.detectImpulse(tick);
        if (signal) return signal;

        return null;
    }

    private updatePriceHistory(tick: PriceUpdate): void {
        let history = this.priceHistory.get(tick.ticker) || [];

        // Add new price point
        history.push({ price: tick.price, timestamp: tick.timestamp });

        // Remove old points outside lookback window
        const cutoff = Date.now() - this.LOOKBACK_WINDOW_MS;
        history = history.filter(p => p.timestamp > cutoff);

        this.priceHistory.set(tick.ticker, history);
    }

    private detectImpulse(tick: PriceUpdate): Signal | null {
        const history = this.priceHistory.get(tick.ticker);
        if (!history || history.length < 5) return null; // Need at least 5 data points

        // Check cooldown
        const lastZone = this.lastZoneCreated.get(tick.ticker) || 0;
        if (Date.now() - lastZone < this.ZONE_COOLDOWN_MS) return null;

        // Calculate range in window
        const prices = history.map(p => p.price);
        const windowLow = Math.min(...prices);
        const windowHigh = Math.max(...prices);
        const range = windowHigh - windowLow;

        // Threshold based on asset type
        const isFX = tick.ticker !== 'BTCUSD';
        const threshold = isFX ? this.FX_IMPULSE_PIPS * 0.0001 : this.CRYPTO_IMPULSE;

        if (range > threshold) {
            // Significant move detected in window!
            const currentPrice = tick.price;
            const midpoint = (windowHigh + windowLow) / 2;

            // Determine direction: if current price is above midpoint, impulse was UP (demand zone)
            const isImpulseUp = currentPrice > midpoint;
            const type = isImpulseUp ? 'DEMAND' : 'SUPPLY';
            const side = isImpulseUp ? 'LONG' : 'SHORT';

            // Zone entry at current price, stop beyond impulse extreme
            const zoneSize = isFX ? 0.0015 : 150; // 15 pips for FX, $150 for BTC
            const entry = currentPrice;
            const stop = type === 'DEMAND' ? windowLow - zoneSize * 0.5 : windowHigh + zoneSize * 0.5;

            const newZone: Zone = {
                id: `${tick.ticker}-${Date.now().toString(36)}`,
                ticker: tick.ticker,
                type,
                entry,
                stop,
                created_at: Date.now()
            };

            this.activeZones.push(newZone);
            this.lastZoneCreated.set(tick.ticker, Date.now());

            console.log(`🎯 [ZONE] ${type} zone created for ${tick.ticker} @ ${entry.toFixed(isFX ? 5 : 2)}`);
            console.log(`   Window: Low ${windowLow.toFixed(isFX ? 5 : 2)} | High ${windowHigh.toFixed(isFX ? 5 : 2)} | Range: ${(range * (isFX ? 10000 : 1)).toFixed(1)} ${isFX ? 'pips' : 'USD'}`);

            return {
                type: 'ZONE_FOUND',
                side,
                ticker: tick.ticker,
                price: entry,
                reason: `Impulse detected: ${(range * (isFX ? 10000 : 1)).toFixed(1)} ${isFX ? 'pips' : 'USD'} move in 5min window`,
                meta: newZone
            };
        }

        return null;
    }

    private removeZone(id: string) {
        this.activeZones = this.activeZones.filter(z => z.id !== id);
    }

    // Utility: Get current active zones (for UI/debugging)
    getActiveZones(): Zone[] {
        return [...this.activeZones];
    }
}
