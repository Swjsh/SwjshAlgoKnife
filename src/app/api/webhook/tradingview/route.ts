import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { TradeExecutor } from '@/lib/engine/executor';
import { Signal } from '@/lib/engine/types';

// Webhook secret for authentication (REQUIRED in production)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Hard-fail in production if webhook secret is missing
if (IS_PRODUCTION && !WEBHOOK_SECRET) {
  console.error(
    'CRITICAL: WEBHOOK_SECRET is missing in production. Webhook route will return 500.'
  );
}

// Input validation schema
const WebhookPayloadSchema = z.object({
  // Security: Strict regex validation to prevent injection attacks
  symbol: z.string().min(1).max(20).regex(/^[A-Z0-9_/=-]{1,20}$/i, {
    message: 'Symbol must contain only alphanumeric characters, underscores, slashes, equals, or hyphens',
  }),
  action: z.string().min(1).max(10).regex(/^[A-Z]+$/i, {
    message: 'Action must contain only letters',
  }),
  price: z.number().positive(),
  strategy: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
  // Multi-tenant fields
  userId: z.string().optional(), // Direct user ID
  botId: z.string().optional(), // Bot to attribute signal to
  webhookKey: z.string().optional(), // User-specific webhook key
});

// ─── In-Memory Rate Limiter ─────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const webhookRateLimitStore = new Map<string, RateLimitEntry>();

function checkWebhookRateLimit(
  clientIp: string,
  max: number = 30,
  windowSeconds: number = 60
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const key = `webhook:${clientIp}`;
  const entry = webhookRateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowSeconds * 1000;
    webhookRateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: max - 1, resetAt };
  }

  entry.count++;
  const remaining = Math.max(0, max - entry.count);
  return { allowed: entry.count <= max, remaining, resetAt: entry.resetAt };
}

