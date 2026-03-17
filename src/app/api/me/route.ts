// src/app/api/me/route.ts
// Get current authenticated user

import { NextResponse } from 'next/server';
import { requireUser, getCurrentUser, AuthError } from '@/lib/auth';

/**
 * GET /api/me - Get current user info
 */
export async function GET() {
  try {
    const user = await requireUser();

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        onboardingStep: user.onboardingStep,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error('GET /api/me error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/me - Update current user
 */
export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const { displayName, avatarUrl } = body;

    const prisma = (await import('@/lib/prisma')).prisma;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        avatarUrl: updated.avatarUrl,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error('PATCH /api/me error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
