// src/app/api/auth/session/route.ts
// Manages Firebase session cookies

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'session';
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

/**
 * POST - Create session cookie from Firebase ID token
 */
export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { error: 'Invalid token', code: 'INVALID_TOKEN' },
        { status: 400 }
      );
    }

    // Store ID token in HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: MAX_AGE,
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create session', code: 'SESSION_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Clear session cookie (sign out)
 */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);

  return NextResponse.json({ success: true });
}
