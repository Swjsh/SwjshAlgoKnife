// src/lib/api-utils.ts
// Shared API route utilities — authentication, error handling, rate limiting, validation

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireUser, AuthError } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { User } from '@prisma/client';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApiHandlerOptions {
  /** Require authentication (returns 401 if not authenticated) */
  requireAuth?: boolean;
  /** Maximum request body size in bytes (default: 1MB) */
  maxBodySize?: number;
  /** Rate limit: max requests per window */
  rateLimit?: { max: number; windowSeconds: number };
  /** Require admin role (future-proofing) */
  requireAdmin?: boolean;
}

interface ApiContext {
  user: User | null;
  req: NextRequest;
}

type ApiHandler = (ctx: ApiContext) => Promise<NextResponse>;

// ─── In-memory Rate Limiter ─────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

function checkRateLimit(
  identifier: string,
  max: number,
  windowSeconds: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const key = identifier;
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowSeconds * 1000;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: max - 1, resetAt };
  }

  entry.count++;
  const remaining = Math.max(0, max - entry.count);
  return { allowed: entry.count <= max, remaining, resetAt: entry.resetAt };
}

// ─── Request Size Validation ────────────────────────────────────────────────

function checkRequestSize(req: NextRequest, maxBytes: number): boolean {
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > maxBytes) {
    return false;
  }
  return true;
}

// ─── Structured Logger ──────────────────────────────────────────────────────

export function apiLog(
  level: 'info' | 'warn' | 'error',
  route: string,
  message: string,
  meta?: Record<string, unknown>
) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    route,
    message,
    ...meta,
  };

  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

// ─── Query Parameter Helpers ────────────────────────────────────────────────

export function parseLimit(searchParams: URLSearchParams, defaultLimit = 50, maxLimit = 500): number {
  return Math.min(Math.max(parseInt(searchParams.get('limit') || String(defaultLimit)), 1), maxLimit);
}

export function parseOffset(searchParams: URLSearchParams): number {
  return Math.max(parseInt(searchParams.get('offset') || '0'), 0);
}

// ─── CORS Headers ───────────────────────────────────────────────────────────

function addCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

// ─── Cache Headers ──────────────────────────────────────────────────────────

export function withCacheHeaders(
  response: NextResponse,
  maxAgeSeconds: number = 0,
  isPublic: boolean = false
): NextResponse {
  if (maxAgeSeconds > 0) {
    response.headers.set(
      'Cache-Control',
      `${isPublic ? 'public' : 'private'}, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 2}`
    );
  } else {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
  return response;
}

// ─── Main API Handler Wrapper ───────────────────────────────────────────────

/**
 * Wraps an API handler with authentication, rate limiting, error handling,
 * and request validation. Eliminates boilerplate from route files.
 *
 * @example
 * export const GET = withApiHandler({ requireAuth: true, rateLimit: { max: 60, windowSeconds: 60 } },
 *   async ({ user, req }) => {
 *     const data = await prisma.trade.findMany({ where: { userId: user!.id } });
 *     return NextResponse.json(data);
 *   }
 * );
 */
export function withApiHandler(
  options: ApiHandlerOptions,
  handler: ApiHandler
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    try {
      // 1. Request size check
      const maxBodySize = options.maxBodySize ?? 1_048_576; // 1MB default
      if (!checkRequestSize(req, maxBodySize)) {
        return addCorsHeaders(
          NextResponse.json({ error: 'Request body too large' }, { status: 413 })
        );
      }

      // 2. Rate limiting
      if (options.rateLimit) {
        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          || req.headers.get('x-real-ip')
          || 'unknown';
        const routeKey = `${req.method}:${new URL(req.url).pathname}:${clientIp}`;

        const { allowed, remaining, resetAt } = checkRateLimit(
          routeKey,
          options.rateLimit.max,
          options.rateLimit.windowSeconds
        );

        if (!allowed) {
          const response = NextResponse.json(
            { error: 'Rate limit exceeded. Please try again later.' },
            { status: 429 }
          );
          response.headers.set('Retry-After', String(Math.ceil((resetAt - Date.now()) / 1000)));
          response.headers.set('X-RateLimit-Limit', String(options.rateLimit.max));
          response.headers.set('X-RateLimit-Remaining', '0');
          return addCorsHeaders(response);
        }
      }

      // 3. Authentication
      let user: User | null = null;
      if (options.requireAuth) {
        try {
          user = await requireUser();
        } catch (error) {
          if (error instanceof AuthError) {
            return addCorsHeaders(
              NextResponse.json(
                { error: error.message, code: error.code },
                { status: error.status }
              )
            );
          }
          throw error;
        }
      } else {
        user = await getCurrentUser();
      }

      // 4. Execute handler
      const response = await handler({ user, req });
      return addCorsHeaders(response);

    } catch (error) {
      // Structured error logging
      if (error instanceof AuthError) {
        return addCorsHeaders(
          NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.status }
          )
        );
      }

      const routePath = new URL(req.url).pathname;
      apiLog('error', routePath, 'Unhandled API error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        method: req.method,
      });

      return addCorsHeaders(
        NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      );
    }
  };
}

// ─── Audit Logging Helper ───────────────────────────────────────────────────

export async function auditLog(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string | null,
  status: 'SUCCESS' | 'FAILURE' | 'DENIED',
  req?: NextRequest,
  metadata?: Record<string, unknown>
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        resourceType,
        resourceId,
        status,
        ipAddress: req?.headers.get('x-forwarded-for') || req?.headers.get('x-real-ip') || null,
        userAgent: req?.headers.get('user-agent') || null,
        metadata: (metadata || {}) as object,
      },
    });
  } catch (err) {
    apiLog('error', 'auditLog', 'Failed to write audit log', {
      action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
