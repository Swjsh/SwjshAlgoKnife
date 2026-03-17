/**
 * Discord Notification Service
 *
 * Sends structured embeds to Discord channels via webhook.
 * Uses the DISCORD_CHIEF_WEBHOOK for all trading alerts.
 * Configure additional channel webhooks in .env.local for routing.
 */

// Grade → color mapping for Professor embeds
const GRADE_COLORS: Record<string, number> = {
    'A':  0x10B981, // green
    'A-': 0x34D399,
    'B+': 0x06B6D4, // cyan
    'B':  0x22D3EE,
    'B-': 0x67E8F9,
    'C+': 0xF59E0B, // amber
    'C':  0xFBBF24,
    'C-': 0xFCD34D,
    'D':  0xF97316, // orange
    'F':  0xEF4444, // red
};

const GRADE_EMOJI: Record<string, string> = {
    'A': '🏆', 'A-': '🥇',
    'B+': '✅', 'B': '👍', 'B-': '🤔',
    'C+': '⚠️', 'C': '😬', 'C-': '📉',
    'D': '🚨', 'F': '💀',
};

type WebhookTarget = 'chief' | 'forex' | 'crypto';

const FX_CURRENCIES = ['EUR','GBP','USD','JPY','AUD','NZD','CAD','CHF','HKD','SGD','NOK','SEK'];
const CRYPTO_SYMBOLS = ['BTC','ETH','SOL','DOGE','ADA','XRP','BNB','AVAX','DOT','MATIC','LTC'];

function channelForSymbol(symbol: string): WebhookTarget {
    const s = symbol.replace(/[/_\-]/g, '').toUpperCase();
    // Crypto: starts with a known crypto ticker
    if (CRYPTO_SYMBOLS.some(c => s.startsWith(c))) return 'crypto';
    // FX: 6-char pair of two known currencies
    if (s.length === 6) {
        const base = s.slice(0, 3), quote = s.slice(3, 6);
        if (FX_CURRENCIES.includes(base) && FX_CURRENCIES.includes(quote)) return 'forex';
    }
    return 'chief';
}

function getWebhookUrl(target: WebhookTarget = 'chief'): string | null {
    const map: Record<WebhookTarget, string | undefined> = {
        chief:  process.env.DISCORD_CHIEF_WEBHOOK,
        forex:  process.env.DISCORD_FOREX_WEBHOOK,
        crypto: process.env.DISCORD_CRYPTO_WEBHOOK,
    };
    const url = map[target];
    // Fall back to chief if specific channel not configured
    return url && !url.includes('YOUR_WEBHOOK_TOKEN') ? url
        : (process.env.DISCORD_CHIEF_WEBHOOK || null);
}

