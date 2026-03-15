// src/app/api/brokers/[id]/health/route.ts
// Broker health check - pings broker API, returns balance and status
// Cost-conscious: Only called on-demand, no polling service needed

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/encryption';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireUser();
        const { id } = await params;

        const brokerConfig = await prisma.brokerConfig.findUnique({
            where: { id },
        });

        if (!brokerConfig || brokerConfig.userId !== user.id) {
            return NextResponse.json(
                { error: 'Broker not found' },
                { status: 404 }
            );
        }

        // Decrypt credentials
        const [keyIv, keyTag, secretIv, secretTag] = brokerConfig.encryptionIv.split(':');
        const apiKey = decryptSecret({
            encrypted: brokerConfig.apiKeyEncrypted,
            iv: keyIv,
            authTag: keyTag,
        });
        const apiSecret = decryptSecret({
            encrypted: brokerConfig.apiSecretEncrypted,
            iv: secretIv,
            authTag: secretTag,
        });

        // Check broker health based on type
        let health: {
            connected: boolean;
            balance?: number;
            buyingPower?: number;
            equity?: number;
            dayPnl?: number;
            lastChecked: string;
            error?: string;
        } = {
            connected: false,
            lastChecked: new Date().toISOString(),
        };

        if (brokerConfig.broker === 'ALPACA') {
            const baseUrl = brokerConfig.environment === 'PAPER'
                ? 'https://paper-api.alpaca.markets'
                : 'https://api.alpaca.markets';

            try {
                const response = await fetch(`${baseUrl}/v2/account`, {
                    headers: {
                        'APCA-API-KEY-ID': apiKey,
                        'APCA-API-SECRET-KEY': apiSecret,
                    },
                });

                if (response.ok) {
                    const account = await response.json();
                    health = {
                        connected: true,
                        balance: parseFloat(account.cash) || 0,
                        buyingPower: parseFloat(account.buying_power) || 0,
                        equity: parseFloat(account.equity) || 0,
                        dayPnl: parseFloat(account.equity) - parseFloat(account.last_equity) || 0,
                        lastChecked: new Date().toISOString(),
                    };

                    // Update broker config with latest info
                    await prisma.brokerConfig.update({
                        where: { id },
                        data: {
                            connectionStatus: 'CONNECTED',
                            lastVerifiedAt: new Date(),
                            buyingPower: health.buyingPower,
                            lastErrorMessage: null,
                        },
                    });
                } else {
                    const errorText = await response.text();
                    health.error = `API Error: ${response.status}`;

                    // Update status to failed
                    await prisma.brokerConfig.update({
                        where: { id },
                        data: {
                            connectionStatus: 'FAILED',
                            lastErrorMessage: errorText.substring(0, 200),
                        },
                    });
                }
            } catch (error: any) {
                health.error = error.message;
                await prisma.brokerConfig.update({
                    where: { id },
                    data: {
                        connectionStatus: 'FAILED',
                        lastErrorMessage: error.message.substring(0, 200),
                    },
                });
            }
        }

        return NextResponse.json({ health });
    } catch (error) {
        console.error('GET /api/brokers/[id]/health error:', error);
        return NextResponse.json(
            { error: 'Failed to check broker health' },
            { status: 500 }
        );
    }
}
