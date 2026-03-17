// ═══════════════════════════════════════════════════════════════
// CONNECTIONS API — Returns status of all external integrations
// Reads env vars server-side, returns masked credentials + status
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ── Helpers ──────────────────────────────────────────────────────

function mask(value: string | undefined, showChars = 4): string {
    if (!value || value.trim() === '' || value.startsWith('your_') || value.startsWith('YOUR_') || value === 'PLACEHOLDER') return '';
    if (value.length <= showChars * 2) return '•'.repeat(value.length);
    return value.slice(0, showChars) + '••••••••' + value.slice(-showChars);
}

function isConfigured(value: string | undefined): boolean {
    if (!value) return false;
    const v = value.trim();
    if (v === '') return false;
    if (v.startsWith('your_') || v.startsWith('YOUR_') || v === 'PLACEHOLDER') return false;
    if (v === 'undefined' || v === 'null') return false;
    return true;
}

// ── Connection definitions ────────────────────────────────────────

export interface Connection {
    id: string;
    name: string;
    category: string;
    description: string;
    status: 'CONNECTED' | 'PARTIAL' | 'NOT_CONFIGURED' | 'FREE'; // FREE = no key needed
    statusLabel: string;
    icon: string; // emoji
    credentials: {
        label: string;
        envVar: string;
        masked: string;
        configured: boolean;
    }[];
    docsUrl?: string;
    usedFor: string[];
    agents?: string[];
}