async function sendEmbed(payload: object, target: WebhookTarget = 'chief'): Promise<void> {
    const url = getWebhookUrl(target);
    if (!url) {
        console.warn('[Discord] No webhook URL configured — skipping notification.');
        return;
    }

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const body = await res.text();
            console.error(`[Discord] Webhook error ${res.status}: ${body}`);
        }
    } catch (err) {
        console.error('[Discord] Failed to send notification:', err);
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Alert: TradingView signal received
 */
export async function notifySignalReceived(signal: {
    symbol: string;
    action: string;
    price: number;
    strategy: string;
}): Promise<void> {
    const isLong = ['BUY', 'LONG'].includes(signal.action.toUpperCase());
    const color = isLong ? 0x06B6D4 : 0xA855F7; // cyan for long, purple for short
    const arrow = isLong ? '📈' : '📉';

    await sendEmbed({
        embeds: [{
            title: `${arrow} Signal Received — ${signal.symbol}`,
            color,
            fields: [
                { name: 'Action',   value: `\`${signal.action.toUpperCase()}\``, inline: true },
                { name: 'Price',    value: `$${signal.price.toFixed(4)}`,          inline: true },
                { name: 'Strategy', value: signal.strategy,                         inline: true },
            ],
            footer: { text: 'SwjshAK · TradingView Webhook' },
            timestamp: new Date().toISOString(),
        }],
    }, channelForSymbol(signal.symbol));
}

/**
 * Alert: Order filled on broker (Alpaca or OANDA)
 */
export async function notifyTradeFilled(trade: {
    symbol: string;
    direction: 'LONG' | 'SHORT';
    fillPrice: number;
    qty: number;
    orderId: string;
    broker: string;
    strategy: string;
}): Promise<void> {
    const isLong = trade.direction === 'LONG';
    const color = isLong ? 0x10B981 : 0xEF4444; // green buy, red sell
    const emoji = isLong ? '🟢' : '🔴';

    await sendEmbed({
        embeds: [{
            title: `${emoji} ORDER FILLED — ${trade.symbol}`,
            color,
            description: `**${trade.direction}** position opened on **${trade.broker}**`,
            fields: [
                { name: 'Fill Price', value: `$${trade.fillPrice.toFixed(4)}`, inline: true },
                { name: 'Qty / Size', value: `${trade.qty}`,                    inline: true },
                { name: 'Order ID',   value: `\`${trade.orderId}\``,             inline: true },
                { name: 'Strategy',   value: trade.strategy,                      inline: true },
            ],
            footer: { text: `SwjshAK · ${trade.broker}` },
            timestamp: new Date().toISOString(),
        }],
    }, channelForSymbol(trade.symbol));
}

/**
 * Alert: Trade closed with PnL
 */
export async function notifyTradeClosed(trade: {
    symbol: string;
    direction: 'LONG' | 'SHORT';
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    status: 'WIN' | 'LOSS' | 'BE';
    strategy: string;
    broker: string;
    durationMinutes?: number;
}): Promise<void> {
    const isWin = trade.pnl >= 0;
    const color = isWin ? 0x10B981 : 0xEF4444;
    const emoji = isWin ? '💰' : '🛑';
    const pnlStr = `${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}`;
    const durationStr = trade.durationMinutes
        ? trade.durationMinutes < 60
            ? `${Math.round(trade.durationMinutes)}m`
            : `${(trade.durationMinutes / 60).toFixed(1)}h`
        : '—';

    await sendEmbed({
        embeds: [{
            title: `${emoji} TRADE CLOSED — ${trade.symbol}  ${pnlStr}`,
            color,
            fields: [
                { name: 'Result',    value: trade.status,                            inline: true },
                { name: 'PnL',       value: `**${pnlStr}**`,                         inline: true },
                { name: 'Duration',  value: durationStr,                              inline: true },
                { name: 'Entry',     value: `$${trade.entryPrice.toFixed(4)}`,        inline: true },
                { name: 'Exit',      value: `$${trade.exitPrice.toFixed(4)}`,         inline: true },
                { name: 'Strategy',  value: trade.strategy,                           inline: true },
            ],
            footer: { text: `SwjshAK · ${trade.broker}` },
            timestamp: new Date().toISOString(),
        }],
    }, channelForSymbol(trade.symbol));
}

/**
 * Professor Grade — sent after every trade close
 */
export async function notifyProfessorGrade(review: {
    target_agent: string;
    grade: string;
    observation: string;
    critique: string;
    action_item: string;
    symbol: string;
    pnl: number;
}): Promise<void> {
    const color = GRADE_COLORS[review.grade] ?? 0x94A3B8;
    const emoji = GRADE_EMOJI[review.grade] ?? '📋';
    const pnlStr = `${review.pnl >= 0 ? '+' : ''}$${review.pnl.toFixed(2)}`;

    await sendEmbed({
        embeds: [{
            title: `${emoji} The Professor grades ${review.target_agent} — **${review.grade}**`,
            color,
            description: `*"${review.critique}"*`,
            fields: [
                { name: '📊 Observation',  value: review.observation,   inline: false },
                { name: '✏️ Action Item',  value: review.action_item,   inline: false },
                { name: 'Symbol',          value: review.symbol,         inline: true  },
                { name: 'PnL',             value: pnlStr,                inline: true  },
            ],
            footer: { text: 'SwjshAK · The Professor' },
            timestamp: new Date().toISOString(),
        }],
    });
}

/**
 * System alert — errors, kill switch, startup
 */
export async function notifySystemAlert(message: string, level: 'info' | 'warn' | 'error' = 'info'): Promise<void> {
    const colorMap = { info: 0x06B6D4, warn: 0xF59E0B, error: 0xEF4444 };
    const emojiMap = { info: 'ℹ️', warn: '⚠️', error: '🚨' };

    await sendEmbed({
        embeds: [{
            title: `${emojiMap[level]} SwjshAK System — ${level.toUpperCase()}`,
            color: colorMap[level],
            description: message,
            footer: { text: 'SwjshAK · System Monitor' },
            timestamp: new Date().toISOString(),
        }],
    });
}

/**
 * Daily briefing summary
 */
/**
 * Intel Signal — fired when a new intel signal is published to the bus
 */
export async function notifyIntelSignal(intel: {
    source: string;
    symbol: string;
    direction: string;
    confidence: number;
    summary: string;
}): Promise<void> {
    const isBullish = intel.direction === 'BULLISH';
    const color = isBullish ? 0x10B981 : intel.direction === 'BEARISH' ? 0xEF4444 : 0x94A3B8;
    const arrow = isBullish ? '🟢' : intel.direction === 'BEARISH' ? '🔴' : '⚪';

    const sourceEmoji: Record<string, string> = {
        'ORDER_FLOW': '📊',
        'SENTIMENT': '📰',
        'ONCHAIN_CONFLUENCE': '🔗',
        'WHALE_FLOW': '🐳',
    };

    await sendEmbed({
        embeds: [{
            title: `${sourceEmoji[intel.source] || '🧠'} ${arrow} Intel: ${intel.symbol} — ${intel.direction}`,
            color,
            description: intel.summary,
            fields: [
                { name: 'Source',     value: intel.source.replace(/_/g, ' '), inline: true },
                { name: 'Confidence', value: `${(intel.confidence * 100).toFixed(0)}%`, inline: true },
            ],
            footer: { text: 'SwjshAK · Intelligence Bus' },
            timestamp: new Date().toISOString(),
        }],
    }, channelForSymbol(intel.symbol));
}

/**
 * Intel Decision — fired when executor uses intel to gate a trade
 */
export async function notifyIntelDecision(decision: {
    symbol: string;
    direction: string;
    decision: 'CONFIRMED' | 'REDUCED' | 'BLOCKED';
    reason: string;
    sizeMultiplier: number;
    intelScore?: any;
}): Promise<void> {
    const colorMap = { CONFIRMED: 0x10B981, REDUCED: 0xF59E0B, BLOCKED: 0xEF4444 };
    const emojiMap = { CONFIRMED: '✅', REDUCED: '⚠️', BLOCKED: '🛑' };

    const fields = [
        { name: 'Action',     value: `${decision.direction}`, inline: true },
        { name: 'Decision',   value: `${emojiMap[decision.decision]} ${decision.decision}`, inline: true },
        { name: 'Size Mult',  value: `${(decision.sizeMultiplier * 100).toFixed(0)}%`, inline: true },
    ];

    // Add breakdown if available
    if (decision.intelScore?.breakdown) {
        const breakdownStr = Object.entries(decision.intelScore.breakdown)
            .map(([src, data]: [string, any]) => `${src}: ${data.direction} (${(data.confidence * 100).toFixed(0)}%)`)
            .join('\n');
        if (breakdownStr) {
            fields.push({ name: 'Intel Breakdown', value: breakdownStr, inline: false });
        }
    }

    await sendEmbed({
        embeds: [{
            title: `🧠 Intel Gate — ${decision.symbol}`,
            color: colorMap[decision.decision],
            description: decision.reason,
            fields,
            footer: { text: 'SwjshAK · Risk Engine' },
            timestamp: new Date().toISOString(),
        }],
    }, channelForSymbol(decision.symbol));
}

/**
 * Daily briefing summary
 */
export async function notifyDailyBriefing(stats: {
    date: string;
    totalTrades: number;
    wins: number;
    losses: number;
    totalPnL: number;
    winRate: number;
    topSymbol?: string;
}): Promise<void> {
    const isGreen = stats.totalPnL >= 0;
    const pnlStr = `${isGreen ? '+' : ''}$${stats.totalPnL.toFixed(2)}`;

    await sendEmbed({
        embeds: [{
            title: `📅 Daily Briefing — ${stats.date}`,
            color: isGreen ? 0x10B981 : 0xEF4444,
            fields: [
                { name: 'Net PnL',    value: `**${pnlStr}**`,                    inline: true },
                { name: 'Win Rate',   value: `${stats.winRate}%`,                 inline: true },
                { name: 'Trades',     value: `${stats.wins}W / ${stats.losses}L`, inline: true },
                ...(stats.topSymbol ? [{ name: 'Top Symbol', value: stats.topSymbol, inline: true }] : []),
            ],
            footer: { text: 'SwjshAK · Daily Report' },
            timestamp: new Date().toISOString(),
        }],
    });
}