// Cleanup stale rate limit entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of webhookRateLimitStore) {
    if (now > entry.resetAt) {
      webhookRateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

async function findUserFromWebhook(
  payload: any,
  authHeader: string | null
): Promise<{ userId: string; botId?: string } | null> {
  // 1. Check for explicit userId in payload
  if (payload.userId) {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (user) {
      return { userId: user.id, botId: payload.botId };
    }
  }

  // 2. Check for botId and look up user
  if (payload.botId) {
    const bot = await prisma.bot.findUnique({
      where: { id: payload.botId },
      include: { user: true },
    });
    if (bot) {
      return { userId: bot.userId, botId: bot.id };
    }
  }

  // 3. If global webhook secret matches (timing-safe comparison), look for default user
  if (WEBHOOK_SECRET) {
    let secretMatches = false;
    try {
      if (authHeader === `Bearer ${WEBHOOK_SECRET}`) {
        secretMatches = crypto.timingSafeEqual(
          Buffer.from(authHeader),
          Buffer.from(`Bearer ${WEBHOOK_SECRET}`)
        );
      } else if (authHeader === WEBHOOK_SECRET) {
        secretMatches = crypto.timingSafeEqual(
          Buffer.from(authHeader),
          Buffer.from(WEBHOOK_SECRET)
        );
      }
    } catch {
      // timingSafeEqual throws on buffer length mismatch; treat as no match
      secretMatches = false;
    }

    if (secretMatches) {
      // Find the first user as the default (for backward compatibility)
      const firstUser = await prisma.user.findFirst({
        where: {
          onboardingStep: { in: ['BROKER_CONNECTED', 'COMPLETED'] },
        },
        orderBy: { createdAt: 'asc' },
      });
      if (firstUser) {
        return { userId: firstUser.id };
      }
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    // Hard-fail in production if webhook secret is missing
    if (IS_PRODUCTION && !WEBHOOK_SECRET) {
      console.error('Webhook POST rejected: WEBHOOK_SECRET missing in production');
      return NextResponse.json(
        { error: 'Service misconfiguration' },
        { status: 500 }
      );
    }

    // Extract client IP for rate limiting
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    // Rate limiting check (30 requests per 60 seconds per IP)
    const { allowed, remaining, resetAt } = checkWebhookRateLimit(
      clientIp,
      30,
      60
    );

    if (!allowed) {
      console.warn('Webhook rate limit exceeded', {
        clientIp,
        resetAt: new Date(resetAt).toISOString(),
      });
      const response = NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
      response.headers.set(
        'Retry-After',
        String(Math.ceil((resetAt - Date.now()) / 1000))
      );
      response.headers.set('X-RateLimit-Limit', '30');
      response.headers.set('X-RateLimit-Remaining', String(remaining));
      return response;
    }

    // Request body size check via content-length header (max 64KB)
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 65536) {
      console.error('Webhook body size exceeded', {
        clientIp,
        contentLength: parseInt(contentLength),
      });
      return NextResponse.json(
        { error: 'Request body too large' },
        { status: 413 }
      );
    }

    // Authentication check
    const authHeader =
      req.headers.get('X-Webhook-Secret') ||
      req.headers.get('Authorization');

    if (WEBHOOK_SECRET) {
      let isAuthenticated = false;
      try {
        if (authHeader === `Bearer ${WEBHOOK_SECRET}`) {
          isAuthenticated = crypto.timingSafeEqual(
            Buffer.from(authHeader),
            Buffer.from(`Bearer ${WEBHOOK_SECRET}`)
          );
        } else if (authHeader === WEBHOOK_SECRET) {
          isAuthenticated = crypto.timingSafeEqual(
            Buffer.from(authHeader),
            Buffer.from(WEBHOOK_SECRET)
          );
        }
      } catch {
        // timingSafeEqual throws on buffer length mismatch; treat as no match
        isAuthenticated = false;
      }

      if (!isAuthenticated) {
        console.warn('Webhook authentication failed', {
          clientIp,
          hasAuthHeader: !!authHeader,
        });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await req.json();

    // Validate payload
    const parseResult = WebhookPayloadSchema.safeParse(body);
    if (!parseResult.success) {
      console.error('Webhook validation failed', {
        clientIp,
        errors: parseResult.error.flatten(),
      });
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }

    const validated = parseResult.data;

    // Find user context
    const userContext = await findUserFromWebhook(validated, authHeader);

    // Create signal in database
    const signalRecord = userContext
      ? await prisma.signal.create({
          data: {
            userId: userContext.userId,
            botId: userContext.botId,
            symbol: validated.symbol,
            action: validated.action.toUpperCase(),
            direction: ['BUY', 'LONG'].includes(validated.action.toUpperCase())
              ? 'LONG'
              : 'SHORT',
            price: validated.price,
            strategy: validated.strategy || 'TradingView Webhook',
            stopLoss: validated.stopLoss,
            takeProfit: validated.takeProfit,
            source: 'tradingview',
            payload: body,
            status: 'PENDING',
            processed: false,
          },
        })
      : null;

    // Build signal for executor
    const signal: Signal = {
      symbol: validated.symbol,
      action: validated.action.toUpperCase() as
        | 'BUY'
        | 'SELL'
        | 'EXIT'
        | 'LONG'
        | 'SHORT',
      price: validated.price,
      strategy: validated.strategy || 'TradingView Webhook',
      timestamp: new Date().toISOString(),
      notes: validated.notes || '',
      stopLoss: validated.stopLoss,
      takeProfit: validated.takeProfit,
    };

    // Trigger Execution (with user context if available)
    const executor = new TradeExecutor({
      accountBalance: parseFloat(process.env.ACCOUNT_BALANCE || '10000'),
      riskPerTradePercent: parseFloat(process.env.RISK_PER_TRADE || '1'),
      userId: userContext?.userId,
      botId: userContext?.botId,
    });

    await executor.processSignal(signal);

    // Mark signal as processed
    if (signalRecord) {
      await prisma.signal.update({
        where: { id: signalRecord.id },
        data: {
          processed: true,
          processedAt: new Date(),
          status: 'EXECUTED',
        },
      });
    }

    // Audit log
    if (userContext) {
      await prisma.auditLog.create({
        data: {
          userId: userContext.userId,
          action: 'webhook.received',
          resourceType: 'Signal',
          resourceId: signalRecord?.id,
          status: 'SUCCESS',
          ipAddress: clientIp,
          userAgent: req.headers.get('user-agent'),
          metadata: {
            symbol: validated.symbol,
            action: validated.action,
            strategy: validated.strategy,
          } as object,
        },
      });
    }

    console.log('Webhook processed successfully', {
      clientIp,
      signalId: signalRecord?.id,
      symbol: validated.symbol,
      userId: userContext?.userId,
    });

    return NextResponse.json({
      status: 'success',
      received: true,
      signalId: signalRecord?.id,
      symbol: validated.symbol,
    });
  } catch (error) {
    console.error('Webhook processing error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
