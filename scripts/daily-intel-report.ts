// ═══════════════════════════════════════════════════════════════
// DAILY INTEL REPORT — Morning Briefing Generator
// "Know the battlefield before the market opens."
//
// Run: npx tsx scripts/daily-intel-report.ts
// Outputs: Formatted Discord-ready morning briefing + JSON summary
// ═══════════════════════════════════════════════════════════════

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// ── Config ──────────────────────────────────────────────────────

const DB_PATH = path.join(process.cwd(), 'swjsh.db');
const AGENTS_DB_PATH = path.join(process.cwd(), 'src', 'app', 'api', 'agents', 'agents_db.json');
const REPORT_DIR = path.join(process.cwd(), 'data', 'reports');
const LOOKBACK_HOURS = 24;

// ── Types ────────────────────────────────────────────────────────

interface IntelSignalRow {
    id: number;
    timestamp: string;
    source: string;
    symbol: string;
    signal_type: string;
    confidence: number;
    summary: string;
    payload: string;
    expires_at: string;
}

interface TradeRow {
    id: number;
    symbol: string;
    direction: string;
    entry_price: number;
    exit_price: number | null;
    pnl: number | null;
    strategy: string;
    status: string;
    entry_date: string;
    exit_date: string | null;
    intel_snapshot: string | null;
}

interface SignalStats {
    total: number;
    bullish: number;
    bearish: number;
    neutral: number;
    topByConfidence: IntelSignalRow[];
}

interface SourceStats {
    [source: string]: {
        count: number;
        avgConfidence: number;
        bullish: number;
        bearish: number;
    };
}

interface SymbolStats {
    [symbol: string]: {
        signals: number;
        bullish: number;
        bearish: number;
        netBias: number; // +1 fully bullish, -1 fully bearish
        netScore: number; // weighted
    };
}

interface TradeAttribution {
    totalTrades: number;
    closedTrades: number;
    tradesWithIntel: number;
    winRate: number | null;
    avgPnl: number | null;
    intelAligned: number; // trades where intel matched direction
    intelContradict: number; // trades where intel opposed direction
    intelAlignedWinRate: number | null;
    intelContradictWinRate: number | null;
}

interface ServiceHealth {
    [service: string]: {
        status: string;
        lastHeartbeat: string | null;
        signalsPublished: number;
    };
}

interface DailyReport {
    generatedAt: string;
    lookbackHours: number;
    health: ServiceHealth;
    signals: SignalStats;
    bySource: SourceStats;
    bySymbol: SymbolStats;
    trades: TradeAttribution;
    topSignals: IntelSignalRow[];
}

// ── Database helpers ─────────────────────────────────────────────

function openDb(): Database.Database {
    if (!fs.existsSync(DB_PATH)) {
        console.error(`❌ Database not found at: ${DB_PATH}`);
        process.exit(1);
    }
    return new Database(DB_PATH, { readonly: true });
}

function getServiceHealth(db: Database.Database): ServiceHealth {
    const services = ['orderflow', 'sentiment', 'onchain', 'whale'];
    const health: ServiceHealth = {};

    for (const svc of services) {
        try {
            const row = db.prepare(`SELECT value FROM settings WHERE key = ?`)
                .get(`health:${svc}`) as { value: string } | undefined;

            if (row) {
                const data = JSON.parse(row.value);
                const lastBeat = new Date(data.lastHeartbeat).getTime();
                const ageMs = Date.now() - lastBeat;
                const status = ageMs < 5 * 60 * 1000 ? 'RUNNING'
                             : ageMs < 15 * 60 * 1000 ? 'STALE'
                             : 'DEAD';

                health[svc] = {
                    status,
                    lastHeartbeat: data.lastHeartbeat,
                    signalsPublished: data.signalsPublished || 0,
                };
            } else {
                health[svc] = { status: 'NOT_STARTED', lastHeartbeat: null, signalsPublished: 0 };
            }
        } catch {
            health[svc] = { status: 'ERROR', lastHeartbeat: null, signalsPublished: 0 };
        }
    }

    return health;
}

