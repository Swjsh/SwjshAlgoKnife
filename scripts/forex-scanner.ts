/**
 * Forex Scanner - Set and Forget Strategy
 * 
 * Scans major forex pairs using OANDA API and identifies valid trade setups
 * based on the FXALEXG Set and Forget strategy.
 * 
 * Usage: npx tsx scripts/forex-scanner.ts
 * 
 * Prerequisites:
 * 1. Create OANDA demo account: https://www.oanda.com/demo-account/
 * 2. Get API token: fxTrade portal → Manage API Access → Generate
 * 3. Set environment variables in .env.local:
 *    OANDA_ACCOUNT_ID=xxx-xxx-xxxxxxx-xxx
 *    OANDA_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *    OANDA_ENVIRONMENT=practice
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

import { OandaClient, FOREX_PAIRS, type Timeframe, type Candle } from '../src/lib/broker/oanda';
import { analyzeSetup, type MultiTimeframeData, type TradeSetup } from '../src/lib/engine/strategies/setAndForget';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SCAN_PAIRS = [
  // Majors
  'EUR_USD', 'GBP_USD', 'USD_JPY', 'USD_CHF', 'AUD_USD', 'USD_CAD', 'NZD_USD',
  // Crosses
  'EUR_GBP', 'EUR_JPY', 'GBP_JPY', 'EUR_AUD', 'AUD_JPY', 'GBP_AUD',
];

const TIMEFRAMES: Timeframe[] = ['1w', '1d', '4h', '1h', '30m'];
const CANDLE_COUNT = 100; // How many candles to fetch per timeframe

// ============================================================================
// SCANNER
// ============================================================================

async function fetchMultiTimeframeData(
  client: OandaClient,
  instrument: string
): Promise<MultiTimeframeData> {
  console.log(`  📊 Fetching data for ${instrument}...`);
  
  const [weekly, daily, h4, h1, m30] = await Promise.all([
    client.getCandles(instrument, '1w', CANDLE_COUNT),
    client.getCandles(instrument, '1d', CANDLE_COUNT),
    client.getCandles(instrument, '4h', CANDLE_COUNT),
    client.getCandles(instrument, '1h', CANDLE_COUNT),
    client.getCandles(instrument, '30m', CANDLE_COUNT),
  ]);
  
  return { weekly, daily, h4, h1, m30 };
}

async function scanPair(client: OandaClient, instrument: string): Promise<TradeSetup> {
  try {
    const data = await fetchMultiTimeframeData(client, instrument);
    return analyzeSetup(instrument, data);
  } catch (error) {
    console.error(`  ❌ Error scanning ${instrument}:`, error);
    return {
      valid: false,
      direction: 'long',
      instrument,
      entry: 0,
      stopLoss: 0,
      takeProfit: 0,
      riskReward: 0,
      confluence: { rejectionCandle: false, atAOI: false, psychLevel: false, structurePoint: false, emaRejection: false, score: 0 },
      reason: `Error: ${error}`,
    };
  }
}

async function runScanner(): Promise<void> {
  console.log('\n🔍 ═══════════════════════════════════════════════════════════');
  console.log('   SET AND FORGET FOREX SCANNER');
  console.log('   Based on FXALEXG Strategy');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Initialize OANDA client
  let client: OandaClient;
  try {
    client = OandaClient.fromEnv();
  } catch (error) {
    console.error('❌ Failed to initialize OANDA client.');
    console.error('   Make sure you have set these in .env.local:');
    console.error('   - OANDA_ACCOUNT_ID');
    console.error('   - OANDA_API_TOKEN');
    console.error('   - OANDA_ENVIRONMENT=practice');
    console.error('\n   Get a free demo account at: https://www.oanda.com/demo-account/\n');
    process.exit(1);
  }
  
  // Test connection
  console.log('🔌 Testing OANDA connection...');
  const connected = await client.testConnection();
  if (!connected) {
    console.error('❌ Failed to connect to OANDA. Check your credentials.');
    process.exit(1);
  }
  
  // Get account info
  const account = await client.getAccountSummary();
  console.log(`\n💰 Account Balance: $${account.balance.toFixed(2)}`);
  console.log(`📈 Open Trades: ${account.openTradeCount}`);
  console.log(`📊 Margin Available: $${account.marginAvailable.toFixed(2)}\n`);
  
  // Scan pairs
  console.log(`🔄 Scanning ${SCAN_PAIRS.length} pairs...\n`);
  
  const results: TradeSetup[] = [];
  
  for (const pair of SCAN_PAIRS) {
    const setup = await scanPair(client, pair);
    results.push(setup);
    
    if (setup.valid) {
      console.log(`  ✅ ${pair}: VALID SETUP`);
    } else {
      console.log(`  ⏸️  ${pair}: ${setup.reason}`);
    }
    
    // Rate limiting - OANDA allows 120 requests/second but let's be nice
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📋 SCAN RESULTS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const validSetups = results.filter(r => r.valid);
  
  if (validSetups.length === 0) {
    console.log('😴 No valid setups found. Check back later.');
    console.log('   Strategy is selective - this is normal!\n');
  } else {
    console.log(`🎯 Found ${validSetups.length} valid setup(s):\n`);
    
    for (const setup of validSetups) {
      const symbol = setup.instrument.replace('_', '/');
      const pipsToSL = Math.abs(setup.entry - setup.stopLoss) * 10000;
      const pipsToTP = Math.abs(setup.takeProfit - setup.entry) * 10000;
      
      console.log(`┌─────────────────────────────────────────┐`);
      console.log(`│ ${symbol} - ${setup.direction.toUpperCase().padEnd(5)} │`);
      console.log(`├─────────────────────────────────────────┤`);
      console.log(`│ Entry:      ${setup.entry.toFixed(5).padStart(12)}          │`);
      console.log(`│ Stop Loss:  ${setup.stopLoss.toFixed(5).padStart(12)} (${pipsToSL.toFixed(0).padStart(3)} pips) │`);
      console.log(`│ Take Profit:${setup.takeProfit.toFixed(5).padStart(12)} (${pipsToTP.toFixed(0).padStart(3)} pips) │`);
      console.log(`│ R:R:        ${setup.riskReward.toFixed(1).padStart(12)}:1        │`);
      console.log(`│ Confluence: ${setup.confluence.score}/5                       │`);
      console.log(`├─────────────────────────────────────────┤`);
      console.log(`│ ${setup.reason.slice(0, 39).padEnd(39)} │`);
      console.log(`└─────────────────────────────────────────┘\n`);
    }
    
    // Risk management reminder
    console.log('⚠️  REMINDER:');
    console.log('   • Risk 1-2% per trade maximum');
    console.log('   • Only trade during London/NY sessions');
    console.log('   • Set and forget - don\'t micromanage\n');
  }
  
  // Timestamp
  console.log(`⏰ Scan completed at ${new Date().toLocaleString()}\n`);
}

// ============================================================================
// CLI HELPERS
// ============================================================================

async function showHelp(): Promise<void> {
  console.log(`
Forex Scanner - Set and Forget Strategy
========================================

Usage:
  npx tsx scripts/forex-scanner.ts [command]

Commands:
  scan      Run the scanner (default)
  account   Show account information
  price     Get current price for a pair
  help      Show this help message

Examples:
  npx tsx scripts/forex-scanner.ts
  npx tsx scripts/forex-scanner.ts account
  npx tsx scripts/forex-scanner.ts price EUR_USD

Setup:
  1. Create free demo account: https://www.oanda.com/demo-account/
  2. Get API token: fxTrade portal → Manage API Access
  3. Add to .env.local:
     OANDA_ACCOUNT_ID=xxx-xxx-xxxxxxx-xxx
     OANDA_API_TOKEN=your-token-here
     OANDA_ENVIRONMENT=practice
`);
}

async function showAccount(): Promise<void> {
  const client = OandaClient.fromEnv();
  const account = await client.getAccountSummary();
  
  console.log('\n📊 Account Summary');
  console.log('═══════════════════════════════════════');
  console.log(`ID:               ${account.id}`);
  console.log(`Balance:          $${account.balance.toFixed(2)}`);
  console.log(`Unrealized P&L:   $${account.unrealizedPL.toFixed(2)}`);
  console.log(`NAV:              $${account.NAV.toFixed(2)}`);
  console.log(`Margin Used:      $${account.marginUsed.toFixed(2)}`);
  console.log(`Margin Available: $${account.marginAvailable.toFixed(2)}`);
  console.log(`Open Trades:      ${account.openTradeCount}`);
  console.log('═══════════════════════════════════════\n');
}

async function showPrice(instrument: string): Promise<void> {
  const client = OandaClient.fromEnv();
  const price = await client.getPrice(instrument);
  
  console.log(`\n${instrument.replace('_', '/')}`);
  console.log(`  Bid:    ${price.bid.toFixed(5)}`);
  console.log(`  Ask:    ${price.ask.toFixed(5)}`);
  console.log(`  Spread: ${(price.spread * 10000).toFixed(1)} pips\n`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'scan';
  
  switch (command) {
    case 'scan':
      await runScanner();
      break;
    case 'account':
      await showAccount();
      break;
    case 'price':
      if (!args[1]) {
        console.error('Usage: npx tsx scripts/forex-scanner.ts price EUR_USD');
        process.exit(1);
      }
      await showPrice(args[1]);
      break;
    case 'help':
    case '--help':
    case '-h':
      await showHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      await showHelp();
      process.exit(1);
  }
}

main().catch(console.error);
