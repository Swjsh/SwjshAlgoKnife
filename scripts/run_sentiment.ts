// ═══════════════════════════════════════════════════════════════
// SENTIMENT ENGINE RUNNER
// Standalone script: npx tsx scripts/run_sentiment.ts
// Spawns the Python sentiment service via the TypeScript bridge.
// ═══════════════════════════════════════════════════════════════

import { SentimentBridge } from '../src/lib/intel/sentiment/bridge';

const bridge = new SentimentBridge();

console.log('═══════════════════════════════════════════════');
console.log('  📰 Sentiment Engine — Starting...');
console.log('  Press Ctrl+C to stop');
console.log('═══════════════════════════════════════════════');

bridge.start();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n📰 Shutting down Sentiment Engine...');
    bridge.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    bridge.stop();
    process.exit(0);
});