function getSignals(db: Database.Database, hours: number): IntelSignalRow[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    return db.prepare(`
        SELECT * FROM intel_signals
        WHERE timestamp >= ?
        ORDER BY confidence DESC, timestamp DESC
    `).all(cutoff) as IntelSignalRow[];
}

function getTrades(db: Database.Database, hours: number): TradeRow[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    return db.prepare(`
        SELECT * FROM trades
        WHERE entry_date >= ?
        ORDER BY entry_date DESC
    `).all(cutoff) as TradeRow[];
}

// ── Analysis helpers ─────────────────────────────────────────────

function analyzeSignals(signals: IntelSignalRow[]): SignalStats {
    const bullish = signals.filter(s => s.signal_type === 'BULLISH').length;
    const bearish = signals.filter(s => s.signal_type === 'BEARISH').length;
    const neutral = signals.length - bullish - bearish;

    const topByConfidence = [...signals]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);

    return {
        total: signals.length,
        bullish,
        bearish,
        neutral,
        topByConfidence,
    };
}

function analyzeBySource(signals: IntelSignalRow[]): SourceStats {
    const stats: SourceStats = {};

    for (const sig of signals) {
        if (!stats[sig.source]) {
            stats[sig.source] = { count: 0, avgConfidence: 0, bullish: 0, bearish: 0 };
        }
        stats[sig.source].count++;
        stats[sig.source].avgConfidence += sig.confidence;
        if (sig.signal_type === 'BULLISH') stats[sig.source].bullish++;
        if (sig.signal_type === 'BEARISH') stats[sig.source].bearish++;
    }

    for (const src of Object.keys(stats)) {
        stats[src].avgConfidence = stats[src].avgConfidence / stats[src].count;
    }

    return stats;
}

function analyzeBySymbol(signals: IntelSignalRow[]): SymbolStats {
    const stats: SymbolStats = {};

    for (const sig of signals) {
        if (!stats[sig.symbol]) {
            stats[sig.symbol] = { signals: 0, bullish: 0, bearish: 0, netBias: 0, netScore: 0 };
        }
        stats[sig.symbol].signals++;
        if (sig.signal_type === 'BULLISH') {
            stats[sig.symbol].bullish++;
            stats[sig.symbol].netScore += sig.confidence;
        } else if (sig.signal_type === 'BEARISH') {
            stats[sig.symbol].bearish++;
            stats[sig.symbol].netScore -= sig.confidence;
        }
    }

    for (const sym of Object.keys(stats)) {
        const { bullish, bearish, signals } = stats[sym];
        stats[sym].netBias = signals > 0 ? (bullish - bearish) / signals : 0;
        stats[sym].netScore = stats[sym].netScore / stats[sym].signals;
    }

    return stats;
}

function analyzeTradeAttribution(trades: TradeRow[]): TradeAttribution {
    const closed = trades.filter(t => t.status === 'CLOSED' && t.pnl !== null);
    const withIntel = trades.filter(t => t.intel_snapshot !== null);
    const closedWithIntel = closed.filter(t => t.intel_snapshot !== null);

    let intelAligned = 0;
    let intelContradict = 0;
    let alignedWins = 0;
    let contradictWins = 0;

    for (const trade of closedWithIntel) {
        try {
            const snap = JSON.parse(trade.intel_snapshot!);
            const isWin = (trade.pnl ?? 0) > 0;

            // Intel confirms the direction if score > 0
            if (snap.score > 0) {
                intelAligned++;
                if (isWin) alignedWins++;
            } else if (snap.score < 0) {
                intelContradict++;
                if (isWin) contradictWins++;
            }
        } catch {
            // Malformed snapshot — skip
        }
    }

    const closedWins = closed.filter(t => (t.pnl ?? 0) > 0).length;
    const avgPnl = closed.length > 0
        ? closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0) / closed.length
        : null;

    return {
        totalTrades: trades.length,
        closedTrades: closed.length,
        tradesWithIntel: withIntel.length,
        winRate: closed.length > 0 ? closedWins / closed.length : null,
        avgPnl,
        intelAligned,
        intelContradict,
        intelAlignedWinRate: intelAligned > 0 ? alignedWins / intelAligned : null,
        intelContradictWinRate: intelContradict > 0 ? contradictWins / intelContradict : null,
    };
}

