// src/app/api/brokers/[id]/verify/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireUser, requireOwnership, AuthError } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/encryption';

/**
 * POST /api/brokers/[id]/verify - Verify broker API credentials
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const brokerConfig = await prisma.brokerConfig.findUnique({
      where: { id },
    });

    if (!brokerConfig) {
      return NextResponse.json(
        { error: 'Broker configuration not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    await requireOwnership(brokerConfig.userId, user.id);

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

    // Test connection based on broker type
    let accountInfo: { id: string; type: string; buyingPower: number } | null = null;

    if (brokerConfig.broker === 'ALPACA') {
      const baseUrl =
        brokerConfig.environment === 'PAPER'
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

        // Update broker config with failure
        await prisma.brokerConfig.update({
          where: { id: id },
          data: {
            connectionStatus: 'FAILED',
            lastErrorMessage: `API Error: ${response.status} - ${errorText.substring(0, 200)}`,
          },
        });

        // Audit log
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'broker.verify',
            resourceType: 'BrokerConfig',
            resourceId: id,
            status: 'FAILURE',
            errorMessage: `HTTP ${response.status}`,
          },
        });

        return NextResponse.json(
          {
            error: 'Invalid API credentials or account not accessible',
            code: 'BROKER_AUTH_FAILED',
            details:
              response.status === 403
                ? 'Check that your API keys have trading permissions enabled in Alpaca dashboard'
                : response.status === 401
                ? 'Invalid API key or secret. Please verify your credentials.'
                : undefined,
          },
          { status: 400 }
        );
      }

      const account = await response.json();
      accountInfo = {
        id: account.id,
        type: account.account_type || 'unknown',
        buyingPower: parseFloat(account.buying_power) || 0,
      };
    } else {
      // Other brokers not yet supported
      return NextResponse.json(
        { error: 'Broker not yet supported', code: 'UNSUPPORTED_BROKER' },
        { status: 400 }
      );
    }

    // Update broker config with verified status
    const updated = await prisma.brokerConfig.update({
      where: { id: id },
      data: {
        connectionStatus: 'CONNECTED',
        lastVerifiedAt: new Date(),
        lastErrorMessage: null,
        accountId: accountInfo?.id,
        accountType: accountInfo?.type,
        buyingPower: accountInfo?.buyingPower,
      },
    });

    // Update user onboarding status
    if (user.onboardingStep !== 'COMPLETED' && user.onboardingStep !== 'BROKER_CONNECTED') {
      await prisma.user.update({
        where: { id: user.id },
        data: { onboardingStep: 'BROKER_CONNECTED' },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'broker.verify',
        resourceType: 'BrokerConfig',
        resourceId: id,
        status: 'SUCCESS',
        metadata: {
          broker: brokerConfig.broker,
          environment: brokerConfig.environment,
          accountId: accountInfo?.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      broker: {
        id: updated.id,
        connectionStatus: updated.connectionStatus,
        accountId: updated.accountId,
        accountType: updated.accountType,
        buyingPower: updated.buyingPower?.toString(),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error('Broker verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify broker connection', code: 'VERIFICATION_FAILED' },
      { status: 500 }
    );
  }
}
