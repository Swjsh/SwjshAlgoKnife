// ═══════════════════════════════════════════════════════════════
// FRICTION SIMULATOR - Reality Injector
// "Slippage, fees, and latency are not bugs. They are features."
// ═══════════════════════════════════════════════════════════════

export interface FrictionConfig {
    avgSlippagePips: number;      // e.g., 0.3
    maxSlippagePips: number;      // e.g., 2.0
    commissionPerLot: number;     // e.g., $7.00
    spreadPips: number;           // e.g., 1.2 for EUR/USD
    latencyMs: { min: number; max: number }; // e.g., { min: 50, max: 200 }
}

// Default friction - conservative real-world estimates
const DEFAULT_FRICTION: FrictionConfig = {
    avgSlippagePips: 0.3,
    maxSlippagePips: 2.0,
    commissionPerLot: 7.00,
    spreadPips: 1.2,
    latencyMs: { min: 50, max: 200 },
};

// Pip values per pair (for standard lot)
const PIP_VALUES: Record<string, number> = {
    'EURUSD': 10,
    'GBPUSD': 10,
    'USDJPY': 9.1,  // Approximate
    'AUDUSD': 10,
    'USDCAD': 7.5,  // Approximate
    'BTCUSD': 1,    // $1 per pip for crypto
};

export class FrictionSimulator {
    private static config: FrictionConfig = DEFAULT_FRICTION;

    static setConfig(config: Partial<FrictionConfig>) {
        this.config = { ...this.config, ...config };
    }

    /**
     * Apply realistic slippage to an ideal price.
     * Slippage always works AGAINST the trader.
     */
    static applySlippage(idealPrice: number, side: 'LONG' | 'SHORT', ticker: string = 'EURUSD'): number {
        // Random slippage between 0 and max
        const slippagePips = Math.random() * this.config.maxSlippagePips;

        // Convert pips to price
        const pipSize = ticker.includes('JPY') ? 0.01 : 0.0001;
        const slippagePrice = slippagePips * pipSize;

        // Long = price slips UP (worse entry), Short = price slips DOWN
        if (side === 'LONG') {
            return idealPrice + slippagePrice;
        } else {
            return idealPrice - slippagePrice;
        }
    }

    /**
     * Calculate net PnL after deducting all friction costs.
     */
    static calculateNetPnL(
        grossPnL: number,
        lotSize: number,
        ticker: string = 'EURUSD'
    ): number {
        const pipValue = PIP_VALUES[ticker] || 10;

        // Commission cost
        const commissionCost = this.config.commissionPerLot * lotSize;

        // Spread cost (paid on entry)
        const spreadCost = this.config.spreadPips * pipValue * lotSize;

        // Net = Gross - Commission - Spread
        const netPnL = grossPnL - commissionCost - spreadCost;

        return Math.round(netPnL * 100) / 100; // Round to cents
    }

    /**
     * Simulate realistic network/execution latency.
     * Call BEFORE executing any trade to simulate real-world delays.
     */
    static async simulateLatency(): Promise<number> {
        const { min, max } = this.config.latencyMs;
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;

        await new Promise(resolve => setTimeout(resolve, delay));

        return delay;
    }

    /**
     * Get friction report for logging.
     */
    static getFrictionReport(
        idealEntry: number,
        actualEntry: number,
        grossPnL: number,
        netPnL: number,
        lotSize: number
    ): string {
        const slippage = Math.abs(actualEntry - idealEntry);
        const totalFriction = grossPnL - netPnL;

        return `Slippage: ${(slippage * 10000).toFixed(1)} pips | ` +
            `Commission: $${(this.config.commissionPerLot * lotSize).toFixed(2)} | ` +
            `Total Friction: $${totalFriction.toFixed(2)}`;
    }
}
