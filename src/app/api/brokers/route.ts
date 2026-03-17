// src/app/api/brokers/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptSecret } from '@/lib/encryption';
import { brokerLimiter } from '@/lib/rateLimit';
import { z } from 'zod';

const CreateBrokerSchema = z.object({
  broker: z.enum(['ALPACA', 'WEBULL', 'ROBINHOOD', 'FIDELITY']),
  environment: z.enum(['PAPER', 'LIVE']),
  label: z.string().min(1).max(50),
  apiKey: z.string().min(10),
  apiSecret: z.string().min(10),
});

/**
 * GET /api/brokers - List user's broker configurations
 */
export async function GET() {
  try {
    const user = await requireUser();

    const brokers = await prisma.brokerConfig.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        broker: true,
        environment: true,
        label: true,
        isPrimary: true,
        isActive: true,
        connectionStatus: true,
        lastVerifiedAt: true,
        lastErrorMessage: true,
        accountId: true,
        accountType: true,
        buyingPower: true,
        createdAt: true,
        updatedAt: true,
        // Note: Never return encrypted credentials
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ brokers });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error('GET /api/brokers error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/brokers - Create new broker configuration
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    // Rate limit: 10 broker operations per minute per user
    const { allowed, retryAfter } = brokerLimiter.check(user.id);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const body = await req.json();

    // Validate input
    const data = CreateBrokerSchema.parse(body);

    // Encrypt credentials before storage
    const keyEncrypted = encryptSecret(data.apiKey);
    const secretEncrypted = encryptSecret(data.apiSecret);

    // Check for duplicate
    const existing = await prisma.brokerConfig.findFirst({
      where: {
        userId: user.id,
        broker: data.broker,
        environment: data.environment,
        label: data.label,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Broker configuration with this label already exists', code: 'DUPLICATE' },
        { status: 409 }
      );
    }

    // Create broker config
    const brokerConfig = await prisma.brokerConfig.create({
      data: {
        userId: user.id,
        broker: data.broker,
        environment: data.environment,
        label: data.label,
        apiKeyEncrypted: keyEncrypted.encrypted,
        apiSecretEncrypted: secretEncrypted.encrypted,
        encryptionIv: `${keyEncrypted.iv}:${keyEncrypted.authTag}:${secretEncrypted.iv}:${secretEncrypted.authTag}`,
        connectionStatus: 'PENDING',
      },
      select: {
        id: true,
        broker: true,
        environment: true,
        label: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'broker.create',
        resourceType: 'BrokerConfig',
        resourceId: brokerConfig.id,
        status: 'SUCCESS',
        ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
        userAgent: req.headers.get('user-agent'),
      },
    });

    return NextResponse.json({ broker: brokerConfig }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.issues,
        },
        { status: 400 }
      );
    }
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error('POST /api/brokers error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
