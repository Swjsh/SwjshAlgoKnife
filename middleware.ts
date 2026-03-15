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

  // For authenticated users, check onboarding status on non-onboarding, non-API routes
  if (
    !pathname.startsWith(API_ROUTES_PREFIX) &&
    !ONBOARDING_ROUTES.some(route => pathname.startsWith(route))
  ) {
    try {
      // Check user's onboarding status
      const response = await fetch(new URL('/api/me', request.url), {
        headers: {
          Cookie: request.headers.get('cookie') || '',
        },
      });

      if (response.ok) {
        const { user } = await response.json();

        // Redirect incomplete users to appropriate onboarding step
        if (user.onboardingStep !== 'COMPLETED' && user.onboardingStep !== 'BROKER_CONNECTED') {
          const redirectMap: Record<string, string> = {
            CREATED: '/onboarding/legal',
            EMAIL_VERIFIED: '/onboarding/legal',
            TERMS_ACCEPTED: '/onboarding/broker',
          };

          const redirectTo = redirectMap[user.onboardingStep];
          if (redirectTo && pathname !== redirectTo) {
            return NextResponse.redirect(new URL(redirectTo, request.url));
          }
        }
      }
    } catch (error) {
      console.error('Middleware onboarding check failed:', error);
      // Continue on error - don't block the request
    }
  }

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