// ── Discord message formatting ────────────────────────────────────

function healthEmoji(status: string): string {
    switch (status) {
        case 'RUNNING': return '🟢';
        case 'STALE': return '🟡';
        case 'DEAD': return '🔴';
        default: return '⚫';
    }
}

function biasEmoji(bias: number): string {
    if (bias > 0.3) return '📈';
    if (bias < -0.3) return '📉';
    return '↔️';
}

function pct(val: number | null): string {
    return val !== null ? `${(val * 100).toFixed(1)}%` : 'N/A';
}

function sourceLabel(source: string): string {
    const map: Record<string, string> = {
        ORDER_FLOW: 'Order Flow',
        SENTIMENT: 'Sentiment',
        ONCHAIN: 'On-Chain',
        WHALE: 'Whale Flow',
    };
    return map[source] || source;
}

function formatDiscordMessage(report: DailyReport): string {
    const date = new Date(report.generatedAt).toLocaleDateString('en-US', {
        weekday: 'long', month: 'short', day: 'numeric',
    });

    const lines: string[] = [
        `# 🧠 SwjshAK Intelligence Briefing — ${date}`,
        `> *${report.lookbackHours}h lookback · Generated ${new Date(report.generatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}*`,
        '',
        '## 🔌 Service Health',
    ];

    for (const [svc, data] of Object.entries(report.health)) {
        const label = sourceLabel(svc.toUpperCase());
        const beat = data.lastHeartbeat
            ? `last beat ${Math.round((Date.now() - new Date(data.lastHeartbeat).getTime()) / 60000)}m ago`
            : 'never connected';
        lines.push(`${healthEmoji(data.status)} **${label}** — ${data.status} (${beat}, ${data.signalsPublished} signals)`);
    }

    lines.push('');
    lines.push('## 📡 Signal Summary');
    lines.push(`**${report.signals.total}** signals captured — ${report.signals.bullish} bullish / ${report.signals.bearish} bearish / ${report.signals.neutral} neutral`);

    if (Object.keys(report.bySource).length > 0) {
        lines.push('');
        lines.push('**By Source:**');
        for (const [src, data] of Object.entries(report.bySource)) {
            lines.push(`• ${sourceLabel(src)}: ${data.count} signals · avg confidence ${pct(data.avgConfidence)} · ${data.bullish}↑ ${data.bearish}↓`);
        }
    }

    if (Object.keys(report.bySymbol).length > 0) {
        lines.push('');
        lines.push('## 🎯 Symbol Bias Snapshot');

        const sorted = Object.entries(report.bySymbol)
            .sort(([, a], [, b]) => Math.abs(b.netScore) - Math.abs(a.netScore));

        for (const [sym, data] of sorted.slice(0, 8)) {
            const emoji = biasEmoji(data.netBias);
            const score = (data.netScore * 100).toFixed(0);
            lines.push(`${emoji} **${sym}** — ${data.signals} signals, net score ${score > '0' ? '+' : ''}${score}% (${data.bullish}↑ ${data.bearish}↓)`);
        }
    }

    if (report.topSignals && report.topSignals.length > 0) {
        lines.push('');
        lines.push('## ⭐ Top Signals by Confidence');
        for (const sig of report.topSignals.slice(0, 5)) {
            const conf = pct(sig.confidence);
            const time = new Date(sig.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            lines.push(`• \`${sig.source}\` **${sig.symbol}** ${sig.signal_type} @ ${conf} — *${sig.summary}* (${time})`);
        }
    }

    lines.push('');
    lines.push('## 📊 Trade Attribution (24h)');
    const t = report.trades;
    if (t.totalTrades === 0) {
        lines.push('No trades taken in the last 24h.');
    } else {
        lines.push(`**${t.totalTrades}** trades taken, **${t.closedTrades}** closed`);
        lines.push(`Overall win rate: **${pct(t.winRate)}** · Avg PnL: **${t.avgPnl !== null ? '$' + t.avgPnl.toFixed(2) : 'N/A'}**`);

        if (t.tradesWithIntel > 0) {
            lines.push(`Intel coverage: **${t.tradesWithIntel}/${t.totalTrades}** trades tagged`);
            if (t.intelAligned > 0) {
                lines.push(`✅ Intel-aligned trades: **${t.intelAligned}** · win rate **${pct(t.intelAlignedWinRate)}**`);
            }
            if (t.intelContradict > 0) {
                lines.push(`⚠️  Intel-opposed trades: **${t.intelContradict}** · win rate **${pct(t.intelContradictWinRate)}**`);
            }
        } else {
            lines.push('*No intel snapshots captured yet — ensure executor.ts is capturing intel at entry.*');
        }
    }

    lines.push('');
    lines.push('---');
    lines.push('*SwjshAK Intelligence Layer · Automated Briefing*');

    return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
    console.log('🧠 ═══ SwjshAK Daily Intel Report ═══\n');

    const db = openDb();

    console.log('📡 Fetching service health...');
    const health = getServiceHealth(db);

    console.log(`📥 Querying last ${LOOKBACK_HOURS}h of signals...`);
    const signals = getSignals(db, LOOKBACK_HOURS);
    console.log(`   Found ${signals.length} signals`);

    console.log('💼 Querying trades...');
    const trades = getTrades(db, LOOKBACK_HOURS);
    console.log(`   Found ${trades.length} trades`);

    // Analyze
    const signalStats = analyzeSignals(signals);
    const bySource = analyzeBySource(signals);
    const bySymbol = analyzeBySymbol(signals);
    const tradeAttribution = analyzeTradeAttribution(trades);

    const report: DailyReport = {
        generatedAt: new Date().toISOString(),
        lookbackHours: LOOKBACK_HOURS,
        health,
        signals: signalStats,
        bySource,
        bySymbol,
        trades: tradeAttribution,
        topSignals: signalStats.topByConfidence,
    };

    // Format Discord message
    const discordMsg = formatDiscordMessage(report);

    // Ensure report dir exists
    if (!fs.existsSync(REPORT_DIR)) {
        fs.mkdirSync(REPORT_DIR, { recursive: true });
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const jsonPath = path.join(REPORT_DIR, `intel-report-${dateStr}.json`);
    const mdPath = path.join(REPORT_DIR, `intel-report-${dateStr}.md`);

    // Save JSON report
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 JSON report saved: ${jsonPath}`);

    // Save markdown/Discord message
    fs.writeFileSync(mdPath, discordMsg);
    console.log(`📄 Markdown report saved: ${mdPath}`);

    // Print to stdout
    console.log('\n' + '═'.repeat(60));
    console.log(discordMsg);
    console.log('═'.repeat(60) + '\n');

    // Optional: POST to Discord webhook
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (webhookUrl) {
        console.log('📨 Sending to Discord...');
        try {
            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: discordMsg }),
            });
            if (res.ok) {
                console.log('✅ Discord message sent!');
            } else {
                console.error(`❌ Discord error: ${res.status} ${res.statusText}`);
            }
        } catch (err) {
            console.error('❌ Failed to send Discord message:', err);
        }
    } else {
        console.log('💡 Tip: Set DISCORD_WEBHOOK_URL env var to auto-post briefings to your server.');
    }

    db.close();
    console.log('\n✅ Report complete.');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
