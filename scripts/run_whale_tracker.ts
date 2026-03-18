// ═══════════════════════════════════════════════════════════════
// WHALE FLOW TRACKER RUNNER
// Standalone script: npx tsx scripts/run_whale_tracker.ts
// Pure TypeScript — no Python subprocess needed.
// ═══════════════════════════════════════════════════════════════

import { WhaleFlowService } from '../src/lib/intel/whale/service';

const service = new WhaleFlowService();

console.log('═══════════════════════════════════════════════');
console.log('  🐋 Whale Flow Tracker — Starting...');
console.log('  Press Ctrl+C to stop');
console.log('═══════════════════════════════════════════════');

service.start();

process.on('SIGINT', () => {
    console.log('\n🐋 Shutting down Whale Flow Tracker...');
    service.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    service.stop();
    process.exit(0);
});
