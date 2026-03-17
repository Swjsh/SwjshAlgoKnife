/**
 * In-memory rate limiter for API routes.
 *
 * Provides per-key (IP or user ID) sliding-window rate limiting.
 * For production at scale, replace with Redis-backed rate limiting.
 *
 * Usage:
 *   import { createRateLimiter } from '@/lib/rateLimit';
 *   const limiter = createRateLimiter({ max: 10, windowSeconds: 60 });
 *
 *   // In your route handler:
 *   const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
 *   const { allowed, remaining, retryAfter } = limiter.check(ip);
 *   if (!allowed) {
 *     return NextResponse.json({ error: 'Too many requests' }, {
 *       status: 429,
 *       headers: { 'Retry-After': String(retryAfter) },
 *     });
 *   }
 */

interface RateLimitEntry {
    timestamps: number[];
}

interface RateLimiterConfig {
    /** Maximum requests allowed within the window */
    max: number;
    /** Window size in seconds */
    windowSeconds: number;
    /** How often to clean up expired entries (seconds). Default: 300 */
    cleanupIntervalSeconds?: number;
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfter: number; // seconds until next allowed request (0 if allowed)
}

export function createRateLimiter(config: RateLimiterConfig) {
    const { max, windowSeconds, cleanupIntervalSeconds = 300 } = config;
    const store = new Map<string, RateLimitEntry>();

    // Periodic cleanup of expired entries
    const cleanupTimer = setInterval(() => {
        const now = Date.now();
        const windowMs = windowSeconds * 1000;
        for (const [key, entry] of store) {
            entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
            if (entry.timestamps.length === 0) {
                store.delete(key);
            }
        }
    }, cleanupIntervalSeconds * 1000);

    // Allow cleanup timer to not prevent process exit
    if (cleanupTimer.unref) {
        cleanupTimer.unref();
    }

    return {
        check(key: string): RateLimitResult {
            const now = Date.now();
            const windowMs = windowSeconds * 1000;

            let entry = store.get(key);
            if (!entry) {
                entry = { timestamps: [] };
                store.set(key, entry);
            }

            // Remove expired timestamps
            entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

            if (entry.timestamps.length >= max) {
                const oldestInWindow = entry.timestamps[0];
                const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);
                return {
                    allowed: false,
                    remaining: 0,
                    retryAfter: Math.max(retryAfter, 1),
                };
            }

            entry.timestamps.push(now);
            return {
                allowed: true,
                remaining: max - entry.timestamps.length,
                retryAfter: 0,
            };
        },

        /** Reset a specific key (useful for testing) */
        reset(key: string): void {
            store.delete(key);
        },

        /** Clear all entries */
        clear(): void {
            store.clear();
        },
    };
}

/* ─── Pre-configured limiters for common use cases ─── */

/** Broker operations: 10 requests per minute per user */
export const brokerLimiter = createRateLimiter({ max: 10, windowSeconds: 60 });

/** Control API: 30 requests per minute per IP */
export const controlLimiter = createRateLimiter({ max: 30, windowSeconds: 60 });

/** Auth/onboarding: 5 requests per minute per IP (prevents brute force) */
export const authLimiter = createRateLimiter({ max: 5, windowSeconds: 60 });

/** General API: 60 requests per minute per user */
export const generalLimiter = createRateLimiter({ max: 60, windowSeconds: 60 });
