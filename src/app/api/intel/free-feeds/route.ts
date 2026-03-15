import { NextResponse } from 'next/server';
import { startFreeFeeds, stopFreeFeeds, getFreeFeedStatus } from '@/lib/intel/free/service';

/**
 * GET /api/intel/free-feeds
 *
 * Returns the current status of free intel feeds.
 * If ?start=true is passed, auto-starts the feeds.
 */
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const shouldStart = url.searchParams.get('start') === 'true';

        if (shouldStart) {
            const state = startFreeFeeds();
            return NextResponse.json({ status: 'ok', action: 'started', ...state });
        }

        const state = getFreeFeedStatus();
        return NextResponse.json({ status: 'ok', ...state });
    } catch (error: any) {
        console.error('[API /intel/free-feeds] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/intel/free-feeds
 *
 * Control free feeds: { action: 'start' | 'stop' }
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const action = body.action;

        if (action === 'start') {
            const state = startFreeFeeds();
            return NextResponse.json({ status: 'ok', action: 'started', ...state });
        } else if (action === 'stop') {
            const state = stopFreeFeeds();
            return NextResponse.json({ status: 'ok', action: 'stopped', ...state });
        }

        return NextResponse.json({ error: 'Invalid action. Use "start" or "stop".' }, { status: 400 });
    } catch (error: any) {
        console.error('[API /intel/free-feeds] POST Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
