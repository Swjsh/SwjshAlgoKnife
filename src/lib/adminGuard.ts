import { admin } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * List of authorized admin emails
 */
export const ADMIN_EMAILS = ['jack.watergun@gmail.com'];

/**
 * Check if an email is an admin
 */
export function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email);
}

/**
 * Server-side admin guard for API routes.
 * Verifies the session cookie, decodes the Firebase token, and checks admin status.
 * Returns a NextResponse with 403 if not admin.
 */
export async function requireAdmin(request: NextRequest): Promise<{ authorized: boolean; error?: NextResponse }> {
  try {
    // Get the session cookie
    const sessionCookie = request.cookies.get('__session')?.value;

    if (!sessionCookie) {
      return {
        authorized: false,
        error: NextResponse.json({ error: 'Unauthorized: No session cookie' }, { status: 401 })
      };
    }

    // Verify the session cookie
    const decodedToken = await admin.auth().verifySessionCookie(sessionCookie, true);
    const email = decodedToken.email;

    if (!email) {
      return {
        authorized: false,
        error: NextResponse.json({ error: 'Unauthorized: No email in token' }, { status: 401 })
      };
    }

    // Check if user is admin
    if (!isAdmin(email)) {
      return {
        authorized: false,
        error: NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
      };
    }

    return { authorized: true };
  } catch (error) {
    console.error('[adminGuard] Error verifying admin status:', error);
    return {
      authorized: false,
      error: NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 })
    };
  }
}
