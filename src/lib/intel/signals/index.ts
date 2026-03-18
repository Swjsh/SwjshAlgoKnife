// ═══════════════════════════════════════════════════════════════
// INTEL SIGNALS — Profit-enhancing signal generators
//
// Exports all signal generation functions from a single module.
// ═══════════════════════════════════════════════════════════════

export {
    generateContrarianSignal,
    getContrarianMultiplier,
} from './contrarian';

export {
    generateFundingReversion,
    getFundingMultiplier,
    getFundingSignalType,
} from './funding-reversion';

export {
    calculateConfluence,
    getConfluenceBonus,
    confluenceSupports,
} from './confluence';
