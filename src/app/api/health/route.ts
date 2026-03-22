import { NextResponse } from 'next/server';
import intelBus from '@/lib/intel/bus';

/**
 * GET /api/health
 *
 * Returns health status for all background intel services.
 * Each service writes heartbeats to the settings table via intelBus.heartbeat().
 *
 * Status values:
 *   RUNNING     — Heartbeat within last 5 minutes
 *   STALE       — Heartbeat between 5–15 minutes ago
 *   DEAD        — Heartbeat older than 15 minutes
 *   NOT_STARTED — No heartbeat recorded
 *   ERROR       — Failed to read health data
 */
export async function GET() {
    try {
        const services = intelBus.getHealth();

        // Overall status: healthy if at least one service is running
        const runningCount = Object.values(services).filter(s => s.status === 'RUNNING').length;
        const overall = runningCount > 0 ? 'HEALTHY' : 'DEGRADED';

        return NextResponse.json({
            status: overall,
            timestamp: new Date().toISOString(),
            services,
        });
    } catch (error: any) {
        console.error('[API /health] Error:', error);
        return NextResponse.json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            error: error.message,
        }, { status: 500 });
    }
}
