import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { AGENTS_DB_PATH } from '@/lib/dataPaths';

// SSE keepalive comment sent every 30s to keep connection alive
const KEEPALIVE_INTERVAL = 30000;

// Check for file changes every 1s
const WATCH_INTERVAL = 1000;

interface AgentState {
    last_updated: string;
    status: string;
    active_pairs: number;
    total_zones_found: number;
    performance: {
        win_rate: number;
        total_pnl: number;
        trades: number;
    };
    active_trades: Array<Record<string, unknown>>;
    pending_orders: Array<Record<string, unknown>>;
    closed_trades: Array<Record<string, unknown>>;
    meta?: Record<string, unknown>;
    [key: string]: unknown;
}

export async function GET(req: NextRequest) {
    // Check if client supports SSE (not all browsers/proxies do)
    const userAgent = req.headers.get('user-agent') || '';
    const isLegacyClient = userAgent.includes('curl') || userAgent.includes('wget');

    // Create SSE response
    const encoder = new TextEncoder();
    let lastData: string = '';
    let lastMtime: number = 0;
    let keepaliveTimer: NodeJS.Timeout | null = null;
    let watchTimer: NodeJS.Timeout | null = null;

    const customReadable = new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                // Send initial comment to indicate SSE is working
                controller.enqueue(encoder.encode(': SSE stream started\n\n'));

                // Function to read and send current agent state
                const sendCurrentState = async () => {
                    try {
                        const stat = fs.statSync(AGENTS_DB_PATH);
                        const currentMtime = stat.mtimeMs;

                        // File has been modified, send update
                        if (currentMtime > lastMtime) {
                            lastMtime = currentMtime;
                            const data = fs.readFileSync(AGENTS_DB_PATH, 'utf8');

                            // Only send if data actually changed
                            if (data !== lastData) {
                                lastData = data;

                                try {
                                    // Validate JSON before sending
                                    const parsed = JSON.parse(data);
                                    const event = `data: ${JSON.stringify(parsed)}\n\n`;
                                    controller.enqueue(encoder.encode(event));
                                } catch (parseErr) {
                                    console.warn('agents_db.json invalid JSON, skipping update');
                                }
                            }
                        }
                    } catch (err: any) {
                        if (err.code !== 'ENOENT') {
                            console.error('SSE watch error:', err.message);
                        }
                    }
                };

                // Send initial state immediately
                await sendCurrentState();

                // Set up keepalive (comment-only SSE events to prevent proxy timeout)
                keepaliveTimer = setInterval(() => {
                    controller.enqueue(encoder.encode(': keepalive\n\n'));
                }, KEEPALIVE_INTERVAL);

                // Watch file for changes every 1s
                watchTimer = setInterval(sendCurrentState, WATCH_INTERVAL);
            } catch (err) {
                console.error('SSE stream setup error:', err);
                controller.close();
            }
        },

        cancel() {
            if (keepaliveTimer) clearInterval(keepaliveTimer);
            if (watchTimer) clearInterval(watchTimer);
        },
    });

    return new NextResponse(customReadable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable nginx/proxy buffering
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
    });
}

export async function OPTIONS() {
    return new NextResponse(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
