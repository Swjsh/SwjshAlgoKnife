import { ScanStrategy, Asset, ScanResult } from '../types';

export class ConsolidationScanner extends ScanStrategy {
    name = 'Consolidation Scanner';

    scan(asset: Asset): ScanResult | null {
        const consolidationDays = asset.consolidationPeriod || 0;
        const range = ((asset.high - asset.low) / asset.price) * 100;
        const volumeRatio = asset.volume / asset.avgVolume;

        // Range compression + low volume = coiling spring
        const isTightRange = range < 2; // Less than 2% daily range
        const isConsolidated = consolidationDays >= 5;
        const volumeDrying = volumeRatio < 0.8; // Below average volume

        if (!isTightRange || !isConsolidated) return null;

        const metrics = {
            volumeRatio,
            priceMove: asset.dailyReturn,
            consolidationDays,
            rangeCompression: range
        };

        return {
            ticker: asset.symbol,
            setup: 'CONSOLIDATION',
            confidence: this.calculateConfidence(metrics),
            timestamp: new Date().toISOString(),
            price: asset.price,
            volume: asset.volume,
            metrics
        };
    }
}
