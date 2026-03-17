import { ScanStrategy, Asset, ScanResult } from './types';
import { BreakoutScanner } from './strategies/breakout';
import { ConsolidationScanner } from './strategies/consolidation';

export type CombinationMode = 'AND' | 'OR';

export class ScannerEngine {
    private strategies: ScanStrategy[] = [];
    private watchlist: Asset[] = [];

    constructor() {
        // Register default strategies
        this.strategies.push(new BreakoutScanner());
        this.strategies.push(new ConsolidationScanner());
    }

    setWatchlist(assets: Asset[]) {
        this.watchlist = assets;
    }

    addStrategy(strategy: ScanStrategy) {
        this.strategies.push(strategy);
    }

    /**
     * Scan all assets with all active strategies
     */
    scan(): ScanResult[] {
        const results: ScanResult[] = [];

        for (const asset of this.watchlist) {
            for (const strategy of this.strategies) {
                const result = strategy.scan(asset);
                if (result) {
                    results.push(result);
                }
            }
        }

        // Sort by confidence and timestamp
        return results.sort((a, b) => {
            const confScore = { HIGH: 3, MEDIUM: 2, LOW: 1 };
            return confScore[b.confidence] - confScore[a.confidence];
        });
    }

    /**
     * Scan with specific strategy
     */
    scanWithStrategy(strategyName: string): ScanResult[] {
        const strategy = this.strategies.find(s => s.name === strategyName);
        if (!strategy) return [];

        const results: ScanResult[] = [];
        for (const asset of this.watchlist) {
            const result = strategy.scan(asset);
            if (result) results.push(result);
        }

        return results;
    }

    /**
     * Combine multiple strategies with AND/OR logic
     */
    combineStrategies(strategyNames: string[], mode: CombinationMode = 'AND'): ScanResult[] {
        const selectedStrategies = this.strategies.filter(s =>
            strategyNames.includes(s.name)
        );

        if (selectedStrategies.length === 0) return [];

        const results: ScanResult[] = [];

        for (const asset of this.watchlist) {
            const strategyResults = selectedStrategies
                .map(s => s.scan(asset))
                .filter(r => r !== null);

            if (mode === 'AND' && strategyResults.length === selectedStrategies.length) {
                // All strategies must match
                results.push(strategyResults[0]!);
            } else if (mode === 'OR' && strategyResults.length > 0) {
                // At least one strategy matches
                results.push(strategyResults[0]!);
            }
        }

        return results;
    }

    getAvailableStrategies(): string[] {
        return this.strategies.map(s => s.name);
    }
}
