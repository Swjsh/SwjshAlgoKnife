// ═══════════════════════════════════════════════════════════════
// ON-CHAIN CONFLUENCE RUNNER
// Standalone script: npx tsx scripts/run_onchain.ts
// Spawns the Python on-chain service via the TypeScript bridge.
// ═══════════════════════════════════════════════════════════════

import { OnChainBridge } from '../src/lib/intel/onchain/bridge';

const bridge = new OnChainBridge();

console.log('═══════════════════════════════════════════════');
console.log('  ⛓️  On-Chain Confluence — Starting...');
console.log('  Press Ctrl+C to stop');
console.log('═══════════════════════════════════════════════');

bridge.start();

process.on('SIGINT', () => {
    console.log('\n⛓️ Shutting down On-Chain Confluence...');
    bridge.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    bridge.stop();
    process.exit(0);
});
