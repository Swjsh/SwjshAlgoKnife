import { NextRequest, NextResponse } from 'next/server';
import intelBus from '@/lib/intel/bus';
import type { IntelSource } from '@/lib/intel/types';
import { VALID_SOURCES, VALID_DIRECTIONS } from '@/lib/intel/types';
import { withApiHandler, parseLimit, apiLog } from '@/lib/api-utils';

/**
 * GET /api/intel
 *
 * Returns active (non-expired) intel signals.
 * Query params:
 *   ?symbol=BTCUSD    — Filter by symbol
 *   ?source=ORDER_FLOW — Filter by source
 *   ?limit=50          — Max results (default 100, max 500)
 */
export const GET = withApiHandler(
  {
    requireAuth: false,
    rateLimit: { max: 120, windowSeconds: 60 },
  },
  async ({ req }) => {
    try {
      const url = new URL(req.url);
      const symbol = url.searchParams.get('symbol');
      const sourceParam = url.searchParams.get('source');
      const limit = parseLimit(url.searchParams, 100, 500);

      // Validate source if provided
      const source: IntelSource | undefined = sourceParam
        ? VALID_SOURCES.has(sourceParam)
          ? (sourceParam as IntelSource)
          : undefined
        : undefined;

      if (sourceParam && !VALID_SOURCES.has(sourceParam)) {
        apiLog('warn', '/api/intel', 'Invalid source parameter', {
          sourceParam,
        });
        return NextResponse.json(
          {
            error: `Invalid source: "${sourceParam}". Valid: ${[...VALID_SOURCES].join(
              ', '
            )}`,
          },
          { status: 400 }
        );
      }

      let signals;
      if (symbol) {
        signals = intelBus.query(symbol.toUpperCase(), source);
      } else {
        signals = intelBus.queryAll(source, limit);
      }

      apiLog('info', '/api/intel', 'GET signals', {
        symbolFilter: symbol,
        sourceFilter: sourceParam,
        resultCount: signals.length,
        limit,
      });

      return NextResponse.json({
        status: 'ok',
        count: signals.length,
        signals,
      });
    } catch (error: any) {
      apiLog('error', '/api/intel', 'GET error', {
        error: error?.message || String(error),
      });
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    }
  }
);

/**
 * POST /api/intel
 *
 * Publish an intel signal to the bus.
 * Used by external services or for testing.
 *
 * Body: { source, symbol, direction, confidence, summary, payload?, expiresAt? }
 *
 * Requires authentication.
 */
export const POST = withApiHandler(
  {
    requireAuth: true,
    rateLimit: { max: 30, windowSeconds: 60 },
    maxBodySize: 65536,
  },
  async ({ user, req }) => {
    try {
      const body = await req.json();

      // Validate required fields
      if (!body.source || !body.symbol || !body.direction) {
        apiLog('warn', '/api/intel', 'POST missing required fields', {
          userId: user?.id,
          hasSource: !!body.source,
          hasSymbol: !!body.symbol,
          hasDirection: !!body.direction,
        });
        return NextResponse.json(
          {
            error: 'Missing required fields: source, symbol, direction',
          },
          { status: 400 }
        );
      }

      // Validate source
      if (!VALID_SOURCES.has(body.source)) {
        apiLog('warn', '/api/intel', 'POST invalid source', {
          userId: user?.id,
          source: body.source,
        });
        return NextResponse.json(
          {
            error: `Invalid source: "${body.source}". Valid: ${[...VALID_SOURCES].join(
              ', '
            )}`,
          },
          { status: 400 }
        );
      }

      // Validate direction
      if (!VALID_DIRECTIONS.has(body.direction)) {
        apiLog('warn', '/api/intel', 'POST invalid direction', {
          userId: user?.id,
          direction: body.direction,
        });
        return NextResponse.json(
          {
            error: `Invalid direction: "${body.direction}". Valid: ${[
              ...VALID_DIRECTIONS,
            ].join(', ')}`,
          },
          { status: 400 }
        );
      }

      // Validate confidence
      if (
        typeof body.confidence !== 'number' ||
        body.confidence < 0 ||
        body.confidence > 1
      ) {
        apiLog('warn', '/api/intel', 'POST invalid confidence', {
          userId: user?.id,
          confidence: body.confidence,
        });
        return NextResponse.json(
          {
            error: 'confidence must be a number between 0.0 and 1.0',
          },
          { status: 400 }
        );
      }

      // Validate symbol length (max 20)
      if (body.symbol.length > 20) {
        apiLog('warn', '/api/intel', 'POST symbol too long', {
          userId: user?.id,
          symbolLength: body.symbol.length,
        });
        return NextResponse.json(
          {
            error: 'symbol must be 20 characters or less',
          },
          { status: 400 }
        );
      }

      // Validate summary length (max 500)
      if (body.summary && body.summary.length > 500) {
        apiLog('warn', '/api/intel', 'POST summary too long', {
          userId: user?.id,
          summaryLength: body.summary.length,
        });
        return NextResponse.json(
          {
            error: 'summary must be 500 characters or less',
          },
          { status: 400 }
        );
      }

      const id = intelBus.publish({
        source: body.source,
        symbol: body.symbol.toUpperCase(),
        direction: body.direction,
        confidence: body.confidence,
        summary: body.summary || '',
        payload: body.payload || {},
        expiresAt: body.expiresAt,
      });

      if (id === -1) {
        apiLog('info', '/api/intel', 'POST signal deduplicated', {
          userId: user?.id,
          symbol: body.symbol.toUpperCase(),
          source: body.source,
        });
        return NextResponse.json({
          status: 'deduplicated',
          message: 'Identical signal was recently published',
        });
      }

      apiLog('info', '/api/intel', 'POST signal published', {
        userId: user?.id,
        signalId: id,
        symbol: body.symbol.toUpperCase(),
        source: body.source,
        direction: body.direction,
        confidence: body.confidence,
      });

      return NextResponse.json({ status: 'published', id });
    } catch (error: any) {
      apiLog('error', '/api/intel', 'POST error', {
        userId: user?.id,
        error: error?.message || String(error),
      });
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    }
  }
);
