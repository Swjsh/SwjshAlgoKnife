// src/lib/auth.ts
// Firebase Authentication helpers for server-side

import { auth as firebaseAdminAuth } from 'firebase-admin';
import { cookies, headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { User } from '@prisma/client';

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Get Firebase ID token from request headers or cookies
 */
async function getIdToken(): Promise<string | null> {
  const headersList = await headers();

  // Check Authorization header first (for API calls)
  const authHeader = headersList.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookie (for browser requests)
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');
  if (sessionCookie?.value) {
    return sessionCookie.value;
  }

  return null;
}

/**
 * Verify Firebase ID token and return the decoded token
 */
async function verifyIdToken(token: string) {
  try {
    const decodedToken = await firebaseAdminAuth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Token verification failed:', error);
    throw new AuthError('Invalid or expired token', 'INVALID_TOKEN', 401);
  }
}

/**
 * Get the current authenticated user from the database.
 * Throws if not authenticated or user not found.
 */
export async function requireUser(): Promise<User> {
  const token = await getIdToken();

  if (!token) {
    throw new AuthError('Authentication required', 'AUTH_REQUIRED', 401);
  }

  const decodedToken = await verifyIdToken(token);
  const firebaseUid = decodedToken.uid;

  // Find or create user in our database
  let user = await prisma.user.findUnique({
    where: { externalId: firebaseUid },
  });

  if (!user) {
    // Auto-create user on first authentication
    user = await prisma.user.create({
      data: {
        externalId: firebaseUid,
        email: decodedToken.email ?? '',
        displayName: decodedToken.name ?? null,
        avatarUrl: decodedToken.picture ?? null,
        onboardingStep: 'CREATED',
      },
    });
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return user;
}

/**
 * Get the current user without throwing (returns null if not authenticated)
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    return await requireUser();
  } catch (error) {
    if (error instanceof AuthError) {
      return null;
    }
    throw error;
  }
}

/**
 * Verify user owns a resource before allowing access.
 */
export async function requireOwnership(
  resourceUserId: string,
  currentUserId: string
): Promise<void> {
  if (resourceUserId !== currentUserId) {
    throw new AuthError(
      'You do not have permission to access this resource',
      'FORBIDDEN',
      403
    );
  }
}

/**
 * Get Firebase UID from request (for logging/debugging)
 */
export async function getFirebaseUid(): Promise<string | null> {
  const token = await getIdToken();
  if (!token) return null;

  try {
    const decodedToken = await verifyIdToken(token);
    return decodedToken.uid;
  } catch {
    return null;
  }
}
