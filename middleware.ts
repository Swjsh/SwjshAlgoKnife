// middleware.ts (root level)
// Next.js Middleware for route protection with Firebase Auth

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/sign-in',
  '/sign-up',
  '/legal/terms',
  '/legal/privacy',
  '/api/auth/session',
  '/api/health',
  '/api/webhook/tradingview', // Webhooks authenticate via X-Webhook-Secret header, not session cookie
];

// Onboarding routes
const ONBOARDING_ROUTES = [
  '/onboarding/legal',
  '/onboarding/broker',
  '/onboarding/complete',
];

// API routes
const API_ROUTES_PREFIX = '/api/';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get('session');

  // No session - redirect to sign-in
  if (!sessionCookie) {
    if (pathname.startsWith(API_ROUTES_PREFIX)) {
      // API routes get 401
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // Pages redirect to sign-in
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // ── Onboarding enforcement ──
  // The unified NewUserOnboardingWrapper (rendered via Providers.tsx) handles
  // incomplete onboarding as an in-dashboard overlay. We no longer redirect
  // to separate /onboarding/* pages from middleware.
  //
  // However, we still block unauthenticated API access to sensitive routes
  // if the user hasn't completed legal acceptance. This is enforced per-route
  // in each API handler via requireUser() + onboardingStep checks.
  //
  // NOTE: If you need to enforce onboarding completion at the middleware level
  // for specific API routes, add checks here. The overlay wizard ensures UX
  // compliance; server-side route guards ensure security compliance.

  return NextResponse.next();
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, robots.txt, sitemap.xml (metadata files)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*$).*)',
  ],
};
