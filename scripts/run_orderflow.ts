#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════
// ORDER FLOW RUNNER — Standalone process for CVD + Z-Score
// Launch: npx tsx scripts/run_orderflow.ts
// ═══════════════════════════════════════════════════════════════

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env before anything else
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

import { OrderFlowService } from '../src/lib/intel/orderflow/service';

console.log('═══════════════════════════════════════════════');
console.log('  SwjshAK — Order Flow Intelligence Engine');
console.log('  CVD + Z-Score + Absorption/Exhaustion');
console.log('═══════════════════════════════════════════════');

const service = new OrderFlowService();
service.start();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 [OrderFlow] Shutting down...');
    service.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    service.stop();
    process.exit(0);
});
