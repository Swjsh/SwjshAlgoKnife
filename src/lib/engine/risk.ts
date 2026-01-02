export interface RiskParams {
    accountBalance: number;
    riskPerTradePercent: number; // e.g., 1 for 1%
}

export class RiskManager {
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
        return Number(size.toFixed(8)); // Crypto precision
    }

    /**
     * Fallback for when no SL is provided - using a fixed % of balance
     */
    static calculateFixedSize(
        params: RiskParams,
        entryPrice: number,
        leverage: number = 1
    ): number {
        const amountToDeploy = params.accountBalance * (params.riskPerTradePercent / 100) * leverage;
        const size = amountToDeploy / entryPrice;
        return Number(size.toFixed(8));
    }
}
