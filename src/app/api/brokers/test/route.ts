// src/app/api/brokers/test/route.ts
// Test broker credentials without saving - preview mode
// Cost-conscious: Single API call to broker, no DB operations

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { brokerLimiter } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
    try {
        const user = await requireUser();

        // Rate limit: prevent credential brute-force / abuse
        const { allowed, retryAfter } = brokerLimiter.check(user.id);
        if (!allowed) {
            return NextResponse.json(
                { error: 'Too many test requests. Please wait before trying again.' },
                { status: 429, headers: { 'Retry-After': String(retryAfter) } }
            );
        }

        const { broker, environment, apiKey, apiSecret } = await req.json();

        if (!broker || !environment || !apiKey || !apiSecret) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        if (broker === 'ALPACA') {
            const baseUrl = environment === 'PAPER'
                ? 'https://paper-api.alpaca.markets'
                : 'https://api.alpaca.markets';

            const response = await fetch(`${baseUrl}/v2/account`, {
                headers: {
                    'APCA-API-KEY-ID': apiKey,
                    'APCA-API-SECRET-KEY': apiSecret,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = 'Connection failed';

                if (response.status === 401) {
                    errorMessage = 'Invalid API key or secret';
                } else if (response.status === 403) {
                    errorMessage = 'API keys lack trading permissions';
                }

                return NextResponse.json({
                    success: false,
                    error: errorMessage,
                    details: errorText.substring(0, 200),
                });
            }

            const account = await response.json();

            return NextResponse.json({
                success: true,
                account: {
                    id: account.id,
                    accountNumber: account.account_number,
                    status: account.status,
                    currency: account.currency,
                    cash: parseFloat(account.cash),
                    buyingPower: parseFloat(account.buying_power),
                    equity: parseFloat(account.equity),
                    portfolioValue: parseFloat(account.portfolio_value),
                    patternDayTrader: account.pattern_day_trader,
                    tradingBlocked: account.trading_blocked,
                    accountBlocked: account.account_blocked,
                    createdAt: account.created_at,
                },
            });
        }

        return NextResponse.json(
            { error: 'Unsupported broker' },
            { status: 400 }
        );
    } catch (error: any) {
        console.error('POST /api/brokers/test error:', error);
        return NextResponse.json(
            { error: 'Failed to test connection', details: error.message },
            { status: 500 }
        );
    }
}