export async function GET() {
    const e = process.env;

    const connections: Connection[] = [
        // ── TRADING BROKERS ──────────────────────────────────────
        {
            id: 'alpaca',
            name: 'Alpaca',
            category: 'Trading',
            description: 'Paper trading for US equities, ETFs, and crypto via commission-free API.',
            icon: '🦙',
            docsUrl: 'https://alpaca.markets/docs/',
            usedFor: ['SPX agent', 'ES/NQ futures proxies via SPY/QQQ', 'Historical bar data', 'Live quotes'],
            agents: ['Pivot Pete', 'SPX Sniper'],
            credentials: [
                {
                    label: 'API Key ID',
                    envVar: 'APCA_API_KEY_ID',
                    masked: mask(e.APCA_API_KEY_ID),
                    configured: isConfigured(e.APCA_API_KEY_ID),
                },
                {
                    label: 'API Secret',
                    envVar: 'APCA_API_SECRET_KEY',
                    masked: mask(e.APCA_API_SECRET_KEY),
                    configured: isConfigured(e.APCA_API_SECRET_KEY),
                },
                {
                    label: 'Base URL',
                    envVar: 'APCA_API_BASE_URL',
                    masked: e.APCA_API_BASE_URL || 'https://paper-api.alpaca.markets',
                    configured: true,
                },
            ],
            status: 'NOT_CONFIGURED',
            statusLabel: '',
        },
        {
            id: 'oanda',
            name: 'OANDA',
            category: 'Trading',
            description: 'Forex demo/live account. Powers FX agent market data and order execution.',
            icon: '💱',
            docsUrl: 'https://developer.oanda.com/',
            usedFor: ['Forex data feeds', 'EUR/USD, GBP/USD, USD/JPY', 'Demo paper trading', 'Live candles via REST'],
            agents: ['Pivot Pete', 'Sterling FX'],
            credentials: [
                {
                    label: 'API Token',
                    envVar: 'OANDA_API_TOKEN',
                    masked: mask(e.OANDA_API_TOKEN),
                    configured: isConfigured(e.OANDA_API_TOKEN),
                },
                {
                    label: 'Account ID',
                    envVar: 'OANDA_ACCOUNT_ID',
                    masked: mask(e.OANDA_ACCOUNT_ID, 6),
                    configured: isConfigured(e.OANDA_ACCOUNT_ID),
                },
                {
                    label: 'Environment',
                    envVar: 'OANDA_ENVIRONMENT',
                    masked: e.OANDA_ENVIRONMENT || 'practice',
                    configured: true,
                },
            ],
            status: 'NOT_CONFIGURED',
            statusLabel: '',
        },
        {
            id: 'coinbase',
            name: 'Coinbase Advanced',
            category: 'Trading',
            description: 'Crypto exchange for live BTC, ETH, and altcoin trading.',
            icon: '🔷',
            docsUrl: 'https://docs.cdp.coinbase.com/advanced-trade/docs/',
            usedFor: ['Crypto spot orders', 'BTC/USD, ETH/USD execution', 'Live crypto data'],
            agents: ['Bitcoin Bob'],
            credentials: [
                {
                    label: 'API Key',
                    envVar: 'CRYPTO_API_KEY',
                    masked: mask(e.CRYPTO_API_KEY),
                    configured: isConfigured(e.CRYPTO_API_KEY),
                },
                {
                    label: 'API Secret',
                    envVar: 'CRYPTO_API_SECRET',
                    masked: mask(e.CRYPTO_API_SECRET),
                    configured: isConfigured(e.CRYPTO_API_SECRET),
                },
                {
                    label: 'Mode',
                    envVar: 'CRYPTO_TRADING_MODE',
                    masked: e.CRYPTO_TRADING_MODE || 'paper',
                    configured: true,
                },
            ],
            status: 'NOT_CONFIGURED',
            statusLabel: '',
        },

        // ── MARKET DATA ──────────────────────────────────────────
        {
            id: 'yahoo',
            name: 'Yahoo Finance',
            category: 'Market Data',
            description: 'Free historical OHLCV data for all asset classes. No API key required.',
            icon: '📊',
            docsUrl: 'https://pypi.org/project/yfinance/',
            usedFor: ['All Python agents', 'Historical candles (1m–1mo)', 'BTC-USD, ETH-USD, SPX, Forex pairs'],
            agents: ['All Python agents'],
            credentials: [],
            status: 'FREE',
            statusLabel: 'No key needed',
        },
        {
            id: 'finnhub',
            name: 'Finnhub',
            category: 'Market Data',
            description: 'Real-time WebSocket FX ticks and financial news. Free tier: 60 calls/min.',
            icon: '📡',
            docsUrl: 'https://finnhub.io/docs/api',
            usedFor: ['Forex real-time ticks', 'Market news feed', 'Sentiment sources'],
            agents: ['Sentiment Engine'],
            credentials: [
                {
                    label: 'API Key',
                    envVar: 'NEXT_PUBLIC_FINNHUB_KEY',
                    masked: mask(e.NEXT_PUBLIC_FINNHUB_KEY),
                    configured: isConfigured(e.NEXT_PUBLIC_FINNHUB_KEY),
                },
            ],
            status: 'NOT_CONFIGURED',
            statusLabel: '',
        },
        {
            id: 'coingecko',
            name: 'CoinGecko',
            category: 'Market Data',
            description: 'Free crypto prices for ETH, BTC, SOL. Used by On-Chain service for USD valuation.',
            icon: '🦎',
            docsUrl: 'https://www.coingecko.com/en/api',
            usedFor: ['Token USD prices', 'On-Chain whale value calculation', 'ETH/BTC/SOL spot price'],
            agents: ['On-Chain Service'],
            credentials: [],
            status: 'FREE',
            statusLabel: 'No key needed',
        },

        // ── INTELLIGENCE LAYER ───────────────────────────────────
        {
            id: 'cryptopanic',
            name: 'CryptoPanic',
            category: 'Intelligence',
            description: 'Aggregated crypto news and sentiment headlines. Powers Sentiment Engine.',
            icon: '📰',
            docsUrl: 'https://cryptopanic.com/developers/api/',
            usedFor: ['Crypto sentiment scoring', 'Headline analysis', 'News-driven signals'],
            agents: ['Sentiment Engine'],
            credentials: [
                {
                    label: 'API Key',
                    envVar: 'CRYPTOPANIC_API_KEY',
                    masked: mask(e.CRYPTOPANIC_API_KEY),
                    configured: isConfigured(e.CRYPTOPANIC_API_KEY),
                },
            ],
            status: 'NOT_CONFIGURED',
            statusLabel: '',
        },
        {
            id: 'feargreed',
            name: 'Alternative.me Fear & Greed',
            category: 'Intelligence',
            description: 'Crypto market sentiment index (0–100). Free, no auth required.',
            icon: '😱',
            docsUrl: 'https://alternative.me/crypto/fear-and-greed-index/',
            usedFor: ['Market regime detection', 'Sentiment scoring (BULLISH/BEARISH)', 'Intel Bus signals'],
            agents: ['Sentiment Engine'],
            credentials: [],
            status: 'FREE',
            statusLabel: 'No key needed',
        },
        {
            id: 'etherscan',
            name: 'Etherscan',
            category: 'Intelligence',
            description: 'Ethereum on-chain data. Tracks large wallets and whale ETH/stablecoin movements.',
            icon: '⛓️',
            docsUrl: 'https://docs.etherscan.io/',
            usedFor: ['Whale wallet tracking', 'ETH transaction history', 'ERC-20 stablecoin flows (USDT, USDC, DAI)'],
            agents: ['On-Chain Service', 'Whale Flow Tracker'],
            credentials: [
                {
                    label: 'API Key',
                    envVar: 'ETHERSCAN_API_KEY',
                    masked: mask(e.ETHERSCAN_API_KEY),
                    configured: isConfigured(e.ETHERSCAN_API_KEY),
                },
            ],
            status: 'NOT_CONFIGURED',
            statusLabel: '',
        },

        // ── NOTIFICATIONS ────────────────────────────────────────
        {
            id: 'discord_chief',
            name: 'Discord — Chief Channel',
            category: 'Notifications',
            description: 'Main trading alerts: signals, fills, professor grades, intel decisions.',
            icon: '📣',
            docsUrl: 'https://discord.com/developers/docs/resources/webhook',
            usedFor: ['Trade fill alerts', 'Intel score decisions', 'Daily briefings', 'System alerts'],
            credentials: [
                {
                    label: 'Webhook URL',
                    envVar: 'DISCORD_CHIEF_WEBHOOK',
                    masked: mask(e.DISCORD_CHIEF_WEBHOOK, 8),
                    configured: isConfigured(e.DISCORD_CHIEF_WEBHOOK),
                },
            ],
            status: 'NOT_CONFIGURED',
            statusLabel: '',
        },
        {
            id: 'discord_forex',
            name: 'Discord — Forex Channel',
            category: 'Notifications',
            description: 'Forex-specific alerts from the Sterling FX and Pivot Pete agents.',
            icon: '💬',
            usedFor: ['Forex signals', 'FX trade fills', 'Sterling agent alerts'],
            credentials: [
                {
                    label: 'Webhook URL',
                    envVar: 'DISCORD_FOREX_WEBHOOK',
                    masked: mask(e.DISCORD_FOREX_WEBHOOK, 8),
                    configured: isConfigured(e.DISCORD_FOREX_WEBHOOK),
                },
            ],
            status: 'NOT_CONFIGURED',
            statusLabel: '',
        },
        {
            id: 'discord_crypto',
            name: 'Discord — Crypto Channel',
            category: 'Notifications',
            description: 'Crypto-specific alerts from Bitcoin Bob and On-Chain whale events.',
            icon: '💬',
            usedFor: ['Crypto signals', 'Whale alerts', 'Bitcoin Bob fills'],
            credentials: [
                {
                    label: 'Webhook URL',
                    envVar: 'DISCORD_CRYPTO_WEBHOOK',
                    masked: mask(e.DISCORD_CRYPTO_WEBHOOK, 8),
                    configured: isConfigured(e.DISCORD_CRYPTO_WEBHOOK),
                },
            ],
            status: 'NOT_CONFIGURED',
            statusLabel: '',
        },

        // ── AUTH & DATABASE ──────────────────────────────────────
        {
            id: 'firebase',
            name: 'Firebase',
            category: 'Auth & Database',
            description: 'User authentication (email/password) and optional cloud data sync.',
            icon: '🔥',
            docsUrl: 'https://firebase.google.com/docs',
            usedFor: ['User login/logout', 'Session management', 'Cloud trade sync (optional)'],
            credentials: [
                {
                    label: 'API Key',
                    envVar: 'NEXT_PUBLIC_FIREBASE_API_KEY',
                    masked: mask(e.NEXT_PUBLIC_FIREBASE_API_KEY),
                    configured: isConfigured(e.NEXT_PUBLIC_FIREBASE_API_KEY),
                },
                {
                    label: 'Project ID',
                    envVar: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
                    masked: e.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
                    configured: isConfigured(e.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
                },
                {
                    label: 'Auth Domain',
                    envVar: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
                    masked: e.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
                    configured: isConfigured(e.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
                },
            ],
            status: 'NOT_CONFIGURED',
            statusLabel: '',
        },

        // ── INFRASTRUCTURE ───────────────────────────────────────
        {
            id: 'tradingview_webhook',
            name: 'TradingView Webhook',
            category: 'Infrastructure',
            description: 'Receives inbound alerts from TradingView Pine Script strategies via POST.',
            icon: '📈',
            docsUrl: 'https://www.tradingview.com/support/solutions/43000529348-about-webhooks/',
            usedFor: ['External signal ingestion', 'Strategy alert routing', 'Auto-trading triggers'],
            credentials: [
                {
                    label: 'Webhook Secret',
                    envVar: 'WEBHOOK_SECRET',
                    masked: mask(e.WEBHOOK_SECRET),
                    configured: isConfigured(e.WEBHOOK_SECRET),
                },
            ],
            status: 'NOT_CONFIGURED',
            statusLabel: '',
        },
        {
            id: 'sqlite',
            name: 'SQLite (Local DB)',
            category: 'Infrastructure',
            description: 'Local embedded database. Stores all trades, signals, intel, journal entries.',
            icon: '🗄️',
            usedFor: ['Trade records', 'Signal history', 'Intel signals', 'Journal entries', 'Agent settings'],
            credentials: [],
            status: 'FREE',
            statusLabel: 'Local · No config',
        },
        {
            id: 'risk_config',
            name: 'Risk Configuration',
            category: 'Infrastructure',
            description: 'Core trading risk parameters. Controls position sizing across all agents.',
            icon: '⚖️',
            usedFor: ['Position size calculation', 'Max risk per trade', 'Account equity baseline'],
            credentials: [
                {
                    label: 'Account Balance',
                    envVar: 'ACCOUNT_BALANCE',
                    masked: e.ACCOUNT_BALANCE ? `$${Number(e.ACCOUNT_BALANCE).toLocaleString()}` : '$10,000 (default)',
                    configured: true,
                },
                {
                    label: 'Risk Per Trade',
                    envVar: 'RISK_PER_TRADE',
                    masked: e.RISK_PER_TRADE ? `${e.RISK_PER_TRADE}%` : '1% (default)',
                    configured: true,
                },
            ],
            status: 'FREE',
            statusLabel: 'Configured',
        },
    ];

    // ── Compute status for each connection ─────────────────────
    for (const conn of connections) {
        if (conn.status === 'FREE') continue;

        const creds = conn.credentials.filter(c => c.envVar !== 'OANDA_ENVIRONMENT' && c.envVar !== 'CRYPTO_TRADING_MODE' && c.envVar !== 'APCA_API_BASE_URL');
        if (creds.length === 0) {
            conn.status = 'FREE';
            conn.statusLabel = 'No key needed';
            continue;
        }

        const configuredCount = creds.filter(c => c.configured).length;
        if (configuredCount === creds.length) {
            conn.status = 'CONNECTED';
            conn.statusLabel = 'Configured';
        } else if (configuredCount > 0) {
            conn.status = 'PARTIAL';
            conn.statusLabel = `${configuredCount}/${creds.length} keys set`;
        } else {
            conn.status = 'NOT_CONFIGURED';
            conn.statusLabel = 'Not configured';
        }
    }

    // ── Summary stats ──────────────────────────────────────────
    const total = connections.length;
    const connected = connections.filter(c => c.status === 'CONNECTED' || c.status === 'FREE').length;
    const partial = connections.filter(c => c.status === 'PARTIAL').length;
    const missing = connections.filter(c => c.status === 'NOT_CONFIGURED').length;

    const byCategory: Record<string, Connection[]> = {};
    for (const conn of connections) {
        if (!byCategory[conn.category]) byCategory[conn.category] = [];
        byCategory[conn.category].push(conn);
    }

    return NextResponse.json({
        connections,
        byCategory,
        summary: { total, connected, partial, missing },
        generatedAt: new Date().toISOString(),
    });
}
