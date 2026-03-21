/**
 * Discord Webhook Health Check — PULSE-9
 *
 * Validates connectivity to all 6 Halo persona Discord webhooks.
 * Sends a test embed to each webhook and reports success/failure.
 *
 * Usage:
 *   npx tsx scripts/discord-webhook-health.ts [--dry-run] [--verbose]
 *
 * Options:
 *   --dry-run   Only validate webhook URLs, don't send test messages
 *   --verbose   Show detailed response data
 *
 * Exit codes:
 *   0 = All webhooks healthy
 *   1 = One or more webhooks failed
 *
 * @author Arbiter (PULSE Agent)
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WebhookConfig {
    persona: string;
    envVar: string;
    url: string | null;
    channel: string;
}

interface HealthResult {
    persona: string;
    configured: boolean;
    reachable: boolean;
    sent: boolean;
    error?: string;
    latencyMs?: number;
}

interface DiscordWebhookEmbed {
    title: string;
    description: string;
    color: number;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    footer?: { text: string };
    timestamp?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const WEBHOOK_CONFIGS: WebhookConfig[] = [
    { persona: 'Chief', envVar: 'WEBHOOK_CHIEF', url: null, channel: '#chief-announcements' },
    { persona: 'Arbiter', envVar: 'WEBHOOK_ARBITER', url: null, channel: '#grade-reviews' },
    { persona: 'Cortana', envVar: 'WEBHOOK_CORTANA', url: null, channel: '#learn-patterns' },
    { persona: 'Scout', envVar: 'WEBHOOK_SCOUT', url: null, channel: '#back-ideas' },
    { persona: 'Ops', envVar: 'WEBHOOK_OPS', url: null, channel: '#pulse-alerts' },
    { persona: 'Hunter', envVar: 'WEBHOOK_HUNTER', url: null, channel: '#infra-tasks' },
];

const PERSONA_COLORS: Record<string, number> = {
    Chief: 0x6B8E23,   // Olive green
    Arbiter: 0x8B4513, // Bronze
    Cortana: 0x6495ED, // Blue
    Scout: 0x2E8B57,   // Forest green
    Ops: 0xDAA520,     // Gold
    Hunter: 0x8A2BE2,  // Purple
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadWebhookUrls(): void {
    const envPath = path.join(process.cwd(), 'discord-webhook-urls.env');

    if (!fs.existsSync(envPath)) {
        console.error(`[ERROR] discord-webhook-urls.env not found at ${envPath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(envPath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const match = trimmed.match(/^(WEBHOOK_\w+)=(.+)$/);
        if (match) {
            const [, envVar, url] = match;
            const config = WEBHOOK_CONFIGS.find(c => c.envVar === envVar);
            if (config) {
                config.url = url;
            }
        }
    }
}

function validateWebhookUrl(url: string | null): boolean {
    if (!url) return false;
    return url.startsWith('https://discord.com/api/webhooks/') ||
           url.startsWith('https://discordapp.com/api/webhooks/');
}

async function sendTestEmbed(
    config: WebhookConfig,
    dryRun: boolean,
    verbose: boolean,
): Promise<HealthResult> {
    const result: HealthResult = {
        persona: config.persona,
        configured: !!config.url,
        reachable: false,
        sent: false,
    };

    if (!config.url) {
        result.error = 'No webhook URL configured';
        return result;
    }

    if (!validateWebhookUrl(config.url)) {
        result.error = 'Invalid webhook URL format';
        return result;
    }

    result.reachable = true; // URL format is valid

    if (dryRun) {
        result.sent = true; // Pretend success for dry run
        return result;
    }

    // Build test embed
    const embed: DiscordWebhookEmbed = {
        title: `${config.persona} Health Check`,
        description: `Webhook connectivity validated at ${new Date().toISOString()}`,
        color: PERSONA_COLORS[config.persona] || 0x808080,
        fields: [
            { name: 'Status', value: 'HEALTHY', inline: true },
            { name: 'Channel', value: config.channel, inline: true },
            { name: 'Test ID', value: `PULSE-9-${Date.now()}`, inline: true },
        ],
        footer: { text: 'SwjshAK PULSE · Arbiter Health Monitor' },
        timestamp: new Date().toISOString(),
    };

    const payload = {
        username: config.persona,
        embeds: [embed],
    };

    const startTime = Date.now();

    try {
        const res = await fetch(config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        result.latencyMs = Date.now() - startTime;

        if (res.ok || res.status === 204) {
            result.sent = true;
        } else {
            const body = await res.text();
            result.error = `HTTP ${res.status}: ${body.slice(0, 100)}`;

            if (verbose) {
                console.error(`[${config.persona}] Response body: ${body}`);
            }
        }
    } catch (err) {
        result.latencyMs = Date.now() - startTime;
        result.error = err instanceof Error ? err.message : String(err);
    }

    return result;
}

function printResults(results: HealthResult[]): void {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║           DISCORD WEBHOOK HEALTH CHECK RESULTS                 ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');

    let allHealthy = true;

    for (const r of results) {
        const status = r.sent ? '✓ HEALTHY' : '✗ FAILED ';
        const latency = r.latencyMs ? `${r.latencyMs}ms` : 'N/A';
        const error = r.error ? ` | ${r.error}` : '';

        console.log(`║  ${r.persona.padEnd(10)} │ ${status} │ ${latency.padStart(6)}${error.slice(0, 30).padEnd(30)} ║`);

        if (!r.sent) allHealthy = false;
    }

    console.log('╠════════════════════════════════════════════════════════════════╣');

    const healthy = results.filter(r => r.sent).length;
    const total = results.length;
    const overallStatus = allHealthy ? '✓ ALL SYSTEMS OPERATIONAL' : '⚠ DEGRADED - SEE FAILURES';

    console.log(`║  Overall: ${healthy}/${total} webhooks healthy                               ║`);
    console.log(`║  Status:  ${overallStatus.padEnd(51)} ║`);
    console.log('╚════════════════════════════════════════════════════════════════╝');
}

function generateJsonReport(results: HealthResult[]): string {
    const report = {
        timestamp: new Date().toISOString(),
        agent: 'Arbiter',
        task: 'PULSE-9',
        summary: {
            total: results.length,
            healthy: results.filter(r => r.sent).length,
            failed: results.filter(r => !r.sent).length,
            allOperational: results.every(r => r.sent),
        },
        results,
    };

    return JSON.stringify(report, null, 2);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const verbose = args.includes('--verbose');

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║          ARBITER — Discord Webhook Health Check                ║');
    console.log('║          "Were it so easy to maintain perfect health."         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\nMode: ${dryRun ? 'DRY RUN (no messages sent)' : 'LIVE (sending test embeds)'}`);
    console.log(`Verbose: ${verbose ? 'ON' : 'OFF'}\n`);

    // Load webhook URLs
    console.log('[1/3] Loading webhook URLs from discord-webhook-urls.env...');
    loadWebhookUrls();

    const configured = WEBHOOK_CONFIGS.filter(c => c.url).length;
    console.log(`      Found ${configured}/${WEBHOOK_CONFIGS.length} webhooks configured.\n`);

    // Test each webhook
    console.log('[2/3] Testing webhook connectivity...');
    const results: HealthResult[] = [];

    for (const config of WEBHOOK_CONFIGS) {
        process.stdout.write(`      Testing ${config.persona}... `);
        const result = await sendTestEmbed(config, dryRun, verbose);
        results.push(result);

        if (result.sent) {
            console.log(`OK (${result.latencyMs || 0}ms)`);
        } else {
            console.log(`FAILED: ${result.error}`);
        }

        // Rate limit: 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Print results
    console.log('\n[3/3] Generating report...');
    printResults(results);

    // Save JSON report
    const reportPath = path.join(process.cwd(), 'logs', 'webhook-health-report.json');
    const logsDir = path.dirname(reportPath);
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
    fs.writeFileSync(reportPath, generateJsonReport(results));
    console.log(`\nJSON report saved to: ${reportPath}`);

    // Exit code
    const allHealthy = results.every(r => r.sent);
    process.exit(allHealthy ? 0 : 1);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
