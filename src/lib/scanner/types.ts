export interface Asset {
    symbol: string;
    price: number;
    volume: number;
    avgVolume: number;
    dailyReturn: number;
    high: number;
    low: number;
    open: number;
    resistance?: number;
    support?: number;
    consolidationPeriod?: number;
}

export interface ScanCriteria {
    volumeMultiple?: number;
    minPriceMove?: number;
    minConsolidationDays?: number;
    requireResistanceBreak?: boolean;
    customFilter?: (asset: Asset) => boolean;
}

export interface ScanResult {
    ticker: string;
    setup: string;
    confidence: 'LOW' | 'MEDIUM' | 'HIGH';
    timestamp: string;
    price: number;
    volume: number;
    metrics: {
        volumeRatio: number;
        priceMove: number;
        consolidationDays?: number;
        resistanceLevel?: number;
    };
    optionPlay?: OptionRecommendation;
}

export interface OptionRecommendation {
    suggestedStrike: number;
    expiry: string;
    estimatedPremium: number;
    maxRisk: number;
    targetReturn: number;
}

export interface ScaleOutPlan {
    entry: number;
    contracts: number;
    exits: Array<{
        at: string;
        sellPercent: number;
        reasoning: string;
    }>;
}

export abstract class ScanStrategy {
    abstract name: string;
    abstract scan(asset: Asset): ScanResult | null;

    protected calculateConfidence(metrics: any): 'LOW' | 'MEDIUM' | 'HIGH' {
        // Simple confidence scoring based on how many criteria met
        let score = 0;
        if (metrics.volumeRatio > 2.5) score++;
        if (metrics.priceMove > 0.03) score++;
        if (metrics.consolidationDays && metrics.consolidationDays >= 7) score++;

        if (score >= 3) return 'HIGH';
        if (score >= 2) return 'MEDIUM';
        return 'LOW';
    }
}
