// ═══════════════════════════════════════════════════════════════
// INTEL SSE STREAM — Real-time Server-Sent Events for the dashboard
// GET /api/intel/stream?symbols=BTCUSD,ETHUSD
// Pushes new intel signals in real-time as they're published to the bus.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import intelBus from '@/lib/intel/bus';
import type { IntelSignal } from '@/lib/intel/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const symbolFilter = url.searchParams.get('symbols')?.split(',').map(s => s.trim().toUpperCase());

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            const send = (event: string, data: unknown) => {
                try {
                    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
                } catch {
                    // Client disconnected
                }
            };

            // 1. Send current active signals immediately on connect
            const currentSignals = symbolFilter
                ? symbolFilter.flatMap(s => intelBus.query(s))
                : intelBus.queryAll(undefined, 50);

            send('init', {
                signals: currentSignals,
                health: intelBus.getHealth(),
                timestamp: new Date().toISOString(),
            });

            // 2. Subscribe to real-time intel events
            const onIntel = (signal: IntelSignal) => {
                // Filter by symbol if requested
                if (symbolFilter && !symbolFilter.includes(signal.symbol.toUpperCase())) {
                    return;
                }
                send('intel', signal);
            };

            intelBus.on('intel', onIntel);

            // 3. Health ping every 30 seconds
            const pingInterval = setInterval(() => {
                send('health', {
                    health: intelBus.getHealth(),
                    timestamp: new Date().toISOString(),
                });
            }, 30 * 1000);

            // 4. Cleanup on disconnect
            request.signal.addEventListener('abort', () => {
                clearInterval(pingInterval);
                intelBus.off('intel', onIntel);
                try { controller.close(); } catch {}
            });
        },

        cancel() {
            // Called when the client disconnects
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
