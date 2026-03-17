// src/app/api/onboarding/legal/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/onboarding/legal - Accept legal documents
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const { acceptedTerms, acceptedWaiver } = body;

    if (!acceptedTerms || !acceptedWaiver) {
      return NextResponse.json(
        { error: 'You must accept both terms and waiver', code: 'ACCEPTANCE_REQUIRED' },
        { status: 400 }
      );
    }

    const ipAddress = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
    const userAgent = req.headers.get('user-agent') ?? undefined;

    // Record legal acceptances
    await prisma.$transaction([
      // Terms of Service
      prisma.legalAcceptance.create({
        data: {
          userId: user.id,
          documentType: 'TERMS_OF_SERVICE',
          documentVersion: '1.0',
          ipAddress,
          userAgent,
        },
      }),
      // Privacy Policy
      prisma.legalAcceptance.create({
        data: {
          userId: user.id,
          documentType: 'PRIVACY_POLICY',
          documentVersion: '1.0',
          ipAddress,
          userAgent,
        },
      }),
      // Trading Disclaimer
      prisma.legalAcceptance.create({
        data: {
          userId: user.id,
          documentType: 'TRADING_DISCLAIMER',
          documentVersion: '1.0',
          ipAddress,
          userAgent,
        },
      }),
      // Liability Waiver
      prisma.legalAcceptance.create({
        data: {
          userId: user.id,
          documentType: 'LIABILITY_WAIVER',
          documentVersion: '1.0',
          ipAddress,
          userAgent,
        },
      }),
      // Update user onboarding status
      prisma.user.update({
        where: { id: user.id },
        data: {
          onboardingStep: 'TERMS_ACCEPTED',
          acceptedTermsAt: new Date(),
          acceptedWaiverAt: new Date(),
        },
      }),
    ]);

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'legal.accept',
        resourceType: 'LegalAcceptance',
        status: 'SUCCESS',
        ipAddress,
        userAgent,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error('POST /api/onboarding/legal error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
