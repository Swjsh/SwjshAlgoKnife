export interface RiskParams {
    accountBalance: number;
    riskPerTradePercent: number; // e.g., 1 for 1%
    // Multi-tenant context (optional for backward compatibility)
    userId?: string;
    botId?: string;
}

export class RiskManager {
    /**
     * Calculate position size based on entry, stop loss, and risk tolerance.
     * Works for any asset class.
     */
    static calculatePositionSize(
        params: RiskParams,
        entryPrice: number,
        stopLossPrice: number
    ): number {
        if (entryPrice === stopLossPrice) return 0;

        const amountToRisk = params.accountBalance * (params.riskPerTradePercent / 100);
        const riskPerUnit = Math.abs(entryPrice - stopLossPrice);

        if (riskPerUnit === 0) return 0;

        const size = amountToRisk / riskPerUnit;
        return Number(size.toFixed(8));
    }

    /**
     * Fallback sizing when no stop loss is provided.
     * Uses asset-class-aware defaults.
     * 
     * For FX: assumes 50 pip stop, calculates micro lots
     * For Crypto: uses fixed % of balance / price
     * For Stocks/Futures: uses fixed % of balance / price
     */
    static calculateFixedSize(
        params: RiskParams,
        entryPrice: number,
        leverage: number = 1
    ): number {
        const amountToRisk = params.accountBalance * (params.riskPerTradePercent / 100) * leverage;

        // Detect FX pairs (price typically between 0.5 and 200)
        if (entryPrice > 0.5 && entryPrice < 200) {
            // FX: assume 50 pip default stop loss
            // pip value for standard lot = $10 for most pairs
            // For JPY pairs (price > 100), pip = 0.01; otherwise pip = 0.0001
            const isJPY = entryPrice > 50;
            const pipSize = isJPY ? 0.01 : 0.0001;
            const defaultStopPips = 50;
            const riskPerUnit = defaultStopPips * pipSize;

            // Size in units (1 standard lot = 100,000 units)
            const units = amountToRisk / riskPerUnit;
            // Convert to lots (micro lots = 0.01)
            const lots = units / 100000;
            return Number(Math.max(lots, 0.01).toFixed(2)); // minimum 0.01 lot (micro)
        }

        // Crypto / Stocks / Futures: simple division
        const size = amountToRisk / entryPrice;
        return Number(size.toFixed(8));
    }
}
