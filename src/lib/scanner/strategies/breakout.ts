import { ScanStrategy, Asset, ScanResult } from '../types';

export class BreakoutScanner extends ScanStrategy {
    name = 'Breakout Scanner';

    scan(asset: Asset): ScanResult | null {
        // Core breakout criteria (Reddit-Silver style)
        const volumeRatio = asset.volume / asset.avgVolume;
        const priceMove = asset.dailyReturn;
        const consolidationDays = asset.consolidationPeriod || 0;
        const aboveResistance = asset.resistance ? asset.price > asset.resistance : false;

        // PRIMARY FILTERS
        const hasVolumeExpansion = volumeRatio >= 2.5;
        const hasSignificantMove = priceMove >= 0.03; // 3%+
        const hadConsolidation = consolidationDays >= 7;
        const brokeResistance = aboveResistance;

        // Must meet at least 3 of 4 criteria
        const criteriasMet = [
            hasVolumeExpansion,
            hasSignificantMove,
            hadConsolidation,
            brokeResistance
        ].filter(Boolean).length;

        if (criteriasMet < 3) return null;

        const metrics = {
            volumeRatio,
            priceMove,
            consolidationDays,
            resistanceLevel: asset.resistance
        };

        return {
            ticker: asset.symbol,
            setup: 'BREAKOUT',
            confidence: this.calculateConfidence(metrics),
            timestamp: new Date().toISOString(),
            price: asset.price,
            volume: asset.volume,
            metrics,
            optionPlay: this.suggestOptions(asset)
        };
    }

    private suggestOptions(asset: Asset): any {
        // Simple options recommendation
        const suggestedStrike = Math.ceil(asset.price * 1.02); // 2% OTM
        return {
            suggestedStrike,
            expiry: '7 DTE',
            estimatedPremium: asset.price * 0.02, // Rough estimate
            maxRisk: 100, // Per contract assumption
            targetReturn: 300 // 3x minimum target
        };
    }
}
