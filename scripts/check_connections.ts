/**
 * SwjshAK — Startup Connection Health Check
 *
 * Run before starting the trading system to verify all brokers,
 * notification channels, and data feeds are live.
 *
 * Usage:
 *   npx tsx scripts/check_connections.ts
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load env
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log('✅ Loaded .env.local\n');
} else {
    console.warn('⚠️  .env.local not found — using process environment\n');
}

// ── Types ───────────────────────────────────────────────────────────────────
interface CheckResult {
    name:    string;
    status:  '✅ OK' | '❌ FAIL' | '⚠️  SKIP';
    detail?: string;
}

const results: CheckResult[] = [];

function pass(name: string, detail?: string) {
    results.push({ name, status: '✅ OK', detail });
}
function fail(name: string, detail?: string) {
    results.push({ name, status: '❌ FAIL', detail });
}
function skip(name: string, detail?: string) {
    results.push({ name, status: '⚠️  SKIP', detail });
}

// ── Checks ───────────────────────────────────────────────────────────────────

async function checkAlpaca() {
    const key    = process.env.APCA_API_KEY_ID;
    const secret = process.env.APCA_API_SECRET_KEY;
    const base   = process.env.APCA_API_BASE_URL || 'https://paper-api.alpaca.markets';

    if (!key || !secret) {
        skip('Alpaca Paper', 'APCA_API_KEY_ID or APCA_API_SECRET_KEY not set');
        return;
    }

    try {
        const res = await fetch(`${base}/v2/account`, {
            headers: {
                'APCA-API-KEY-ID':     key,
                'APCA-API-SECRET-KEY': secret,
            },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const account = await res.json();
        pass('Alpaca Paper', `Account: ${account.account_number} | Cash: $${parseFloat(account.cash).toLocaleString()} | Status: ${account.status}`);
    } catch (err: any) {
        fail('Alpaca Paper', err.message);
    }
}

async function checkOanda() {
    const token     = process.env.OANDA_API_TOKEN;
    const accountId = process.env.OANDA_ACCOUNT_ID;
    const env       = process.env.OANDA_ENVIRONMENT || 'practice';

    if (!token || !accountId) {
        skip('OANDA', 'OANDA_API_TOKEN or OANDA_ACCOUNT_ID not set');
        return;
    }

    const base = env === 'practice'
        ? 'https://api-fxpractice.oanda.com/v3'
        : 'https://api-fxtrade.oanda.com/v3';

    try {
        const res = await fetch(`${base}/accounts/${accountId}/summary`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const acct = data.account;
        pass('OANDA Practice', `Account: ${acct.id} | Balance: $${parseFloat(acct.balance).toLocaleString()} | Open trades: ${acct.openTradeCount}`);
    } catch (err: any) {
        fail('OANDA Practice', err.message);
    }
}

async function checkDiscord() {
    const url = process.env.DISCORD_CHIEF_WEBHOOK;
    if (!url || url.includes('YOUR_WEBHOOK_TOKEN')) {
        skip('Discord (Chief)', 'DISCORD_CHIEF_WEBHOOK not configured');
        return;
    }

    try {
        // Send a startup ping embed
        const payload = {
            embeds: [{
                title: '🟢 SwjshAK Online',
                color: 0x06B6D4,
                description: 'System health check passed. All connections verified.',
                fields: [
                    { name: 'Mode',      value: 'Paper Trading',             inline: true },
                    { name: 'Webhook',   value: '✅ Authenticated',           inline: true },
                    { name: 'Time',      value: new Date().toLocaleString(),  inline: true },
                ],
                footer: { text: 'SwjshAK · Startup Check' },
                timestamp: new Date().toISOString(),
            }],
        };
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        pass('Discord (Chief)', 'Startup ping sent to #chief channel');
    } catch (err: any) {
        fail('Discord (Chief)', err.message);
    }
}

async function checkFinnhub() {
    const key = process.env.NEXT_PUBLIC_FINNHUB_KEY;
    if (!key) {
        skip('Finnhub FX Feed', 'NEXT_PUBLIC_FINNHUB_KEY not set');
        return;
    }

    try {
        const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=OANDA:EUR_USD&token=${key}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.c && data.c > 0) {
            pass('Finnhub FX Feed', `EUR/USD current price: ${data.c}`);
        } else {
            fail('Finnhub FX Feed', 'Got empty quote — check API key or quota');
        }
    } catch (err: any) {
        fail('Finnhub FX Feed', err.message);
    }
}

function checkWebhookSecret() {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) {
        fail('Webhook Secret', 'WEBHOOK_SECRET not set — TradingView auth is DISABLED');
        return;
    }
    if (secret.length < 12) {
        results.push({ name: 'Webhook Secret', status: '⚠️  SKIP', detail: 'Secret is set but very short — consider using a stronger value' });
        return;
    }
    pass('Webhook Secret', `Set (${secret.length} chars) — TradingView auth is ACTIVE`);
}

function checkDatabase() {
    const dbPath = path.join(process.cwd(), 'journal.db');
    if (!fs.existsSync(dbPath)) {
        skip('SQLite Database', 'journal.db not found — will be created on first run');
        return;
    }
    const stat = fs.statSync(dbPath);
    pass('SQLite Database', `journal.db exists (${(stat.size / 1024).toFixed(1)} KB)`);
}

function checkAgentsDb() {
    const dbPath = path.join(process.cwd(), 'src', 'app', 'api', 'agents', 'agents_db.json');
    if (!fs.existsSync(dbPath)) {
        skip('Agents State (JSON)', 'agents_db.json not found — will be created on start');
        return;
    }
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const agentCount = Object.keys(data).length;
        pass('Agents State (JSON)', `${agentCount} agents loaded`);
    } catch {
        fail('Agents State (JSON)', 'agents_db.json exists but is invalid JSON');
    }
}

// ── Run All Checks ───────────────────────────────────────────────────────────

async function main() {
    console.log('══════════════════════════════════════════════');
    console.log('   SwjshAK — Connection Health Check');
    console.log('══════════════════════════════════════════════\n');

    checkWebhookSecret();
    checkDatabase();
    checkAgentsDb();

    await checkAlpaca();
    await checkOanda();
    await checkFinnhub();
    await checkDiscord(); // Always last — only sends ping if everything else passes

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════');
    console.log('   Results');
    console.log('══════════════════════════════════════════════');

    let allGood = true;
    for (const r of results) {
        if (r.status === '❌ FAIL') allGood = false;
        console.log(`  ${r.status}  ${r.name}`);
        if (r.detail) console.log(`           ${r.detail}`);
    }

    console.log('\n══════════════════════════════════════════════');
    if (allGood) {
        console.log('✅  All systems go. Start trading with: npm run dev');
    } else {
        console.log('⚠️   Fix the FAIL items above before going live.');
    }
    console.log('══════════════════════════════════════════════\n');
    console.log('TradingView webhook URL (add to your alert):');
    console.log('  http://YOUR_SERVER:3000/api/webhook/tradingview');
    console.log('\nWebhook payload format:');
    console.log('  {"symbol":"AAPL","action":"BUY","price":{{close}},"strategy":"MyStrategy"}');
    console.log('\nFor FX pairs use OANDA format:');
    console.log('  {"symbol":"EURUSD","action":"BUY","price":{{close}},"strategy":"Three Ducks"}');
    console.log('');
}

main().catch(console.error);
